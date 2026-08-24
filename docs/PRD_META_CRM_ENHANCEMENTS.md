# PRD: Meta-CRM Enhancements — Daily Reports, Service Module, Shifts, Gamification

**Status:** Draft v0.2 · 2026-08-24
**Source:** Operator transcripts (requests_transcripts.txt + hotelki.txt + Master_TZ_Meta_CRM_Final_Specification.html)
**Deadline:** September 1, 2026 (10 days)
**KPI:** Fully working automated financial + operational reporting from September 1

---

## Crew Members (verified from Supabase)

| user_id | Name | Role | Shift tracking? |
|---|---|---|---|
| 356282674 | Илья (I_O_S_NN) | owner | ✅ |
| 244736261 | Роман (Roman_Vip_Bike_Electro) | co_owner | ✅ |
| 413553377 | Paul (salavey13) | admin | ✅ |
| 7813830016 | Рустам (DJORUDJOV) | admin | ✅ |
| 687580818 | Георгий (Goollil) | co_owner | ✅ |
| 6266482385 | Oleg (Oleg_FiL_Ai) | member | ⚠️ |
| 7868630963 | Влад/Слава (timonya0420) | member | ✅ — the service guy |
| 6861997454 | Светлана (Star_Soul_11_11) | member | ⚠️ |

**Vlad/Slava (7868630963)** is already in `crew_members` with `role=member` and `status=active`. He can use `/shift` immediately — no data fix needed.

---

## How to read this PRD

Each wish from the transcripts is listed once (deduplicated), categorized into a section, and compared against **what already exists** in the codebase. The "Gap" column says what's missing.

---

## Section 1: Daily Financial Report (Evening Summary)

**Existing:** `boss-commands/evening-summary.sh` (217 lines) — runs at 21:00 MSK daily, sends TG message to admin. Currently shows:
- Rentals: total count + total revenue (single sum, no per-bike breakdown)
- Sales: total count + revenue
- Services: total count + revenue (services = rentals where `vehicle_id` is in `cars.type='service'`)
- Testdrives: KPI count
- Deposits: collected/returned/penalty per destination (cash/tbank/sber)
- Active rentals list (top 5, with deep links)
- Total daily revenue (rentals + sales + services combined)

### 1.1 Move digest time later (after shift check-outs)

**Wish:** Shift the evening summary to a later time so it captures all shift check-outs.

| Aspect | Status |
|---|---|
| Current cron: 21:00 MSK (18:00 UTC) | ✅ Set in crontab |
| Shift check-outs typically happen by 22:00 MSK | ⚠️ Summary may miss late check-outs |

**Gap:** Move cron from `0 18 * * *` to `0 19 * * *` (22:00 MSK). One-line crontab change.

### 1.2 Per-bike rental breakdown in evening summary

**Wish:** Replace the single total sum with a list: `[Мотоцикл] — [Сумма ₽ / Спец. статус]`

| Aspect | Status |
|---|---|
| Show each rental as `bike_name — amount ₽` | ❌ Missing — summary only shows total count + sum |
| Show special conditions (free, contest prize, barter) | ❌ Missing |
| Show equipment revenue per rental | ❌ Missing — `rentals.metadata.equipment` exists but not surfaced |

**Gap:** The `RENTALS_DATA` query selects `rental_id, status, total_cost, agreed_end_date, vehicle_id` — doesn't join `cars` for bike name. Need a pre-fetched `cars` lookup (id→make+model) + a jq loop that formats each rental as `• {bike_name} — {amount} ₽ {special_note}`. Special notes from `metadata.price_overridden && total_cost === 0` → `[бесплатно]`, `metadata.free_rental_reason` → `[конкурс]`.

### 1.3 Fix rental count logic (closures counted as new rentals)

**Wish:** Bot showed 6 rentals instead of 5. A previous-day Ducati closure was counted.

| Aspect | Status |
|---|---|
| Count only rentals CREATED today | ⚠️ Query uses `OR (created_at today, period overlap today)` |
| The overlap clause catches multi-day rentals still active today | ✅ Correct behavior |
| Closing a previous-day rental updates `updated_at` not `created_at` | ✅ Should NOT be counted |

**Gap:** The count is likely correct — the 6th rental is a multi-day overlap. Fix: LABEL the count as "5 новых + 1 переходящая = 6" instead of just "6".

