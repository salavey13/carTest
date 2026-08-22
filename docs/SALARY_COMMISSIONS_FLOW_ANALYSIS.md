# Salary & Commissions System - Code Review & Analysis

## Current Architecture Overview

### Database Schema

```
salary_plans (period definitions)
├── id, crew_id, member_id
├── period_start, period_end
├── base_salary, total_accrued, total_paid, balance_due
└── payout_schedule (default: [10, 25])

salary_calculations (payout records)
├── id, salary_plan_id
├── period_start, period_end (snapshot)
├── shift_income, commission_income, bonus_income, total_income
├── payout_status (pending/paid/failed)
└── cash_transaction_id → cash_transactions

cash_transactions (financial ledger)
├── id, crew_id
├── transaction_type (income_*, expense_commission, expense_salary)
├── flow_direction (in/out)
├── amount, salary_calc_id (FK)
└── to_user_id (for commissions/salary)

commission_rates (rate configuration)
├── id, crew_id
├── operation_type (rental_hourly, rental_daily, sale, equipment_rental)
├── commission_type (percentage/fixed_amount)
├── commission_value
└── priority (highest wins)

crew_member_shifts (shift tracking)
├── id, crew_id, member_id
├── clock_in_time, clock_out_time
├── duration_minutes
├── hourly_rate, salary_amount (auto-calced)
└── shift_type
```

### Data Flow

```
1. START SHIFT → crew_member_shifts (clock_in_time)
   → Real-time: elapsed * hourly_rate from users.metadata

2. END SHIFT → clock_out_time set
   → Trigger: duration_minutes calced
   → Trigger: salary_amount = duration/60 * hourly_rate

3. CONFIGURE COMMISSIONS → commission_rates table
   → Operation type → rate mapping
   → Priority determines which rate applies

4. CALCULATE SALARY → calculateSalaryForPeriod()
   → Fetch shifts with salary_amount
   → Fetch income transactions
   → Apply commission rates by operation type
   → Return: shiftIncome + commissionIncome + breakdown

5. CREATE PAYOUT → recordPayout()
   → Create expense_salary transaction
   → Update salary_calculations.payout_status = 'paid'
   → Trigger updates salary_plans.total_paid
```

---

## Critical Issues Found

### 1. **Missing hourly_rate Sync** 🔴 HIGH

**Problem**: hourly_rate stored in `users.metadata` but not synced to `crew_member_shifts.hourly_rate`

**Impact**: 
- Shift calculations use stale or default rates
- `salary_amount` calculation may be incorrect
- Real-time earnings preview uses wrong rate

**Fix**: Add trigger/function to sync hourly_rate from users.metadata when shift starts

```sql
CREATE OR REPLACE FUNCTION sync_hourly_rate_on_shift_start()
RETURNS TRIGGER AS $$
BEGIN
  -- Update shift with current hourly_rate from users.metadata
  UPDATE crew_member_shifts cms
  SET hourly_rate = COALESCE(
    (SELECT metadata->>'hourly_rate'::numeric FROM users WHERE user_id = NEW.member_id),
    500
  )
  WHERE id = NEW.id AND hourly_rate IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2. **No Auto-Calculation Trigger** 🟡 MEDIUM

**Problem**: `salary_calculations` records must be manually created

**Impact**:
- No automatic salary calc when period ends
- Manual process required for payroll
- Possible missed calculations

**Fix**: Add trigger or scheduled job to auto-calc at period end

### 3. **total_accrued Not Auto-Updated** 🟡 MEDIUM

**Problem**: `salary_plans.total_accrued` is manual-only field

**Impact**:
- Manual tracking required
- Data inconsistency risk
- No source of truth for accrued amount

**Current Schema Issue**: `total_accrued` expected to be manually set, but no UI/exposed function to update it

**Fix**: Add trigger on salary_calculations insert/update to sum total_income:

```sql
CREATE OR REPLACE FUNCTION update_plan_accrued_from_calcs()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE salary_plans
  SET total_accrued = (
    SELECT COALESCE(SUM(total_income), 0)
    FROM salary_calculations
    WHERE salary_plan_id = NEW.salary_plan_id
  )
  WHERE id = NEW.salary_plan_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 4. **Commission Calculation Inconsistency** 🟡 MEDIUM

**Problem**: Uses two methods - recorded commissions AND calculated from rates

**Current Behavior**:
1. Calculates from `commission_rates` + `cash_transactions` (income)
2. Falls back to recorded `expense_commission` transactions
3. No reconciliation between the two

**Impact**:
- Double-counting risk if both methods return values
- Confusion about "real" commission amount
- No audit trail

**Fix**: Choose ONE method and stick to it. Recommended: calculate from rates, record as expense_commission only when paid

### 5. **Missing Validation** 🟡 MEDIUM

**Issues**:
- No validation on `hourly_rate` (could be negative, unreasonably high)
- No validation on `commission_value` (percentage could exceed 100%)
- No validation on period overlap (prevents duplicate periods but no user feedback)
- No check for circular commission rates (e.g., commission on commission)

**Fix**: Add validation functions

