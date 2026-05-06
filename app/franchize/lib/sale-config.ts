export type ConfigOption = {
  id: string;
  label: string;
  priceDelta: number;
  subtitle: string;
};

export type ColorOption = {
  id: string;
  label: string;
  hex: string;
};

export const DEFAULT_CONFIG_OPTIONS: ConfigOption[] = [
  {
    id: "standard",
    label: "Стандарт",
    subtitle: "Базовая комплектация",
    priceDelta: 0,
  },
  {
    id: "long-range",
    label: "Long Range",
    subtitle: "Увеличенный запас хода",
    priceDelta: 40000,
  },
  {
    id: "comfort",
    label: "Comfort",
    subtitle: "Комфорт и защита",
    priceDelta: 25000,
  },
];

export const DEFAULT_COLOR_OPTIONS: ColorOption[] = [
  { id: "black", label: "Черный", hex: "#0b0c0f" },
  { id: "graphite", label: "Графит", hex: "#6b7280" },
  { id: "acid", label: "Lime", hex: "#c6ff00" },
  { id: "white", label: "Белый", hex: "#f8fafc" },
];

export function resolveBuyConfigOptions(specs: Record<string, unknown> | undefined): ConfigOption[] {
  const custom = Array.isArray(specs?.buy_options)
    ? (specs.buy_options as Array<Record<string, unknown>>)
    : [];
  if (!custom.length) return DEFAULT_CONFIG_OPTIONS;

  const mapped = custom
    .map((option, idx) => ({
      id: String(option.id || `opt-${idx}`),
      label: String(option.label || option.name || `Опция ${idx + 1}`),
      subtitle: String(option.subtitle || option.description || ""),
      priceDelta: Number(option.priceDelta || option.price_delta || 0),
    }))
    .filter((option) => option.id);

  return mapped.length ? mapped : DEFAULT_CONFIG_OPTIONS;
}

export function resolveBuyColorOptions(specs: Record<string, unknown> | undefined): ColorOption[] {
  const custom = Array.isArray(specs?.buy_colors)
    ? (specs.buy_colors as Array<Record<string, unknown>>)
    : [];
  if (!custom.length) return DEFAULT_COLOR_OPTIONS;

  const mapped = custom
    .map((color, idx) => ({
      id: String(color.id || `color-${idx}`),
      label: String(color.label || color.name || `Цвет ${idx + 1}`),
      hex: String(color.hex || color.value || "#9ca3af"),
    }))
    .filter((color) => color.id);

  return mapped.length ? mapped : DEFAULT_COLOR_OPTIONS;
}
