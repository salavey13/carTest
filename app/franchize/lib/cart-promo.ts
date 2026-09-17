// Shared contract between the CART page (writes the applied promo) and the
// ORDER page (auto-applies it on mount). Boss request 2026-09-17: the promo
// field lives in the cart, so the validated code must survive the
// cart → checkout navigation without re-typing.
// sessionStorage (not localStorage): the promo is a session-scoped intent —
// a fresh visit starts clean, a reload / crash-recovery in the same tab
// keeps it.

export const CART_APPLIED_PROMO_KEY = "franchize-applied-promo";

export type CartAppliedPromo = {
  /** Crew slug the promo was validated for — ignores cross-crew leftovers. */
  slug: string;
  /** Normalized (uppercased) code as returned by the server validator. */
  code: string;
  title: string;
  description: string;
  /** Absolute discount validated by the server for the base amount at
   *  apply time. Callers re-cap it against the live subtotal via
   *  computeCartPromoDiscount. */
  discountAmount: number;
  /** Cart subtotal the code was validated against. Lets the cart rebuild
   *  the discount when the composition changes: 100% codes re-cover the
   *  whole (grown) order, fixed-amount codes stay capped. */
  baseAmountAtApply: number;
};

/**
 * Live discount for the applied promo against the CURRENT subtotal.
 * - A code whose validated discount covered its whole base (e.g. built-in
 *   PROMORIDE = 100%) keeps covering the whole order even after the rider
 *   adds another bike — otherwise a stale stored amount would silently
 *   downgrade the promo to a partial discount.
 * - Any other code behaves as a fixed-amount discount capped by the live
 *   subtotal. The order page re-validates server-side anyway; this only
 *   drives the cart display.
 */
export function computeCartPromoDiscount(promo: CartAppliedPromo, subtotal: number): number {
  if (!promo || !(subtotal > 0)) return 0;
  const base = Number(promo.baseAmountAtApply);
  if (Number.isFinite(base) && base > 0 && promo.discountAmount >= base) {
    return subtotal;
  }
  return Math.min(promo.discountAmount, subtotal);
}

/** Structural subset of DOM Storage so tests can pass simple stubs. */
export type CartPromoStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function saveCartAppliedPromo(storage: CartPromoStorage | null, promo: CartAppliedPromo): void {
  if (!storage) return;
  try {
    storage.setItem(CART_APPLIED_PROMO_KEY, JSON.stringify(promo));
  } catch {
    // Best-effort — storage must never block the cart UI.
  }
}

export function loadCartAppliedPromo(storage: CartPromoStorage | null, slug: string): CartAppliedPromo | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CART_APPLIED_PROMO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CartAppliedPromo> | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.slug !== slug) return null;
    if (typeof parsed.code !== "string" || parsed.code.trim().length === 0) return null;
    const discountAmount = Number(parsed.discountAmount);
    if (!Number.isFinite(discountAmount) || discountAmount <= 0) return null;
    const baseAmountAtApply = Number(parsed.baseAmountAtApply);
    if (!Number.isFinite(baseAmountAtApply) || baseAmountAtApply <= 0) return null;
    return {
      slug,
      code: parsed.code,
      title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title : parsed.code,
      description: typeof parsed.description === "string" ? parsed.description : "",
      discountAmount,
      baseAmountAtApply,
    };
  } catch {
    return null;
  }
}

export function clearCartAppliedPromo(storage: CartPromoStorage | null): void {
  if (!storage) return;
  try {
    storage.removeItem(CART_APPLIED_PROMO_KEY);
  } catch {
    // Best-effort.
  }
}
