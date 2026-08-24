# PRD: Meta-CRM Enhancements — Daily Reports, Service Module, Shifts, Gamification

**Status:** Draft v0.1 · 2026-08-24
**Source:** Operator transcripts (requests_transcripts.txt + Master_TZ_Meta_CRM_Final_Corrected.html)
**Deadline:** September 1, 2026 (10 days)
**KPI:** Fully working automated financial + operational reporting from September 1

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

### 1.1 Per-bike rental breakdown in evening summary

**Wish:** Replace the single total sum with a list: `[Мотоцикл] — [Сумма ₽ / Спец. статус]`

| Aspect | Status |
|---|---|
| Show each rental as `bike_name — amount ₽` | ❌ Missing — summary only shows total count + sum |
| Show special conditions (free, contest prize, barter) | ❌ Missing — no special-status display |
| Show equipment revenue per rental | ❌ Missing — equipment cost is in `rentals.metadata.equipment` but not surfaced |

**Gap:** The `RENTALS_DATA` query selects `rental_id, status, total_cost, agreed_end_date, vehicle_id` but doesn't join `cars` for bike name. The summary builds `RENTAL_KPIS` via jq aggregation (count/sum) — no per-item list for the rentals section (only for the "active rentals" section at the bottom). Need to add a per-rental line listing with bike name + amount + special status flag.

**Implementation:** Add a jq loop in `evening-summary.sh` that maps `vehicle_id` → bike name (via a pre-fetched `cars` lookup) and formats each rental as `• {bike_name} — {amount} ₽ {special_note}`. Special notes: `0 ₽ [бесплатно]`, `[конкурс]`, `[бартер]` — derived from `metadata.price_overridden && total_cost === 0` or `metadata.free_rental_reason`.

### 1.2 Fix rental count logic (closures counted as new rentals)

**Wish:** Bot showed 6 rentals instead of 5. A previous-day Ducati closure was likely counted as today's rental.

