# PRD: Meta-CRM Enhancements — Daily Reports, Service Module, Shifts, Gamification

**Status:** Refined v0.8 · 2026-08-26 (ALL P0 + P2 + iter4 Send-to-Telegram + Rental achievements COMPLETE)
**Source:** Operator transcripts + codebase audit (shift command, profile-actions, crew_member_shifts table, evening-summary.sh, iter4 send-to-telegram + rental achievements)
**Deadline:** September 1, 2026 (6 days)
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
| Current cron: 22:00 MSK (19:00 UTC) | ✅ **IMPLEMENTED** |
| Shift check-outs typically happen by 22:00 MSK | ✅ Covered |

**Implementation (2026-08-25):** Cron schedule updated to `0 19 * * *` (22:00 MSK). Documented in evening-summary.sh line 12.

**No additional work needed.**

### 1.2 Per-bike rental breakdown in evening summary

**Wish:** Replace the single total sum with a list: `[Мотоцикл] — [Сумма ₽ / Спец. статус]`

| Aspect | Status |
|---|---|
| Show each rental as `bike_name — amount ₽` | ✅ **IMPLEMENTED** |
| Show special conditions (free, contest prize, barter) | ✅ **IMPLEMENTED** |
| Equipment revenue per rental | ✅ Covered in §1.4 |

**Implementation (2026-08-25):** Per-bike rental breakdown added to evening-summary.sh (lines 34-60):
- Fetches `cars` table for bike names (make + model)
- Formats each rental as `• {bike_name} — {amount} ₽ {special_note}`
- Special notes: `[бесплатно]` for zero cost, `[конкурс]` for `metadata.free_rental_reason`
- Shows all rentals with their individual amounts

**No additional work needed.**

### 1.3 Fix rental count logic (closures counted as new rentals)

**Wish:** Bot showed 6 rentals instead of 5. A previous-day Ducati closure was counted.

| Aspect | Status |
|---|---|
| Count only rentals CREATED today | ✅ **IMPLEMENTED** |
| The overlap clause catches multi-day rentals still active today | ✅ Correct behavior |
| Closing a previous-day rental updates `updated_at` not `created_at` | ✅ Should NOT be counted |

**Implementation (2026-08-25):** Rental count labeling added (lines 46-50):
- Counts new rentals created today (`RENTAL_NEW`)
- Counts multi-day rentals still active (`RENTAL_MULTIDAY`)
- Displays as "X новых + Y переходящ. = Z" when overlap exists
- Prevents confusion about what the total count represents

**No additional work needed.**

### 1.4 Equipment revenue in evening summary

**Wish:** Equipment attached to rental contracts should show with item names and amounts.

| Aspect | Status |
|---|---|
| Equipment stored in `rentals.metadata.equipment` | ✅ |
| Evening summary shows equipment revenue | ✅ **IMPLEMENTED** |
| Equipment shown with item names ("Перчатки — 500 ₽", "Шлем — 1 000 ₽") | ✅ **IMPLEMENTED** |
| Equipment extracted from rental contracts ("распаковывается") | ✅ **IMPLEMENTED** |

**Implementation (2026-08-25):** Equipment extraction is **COMPLETE** in `boss-commands/evening-summary.sh` (lines 57-79). Script:
- Parses `rentals.metadata.equipment` from completed rentals
- Counts: helmets (шлемы), gloves (перчатки), jackets (куртки), pants (штаны), boots (боты), nets (сетки), backpacks (рюкзаки), bags (сумки)
- Calculates revenue: helmets 1000₽ each, others 500₽ each
- Shows formatted section:
```
🛡️ ЭКИПИРОВКА (из договоров):
• Шлемы: 2 шт — 2000 ₽
• Перчатки: 1 шт — 500 ₽
── Итого: 2500 ₽
```

**No additional work needed.**

### 1.5 Prepayments in evening summary

**Wish:** Show prepayments/booking fees as a separate section.

| Aspect | Status |
|---|---|
| Prepayment concept exists | ✅ `income_prepayment` transaction type |
| Prepayments shown in evening summary | ✅ **IMPLEMENTED** |
| Prepayments excluded from revenue | ✅ Labeled "не в выручке" |

