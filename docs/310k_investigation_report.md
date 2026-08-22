# Investigation Report: The 310,000 ₽ Rental — CORRECTED

## Executive summary

The 310,000 ₽ is a **PRICING BUG**, not a real long-term rental. The contract artifact proves the rental was 1 day (July 8 → July 9) at 10,000 ₽/day. The rentals row was created 30 minutes after the contract, and during that gap the date got garbled (DD.MM → MM.DD swap), causing the pricing calculator to compute 31 × 10,000 = 310,000 instead of 1 × 10,000 = 10,000.

**My previous conclusion ("31-day rental, price is correct") was WRONG.** The user was right — it's a bug.

---

## The smoking gun: contract artifact vs rentals table

| Field | Contract artifact (TRUTH) | Rentals table (BUGGY) |
|---|---|---|
| rent_start_date | `08.07.2026` (July 8, DD.MM.YYYY) | `2026-08-07` (August 7 — swapped!) |
| rent_end_date | `09.07.2026` (July 9, DD.MM.YYYY) | `2026-07-09` (July 9) |
| daily_price | `10,000 ₽` | — |
| deposit_rub | `20,000 ₽` | — |
| **total_sum / total_cost** | **`10,000 ₽`** | **`310,000 ₽`** ← 31× wrong! |
| created_at | `11:45 UTC` | `12:15 UTC` (30 min later) |

The contract was generated FIRST (11:45 UTC) with correct dates + price. The rentals row was created 30 minutes later (12:15 UTC) and re-calculated the price from garbled dates.

---

## The bug chain

1. `/doc` command captures the contract with correct dates: `08.07.2026 → 09.07.2026`, `total_sum = 10,000 ₽`
2. 30 minutes later, `createRentalFromDocContract()` creates the rentals row
3. It **re-calculates** the price using `calculatePriceForDuration()` instead of using the contract's `total_sum`
4. The start date gets garbled from `08.07` (July 8) to `2026-08-07` (August 7) — DD.MM → MM.DD swap
5. The pricing calculator sees ~31 days (August 7 minus some reference) → 31 × 10,000 = 310,000 ₽
6. The contract artifact still has the CORRECT price (10,000 ₽) because it was generated before the garbling

---

## The fix (3 changes to doc-manual.ts)

### Fix 1: Use contract's total_sum as source of truth
Instead of re-calculating the price from (potentially garbled) dates, use the contract's `total_sum` if available:
```ts
const contractTotalSum = docContractTotalSum ?? null;
const calculatedCost = tierResult.price > 0 ? tierResult.price : baseDailyPrice * days;
const totalCost = contractTotalSum && contractTotalSum > 0
  ? contractTotalSum  // Trust the contract
  : calculatedCost;   // Fallback to calculation
```

### Fix 2: Validate negative hours (inverted dates)
```ts
if (hours <= 0) {
  logger.error('[/doc] INVALID DATE RANGE: end before start', { startDateIso, endDateIso, hours });
}
const days = Math.max(1, Math.ceil(Math.abs(hours) / 24));
```

### Fix 3: Log price mismatches
When the contract total_sum differs from the calculated cost, log a warning so the operator can investigate:
```ts
if (contractTotalSum && contractTotalSum !== calculatedCost) {
  logger.warn('[/doc] Price mismatch: contract vs calculated', { ... });
}
```

---

## The mixed cart angle

The user asked about a mixed cart with Falcon PRO. Investigation found:
- User 425868767 browsed `ducati-panigale-s-electro-RED` (checkout_started, totalAmount=10,000)
- But the rental is for `ducati-panigale-s-electro-GOLD`
- The operator created the rental via `/doc` for the GOLD variant, not the RED one from the cart
- This color mismatch didn't cause the pricing bug, but it shows the `/doc` flow is separate from the web cart flow

---

## Lessons learned

1. **Always cross-reference with the contract artifact** — it's the source of truth for what was agreed
2. **Never re-calculate prices from dates** if the contract already has the price — use it directly
3. **Validate date ranges** — if end < start, flag it immediately instead of computing a wild price
4. **The user's intuition was correct** — 310k for 1 day is obviously wrong; the bot should have caught this
