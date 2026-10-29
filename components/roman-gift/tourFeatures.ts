// components/roman-gift/tourFeatures.ts — task164 BESTSELLER tour catalog.
// ──────────────────────────────────────────────────────────────────────────
// Boss audio (29.10, «BESTSELLER»): the birthday quest becomes a PRODUCT —
// a self-promoting tour of everything the vip-bike app can do. Every stop
// showcases a REAL feature from the main menu («прямо прайс, эту карту,
// конфигуратор — всё, что в главном меню VIP BIKE есть») and carries a
// включить/купить CTA: crew owners get activation checkboxes (free, real —
// writes crews.metadata.feature_tour), everyone else gets a ⭐ price button
// (Telegram-Stars demo, boss: «фейк-кнопки пока»), and the trail ends with
// the birthday congratulation for Roman ONLY — everyone else gets the
// sales finale.
//
// This file is the SINGLE SOURCE for: stop modal CTAs, the /gift/roman-quest
// overview cards, and the activation API key validation. The host pages keep
// passing stop/riddle/nextHref/nextLabel — their riddles remain the trail's
// voice; the catalog adds the product layer.

export interface TourFeature {
  /** Stable machine key — the activation flag in crews.metadata.feature_tour. */
  key: string;
  /** Trail stop number (1-based, matches RomanQuestCake's stop prop). */
  stop: number;
  href: string;
  icon: string;
  title: string;
  /** The route shown as mono chip on the overview card. */
  page: string;
  /** One-paragraph sales pitch (overview card). */
  pitch: string;
  /** What the feature gives a CREW (tour skin modal sub-line). */
  gives: string;
  /** Demo price in Telegram Stars (0 = free / already included). */
  priceStars: number;
}

export const TOUR_FEATURES: TourFeature[] = [
  {
    key: "landing",
    stop: 1,
    href: "/",
    icon: "🏠",
    title: "Главный экран",
    page: "vip-bike-лендинг",
    pitch: "Лицо всего проекта: витрина, парк, цены. То, что видит каждый гость — и то, чем вы управляете.",
    gives: "Гость заходит и сразу видит парк, цены и путь до брони.",
    priceStars: 0,
  },
  {
    key: "storefront",
    stop: 2,
    href: "/franchize/vip-bike",
    icon: "🏍️",
    title: "Витрина экипажа",
    page: "/franchize/vip-bike",
    pitch: "Свой каталог с корзиной: гость выбирает байк и даты сам, бот оформляет договор и напоминания.",
    gives: "Каталог с корзиной: гость бронирует сам, бот ведёт сделку.",
    priceStars: 50,
  },
  {
    key: "configurator",
    stop: 3,
    href: "/franchize/vip-bike/configurator",
    icon: "🎨",
    title: "Конфигуратор байка",
    page: "/franchize/vip-bike/configurator",
    pitch: "Собери свой электромотоцикл по частям: цвета, комплектация, живой предпросмотр — витрина, которая продаёт мечту.",
    gives: "Гость собирает байк под себя — вовлечение до разговора о цене.",
    priceStars: 50,
  },
  {
    key: "discovery",
    stop: 4,
    href: "/franchize/discovery",
    icon: "🛰",
    title: "Карта сети",
    page: "/franchize/discovery",
    pitch: "Все экипажи проекта — круги, и размер круга — это его люди. Видно, какой мир вы с Ильёй строите.",
    gives: "Сеть экипажей на одной карте — масштаб проекта глазами гостей.",
    priceStars: 25,
  },
  {
    key: "leaderboard",
    stop: 5,
    href: "/leaderboard",
    icon: "🏆",
    title: "Зал славы",
    page: "/leaderboard",
    pitch: "Топы экипажей и флотов всего проекта с живыми цифрами. Место vip-bike в большой игре.",
    gives: "Геймификация: экипажи соревнуются, гости видят азарт.",
    priceStars: 25,
  },
  {
    key: "garage",
    stop: 6,
    href: "/rent-bike",
    icon: "⚙️",
    title: "MOTO-GARAGE",
    page: "/rent-bike",
    pitch: "Гараж изнутри: выбрал байк, тапнул даты — бронирование собрано. Так катают ваши райдеры.",
    gives: "Самообслуживание райдера: выбор байка и дат без менеджера.",
    priceStars: 50,
  },
  {
    key: "price_calc",
    stop: 7,
    href: "/franchize/vip-bike/calc-explainer",
    icon: "🧮",
    title: "Прайс-калькулятор",
    page: "/franchize/vip-bike/calc-explainer",
    pitch: "Каждая цифра в цене объяснена: что входит, что опционально, откуда залог. Ноль «а почему так дорого».",
    gives: "Прозрачный прайс: цена объясняет себя сама — меньше споров.",
    priceStars: 25,
  },
  {
    key: "map_riders",
    stop: 8,
    href: "/franchize/vip-bike/map-riders",
    icon: "🗺",
    title: "Карта райдеров",
    page: "/franchize/vip-bike/map-riders",
    pitch: "Live-карта экипажа: кто где катает, meetup-точки, статусы поездок. Экипаж на ладони.",
    gives: "Живая карта своих райдеров — безопасность и движ экипажа.",
    priceStars: 75,
  },
  {
    key: "community",
    stop: 9,
    href: "/franchize/vip-bike/community",
    icon: "💬",
    title: "Стена сообщества",
    page: "/franchize/vip-bike/community",
    pitch: "Посты, реакции и обсуждения прямо в приложении — экипаж живёт не только в чате.",
    gives: "Своё комьюнити внутри бренда — контент и лояльность.",
    priceStars: 50,
  },
  {
    key: "season_stats",
    stop: 10,
    href: "/franchize/vip-bike/season-stats",
    icon: "📈",
    title: "Цифры сезона",
    page: "/franchize/vip-bike/season-stats",
    pitch: "Весь сезон 2026 до рубля: аренды, продажи, касса и сверка расчётов. Деньги со-владельца — на одном табло.",
    gives: "Финансовое табло экипажа: деньги и сверка без экселя.",
    priceStars: 75,
  },
];

export const TOUR_STOPS_TOTAL = TOUR_FEATURES.length;

export const TOUR_FEATURE_KEYS = new Set(TOUR_FEATURES.map((f) => f.key));

export function tourFeatureByKey(key: string): TourFeature | undefined {
  return TOUR_FEATURES.find((f) => f.key === key);
}

/** The landing is the door, not a feature — no buy/activate CTA on stop 1. */
export function tourFeatureHasCta(key: string): boolean {
  const f = tourFeatureByKey(key);
  return Boolean(f && f.priceStars > 0);
}

/** Menu link label injected into crews.metadata.franchize.header.menuLinks. */
export const TOUR_MENU_LINK = { label: "⭐ Фичи экипажа", href: "/gift/roman-quest" } as const;