| Aspect | Status |
|---|---|
| Count only rentals CREATED today | ⚠️ Partially — query uses `OR (and(created_at.gte.today, created_at.lte.today), and(agreed_start_date.lte.end, agreed_end_date.gte.start))` |
| The second OR clause catches overlapping multi-day rentals | ✅ Correct for active rentals spanning today |
| But: closing a previous-day rental updates `updated_at` not `created_at` | ✅ Should NOT be counted (query uses `created_at`, not `updated_at`) |
| Possible cause: the `agreed_start_date` / `agreed_end_date` overlap clause catches a rental that STARTED yesterday but ENDS today | ⚠️ This is actually correct (it's an active rental today) but may confuse the operator |

**Gap:** The count is likely correct — the issue may be that the operator sees "6" because a multi-day rental from yesterday is still active today and counted in the overlap clause. The fix is to LABEL the count: "Аренд сегодня: 5 новых + 1 переходящая = 6" instead of just "6".

### 1.3 Exclude deposits from revenue

**Wish:** Deposits (прием/возврат) should not appear in the daily revenue total.

| Aspect | Status |
|---|---|
| Deposits shown separately in "🏦 Депозиты" section | ✅ Already done — deposits have their own section with collected/returned/penalty |
| Deposits excluded from `TOTAL_REVENUE` calculation | ✅ Already correct — `TOTAL_REVENUE` sums only rentals + sales + services, not deposits |
| Deposits tracked via `deposit_entries` table | ✅ Already implemented |

**Gap:** ✅ **Already works.** No change needed. The operator may have been confused by the deposit section appearing in the report — but it's separate from revenue.

### 1.4 Equipment revenue in evening summary

**Wish:** Equipment (helmets, gloves) attached to rental contracts should show in the report with specific item names and amounts.

| Aspect | Status |
|---|---|
| Equipment stored in `rentals.metadata.equipment` (helmets, gloves, jacket, etc.) | ✅ Already stored |
| Evening summary shows equipment revenue | ❌ Missing — not in the summary at all |
| Equipment shown with item names ("Перчатки — 500 ₽", "Шлем — 1 000 ₽") | ❌ Missing |
| Equipment shown as a separate section or per-rental line | ❌ Missing |

**Gap:** The summary query doesn't read `metadata.equipment`. Need to add a jq extraction that pulls equipment from each rental's metadata, calculates the cost (helmet: 500₽ hourly / 1000₽ daily; others: 500₽ flat), and shows a summary line: `🛡️ Экипировка: 2 шлема — 2 000 ₽, Перчатки — 500 ₽, Итого: 2 500 ₽`.

### 1.5 Prepayments in evening summary

**Wish:** Show prepayments/booking fees as a separate section.

| Aspect | Status |
|---|---|
| Prepayment concept exists | ❌ Missing — no `prepayment` or `предоплата` type in the codebase |
| Prepayments shown in evening summary | ❌ Missing |

**Gap:** Need to decide: are prepayments a new `transaction_type` in `cash_transactions`, or a new status on `sale_contract_artifacts`? Simplest: add `income_prepayment` to `cash_transactions` and include it in the summary as a separate block.

### 1.6 Salary payments (ФОТ) in evening summary

**Wish:** Show salary payments with employee name: `[Сотрудник] — [Сумма]`.

| Aspect | Status |
|---|---|
| `cash_transactions` table has `expense_salary` type | ✅ Already exists |
| Evening summary shows salary payments | ❌ Missing — not in the summary |
| Salary payments linked to specific employees | ⚠️ Partially — `cash_transactions.description` may contain the name, but no structured `recipient_user_id` field |

**Gap:** Add a salary section to the evening summary that queries `cash_transactions WHERE transaction_type = 'expense_salary' AND created_at = today` and shows `• {description/recipient} — {amount} ₽`.

### 1.7 Household expenses (хозрасходы) in evening summary

**Wish:** Track household expenses (tea, coffee, tobacco, coal) with a monthly limit of 10,000₽.

| Aspect | Status |
|---|---|
| `cash_transactions` has `expense_other` type | ✅ Could be used for хозрасходы |
| Dedicated `expense_household` type | ❌ Missing |
| Monthly limit tracking (10,000₽/month, show remaining) | ❌ Missing |
| Evening summary shows household expenses | ❌ Missing |

**Gap:** Add `expense_household` transaction type. In the evening summary, show: `🛒 Хозрасходы: {amount} ₽ today (Лимит: 10 000 ₽/мес, остаток: {remaining} ₽)`.

---

## Section 2: Service Work Module

**Existing:**
- `skills/service-work-text/SKILL.md` — a text skill that logs service work via INSERT into `rentals` with `vehicle_id` pointing to a `cars` row with `type='service'`
- `cars` table has 3 service items: `vip-bike-svc-011`, `vip-bike-svc-012`, `vip-bike-svc-013` (etc.)
- Service work shows in the evening summary under "🔧 Сервис"
- No dedicated `/service` bot command — service work is logged via the `service-work-text` skill (curl-based INSERT)

### 2.1 Service work with 50/50 income split

**Wish:** Service work should automatically split income: 50% to mechanic's salary, 50% to company income.

| Aspect | Status |
|---|---|
| Service work logged via skill (INSERT into rentals) | ✅ Exists |
| 50/50 split calculation | ❌ Missing — no split logic |
| Mechanic identified on service work | ❌ Missing — no `mechanic_id` field |
| Auto-create `expense_salary` entry for mechanic's 50% | ❌ Missing |

**Gap:** When a service rental is created (via skill or future `/service` command), need to:
1. Add `metadata.mechanic_id` (who did the work)
2. Add `metadata.service_split` = `{ mechanic: 50%, company: 50% }` (configurable)
3. Auto-create a `cash_transactions` row with `transaction_type='expense_salary'`, `amount = total_cost * 0.5`, `description = "Сервис: {bike} — {service_type}"`

### 2.2 Multiple mechanics on one service job

**Wish:** Support multiple mechanics (e.g., Slava as primary + Vlad as assistant).

| Aspect | Status |
|---|---|
| Multiple mechanics per service work | ❌ Missing — only one `user_id` per rental |
| Split among multiple mechanics | ❌ Missing |

**Gap:** Store `metadata.mechanics = [{ user_id, role: "primary"|"assistant", split_percent }]` on the service rental. The 50/50 split becomes: company 50%, primary 30%, assistant 20% (configurable).

### 2.3 Bike status: "in service" / "in repair"

**Wish:** Ability to mark bikes as "in service" or "in repair" with damage description.

| Aspect | Status |
|---|---|
| `cars` table has a status field | ❌ No `status` column (checked earlier — query returned error) |
| Bike status: available / in_service / in_repair | ❌ Missing |
| Damage description on bike | ❌ Missing |

**Gap:** Add `status` column to `cars` table (or use `metadata.status`). Values: `available` (default), `in_service`, `in_repair`, `sold`. Add damage description to `metadata.damage_notes`. Show status in catalog + admin.

---

## Section 3: Shift Tracking Enhancements

**Existing:**
- `crew_member_shifts` table: `member_id`, `crew_id`, `clock_in_time`, `clock_out_time`, `duration_minutes` (generated), `shift_type`, `hourly_rate`, `salary_amount`
- `/shift` bot command — clock in/out
- `app/api/crew/shifts/route.ts` — API for clock in/out
- `app/api/crew/shifts/history/route.ts` — history
- `app/api/crew/shifts/stats/route.ts` — stats (duration, salary)
- Shift tracker text skill (`skills/shift-tracker-text/SKILL.md`)

### 3.1 Check-out (clock_out_time)

| Aspect | Status |
|---|---|
| `clock_out_time` column exists | ✅ Already exists |
| Clock-out API endpoint | ✅ Already exists (`app/api/crew/shifts/route.ts:47`) |
| Duration auto-calculated | ✅ `duration_minutes` is a generated column |
| Salary auto-calculated | ✅ `salary_amount` is set on clock-out |

**Gap:** ✅ **Already works.** No change needed.

### 3.2 Include Vlad in shift tracking

| Aspect | Status |
|---|---|
| Vlad's user_id in crew_members | ⚠️ Need to verify — Vlad is mentioned as an employee but may not be in the crew_members table |

**Gap:** Check if Vlad has a `crew_members` row. If not, add one. The shift tracking system already supports any crew member — no code change needed, just a data fix.

### 3.3 Hours per day/week/month + location tracking

| Aspect | Status |
|---|---|
| Hours per shift | ✅ `duration_minutes` (generated) |
| Hours per day/week/month aggregation | ✅ `app/api/crew/shifts/stats/route.ts` — queries by date range |
| Location/площадка tracking | ❌ Missing — no `location` field on shifts |

**Gap:** Add `location` column to `crew_member_shifts` (values: "VIP-BEL", "Байк 2 Дом", etc.). Set on clock-in via the `/shift` command (add a location selector keyboard).

---

## Section 4: Gamification / KPI / Achievements

**Existing:**
- `types/cyberFitness.ts` (191 lines) — developer-facing achievements (files extracted, tokens processed, PRs merged). NOT franchise-facing.
- `crew_members` table has roles
- `rentals` table has `created_by_operator_chat_id` — can track who created each rental
- No crew-member-level badges, leaderboards, or KPI counters exist

### 4.1 Crew KPI counters

**Wish:** Per-employee counters: rentals issued, equipment issued, bikes sold, clients attracted, content published.

| Aspect | Status |
|---|---|
| Count rentals by `created_by_operator_chat_id` | ✅ Data exists — can query |
| Count equipment issued (from rental metadata.equipment) | ✅ Data exists — can query |
| Count sales by operator | ⚠️ `sale_contract_artifacts` has `created_by_operator_chat_id` — can query |
| Count new clients attracted | ❌ No "attracted by" field on users/rentals |
| Count content published | ❌ No content tracking at all |

**Gap:** KPI counters can be computed from existing data (rentals + equipment + sales) via SQL aggregation. No new tables needed — just a query + display. "Clients attracted" and "content published" need new tracking fields (deferred — not for September 1).

### 4.2 Leaderboard

**Wish:** Weekly/monthly top employees by category.

| Aspect | Status |
|---|---|
| Leaderboard page exists | ✅ `app/leaderboard/` route exists (but it's the old dev-focused one) |
| Crew-member leaderboard (rentals, sales, hours) | ❌ Missing |

**Gap:** Build a new leaderboard query that aggregates by `created_by_operator_chat_id` + `crew_member_shifts.member_id`. Display as a table: `Employee | Rentals | Equipment | Sales | Hours | Score`. Can be a new boss-command script (`boss-commands/weekly-leaderboard.sh`) or a web page.

### 4.3 Achievement badges

**Wish:** "Король продаж", "Мастер выдачи", "Контент-мейкер", etc.

| Aspect | Status |
|---|---|
| Badge display in profile | ❌ Missing |
| Badge calculation logic | ❌ Missing |
| Badge definitions | ❌ Missing |

**Gap:** Define 5-7 badges as SQL queries (e.g., "Король продаж" = most sales this month). Display as emoji badges in the operator's profile. Store as `crew_members.metadata.badges = ["sales_king", "issuance_master"]`. Recompute weekly.

**Note:** Per our earlier PRD post-mortem (PRD_LIFECYCLE_MESSAGING.md), gamification for 4 crew members is low-ROI. But the operator specifically requested it, and these are simple SQL-aggregation badges (not an XP/points engine). Ship the counters + leaderboard first; badges are cosmetic.

---

## Section 5: Catalog & Localization

### 5.1 Full Russian translation

**Wish:** Complete Russian translation of bot interface.

| Aspect | Status |
|---|---|
| Bot commands already in Russian | ✅ All /doc, /testdrive, /ekip commands use Russian text |
| Web app already in Russian | ✅ Catalog, leads, admin — all Russian |
| Any remaining English? | ⚠️ Need to audit — some error messages, log strings, and API responses may be in English |

**Gap:** Minor — audit and translate any remaining English-facing strings. Not a feature, just a cleanup.

### 5.2 Price recalculation (×2.5)

**Wish:** Recalculate all catalog prices using formula: `new_price = base_price × 2.5`.

| Aspect | Status |
|---|---|
| Prices stored in `cars.daily_price` + `specs` tiers | ✅ Already |
| Bulk price update tool | ❌ Missing — would need a script |

**Gap:** Write a one-time script that multiplies all `daily_price` + tier fields by 2.5. Or: the operator can use the "Быстрая правка цен" admin page. Need to clarify what "base price" means — current `daily_price` or some other baseline?

### 5.3 Update contacts (remove WyeVolt, add Комсомольская площадь)

| Aspect | Status |
|---|---|
| Crew contacts stored in `crews.metadata.contacts` | ✅ Already |
| Current contacts mention "WyeVolt" / "Вайвольт"? | ⚠️ Need to check |
| Update to Комсомольская площадь + new phone | ❌ Need to update crew metadata |

**Gap:** Update `crews.metadata.contacts` via SQL. One-time data fix, not a code change.

### 5.4 Add "Motard" category

**Wish:** Add motard bikes to the catalog.

| Aspect | Status |
|---|---|
| `cars.type` supports "bike" | ✅ Already |
| No "motard" subtype | ⚠️ `specs.bike_subtype` could be used, or a new `specs.category = "motard"` |
| Catalog filter by subtype | ❌ Missing — current catalog filters by `type` (bike/equipment/service), not subtype |

**Gap:** Add motard bikes with `specs.bike_subtype = "motard"`. Add a catalog filter pill for "Мотарды". Or: just add them as regular bikes with "Motard" in the model name — the catalog already supports all bikes.

---

## Section 6: Personal Cabinet (Employee Dashboard)

**Wish:** A personal cabinet in the bot/web app that shows: earnings dashboard, achievements, quick actions (clock in/out, log service), smart reminders.

| Aspect | Status |
|---|---|
| Profile page exists | ✅ `app/profile/page.tsx` — shows CyberFitness achievements, not crew KPIs |
| Earnings dashboard (real-time salary) | ❌ Missing |
| Quick actions (1-click clock in/out, service log) | ⚠️ `/shift` command exists but not 1-click |
| Geofence reminder ("left location, close shift?") | ❌ Missing — requires geolocation API |
| Content publishing tracker | ❌ Missing |

**Gap:** This is a larger feature. For September 1, ship:
1. Extend profile page with crew KPI counters (rentals, equipment, sales, hours) — computed from existing data
2. Add a "quick actions" section (clock in/out button, link to service-work skill)
3. Defer geofence reminders + content tracker

---

## Section 7: Equipment Analytics (ROI / Payback)

**Wish:** Track equipment purchase cost, accumulated rental income, payback status.

| Aspect | Status |
|---|---|
| Equipment items in `cars` table (type='equipment') | ✅ 22 items exist |
| Purchase cost stored | ❌ Missing — `specs.purchase_price` not set |
| Rental income per equipment item | ❌ Missing — equipment revenue is embedded in rental metadata, not tracked per-item |
| Payback calculation | ❌ Missing |
| Non-liquid (no movement >30 days) detection | ❌ Missing |

**Gap:** This is a v2 feature. For September 1, skip. Defer to a separate PRD when the service module + daily report are stable.

---

## Implementation Priority (for September 1 deadline)

| Priority | Feature | Effort | Section |
|---|---|---|---|
| **P0** | Per-bike rental breakdown in evening summary | 1 iteration | §1.1 |
| **P0** | Equipment revenue in evening summary | 1 iteration | §1.4 |
| **P0** | Salary payments in evening summary | 1 iteration | §1.6 |
| **P0** | Household expenses tracking + limit | 1 iteration | §1.7 |
| **P1** | Service work 50/50 split | 1-2 iterations | §2.1 |
| **P1** | Rental count labeling (new vs carry-over) | 1 iteration | §1.2 |
| **P1** | Add Vlad to crew_members (data fix) | 5 min | §3.2 |
| **P1** | Shift location tracking | 1 iteration | §3.3 |
| **P2** | Prepayment tracking | 1 iteration | §1.5 |
| **P2** | Crew KPI counters in profile | 1-2 iterations | §4.1 + §6 |
| **P2** | Weekly leaderboard | 1 iteration | §4.2 |
| **P3** | Multiple mechanics on service job | 1 iteration | §2.2 |
| **P3** | Bike status (in_service/in_repair) | 1 iteration | §2.3 |
| **P3** | Achievement badges | 1 iteration | §4.3 |
| **Deferred** | Equipment ROI/payback | TBD | §7 |
| **Deferred** | Geofence reminders | TBD | §6 |
| **Deferred** | Content publishing tracker | TBD | §6 |
| **Data fix** | Price recalculation (×2.5) | Script | §5.2 |
| **Data fix** | Update contacts (Комсомольская) | SQL | §5.3 |
| **Data fix** | Add motard category | Catalog | §5.4 |
| **Cleanup** | Full Russian translation audit | Audit | §5.1 |

---

## What Already Works (no change needed)

- ✅ Deposits excluded from revenue (§1.3)
- ✅ Shift check-out exists (§3.1)
- ✅ Shift duration + salary auto-calculated (§3.1)
- ✅ Service work logging via skill (§2 — basic INSERT exists)
- ✅ `cash_transactions` table supports multiple transaction types
- ✅ All bot commands in Russian (§5.1 — mostly done)
- ✅ Crew contacts in metadata (§5.3 — just needs data update)

---

*This PRD is intentionally structured as a gap analysis, not an architecture document. Each item has a clear "what exists" vs "what's missing" comparison. Ship P0 items first, measure, then P1/P2.*
