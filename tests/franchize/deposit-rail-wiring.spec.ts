// tests/franchize/deposit-rail-wiring.spec.ts
// ── Deposit rail (залог) — boss 2026-09-29 — wiring assertions ──────────────
// OrderPageClient + actions-runtime drag the whole server-action graph into
// any mount attempt, so (per repo convention, see iter17-suite /
// order-draft-wiring) the wiring is asserted on the SOURCE, while the pure
// split matrix is unit-tested in deposit-rail.spec.ts.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

const read = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");

describe("deposit UI wiring (OrderPageClient)", () => {
  const src = read("app/franchize/components/OrderPageClient.tsx");

  it("shows the SECURITY deposit amount at checkout (not the reservation hold)", () => {
    expect(src.includes("expectedSecurityDepositFromLines")).toBe(true);
    expect(src.includes("Залог: {expectedSecurityDeposit.toLocaleString(\"ru-RU\")} ₽")).toBe(true);
    // the aside summary shows the amount too
    expect(src.includes("{expectedSecurityDeposit.toLocaleString(\"ru-RU\")} ₽")).toBe(true);
    // explicit comment: these are DIFFERENT things
    expect(src.includes("NOT the reservation hold")).toBe(true);
  });

  it("offers the deposit rail selector defaulting to same-as-payment", () => {
    expect(src.includes('useState<"same" | "cash" | "card" | "sbp">("same")')).toBe(true);
    expect(src.includes("Как и оплата")).toBe(true);
    expect(src.includes("Наличными")).toBe(true);
    expect(src.includes("Картой")).toBe(true);
    // reviewer R1: СБП must be reachable for /doc parity + the resolved rail
    // must always be named next to the default marker
    expect(src.includes('id: "sbp" as const')).toBe(true);
    expect(src.includes("depositResolvedHint")).toBe(true);
    expect(src.includes("Сейчас: {depositResolvedHint}")).toBe(true);
  });

  it("explains that the deposit is returned and NOT part of the online total", () => {
    expect(src.includes("возвращается после аренды")).toBe(true);
    expect(src.includes("не входит в сумму «Итого»")).toBe(true);
  });

  it("persists the deposit choice in the crash-safe order draft (reviewer R1)", () => {
    const draftLib = read("app/franchize/lib/order-draft.ts");
    expect(draftLib.includes("depositMethodChoice")).toBe(true);
    expect(src.includes("if (draft.depositMethodChoice !== \"same\") setDepositMethodChoice(draft.depositMethodChoice);")).toBe(true);
    expect(src.includes("depositMethodChoice: depositChoiceRef.current,")).toBe(true);
    // full wipe resets the choice too
    expect(src.includes("setDepositMethodChoice(\"same\")")).toBe(true);
  });

  it("sends the resolved (never 'same') depositMethod in the checkout payload", () => {
    expect(src.includes("depositMethod: expectedSecurityDeposit > 0 ? resolvedDepositMethod : undefined,")).toBe(true);
    expect(src.includes("resolveDepositRail(")).toBe(true);
    expect(src.includes("depositMethod: submitPayload.depositMethod,")).toBe(true);
  });

  it("deposit rail participates in the duplicate-submit fingerprint", () => {
    const fpIdx = src.indexOf("const submitFingerprint = JSON.stringify({");
    const fpBody = src.slice(fpIdx, fpIdx + 400);
    expect(fpBody).toContain("depositMethod: resolvedDepositMethod");
  });

  it("deposit section is hidden for flows without a deposit", () => {
    expect(src.includes("{expectedSecurityDeposit > 0 && (")).toBe(true);
  });
});