```sql
CREATE OR REPLACE FUNCTION validate_commission_rate()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.commission_type = 'percentage' AND NEW.commission_value > 100 THEN
    RAISE EXCEPTION 'Commission percentage cannot exceed 100%';
  END IF;
  IF NEW.commission_value < 0 THEN
    RAISE EXCEPTION 'Commission value cannot be negative';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 6. **Circular Dependency Fragility** 🟡 MEDIUM

**Current Solution**: Deferred FK constraints to break cash_transactions ↔ salary_calculations cycle

**Issue**: Complex migration (20260812000009) adds constraints separately

**Risk**:
- Migration order dependencies
- Potential constraint violations
- Hard to maintain

**Current Approach**: Works but requires careful migration sequencing

### 7. **Missing Audit Trail** 🟢 LOW

**Problem**: Manual changes to `salary_plans` not tracked

**Impact**:
- No history of accrual adjustments
- Difficult to troubleshoot discrepancies
- No compliance audit trail

**Fix**: Add audit table or use PostgreSQL temporal tables

---

## Code Review: Specific Files

### SalaryClient.tsx

**Strengths**:
- Clean separation of concerns (UI vs data)
- Good use of tokens for theming
- Responsive layout
- Proper error handling

**Issues**:
- Lines 194-228: Direct supabase calls in component (should use server actions)
- Line 297: `total_accrued` from salary_plans but no way to update it
- Missing: Display of hourly_rate used for calculations
- Missing: Export/download of payslip

### CommissionsClient.tsx

**Strengths**:
- Excellent UX improvements (quick stats, presets)
- Good mobile responsiveness
- Clear visual hierarchy

**Issues**:
- No validation of commission values client-side
- No preview of impact before saving
- Missing: Bulk rate update
- Missing: Historical rate changes view

### CrewShiftsClient.tsx

**Strengths**:
- Real-time earnings preview
- Good integration with hourly_rate
- Clean UI with consistent theming

**Issues**:
- Break functionality (UI placeholder only)
- No validation of shift overlap
- Missing: Export timesheet
- Missing: Multi-day shift support

### salary-calculations.ts (server actions)

**Strengths**:
- Good caching strategy (24-hour TTL)
- Proper error handling
- Clear function documentation

**Issues**:
- `calculateSalaryForPeriod`: Uses BOTH calculated and recorded commissions (lines 237-260)
- No idempotency protection for duplicate calculations
- `getMyEarnings`: Uses current month only (hard to see other periods)
- Missing: Batch calculation for all members

---

## Recommended Improvements

### Priority 1 (Fix Data Flow)

1. **Sync hourly_rate**: Add trigger/function to ensure shifts use current rate
2. **Auto-calc salary_plans.total_accrued**: Add trigger on salary_calculations
3. **Fix commission method**: Use calculated OR recorded, not both

### Priority 2 (Add Validation)

4. **Add validation triggers**: Commission values, hourly_rate ranges
5. **Add period overlap user feedback**: Better error messages
6. **Add idempotency**: Prevent duplicate calculations

### Priority 3 (Improve UX)

7. **Add bulk operations**: Batch rate updates, multi-member payout
8. **Add export**: Payslip PDF, timesheet CSV
9. **Add preview**: See commission impact before saving rates

### Priority 4 (Compliance)

10. **Add audit trail**: Track all salary plan changes
11. **Add approval workflow**: Required for large payouts
12. **Add tax withholding**: Prepare for future requirements

---

## Current Settings Summary

### Commission Rates (configured per crew)
- `rental_hourly`: % of hourly rental income
- `rental_daily`: % of daily rental income
- `sale`: % of sale income
- `equipment_rental`: % of equipment rental
- `service`: % of service income

### Salary Calculation
- Shifts: `duration_minutes / 60 * hourly_rate` (auto-calc on clock_out)
- Commissions: `transaction_amount * rate_value` (percentage-based)
- Bonuses: Manual (reserved for future)

### Payout Schedule
- Default: 10th and 25th of each month
- Configurable per salary_plan
- Manual payout: Anytime via "Выплатить" button

### Access Control
- Crew members: Read own salary info
- Crew owners: Full access to all payroll
- Admins/co-owners: Owner-level access

---

## Testing Recommendations

### Unit Tests Needed
1. `calculateSalaryForPeriod()` with various rate configs
2. `recordPayout()` idempotency
3. Hourly rate sync triggers
4. Commission rate priority logic

### Integration Tests Needed
1. Full flow: Start shift → End shift → Calc salary → Payout
2. Commission application: Rental → Rate → Payout
3. Period overlap prevention
4. Multi-member payroll

### Edge Cases to Test
1. Shift spans midnight (duration calculation)
2. Negative hourly_rate (should be rejected)
3. Commission rate > 100% (should be rejected)
4. Duplicate payout attempts (idempotency)
5. Period end in past (backfill calculations)

---

## Conclusion

The salary/commission system is **functional but has several gaps** that could lead to data inconsistency and incorrect payments. The architecture is sound with good separation of concerns, but the data flow needs strengthening through:

1. **Automated triggers** for field updates
2. **Single source of truth** for commission calculation
3. **Comprehensive validation** at all levels
4. **Audit trail** for compliance

The recent improvements to UX (commissions page, shifts integration) are excellent and significantly improve usability. The remaining work is primarily in data integrity and automation.
