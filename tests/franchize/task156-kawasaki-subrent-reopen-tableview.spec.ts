// Task 156 — three boss fixes in one pass (voice note 2026-10-28):
//
//   1. Kawasaki EX650K (Ninja 650) is a SUBRENTED bike → operator commission
//      must resolve to partner_regular (500 ₽), not regular (1000 ₽).
//      Layers: SUBRENTED_BIKE_IDS gains kawasaki-ex650k (fallback list) +
//      cars.specs.salary carries the explicit partner_regular classification
//      (DB patch — explicit specs win over the list, so both layers must
//      agree).
//   2. VERIFIED сверки must stay editable: ⚠️ on a verified row REOPENS it
//      (stamps cleared → disputed → split editor → proposal → accept
//      re-verifies with corrected numbers), and the resend action now ALWAYS
//      attaches a keyboard (verified rows get the 🔁 reopen button).
//   3. Table view: «Комментарий» (имя + телефон + нал/банк одним текстом)
//      splits into Имя / Телефон / Способ оплаты; «Способ оплаты» sits right
//      after «Цена» so нал/банк reads next to the sum. 25 → 28 columns.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  applyVerificationAction,
  verificationKeyboard,
  verificationReopenKeyboard,
} from "../../app/franchize/lib/rental-verify-core";
import {
  computeRentalSalary,
  isSubrentedBike,
  OFFICIAL_SALARY_CONFIG,
  resolveCategoriesForBike,
  SUBRENTED_BIKE_IDS,
} from "../../lib/salary-coefficients-shared";
import { RENTALS_DISPLAY_ORDER } from "../../app/franchize/[slug]/rentals-analytics/components/lib/table-rails";

const src = (p: string) => readFileSync(p, "utf8");

// ── 1. Kawasaki = субаренда → 500 ₽ ─────────────────────────────────────────

describe("task156 · Kawasaki EX650K is a partner bike (500 ₽, not 1000 ₽)", () => {
  it("kawasaki-ex650k is in the subrented fallback list", () => {
    expect(SUBRENTED_BIKE_IDS).toContain("kawasaki-ex650k");
    expect(isSubrentedBike("kawasaki-ex650k")).toBe(true);
    // the legacy three stay
    for (const id of ["ducati-panigale-s-electro-black-aero", "yamaha-r7", "suzuki-gsx-s1000f"]) {
      expect(isSubrentedBike(id)).toBe(true);
    }
    expect(isSubrentedBike("horwin-ek3")).toBe(false);
  });

  it("specs.salary partner_regular wins (the DB shape the bike row now carries)", () => {
    const cats = resolveCategoriesForBike({
      bikeId: "kawasaki-ex650k",
      specs: {
        salary: {
          tier: "regular",
          subrented: true,
          rentalCategory: "partner_regular",
          saleCategory: "regular",
          dailyPriceAtSet: 10000,
          setAt: "2026-10-28T00:00:00.000Z",
        },
      },
      dailyPrice: 10000,
    });
    expect(cats.rental).toBe("partner_regular");
    expect(cats.subrented).toBe(true);
  });

  it("price-derived fallback also lands partner_regular for the 10 000 ₽ Kawasaki", () => {
    // no specs at all → the hardcoded list decides: subrented + regular price
    const cats = resolveCategoriesForBike({ bikeId: "kawasaki-ex650k", specs: null, dailyPrice: 10000 });
    expect(cats.rental).toBe("partner_regular");
  });

  it("the math: full day → 500 ₽ base, short (<24h) rental → 250 ₽", () => {
    const full = computeRentalSalary({
      config: OFFICIAL_SALARY_CONFIG,
      rentalCategory: "partner_regular",
      equipmentUnits: 0,
      totalCost: 10000,
      standardPrice: 10000,
      rentalHours: 24,
    });
    expect(full.base).toBe(500); // was 1000 as regular
    const short = computeRentalSalary({
      config: OFFICIAL_SALARY_CONFIG,
      rentalCategory: "partner_regular",
      equipmentUnits: 0,
      totalCost: 5000,
      standardPrice: 5000,
      rentalHours: 5,
    });
    expect(short.base).toBe(250); // task120 halving on top of partner rate
  });
});

// ── 2. Verified сверки stay editable (reopen) ────────────────────────────────

const verifiedRow = {
  rental_id: "r1",
  crew_id: "c1",
  crew_slug: "vip-bike",
  operator_chat_id: "111",
  owner_chat_id: "222",
  requested_by: "222",
  requested_at: "2026-10-02T11:00:00.000Z",
  status: "verified" as const,
  operator_confirmed_at: "2026-10-03T10:00:00.000Z",
  owner_confirmed_at: "2026-10-03T10:05:00.000Z",
  verified_at: "2026-10-03T10:05:00.000Z",
  disputed_by: null,
  dispute_reason: null,
  snapshot: {},
  source: "rental_close",
};

