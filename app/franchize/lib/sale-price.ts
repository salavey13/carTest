// sale-price.ts
// ──────────────────────────────────────────────────────────────────────────
// Single source of truth for "what does this bike cost to BUY".
//
// iter29 sale-price fix (2026-09-01): the quick price editor
// (/franchize/{slug}/admin/prices) writes specs.sale_price, but the cart
// (useFranchizeCartLines) and the sale landing (SaleBikeLandingClient)
// resolved the sale price with price_rub FIRST. Most legacy sale bikes
// mirror price_rub === sale_price, so a sale price fixed in the editor
// never reached checkout — the cart kept charging the stale price_rub.
// Catalog cards and the printed buy PDF already preferred sale_price;
// this lib aligns every consumer.
//
// Priority order (first key with a positive finite number wins):
//   1. sale_price   — THE sale price, edited by the quick price editor
//   2. price_rub    — legacy book/totalled value most bikes mirror
//   3. purchase_price / total_price / price — legacy fallbacks
//
// Zero / negative / NaN values are treated as "not set" and fall through,
// matching the `specs.sale_price || specs.price_rub` truthy chains that
// used to live in the landing client. JSONB prices are often TEXT
// ("600000") — Number() handles both shapes (see hotfix-string-prices).

/** Spec keys checked in priority order for the buy price. */
export const SALE_PRICE_SPEC_KEYS = [
  "sale_price",
  "price_rub",
  "purchase_price",
  "total_price",
  "price",
] as const;

/**
 * Resolve a bike's sale price from raw specs.
 * Returns a positive integer (₽), or 0 when no usable price exists.
 */
export function resolveSalePriceFromSpecs(
  specs: Record<string, unknown> | null | undefined,
): number {
  if (!specs || typeof specs !== "object") return 0;
  for (const key of SALE_PRICE_SPEC_KEYS) {
    if (!(key in specs)) continue;
    const raw = Number(specs[key]);
    if (Number.isFinite(raw) && raw > 0) return Math.round(raw);
  }
  return 0;
}
