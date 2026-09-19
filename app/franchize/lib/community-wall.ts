// app/franchize/lib/community-wall.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// OnlyBike community wall — pure logic shared by the server actions
// (server-actions/community-wall.ts) and the client feed component. No
// Supabase / React imports here, so it unit-tests trivially (mirrors the
// lib/bike-wall.ts pattern).
// ─────────────────────────────────────────────────────────────────────────────

// ── Stats snapshot ───────────────────────────────────────────────────────────

/** Minimal bike info needed for stats (from cars: id/title/type). */
export interface StatsBikeInfo {
  id: string;
  title: string;
  /** cars.type — only 'bike' counts toward ride stats (equipment/service don't). */
  type: string;
}

/** Minimal rental row needed for stats (from rentals). */
export interface StatsRentalRow {
  vehicle_id: string | null;
  status: string | null;
  total_cost: number | string | null;
  agreed_start_date: string | null;
  agreed_end_date: string | null;
  requested_start_date: string | null;
  requested_end_date: string | null;
}

/**
 * Immutable snapshot stored in crew_posts.stats for kind='stats' posts.
 * Money rule mirrors lib/bike-wall.ts: cancelled rentals are excluded and
 * count ₽0. Only cars.type='bike' counts — helmet/gear/service rows would
 * inflate the ride counters.
 */
export interface RentalStatsSnapshot {
  ridesCount: number;
  /** ceil(end − start) hours, min 1 per dated rental — city rentals are hourly. */
  hoursRented: number;
  totalSpent: number;
  bikesUsed: number;
  firstRideAt: string | null;
  lastRideAt: string | null;
  /** Per-bike ride counts, sorted by count desc then title. */
  bikes: { vehicleId: string; title: string; count: number }[];
}

/** Rental period resolution: agreed dates win, requested dates fill in. */
function rentalPeriod(row: StatsRentalRow): { startIso: string | null; endIso: string | null } {
  return {
    startIso: row.agreed_start_date ?? row.requested_start_date ?? null,
    endIso: row.agreed_end_date ?? row.requested_end_date ?? null,
  };
}

/** Hours for one rental: ceil((end − start) / 1h), min 1 when dates exist. */
export function rentalHours(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): number {
  if (!startIso) return 0;
  const s = Date.parse(startIso);
  const e = endIso ? Date.parse(endIso) : Number.NaN;
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return 1; // started but undated/zero-length → at least an hour on the road
  return Math.max(1, Math.ceil((e - s) / (60 * 60 * 1000)));
}

/** toNum: REST may hand numerics back as string in odd setups. */
function toNum(v: number | string | null | undefined): number {
  const n = typeof v === "number" ? v : Number.parseFloat(v ?? "");
  return Number.isFinite(n) ? n : 0;
}

export function computeRiderStats(
  rows: StatsRentalRow[],
  bikesById: Map<string, StatsBikeInfo>,
): RentalStatsSnapshot {
  const perBike = new Map<string, number>();
  let hoursRented = 0;
  let totalSpent = 0;
  let firstRideAt: string | null = null;
  let lastRideAt: string | null = null;
  let ridesCount = 0;

  for (const row of rows) {
    if (!row.vehicle_id) continue;
    // Money rule (bike-wall parity): cancelled/expired-limbo → ₽0, not a ride.
    if (!RIDE_EARNING_STATUSES.has(row.status ?? "")) continue;
    // Only real bikes count: the-meta-helmet / service items / parts would lie.
    const bike = bikesById.get(row.vehicle_id);
    if (!bike || bike.type !== "bike") continue;

    ridesCount += 1;
    totalSpent += toNum(row.total_cost);

    const { startIso, endIso } = rentalPeriod(row);
    hoursRented += rentalHours(startIso, endIso);
    if (startIso) {
      if (!firstRideAt || startIso < firstRideAt) firstRideAt = startIso;
      if (!lastRideAt || startIso > lastRideAt) lastRideAt = startIso;
    }

    perBike.set(row.vehicle_id, (perBike.get(row.vehicle_id) ?? 0) + 1);
  }

  const bikes = [...perBike.entries()]
    .map(([vehicleId, count]) => ({
      vehicleId,
      title: bikesById.get(vehicleId)?.title || vehicleId,
      count,
    }))
    .sort((a, b) => (b.count - a.count) || a.title.localeCompare(b.title));

  return {
    ridesCount,
    hoursRented,
    totalSpent,
    bikesUsed: bikes.length,
    firstRideAt,
    lastRideAt,
    bikes,
  };
}

/** Auto-text for a stats post when the rider submits without typing anything. */
export function buildStatsPostBody(stats: RentalStatsSnapshot): string {
  if (stats.ridesCount === 0) {
    return "Пока без поездок — но я в деле! 🏍";
  }
  const bikesPart = stats.bikesUsed > 0 ? ` на ${stats.bikesUsed} ${pluralRu(stats.bikesUsed, ["байке", "байках", "байках"])}` : "";
  return `Мой вайб этого экипажа: ${stats.ridesCount} ${pluralRu(stats.ridesCount, ["поездка", "поездки", "поездок"])}${bikesPart}, ${stats.hoursRented} ${pluralRu(stats.hoursRented, ["час", "часа", "часов"])} в седле 🏍💨`;
}

// ── Russian plural / time formatting (no Intl → timezone-stable tests) ──────

