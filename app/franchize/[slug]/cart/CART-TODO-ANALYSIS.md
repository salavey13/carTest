# 🛒 Cart TODO Analysis — Franchize Multi-Tenant

> Generated 2026-05-25 · Based on current CartPageClient.tsx, useFranchizeCartLines.ts, useFranchizeCart.ts, CatalogItemVM types, and actions-runtime.ts hydration logic.

---

## 1. CRITICAL: Subtotal label is rental-only, ignores sale/mixed carts

**Current behavior:**
```
Line 157: <p>Сумма за 1 день аренды</p>
```
Always says "Сумма за 1 день аренды" — even when cart is all-sale or mixed.

**Expected behavior:**
| Cart composition | Subtotal label |
|---|---|
| All rental | "Сумма за 1 день аренды" |
| All sale | "Сумма покупки" |
| Mixed (rental + sale) | "Итого (аренда + покупка)" |

**Why the diff reverted the dynamic label:**
The previous attempt added `cartFlowLabel` + `subtotalLabel` as component-level computed values, but the diff removed them — likely because they added variables that weren't needed at component top level (flow detection was already inline in `handleProceed`). The fix should be simpler: compute the label inline or via a one-liner.

**Proposed fix (minimal):**
```tsx
// Inside the component, computed inline:
const saleLinesCount = cartLines.filter((line) => line.saleAvailable).length;
const isAllSale = saleLinesCount > 0 && saleLinesCount === cartLines.length;
const isMixed = saleLinesCount > 0 && !isAllSale;
const subtotalLabel = isAllSale
  ? "Сумма покупки"
  : isMixed
    ? "Итого (аренда + покупка)"
    : "Сумма за 1 день аренды";
```
Then: `<p ...>{subtotalLabel}</p>`

---

## 2. CRITICAL: Cart line items don't show sale price

**Current behavior:**
```
Line 116-118: {line.item.rentPriceLabel}
```
Only shows `rentPriceLabel` — which is always a rental price string like "5 000 ₽ / день". For sale-available items, this is misleading. The user sees a daily rate but might be buying outright.

**Expected behavior:**
- If `line.saleAvailable` AND item has `salePrice`: show BOTH prices
  - Rental: `line.item.rentPriceLabel` (muted/smaller)
  - Sale: `"Покупка: {salePrice.toLocaleString("ru-RU")} ₽"` (accent/prominent)
- If sale-only (no rental price): show only sale price
- If rental-only: show only `rentPriceLabel`

**Available data from `useFranchizeCartLines`:**
- `line.saleAvailable: boolean` — already computed
- `line.item.salePrice: number | null` — from CatalogItemVM
- `line.item.rentPriceLabel: string` — from CatalogItemVM
- `line.item.pricePerDay: number` — from CatalogItemVM

**Note:** `FranchizeCartLineVM` already has `saleAvailable` but does NOT expose `salePrice` directly. The sale price is only on `line.item.salePrice`. This works but is fragile — if `line.item` is null, sale price is lost.

**Proposed fix:**
```tsx
{line.item ? (
  <div className="mt-1">
    {/* Always show rental price if item has one */}
    {line.item.pricePerDay > 0 && (
      <p className="text-sm font-medium text-[var(--cart-accent)]">
        {line.item.rentPriceLabel}
      </p>
    )}
    {/* Show sale price when item is available for purchase */}
    {line.saleAvailable && line.item.salePrice ? (
      <p className="mt-0.5 text-xs font-medium text-amber-400">
        Покупка: {line.item.salePrice.toLocaleString("ru-RU")} ₽
      </p>
    ) : null}
  </div>
) : (
  <p className="mt-1 text-xs" style={surface.mutedText}>
    Недоступные позиции не участвуют в расчёте суммы.
  </p>
)}
```

---

## 3. MEDIUM: lineTotal calculation doesn't distinguish rental vs sale in UI

**Current behavior:**
```
Line 129: {line.lineTotal.toLocaleString("ru-RU")} ₽
```
Shows a single total per line. But `lineTotal` is computed differently depending on flow:
- **Rental**: `pricePerDay * packageFactor * rentalDays * durationDiscount + perkFee * qty`
- **Sale**: `(salePrice + buyPriceDelta) * qty`

The user has no indication which calculation applies. For sale items, "lineTotal" is actually the full purchase price × qty, not a daily rate.

