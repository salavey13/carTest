/**
 * shared/constants.ts
 * ===================
 * Fallback data and constants for VIP Bike feature components.
 * These are used when the API returns no data (loading states, demos).
 *
 * Each franchise has its own set of fallback data.
 * For СварПрофи-НН, this would be metal construction products.
 */

import type { MapRidersOverview, ElectroPreviewItem } from "./types";
import type { CatalogItemVM } from "@/app/franchize/actions";

// ─────────────────────────────────────────────────────
// Helper utilities
// ─────────────────────────────────────────────────────

export const isEnabled = (value: unknown): boolean =>
  value === 1 || value === true || String(value).toLowerCase() === "1" || String(value).toLowerCase() === "true";

export const getSalePriceLabel = (item: Pick<CatalogItemVM, "salePrice">): string =>
  item.salePrice ? `${item.salePrice.toLocaleString("ru-RU")} ₽` : "по запросу";

export const getBikeGallery = (item: Pick<CatalogItemVM, "imageUrl" | "mediaUrls">): string[] => {
  const urls = [item.imageUrl, ...(item.mediaUrls ?? [])].filter(Boolean) as string[];
  return Array.from(new Set(urls));
};

export const formatCompactNumber = (value: number | undefined, fallback: number): string =>
  Number(value ?? fallback).toLocaleString("ru-RU", { maximumFractionDigits: 1 });

export const getRussianRiderLabel = (count: number): string => {
  const rounded = Math.abs(Math.round(count));
  const lastTwo = rounded % 100;
  const last = rounded % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "райдеров онлайн";
  if (last === 1) return "райдер онлайн";
  if (last >= 2 && last <= 4) return "райдера онлайн";
  return "райдеров онлайн";
};

export const formatRideDuration = (seconds: number | undefined): string => {
  const safeSeconds = Number(seconds);
  if (!Number.isFinite(safeSeconds)) return "—";
  if (safeSeconds === 0) return "Только что начали!";
  if (safeSeconds < 60) return "Меньше минуты";
  const minutes = Math.round(safeSeconds / 60);
  if (minutes < 60) return `${minutes} мин`;
  return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
};

export const clampPercent = (value: number): number => Math.min(86, Math.max(10, value));

export const normalizeMapPoint = (lat: number | undefined, lng: number | undefined, index: number) => {
  if (typeof lat !== "number" || typeof lng !== "number") {
    return { left: 18 + index * 24, top: 28 + (index % 2) * 26 };
  }
  return {
    left: clampPercent(((lng - 43.91) / 0.09) * 100),
    top: clampPercent(100 - ((lat - 56.245) / 0.07) * 100),
  };
};

// ─────────────────────────────────────────────────────
// Fallback data
// ─────────────────────────────────────────────────────

export const fallbackMapLocations = [
  { lat: 56.274, lng: 43.936, speed_kmh: 22, user_id: "fallback-rider-1" },
  { lat: 56.281, lng: 43.952, speed_kmh: 31, user_id: "fallback-rider-2" },
  { lat: 56.268, lng: 43.964, speed_kmh: 18, user_id: "fallback-rider-3" },
];

export const fallbackMeetups = [
  { lat: 56.272, lng: 43.948, title: "Старт у речной точки", comment: "легкий темп" },
];

export const fallbackElectroItems: ElectroPreviewItem[] = [
  {
    id: "vip-s1-fallback",
    title: "VIP Bike Electro-Enduro S1",
    subtitle: "Test-ride friendly",
    description: "Универсальный электроэндуро для первого проката, речных маршрутов и быстрого знакомства с электрической тягой.",
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_bg-cf31dc2b-291b-440b-953b-6e1b4a838e4e.jpg",
    mediaUrls: [],
    pricePerDay: 4900,
    rentPriceLabel: "4 900 ₽ / день",
    category: "Electro-Enduro",
    saleAvailable: true,
    salePrice: 285000,
    specs: [
      { label: "Запас хода", value: "до 90 км" },
      { label: "Заряд", value: "3–4 часа" },
      { label: "Режим", value: "Eco / Sport" },
    ],
    rawSpecs: {},
  },
  {
    id: "vip-lr-fallback",
    title: "VIP Bike Long Range",
    subtitle: "Больше маршрута",
    description: "Версия для длинной прогулки: больше батареи, спокойный контроль и комфортный запас по дистанции.",
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/81Dts9uMBXZXTKC7PjIbBRRRHYGQx_2TPEKFWvaUwDzzgSQPjxUf4GjAiRaDWIcWgwmeaZQTKppFn5VBS6yZeK7R-38bfc7fb-0d5a-4b62-b7e6-ca83950cb265.jpg",
    mediaUrls: [],
    pricePerDay: 6500,
    rentPriceLabel: "6 500 ₽ / день",
    category: "Electro-Enduro",
    saleAvailable: true,
    salePrice: 340000,
    specs: [
      { label: "Запас хода", value: "до 130 км" },
      { label: "Пакет", value: "Long Range" },
      { label: "Фокус", value: "туринг" },
    ],
    rawSpecs: {},
  },
];

