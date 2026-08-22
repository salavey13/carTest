import type { CatalogItemVM } from "../../app/franchize/actions";
import {
  buildVipBikeRentalCatalog,
  parseVipBikeRentalSegment,
} from "../../lib/vip-bike-rental-catalog";

function item(
  id: string,
  overrides: Partial<CatalogItemVM> = {},
): CatalogItemVM {
  return {
    id,
    title: `${id} title`,
    subtitle: "Old subtitle",
    description: "Old description with a bad deposit",
    imageUrl: "/bike.jpg",
    mediaUrls: ["/bike.jpg"],
    pricePerDay: 12_000,
    rentPriceLabel: "12 000 ₽",
    category: "Old",
    availabilityStatus: "available",
    availabilityLabel: "Доступен",
    isHot: false,
    saleAvailable: true,
    salePrice: 1,
    specs: [
      { label: "Мощность", value: "8 кВт" },
      { label: "Залог", value: "20 000 ₽" },
    ],
    rawSpecs: {
      rent: 1,
      sale: false,
      type: "Electric",
      dailyPrice: 12_000,
      rent_weekday: 12_000,
      rent_weekend: 15_000,
      deposit_rub: 20_000,
      price_per_hour: 1_000,
      rent_2_4d: 8_000,
    },
    reviewSummary: { average: 0, count: 0, reviews: [] },
    ...overrides,
  };
}

describe("VIP BIKE rental catalog (no allowlist — DB-driven)", () => {
  test("normalizes electric bike and strips unconfirmed pricing", () => {
    const [bike] = buildVipBikeRentalCatalog([item("falcon-gt-2026")]);

    // pricePerDay comes from item.pricePerDay (cars.daily_price)
    // Note: ru-RU locale uses \u00A0 (non-breaking space) as thousands separator
    const rub = (n: number) => n.toLocaleString("ru-RU");
    expect(bike.pricePerDay).toBe(12_000);
    expect(bike.rentPriceLabel).toBe(`${rub(12_000)} ₽/сутки`);
    expect(bike.saleAvailable).toBe(false);
    expect(bike.salePrice).toBeNull();
    expect(bike.category).toBe("Электромотоциклы");
    expect(bike.rawSpecs).toMatchObject({
      vipBikeRentalCanonical: true,
      vipBikeRentalSegment: "electric",
    });
    // Deposit/delivery fields should be stripped from rawSpecs — they're
    // internal-only. But pricing tiers (price_per_hour, rent_2_4d, etc.)
    // are NOW KEPT so the modal calculator can show correct prices.
    // (Previously stripped — caused Bug 1 + Bug 2 per v0.5 fix.)
    expect(bike.rawSpecs).not.toHaveProperty("deposit_rub");
    expect(bike.rawSpecs).toHaveProperty("price_per_hour");
    expect(bike.rawSpecs).toHaveProperty("rent_2_4d");
    expect(bike.rawSpecs).toHaveProperty("rent_weekend");
    // Private spec labels (deposit, hourly, etc.) should be stripped from specs list
    expect(bike.specs.some((spec) => /залог/i.test(spec.label))).toBe(false);
    // Should have "Аренда" + "Выходной день" spec rows added
    expect(bike.specs.some((spec) => spec.label === "Аренда")).toBe(true);
    expect(bike.specs.some((spec) => spec.label === "Выходной день")).toBe(true);
  });

  test("keeps weekend tariff from specs.rent_weekend", () => {
    const [yvolt] = buildVipBikeRentalCatalog([item("y-volt-surge-v")]);
    expect(yvolt.pricePerDay).toBe(12_000);
    // rent_weekend is in the strip list (because it's a "private" tariff),
    // but normalizeRentalItem re-adds it from the original rawSpecs before
    // stripping — so the public landing shows it via the "Выходной день" spec.
    expect(yvolt.rawSpecs?.rent_weekend).toBe(15_000);
  });

  test("filters by propulsion segment (electric vs petrol)", () => {
    // Build 4 bikes: 2 electric, 2 petrol
    const bikes = [
      item("falcon-gt-2026", { rawSpecs: { type: "Electric" } }),
      item("y-volt-surge-v", { rawSpecs: { type: "Electric" } }),
      item("yamaha-r7", { rawSpecs: { type: "Gas" } }),
      item("kawasaki-ex650k", { rawSpecs: { type: "ICE" } }),
    ];

    const petrolOnly = buildVipBikeRentalCatalog(bikes, "petrol");
    expect(petrolOnly.map((b) => b.id)).toEqual(["yamaha-r7", "kawasaki-ex650k"]);

    const electricOnly = buildVipBikeRentalCatalog(bikes, "electric");
    expect(electricOnly.map((b) => b.id)).toEqual(["falcon-gt-2026", "y-volt-surge-v"]);

    // No segment filter — all 4 pass through
    const allBikes = buildVipBikeRentalCatalog(bikes);
    expect(allBikes.length).toBe(4);
  });

  test("defaults to petrol when specs.type is missing", () => {
    const bike = item("mystery-bike", { rawSpecs: {} });
    const [result] = buildVipBikeRentalCatalog([bike]);
    expect(result.rawSpecs?.vipBikeRentalSegment).toBe("petrol");
    expect(result.category).toBe("Бензиновые мотоциклы");
  });

  test("accepts only explicit paid landing segments", () => {
    expect(parseVipBikeRentalSegment("electric")).toBe("electric");
    expect(parseVipBikeRentalSegment("petrol")).toBe("petrol");
    expect(parseVipBikeRentalSegment("gas")).toBeNull();
    expect(parseVipBikeRentalSegment(null)).toBeNull();
  });

  test("does NOT filter by allowlist membership (DB is source of truth)", () => {
    // A bike with an unknown id should still pass through — the only filter
    // is `specs.hidden`, which happens server-side. Previously the allowlist
    // would have dropped these.
    const unknownBike = item("never-seen-before-bike");
    const [result] = buildVipBikeRentalCatalog([unknownBike]);
    expect(result.id).toBe("never-seen-before-bike");
    expect(result.rawSpecs?.vipBikeRentalCanonical).toBe(true);
  });
});