### 1.4 Equipment revenue in evening summary

**Wish:** Equipment attached to rental contracts should show with item names and amounts.

| Aspect | Status |
|---|---|
| Equipment stored in `rentals.metadata.equipment` | ✅ |
| Evening summary shows equipment revenue | ❌ Missing |
| Equipment shown with item names ("Перчатки — 500 ₽", "Шлем — 1 000 ₽") | ❌ Missing |
| Equipment extracted from rental contracts ("распаковывается") | ❌ Missing |

**Gap:** Add a jq extraction that pulls equipment from each rental's metadata, calculates cost (helmet: 500₽ hourly / 1000₽ daily; others: 500₽ flat), and shows a summary section:
```
🛡️ АРЕНДА И ВЫДАЧА ЭКИПИРОВКИ (Извлечено из договоров):
  • 2 шлема (к договору Jilang) — 2 000 ₽
  • Перчатки — 500 ₽
  ── Итого экипировка: 2 500 ₽
```

### 1.5 Prepayments in evening summary

**Wish:** Show prepayments/booking fees as a separate section.

| Aspect | Status |
|---|---|
| Prepayment concept exists | ❌ Missing |
| Prepayments shown in evening summary | ❌ Missing |

**Gap:** Add `income_prepayment` to `cash_transactions`. Include in summary: `💳 ПРЕДОПЛАТЫ: • {bike} — {amount} ₽`.

### 1.6 Salary payments (ФОТ) in evening summary

**Wish:** Show salary payments with employee name.

| Aspect | Status |
|---|---|
| `cash_transactions` has `expense_salary` type | ✅ |
| Evening summary shows salary payments | ❌ Missing |
| Salary payments linked to specific employees | ⚠️ Via `description` field only |

**Gap:** Add salary section: query `cash_transactions WHERE transaction_type='expense_salary' AND created_at=today`, show `• {description} — {amount} ₽`.

### 1.7 Household expenses (хозрасходы) in evening summary

**Wish:** Track household expenses with 10,000₽/month limit.

| Aspect | Status |
|---|---|
| `expense_other` type exists | ✅ Could be used |
| Dedicated `expense_household` type | ❌ Missing |
| Monthly limit tracking (10,000₽) | ❌ Missing |
| Evening summary shows хозрасходы + remaining limit | ❌ Missing |

**Gap:** Add `expense_household` type. Summary shows: `🛒 ХОЗРАСХОДЫ: {amount} ₽ (Лимит: 10 000 ₽/мес, остаток: {remaining} ₽)`.

### 1.8 Shift status in evening summary (NEW from final spec)

**Wish:** Show each employee's check-in/check-out times + hours in the daily digest.

| Aspect | Status |
|---|---|
| `crew_member_shifts` has `clock_in_time` + `clock_out_time` | ✅ |
| Evening summary shows shift status | ❌ Missing |

**Gap:** Add a section at the bottom of the evening summary:
```
⏱️ СТАТУС СМЕН СОТРУДНИКОВ:
  • Рустам: 09:00 → 18:00 (9 ч)
  • Паша: 10:00 → 21:00 (11 ч)
  • Влад: 11:00 → 19:00 (8 ч)
```
Query: `crew_member_shifts WHERE clock_in_time::date = today`.

### 1.9 Deposits excluded from revenue

**Wish:** Deposits should not appear in the daily revenue total.

| Aspect | Status |
|---|---|
| Deposits shown separately | ✅ |
| Deposits excluded from `TOTAL_REVENUE` | ✅ |

**Gap:** ✅ **Already works.** No change needed.

---

## Section 2: Service Work Module

**Existing:**
- `skills/service-work-text/SKILL.md` — logs service work via INSERT into `rentals` with `vehicle_id` pointing to `cars.type='service'`
- 3+ service items exist in `cars` table (`vip-bike-svc-011`, etc.)
- Service work shows in evening summary under "🔧 Сервис"

### 2.1 Service work with 50/50 income split

**Wish:** Auto-split: 50% to mechanic's salary, 50% to company.

| Aspect | Status |
|---|---|
| Service work logged via skill | ✅ |
| 50/50 split calculation | ❌ Missing |
| Mechanic identified | ❌ Missing — no `mechanic_id` field |
| Auto-create `expense_salary` for mechanic's 50% | ❌ Missing |

