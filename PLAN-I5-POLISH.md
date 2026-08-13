# PLAN-I5-POLISH.md

> **Date:** 2026-08-13  
> **Scope:** Continue I5 polish, fix remaining issues, prepare for next wave  
> **Status:** Ready to start

---

## I5 Wave Status

**✅ Shipped:**
- Equipment rentals (backend + UI)
- Cash ledger (backend + UI + API)
- Commissions (backend + UI + API)
- Salary (backend + UI + API)
- Profile sections (My Earnings + My Work)

**✅ Fixed:**
- Critical bugs (route params, double state updates, array mutation)
- Security issues (auth bypass, RLS policy)
- Circular dependency (cash_transactions FK)
- Navigation integration (I5 pages in menu)

**🔄 Remaining Polish:**
- Medium priority issues from code review
- Equipment page (mock implementation)
- Remaining test coverage

---

## Remaining Issues (From Code Review)

### Medium Priority

1. **Incomplete auth in salary-calculations** (`salary-calculations.ts:76-79`)
   - Issue: Error message says "only owner" but members should read own plans
   - Fix: Separate read vs write access or clarify permission model

2. **Cash transaction amount validation** (`cash-transactions.ts:119`)
   - Issue: Silently converts negative to zero instead of rejecting
   - Fix: Add explicit rejection or warning log

### Low Priority

3. **Redundant query in salary-calculations** (`salary-calculations.ts:254-261`)
   - Issue: Separate queries could be JOINed
   - Fix: Use single query with JOIN

4. **Hardcoded fallback theme** (`salary/SalaryClient.tsx:67-119`)
   - Issue: 50+ lines of hardcoded theme
   - Fix: Extract to shared constant

5. **Mock equipment page** (`equipment/EquipmentClient.tsx:51-73`)
   - Issue: Functions are mocked, page non-functional
   - Fix: Wire up to real server actions or implement

---

## Next Wave Options

### Option A: I5 Complete (1-2 hours)
- Fix remaining 5 issues
- Implement equipment page properly
- Add missing tests
- **Outcome:** I5 wave 100% production-ready

### Option B: New Feature Wave
- Continue to next feature set
- Leave I5 at 90% (works but minor polish deferred)
- **Outcome:** Faster feature velocity

### Option C: Leads Quality R4 (1 hour)
- Complete leads upgrade (CSV export done, more polish)
- **Outcome:** Leads quality 8/10

---

## Recommendation

**Start Option A (I5 Complete)** — 30-45 minutes:
1. Fix equipment page mock → real server actions
2. Fix amount validation → explicit rejection
3. Extract hardcoded theme
4. Add missing test coverage

**Then Option C (Leads R4)** — 30 minutes:
1. Complete leads quality polish
2. Finalize leads upgrade

**Then discuss next wave** — based on client priorities

---

Say `go i5-polish` to start Option A, or `go leads-r4` for Option C, or tell me your preference!
