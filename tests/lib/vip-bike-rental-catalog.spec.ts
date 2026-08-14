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
    title: "Old title",
    subtitle: "Old subtitle",
    description: "Old description with a bad deposit",
    imageUrl: "/bike.jpg",
    mediaUrls: ["/bike.jpg"],
    pricePerDay: 99_999,
    rentPriceLabel: "99 999 ₽",
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
      rent: false,
      sale: true,
      dailyPrice: 99_999,
      rent_weekday: 99_999,
      rent_weekend: 199_999,
      deposit_rub: 20_000,
      price_per_hour: 1_000,
      rent_2_4d: 8_000,
    },
    reviewSummary: { average: 0, count: 0, reviews: [] },
    ...overrides,
  };
}

describe("VIP BIKE canonical rental catalog", () => {
  test("normalizes Falcon GT and strips unconfirmed pricing", () => {
    const [falcon] = buildVipBikeRentalCatalog([item("falcon-gt-2026")]);

    expect(falcon).toMatchObject({
      title: "Falcon GT",
      pricePerDay: 12_000,
      rentPriceLabel: "12 000 ₽/сутки",
      saleAvailable: false,
      salePrice: null,
    });
    expect(falcon.rawSpecs).toMatchObject({
      rent: 1,
      sale: 0,
      dailyPrice: 12_000,
      rent_weekday: 12_000,
      vipBikeRentalCanonical: true,
      vipBikeRentalSegment: "electric",
    });
    expect(falcon.rawSpecs).not.toHaveProperty("deposit_rub");
    expect(falcon.rawSpecs).not.toHaveProperty("price_per_hour");
    expect(falcon.rawSpecs).not.toHaveProperty("rent_2_4d");
    expect(falcon.rawSpecs).not.toHaveProperty("rent_weekend");
    expect(falcon.specs.some((spec) => /залог/i.test(spec.label))).toBe(false);
  });

  test("keeps the only confirmed weekend tariff for Y-VOLT", () => {
    const [yvolt] = buildVipBikeRentalCatalog([item("y-volt-surge-v")]);

    expect(yvolt.pricePerDay).toBe(12_000);
    expect(yvolt.rawSpecs?.rent_weekend).toBe(15_000);
  });

  test("filters paid landings by propulsion and excludes non-SSOT items", () => {
    const result = buildVipBikeRentalCatalog(
      [
        item("falcon-gt-2026"),
        item("yamaha-r7"),
        item("livewire-one"),
        item("aprilia-shiver"),
      ],
      "petrol",
    );

    expect(result.map((entry) => entry.id)).toEqual(["yamaha-r7"]);
  });

  test("accepts only explicit paid landing segments", () => {
    expect(parseVipBikeRentalSegment("electric")).toBe("electric");
    expect(parseVipBikeRentalSegment("petrol")).toBe("petrol");
    expect(parseVipBikeRentalSegment("gas")).toBeNull();
    expect(parseVipBikeRentalSegment(null)).toBeNull();
  });
});
