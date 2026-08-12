# PLAN-I5B-UI-COMPLETION.md

> **Date:** 2026-08-12  
> **Scope:** Complete I5 placeholders — Cash API + UI, Commission/Salary UI + API  
> **Branch:** Continue on `feat/i5-service-operations` (or create `feat/i5b-ui-completion`)  
> **Status:** Ready to start

---

## What Was Placeholder/Skipped in I5

| Task | Plan | Status | What's Missing |
|------|------|--------|-----------------|
| **Cash T5** | `2026-08-12-i5-cash-ledger.md` Task 5 | ⚠️ Skipped | API routes: `/cash-transactions`, `/dashboard/daily-report` |
| **Cash T6** | `2026-08-12-i5-cash-ledger.md` Task 6 | ⚠️ Placeholder | `/cash-ledger` page with daily summary + transaction table |
| **Salary T4** | `2026-08-12-i5-commissions-salary.md` Task 4 | ⚠️ Placeholder | `/admin/commissions` page (rate config table + form) |
| **Salary T5** | `2026-08-12-i5-commissions-salary.md` Task 5 | ⚠️ Placeholder | `/admin/salary` page + profile "My Earnings"/"My Work" |
| **Salary T6** | `2026-08-12-i5-commissions-salary.md` Task 6 | ⚠️ Placeholder | `/api/franchize/[slug]/salary/[memberId]/route.ts` |

**Backend:** All server actions DONE (`cash-transactions.ts`, `commissions.ts`, `salary-calculations.ts`)  
**Frontend:** Needs UI pages + thin API routes

---

## Wave Structure (I5b — 2 staged rounds)

### Round 1: Cash Ledger + Commission UI
- Cash T5: API routes (thin, call actions)
- Cash T6: Cash ledger page (daily summary + table)
- Salary T4: Commission config UI (owner only)

### Round 2: Salary + Profile
- Salary T5: Salary admin page + profile sections
- Salary T6: Salary API route
- Documentation + Gate

---

## Тимейты

| Name | Model | Files owned |
|------|-------|-------------|
| `api` | sonnet | `app/api/franchize/[slug]/**` (all routes) |
| `frontend` | sonnet | All UI pages + components |
| `verifier` | opus | E2E verification after each round |

**Ownership rules:**
- API routes are thin → parse params, call action, return `NextResponse.json`
- UI components use existing actions (no new backend logic)
- Tests: `i5-api.spec.ts` (API), `i5-ui.spec.ts` (UI components)

---

## Contract (Fixed Before Start)

**ARCHITECTURE FIX:** All pages are **crew-specific** under `/app/franchize/[slug]/`, NOT global `/app/admin/`. Each crew manages their own:
- Cash ledger → `vip-bike.ru/cash-ledger` (crew-specific transactions)
- Commission rates → `vip-bike.ru/commissions` (crew-specific rates)
- Salary plans → `vip-bike.ru/salary` (crew-specific payouts)

1. **API pattern:** All routes follow existing franchize pattern:
   ```typescript
   // GET /api/franchize/[slug]/cash-transactions?actorUserId=...&from=...&to=...
   export async function GET(req: NextRequest) {
     const { searchParams } = new URL(req.url);
     const actorUserId = searchParams.get('actorUserId') || '';
     const result = await getCashTransactions({ slug, actorUserId, ... });
     return NextResponse.json(result);
   }
   ```

2. **Auth:** Pass `actorUserId` from query/body (server-side verify inside actions via `verifyCrewAccess`)

3. **UI theme:** Use `useCrewTokens` pattern from existing franchize pages

4. **Dates:** All dates in `Europe/Moscow` timezone (PRD §6.2.2 pattern)

5. **Owner-only UI:** Hide forms for non-owners (API already closed by action-layer auth)

---

## Этап 1 — Cash Ledger + Commission UI

### API Layer (backend-integration → `api` teammate)

**Task 1a: Cash API routes**
- Create: `app/api/franchize/[slug]/cash-transactions/route.ts`
  - GET: list transactions with filters (from, to, type)
  - POST: create manual transaction
- Create: `app/api/franchize/[slug]/dashboard/daily-report/route.ts`
  - GET: daily summary for date
- Test: `tests/franchize/i5-api.spec.ts` (cash section)

**Task 1b: Salary API route**
- Create: `app/api/franchize/[slug]/salary/[memberId]/route.ts`
  - GET: salary calculation for period
- Test: `tests/franchize/i5-api.spec.ts` (salary section)