**Proposed fix:**
Add a small label under the line total:
```tsx
<p className="text-sm font-semibold text-[var(--cart-accent)]">
  {line.lineTotal.toLocaleString("ru-RU")} ₽
</p>
{/* Show per-unit context */}
{line.rentalDays > 1 && !line.saleAvailable && (
  <p className="text-[10px]" style={surface.mutedText}>
    за {line.rentalDays} дн.
  </p>
)}
```

---

## 4. MEDIUM: "Перейти к оформлению" CTA doesn't adapt to flow

**Current behavior:**
```
Line 172: {isSaving ? "Сохранение..." : "Перейти к оформлению"}
```
Same CTA text regardless of whether the cart is rental, sale, or mixed.

**Expected behavior:**
| Flow | CTA text |
|---|---|
| All rental | "Перейти к оформлению аренды" |
| All sale | "Перейти к оформлению покупки" |
| Mixed | "Перейти к оформлению" |

This is a nice-to-have but improves clarity for non-bike crews (svarprofi = all sale, no rental).

**Proposed fix:**
```tsx
const ctaLabel = isSaving
  ? "Сохранение..."
  : isAllSale
    ? "Перейти к оформлению покупки"
    : isMixed
      ? "Перейти к оформлению"
      : "Перейти к оформлению аренды";
```

---

## 5. MEDIUM: Cart empty-state still says "Добавьте позицию" — generic but vague

**Current behavior:**
```
Line 84: Корзина пока пустая. Добавьте позицию из каталога, чтобы перейти к оформлению.
```
"Позиция" is the de-biked replacement. It's correct but generic. For bike crews it could say "байк", for svarprofi "профиль" or "изделие". This could be driven from crew metadata.

**Proposed fix (future):**
Add `catalogItemNoun` to crew metadata:
```sql
-- In crew metadata.franchize
'catalogItemNoun': 'байк'  -- for vip-bike
'catalogItemNoun': 'изделие'  -- for svarprofi
```
Then in CartPageClient:
```tsx
const itemNoun = crew.contentBlocks?.catalogItemNoun ?? "позицию";
// "Добавьте {itemNoun} из каталога"
```

**Priority:** Low — can wait until crew metadata schema is finalized.

---

## 6. LOW: Cart trust badges are rental-biased

**Current behavior:**
```
Lines 161-164:
  "Быстрое оформление" | "Без скрытых платежей" | "Поддержка 24/7"
```
These are fine for rental, but for a sale-only crew like svarprofi, "Быстрое оформление" might not resonate the same way. Could be driven by crew metadata.

**Priority:** Low — cosmetic.

---

## 7. ARCHITECTURAL: useFranchizeCartLines.buyFlow detection is fragile

**Current logic in `isBuyFlow()`:**
```ts
function isBuyFlow(options) {
  if (options.buyConfigId) return true;
  if (options.buyPriceDelta > 0) return true;
  const duration = options.duration.toLowerCase();
  const auction = options.auction.toLowerCase();
  return duration === "покупка" || auction === "покупка";
}
```
This relies on the `duration` or `auction` fields being set to "покупка" — which is a magic string convention. It works but could be cleaner.

**Proposed improvement:**
Add an explicit `flowType: "rental" | "sale"` to `FranchizeCartOptions`:
```ts
export type FranchizeCartOptions = {
  package: string;
  duration: string;
  perk: string;
  auction: string;
  buyConfigId?: string;
  buyPriceDelta?: number;
  flowType?: "rental" | "sale";  // ← explicit intent
};
```
Then `isBuyFlow` checks `flowType === "sale"` first, falls back to heuristics.

**Priority:** Medium — important for correctness but not blocking.

---

## 8. ARCHITECTURAL: FranchizeCartLineVM missing salePrice

**Current type:**
```ts
export type FranchizeCartLineVM = {
  lineId: string;
  itemId: string;
  qty: number;
  item: CatalogItemVM | null;
  pricePerDay: number;
  lineTotal: number;
  rentalDays: number;
  saleAvailable: boolean;
  options: { package; duration; perk; auction };
};
```
No `salePrice` field. Sale price is only accessible via `line.item.salePrice`, which is null-safe but requires null-checking everywhere. Also, if `line.item` is null (deleted catalog item), sale price is lost entirely.

**Proposed addition:**
```ts
export type FranchizeCartLineVM = {
  // ... existing fields
  salePrice: number | null;  // ← resolved at cart line level
  flowType: "rental" | "sale" | "mixed";  // ← explicit
};
```
Then in `useFranchizeCartLines`, compute:
```ts
salePrice: item?.salePrice ?? null,
flowType: inBuyFlow && salePrice > 0 ? "sale" : "rental",
```

