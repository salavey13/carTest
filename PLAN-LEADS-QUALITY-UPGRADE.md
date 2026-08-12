# PLAN-LEADS-QUALITY-UPGRADE.md

> **Date:** 2026-08-12  
> **Scope:** Upgrade leads page to best practices level  
> **Branch:** `feat/leads-quality-upgrade` (new branch from `main`)  
> **Status:** Ready to start

---

## Current State Assessment

**Code Quality:** 6/10
- ✅ Good security (password gate)
- ✅ Well-structured hook architecture
- ❌ Poor type safety (extensive `any` usage)
- ❌ Performance issues (large components, missing memoization)
- ❌ Limited testing coverage
- ❌ Inconsistent code patterns

**File Structure:**
- 5 core files (~1,530 lines)
- 29 components (~6,166 lines)
- 11 hooks (~1,400 lines)
- **Total: ~9,000 lines**

---

## Critical Issues (Must Fix)

| Issue | File | Severity | Impact |
|-------|------|----------|--------|
| Todo toggle race condition | `useLeadActions.ts:167` | 🔴 Critical | Data corruption |
| Auth source reset bug | `LeadsClient.tsx:345` | 🔴 Critical | Leads not loading |
| Type safety (`any` usage) | `DealsPanel.tsx:15-18` | 🔴 High | Runtime errors |
| Component size (949 lines) | `LeadDetailDrawer.tsx` | 🟡 Medium | Maintainability |
| Missing memoization | `LeadList.tsx:107` | 🟡 Medium | Performance |
| Duplicate constants | Multiple files | 🟢 Low | Consistency |

---

## Wave Structure (4 Staged Rounds)

### Round 1: Critical Bug Fixes
**Goal:** Fix data corruption and loading issues

**Tasks:**
1. Fix todo toggle race condition in `useLeadActions.ts:167`
2. Fix auth source reset detection in `LeadsClient.tsx:345`
3. Add missing todo cleanup in `LeadsClient.tsx:258`
4. Add error boundaries for component failures

**Timemates:** 1 bug fix agent (sonnet)
**Duration:** ~30 min

---

### Round 2: Type Safety Overhaul
**Goal:** Replace all `any` types with proper interfaces

**Tasks:**
1. Create comprehensive TypeScript interfaces in `leads-types.ts`
2. Replace `any` types in `DealsPanel.tsx`
3. Replace `any` types in `LeadCard.tsx`
4. Add type guards for runtime safety
5. Enable strict null checks

**Timemates:** 1 type safety agent (sonnet)
**Duration:** ~1 hour

---

### Round 3: Performance & Component Split
**Goal:** Break down monolithic components, add memoization

**Tasks:**
1. Split `LeadDetailDrawer.tsx` (949 lines) into sub-components:
   - `LeadDetailHeader.tsx`
   - `LeadDetailNotes.tsx`
   - `LeadDetailTodos.tsx`
   - `LeadDealInfo.tsx`
2. Extract modal logic from `DealsPanel.tsx`
3. Add memoization to signal calculations in `LeadList.tsx`
4. Optimize filter pipeline in `useLeadFilters.ts`
5. Add React.memo to heavy components

**Timemates:** 1 performance agent (sonnet)
**Duration:** ~2 hours

---

### Round 4: Code Quality & Features
**Goal:** Complete missing features, standardize patterns

**Tasks:**
1. Implement CSV export functionality (currently disabled)
2. Deduplicate constants across files
3. Add skeleton screens for loading states
4. Improve mobile responsive design
5. Add unit tests for utility functions
6. Add JSDoc documentation

**Timemates:** 1 quality agent (sonnet)
**Duration:** ~1.5 hours

---

## Gate (Verification)

**Verifier (opus) checklist:**
- [ ] All critical bugs fixed (todo toggle, auth reset)
- [ ] No `any` types remain in components
- [ ] All components under 300 lines
- [ ] Signal calculations memoized
- [ ] CSV export functional
- [ ] Unit tests passing
- [ ] `npm run lint:target` clean
- [ ] `npm test` green
- [ ] Mobile experience smooth

**Code review:** Full diff review after each round

---

## Definition of Done

- [ ] All 4 rounds completed
- [ ] Critical bugs resolved
- [ ] Type safety score 9/10
- [ ] Performance score 8/10 (no lag on filter)
- [ ] Code quality score 8/10
- [ ] Test coverage added for utilities
- [ ] Branch merged to `main`
- [ ] `START-HERE.md` updated

---

## Estimated Effort

**Total:** ~5 hours across 4 rounds
- Round 1: 0.5 hours (critical bugs)
- Round 2: 1 hour (type safety)
- Round 3: 2 hours (performance)
- Round 4: 1.5 hours (quality)

---

## Open Questions

1. **State management:** Should we introduce Zustand/Redux for complex state? (Current: local useState)
2. **Testing framework:** Vitest for unit, Playwright for E2E? (Already configured)
3. **CSV export format:** What columns should be included? (Suggest: all visible fields)

---

## Commit Pattern

```
fix(leads): todo toggle race condition
fix(leads): auth source reset detection
feat(leads): type safety overhaul
feat(leads): split LeadDetailDrawer components
feat(leads): performance optimization memoization
feat(leads): CSV export functionality
refactor(leads): deduplicate constants
test(leads): add unit tests for utilities
docs(leads): update START-HERE.md — leads quality upgrade
```

---

## Next Steps

Say `go leads-r1` to start Round 1 (Critical Bug Fixes), or specify which round to begin with!
