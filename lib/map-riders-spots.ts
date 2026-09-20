// lib/map-riders-spots.ts
// ─────────────────────────────────────────────────────────────────────────────
// Мототочки Нижнего Новгорода — статичный каталог «spots» для карты райдеров
// (аналог discover-слоя из map-соцсетей для байкеров: Chain / Detecht /
// calimoto — у нас скоуп меньше: один город, но каждая точка = экипаж со
// своей стеной).
//
// Почему константа в репо, а не таблица:
//   · данные кураторские (редко меняются, маленький объём);
//   · ноль RLS/чеков на чтение — слой работает даже для анонимов;
//   · source-assertable в тестах (coords внутри bbox НН, уникальные slug).
// Экипажи-«заглушки» под каждую точку сеет SQL-миграция
// supabase/migrations/20260921000000_seed_nn_moto_spot_crews.sql — slug
// экипажа = spot.slug, поэтому попапы могут ссылаться на /franchize/<slug>/
// community и /franchize/<slug>/map-riders напрямую.
//
// ⚠️ Синхронизация: slug/name/coords/address должны совпадать с миграцией.
// Тест map-wall-interlink.spec.ts сверяет каталог с SQL-файлом по slugs.
// ─────────────────────────────────────────────────────────────────────────────

export const MOTO_SPOT_KINDS = ["club", "rental", "shop", "service", "school", "landmark"] as const;
export type MotoSpotKind = (typeof MOTO_SPOT_KINDS)[number];

export interface MotoSpot {
  /** Устойчивый id — используется в ?spot= параметре стены (check-in). */
  id: string;
  /** Slug dummy-экипажа точки (crews.slug, сеет миграция). */
  slug: string;
  name: string;
  kind: MotoSpotKind;
  address: string;
  hint: string;
  /** [lat, lon] — тот же порядок, что PointOfInterest.coords. */
  coords: [number, number];
  color: string;
}

const KIND_META: Record<MotoSpotKind, { label: string; icon: string }> = {
  club: { label: "Мотоклуб", icon: "::FaFlagCheckered::" },
  rental: { label: "Прокат / кросс", icon: "::FaMotorcycle::" },
  shop: { label: "Мотосалон", icon: "::FaStore::" },
  service: { label: "Мотосервис", icon: "::FaWrench::" },
  school: { label: "Обучение", icon: "::FaGraduationCap::" },
  landmark: { label: "Место силы", icon: "::FaLocationDot::" },
};

export function motoSpotKindLabel(kind: MotoSpotKind): string {
  return KIND_META[kind].label;
}

export function motoSpotKindIcon(kind: MotoSpotKind): string {
  return KIND_META[kind].icon;
}

/**
 * Каталог мототочек НН. Координаты:
 *  · Байк Ленд — точные GPS из карточки магазина (Ошарская, 14);
 *  · остальные — приблизительная привязка по адресу (±100–200 м):
 *    точность для «взглянуть на карте» достаточна, навигацию юзер включит сам.
 */