export const conversionPilotChecks = [
  { label: "Старт", value: "понятный", icon: "::FaLayerGroup::" },
  { label: "Защита", value: "экип + ОСАГО", icon: "::FaShieldHeart::" },
  { label: "Путь", value: "3 сценария", icon: "::FaBolt::" },
];

export const decisionRoutes = [
  {
    title: "Первый выезд",
    text: "Для первого контакта с электроэндуро: выбираете байк, слот и экипировку, а дальше система ведёт к подтверждённой выдаче.",
    href: "/franchize/vip-bike",
    cta: "Выбрать аренду",
    icon: "::FaMotorcycle::",
  },
  {
    title: "Тест → покупка",
    text: "Для покупки без сомнений: соберите конфигурацию, закрепите тест-драйв и сравните ощущения до оплаты.",
    href: "/franchize/vip-bike/configurator",
    cta: "Собрать байк",
    icon: "::FaCartShopping::",
  },
  {
    title: "Кататься с группой",
    text: "Для групповых выездов: смотрите райдеров рядом, точки старта и ближайшие встречи вместо случайных договорённостей.",
    href: "/franchize/vip-bike/map-riders",
    cta: "Смотреть карту",
    icon: "::FaMapLocationDot::",
  },
];

export const mapRidersJourney = [
  { title: "Шаг 1: Найди точку старта", text: "Открой карту и выбери ближайшую точку сбора по времени и уровню сложности." },
  { title: "Шаг 2: Проверь экип и маршрут", text: "Перед выездом отметь экип и дистанцию — так проще выбрать комфортную сессию." },
  { title: "Шаг 3: Поехали с группой", text: "Присоединяйся к активной группе, отслеживай прогресс и отмечай пройденные участки." },
];

export const newbieFlow = [
  { step: "Шаг 1", title: "Старт с понятного сценария", description: "Откройте страницу заказа: локация, маршруты, ограничения и правила безопасности собраны до выбора слота.", href: "/vipbikerental", cta: "Открыть вводный блок" },
  { step: "Шаг 2", title: "Подбор байка и конфигурации", description: "Перейдите в конфигуратор: модель, батарея, режим мощности и допы фиксируются в одном заказе.", href: "/franchize/vip-bike/electro-enduro", cta: "Подобрать конфиг" },
  { step: "Шаг 3", title: "Корзина и оформление", description: "Проверьте состав, добавьте защиту, подтвердите контакты и отправьте менеджеру уже структурированную заявку.", href: "/franchize/vip-bike/profile", cta: "Проверить оформление" },
];

export const rentalStatusSteps = [
  { label: "Выбор", value: "открыт", icon: "::FaMotorcycle::" },
  { label: "Экип", value: "готов", icon: "::FaHelmetSafety::" },
  { label: "Слот", value: "сегодня", icon: "::FaStopwatch::" },
];

export const quickChooserFilters = [
  { id: "first" as const, label: "Первый выезд", hint: "мягкая тяга" },
  { id: "range" as const, label: "Дальше ехать", hint: "батарея +" },
  { id: "buy" as const, label: "Купить", hint: "в наличии" },
];

export const heroMetrics = [
  "::FaStopwatch:: Бронь без лишних созвонов",
  "::FaShieldHeart:: ОСАГО + экип",
  "::FaMapLocationDot:: Выдача в удобной городской точке",
  "::FaHeadset:: Поддержка на маршруте",
];