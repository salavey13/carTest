// components/roman-gift/tourFeatures.ts — task164 BESTSELLER tour catalog,
// extended in task165 to the FULL onboarding quest (boss: «look at main menu
// of golden standard vip-bike crew, it's header menu links — i think all of
// them should be in this onboarding quest … extend to the fullest on top
// quality bar»).
// ──────────────────────────────────────────────────────────────────────────
// Boss audio (29.10, «BESTSELLER»): the birthday quest becomes a PRODUCT —
// a self-promoting tour of everything the vip-bike app can do. Boss follow-up
// (29.10 evening, moto-selection onboarding): EVERY header menu link of the
// golden-standard vip-bike crew must be a stop, each stop describes the NEXT
// hop, and every hop carries a REAL screenshot («create screenshots of what
// to expect in next hop, upload compressed to storage, wire to quest steps
// notes/modals»). 19 stops now: 10 original + 9 header links
// (electro-enduro, колесо фортуны, мотопарк, корзина, мои аренды, продажи,
// о нас, контакты, партнёрам).
//
// This file is the SINGLE SOURCE for: stop modal CTAs + previews, the
// /gift/roman-quest overview cards, the activation API key validation and the
// XTR purchase action (app/roman-quest/actions.ts). The host pages keep
// passing riddle/nextHref/nextLabel — their riddles remain the trail's voice;
// the catalog adds the product layer. The STOP NUMBER is derived from here
// (host pages don't hardcode it any more — reorder-safe).
//
// Previews: compressed webp screenshots of the REAL prod pages (390×844 @2x,
// resized to 620w, ~30-50KB each), stored in the public `tourpix` bucket.

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
  /**
   * Compressed screenshot of THIS stop's page (tourpix bucket). The stop
   * modal shows the NEXT stop's preview — «what to expect in next hop».
   */
  preview?: string;
}

