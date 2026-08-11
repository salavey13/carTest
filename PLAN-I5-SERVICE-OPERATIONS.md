# План волны — I5: Franchize Service Operations (cash ledger + equipment rentals + commissions + salary)

> **Date:** 2026-08-11 · Scope:** FRANCHIZE_SERVICE_OPERATIONS_PRD v4.1
> **Status:** Ready for Implementation
> **Estimated:** 2 weeks per PRD, following sfera-tender-bot high-velocity patterns

---

## Этап 0 — фиксация (before starting)

1. ✅ **Code review complete** — `CODEREVIEW_LEADS_RENTALS.md` reviewed
2. ✅ **START-HERE.md created** — project documentation structure established
3. ⏳ **Fix accessories duplication** — Delete synthetic generation from `rentals.ts:697-743`
4. ⏳ **Add todos to rentals page** — Enhance `getFranchizeCrewRentalsListAction()` to return todos
5. ⏳ **Read META_PRD** — Understand I1-I4 context and quality gates
6. ⏳ **Read FRANCHIZE_SERVICE_OPERATIONS_PRD.md** — Full requirements

**Git branch:** `feat/i5-service-operations` — everything goes here, merge to `main` after acceptance

---

## Тимейты волны

| Name | Base (.agents/) | Model | What does | Owns (one writer) |
|------|-----------------|-------|-----------|-------------------|
| `backend-core` | backend-dev | sonnet | Cash transactions table + RLS + triggers, equipment_rentals table + RLS, commission_rates table + seed, salary_plans table + payout logic | `supabase/migrations/`, `app/franchize/server-actions/cash-transactions.ts`, `app/franchize/server-actions/equipment-rentals.ts`, `app/franchize/server-actions/commissions.ts` |
| `backend-integration` | backend-dev | sonnet | Salary calculations + payout triggers, API endpoints, doc-manual integration (equipment tracking), rental closure integration | `app/franchize/server-actions/salary-calculations.ts`, `app/api/franchize/*`, `app/webhook-handlers/commands/doc-manual.ts` |
| `frontend` | frontend-dev | sonnet | Equipment rental UI, cash ledger UI, commission config UI, salary payout UI | `app/franchize/[slug]/equipment/*`, `app/franchize/[slug]/cash-ledger/*`, `app/franchize/[slug]/admin/commissions/*`, `app/franchize/[slug]/admin/salary/*` |
| `verifier` | verifier | opus | End-to-end verification after each phase | Tests all phases |

**Base roles** (`verifier`, `code-reviewer`, `security`, `test-runner`) — sub-agents, not team members.

⛔ **Tests each write only in their ownership directories** — don't touch files outside your scope.

---

## Контракт между слоями (fixed before start)

1. **Cash Ledger API** — `GET /api/franchize/cash-ledger` returns `CashTransactionRow[]` with filters (date range, transaction_type, crew_id). POST/UPDATE restricted to crew owners/admins.
2. **Equipment Rental API** — `POST /api/franchize/equipment-rentals` creates rental with `equipment_id→cars(id)`, returns equipment_rental row. Validation: `equipment_id` must have `cars.type='equipment'`.
3. **Commission Config UI** — PATCH `/api/franchize/commissions/{crew_id}` updates `commission_rates` table. Frontend validates percentage ≤100.
4. **Salary Payout** — `/api/franchize/salary-payout` triggers calculation for given period, returns `SalaryCalculation` row with breakdown. Only callable by crew owners.
5. **Migrations** — backend-core writes migrations in order, backend-integration chains via `down_revision`. No two heads in alembic.

**Contract changes** — only via peer-exchange with recorded agreement. Don't agree → escalate.

---

## Этапы

### Этап 1 (параллельно): Database core + Equipment rentals
**backend-core** — Tasks 1-4:
- Cash transactions table + RLS + triggers
- Equipment rentals table + RLS  
- Commission rates table + seed
- Equipment rental server actions

**frontend** — Equipment rental UI:
- Equipment catalog page
- Rental creation form
- Active rentals list

