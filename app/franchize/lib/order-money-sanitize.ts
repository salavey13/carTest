/**
 * HOTFIX (2026-08-28, "prices summed as strings in the rental web app"):
 * server-side sanitation + healing for franchize order money fields.
 *
 * Root cause: several bikes store price fields as TEXT in the cars.specs
 * JSONB (yamaha-r7: dailyPrice "10000"). The shared pricing calculator used
 * to return those raw strings, so `price + helmetRub` CONCATENATED
 * ("10000" + 2000 → "100002000") and the concatenated garbage flowed into
 * cart lines, order totals, rental rows and payment splits.
 *
 * The calculator itself is now string-safe (lib/rental-pricing-calculator
 * coerces every spec read through num()). THIS module is the second line of
 * defence for the deploy window: users with a stale cached Telegram WebApp
 * frontend keep submitting old-payload numbers, and the raw retry path
 * replays stored payloads that bypass zod. Both are healed here:
 *
 *   1. every money field on the payload is coerced to a finite number;
 *   2. RENTAL lines with picked dates are RECOMPUTED from bike specs via
 *      the fixed calculator — when the client value disagrees by > 1 ₽ the
 *      recomputed value wins (heals string-sum garbage AND the missing
 *      helmet count from the old non-tolerant perk regex);
 *   3. a priceBreakdown with non-number fields is dropped, so the contract
 *      builder recomputes from specs instead of trusting string garbage;
 *   4. derived totals (subtotal / extrasTotal / totalAmount) are recomputed
 *      the same way the order page computes them.
 */

import { calculatePrice } from "@/lib/rental-pricing-calculator";
import { parseHelmetCountFromPerk, parseExtrasFromPerk } from "@/app/franchize/lib/perk-parse";

export { parseHelmetCountFromPerk, parseExtrasFromPerk };

/**
 * Coerce anything into a finite number (fallback when not possible).
 */
export function toFiniteNumber(value: unknown, fallback: number = 0): number {
  if (value === null || value === undefined) return fallback;
  const raw = typeof value === "string"
    ? Number(value.replace(/\s/g, "").replace(",", "."))
    : Number(value);
  return Number.isFinite(raw) ? raw : fallback;
}

type SanitizeOptions = {
  action?: string;
  buyConfigId?: string;
  buyPriceDelta?: number;
  duration?: string;
  auction?: string;
  rentStartDate?: string;
  rentEndDate?: string;
  rentStartTime?: string;
  rentEndTime?: string;
  perk?: string;
};

type SanitizeCartLine = {
  itemId: string;
  qty?: number;
  pricePerDay?: number | string;
  lineTotal?: number | string;
  options?: SanitizeOptions;
  priceBreakdown?: {
    totalRub?: unknown;
    basePriceRub?: unknown;
    helmetRub?: unknown;
    depositRub?: unknown;
  } & Record<string, unknown>;
};

type SanitizeOrderPayload = {
  orderId?: string;
  subtotal?: number | string;
  extrasTotal?: number | string;
  promoDiscount?: number | string;
  totalAmount?: number | string;
  extras?: Array<{ amount?: number | string }>;
  cartLines: SanitizeCartLine[];
};

type SanitizeCar = {
  id: string;
  type?: string | null;
  specs?: Record<string, unknown> | null;
};

export type SanitizeResult = {
  /** Number of cart lines whose total was healed by recomputation. */
  healedLines: number;
  /** True when subtotal/extrasTotal/totalAmount were rewritten. */
  totalsRewritten: boolean;
};

function lineHasBuyMarker(o: SanitizeOptions): boolean {
  if (String(o.action ?? "").trim().toLowerCase() === "buy") return true;
  if (typeof o.buyConfigId === "string" && o.buyConfigId.trim().length > 0) return true;
  if (typeof o.buyPriceDelta === "number" && o.buyPriceDelta > 0) return true;
  const duration = String(o.duration ?? "").trim().toLowerCase();
  const auction = String(o.auction ?? "").trim().toLowerCase();
  return duration === "покупка" || duration === "buy" || auction === "покупка" || auction === "buy";
}

function isTestdriveLine(o: SanitizeOptions): boolean {
  return String(o.action ?? "").trim().toLowerCase() === "testdrive"
    || String(o.duration ?? "").trim().toLowerCase() === "10 минут";
}

function isServiceLine(o: SanitizeOptions): boolean {
  return String(o.action ?? "").trim().toLowerCase() === "service";
}

/** Specs look like a rentable BIKE (hour/day tiers), not equipment/service. */
function hasBikePricing(specs: Record<string, unknown>): boolean {
  const keys = [
    "dailyPrice", "rent_weekday", "rent_weekend", "rent_2_4d", "rent_5_10d",
    "rent_11_30d", "price_per_hour", "price_per_2h", "price_per_3h",
    "price_per_6h", "price_per_12h",
  ];
  return keys.some((k) => {
    const v = specs?.[k];
    const n = typeof v === "string" ? Number(v.replace(/\s/g, "").replace(",", ".")) : Number(v);
    return Number.isFinite(n) && n > 0;
  });
}

/**
 * Recompute a RENTAL line total from bike specs + picked dates + helmet
 * count + extras — exactly what the fixed frontend calculator produces.
 * Returns null when the line is not a recomputable rental (sale/testdrive/
 * service, no dates, non-bike item).
 */