/** Russian plural: pluralRu(5, ["поездка","поездки","поездок"]) → "поездок". */
export function pluralRu(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(Math.trunc(n));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

const RU_MONTHS_GEN = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/**
 * VK-wall style relative time in Russian: «только что», «7 мин», «3 ч»,
 * «вчера» (calendar yesterday only), «2 дн», then a date «12 сен» / «12 сен 2025».
 */
export function formatRelativeTimeRu(
  iso: string | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (!iso) return "";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  const diffMs = nowMs - ts;
  if (diffMs < 0) return "только что";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} ${pluralRu(minutes, ["минуту", "минуты", "минут"])} назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${pluralRu(hours, ["час", "часа", "часов"])} назад`;
  // Calendar-day diff: 40h ago spanning two midnight crossings is «2 дня»,
  // not the misleading «вчера» of a naive 24–48h window.
  const startOfDay = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const dayDiff = Math.round((startOfDay(nowMs) - startOfDay(ts)) / 86400000);
  if (dayDiff === 1) return "вчера";
  if (dayDiff < 7) return `${dayDiff} ${pluralRu(dayDiff, ["день", "дня", "дней"])} назад`;
  const d = new Date(ts);
  const year = d.getFullYear();
  const nowYear = new Date(nowMs).getFullYear();
  const base = `${d.getDate()} ${RU_MONTHS_GEN[d.getMonth()]}`;
  return year === nowYear ? base : `${base} ${year}`;
}

/** Full RU date for comment timestamps «12 сен, 14:05». */
export function formatDateTimeRu(iso: string | null | undefined, nowMs: number = Date.now()): string {
  if (!iso) return "";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  const d = new Date(ts);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${d.getDate()} ${RU_MONTHS_GEN[d.getMonth()]}, ${time}`;
}

/** ₽ formatter: 12 400 ₽ (narrow nbsp). */
export function formatRub(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "−" : "";
  const digits = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return `${sign}${digits} ₽`;
}

// ── Telegram initData user parsing (pure part of identity resolution) ────────

export interface TelegramInitDataUser {
  id: string;
  username: string | null;
  fullName: string | null;
  photoUrl: string | null;
}

/**
 * Extract the Telegram user from a raw initData query string WITHOUT verifying
 * it — the server action must HMAC-verify the whole string first
 * (lib/telegram-webapp-auth.ts) and only then trust the parsed user.
 */
export function parseTelegramInitDataUser(initDataString: string): TelegramInitDataUser | null {
  try {
    const params = new URLSearchParams(initDataString);
    const raw = params.get("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      id?: number | string;
      username?: string;
      first_name?: string;
      last_name?: string;
      photo_url?: string;
    };
    if (parsed.id === undefined || parsed.id === null || String(parsed.id).trim() === "") return null;
    const fullName = [parsed.first_name, parsed.last_name]
      .map((p) => (typeof p === "string" ? p.trim() : ""))
      .filter(Boolean)
      .join(" ");
    return {
      id: String(parsed.id).trim(),
      username: typeof parsed.username === "string" && parsed.username.trim() ? parsed.username.trim() : null,
      fullName: fullName || null,
      photoUrl: typeof parsed.photo_url === "string" && parsed.photo_url.trim() ? parsed.photo_url.trim() : null,
    };
  } catch {
    return null;
  }
}

// ── Feed view types (server action response → client component) ─────────────

export interface WallAuthorView {
  userId: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface WallCommentView {
  id: string;
  postId: string;
  author: WallAuthorView;
  /** 'crew' | 'rider' — author_scope copied from nothing: derived at render from author badge needs. */
  body: string;
  createdAt: string;
}

export interface WallRentalRef {
  rentalId: string;
  bikeTitle: string;
  imageUrl: string | null;
}

export interface WallPostView {
  id: string;
  kind: "post" | "stats";
  body: string;
  stats: RentalStatsSnapshot | null;
  authorScope: "crew" | "rider";
  isPinned: boolean;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedByViewer: boolean;
  author: WallAuthorView;
  comments: WallCommentView[];
  rental: WallRentalRef | null;
}

export interface WallViewerInfo {
  /** null = anonymous web visitor (read-only). */
  userId: string | null;
  /** owner / active member / global admin — can moderate the wall. */
  isCrewStaff: boolean;
}

/** Money rule (lib/bike-wall.ts EARNING_STATUSES parity): statuses that count
 *  as a real ride / earn money. Cancelled AND expired-limbo rows never do. */
export const RIDE_EARNING_STATUSES = new Set(["completed", "active", "confirmed", "pending_confirmation"]);

/** Rate limits (DB-count based, multi-instance safe). */
export const WALL_RATE_POSTS_PER_HOUR = 10;
export const WALL_RATE_COMMENTS_PER_HOUR = 40;
/** Cap for the expansion fetch of one post's comments. */
export const WALL_COMMENTS_FETCH_LIMIT = 200;
/** How many comments the feed ships per post up-front (rest load on expand). */
export const WALL_COMMENT_PREVIEW = 2;
/** Feed page size for the "показать ещё" cursor. */
export const WALL_FEED_PAGE_SIZE = 25;
/** Body length limits (server validates, client mirrors with a counter). */
export const WALL_POST_MAX_LEN = 2000;
export const WALL_COMMENT_MAX_LEN = 500;