export const NN_MOTO_SPOTS: MotoSpot[] = [
  {
    id: "nn-motomesto",
    slug: "nn-motomesto",
    name: "Мотоместо НН",
    kind: "club",
    address: "Комсомольская ул., 1",
    hint: "Мотоклуб «для тех, у кого жизнь — это мотоцикл». Рядом с пл. Комсомольской — историческая тусовка канавинских райдеров.",
    coords: [56.2958, 43.9478],
    color: "#ef4444",
  },
  {
    id: "nn-motoclub-cross",
    slug: "nn-motoclub-cross",
    name: "MOTOCLUB НН • кросс",
    kind: "rental",
    address: "ул. Придорожная, 31 (Сормово)",
    hint: "Прокат кроссовых мотоциклов и площадка. 9:00–21:00, свой трек для начинающих.",
    coords: [56.3272, 43.8595],
    color: "#06b6d4",
  },
  {
    id: "nn-bikeland",
    slug: "nn-bikeland",
    name: "Байк Ленд Нижний Новгород",
    kind: "shop",
    address: "ул. Ошарская, 14",
    hint: "Сетевой мотомагазин: экипировка, запчасти, расходники. 9:00–22:00 без выходных.",
    coords: [56.32124, 44.00945],
    color: "#3b82f6",
  },
  {
    id: "nn-rolling-moto",
    slug: "nn-rolling-moto",
    name: "Роллинг Мото",
    kind: "shop",
    address: "Московское шоссе, 137а",
    hint: "Мотосалон с сервисом — федеральная сеть. Техосмотр перед сезоном делают быстро.",
    coords: [56.2652, 43.856],
    color: "#3b82f6",
  },
  {
    id: "nn-mototeh-nn",
    slug: "nn-mototeh-nn",
    name: "Мототех НН",
    kind: "shop",
    address: "ул. Артельная, 15б",
    hint: "Честный мотосалон: запчасти, техника, сервис. Ценят за то, что не впаривают.",
    coords: [56.2755, 43.916],
    color: "#3b82f6",
  },
  {
    id: "nn-motogor",
    slug: "nn-motogor",
    name: "Мотогор",
    kind: "shop",
    address: "ул. Коминтерна, 35а (Автозавод)",
    hint: "Мотосалон на Автозаводе — соцгород держится на нём между сезонами.",
    coords: [56.2362, 43.8407],
    color: "#3b82f6",
  },
  {
    id: "nn-motoservice-nn",
    slug: "nn-motoservice-nn",
    name: "Мотосервис-НН",
    kind: "service",
    address: "Мотальный пер., 11А",
    hint: "Ремонт и обслуживание, включая эндуро и трициклы. Мотальный переулок — само имя обязывает.",
    coords: [56.2881, 43.9085],
    color: "#22c55e",
  },
  {
    id: "nn-krossmoto",
    slug: "nn-krossmoto",
    name: "КроссМото НН",
    kind: "school",
    address: "ул. Мунина, 40к20",
    hint: "Катание и обучение на мотоциклах — постановка корпуса, МФР, первые поездки.",
    coords: [56.2895, 43.902],
    color: "#8b5cf6",
  },
  {
    id: "nn-mototehnika52",
    slug: "nn-mototehnika52",
    name: "Мототехника 52",
    kind: "service",
    address: "Магистральная ул., 136Е (Афонино)",
    hint: "Салон + сервис + экипировка на выезде из города, официальный дилер.",
    coords: [56.2447, 44.0292],
    color: "#22c55e",
  },
  {
    id: "nn-minin-square",
    slug: "nn-minin-square",
    name: "пл. Минина и Пожарского",
    kind: "landmark",
    address: "Верхняя часть города",
    hint: "Традиционный старт открытия мотосезона: колонна собирается здесь и уходит по Большой Покровской.",
    coords: [56.3122, 44.0059],
    color: "#f97316",
  },
  {
    id: "nn-nizhnevolzhskaya",
    slug: "nn-nizhnevolzhskaya",
    name: "Нижневолжская набережная",
    kind: "landmark",
    address: "У Стрелки",
    hint: "Вечерние сходки у Волги: стрелка, вид на собор, фото на фоне заката — must для постов на стене.",
    coords: [56.3103, 44.0002],
    color: "#f97316",
  },
];

/** Верифицированный id точки (?spot=) — иначе null. */
export function findMotoSpotById(id: string | null | undefined): MotoSpot | null {
  const raw = (id ?? "").trim().toLowerCase();
  if (!/^[a-z0-9-]{1,64}$/.test(raw)) return null;
  return NN_MOTO_SPOTS.find((s) => s.id === raw) ?? null;
}

/**
 * Текст check-in черновика для стены («отметился в точке»).
 * Чистая функция — используется стеной (composer prefill) и тестируется.
 */
export function buildSpotCheckinText(spot: MotoSpot): string {
  return `📍 Отметился: ${spot.name} (${motoSpotKindLabel(spot.kind)}) — ${spot.address}. ${spot.hint} #mapriders`;
}
