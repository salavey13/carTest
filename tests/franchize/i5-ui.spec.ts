// tests/franchize/i5-ui.spec.ts
//
// I5 — equipment domain unit tests.
// Replaced 2026-09-10: the previous placeholders (`expect(true).toBe(true)`)
// gave false coverage confidence. These specs pin the shared equipment
// helpers used by bot /ekip, the web catalog checkout and the server actions
// (app/franchize/lib/equipment-shared.ts) — the exact invariants the
// equipment-parity work depends on.

import { describe, expect, it } from "vitest";

import {
  itemDailyPrice,
  itemSalePrice,
  itemSize,
  sumDailyPrices,
  sumSalePrices,
  equipmentTitle,
  apportionTotal,
  rentDaysBetween,
  parseRuDateTime,
  normalizePaymentMethod,
  normalizeDepositMethod,
  legacyStatusToUnified,
  unifiedToLegacyStatus,
  conditionToUnifiedStatus,
  conditionToEquipmentCondition,
  normalizeMaterialKey,
  pickCrewEquipmentByCategory,
  EQUIPMENT_FLAG_TO_CATEGORY,
} from "@/app/franchize/lib/equipment-shared";

const helmet = {
  id: "equip-helmet-street-pro-vip-bike",
  make: "MT",
  model: "Street Pro",
  daily_price: 1000,
  specs: { category: "helmet", sizes: ["S", "M", "L", "XL"] },
};
const jacket = {
  id: "equip-jacket-trail-guard-vip-bike",
  make: "MT",
  model: "Trail Guard",
  daily_price: 500,
  specs: { category: "jacket", size: "L", materials: "Полиэстер 600D" },
};
const noPriceItem = { id: "equip-x", make: "X", model: "Y", specs: {} };

describe("equipment-shared pricing", () => {
  it("cars.daily_price wins over specs copy and the 1000₽ fallback", () => {
    expect(itemDailyPrice(helmet)).toBe(1000);
    // seeded 500₽ items used to be quoted at the fallback — regression guard
    expect(itemDailyPrice(jacket)).toBe(500);
    expect(itemDailyPrice(noPriceItem)).toBe(1000);
  });

  it("specs.daily_price is used when the column is missing", () => {
    expect(itemDailyPrice({ id: "a", make: "A", model: "B", specs: { daily_price: 700 } })).toBe(700);
    expect(itemDailyPrice({ id: "a", make: "A", model: "B", specs: { rent_weekday: 650 } })).toBe(650);
  });

  it("sale price + size resolution", () => {
    expect(itemSalePrice({ id: "a", make: "A", model: "B", specs: { sale_price: 7900 } })).toBe(7900);
    expect(itemSalePrice(noPriceItem)).toBe(5000);
    expect(itemSize(helmet)).toBe("S"); // first of sizes[]
    expect(itemSize(jacket)).toBe("L"); // singular size wins
    expect(itemSize(noPriceItem)).toBeNull();
  });

  it("sums catalog-aware prices", () => {
    expect(sumDailyPrices([helmet, jacket])).toBe(1500);
    expect(sumSalePrices([helmet, jacket])).toBe(10000); // 5000 fallback × 2
  });

  it("equipmentTitle joins multi-select", () => {
    expect(equipmentTitle([])).toBe("");
    expect(equipmentTitle([helmet])).toBe("MT Street Pro");
    expect(equipmentTitle([helmet, jacket])).toBe("MT Street Pro, MT Trail Guard");
  });
});

describe("equipment-shared duration + apportionment", () => {
  it("rentDaysBetween: hours→days ceiling, min 1 day", () => {
    const s = parseRuDateTime("10.06.2026", "10:00");
    const sameDay = parseRuDateTime("10.06.2026", "18:00");
    const nextDay = parseRuDateTime("11.06.2026", "10:00");
    const twoDaysLater = parseRuDateTime("12.06.2026", "10:30");

    expect(rentDaysBetween(s, sameDay).days).toBe(1); // 8h — minimum 1 day
    expect(rentDaysBetween(s, nextDay)).toEqual({ hours: 24, days: 1 });
    expect(rentDaysBetween(s, twoDaysLater).days).toBe(3); // 48.5h → ceil 3
  });

  it("apportionTotal splits by daily price and preserves the exact total", () => {
    const items = [helmet, jacket]; // 1000 + 500
    expect(apportionTotal(3000, items)).toEqual([2000, 1000]);
    expect(apportionTotal(1000, items)).toEqual([666, 334]); // remainder on last
    // invariant: parts always sum to total
    for (const total of [0, 1, 999, 4999, 15000]) {
      const parts = apportionTotal(total, items);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    }
    expect(apportionTotal(500, [])).toEqual([]);
    expect(apportionTotal(777, [noPriceItem])).toEqual([777]);
  });
});