**Priority:** Medium — enables cleaner UI logic.

---

## 9. BUG: Cart line shows rentPriceLabel even in buy flow

**Current behavior:**
When a user adds a sale item to cart (buy flow), the cart line still shows `line.item.rentPriceLabel` — which says something like "5 000 ₽ / день". But the actual calculation uses `salePrice + buyPriceDelta` from `useFranchizeCartLines`.

This means:
- **Displayed price**: "5 000 ₽ / день" (rental)
- **Actual lineTotal**: 150 000 ₽ (sale price × qty)

This is confusing and potentially misleading.

**Proposed fix:**
In `useFranchizeCartLines`, add a `displayPriceLabel` computed field:
```ts
// For buy-flow lines
if (inBuyFlow && salePrice > 0) {
  return {
    ...commonFields,
    displayPriceLabel: `Покупка: ${effectiveSalePrice.toLocaleString("ru-RU")} ₽`,
  };
}
// For rental lines
return {
  ...commonFields,
  displayPriceLabel: item?.rentPriceLabel ?? `${basePricePerDay.toLocaleString("ru-RU")} ₽ / день`,
};
```
Then CartPageClient uses `line.displayPriceLabel` instead of `line.item.rentPriceLabel`.

**Priority:** Critical — this is a display bug.

---

## 10. MINOR: Qty stepper doesn't enforce sale-item limits

**Current behavior:**
Qty +/- buttons allow unlimited quantity for any item. For sale items (metal profiles, etc.), quantity might need to be capped (e.g., max 1 for unique items, or bounded by stock).

**Proposed fix:**
Add optional `maxQty` to `FranchizeCartLineVM`:
```ts
maxQty?: number;  // undefined = unlimited
```
Disable the + button when `line.qty >= (line.maxQty ?? Infinity)`.

**Priority:** Low — feature request.

---

## Summary Priority Matrix

| # | Issue | Priority | Effort | Depends on |
|---|-------|----------|--------|------------|
| 1 | Subtotal label rental-only | **Critical** | S | — |
| 2 | No sale price shown | **Critical** | S | — |
| 9 | rentPriceLabel in buy flow | **Critical** | M | #8 or #7 |
| 3 | lineTotal doesn't show rental context | Medium | S | — |
| 4 | CTA text rental-only | Medium | S | #1 |
| 7 | isBuyFlow fragile | Medium | M | — |
| 8 | FranchizeCartLineVM missing salePrice | Medium | M | — |
| 5 | Empty state noun generic | Low | S | Crew metadata |
| 6 | Trust badges rental-biased | Low | S | Crew metadata |
| 10 | Qty cap for sale items | Low | M | #8 |

**Recommended implementation order:**
1. Fix #1 + #2 + #9 together (they're tightly coupled — the price display refactor)
2. Fix #4 (CTA text, trivial once #1 is done)
3. Fix #8 (add salePrice + flowType to FranchizeCartLineVM)
4. Fix #3 (line total context)
5. Fix #7 (isBuyFlow improvement)
6. Fix #5, #6, #10 (nice-to-haves)

---

## Appendix: Data Flow Diagram

```
CatalogClient (card CTA)
  │
  │ addItem(itemId, options, qty)
  ▼
useFranchizeCart(slug)
  │ localStorage + DB sync
  │ returns: { cart: FranchizeCartState, ... }
  ▼
useFranchizeCartLines(slug, items, cartCtx)
  │ Joins cart lines → CatalogItemVM
  │ Computes: pricePerDay, lineTotal, rentalDays, saleAvailable
  │ isBuyFlow() → switches pricing calculation
  │ returns: { cartLines: FranchizeCartLineVM[], subtotal, ... }
  ▼
CartPageClient
  │ Renders: line items, subtotal, CTA
  │ handleProceed → determines flow (sale/mixed/rental)
  │ → router.push(/franchize/{slug}/order/demo-order?flow={flow})
  ▼
actions-runtime.ts (checkout)
  │ createFranchizeOrderInvoiceInternal
  │ Uses flow type for: invoice title, amount calculation, deep link
```

**Key insight:** The flow type is determined in TWO places:
1. `useFranchizeCartLines.isBuyFlow()` — per-line, for pricing
2. `CartPageClient.handleProceed()` — aggregate, for checkout routing

These MUST stay in sync. If `isBuyFlow` says "sale" but `handleProceed` sees `saleLinesCount === 0`, the checkout will use wrong invoice title and deposit calculation.