**Gap:** When service rental is created, add `metadata.mechanic_id` + `metadata.service_split = { mechanic: 50%, company: 50% }`. Auto-create `cash_transactions` row with `transaction_type='expense_salary'`, `amount = total_cost * 0.5`.

### 2.2 Multiple mechanics on one service job

**Wish:** Support primary + assistant (e.g., Slava primary + Vlad assistant).

| Aspect | Status |
|---|---|
| Multiple mechanics | ❌ Missing |
| Split among multiple | ❌ Missing |

**Gap:** Store `metadata.mechanics = [{ user_id, role: "primary"|"assistant", split_percent }]`. Company 50%, primary 30%, assistant 20% (configurable).

### 2.3 Bike status: "in service" / "in repair"

**Wish:** Mark bikes as in_service/in_repair with damage description.

| Aspect | Status |
|---|---|
| Bike status field | ❌ Missing |
| Damage description | ❌ Missing |

**Gap:** Add `metadata.status` to `cars` (available/in_service/in_repair/sold) + `metadata.damage_notes`.

### 2.4 Service work in evening summary — detailed + total

**Wish:** Show both detailed breakdown and total service revenue.

| Aspect | Status |
|---|---|
| Total service revenue in summary | ✅ Already shown |
| Per-job detail (bike, work type, mechanic, split) | ❌ Missing |

**Gap:** Add per-service-work line items: `• Yamaha R6 (подтяжка цепи) — 1 300 ₽ → Влад: 650₽ / Компания: 650₽`.

---

## Section 3: Shift Tracking

**Existing:**
- `crew_member_shifts` table with `clock_in_time`, `clock_out_time`, `duration_minutes` (generated), `hourly_rate`, `salary_amount`
- `/shift` bot command, `app/api/crew/shifts/route.ts`
- Vlad (7868630963) is already a crew member ✅

### 3.1 Check-out

| Aspect | Status |
|---|---|
| `clock_out_time` | ✅ |
| Duration auto-calculated | ✅ |
| Salary auto-calculated | ✅ |

**Gap:** ✅ **Already works.**

### 3.2 Vlad in shift tracking

| Aspect | Status |
|---|---|
| Vlad in `crew_members` | ✅ (user_id=7868630963, role=member, status=active) |

**Gap:** ✅ **Already works.** Vlad can use `/shift` immediately.

### 3.3 Location tracking

**Wish:** Track which location (VIP-BEL, Байк 2 Дом) the shift was at.

| Aspect | Status |
|---|---|
| Location field | ❌ Missing |

**Gap:** Add `location` column to `crew_member_shifts`. Set on clock-in via `/shift` command (add location selector keyboard).

---

## Section 4: Equipment Analytics

### 4.1 Auto-extract equipment from rental contracts

**Wish:** If equipment is in a rental contract, "unpack" it into the equipment section.

| Aspect | Status |
|---|---|
| Equipment in `rentals.metadata.equipment` | ✅ |
| Auto-extract + display separately | ❌ Missing (covered in §1.4) |

### 4.2 Flexible pricing (gifts, discounts)

**Wish:** Ability to mark equipment as gift/discounted (e.g., "коцаный шлем за 500₽ другу Феди").

| Aspect | Status |
|---|---|
| Custom price per equipment item | ⚠️ /doc flow has fixed prices (helmet 500/1000, others 500) |
| Gift/discount flag | ❌ Missing |

**Gap:** Add `metadata.equipment_overrides = [{ key: "helmet", price: 500, note: "коцаный, друг Феди" }]` on rental. Override takes priority over default pricing.

### 4.3 Sale vs rental equipment

**Wish:** Separate sold equipment from rented equipment.

| Aspect | Status |
|---|---|
| Equipment sale tracking | ⚠️ `cars.type='accessory'` or `type='sale_item'` exists |
| Sale vs rental distinction in report | ❌ Missing |

### 4.4 Equipment ROI / payback tracking

**Wish:** Track purchase cost vs accumulated rental income per item.

| Aspect | Status |
|---|---|
| Purchase cost stored | ❌ Missing |
| Per-item income tracking | ❌ Missing |
| Payback status | ❌ Missing |
| Non-liquid detection (>30 days no movement) | ❌ Missing |

**Gap:** Deferred to v2. Requires per-item inventory tracking (individual helmet serial numbers, not just counts).