describe("equipment-shared payment/status normalization", () => {
  it("bot card destinations normalize to the cash_transactions CHECK domain", () => {
    expect(normalizePaymentMethod("cash")).toBe("cash");
    expect(normalizePaymentMethod("tbank")).toBe("card");
    expect(normalizePaymentMethod("sber")).toBe("card");
    expect(normalizePaymentMethod(null)).toBe("cash");
  });

  it("rentals.deposit_method CHECK domain (cash|bank_transfer)", () => {
    expect(normalizeDepositMethod("cash")).toBe("cash");
    expect(normalizeDepositMethod("tbank")).toBe("bank_transfer");
    expect(normalizeDepositMethod(undefined)).toBe("cash");
  });

  it("legacy equipment status ↔ unified rentals pipeline mapping", () => {
    expect(legacyStatusToUnified("active")).toBe("active");
    expect(legacyStatusToUnified("overdue")).toBe("active");
    expect(legacyStatusToUnified("returned")).toBe("completed");
    expect(legacyStatusToUnified("damaged")).toBe("disputed");
    expect(legacyStatusToUnified("lost")).toBe("disputed");

    expect(unifiedToLegacyStatus("active")).toBe("active");
    expect(unifiedToLegacyStatus("completed")).toBe("returned");
    expect(unifiedToLegacyStatus("disputed", "Утерян")).toBe("lost");
    expect(unifiedToLegacyStatus("disputed", "Есть повреждения")).toBe("damaged");
  });

  it("return condition → unified status + metadata vocabulary", () => {
    expect(conditionToUnifiedStatus("returned")).toBe("completed");
    expect(conditionToUnifiedStatus("damaged")).toBe("disputed");
    expect(conditionToUnifiedStatus("lost")).toBe("disputed");
    expect(conditionToEquipmentCondition("returned")).toBe("Норм");
    expect(conditionToEquipmentCondition("damaged")).toBe("Есть повреждения");
    expect(conditionToEquipmentCondition("lost")).toBe("Утерян");
  });
});

describe("equipment-shared materials + per-crew category resolution", () => {
  it("normalizes Russian materials to callback-safe keys", () => {
    expect(normalizeMaterialKey("Кожа")).toBe("leather");
    expect(normalizeMaterialKey("Текстиль")).toBe("textile");
    expect(normalizeMaterialKey("Кожа + текстиль")).toBe("combo");
    expect(normalizeMaterialKey("Полиэстер 600D")).toBe("textile");
    expect(normalizeMaterialKey(undefined)).toBe("other");
  });

  it("resolves a REAL crew catalog item by category (replaces phantom EQUIPMENT_FLAG_TO_CAR_ID)", () => {
    const catalog = [
      helmet,
      { id: "equip-helmet-gx-vip-bike", make: "Arai", model: "GX", daily_price: 3000, specs: { category: "helmet" } },
      jacket,
    ];
    const picked = pickCrewEquipmentByCategory(catalog, "helmet");
    expect(picked?.id).toBe("equip-helmet-gx-vip-bike"); // deterministic: alphabetical first (Arai < MT)
    expect(pickCrewEquipmentByCategory(catalog, "boots")).toBeNull();
    expect(pickCrewEquipmentByCategory([], "helmet")).toBeNull();
  });

  it("doc flags map onto specs.category keys", () => {
    expect(EQUIPMENT_FLAG_TO_CATEGORY.helmets).toBe("helmet");
    expect(EQUIPMENT_FLAG_TO_CATEGORY.boots).toBe("boots");
    expect(Object.keys(EQUIPMENT_FLAG_TO_CATEGORY)).toEqual(
      expect.arrayContaining(["helmets", "gloves", "jacket", "pants", "boots"]),
    );
  });
});
