# I5 MIGRATION ORDER (FIXED)

> **Status:** You're at step 1 (equipment_rentals ✓)  
> **Total migrations:** 8 files  
> **Circular dependency FIXED:** cash_transactions.salary_calc_id removed

---

## Fixed Dependency Issue

**CIRCULAR DEPENDENCY RESOLVED:**
```
❌ BEFORE:
  cash_transactions.salary_calc_id → salary_calculations(id)
  salary_calculations.cash_transaction_id → cash_transactions(id)

✅ AFTER:
  cash_transactions: NO salary_calc_id FK (removed)
  salary_calculations.cash_transaction_id → cash_transactions(id) (one-way, safe)
```

---

## Migration Order (Apply Sequentially)

```bash
# ✅ DONE (you're here)
supabase/migrations/20260812000001_create_equipment_rentals.sql

# 2. Cash ledger foundation (no circular FK now)
supabase/migrations/20260812000002_create_cash_transactions.sql

# 3. Commission rates (has seed data)
supabase/migrations/20260812000003_create_commission_rates.sql

# 4. Salary plans (FIXED — no generated columns)
supabase/migrations/20260812000004_create_salary_plans.sql

# 5. Salary calculations (depends on salary_plans, FK to cash_transactions OK)
supabase/migrations/20260812000005_create_salary_calculations.sql

# 6. Equipment seed data
supabase/migrations/20260812000006_seed_equipment.sql

# 7. Triggers (depends on tables + commission_rates)
supabase/migrations/20260812000007_cash_transaction_triggers.sql

# 8. Backfill (depends on triggers)
supabase/migrations/20260812000008_backfill_cash_transactions.sql
```

---

## Clean Dependency Map

```
01 equipment_rentals (standalone)
    ↓
02 cash_transactions (standalone — NO circular FK)
    ↓
03 commission_rates (standalone, has seed)
    ↓
04 salary_plans (FIXED — manual tracking)
    ↓
05 salary_calculations → FK to 04 (salary_plans) + FK to 02 (cash_transactions) ✅ ONE-WAY
    ↓
06 seed_equipment → FK to 01 (equipment_rentals)
    ↓
07 triggers → depends on 02 (cash_transactions) + 03 (commission_rates)
    ↓
08 backfill → depends on 02 (cash_transactions) + 07 (triggers pattern)
```

---

## Navigation Integration

I5 pages added to VIP-BIKE menu in `docs/crewDocs/vip-bike-franchize-hydration.sql`:

**Header menuLinks (new):**
- `/franchize/{slug}/cash-ledger` — Касса
- `/franchize/{slug}/commissions` — Комиссии
- `/franchize/{slug}/salary` — Зарплата
- `/franchize/{slug}/equipment` — Экипировка

**Footer links (new):**
- `/franchize/{slug}/cash-ledger` — Касса
- `/franchize/{slug}/salary` — Зарплата

All I5 pages now accessible from VIP-BIKE crew header dropdown! 🎯

---

## What Was Fixed

**Circular Dependency:**
- ❌ REMOVED: `cash_transactions.salary_calc_id` FK
- ✅ KEPT: `salary_calculations.cash_transaction_id` FK (one-way, safe)

**Migration 04 (salary_plans):**
- ❌ REMOVED: Generated columns with subqueries
- ✅ ADDED: Manual tracking columns + auto-calc trigger

**Migration 05 (salary_calculations):**
- ✅ ADDED: Idempotency guard in payout trigger
- ✅ KEPT: `cash_transaction_id` FK (now safe, no circular)

---

## Verification Steps

After each migration:
```sql
-- Check table created
SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
  AND tablename = '<table_name>';

-- Check row count
SELECT COUNT(*) FROM <table_name>;

-- Verify FK direction (should be one-way)
SELECT 
    cl.relname AS table,
    att2.attname AS fk_column,
    cl2.relname AS referenced_table
FROM pg_attribute att
JOIN pg_class cl ON att.attrelid = cl.oid
JOIN pg_namespace ns ON cl.relnamespace = ns.oid
JOIN pg_constraint con ON con.conrelid = cl.oid
JOIN pg_class cl2 ON con.confrelid = cl2.oid
JOIN pg_attribute att2 ON con.confkey[1] = att2.attnum
WHERE ns.nspname = 'public'
  AND cl.relname IN ('cash_transactions', 'salary_calculations')
  AND con.contype = 'f'
ORDER BY cl.relname, att2.attname;
```

Expected result:
```
table                 | fk_column             | referenced_table
-----------------------|----------------------|-------------------
salary_calculations    | cash_transaction_id  | cash_transactions  ✅ ONE-WAY
salary_calculations    | salary_plan_id       | salary_plans
```

---

## Next Steps

1. Apply migrations 2-8 in order
2. Verify FK direction with query above
3. Rehydrate crew with updated SQL (includes I5 navigation)
4. Test I5 pages from menu
5. Run verification tests
