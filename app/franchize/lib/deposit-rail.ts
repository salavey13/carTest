// app/franchize/lib/deposit-rail.ts
// ── Deposit rail (залог) — boss 2026-09-29 ──────────────────────────────────
// The SECURITY deposit (returned after the ride) is a separate money event
// from the rent and may be collected on a different rail. Gold reference:
// the bot /doc flow's deposit_destination step (doc-manual.ts) — «Где получен
// депозит?» with cash / Tinkoff / Sber / split options.
//
// The web flow previously hard-coded "deposit always rides the cash part"
// for card/sbp rents and never showed the amount at checkout. These pure
// helpers implement the corrected model; they are intentionally framework-
// free so the split matrix is unit-testable (tests/franchize/deposit-rail.spec.ts).

export type DepositRail = "cash" | "card" | "sbp";

/** Rails the UI offers explicitly (plus "same" = follow the main payment). */
export type DepositChoice = DepositRail | "same";

/**
 * Resolve the deposit rail from the renter's choice.
 *  - explicit choice wins ("same" → the main payment rail),
 *  - absent (old clients) → default "same as rent",
 *  - XTR (telegram stars) can't hold a physical deposit → cash.
 */
export function resolveDepositRail(
  choice: DepositChoice | null | undefined,
  mainPayment: string,
): DepositRail {
  if (choice && choice !== "same") return choice;
  if (mainPayment === "cash" || mainPayment === "card" || mainPayment === "sbp") return mainPayment;
  return "cash";
}

/** Minimal structural view of a cart line — keeps the helper importable from
 *  both the client component and server runtime without React/DB types. */
export interface DepositLineLike {
  qty: number;
  flowType: string;
  item?: {
    type?: string;
    rawSpecs?: Record<string, unknown>;
  } | null;
  priceBreakdown?: {
    depositRub: number;
  } | null;
  options?: {
    action?: string;
    duration?: string;
  } | null;
}

/** Testdrive markers mirror useFranchizeCartLines — a testdrive is a FREE
 *  10-minute ride with NO deposit (the bot /testdrive reference), but the
 *  cart VM labels it flowType:"rental" with a real bike item, so without
 *  this guard a [testdrive + rental] cart would double-count the deposit. */
function isTestdriveLine(line: DepositLineLike): boolean {
  return line.options?.action === "testdrive" || line.options?.duration === "10 минут";
}

/**
 * Expected SECURITY deposit for an order, summed over bike lines.
 *  - sale / testdrive lines carry no deposit,
 *  - equipment lines carry no deposit (parity with the server's
 *    isEquipmentOnlyLine → no deposit_amount written),
 *  - amount mirrors the Item modal's «Залог: N ₽»: price calculator's
 *    specs.deposit_rub when it has run, else the raw spec parsed
 *    defensively ("20 000 ₽" strings included),
 *  - qty multiplies (two bikes = two deposits left physically).
 * Returns 0 when the order has no deposit-bearing lines at all.
 */
export function expectedSecurityDepositFromLines(
  lines: DepositLineLike[],
  flowType: string,
): number {
  if (flowType !== "rental" && flowType !== "mixed") return 0;
  return lines.reduce((sum, line) => {
    if (line.flowType !== "rental") return sum; // sale lines carry no deposit
    if (isTestdriveLine(line)) return sum; // testdrives are deposit-free
    if (line.item?.type === "equipment") return sum; // gear is deposit-free
    if (line.priceBreakdown) return sum + line.priceBreakdown.depositRub * line.qty;
    const parsed = Number(
      String(line.item?.rawSpecs?.deposit_rub ?? "").replace(/[^\d]/g, ""),
    );
    return sum + (Number.isFinite(parsed) && parsed > 0 ? parsed * line.qty : 0);
  }, 0);
}

/**
 * Payment split for the rental row — the SAME shape /doc writes
 * ({bank, cash, card_destination}) so getPaymentSplit / analytics closure
 * views keep working for both creation paths.
 *
 * The deposit lands in the part matching its rail; the rent follows the main
 * payment. Destination hints: the crew's T-Bank card (card) / «СБП» (sbp).
 */
export function buildWebOrderPaymentSplit(input: {
  mainPayment: string;
  depositRail: DepositRail;
  lineTotal: number;
  depositRub: number | null;
}): { bank: number; cash: number; card_destination: string | null } {
  const dep = input.depositRub ?? 0;
  const rentInCash = input.mainPayment === "cash";
  const depositInCash = input.depositRail === "cash";
  return {
    bank: (rentInCash ? 0 : input.lineTotal) + (depositInCash ? 0 : dep),
    cash: (rentInCash ? input.lineTotal : 0) + (depositInCash ? dep : 0),
    // Destination hint for the analytics sheet (getPaymentSplit renders it
    // raw): the crew's T-Bank card for card rents, «СБП» for СБП rents.
    card_destination: input.mainPayment === "card" ? "tbank" : input.mainPayment === "sbp" ? "sbp" : null,
  };
}

/**
 * metadata.deposit_method label — keeps the destination flavour that
 * DEPOSIT_METHOD_LABELS (analytics-utils) renders: cash / tbank / sbp.
 */
export function depositMethodMetadataLabel(rail: DepositRail): "cash" | "tbank" | "sbp" {
  return rail === "cash" ? "cash" : rail === "sbp" ? "sbp" : "tbank";
}

/**
 * rentals.deposit_method TABLE value — the 20260726000001 CHECK constraint
 * allows only cash | bank_transfer | telegram_stars | none, so any non-cash
 * rail maps to bank_transfer (same mapping as /doc via normalizeDepositMethod).
 */
export function depositMethodColumnValue(rail: DepositRail): "cash" | "bank_transfer" {
  return rail === "cash" ? "cash" : "bank_transfer";
}