describe("task156 · ⚠️ reopens a VERIFIED сверку", () => {
  it("dispute on verified: stamps cleared, status disputed, reason recorded", () => {
    const res = applyVerificationAction(verifiedRow, {
      action: "dispute",
      chatId: "111",
      nowIso: "2026-10-28T12:00:00.000Z",
    });
    expect(res.effect).toBe("disputed");
    expect(res.actor).toBe("operator");
    expect(res.row?.status).toBe("disputed");
    expect(res.row?.operator_confirmed_at).toBeNull();
    expect(res.row?.owner_confirmed_at).toBeNull();
    expect(res.row?.verified_at).toBeNull();
    expect(res.row?.disputed_by).toBe("111");
    expect(res.row?.dispute_reason).toContain("переоткрыта");
  });

  it("confirm on verified is still a no-op with the honest error", () => {
    const res = applyVerificationAction(verifiedRow, {
      action: "confirm",
      chatId: "111",
      nowIso: "2026-10-28T12:00:00.000Z",
    });
    expect(res.row).toBeNull();
    expect(res.effect).toBe("noop");
    expect(res.error).toContain("Уже подтверждено");
  });

  it("after a reopen, a normal two-party confirm walk re-verifies honestly", () => {
    const reopened = applyVerificationAction(verifiedRow, {
      action: "dispute",
      chatId: "111",
      nowIso: "2026-10-28T12:00:00.000Z",
    }).row!;
    const opConfirm = applyVerificationAction(reopened, {
      action: "confirm",
      chatId: "111",
      nowIso: "2026-10-28T12:01:00.000Z",
    });
    expect(opConfirm.effect).toBe("wait_other_party");
    const ownerConfirm = applyVerificationAction(opConfirm.row!, {
      action: "confirm",
      chatId: "222",
      nowIso: "2026-10-28T12:02:00.000Z",
    });
    expect(ownerConfirm.effect).toBe("verified");
    expect(ownerConfirm.row?.verified_at).toBe("2026-10-28T12:02:00.000Z");
  });

  it("reopen keyboard: single 🔁 button routed to vrf_dis_ (the reopen callback)", () => {
    const kb = verificationReopenKeyboard("r1");
    expect(kb).toHaveLength(1);
    expect(kb[0]).toHaveLength(1);
    expect(kb[0][0].text).toContain("Переоткрыть");
    expect(kb[0][0].callback_data).toBe("vrf_dis_r1");
    // the classic keyboard keeps its pair
    expect(verificationKeyboard("r1")[0].map((b) => b.callback_data)).toEqual(["vrf_ok_r1", "vrf_dis_r1"]);
  });

  it("resend wiring: every status sends a keyboard — verified gets 🔁, the rest ✅/⚠️", () => {
    const actions = src("app/franchize/server-actions/rental-verify-actions.ts");
    expect(actions).toContain("row.status === \"verified\"");
    expect(actions).toContain("verificationReopenKeyboard(row.rental_id)");
    expect(actions).toContain("const withKeyboard = keyboard.length > 0;");
  });
});

// ── 3. Table view: Имя / Телефон / Способ оплаты ────────────────────────────

describe("task156 · table view columns (Способ оплаты рядом с Ценой)", () => {
  const builder = src("lib/csv-builders/rentals-csv.ts");
  const modal = src("app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx");

  it("АРЕНДЫ header: Способ оплаты right after Цена; Имя and Телефон are their own columns", () => {
    expect(builder).toContain(
      '"Дата", "ЗП Аренда", "Партнеру", "Цена", "Способ оплаты", "Экип", "Залог",',
    );
    expect(builder).toContain('"Время", "Имя", "Телефон", "Комментарий",');
  });

  it("«Комментарий» no longer carries the renter identity — Имя/Телефон/оплата moved out", () => {
    expect(builder).toContain("const comment = freeReason;");
    expect(builder).not.toContain("[renterName, renterPhone, paymentMethod, freeReason]");
    // the row emits the three cells in the header's order (price → method → … → имя → телефон)
    expect(builder).toContain("price, paymentMethod,");
    expect(builder).toContain("timeStr, renterName, renterPhone, comment,");
  });

  it("SECTION_COLS remapped to the 28-column layout", () => {
    expect(modal).toContain("numeric: new Set([1, 3, 5, 6, 8, 9]),");
    expect(modal).toContain("hide: new Set([17]),");
    expect(modal).toContain("notes: 14,");
    expect(modal).toContain("subrenter: 15,");
    expect(modal).toContain("photos: 16,");
    expect(modal).toContain("verification: 27,");
    expect(modal).toContain("opCol: 25,");
    expect(modal).toContain("idCol: 17,");
  });

  it("display order: 28 columns, permutation intact, rails at the edges", () => {
    expect(RENTALS_DISPLAY_ORDER).toHaveLength(28);
    expect([...RENTALS_DISPLAY_ORDER].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 28 }, (_, i) => i),
    );
    // Способ оплаты (4) displays right after Цена (3): position 4/5 hold 3/4
    const pos = (dataIdx: number) => RENTALS_DISPLAY_ORDER.indexOf(dataIdx);
    expect(pos(3) + 1).toBe(pos(4));
  });
});