function recomputeRentalLineTotal(
  line: SanitizeCartLine,
  car: SanitizeCar | undefined,
): number | null {
  if (!car) return null;
  const o = line.options ?? {};
  if (lineHasBuyMarker(o) || isTestdriveLine(o) || isServiceLine(o)) return null;
  if (car.type && car.type !== "bike") return null;
  const specs = (car.specs ?? {}) as Record<string, unknown>;
  if (!hasBikePricing(specs)) return null;
  if (!o.rentStartDate || !o.rentEndDate) return null;
  try {
    const result = calculatePrice(
      specs,
      o.rentStartDate,
      o.rentEndDate,
      o.rentStartTime || "10:00",
      o.rentEndTime || "10:00",
      parseHelmetCountFromPerk(o.perk),
      // FIX (2026-08-29, "gloves not priced"): same perk string carries the
      // non-helmet extras — recompute them too, or stale frontends that
      // undercharged (gloves free) would keep the wrong total.
      parseExtrasFromPerk(o.perk),
    );
    const qty = Math.max(1, Math.round(toFiniteNumber(line.qty, 1)));
    const total = Math.round(toFiniteNumber(result.totalRub, 0)) * qty;
    return Number.isFinite(total) && total >= 0 ? total : null;
  } catch {
    return null;
  }
}

/**
 * Sanitize + heal an order payload IN PLACE. `byId` maps itemId → car row
 * (id, type, specs) — pass the same map the doc builder already loads.
 */
export function sanitizeFranchizeOrderMoneyFields(
  payload: SanitizeOrderPayload,
  byId: Map<string, SanitizeCar>,
  warn?: (message: string, meta?: Record<string, unknown>) => void,
): SanitizeResult {
  const log = warn ?? (() => {});
  let healedLines = 0;

  for (const line of payload.cartLines ?? []) {
    if (!line) continue;
    const clientTotal = toFiniteNumber(line.lineTotal, 0);
    const car = byId.get(line.itemId);

    const recomputed = recomputeRentalLineTotal(line, car);
    if (recomputed !== null && Math.abs(recomputed - clientTotal) > 1) {
      log("[franchize] order line total healed by server recompute (string-sum / stale frontend)", {
        orderId: payload.orderId,
        itemId: line.itemId,
        clientTotal,
        recomputed,
      });
      line.lineTotal = recomputed;
      healedLines++;
    } else {
      line.lineTotal = clientTotal;
    }
    line.pricePerDay = toFiniteNumber(line.pricePerDay, 0);

    // priceBreakdown: keep ONLY when every money field is a real number.
    // Old frontends sent totalRub as the concatenated string "100002000" —
    // dropping it makes the contract builder recompute from specs.
    const pb = line.priceBreakdown;
    if (pb) {
      const numeric =
        typeof pb.totalRub === "number" && Number.isFinite(pb.totalRub) &&
        typeof pb.basePriceRub === "number" && Number.isFinite(pb.basePriceRub) &&
        typeof pb.helmetRub === "number" && Number.isFinite(pb.helmetRub) &&
        typeof pb.depositRub === "number" && Number.isFinite(pb.depositRub);
      if (numeric) {
        pb.totalRub = toFiniteNumber(pb.totalRub, 0);
        pb.basePriceRub = toFiniteNumber(pb.basePriceRub, 0);
        pb.helmetRub = toFiniteNumber(pb.helmetRub, 0);
        pb.depositRub = toFiniteNumber(pb.depositRub, 0);
      } else {
        log("[franchize] dropped non-numeric priceBreakdown (string-sum payload)", {
          orderId: payload.orderId,
          itemId: line.itemId,
          totalRubType: typeof pb.totalRub,
        });
        delete line.priceBreakdown;
      }
    }
  }

  for (const extra of payload.extras ?? []) {
    if (extra) extra.amount = toFiniteNumber(extra.amount, 0);
  }

  // Derived totals — mirror of the order page formula:
  //   subtotal = Σ lineTotal; extrasTotal = Σ extras;
  //   totalAmount = max(0, subtotal + extrasTotal − promoDiscount)
  const subtotal = (payload.cartLines ?? []).reduce(
    (sum, line) => sum + (line ? toFiniteNumber(line.lineTotal, 0) : 0),
    0,
  );
  const extrasTotal = (payload.extras ?? []).reduce(
    (sum, extra) => sum + (extra ? toFiniteNumber(extra.amount, 0) : 0),
    0,
  );
  const promoDiscount = Math.max(0, toFiniteNumber(payload.promoDiscount, 0));
  const totalAmount = Math.max(0, subtotal + extrasTotal - promoDiscount);

  let totalsRewritten = false;
  if (Math.abs(toFiniteNumber(payload.subtotal, 0) - subtotal) > 1) totalsRewritten = true;
  if (Math.abs(toFiniteNumber(payload.extrasTotal, 0) - extrasTotal) > 1) totalsRewritten = true;
  if (Math.abs(toFiniteNumber(payload.totalAmount, 0) - totalAmount) > 1) totalsRewritten = true;
  if (totalsRewritten) {
    log("[franchize] order totals rewritten from sanitized lines", {
      orderId: payload.orderId,
      clientSubtotal: payload.subtotal,
      clientExtrasTotal: payload.extrasTotal,
      clientTotalAmount: payload.totalAmount,
      subtotal,
      extrasTotal,
      totalAmount,
    });
  }
  payload.subtotal = subtotal;
  payload.extrasTotal = extrasTotal;
  payload.totalAmount = totalAmount;

  return { healedLines, totalsRewritten };
}
