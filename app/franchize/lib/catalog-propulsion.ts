export type CatalogPropulsionSegment = "electric" | "gas" | "unknown";

export type CatalogPropulsionInput = {
  title?: string;
  subtitle?: string;
  description?: string;
  category?: string;
  rawSpecs?: Record<string, unknown>;
};

const ELECTRIC_VALUE_RE =
  /electric|electro|e-moto|emoto|электро|электроэн|эл\.?\s*мото|\bev\b/i;
const GAS_VALUE_RE =
  /gas|gasoline|petrol|fuel|\bice\b|бенз|двс|топлив|карбюратор|инжектор/i;
const ELECTRIC_TEXT_RE =
  /electric|electro|e-moto|emoto|электро|электроэн|эл\.?\s*мото|аккум|батар|заряд/i;
const GAS_TEXT_RE =
  /gas|gasoline|petrol|fuel|\bice\b|бенз|двс|топлив|куб|карбюратор|инжектор/i;

const ELECTRIC_SPEC_KEYS = new Set([
  "battery_options",
  "battery_capacity",
  "battery_capacity_kwh",
  "battery_type",
  "charge_time_h",
  "charging_time_h",
  "max_range_km",
  "motor_kw",
  "motor_peak_kw",
  "power_kw",
  "power_w",
  "range_km",
]);

const GAS_SPEC_KEYS = new Set([
  "displacement_cc",
  "engine_cc",
  "fuel_capacity_l",
  "fuel_tank_l",
  "horsepower",
  "hp",
  "torque_nm",
]);

const stringifySpecValue = (value: unknown) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value) ?? "";
};

const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9_]/g, "_");

const scoreRawSpecs = (rawSpecs: Record<string, unknown> | undefined) => {
  let electric = 0;
  let gas = 0;

  for (const [rawKey, rawValue] of Object.entries(rawSpecs ?? {})) {
    const key = normalizeKey(rawKey);
    const value = stringifySpecValue(rawValue);

    if (ELECTRIC_SPEC_KEYS.has(key)) electric += 2;
    if (GAS_SPEC_KEYS.has(key)) gas += 2;
    if (ELECTRIC_VALUE_RE.test(value)) electric += 3;
    if (GAS_VALUE_RE.test(value)) gas += 3;
  }

  return { electric, gas };
};

export const getCatalogPropulsionSegment = ({
  title,
  subtitle,
  description,
  category,
  rawSpecs,
}: CatalogPropulsionInput): CatalogPropulsionSegment => {
  const score = scoreRawSpecs(rawSpecs);
  const publicText = `${title ?? ""} ${subtitle ?? ""} ${description ?? ""} ${
    category ?? ""
  }`;

  if (ELECTRIC_TEXT_RE.test(publicText)) score.electric += 1;
  if (GAS_TEXT_RE.test(publicText)) score.gas += 1;

  if (score.electric === score.gas) return "unknown";
  return score.electric > score.gas ? "electric" : "gas";
};

export const getCatalogPropulsionLabel = (
  segment: CatalogPropulsionSegment,
) => {
  if (segment === "electric") return "электро ↔ электро";
  if (segment === "gas") return "бензин ↔ бензин";
  return "один класс ↔ один класс";
};

export const isSameCatalogPropulsion = (
  a: CatalogPropulsionInput,
  b: CatalogPropulsionInput,
) => getCatalogPropulsionSegment(a) === getCatalogPropulsionSegment(b);
