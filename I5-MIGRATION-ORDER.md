# I5 MIGRATION APPLICATION ORDER

> **Status:** You're at step 1 (equipment_rentals ✓)  
> **Total migrations:** 8 files  
> **Estimated time:** ~5 minutes

---

## Migration Order (Apply Sequentially)

```bash
# ✅ DONE (you're here)
supabase/migrations/20260812000001_create_equipment_rentals.sql

# 2. Cash ledger foundation
supabase/migrations/20260812000002_create_cash_transactions.sql

# 3. Commission rates (has seed data)
supabase/migrations/20260812000003_create_commission_rates.sql

# 4. Salary plans (FIXED — no generated columns)
supabase/migrations/20260812000004_create_salary_plans.sql

# 5. Salary calculations (depends on salary_plans)
supabase/migrations/20260812000005_create_salary_calculations.sql

# 6. Equipment seed data
supabase/migrations/20260812000006_seed_equipment.sql

# 7. Triggers (depends on tables + commission_rates)
supabase/migrations/20260812000007_cash_transaction_triggers.sql

# 8. Backfill (depends on triggers)
supabase/migrations/20260812000008_backfill_cash_transactions.sql
```

---

## Dependency Map

```
01 equipment_rentals (standalone)
    ↓
02 cash_transactions (standalone)
    ↓
03 commission_rates (standalone, has seed)
    ↓
04 salary_plans (FIXED)
    ↓
05 salary_calculations → depends on 04 (salary_plans FK)
    ↓
06 seed_equipment (depends on 01 equipment_rentals FK)
    ↓
07 triggers → depends on 02 (cash_transactions) + 03 (commission_rates)
    ↓
08 backfill → depends on 02 (cash_transactions) + 07 (triggers pattern)
```

---

## What Was Fixed

**Migration 04 (salary_plans):**
- ❌ REMOVED: Generated columns with subqueries (PostgreSQL limitation)
  - `total_shift_income` (subquery from crew_member_shifts)
  - `total_commissions` (subquery from cash_transactions)
  - `total_accrued` (expression from above)
- ✅ ADDED: Manual tracking columns
  - `base_salary`, `total_accrued`, `total_paid`, `balance_due`
- ✅ ADDED: Trigger to auto-calculate `balance_due` and `updated_at`

**Migration 05 (salary_calculations):**
- ✅ ADDED: Trigger to update `salary_plans.total_paid` when marked paid
- ✅ FIXED: Comment to reflect trigger behavior

---

## Verification Steps

After each migration:
```sql
-- Check table created
SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
  AND tablename = '<table_name>';

-- Check row count
SELECT COUNT(*) FROM <table_name>;
```

Final verification:
```bash
# Run regression tests
psql -f tests/sql/i5_equipment_rentals_regression.sql
psql -f tests/sql/i5_cash_ledger_regression.sql
psql -f tests/sql/i5_salary_commissions_regression.sql
```

---

## Rollback (If Needed)

```sql
-- Drop in reverse order
DROP TABLE IF EXISTS public.cash_transactions CASCADE;
DROP TABLE IF EXISTS public.salary_calculations CASCADE;
DROP TABLE IF EXISTS public.salary_plans CASCADE;
DROP TABLE IF EXISTS public.commission_rates CASCADE;
DROP TABLE IF EXISTS public.equipment_rentals CASCADE;
```

---

## Next Steps

1. Apply migrations 2-8 in order
2. Run verification queries
3. Test UI pages (`/cash-ledger`, `/commissions`, `/salary`)
4. Report any issues