---

## Section 5: Gamification / KPI / Achievements

### 5.1 Crew KPI counters

**Wish:** Per-employee counters: rentals issued, equipment issued, bikes sold, hours worked.

| Aspect | Status |
|---|---|
| Rentals by `created_by_operator_chat_id` | ✅ Data exists |
| Equipment by operator | ✅ Data exists (in rental metadata) |
| Sales by operator | ✅ `sale_contract_artifacts.created_by_operator_chat_id` |
| Hours from `crew_member_shifts` | ✅ Data exists |
| New clients attracted | ❌ No "attracted by" field |
| Content published | ❌ No tracking |

**Gap:** KPI counters = SQL aggregation from existing data. Display in profile page or weekly leaderboard script.

### 5.2 Achievement badges

**Wish:** 5 badges (Король Продаж, Мастер Аренды, Хозяин Смен, Магнит Клиентов, Контент-Мейкер).

| Badge | Source data | Feasible for Sep 1? |
|---|---|---|
| Король Продаж | `sale_contract_artifacts` count by operator | ✅ |
| Мастер Аренды | `rentals` count by `created_by_operator_chat_id` | ✅ |
| Хозяин Смен | `crew_member_shifts.duration_minutes` sum | ✅ |
| Магнит Клиентов | No "attracted by" field | ❌ Deferred |
| Контент-Мейкер | No content tracking | ❌ Deferred |

**Gap:** Ship 3 badges (Король Продаж, Мастер Аренды, Хозяин Смен) as SQL queries + emoji display. Defer 2 badges (Магнит, Контент) — require new tracking fields.

### 5.3 Leaderboard

**Wish:** Weekly/monthly top employees.

| Aspect | Status |
|---|---|
| Leaderboard | ❌ Missing |

**Gap:** Build `boss-commands/weekly-leaderboard.sh` that aggregates by operator + displays as TG message. Or extend the web dashboard.

### 5.4 Personal cabinet (employee dashboard)

**Wish:** Real-time earnings, badges, quick actions, history.

| Aspect | Status |
|---|---|
| Profile page exists | ✅ (shows CyberFitness, not crew KPIs) |
| Real-time salary balance | ❌ Missing |
| Quick actions (1-click clock in/out, service log) | ⚠️ `/shift` exists but not 1-click |
| Geofence reminder | ❌ Missing (deferred) |

**Gap:** For Sep 1, extend profile page with: crew KPI counters, shift hours this month, salary earned this month (from `crew_member_shifts.salary_amount` sum). Defer geofence + content tracker.

---

## Section 6: Catalog & Localization

### 6.1 Price recalculation (×2.5)

**Wish:** `new_price = base_price × 2.5`

| Aspect | Status |
|---|---|
| Bulk price update tool | ❌ Missing |

**Gap:** One-time script. Need clarification: base_price = current `daily_price`?

### 6.2 Update contacts

**Wish:** Remove WyeVolt, add Комсомольская площадь.

| Aspect | Status |
|---|---|
| Crew contacts in `crews.metadata.contacts` | ✅ |

**Gap:** One-time SQL update. Data fix, not code.

### 6.3 Add "Motard" category

**Wish:** Add motard bikes.

| Aspect | Status |
|---|---|
| Catalog supports any bike | ✅ |
| Motard filter/subtype | ❌ Missing |

**Gap:** Add bikes with `specs.bike_subtype = "motard"`. Add filter pill in catalog. Or just add them — they'll show as regular bikes.

### 6.4 Full Russian translation

| Aspect | Status |
|---|---|
| Bot commands in Russian | ✅ |
| Web app in Russian | ✅ |
| Remaining English | ⚠️ Audit needed |

**Gap:** Minor cleanup. Not a feature.

---

## Reference: Target Evening Digest Format

