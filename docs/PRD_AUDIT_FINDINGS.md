# PRD AUDIT FINDINGS — Cross-Reference with Production Code & Supabase

**Date:** 2026-08-09
**Audited by:** Super Z (AI) — direct Supabase queries + code reads
**Branch:** feature/prd-corrections-and-shifts-fix

---

## PRODUCTION DATABASE STATE (verified via direct Supabase REST API queries)

### Tables that EXIST in production:
| Table | Schema | Status |
|-------|--------|--------|
| `cars` | public | ✅ Has `type` column with values: `bike` (40), `wb_item` (78), `parts` (22), `service` (20), `car` (2), `accessory` (2), `gear` (2), `metal_stuff` (2), `sauna` (1), `weapon` (1), `consumable` (1), `rule` (1), `rule_master` (1) |
| `rentals` | public | ✅ Equipment NOT stored in metadata (only `source`, `daily_price`, `doc_sha256`, `created_by`) |
| `crew_members` | public | ✅ Columns: `id, crew_id, user_id, role, membership_status, live_status, joined_at, last_location` |
| `crew_member_shifts` | public | ✅ Columns: `id, member_id, crew_id, clock_in_time, clock_out_time, duration_minutes (generated), hourly_rate, salary_amount (generated), shift_type, notes, checkpoint (jsonb), actions (jsonb)` |
| `deposit_log` | public | ✅ Columns: `id, rental_id, action, amount, method, operator_chat_id, notes, created_at` — 14 rows in production, all `method='cash'` — NO card tracking |
| `franchize_intents` | public | ✅ Has `metadata jsonb` column |
| `crew_todos` | public | ✅ Has `lead_id`, `rental_id`, `description` (jsonb) |
| `lead_notes` | public | ✅ |
| `rental_reviews` | public | ✅ |
| `user_states` | public | ✅ Already used by doc-manual.ts for draft persistence (30-min TTL) |
| `user_rental_secrets` | private | ✅ |
| `rental_contract_artifacts` | private | ✅ |
| `sale_contract_artifacts` | private | ✅ |