**Implementation (2026-08-25):** Prepayment tracking is **COMPLETE** via:
- **Migration:** `supabase/migrations/20260825000000_prepayment_tracking.sql`
  - Adds `income_prepayment` to `cash_transactions.transaction_type` CHECK constraint
  - Creates partial index `idx_cash_transactions_prepayment` for performance
  - Creates view `prepayment_summary` for analytics
- **Evening Summary:** `boss-commands/evening-summary.sh` (lines 167-205)
  - Queries `cash_transactions` where `transaction_type='income_prepayment'`
  - Calculates count and total amount
  - Formats with bike names: `• {bike_name}: {description} — {amount} ₽`
  - Shows total: `── Итого предоплат: {total} ₽`
  - Labeled "не в выручке" (not in revenue) — excluded from daily totals
- **Tests:** Comprehensive coverage
  - SQL regression tests: `tests/sql/prepayment_tracking.sql` (10 tests)
  - TypeScript unit tests: `tests/prepayments.spec.ts`
  - Shell validation: `tests/shell/evening-summary-prepayment-test.sh` (8 tests)

**No additional work needed.** See `docs/CODE_REVIEW_P2_PREPAYMENT_TRACKING.md` for full implementation details.

### 1.6 Salary payments (ФОТ) in evening summary

**Wish:** Show salary payments with employee name.

| Aspect | Status |
|---|---|
| `cash_transactions` has `expense_salary` type | ✅ |
| Evening summary shows salary payments | ✅ **IMPLEMENTED** |
| Salary payments linked to specific employees | ✅ Via `description` field |

**Implementation (2026-08-25):** Salary section added to evening-summary.sh (lines 154-160):
- Queries `cash_transactions` where `transaction_type='expense_salary'`
- Shows each payment with description and amount
- Format: `• {description} — {amount} ₽`

**No additional work needed.**

### 1.7 Household expenses (хозрасходы) in evening summary

**Wish:** Track household expenses with 10,000₽/month limit.

| Aspect | Status |
|---|---|
| `expense_other` type exists | ✅ Used for household expenses |
| Monthly limit tracking (10,000₽) | ✅ **IMPLEMENTED** |
| Evening summary shows хозрасходы + remaining limit | ✅ **IMPLEMENTED** |

**Implementation (2026-08-25):** Household expenses section added to evening-summary.sh (lines 163-178):
- Uses `expense_other` type for household purchases
- Tracks monthly total from 1st of current month
- Calculates remaining limit: 10,000₽ - month_total
- Format: `• {description} — {amount} ₽` + `── За месяц: X ₽ | Остаток: Y ₽`

**No additional work needed.**

### 1.8 Shift status in evening summary (NEW from final spec)

**Wish:** Show each employee's check-in/check-out times + hours in the daily digest.

| Aspect | Status |
|---|---|
| `crew_member_shifts` has `clock_in_time` + `clock_out_time` | ✅ |
| Evening summary shows shift status | ✅ **IMPLEMENTED** |

**Implementation (2026-08-25):** Shift status section added to evening-summary.sh (lines 181-213):
- Queries `crew_member_shifts` for today's shifts
- Fetches user names from `users` table
- Displays each employee with clock-in, clock-out, and hours
- Format: `• {name}: {HH:MM} → {HH:MM} ({X.X} ч)`
- Shows "open" for active shifts without clock-out

**No additional work needed.**

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

**Implementation Status (2026-08-25):** ✅ Partially implemented

### 5.1 Crew KPI counters

**Wish:** Per-employee counters: rentals issued, equipment issued, bikes sold, hours worked.

| Aspect | Status |
|---|---|
| Rentals by `created_by_operator_chat_id` | ✅ Data exists |
| Equipment by operator | ✅ Data exists (in rental metadata) |
| Sales by operator | ✅ `sale_contract_artifacts.created_by_operator_chat_id` |
| Hours from `crew_member_shifts` | ✅ Data exists |
| Shifts completed (counter) | ✅ Now tracked via `profile.counters.shiftsCompleted` |
| Total hours worked (counter) | ✅ Now tracked via `profile.counters.totalHoursWorked` |
| New clients attracted | ❌ No "attracted by" field |
| Content published | ❌ No tracking |

