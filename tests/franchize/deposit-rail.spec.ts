// tests/franchize/deposit-rail.spec.ts
// ── Deposit rail (залог) — boss 2026-09-29 ──────────────────────────────────
// Unit matrix for lib/deposit-rail.ts: rail resolution, the security-deposit
// summation over cart lines, the /doc-shaped payment split, and both
// deposit_method mappings (metadata label + CHECK-constrained table column).
// Wiring assertions (OrderPageClient UI + actions-runtime insertion) live in
// deposit-rail-wiring.spec.ts per the repo's source-assertion convention.
import { describe, expect, it } from "vitest";
import {
  buildWebOrderPaymentSplit,
  depositMethodColumnValue,
  depositMethodMetadataLabel,
  expectedSecurityDepositFromLines,
  resolveDepositRail,
  type DepositLineLike,
} from "../../app/franchize/lib/deposit-rail";
import { getDepositInfo } from "../../app/franchize/[slug]/rentals-analytics/components/lib/analytics-utils";

describe("resolveDepositRail", () => {
  it("explicit renter choice wins over the main payment", () => {
    expect(resolveDepositRail("cash", "card")).toBe("cash");
    expect(resolveDepositRail("card", "cash")).toBe("card");
    expect(resolveDepositRail("sbp", "cash")).toBe("sbp");
  });

  it('"same" follows the main payment rail', () => {
    expect(resolveDepositRail("same", "cash")).toBe("cash");
    expect(resolveDepositRail("same", "card")).toBe("card");
    expect(resolveDepositRail("same", "sbp")).toBe("sbp");
  });

  it("absent choice (old clients) defaults to same-as-rent", () => {
    expect(resolveDepositRail(undefined, "cash")).toBe("cash");
    expect(resolveDepositRail(null, "card")).toBe("card");
    expect(resolveDepositRail(undefined, "sbp")).toBe("sbp");
  });

  it("XTR (telegram stars) can't hold a deposit → cash", () => {
    expect(resolveDepositRail(undefined, "telegram_xtr")).toBe("cash");
    expect(resolveDepositRail("same", "telegram_xtr")).toBe("cash");
  });

  it("cross-rail pairs: explicit choice differs from the main payment", () => {
    expect(resolveDepositRail("card", "sbp")).toBe("card");
    expect(resolveDepositRail("sbp", "card")).toBe("sbp");
    expect(resolveDepositRail("cash", "card")).toBe("cash");
  });
});

describe("expectedSecurityDepositFromLines", () => {
  const bikeLine = (over: Partial<DepositLineLike> = {}): DepositLineLike => ({
    qty: 1,
    flowType: "rental",
    item: { type: "bike", rawSpecs: { deposit_rub: "20 000 ₽" } },
    priceBreakdown: { depositRub: 20000 },
    ...over,
  });

  it("sums the calculator deposit over bike lines (qty multiplies)", () => {
    expect(expectedSecurityDepositFromLines([bikeLine(), bikeLine({ qty: 2 })], "rental")).toBe(60000);
  });

  it("falls back to rawSpecs.deposit_rub when the calculator hasn't run", () => {
    expect(
      expectedSecurityDepositFromLines([bikeLine({ priceBreakdown: null })], "rental"),
    ).toBe(20000);
  });

  it("testdrive lines are deposit-free even in a mixed rental cart (reviewer R1)", () => {
    // cart VM labels a testdrive flowType:"rental" with a real bike item and
    // NO priceBreakdown — without the guard its specs deposit double-counts
    const testdriveLine: DepositLineLike = {
      qty: 1,
      flowType: "rental",
      item: { type: "bike", rawSpecs: { deposit_rub: "20 000 ₽" } },
      priceBreakdown: null,
      options: { action: "testdrive", duration: "10 минут" },
    };
    expect(
      expectedSecurityDepositFromLines([testdriveLine, bikeLine()], "rental"),
    ).toBe(20000);
    expect(expectedSecurityDepositFromLines([testdriveLine], "rental")).toBe(0);
  });

  it("equipment lines are deposit-free (parity with server isEquipmentOnlyLine)", () => {
    expect(
      expectedSecurityDepositFromLines([bikeLine({ item: { type: "equipment" } })], "rental"),
    ).toBe(0);
  });

  it("sale lines carry no deposit even when the item has deposit specs", () => {
    expect(expectedSecurityDepositFromLines([bikeLine({ flowType: "sale" })], "mixed")).toBe(0);
  });

  it("non-rental flows (sale/testdrive/service/storage) have no deposit", () => {
    expect(expectedSecurityDepositFromLines([bikeLine()], "sale")).toBe(0);
    expect(expectedSecurityDepositFromLines([bikeLine()], "testdrive")).toBe(0);
    expect(expectedSecurityDepositFromLines([bikeLine()], "service")).toBe(0);
    expect(expectedSecurityDepositFromLines([bikeLine()], "storage")).toBe(0);
  });

  it("parses hostile string specs defensively and ignores garbage", () => {
    expect(
      expectedSecurityDepositFromLines(
        [bikeLine({ priceBreakdown: null, item: { rawSpecs: { deposit_rub: "15000" } } })],
        "rental",
      ),
    ).toBe(15000);
    expect(
      expectedSecurityDepositFromLines(
        [bikeLine({ priceBreakdown: null, item: { rawSpecs: { deposit_rub: "не указан" } } })],
        "rental",
      ),
    ).toBe(0);
    expect(expectedSecurityDepositFromLines([bikeLine({ priceBreakdown: null, item: null })], "rental")).toBe(0);
  });
});

