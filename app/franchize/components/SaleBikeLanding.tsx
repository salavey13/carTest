import type { CatalogItemVM, FranchizeCrewVM } from "@/app/franchize/actions";
import { SaleBikeLandingClient } from "@/app/franchize/components/SaleBikeLandingClient";

type ConfigOption = { id: string; label: string; priceDelta: number; subtitle: string };
type ColorOption = { id: string; label: string; hex: string };

const CONFIG_OPTIONS: ConfigOption[] = [
  { id: "standard", label: "Стандарт", subtitle: "Базовая комплектация", priceDelta: 0 },
  { id: "long-range", label: "Long Range", subtitle: "Увеличенный запас хода", priceDelta: 40000 },
  { id: "comfort", label: "Comfort", subtitle: "Комфорт и защита", priceDelta: 25000 },
];

const COLOR_OPTIONS: ColorOption[] = [
  { id: "black", label: "Черный", hex: "#0b0c0f" },
  { id: "graphite", label: "Графит", hex: "#6b7280" },
  { id: "acid", label: "Lime", hex: "#c6ff00" },
  { id: "white", label: "Белый", hex: "#f8fafc" },
];

function formatPrice(value: number): string {
  return value > 0 ? `${value.toLocaleString("ru-RU")} ₽` : "по запросу";
}

export function SaleBikeLanding({ crew, item }: { crew: FranchizeCrewVM; item: CatalogItemVM }) {
  return (
    <section className="min-h-screen pb-28 pt-3 sm:pt-6">
      <h1 className="sr-only">{item.title}</h1>
      <SaleBikeLandingClient crew={crew} item={item} />
    </section>
  );
}