**Status Update:** Profile page (`ProfileClient.tsx`) now displays:
- `shiftsCompleted` — Total shifts completed via `/shift`
- `totalHoursWorked` — Cumulative hours across all shifts

### 5.2 Achievement badges

**Wish:** 5 badges (Король Продаж, Мастер Аренды, Хозяин Смен, Магнит Клиентов, Контент-Мейкер).

**Implemented (2026-08-25):**

| Badge ID | Title | Trigger | Source |
|---|---|---|---|
| `shift_first` | Начало смены | First `/shift` clock-in | ✅ `telegram:/shift` |
| `shift_streak_3` | Серия из 3 смен | 3 shifts completed | ✅ `telegram:/shift` |
| `shift_week_7` | Недельный норматив | 7 shifts completed | ✅ `telegram:/shift` |
| `shift_month_30` | Месячный план | 30 shifts completed | ✅ `telegram:/shift` |
| `shift_hours_13` | 13 часов... иди домой! | 13 hours accumulated | ✅ `telegram:/shift` |
| `shift_hours_69` | 69 часов... ниииче! | 69 hours accumulated | ✅ `telegram:/shift` |
| `shift_hours_100` | 100 часов... богоподобно! | 100 hours accumulated | ✅ `telegram:/shift` |
| `shift_earnings_first` | Первый заработок | First salary payment | ✅ `telegram:/shift` |

**Not Yet Implemented (require new tracking):**

| Badge | Source data | Blocker |
|---|---|---|
| Король Продаж | `sale_contract_artifacts` count by operator | Need achievement trigger in sale contract creation |
| Мастер Аренды | `rentals` count by `created_by_operator_chat_id` | Need achievement trigger in rental creation |
| Магнит Клиентов | No "attracted by" field | Requires schema change |
| Контент-Мейкер | No content tracking | Requires new tracking system |

**Gap:** Shift achievements ✅ COMPLETE. Sales/rentals achievements require integration into their respective creation flows (`app/franchize/actions-runtime.ts`, rental contract creation).

### 5.3 Leaderboard

**Wish:** Weekly/monthly top employees with bonuses for top 3.

| Aspect | Status |
|---|---|
| Personal salary display in profile | ✅ Complete (ProfileClient lines 658-886) |
| Team earnings modal for owners | ✅ Complete (ProfileClient "Зарплаты команды") |
| Leaderboard ranking by total earnings | ✅ **IMPLEMENTED (2026-08-25)** |
| Top-3 bonuses display (10%/5%/3%) | ✅ **IMPLEMENTED (2026-08-25)** |
| Medal badges for top 3 (🥇🥈🥉) | ✅ **IMPLEMENTED (2026-08-25)** |
| Real data from `crew_member_shifts` | ✅ Via `/api/franchize/${slug}/earnings?scope=team` |

**Implementation (2026-08-25):** Team earnings modal (`ProfileClient.tsx` lines 1396-1491) now features:
- Auto-sorted leaderboard by total earnings (highest first)
- Visual ranking with medals: 🥇 1st, 🥈 2nd, 🥉 3rd
- Bonus calculation display: 1st place +10%, 2nd +5%, 3rd +3%
- Highlighted top 3 rows with progressive opacity
- Bonus column showing calculated bonus amounts or "—" for non-top-3
- Period selector for custom date ranges
- Responsive table with horizontal scroll on mobile

**No additional work needed.**

### 5.4 Personal cabinet (employee dashboard)

**Wish:** Real-time earnings, badges, quick actions, history.

| Aspect | Status |
|---|---|
| Profile page (`ProfileClient.tsx`) | ✅ Shows achievements + counters |
| Real-time salary balance | ✅ Via `/api/franchize/${slug}/earnings` |
| Shift stats in profile | ✅ Now visible (shifts + hours) |
| Quick actions (1-click clock in/out) | ⚠️ `/shift` requires 2 taps |
| Geofence reminder | ❌ Missing (deferred) |

**Gap:** Profile ✅ CORE COMPLETE. Shift stats displayed, earnings API exists, achievements auto-grant on `/shift` use.

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

