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

export type PrebuyIntentType = "prebuy" | "test_ride" | "trade_in" | "finance";

export type PrebuyComparisonOption = {
  id: string;
  label: string;
  intentType: PrebuyIntentType;
  title: string;
  description: string;
  ctaLabel: string;
  urgencyScore: number;
};

export const PREBUY_COMPARISON_OPTIONS: PrebuyComparisonOption[] = [
  {
    id: "buy_now",
    label: "Купить сейчас",
    intentType: "prebuy",
    title: "Фиксируем конфигурацию и ведём в корзину",
    description:
      "Подходит, если цена, цвет и комплектация уже понятны. Оператор подтвердит наличие и документы.",
    ctaLabel: "Купить сейчас",
    urgencyScore: 72,
  },
  {
    id: "rent_first",
    label: "Арендовать перед покупкой",
    intentType: "prebuy",
    title: "Сначала прокат, потом зачёт в покупку",
    description:
      "Проверяете байк в реальном маршруте, а оператор подскажет, как учесть опыт аренды при покупке.",
    ctaLabel: "Хочу rent-first",
    urgencyScore: 68,
  },
  {
    id: "test_ride",
    label: "Тест-драйв",
    intentType: "test_ride",
    title: "Бронируем короткий офлайн-показ",
    description:
      "Telegram-счёт на бронь фиксирует слот; без Telegram оставим заявку и уточним контакт.",
    ctaLabel: "Запросить тест-драйв",
    urgencyScore: 86,
  },
  {
    id: "trade_in",
    label: "Trade-in",
    intentType: "trade_in",
    title: "Оценим ваш текущий байк как часть сделки",
    description:
      "Нужны модель, год, состояние и контакт — этого достаточно для первого ответа оператора.",
    ctaLabel: "Отправить trade-in",
    urgencyScore: 78,
  },
  {
    id: "finance",
    label: "Рассрочка/финансирование",
    intentType: "finance",
    title: "Покажем примерный ежемесячный платёж",
    description:
      "Расчёт предварительный: точные условия, срок и первый взнос подтверждает оператор.",
    ctaLabel: "Уточнить финансирование",
    urgencyScore: 74,
  },
];

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

export function resolveBuyConfigOptions(
  specs: Record<string, unknown> | undefined,
): ConfigOption[] {
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

export function resolveBuyColorOptions(
  specs: Record<string, unknown> | undefined,
): ColorOption[] {
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