describe("deposit server wiring (actions-runtime + schema)", () => {
  const src = read("app/franchize/actions-runtime.ts");

  it("checkout schema accepts the renter-chosen deposit rail", () => {
    expect(src.includes('depositMethod: z.enum(["cash", "card", "sbp"]).optional()')).toBe(true);
  });

  it("builds the split via the unit-tested helper (doc shape)", () => {
    expect(src.includes("buildWebOrderPaymentSplit({")).toBe(true);
    expect(src.includes("depositRail: resolvedDepositMethod,")).toBe(true);
  });

  it("old clients default to same-as-rent with XTR → cash (resolved once per order)", () => {
    // the rail is resolved ONCE before the doc loop and reused by row + contract
    expect((src.match(/resolveDepositRail\(payload\.depositMethod, payload\.payment\)/g) ?? []).length).toBe(1);
    expect(src.includes("const orderDepositRail = resolveDepositRail(payload.depositMethod, payload.payment);")).toBe(true);
    expect(src.indexOf("const orderDepositRail")).toBeLessThan(src.indexOf("buildWebOrderPaymentSplit({"));
  });

  it("row deposit falls back to the contract-printed default and multiplies qty (reviewer R1)", () => {
    expect(src.includes("WEB_ORDER_DEFAULT_BIKE_DEPOSIT_RUB")).toBe(true);
    expect(src.includes("return base * lineQty;")).toBe(true);
    // single source of truth: the defaults are exported by the contract vars
    const contractVars = read("app/lib/rental-contract-vars.ts");
    expect(contractVars.includes("export const WEB_ORDER_DEFAULT_BIKE_DEPOSIT_RUB")).toBe(true);
  });

  it("the signed contract uses the SAME rail + helper (no more contradiction)", () => {
    expect(src.includes("const contractSplit = buildWebOrderPaymentSplit({")).toBe(true);
    expect(src.includes("depositRail: orderDepositRail,")).toBe(true);
    expect(src.includes("const paymentSplit = { cashAmount: contractSplit.cash, bankAmount: contractSplit.bank };")).toBe(true);
  });

  it("the crew lead message carries the deposit amount + rail (reviewer R1)", () => {
    expect(src.includes("Залог: ${formatMoney(expectedOrderDeposit)")).toBe(true);
    expect(src.includes("expectedSecurityDepositFromLines(")).toBe(true);
  });

  it("qty≥2 lines: the CONTRACT prints + moves the qty-multiplied deposit (reviewer R2)", () => {
    expect(src.includes("const lineDeposit = depositNum * (line.qty || 1);")).toBe(true);
    expect(src.includes("depositRub: lineDeposit,")).toBe(true);
    expect(src.includes("deposit_rub: formatMoney(lineDeposit),")).toBe(true);
  });

  it("a testdrive line inside a rental cart gets NO rental row / phantom deposit (reviewer R2)", () => {
    // per-line flow marker (mirrors the cart VM) drives doc + row + artifact
    expect(src.includes('if (line.options?.action === "testdrive" || line.options?.duration === "10 минут") return "testdrive";')).toBe(true);
    expect(src.includes('if (bikeFlowType === "sale" || bikeFlowType === "testdrive") continue;')).toBe(true);
    expect(src.includes('bikeFlowTypes[doc.cartLineIndex] === "testdrive"')).toBe(true);
  });

  it("writes the deposit_method TABLE column from the CHECK-safe mapping", () => {
    expect(src.includes("deposit_method: depositMethodColumnValue")).toBe(true);
  });

  it("metadata keeps both the label and the raw renter choice", () => {
    expect(src.includes("deposit_method: expectedDepositMethod")).toBe(true);
    expect(src.includes("deposit_method_choice: resolvedDepositMethod")).toBe(true);
  });
});

describe("deposit data contracts", () => {
  it("rentals.deposit_method CHECK allows only cash|bank_transfer|telegram_stars|none", () => {
    const migration = read("supabase/migrations/20260726000001_deposit_and_shift_tracking.sql");
    expect(migration).toContain("CHECK (deposit_method IS NULL OR deposit_method IN ('cash', 'bank_transfer', 'telegram_stars', 'none'))");
  });

  it("analytics renders the СБП deposit label", () => {
    const analytics = read("app/franchize/[slug]/rentals-analytics/components/lib/analytics-utils.ts");
    expect(analytics.includes('sbp: "СБП"')).toBe(true);
  });
});