### Frontend (frontend teammate)

**Task 2: Cash ledger page**
- Create: `app/franchize/[slug]/cash-ledger/page.tsx`
- Create: `CashLedgerClient.tsx`
- Features:
  - Daily summary cards (in/out/net)
  - Transaction table (date, type, category, amount, method)
  - Date filter (from/to picker)
  - Type filter dropdown
  - Manual entry form (owner only)
  - amount>0 validation
- Test: `tests/franchize/i5-ui.spec.ts` (cash-ledger section)

**Task 3: Commission config page**
- Create: `app/franchize/[slug]/commissions/page.tsx` ← CREW-SPECIFIC, not /admin
- Create: `app/franchize/[slug]/commissions/CommissionsClient.tsx`
- Features:
  - Rate table (operation, type, value, priority, active)
  - Upsert form (operation select, %/fixed toggle, value input)
  - Validation: percentage ≤ 100 (inline error, block submit)
  - Deactivate button (with confirm)
- Test: `tests/franchize/i5-ui.spec.ts` (commissions section)

**Sync Point:** Round 1 done → `npm test` → proceed to Round 2

---

## Этап 2 — Salary + Profile

### Frontend (frontend teammate)

**Task 4: Salary page**
- Create: `app/franchize/[slug]/salary/page.tsx` ← CREW-SPECIFIC, not /admin
- Create: `app/franchize/[slug]/salary/SalaryClient.tsx`
- Features:
  - Plan table (member, period, accrued, balance, status)
  - Calculation breakdown (shifts, commissions, bonuses)
  - "Выплатить" button → calls `recordPayout` → disables after success
  - Period filter (from/to)
- Test: `tests/franchize/i5-ui.spec.ts` (salary section)

**Task 5: Profile sections**
- Modify: `app/franchize/[slug]/profile/ProfileClient.tsx`
- Add "My Earnings" section:
  - Current plan: accrued, balance, next payout date
  - Recent commissions list
- Add "My Work" section:
  - Rentals/sales/service for today (Europe/Moscow)
  - Group by operation type with counts
- Create: `app/franchize/server-actions/my-work.ts`
  - `getMyWorkTodayAction({ userId, slug })` → SQL pattern PRD §6.2.2
- Test: `tests/franchize/salary-calculations.spec.ts` (my-work cases)

---

## Gate (Этап 3 — Verification)

**Verifier (opus) E2E checklist:**
- [ ] Cash API: GET returns transactions + summary; POST with amount≤0 → 400
- [ ] Cash UI: daily summary shows in/out/net; manual entry works for owner
- [ ] Commission UI: upsert with percentage=150 → inline error; deactivate works
- [ ] Salary UI: payout button calls API → success → balance_due=0
- [ ] Profile: "My Earnings" shows accrued/next payout; "My Work" groups today's work
- [ ] `npm test` green (including new API/UI tests)
- [ ] `npm run lint:target` clean
- [ `typecheck:franchize` clean (if possible)

**Code-review:** Full diff review (frontend + API)

**Deploy:**
- Push to remote
- Create PR with title: `feat(i5b): complete UI + API for cash ledger, commissions, salary`
- Merge after verification

---

## Definition of Done

- [ ] All 5 tasks above closed with passing tests
- [ ] API routes thin → call actions → return JSON
- [ ] UI pages follow `useCrewTokens` theme pattern
- [ ] Owner-only forms hidden for non-owners
- [ ] Profile sections render without errors
- [ ] `npm test` green (440+ tests)
- [ ] Branch merged to `main` and pushed
- [ ] `START-HERE.md` updated (I5b marked as shipped)

---

## Effort

**Medium** — Frontend-heavy wave (5 pages, 3 API routes), backend logic already done. UI patterns reuse existing franchize components.

---

## Open Questions

1. **Cash ledger date filter:** Should default to current month? (Yes — reasonable default)
2. **Salary page period filter:** Should show current period by default? (Yes)
3. **Profile "My Work" timezone:** Use `Europe/Moscow` for date grouping (PRD §6.2.2) — verified in existing dashboard queries

---

## Commit Pattern

```
feat(i5b): cash ledger API routes
feat(i5b): salary API route
feat(i5b): cash ledger page (crew-specific)
feat(i5b): commission config UI (crew-specific)
feat(i5b): salary page (crew-specific)
feat(i5b): profile My Earnings + My Work sections
feat(i5b): my-work server action
docs(i5b): update START-HERE.md — I5b shipped
```