**Этап 2 (параллельно): Integration + Commission config
**backend-integration** — Tasks 5-7:
- Salary plans table + payout logic
- Salary calculations server actions
- Doc-manual integration (track equipment in rentals)
- API endpoints

**frontend** — Commission config UI:
- Commission rates editor
- Per-crew, per-operation-type config
- Validation UI

### Этап 3 (интеграция): Cash ledger + Salary payout
**backend-integration** — Cash ledger APIs + Salary payout triggers
**frontend** — Cash ledger UI + Salary payout UI
**verifier** — E2E: create equipment rental → close → verify cash entry; configure commission → create sale → verify commission; run salary payout → verify calculation

### Этап 4 (гейт → production): Smoke + Deploy
- All tests green: `npm test`, `npm run test:e2e`
- `code-reviewer` PASS on diff
- `security` review on new endpoints
- Migration verification on staging
- Production rollout

---

## Definition of Done волны

- [ ] All tasks from FRANCHIZE_SERVICE_OPERATIONS_PRD v4.1 complete
- [ ] All migrations applied in order (verify via `supabase migrations list`)
- [ ] `npm test` green (all existing + new tests)
- [ ] `npm run test:e2e` green (including new E2E scenarios)
- [ ] `verifier` PASS with full test output
- [ ] `code-reviewer` PASS on diff
- [ ] Production smoke test: equipment rental → close → cash entry visible
- [ ] Production smoke test: commission config → sale → commission calculated
- [ ] Production smoke test: salary payout → correct calculation
- [ ] `README.MD`, `META_PRD`, `FRANCHIZE_SERVICE_OPERATIONS_PRD.md` updated
- [ ] Branch merged to `main` and pushed

---

## Open Questions (non-blocking)

1. **Equipment catalog seed** — Which equipment items to create? (helmets sizes, jackets, etc.)
2. **Commission defaults** — What are default commission rates per operation type?
3. **Salary payout schedule** — Confirm 10th/25th monthly payout cycle
4. **Cash ledger retention** — How long to keep cash transaction records?

---

## Effort

Set **high** on entire wave: financial data requires correctness, idempotency guards, proper RLS. Sub-agents don't inherit effort — depth set by model (all sonnet, `architect`/`critic` for disputes).

---

## Rules from sfera-tender-bot (apply here)

1. **Triggers with idempotency** — Every `AFTER UPDATE OF status` trigger needs `NOT EXISTS` guard
2. **Migrations are additive** — `IF NOT EXISTS` / `IF EXISTS`, `on conflict do nothing`
3. **Mock providers refuse** — Don't pretend success when mocking payment/LLM
4. **Rate limits don't depend on Redis** — Fall back to in-memory counter
5. **Ручка отключённая в интерфейсе остаётся открытой в API** — If disabling, close the endpoint too
6. **Даты из БД сравнивать только через `_as_utc`** — Postgres aware vs SQLite naive

---

## Files Created This Session

- `CODEREVIEW_LEADS_RENTALS.md` — Full code review (accessories duplication issue)
- `START-HERE.md` — Project documentation structure
- `PLAN-I5-SERVICE-OPERATIONS.md` — This file

---

## Next Actions

1. Fix accessories duplication (delete from `rentals.ts:697-743`)
2. Add todos to rentals page (enhance `profile-actions.ts`)
3. Review FRANCHIZE_SERVICE_OPERATIONS_PRD.md thoroughly
4. Create `feat/i5-service-operations` branch
5. Begin Этап 1 with backend-core team

---

**Lesson from sfera-tender-bot:** High velocity comes from:
- Clear atomic commits
- Parallelizable workstreams
- Strong contracts between layers
- Comprehensive testing per phase
- Fast iteration cycles (commits within minutes of each other)

**Commit pattern from sfera-tender-bot:**
```
feat(cash-transactions): table + RLS + triggers
feat(equipment-rentals): table + RLS
feat(commissions): table + seed data
feat(cash-ledger): API endpoints
feat(salary): payout logic
integration: doc-manual equipment tracking
fix: idempotency guard on salary trigger
test: E2E equipment rental flow
```

**This is the standard to match for I5.**