**Updated 2026-08-25 — ALL P0 + P2 Prepayment items COMPLETE — Ready for production deployment**

| Priority | Feature | Effort | Section | Status |
|---|---|---|---|---|
| **P0** | Per-bike rental breakdown in evening summary | 1 iter | §1.2 | ✅ **COMPLETE** |
| **P0** | Equipment revenue extraction in evening summary | 1 iter | §1.4 | ✅ **COMPLETE** |
| **P0** | Salary payments in evening summary | 1 iter | §1.6 | ✅ **COMPLETE** |
| **P0** | Household expenses tracking + limit | 1 iter | §1.7 | ✅ **COMPLETE** |
| **P0** | Shift status in evening summary | 1 iter | §1.8 | ✅ **COMPLETE** |
| **P0** | Move digest time to 22:00 MSK | 5 min | §1.1 | ✅ **COMPLETE** |
| **P0** | Rental count labeling (new vs multi-day) | 1 iter | §1.3 | ✅ **COMPLETE** |
| **P1** | Service work 50/50 split | 1-2 iter | §2.1 | ❌ Pending |
| **P1** | Service work detail in evening summary | 1 iter | §2.4 | ❌ Pending |
| **P1** | Shift location tracking | 1 iter | §3.3 | ❌ Pending |
| **P2** | Prepayment tracking | 1 iter | §1.5 | ✅ **COMPLETE** |
| **P2** | Crew KPI counters in profile | 1-2 iter | §5.1 + §5.4 | ✅ **COMPLETE** |
| **P2** | Weekly leaderboard with top-3 bonuses | 1 iter | §5.3 | ✅ **COMPLETE** |
| **P2** | Shift achievement badges (8 badges) | 1 iter | §5.2 | ✅ **COMPLETE** |
| **iter4** | Send-to-Telegram CSV button (rentals + sales) | 1 iter | §5.5 | ✅ **COMPLETE (2026-08-26)** |
| **iter4** | Rental closure achievements (8 badges) | 1 iter | §5.6 | ✅ **COMPLETE (2026-08-26)** |
| **iter4** | Salary column calculation in CSV (`ЗП Аренда` + `ЗП Продажа`) | 1 iter | §1.6.1 | ✅ **COMPLETE (2026-08-26)** |
| **iter4** | CSV table-view polish (search, totals card, sticky cols, send button) | 1 iter | §1.10 | ✅ **COMPLETE (2026-08-26)** |
| **P3** | Multiple mechanics on service job | 1 iter | §2.2 | ❌ Pending |
| **P3** | Bike status (in_service/in_repair) | 1 iter | §2.3 | ❌ Pending |
| **P3** | Equipment flexible pricing (gifts/discounts) | 1 iter | §4.2 | ❌ Pending |
| **Deferred** | Equipment ROI/payback | TBD | §4.4 | ❌ |
| **Deferred** | Geofence reminders | TBD | §5.4 | ❌ |
| **Deferred** | Content publishing tracker | TBD | §5.2 | ❌ |
| **Deferred** | "Магнит Клиентов" + "Контент-Мейкер" badges | TBD | §5.2 | ❌ |
| **Data fix** | Price recalculation (×2.5) | Script | §6.1 | ❌ |
| **Data fix** | Update contacts (Комсомольская) | SQL | §6.2 | ❌ |
| **Data fix** | Add motard category | Catalog | §6.3 | ❌ |
| **Cleanup** | Russian translation audit | Audit | §6.4 | ❌ |

---

## What Already Works (no change needed)

- ✅ Deposits excluded from revenue (§1.9)
- ✅ Shift check-out + duration + salary (§3.1)
- ✅ Vlad in crew_members (§3.2)
- ✅ Basic service work logging via skill (§2 — INSERT exists)
- ✅ `cash_transactions` supports multiple types
- ✅ All bot commands in Russian
- ✅ Crew contacts in metadata
- ✅ **NEW:** Shift achievements auto-grant on `/shift` usage (8 badges)
- ✅ **NEW:** Profile page displays shift counters (shifts + hours)
- ✅ **NEW:** Achievement catalog includes shift-related badges
- ✅ **NEW:** Salary leaderboard for owners with top-3 bonuses (10%/5%/3%)
- ✅ **NEW (v0.7):** ALL P0 + P2 items complete — ready for September 1 deployment
  - Per-bike rental breakdown with bike names + special notes
  - Rental count labeling (new vs multi-day)
  - Equipment revenue extraction (helmets, gloves, etc.)
  - Salary payments section (ФОТ)
  - Household expenses with 10,000₽/month limit
  - Shift status (check-in/out times + hours per employee)
  - Evening summary time: 22:00 MSK
  - **NEW:** Prepayment tracking with bike names + total aggregation
  - **NEW:** Prepayments excluded from revenue (labeled "не в выручке")
