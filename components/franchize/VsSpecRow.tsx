import type { ReactNode } from "react";

type VsSpecRowProps = {
  label: string;
  valueA: string | number;
  valueB: string | number;
  unit?: string;
  lowerIsBetter?: boolean;
};

export {
  getCatalogPropulsionLabel,
  getCatalogPropulsionSegment,
  isSameCatalogPropulsion,
  type CatalogPropulsionSegment,
} from "@/app/franchize/lib/catalog-propulsion";

export type CatalogVsSpec = {
  label: string;
  keys: string[];
  unit?: string;
  lowerIsBetter?: boolean;
};

export const CATALOG_VS_SPECS: CatalogVsSpec[] = [
  {
    label: "Мощность",
    keys: ["power_kw", "motor_peak_kw", "motor_kw"],
    unit: "кВт",
  },
  {
    label: "Запас хода",
    keys: ["range_km", "range", "max_range_km"],
    unit: "км",
  },
  {
    label: "Вес",
    keys: ["weight_kg", "curb_weight_kg", "mass_kg"],
    unit: "кг",
    lowerIsBetter: true,
  },
  {
    label: "Цена",
    keys: ["sale_price", "price_rub", "price"],
    unit: "₽",
    lowerIsBetter: true,
  },
];

export const getCatalogVsSpecValue = (
  rawSpecs: Record<string, unknown> | undefined,
  keys: string[],
) => {
  for (const key of keys) {
    const value = rawSpecs?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value as string | number;
    }
  }
  return "—";
};

const parseComparableNumber = (value: string | number) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = value
    .replace(/\s/g, "")
    .replace(",", ".")
    .match(/-?\d+(\.\d+)?/)?.[0];
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatValue = (value: string | number, unit?: string) => {
  const rendered =
    typeof value === "number" ? value.toLocaleString("ru-RU") : value;
  return unit && rendered !== "—" ? `${rendered} ${unit}` : rendered;
};

function ValueCell({
  children,
  isWinner,
  isLoser,
}: {
  children: ReactNode;
  isWinner: boolean;
  isLoser: boolean;
}) {
  return (
    <div
      className={`rounded-xl px-2.5 py-2 text-sm transition ${isWinner ? "bg-emerald-500/10 text-emerald-500 font-bold" : isLoser ? "text-[var(--item-muted-text)] opacity-60" : "text-[var(--item-text)]"}`}
    >
      {children}
    </div>
  );
}

export function VsSpecRow({
  label,
  valueA,
  valueB,
  unit,
  lowerIsBetter = false,
}: VsSpecRowProps) {
  const parsedA = parseComparableNumber(valueA);
  const parsedB = parseComparableNumber(valueB);
  const canCompare =
    parsedA !== null && parsedB !== null && parsedA !== parsedB;
  const aWins = canCompare
    ? lowerIsBetter
      ? parsedA < parsedB
      : parsedA > parsedB
    : false;
  const bWins = canCompare
    ? lowerIsBetter
      ? parsedB < parsedA
      : parsedB > parsedA
    : false;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs sm:text-sm">
      <ValueCell isWinner={aWins} isLoser={bWins}>
        {formatValue(valueA, unit)}
      </ValueCell>
      <div className="min-w-[5.5rem] text-center text-[10px] uppercase tracking-[0.12em] text-[var(--item-muted-text)] sm:min-w-28">
        {label}
      </div>
      <ValueCell isWinner={bWins} isLoser={aWins}>
        {formatValue(valueB, unit)}
      </ValueCell>
    </div>
  );
}
