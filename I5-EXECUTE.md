# I5 WAVE EXECUTION GUIDE

> **sfera-tender-bot style** — tmux + teammates + parallel work
> Wave: `PLAN-I5-SERVICE-OPERATIONS.md` | Branch: `feat/i5-service-operations`

---

## 🚀 QUICK START (tmux session)

```bash
# 1. Setup tmux config
cp .tmux-i5.conf ~/.tmux.conf
tmux source-file ~/.tmux.conf

# 2. Create I5 session
tmux new -s i5-wave

# 3. In tmux: Ctrl+b, 3  (3-pane layout)
#    - Main: dev work
#    - Right top: tests/logs
#    - Right bottom: git/shell

# 4. OR for 4 teammates: Ctrl+b, 4
```

**Tmux commands:**
- `Ctrl+b h/j/k/l` — navigate panes
- `Ctrl+b -/|` — split horizontal/vertical
- `Ctrl+b c` — new window (for teammate isolation)
- `Ctrl+b ,` — rename window (e.g., `backend-core`, `frontend`, `integration`)
- `Ctrl+b n/p` — next/prev window

---

## ⚠️ PREREQUISITE (Этап 0 Step 6 — doit now!)

**Current baseline:** 2 failed tests (photo-actions — pre-existing, not I5)

**Fix before starting I5:**
```bash
# Check the failures
npm test -- tests/franchize/photo-actions.spec.ts

# Fix: tests/franchize/photo-actions.spec.ts
# - Line 116: mock chain needs `.order` mock
# - Line ~100: file size check mock needs correct chain
```

**Quick fix pattern:**
```typescript
// In mocks.chains:
order: vi.fn().mockReturnThis(),
```

**Verify baseline:**
```bash
npm test  # Expected: all pass (423+ tests)
```

---

## 👥 TEAMATES (who owns what)

| Name | Model | Files owned | Windows |
|------|-------|-------------|---------|
| `backend-core` | sonnet | `supabase/migrations/20260812*`, `app/franchize/server-actions/{equipment-rentals,cash-transactions,commissions,salary-calculations}.ts`, tests/sql, tests/franchize/*.spec.ts | `backend-core` |
| `backend-integration` | sonnet | `app/webhook-handlers/commands/doc-manual.ts`, `app/api/franchize/**`, `tests/franchize/i5-api.spec.ts` | `integration` |
| `frontend` | sonnet | `app/franchize/[slug]/{equipment,cash-ledger,admin/commissions,admin/salary,profile}/**`, `tests/franchize/i5-ui.spec.ts` | `frontend` |
| `verifier` | opus | E2E verification (after each stage) | `verifier` |

**Create windows:**
```bash
# In tmux session:
Ctrl+b c  # new window 2
Ctrl+b ,  # rename to "backend-core"

# Repeat for: integration, frontend, verifier (keep window 1 as "coordination")
```

---

## 📋 ЭТАП 1 (parallel start)

**Command:** tell each teammate to start their tasks

### backend-core
```
Task: equipment T1–T2 (migration + actions), cash T1 (migration)
Files: 20260812000001_create_equipment_rentals.sql, equipment-rentals.ts, 20260812000002_create_cash_transactions.sql
```

### frontend
```
Task: equipment T3 (catalog + rental UI) — use contract mocks
Files: app/franchize/[slug]/equipment/**, tests/franchize/i5-ui.spec.ts (equipment section)
```

### integration
```
Task: (idle Этап 1 — starts Этап 2)
```

**Sync point:** All T1–T3 done → `npm test` green → proceed to Этап 2

---

## 📋 ЭТАП 2 (parallel integration)

### backend-core
```
Task: salary T1 (migrations 03–05), equipment T1-seed (migration 06), cash T2–T3 (triggers 07, backfill 08)
```

### backend-integration
```
Task: equipment T4 (doc-manual integration)
Files: app/webhook-handlers/commands/doc-manual.ts
```

### frontend
```
Task: cash T6 (ledger UI)
Files: app/franchize/[slug]/cash-ledger/**
```

**Sync point:** All done → `npm test` + verifier E2E → proceed to Этап 3

---

## 📋 ЭТАП 3 (full integration)

### backend-core
```
Task: cash T4 (actions) + salary T2–T3
```

### backend-integration
```
Task: cash T5 (API) + salary T6 (API)
```

### frontend
```
Task: salary T4–T5 (commission config + salary/payout UI + profile My Earnings/My Work)
```

**Sync point:** All done → full gate → Этап 4

---

## 📋 ЭТАП 4 (gate → production)

**Verifier (opus) E2E checklist:**
- [ ] equipment: rent → return → cash entry visible
- [ ] commission: config → sale → commission row calculated by type
- [ ] salary: payout → calculation matches manual check
- [ ] re-completion: completed → active → completed = exactly 1 income_rental
- [ ] `npm test` green
- [ ] `npm run typecheck:franchize` clean
- [ ] `npm run lint:target` clean
- [ ] Migrations applied 01→08 in order
- [ ] Prod smoke: equipment rental workflow end-to-end

**Code-review (sonnet):** review diff of branch
**Security:** review new endpoints (crew owner only? service_role not leaked?)

**Deploy:**
```bash
# Apply migrations on staging (order 01→08)
# Smoke test staging
# Merge to main, push
# Prod smoke
```

---

## 📝 COMMIT PATTERN (wave standard)

```
feat(equipment-rentals): table + RLS
feat(equipment-rentals): server actions
feat(equipment): catalog + rental UI
feat(cash-transactions): table + daily_cash_flow view
feat(cash-transactions): auto-transaction triggers (idempotent)
feat(cash-transactions): backfill rentals + sales
feat(cash-ledger): server actions + API
feat(commissions): table + seed + config actions
feat(salary): plans + calculations + payout
integration: doc-manual equipment_rentals rows
feat(profile): My Earnings + My Work sections
test: E2E I5 flows
docs(i5): update START-HERE.md + META_PRD
```

---

## 🔗 CONTRACT REFERENCE (read before starting)

- **Wave plan:** `PLAN-I5-SERVICE-OPERATIONS.md` — read fully first
- **Equipment plan:** `docs/superpowers/plans/2026-08-12-i5-equipment-rentals.md`
- **Cash plan:** `docs/superpowers/plans/2026-08-12-i5-cash-ledger.md`
- **Salary plan:** `docs/superpowers/plans/2026-08-12-i5-commissions-salary.md`
- **PRD:** `docs/FRANCHIZE_SERVICE_OPERATIONS_PRD.md` v4.1

**Key contract fixes (vs PRD):**
- Migration series: `20260812000001`–`20260812000008` (strict order)
- Idempotency: transition guard + `NOT EXISTS` (I1 pattern)
- Commission branching: `percentage` → `amount * value / 100`, `fixed_amount` → `value`
- Backfill sales: `JOIN crews ON slug = s.crew_slug` (NOT `crew_slug::UUID`)
- `sale_contract_id`: column without FK (cross-schema FK NOT created)

---

## 🎯 COMMAND TO START

```bash
# After tmux setup + baseline fix:

# Tell teammates to start:
"backend-core: start equipment T1–T2, cash T1"
"frontend: start equipment T3 with contract mocks"

# Or run all in parallel via tmux windows
```

---

**Status:** 🟡 Ready to fix baseline → start Этап 1
**Last updated:** 2026-08-12