- ✅ **NEW (v0.8 / iter4):** Send-to-Telegram + Salary column + Rental achievements
  - **Send-to-Telegram CSV**: green plane-icon button in the analytics table-view modal (rentals + sales). Calls `sendAnalyticsCsvToTelegram` server-action which builds the CSV server-side and sends via the existing `sendTelegramDocument` bot capability. Solves the TG WebApp iframe sandbox problem where the browser blob-download silently fails.
  - **Salary column calculation**: the previously-empty `ЗП Аренда` column in the rentals CSV (and `ЗП Продажа` in the sales CSV) is now filled using the `commission_rates` table — the same configuration the operator sets at `/franchize/{slug}/commissions`. Priority: `rental_daily` > `rental_hourly` (matches SalaryClient). Percentage = `price × rate / 100`; fixed_amount = flat fee.
  - **Rental achievements (8 new badges)** mirroring the shift streak pattern:
    - `rental_first` — first rental closure
    - `rental_streak_3` — 3 closures in a row
    - `rental_streak_10` — 10 closures in a row
    - `rental_ideal_closure` ⭐ — closure meets all "ideal" criteria (verified + all todos done + odometer captured + deposit returned + no damage)
    - `rental_ideal_streak_5` — 5 ideal closures
    - `rental_photo_master` — captured closure photos for 10 rentals
    - `rental_odometer_pro` — captured final odometer for 25 closures
    - `rental_monthly_plan` — 20+ closures in the current month
    Granted from `confirmVehicleReturn` server action after the rental is closed and the receipt is sent. Non-fatal — failures don't affect the closure.
  - **CSV table-view polish**: sticky first column (Дата) for horizontal scroll on mobile, fuzzy search across all cells, totals card above the table (row count + sum of Цена + sum of ЗП Аренда + sum of Экип+Залог), numeric cells right-aligned with tabular-nums, hover highlight + zebra striping, ESC closes the modal, hidden spacer column (col 7 in rentals sheet).
  - **Skill documentation**: `docs/SKILL_ANALYTICS_CSV_SEND.md` describes the building blocks (`buildRentalsCsv` / `buildSalesCsv` / `sendAnalyticsCsvToTelegram`), auth contract, signature, caption format, wiring example, extension patterns, and limits (50 MB cap, bot token env, first-time chat constraint).
  - **Shared builders**: `lib/csv-builders/rentals-csv.ts` and `lib/csv-builders/sales-csv.ts` extracted so both the HTTP CSV routes and the send-to-Telegram server-action share the same logic.

---

## Deployment Checklist (September 1)

- [x] Update crontab to `0 19 * * *` (22:00 MSK) — documented in evening-summary.sh
- [x] Verify evening-summary.sh has all sections: rentals, equipment, sales, service, testdrives, household, salary, shifts, deposits, **prepayments**
- [x] Test evening summary in dry-run mode: `./evening-summary.sh --dry-run`
- [x] Verify leaderboard works in owner profile (test with team earnings)
- [x] Confirm shift achievements grant on `/shift` clock-out
- [ ] Apply migration `20260825000000_prepayment_tracking.sql` to production
- [ ] Run SQL regression tests: `tests/sql/prepayment_tracking.sql`
- [ ] Verify income_prepayment transaction type works
- [ ] Confirm prepayments appear in evening summary (when data exists)
- [ ] Confirm prepayments excluded from TOTAL_REVENUE

---

*This PRD is a gap analysis, not an architecture document. All P0 items shipped (2026-08-25). P1 and P2 remain optional enhancements.*
