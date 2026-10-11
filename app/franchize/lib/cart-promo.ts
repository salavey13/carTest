// Shared contract between the CART page (writes the applied promo) and the
// ORDER page (auto-applies it on mount). Boss request 2026-09-17: the promo
// field lives in the cart, so the validated code must survive the
// cart → checkout navigation without re-typing.
// sessionStorage (not localStorage): the promo is a session-scoped intent —
// a fresh visit starts clean, a reload / crash-recovery in the same tab
// keeps it.

// B1/B2 boss codereview (2026-10-11): the stored promo now carries the
// SERVER'S discount semantics (kind + value + maxDiscount — see
// FranchizePromoSemantics in actions-runtime.ts), so the cart can recompute
// the live discount EXACTLY like resolveFranchizeCheckoutTotal will:
//   full    → covers the whole (grown) order;
//   percent → round(subtotal * value / 100), then subtotal/maxDiscount caps;
//   fixed   → min(value, subtotal), then maxDiscount cap;
//   bonus   → 0 (description-only perk).
// Old sessions may still hold a pre-semantics row (no `kind`): those fall
// back to the conservative min(stored, subtotal) — never the old optimistic
// "stored ≥ base ⇒ free order" guess, which mislabeled a capped WHEEL5000
// as a 100% code and showed a 0 ₽ cart right before a paid checkout.

export const CART_APPLIED_PROMO_KEY = "franchize-applied-promo";

export type CartAppliedPromoKind = "full" | "fixed" | "percent" | "bonus";

export type CartAppliedPromo = {
  /** Crew slug the promo was validated for — ignores cross-crew leftovers. */
  slug: string;
  /** Normalized (uppercased) code as returned by the server validator. */
  code: string;
  title: string;
  description: string;
  /** Absolute discount validated by the server for the base amount at
   *  apply time. With `kind` present this is informational; callers
   *  recompute via computeCartPromoDiscount. */
  discountAmount: number;
  /** Cart subtotal the code was validated against. Lets the cart detect a
   *  composition change and re-validate (and keeps legacy rows capped). */
  baseAmountAtApply: number;
  /** Server discount semantics (validator ≥ 2026-10-11). */
  kind?: CartAppliedPromoKind;
  /** ₽ for fixed, percent points for percent, 0 otherwise. */
  value?: number;
  /** Absolute banner-promo cap (0/undefined = none). */
  maxDiscount?: number;
};

function capBySubtotalAndMax(discount: number, subtotal: number, maxDiscount?: number): number {
  const cappedBySubtotal = Math.min(Math.max(0, Math.round(discount)), subtotal);
  const max = Number(maxDiscount ?? 0);
  return Number.isFinite(max) && max > 0 ? Math.min(cappedBySubtotal, Math.round(max)) : cappedBySubtotal;
}

/**
 * Live discount for the applied promo against the CURRENT subtotal —
 * a faithful client mirror of the server checkout math.
 * - full: the code covered its whole base at apply time (100%-code) and
 *   keeps covering the whole (grown) order.
 * - percent/fixed: recomputed from the LIVE subtotal (never stale) with the
 *   same caps the server applies.
 * - legacy rows without `kind`: conservative min(stored, subtotal) — checkout
 *   re-validates server-side anyway, so we can only ever UNDERSTATE here.
 */
export function computeCartPromoDiscount(promo: CartAppliedPromo, subtotal: number): number {
  if (!promo || !(subtotal > 0)) return 0;
  if (promo.kind === "full") return subtotal;
  if (promo.kind === "percent") return capBySubtotalAndMax((subtotal * (promo.value ?? 0)) / 100, subtotal, promo.maxDiscount);
  if (promo.kind === "fixed") return capBySubtotalAndMax(promo.value ?? 0, subtotal, promo.maxDiscount);
  if (promo.kind === "bonus") return 0;
  return capBySubtotalAndMax(promo.discountAmount, subtotal, undefined);
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
    const kind = parsed.kind;
    const value = Number(parsed.value);
    const maxDiscount = Number(parsed.maxDiscount);
    return {
      slug,
      code: parsed.code,
      title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title : parsed.code,
      description: typeof parsed.description === "string" ? parsed.description : "",
      discountAmount,
      baseAmountAtApply,
      kind: kind === "full" || kind === "fixed" || kind === "percent" || kind === "bonus" ? kind : undefined,
      value: Number.isFinite(value) ? value : undefined,
      maxDiscount: Number.isFinite(maxDiscount) ? maxDiscount : undefined,
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