describe("buildWebOrderPaymentSplit (doc-manual shape {bank, cash, card_destination})", () => {
  it("cash rent + cash deposit → everything in the cash part", () => {
    expect(
      buildWebOrderPaymentSplit({ mainPayment: "cash", depositRail: "cash", lineTotal: 12000, depositRub: 20000 }),
    ).toEqual({ bank: 0, cash: 32000, card_destination: null });
  });

  it("card rent + cash deposit (old web behaviour) → rent in bank, deposit in cash", () => {
    expect(
      buildWebOrderPaymentSplit({ mainPayment: "card", depositRail: "cash", lineTotal: 12000, depositRub: 20000 }),
    ).toEqual({ bank: 12000, cash: 20000, card_destination: "tbank" });
  });

  it("card rent + card deposit → rent AND deposit ride the bank part", () => {
    expect(
      buildWebOrderPaymentSplit({ mainPayment: "card", depositRail: "card", lineTotal: 12000, depositRub: 20000 }),
    ).toEqual({ bank: 32000, cash: 0, card_destination: "tbank" });
  });

  it("cash rent + card deposit → rent in cash, deposit in bank", () => {
    expect(
      buildWebOrderPaymentSplit({ mainPayment: "cash", depositRail: "card", lineTotal: 12000, depositRub: 20000 }),
    ).toEqual({ bank: 20000, cash: 12000, card_destination: null });
  });

  it("no deposit on the bike → split carries the rent only", () => {
    expect(
      buildWebOrderPaymentSplit({ mainPayment: "card", depositRail: "card", lineTotal: 12000, depositRub: null }),
    ).toEqual({ bank: 12000, cash: 0, card_destination: "tbank" });
  });

  it("sbp rent routes the rent through bank with an sbp destination hint", () => {
    expect(
      buildWebOrderPaymentSplit({ mainPayment: "sbp", depositRail: "cash", lineTotal: 5000, depositRub: 0 }),
    ).toEqual({ bank: 5000, cash: 0, card_destination: "sbp" });
  });

  it("sbp rent + card deposit → rent AND deposit in bank (reviewer R1 matrix gap)", () => {
    expect(
      buildWebOrderPaymentSplit({ mainPayment: "sbp", depositRail: "card", lineTotal: 5000, depositRub: 20000 }),
    ).toEqual({ bank: 25000, cash: 0, card_destination: "sbp" });
  });

  it("PROPERTY: bank + cash always equals rent + deposit across the full matrix", () => {
    for (const mainPayment of ["cash", "card", "sbp", "telegram_xtr"]) {
      for (const depositRail of ["cash", "card", "sbp"] as const) {
        const split = buildWebOrderPaymentSplit({ mainPayment, depositRail, lineTotal: 12000, depositRub: 20000 });
        expect(split.bank + split.cash).toBe(32000);
        expect(split.bank).toBeGreaterThanOrEqual(0);
        expect(split.cash).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("deposit_method mappings", () => {
  it("metadata label keeps the destination flavour (analytics DEPOSIT_METHOD_LABELS)", () => {
    expect(depositMethodMetadataLabel("cash")).toBe("cash");
    expect(depositMethodMetadataLabel("card")).toBe("tbank");
    expect(depositMethodMetadataLabel("sbp")).toBe("sbp");
  });

  it("table column honours the CHECK constraint (cash|bank_transfer|telegram_stars|none)", () => {
    expect(depositMethodColumnValue("cash")).toBe("cash");
    expect(depositMethodColumnValue("card")).toBe("bank_transfer");
    expect(depositMethodColumnValue("sbp")).toBe("bank_transfer");
  });
});

describe("getDepositInfo regression (analytics sheet, old vs new rows)", () => {
  // reviewer R1 missing-test #6: the iter20 backfill must keep rendering the
  // OLD web rows (deposit rides the cash part, no explicit method) as
  // «наличные», and must NOT misfire on the NEW rows that carry an explicit
  // deposit_method (e.g. «Картой» deposit → split.cash === 0).
  const AnalyticsRentalRowStub = (metadata: Record<string, unknown>) =>
    ({ metadata, contract: null }) as unknown as Parameters<typeof getDepositInfo>[0];

  it("old-shape row (deposit in cash part, no deposit_method) backfills «наличные»", () => {
    const info = getDepositInfo(
      AnalyticsRentalRowStub({
        deposit_amount: 20000,
        payment_split: { bank: 12000, cash: 20000, card_destination: "tbank" },
      }),
    );
    expect(info.amount).toBe(20000);
    expect(info.method).toBe("cash");
    expect(info.methodLabel).toBe("наличные");
  });

  it("new-shape row (deposit_method=tbank, split.cash=0) keeps the explicit rail", () => {
    const info = getDepositInfo(
      AnalyticsRentalRowStub({
        deposit_amount: 20000,
        deposit_method: "tbank",
        payment_split: { bank: 32000, cash: 0, card_destination: "tbank" },
      }),
    );
    expect(info.amount).toBe(20000);
    expect(info.method).toBe("tbank");
    expect(info.methodLabel).toBe("Т-Банк карта");
  });

  it("new-shape sbp deposit renders «СБП»", () => {
    const info = getDepositInfo(
      AnalyticsRentalRowStub({
        deposit_amount: 20000,
        deposit_method: "sbp",
        payment_split: { bank: 32000, cash: 0, card_destination: "sbp" },
      }),
    );
    expect(info.method).toBe("sbp");
    expect(info.methodLabel).toBe("СБП");
  });
});