### Tables that DO NOT EXIST in production (migration files exist but were never applied):
| Table | Migration File | Status |
|-------|---------------|--------|
| `rental_handoffs` | `20260623000003_rental_handoffs.sql` | ❌ DOES NOT EXIST — migration never applied |
| `subrent_contract_artifacts` | `20260624000000_create_subrent_contract_artifacts.sql` | ❌ DOES NOT EXIST |
| `testdrive_contract_artifacts` | `20260809000000_create_testdrive_contract_artifacts.sql` | ❌ DOES NOT EXIST (we created migration, user hasn't applied yet) |
| `commercial_proposal_artifacts` | `20260617000001_create_commercial_proposal_artifacts.sql` | ❌ DOES NOT EXIST |

### Proposed tables that don't exist yet (no migration):
| Table | PRD Section |
|-------|-------------|
| `service_operations` | Service Ops PRD §2.2 |
| `equipment_rentals` | Service Ops PRD §2.3 |
| `cash_transactions` | Service Ops PRD §2.4 |
| `commission_rates` | Service Ops PRD §2.5 |
| `salary_plans` | Service Ops PRD §2.6 |
| `salary_calculations` | Service Ops PRD §2.7 |
| `document_drafts` | Service Ops PRD §2.8 / Doc Manual PRD §2.1 |

---

## KEY FINDINGS

### 1. `rental_handoffs` DOES NOT EXIST
The previous agent was WRONG. The migration file `20260623000003_rental_handoffs.sql` exists in the repo, but was **never applied** to production. Direct query:
```
GET /rest/v1/rental_handoffs?select=id&limit=1
→ {"code":"42P01","message":"relation \"public.rental_handoffs\" does not exist"}
```
**Impact on PRD:** The `equipment_rentals` table IS needed — there's no existing handoff/equipment tracking table.

### 2. Equipment is NOT stored in rentals DB
`doc-manual.ts` collects equipment (helmets, gloves, jacket, boots, net, backpack, bag, charger) in `DocFlowContext` and passes it to `buildRentalContractVariables` for the DOCX template. But the `rentals.insert()` at line 1200-1224 does NOT include equipment in `metadata` — only `source`, `daily_price`, `doc_sha256`, `created_by`.

**Impact:** Equipment data is lost after contract generation. The PRD's `equipment_rentals` table would fill this gap.

### 3. Equipment CAN be stored as `cars` items
Production already has `cars.type = 'accessory'` (2 items: Арома Маслы, Шапка для Сауны) and `cars.type = 'gear'` (2 items: Dye i5 Thermal Mask, Wartech Plate Carrier). The `cars` table supports any type — equipment items (helmets, jackets, etc.) could be stored as `cars` rows with `type='equipment'` and rented separately via `equipment_rentals`.

**Recommendation:** 
- Add `type='equipment'` cars rows for helmets, jackets, gloves, boots, etc.
- `equipment_rentals` table links to `cars.id` (reusing existing FK pattern)
- Keep the current `DocFlowContext` equipment booleans for the "preset equipment with bike rental" flow
- Add `equipment_rentals` for standalone equipment rental (not tied to a bike rental)

### 4. `user_states` already serves as draft persistence
`doc-manual.ts` uses `setState(userId, state, context)` / `getState(userId)` which upserts to `user_states` with 30-min TTL. The PRD's `document_drafts` table would duplicate this.

**Recommendation:** Either:
- **Option A:** Extend `user_states` with `crew_slug`, `doc_type`, `current_step`, `total_steps`, `corrected_steps` columns
- **Option B:** Create `document_drafts` as a specialized table and migrate `/doc` flow to use it

Option A is simpler. Option B is cleaner if other flows (testdrive, subrent) will also need draft persistence.

### 5. `deposit_log` is the closest thing to a cash ledger
Production has `deposit_log` with `action` (collected/returned), `amount`, `method` (cash/bank_transfer/telegram_stars/none), `operator_chat_id`, `rental_id`. This is a narrow ledger — only tracks deposits.

**Recommendation:** The `cash_transactions` table should be a superset of `deposit_log`. Consider:
- Keep `deposit_log` as-is (don't break existing code)
- `cash_transactions` is the unified ledger that includes deposits, rental income, sale income, service income, equipment income, commissions, salaries

### 6. `crew_member_shifts` already calculates salary
The table has `hourly_rate`, `salary_amount` (auto-calculated by trigger `trg_calc_shift_salary`), `duration_minutes` (generated), `shift_type`, `notes`, `checkpoint` (jsonb), `actions` (jsonb). The `/shift` bot command and `/api/crew/shifts` API already exist.

**Impact on PRD:** The `salary_plans` and `salary_calculations` tables should integrate with existing shifts, not duplicate them. Salary = sum of `crew_member_shifts.salary_amount` for the period + commissions from `cash_transactions`.

### 7. Profile page shows rental history but NOT salary/earnings
`ProfileClient.tsx` (945 lines) shows:
- Activity digest (rentals, buy orders)
- Rental secrets (passport, license, birth date, categories)
- Last rental date
- NO salary, commission, or earnings display

**Impact:** The PRD should add a "My Earnings" section to the profile page that shows shift income + commissions for the logged-in crew member.

### 8. `auth.jwt() ->> 'chat_id'` returns NULL with service_role
All server actions use `supabaseAdmin` (service_role key). With service_role, `auth.jwt()` is NULL. Any trigger or RLS policy using `auth.jwt() ->> 'chat_id'` for `created_by` will fail.

**Fix:** Use `SECURITY DEFINER` functions + `COALESCE(auth.jwt() ->> 'chat_id', NEW.created_by_operator_chat_id, NEW.owner_id, 'system')` or pass the actor explicitly.

### 9. RLS `auth.uid()` returns UUID, but `users.user_id` is TEXT
The codebase convention is `auth.jwt() ->> 'chat_id'` (returns TEXT), NOT `auth.uid()` (returns UUID). All RLS policies in the PRD that use `auth.uid()` will never match.

---

## REUSABLE INFRASTRUCTURE

### Already exists and should be reused:
1. **`user_states` table** — draft persistence (30-min TTL) — extend, don't duplicate
2. **`deposit_log` table** — narrow cash ledger — keep, add `cash_transactions` as superset
3. **`crew_member_shifts` + `trg_calc_shift_salary`** — shift tracking + salary calc — integrate, don't replace
4. **`/shift` bot command** + **`/api/crew/shifts`** API — shift start/end — already working
5. **`cars` table** — supports any `type` — add `type='equipment'` for rentable equipment
6. **`rentals` table** — service operations use `vehicle_id IN (cars.type='service')` — don't create separate `service_operations` table, extend this pattern
7. **`DocFlowContext.equipment`** — already collects helmets/gloves/jacket/etc — store in `equipment_rentals` or `rentals.metadata.equipment`
8. **`buildRentalContractVariables`** — already handles equipment in DOCX — no change needed
9. **`crew_members` table** — has `role` (owner/co_owner/admin/mechanic/member) — use for commission tiers
10. **`franchize_intents` table** — has `metadata jsonb` — store `docSha256` here for QR claim (already done for testdrive)

### Should be created new:
1. **`equipment_rentals`** — standalone equipment rental tracking (not tied to bike rental)
2. **`cash_transactions`** — unified ledger (income + expense + commissions + salaries)
3. **`commission_rates`** — configurable commission percentages per crew + operation type
4. **`salary_plans`** — payout schedule (10th/25th) + period tracking
5. **`salary_calculations`** — per-period salary breakdown (shifts + commissions + bonuses)

### Should NOT be created:
1. **`service_operations`** — services already work as `rentals` with `vehicle_id IN (cars.type='service')`. Creating a separate table would split the data model. Instead, extend `rentals.metadata` with service-specific fields if needed.
2. **`document_drafts`** — `user_states` already does this. Extend `user_states` instead.
3. **`rental_handoffs`** — migration exists but never applied. If we need handoff tracking, apply the existing migration OR fold it into `equipment_rentals`.

---

## RECOMMENDATIONS FOR PRD POLISH

### FRANCHIZE_SERVICE_OPERATIONS_PRD.md:
1. Remove false claim about `rental_handoffs` existing — it DOES NOT exist
2. Remove `service_operations` table — use existing `rentals` + `cars.type='service'` pattern
3. Replace `document_drafts` with "extend `user_states`" 
4. Fix all `auth.uid()` → `auth.jwt() ->> 'chat_id'`
5. Fix all trigger `created_by` to use `COALESCE(auth.jwt() ->> 'chat_id', NEW.created_by_operator_chat_id, 'system')`
6. Add `cars.type='equipment'` for rentable equipment items
7. Integrate with existing `crew_member_shifts` + `deposit_log`
8. Add "My Earnings" section to profile page
9. Add authentication spec for all API endpoints (reuse `verifyCrewAccess` pattern)
10. Add `equipment_rentals` for standalone equipment rental (separate from bike rental equipment preset)

### DOC_MANUAL_STEP_CORRECTION_PRD.md:
1. Fix all state names to actual bare strings (`bike`, `deal`, `name`, `passport`, etc.)
2. Fix all field names to actual camelCase (`mpFullName`, `mpSeries`, `saleVin`, etc.)
3. Fix `sendComplexMessage` to positional form `(chatId, text, buttons, options)`
4. Replace `updateDocState` with `setState`
5. Acknowledge `user_states` already persists state — extend, don't duplicate
6. Acknowledge `buildRentSummary`/`buildSaleSummary` already show verification data — enhance, don't create
7. Fix step counts: rent ≈14 steps, sale = 8 steps
8. Fix VIN fallback to blank (not "уточняется") — already fixed in code
9. Add `client_phone` to sale flow step numbering
10. Add delivery method step as genuinely new (step 9 for sale)