const TOURPIX = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tourpix/task165";

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
    preview: `${TOURPIX}/landing.webp`,
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
    preview: `${TOURPIX}/storefront.webp`,
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
    preview: `${TOURPIX}/configurator.webp`,
  },
  {
    key: "electro_enduro",
    stop: 4,
    href: "/franchize/vip-bike/electro-enduro",
    icon: "⚡",
    title: "Каталог electro-enduro",
    page: "/franchize/vip-bike/electro-enduro",
    pitch: "Отдельный вход для любителей бездорожья: эндуро и кросс на электротяге, свои описания и характеры байков.",
    gives: "Второй витринный жанр: своя аудитория — свой каталог.",
    priceStars: 25,
    preview: `${TOURPIX}/electro_enduro.webp`,
  },
  {
    key: "wheel",
    stop: 5,
    href: "/franchize/vip-bike/wheel",
    icon: "🎡",
    title: "Колесо фортуны",
    page: "/franchize/vip-bike/wheel",
    pitch: "Гость крутит колесо и забирает промокод: 1 000 ₽, 2 000 ₽, 5 000 ₽ или 15%. Сервер проверяет промокод сам.",
    gives: "Игровое вовлечение с измеримой конверсией в бронь.",
    priceStars: 25,
    preview: `${TOURPIX}/wheel.webp`,
  },
  {
    key: "discovery",
    stop: 6,
    href: "/franchize/discovery",
    icon: "🛰",
    title: "Карта сети",
    page: "/franchize/discovery",
    pitch: "Все экипажи проекта — круги, и размер круга — это его люди. Видно, какой мир вы с Ильёй строите.",
    gives: "Сеть экипажей на одной карте — масштаб проекта глазами гостей.",
    priceStars: 25,
    preview: `${TOURPIX}/discovery.webp`,
  },
  {
    key: "leaderboard",
    stop: 7,
    href: "/leaderboard",
    icon: "🏆",
    title: "Зал славы",
    page: "/leaderboard",
    pitch: "Топы экипажей и флотов всего проекта с живыми цифрами. Место vip-bike в большой игре.",
    gives: "Геймификация: экипажи соревнуются, гости видят азарт.",
    priceStars: 25,
    preview: `${TOURPIX}/leaderboard.webp`,
  },
  {
    key: "garage",
    stop: 8,
    href: "/rent-bike",
    icon: "⚙️",
    title: "MOTO-GARAGE",
    page: "/rent-bike",
    pitch: "Гараж изнутри: выбрал байк, тапнул даты — бронирование собрано. Так катают ваши райдеры.",
    gives: "Самообслуживание райдера: выбор байка и дат без менеджера.",
    priceStars: 50,
    preview: `${TOURPIX}/garage.webp`,
  },
  {
    key: "bikes",
    stop: 9,
    href: "/franchize/vip-bike/bikes",
    icon: "🧱",
    title: "Мотопарк",
    page: "/franchize/vip-bike/bikes",
    pitch: "Стена каждого мото: история аренд, сервис, выручка и пробег — вплоть до конкретной батареи.",
    gives: "Прозрачный парк: каждая единица техники как открытая книга.",
    priceStars: 50,
    preview: `${TOURPIX}/bikes.webp`,
  },
  {
    key: "cart",
    stop: 10,
    href: "/franchize/vip-bike/cart",
    icon: "🛒",
    title: "Корзина",
    page: "/franchize/vip-bike/cart",
    pitch: "Гость собирает заказ из аренды, продаж и экипировки, а потом оформляет всё одним оформлением.",
    gives: "Средний чек растёт: гость видит состав заказа перед сделкой.",
    priceStars: 25,
    preview: `${TOURPIX}/cart.webp`,
  },
  {
    key: "profile",
    stop: 11,
    href: "/franchize/vip-bike/profile",
    icon: "🎫",
    title: "Мои аренды",
    page: "/franchize/vip-bike/profile",
    pitch: "Личный кабинет райдера: брони, договоры, статусы и QR-доступы — всё в одном месте, без переписок.",
    gives: "Меньше вопросов «а где мой договор» — всё само.",
    priceStars: 25,
    preview: `${TOURPIX}/profile.webp`,
  },
  {
    key: "price_calc",
    stop: 12,
    href: "/franchize/vip-bike/calc-explainer",
    icon: "🧮",
    title: "Прайс-калькулятор",
    page: "/franchize/vip-bike/calc-explainer",
    pitch: "Каждая цифра в цене объяснена: что входит, что опционально, откуда залог. Ноль «а почему так дорого».",
    gives: "Прозрачный прайс: цена объясняет себя сама — меньше споров.",
    priceStars: 25,
    preview: `${TOURPIX}/price_calc.webp`,
  },
  {
    key: "map_riders",
    stop: 13,
    href: "/franchize/vip-bike/map-riders",
    icon: "🗺",
    title: "Карта райдеров",
    page: "/franchize/vip-bike/map-riders",
    pitch: "Live-карта экипажа: кто где катает, meetup-точки, статусы поездок. Экипаж на ладони.",
    gives: "Живая карта своих райдеров — безопасность и движ экипажа.",
    priceStars: 75,
    preview: `${TOURPIX}/map_riders.webp`,
  },
  {
    key: "community",
    stop: 14,
    href: "/franchize/vip-bike/community",
    icon: "💬",
    title: "Стена сообщества",
    page: "/franchize/vip-bike/community",
    pitch: "Посты, реакции и обсуждения прямо в приложении — экипаж живёт не только в чате.",
    gives: "Своё комьюнити внутри бренда — контент и лояльность.",
    priceStars: 50,
    preview: `${TOURPIX}/community.webp`,
  },
  {
    key: "sales",
    stop: 15,
    href: "/franchize/vip-bike/sales",
    icon: "🏷",
    title: "Витрина продаж",
    page: "/franchize/vip-bike/sales",
    pitch: "Байки на продажу прямо в приложении: карточки с характеристиками, статусами и путем до сделки.",
    gives: "Продажи рядом с арендой — гость дорастает до покупки.",
    priceStars: 50,
    preview: `${TOURPIX}/sales.webp`,
  },
  {
    key: "about",
    stop: 16,
    href: "/franchize/vip-bike/about",
    icon: "📖",
    title: "О нас",
    page: "/franchize/vip-bike/about",
    pitch: "История и характер экипажа: герой-блок, особенности, FAQ — то, что превращает посетителя в своего.",
    gives: "Доверие до сделки: гость знает, куда приходит.",
    priceStars: 25,
    preview: `${TOURPIX}/about.webp`,
  },
  {
    key: "contacts",
    stop: 17,
    href: "/franchize/vip-bike/contacts",
    icon: "📍",
    title: "Контакты",
    page: "/franchize/vip-bike/contacts",
    pitch: "Шоурум на карте, телефон, мессенджеры и часы — путь до сделки в один тап.",
    gives: "Ни один гость не теряется по дороге в шоурум.",
    priceStars: 25,
    preview: `${TOURPIX}/contacts.webp`,
  },
  {
    key: "onboarding",
    stop: 18,
    href: "/franchize/vip-bike/onboarding",
    icon: "🤝",
    title: "Партнёрам",
    page: "/franchize/vip-bike/onboarding",
    pitch: "Страница франшизы: как зайти в проект, что получает экипаж, куда стучаться. Ваш будущий партнёр уже читает её.",
    gives: "Франшиза продаёт себя сама — пока вы катаете.",
    priceStars: 50,
    preview: `${TOURPIX}/onboarding.webp`,
  },
  {
    key: "season_stats",
    stop: 19,
    href: "/franchize/vip-bike/season-stats",
    icon: "📈",
    title: "Цифры сезона",
    page: "/franchize/vip-bike/season-stats",
    pitch: "Весь сезон 2026 до рубля: аренды, продажи, касса и сверка расчётов. Деньги со-владельца — на одном табло.",
    gives: "Финансовое табло экипажа: деньги и сверка без экселя.",
    priceStars: 75,
    preview: `${TOURPIX}/season_stats.webp`,
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

/** The NEXT hop of the trail — stop modal shows its preview («what to expect»). */
export function tourNextFeature(stop: number): TourFeature | undefined {
  return TOUR_FEATURES.find((f) => f.stop === stop + 1);
}

/** Menu link label injected into crews.metadata.franchize.header.menuLinks. */
export const TOUR_MENU_LINK = { label: "⭐ Фичи экипажа", href: "/gift/roman-quest" } as const;
