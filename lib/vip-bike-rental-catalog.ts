import type { CatalogItemVM } from "@/app/franchize/actions";

export type VipBikeRentalSegment = "electric" | "petrol";

type CanonicalRental = {
  title: string;
  pricePerDay: number;
  segment: VipBikeRentalSegment;
  weekendPrice?: number;
};

// Public rental prices are deliberately kept in one small allowlist. Items
// missing from the rental SSOT stay out of paid rental landings even when an
// old price still exists in the shared catalog database.
export const VIP_BIKE_RENTAL_CATALOG: Readonly<Record<string, CanonicalRental>> = {
  "ducati-panigale-s-electro-black-aero": {
    title: "Ducati Panigale S Electro Black Aero",
    pricePerDay: 10_000,
    segment: "electric",
  },
  "ducati-panigale-s-electro-black-chain": {
    title: "Ducati Panigale S Electro Black",
    pricePerDay: 10_000,
    segment: "electric",
  },
  "ducati-panigale-s-electro-gold": {
    title: "Ducati Panigale S Electro Gold",
    pricePerDay: 10_000,
    segment: "electric",
  },
  "falcon-gt-2026": {
    title: "Falcon GT",
    pricePerDay: 12_000,
    segment: "electric",
  },
  "falcon-lynx-purple": {
    title: "Falcon LYNX Purple",
    pricePerDay: 11_000,
    segment: "electric",
  },
  "falcon-pro-2026": {
    title: "Falcon PRO",
    pricePerDay: 10_000,
    segment: "electric",
  },
  "hmd-m02": {
    title: "HMD M02",
    pricePerDay: 6_000,
    segment: "electric",
  },
  "rerode-r1-plus": {
    title: "Rerode R1+",
    pricePerDay: 12_000,
    segment: "electric",
  },
  "sotion-em01": {
    title: "Sotion EM01",
    pricePerDay: 5_000,
    segment: "electric",
  },
  "y-volt-surge-v": {
    title: "Y-VOLT Surge V",
    pricePerDay: 12_000,
    weekendPrice: 15_000,
    segment: "electric",
  },
  "bmw-f800r": {
    title: "BMW F800R",
    pricePerDay: 12_000,
    segment: "petrol",
  },
  "jilang-max-pro": {
    title: "Jilang Max Pro",
    pricePerDay: 8_000,
    segment: "petrol",
  },
  "kawasaki-ex650k": {
    title: "Kawasaki EX650K Ninja 650",
    pricePerDay: 10_000,
    segment: "petrol",
  },
  "kayo-tsd110": {
    title: "Kayo TSD 110",
    pricePerDay: 4_000,
    segment: "petrol",
  },
  "motoland-breakout": {
    title: "Motoland Breakout 300",
    pricePerDay: 6_000,
    segment: "petrol",
  },
  "nibbler-regumoto-4v": {
    title: "Regulmoto Nibbler 300 4V",
    pricePerDay: 6_000,
    segment: "petrol",
  },
  "suzuki-gsx-s1000f": {
    title: "Suzuki GSX-S1000F",
    pricePerDay: 14_000,
    segment: "petrol",
  },
  "yamaha-r7": {
    title: "Yamaha R7",
    pricePerDay: 10_000,
    segment: "petrol",
  },
};

const UNCONFIRMED_PRICE_KEYS = [
  "deposit",
  "deposit_label",
  "deposit_rub",
  "security_deposit",
  "security_deposit_rub",
  "pledge",
  "price_per_hour",
  "price_per_2h",
  "price_per_3h",
  "price_per_6h",
  "price_per_12h",
  "rent_2_4d",
  "rent_5_10d",
  "rent_11_30d",
  "rent_weekend",
  "delivery_price",
  "helmet_price",
] as const;

const PRIVATE_SPEC_LABEL_RE =
  /залог|депозит|час|сут|день|аренд|тариф|выходн|будн|скидк|достав|экип|шлем|перчат/i;

function formatRub(value: number) {
  return value.toLocaleString("ru-RU");
}

function normalizeRentalItem(
  item: CatalogItemVM,
  canonical: CanonicalRental,
): CatalogItemVM {
  const rawSpecs: Record<string, unknown> = { ...(item.rawSpecs ?? {}) };
  for (const key of UNCONFIRMED_PRICE_KEYS) delete rawSpecs[key];

  rawSpecs.rent = 1;
  rawSpecs.sale = 0;
  rawSpecs.dailyPrice = canonical.pricePerDay;
  rawSpecs.rent_weekday = canonical.pricePerDay;
  rawSpecs.type = canonical.segment === "electric" ? "Electric" : "Petrol";
  rawSpecs.vipBikeRentalCanonical = true;
  rawSpecs.vipBikeRentalSegment = canonical.segment;
  if (canonical.weekendPrice) rawSpecs.rent_weekend = canonical.weekendPrice;

  const publicSpecs = item.specs.filter(
    (spec) => !PRIVATE_SPEC_LABEL_RE.test(spec.label),
  );
  publicSpecs.push({
    label: "Аренда",
    value: `${formatRub(canonical.pricePerDay)} ₽/сутки`,
  });
  if (canonical.weekendPrice) {
    publicSpecs.push({
      label: "Выходной день",
      value: `${formatRub(canonical.weekendPrice)} ₽/сутки`,
    });
  }

  return {
    ...item,
    title: canonical.title,
    subtitle: "Аренда в Нижнем Новгороде",
    description: `${canonical.title} доступен для аренды в VIP Bike Rental. Оставь заявку — менеджер подтвердит даты и условия.`,
    pricePerDay: canonical.pricePerDay,
    rentPriceLabel: `${formatRub(canonical.pricePerDay)} ₽/сутки`,
    category:
      canonical.segment === "electric"
        ? "Электромотоциклы"
        : "Бензиновые мотоциклы",
    saleAvailable: false,
    salePrice: null,
    specs: publicSpecs,
    rawSpecs,
  };
}

export function buildVipBikeRentalCatalog(
  items: CatalogItemVM[],
  segment?: VipBikeRentalSegment | null,
) {
  return items.flatMap((item) => {
    const canonical = VIP_BIKE_RENTAL_CATALOG[item.id];
    if (!canonical || (segment && canonical.segment !== segment)) return [];
    return [normalizeRentalItem(item, canonical)];
  });
}

export function parseVipBikeRentalSegment(
  value: string | null | undefined,
): VipBikeRentalSegment | null {
  if (value === "electric" || value === "petrol") return value;
  return null;
}
