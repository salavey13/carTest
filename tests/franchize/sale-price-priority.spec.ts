// tests/franchize/sale-price-priority.spec.ts
//
// iter29 sale-price priority suite (2026-09-01).
//
// Scenario that motivated this: the operator fixes a bike's sale price in
// the quick price editor (/franchize/{slug}/admin/prices — linked from the
// admin page). The editor writes specs.sale_price. But most legacy sale
// bikes ALSO carry specs.price_rub mirroring the old sale price, and the
// cart (useFranchizeCartLines → web-order sale contract price) and the
// sale landing (SaleBikeLandingClient) resolved price_rub FIRST — so the
// "quick fix" never reached checkout: the cart kept charging the stale
// price_rub while the catalog card and the printed buy PDF showed the new
// sale_price. One bike, two prices.
//
// Live-DB shapes pinned here (vip-bike crew):
//   • ducati-panigale-s-electro-black: sale=true, sale_price=600000,
//     price_rub=600000 (mirrored pair, the majority case)
//   • motoland-breakout: sale="true", sale_price="255000",
//     price_rub="390000" (intentional divergence: totalled > sale)
//   • yamaha-r7: sale=null, sale_price="0", price_rub="800000"
//     (rent-only bike: price_rub is the book/totalled value)
//   • many prices stored as TEXT in the JSONB ("600000")
//
// Fix: lib/sale-price.ts — sale_price wins, price_rub is a fallback,
// zeros/NaN fall through, strings are coerced.

import { describe, expect, it } from "vitest";
import {
  resolveSalePriceFromSpecs,
  SALE_PRICE_SPEC_KEYS,
} from "@/app/franchize/lib/sale-price";

describe("resolveSalePriceFromSpecs — priority order", () => {
  it("sale_price beats price_rub (the quick-editor fix case)", () => {
    // Operator fixed the sale price 600000 → 540000 in the editor; the
    // mirrored legacy price_rub still says 600000. Checkout must charge
    // the NEW sale price, not the stale mirror.
    const specs = { sale_price: 540000, price_rub: 600000 };
    expect(resolveSalePriceFromSpecs(specs)).toBe(540000);
  });

  it("price_rub still works when sale_price is absent (rent-only bikes)", () => {
    // yamaha-r7 shape: no usable sale_price, book value in price_rub.
    const specs = { sale_price: "0", price_rub: "800000" };
    expect(resolveSalePriceFromSpecs(specs)).toBe(800000);
  });

  it("zero / null / undefined sale_price falls through to price_rub", () => {
    expect(resolveSalePriceFromSpecs({ sale_price: 0, price_rub: 850000 })).toBe(850000);
    expect(resolveSalePriceFromSpecs({ sale_price: null, price_rub: 850000 })).toBe(850000);
    expect(resolveSalePriceFromSpecs({ sale_price: undefined, price_rub: 850000 })).toBe(850000);
  });

  it("TEXT prices in the JSONB are coerced (live DB stores strings)", () => {
    // motoland-breakout shape: sale_price "255000" beats price_rub "390000".
    expect(resolveSalePriceFromSpecs({ sale_price: "255000", price_rub: "390000" })).toBe(255000);
    expect(resolveSalePriceFromSpecs({ price_rub: "600000" })).toBe(600000);
  });

  it("legacy fallback chain: purchase_price, total_price, price", () => {
    expect(resolveSalePriceFromSpecs({ purchase_price: 320000 })).toBe(320000);
    expect(resolveSalePriceFromSpecs({ total_price: 210000 })).toBe(210000);
    expect(resolveSalePriceFromSpecs({ price: 99000 })).toBe(99000);
    expect(resolveSalePriceFromSpecs({ purchase_price: 0, total_price: 210000 })).toBe(210000);
  });

  it("no usable price anywhere → 0", () => {
    expect(resolveSalePriceFromSpecs({})).toBe(0);
    expect(resolveSalePriceFromSpecs(null)).toBe(0);
    expect(resolveSalePriceFromSpecs(undefined)).toBe(0);
    expect(resolveSalePriceFromSpecs({ sale_price: "not-a-number" })).toBe(0);
    expect(resolveSalePriceFromSpecs({ sale_price: -100, price_rub: -5 })).toBe(0);
  });

  it("fractional prices are rounded to whole rubles", () => {
    expect(resolveSalePriceFromSpecs({ sale_price: 549999.6 })).toBe(550000);
    expect(resolveSalePriceFromSpecs({ sale_price: "99.4" })).toBe(99);
  });

  it("priority key list is locked (order matters — money rule)", () => {
    expect([...SALE_PRICE_SPEC_KEYS]).toEqual([
      "sale_price",
      "price_rub",
      "purchase_price",
      "total_price",
      "price",
    ]);
  });
});

describe("resolveSalePriceFromSpecs — end-to-end consumer alignment", () => {
  it("cart, sale landing and catalog agree after a quick-editor fix", () => {
    // Before the fix: catalog card (sale_price priority) showed 490000,
    // cart + landing (price_rub priority) showed the stale 510000.
    // After: all three resolve through the same lib → same number.
    const afterQuickFix = { sale: true, sale_price: 490000, price_rub: 510000 };

    // All consumers call the same resolver:
    const cartPrice = resolveSalePriceFromSpecs(afterQuickFix);
    const landingPrice = resolveSalePriceFromSpecs(afterQuickFix);
    // (catalog item.salePrice in actions-runtime also prefers sale_price)
    const catalogPrice = Number(afterQuickFix.sale_price);

    expect(cartPrice).toBe(490000);
    expect(landingPrice).toBe(490000);
    expect(catalogPrice).toBe(490000);
  });

  it("intentionally divergent totalled value is NOT used as the sale price", () => {
    // motoland-breakout: sale 255000, totalled/book 390000. A buyer must
    // be charged the advertised sale price, not the totalled compensation.
    const specs = { sale: "true", sale_price: "255000", price_rub: "390000" };
    expect(resolveSalePriceFromSpecs(specs)).toBe(255000);
  });
});