```
📊 ЕЖЕДНЕВНЫЙ ВЕЧЕРНИЙ ДАЙДЖЕСТ — МОТОПРОКАТ

🔑 АРЕНДЫ ТЕХНИКИ (Всего: 5):
  1. Jilang (Джиланг) — 5 500 ₽
  2. Leopard Osaka — 4 000 ₽
  3. Breakout (Брайкаут) — 4 000 ₽
  4. CBR (Сибирь) — 0 ₽ [бесплатно]
  5. Бесплатная аренда (1 час) — 0 ₽ [конкурс]

🛡️ АРЕНДА И ВЫДАЧА ЭКИПИРОВКИ (Извлечено из договоров):
  • 2 шлема (к договору Jilang) — 2 000 ₽
  • Перчатки — 500 ₽
  ── Итого экипировка: 2 500 ₽

💳 ПРЕДОПЛАТЫ / БРОНИРОВАНИЕ:
  • BMW — 5 000 ₽ (Предоплата за бронь)

🛠️ СЕРВИС И ОБСЛУЖИВАНИЕ:
  • Yamaha R6 (подтяжка цепи) — 1 300 ₽
    ├── 50% Влад (ЗП): 650 ₽
    └── 50% Компания: 650 ₽
  ── Итого сервис: 1 300 ₽

🛒 ХОЗРАСХОДЫ (ФОНД 10 000 ₽/МЕС):
  • Закупки за день — 800 ₽ (Рустам)
  • Остаток лимита: 9 200 ₽

💸 ЗАРПЛАТЫ И ВЫПЛАТЫ (ФОТ):
  • Влад — 3 800 ₽

🔒 ЗАЛОГИ (не входят в выручку):
  • 💵 Cash: +20 000 collected, -20 000 returned
  • 💳Т T-Bank: +15 000 collected, -15 000 returned

⏱️ СТАТУС СМЕН:
  • Рустам: 09:30 → 22:00 (12.5 ч)
  • Паша: 09:30 → open
  • Влад: 11:00 → 19:00 (8 ч)

━━━━━━━━━━━━━━━━━━
Итого выручка за день: 17 300 ₽
```

---

## Implementation Priority (for September 1)

| Priority | Feature | Effort | Section |
|---|---|---|---|
| **P0** | Per-bike rental breakdown in evening summary | 1 iter | §1.2 |
| **P0** | Equipment revenue extraction in evening summary | 1 iter | §1.4 |
| **P0** | Salary payments in evening summary | 1 iter | §1.6 |
| **P0** | Household expenses tracking + limit | 1 iter | §1.7 |
| **P0** | Shift status in evening summary | 1 iter | §1.8 |
| **P0** | Move digest time to 22:00 MSK | 5 min | §1.1 |
| **P1** | Service work 50/50 split | 1-2 iter | §2.1 |
| **P1** | Service work detail in evening summary | 1 iter | §2.4 |
| **P1** | Rental count labeling | 1 iter | §1.3 |
| **P1** | Shift location tracking | 1 iter | §3.3 |
| **P2** | Prepayment tracking | 1 iter | §1.5 |
| **P2** | Crew KPI counters in profile | 1-2 iter | §5.1 + §5.4 |
| **P2** | Weekly leaderboard | 1 iter | §5.3 |
| **P2** | 3 achievement badges (sales, rentals, hours) | 1 iter | §5.2 |
| **P3** | Multiple mechanics on service job | 1 iter | §2.2 |
| **P3** | Bike status (in_service/in_repair) | 1 iter | §2.3 |
| **P3** | Equipment flexible pricing (gifts/discounts) | 1 iter | §4.2 |
| **Deferred** | Equipment ROI/payback | TBD | §4.4 |
| **Deferred** | Geofence reminders | TBD | §5.4 |
| **Deferred** | Content publishing tracker | TBD | §5.2 |
| **Deferred** | "Магнит Клиентов" + "Контент-Мейкер" badges | TBD | §5.2 |
| **Data fix** | Price recalculation (×2.5) | Script | §6.1 |
| **Data fix** | Update contacts (Комсомольская) | SQL | §6.2 |
| **Data fix** | Add motard category | Catalog | §6.3 |
| **Cleanup** | Russian translation audit | Audit | §6.4 |

---

## What Already Works (no change needed)

- ✅ Deposits excluded from revenue (§1.9)
- ✅ Shift check-out + duration + salary (§3.1)
- ✅ Vlad in crew_members (§3.2)
- ✅ Basic service work logging via skill (§2 — INSERT exists)
- ✅ `cash_transactions` supports multiple types
- ✅ All bot commands in Russian
- ✅ Crew contacts in metadata

---

*This PRD is a gap analysis, not an architecture document. Ship P0 items first (all are additions to `evening-summary.sh`), then P1, then P2.*
