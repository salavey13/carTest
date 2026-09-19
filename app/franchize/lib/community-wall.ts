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
  /** Set when this comment is a reply to another comment (VK-style, one level). */
  replyTo: { commentId: string; authorName: string } | null;
  body: string;
  createdAt: string;
}

export interface WallRentalRef {
  rentalId: string;
  bikeTitle: string;
  imageUrl: string | null;
}

/** Photo on a wall post (public wallpix bucket URL, ready to render). */
export interface WallPhotoView {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
}

/** Catalogue bike attached («mentioned») to a wall post. */
export interface WallBikeRefView {
  bikeId: string;
  title: string;
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
  /** TOTAL reactions across all emoji (legacy name kept from the like era). */
  likeCount: number;
  commentCount: number;
  /** Per-emoji counts — only keys with count > 0 are present. */
  reactionCounts: Record<string, number>;
  /** The viewer's own reaction emoji, or null (VK: re-tap removes). */
  viewerReaction: string | null;
  author: WallAuthorView;
  comments: WallCommentView[];
  rental: WallRentalRef | null;
  photos: WallPhotoView[];
  bikes: WallBikeRefView[];
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

// ── Photos + bike mentions (wall v2) ─────────────────────────────────────────

/** Max photos per wall post (client picker + server both enforce). */
export const WALL_PHOTOS_MAX = 6;
/** Max catalogue bikes attachable to one post. */
export const WALL_BIKES_MAX = 3;
/** Storage bucket for wall photos (created by migration 20260919220000). */
export const WALLPHOTO_BUCKET = "wallpix";

/**
 * Public CDN URL of a wall photo — the bucket is public by design (the feed
 * itself is public), so no signed-URL round trips are needed.
 */
export function wallPhotoPublicUrl(storagePath: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  // encodeURIComponent per segment: paths contain "/" separators that must stay.
  const encoded = storagePath.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${WALLPHOTO_BUCKET}/${encoded}`;
}

const STAGING_FILE_RE = /^[A-Za-z0-9_-]{8,64}\.(jpg|jpeg|png|webp)$/;

/**
 * A staging path is only trustworthy if it lives in the CALLER's own folder:
 * `staging/<userId>/<uuid>.<ext>`. Anything else (other users' staging files,
 * `posts/...` finals, `..` traversal) is rejected before we ever move storage
 * objects or insert rows.
 */
export function isWallStagingPath(storagePath: string, userId: string): boolean {
  if (!storagePath || !userId) return false;
  const prefix = `staging/${userId}/`;
  if (!storagePath.startsWith(prefix)) return false;
  const fileName = storagePath.slice(prefix.length);
  return STAGING_FILE_RE.test(fileName);
}

/** Raw photo payload the composer sends with createPost (pre-validation). */
export interface WallPhotoInput {
  path: string;
  width?: number;
  height?: number;
  bytes?: number;
}

export interface SanitizedWallPhoto {
  path: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
}

/**
 * Validate the composer's photo list server-side:
 * ≤ WALL_PHOTOS_MAX items, every path is the actor's own staging path,
 * dimensions/size are sane integers or dropped. Returns null when the whole
 * list is invalid (wrong type, too many) — the action then rejects the post.
 */
export function sanitizeWallPhotoInputs(
  raw: unknown,
  userId: string,
): SanitizedWallPhoto[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > WALL_PHOTOS_MAX) return null;
  const out: SanitizedWallPhoto[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const rec = item as Record<string, unknown>;
    if (typeof rec.path !== "string" || !isWallStagingPath(rec.path, userId)) return null;
    if (seen.has(rec.path)) continue; // duplicate attach → keep one
    seen.add(rec.path);
    const int = (v: unknown, max: number): number | null =>
      typeof v === "number" && Number.isInteger(v) && v > 0 && v <= max ? v : null;
    out.push({
      path: rec.path,
      width: int(rec.width, 20000),
      height: int(rec.height, 20000),
      bytes: int(rec.bytes, 20 * 1024 * 1024),
    });
  }
  return out;
}

/**
 * cars.id is TEXT — a catalogue slug like «kawasaki-ex650k» (see
 * 20240101000000_init.sql: `id TEXT PRIMARY KEY`), NOT a uuid. So ids are
 * validated as sane opaque strings: printable, no whitespace/control chars,
 * bounded length. Returns null when the payload shape is wrong (caller
 * rejects), [] when nothing is attached.
 */
const WALL_BIKE_ID_RE = /^[A-Za-z0-9._:@-]{1,128}$/;

export function sanitizeWallBikeIds(raw: unknown): string[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > WALL_BIKES_MAX) return null;
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !WALL_BIKE_ID_RE.test(item)) return null;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

// ── Rich text tokens: @mentions, #hashtags, links (pure, unit-tested) ────────

export type WallTextToken =
  | { type: "text"; value: string }
  | { type: "mention"; value: string }
  | { type: "hashtag"; value: string }
  | { type: "url"; value: string };

/** Telegram usernames: 5–32 chars of [A-Za-z0-9_]; we accept ≥4 to be liberal. */
const MENTION_RE = /@[A-Za-z0-9_]{4,32}/g;
/** Latin + Cyrillic hashtags, 2–40 chars after #. */
const HASHTAG_RE = /#[\p{L}\p{N}_]{2,40}/gu;
const URL_RE = /https?:\/\/[^\s<>"']+/g;

/** Chars that would glue a sentence to a URL — trimmed off the token end. */
const URL_TRAILING_PUNCT = /[.,;:!?)»”]+$/;

/**
 * Split wall text (post bodies, comments) into safe render tokens.
 * Deliberately render-ONLY: mentions never auto-resolve to users (no
 * enumeration), hashtags become clickable filters in the UI, URLs render as
 * plain anchor tags. Longest-match wins at the same position (a URL may
 * contain a hashtag — the URL token swallows it); emails are not mentions;
 * sentence punctuation after a URL stays text.
 */
export function parseWallText(text: string): WallTextToken[] {
  if (!text) return [];
  const marks: { start: number; end: number; token: WallTextToken }[] = [];

  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    let raw = m[0];
    // «смотри https://x.com.» — the trailing dot ends the sentence, not the URL.
    const punct = raw.match(URL_TRAILING_PUNCT);
    if (punct) raw = raw.slice(0, raw.length - punct[0].length);
    marks.push({ start, end: start + raw.length, token: { type: "url", value: raw } });
    // trimmed punctuation stays plain text
    if (punct) {
      marks.push({ start: start + raw.length, end: start + m[0].length, token: { type: "text", value: punct[0] } });
    }
  }
  const overlaps = (s: number, e: number) => marks.some((k) => s < k.end && e > k.start);
  for (const m of text.matchAll(MENTION_RE)) {
    const start = m.index ?? 0;
    // Left-boundary check: «mail@test.com» is an email, not a mention — a
    // @ preceded by a word char / dot / another @ is part of the word.
    const prev = start > 0 ? text[start - 1] : "";
    if (/[\w.@]/.test(prev)) continue;
    if (!overlaps(start, start + m[0].length)) {
      marks.push({ start, end: start + m[0].length, token: { type: "mention", value: m[0] } });
    }
  }
  for (const m of text.matchAll(HASHTAG_RE)) {
    const start = m.index ?? 0;
    if (!overlaps(start, start + m[0].length)) {
      marks.push({ start, end: start + m[0].length, token: { type: "hashtag", value: m[0] } });
    }
  }

  marks.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: WallTextToken[] = [];
  let pos = 0;
  for (const mark of marks) {
    if (mark.start < pos) continue; // defensive: no overlap should survive the filter, but stay safe
    if (mark.start > pos) out.push({ type: "text", value: text.slice(pos, mark.start) });
    out.push(mark.token);
    pos = mark.end;
  }
  if (pos < text.length) out.push({ type: "text", value: text.slice(pos) });
  return out;
}

/** Tag body for iteration-3 filtering (lowercased, no #). */
export function hashtagKey(hashtag: string): string {
  return hashtag.slice(1).toLowerCase();
}

// ── Emoji reactions (wall v3, VK-style) ──────────────────────────────────────

/**
 * The reaction bar set, in display order. ❤️ first = the default quick-tap
 * reaction (VK behaviour). MUST stay in sync with the CHECK constraint on
 * crew_post_reactions.emoji (migration 20260920010000).
 */
export const WALL_REACTIONS = ["❤️", "🔥", "😂", "😮", "👍", "🏍"] as const;
export type WallReaction = (typeof WALL_REACTIONS)[number];

export function isValidWallReaction(value: unknown): value is WallReaction {
  return typeof value === "string" && (WALL_REACTIONS as readonly string[]).includes(value);
}

/**
 * Server-side hygiene for the jsonb counter blob: keep only known emoji keys
 * with positive integer counts (anything else from the DB is dropped, not
 * trusted).
 */
export function sanitizeReactionCounts(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isValidWallReaction(key)) continue;
    if (typeof value === "number" && Number.isInteger(value) && value > 0) out[key] = value;
  }
  return out;
}

/**
 * Pure optimistic math behind a reaction tap (client mirrors the server
 * trigger so the UI updates instantly and can roll back on error):
 *  - previous reaction removed from counts/total;
 *  - tapping the SAME emoji removes it (VK: re-tap = undo);
 *  - tapping a NEW one switches the reaction (no double count).
 */
export function toggleReactionOptimistic(
  counts: Record<string, number>,
  total: number,
  prev: string | null,
  emoji: string,
): { counts: Record<string, number>; total: number; next: string | null } {
  const map: Record<string, number> = { ...counts };
  let t = total;
  if (prev && prev !== emoji) {
    const dec = (map[prev] ?? 1) - 1;
    if (dec > 0) map[prev] = dec;
    else delete map[prev];
    t -= 1;
  }
  if (prev === emoji) {
    const dec = (map[prev] ?? 1) - 1;
    if (dec > 0) map[prev] = dec;
    else delete map[prev];
    t -= 1;
    return { counts: map, total: Math.max(0, t), next: null };
  }
  map[emoji] = (map[emoji] ?? 0) + 1;
  t += 1;
  return { counts: map, total: Math.max(0, t), next: emoji };
}

// ── Lightbox zoom math (pure, unit-tested) ───────────────────────────────────

export interface ZoomAnchorState {
  /** Scale before the gesture frame. */
  startScale: number;
  /** Pan offset before the gesture frame (px). */
  startOffset: { x: number; y: number };
  /** Pinch/gesture midpoint at gesture start (viewport px). */
  startMid: { x: number; y: number };
  /** Pinch/gesture midpoint now (viewport px). */
  currentMid: { x: number; y: number };
  /** Stage centre (viewport px) — the transform-origin of the image. */
  center: { x: number; y: number };
  /** Target scale (already clamped by the caller). */
  nextScale: number;
}

/**
 * Pan offset that keeps the gesture midpoint visually anchored while zooming:
 *   o' = (m₀ − c)(1 − r) + o₀·r + (m₁ − m₀),  r = s'/s₀
 * The `o₀·r` term preserves the pan the user already had (pinch after pan
 * used to snap the image back to centre); the ratio (not a linear delta)
 * keeps the anchor exact at any start scale.
 */
export function computeZoomOffset(state: ZoomAnchorState): { x: number; y: number } {
  const r = state.nextScale / Math.max(state.startScale, 0.0001);
  return {
    x: (state.startMid.x - state.center.x) * (1 - r) + state.startOffset.x * r + (state.currentMid.x - state.startMid.x),
    y: (state.startMid.y - state.center.y) * (1 - r) + state.startOffset.y * r + (state.currentMid.y - state.startMid.y),
  };
}

/** Zoom-to-point for wheel/double-tap: same math, midpoint = pointer, o₀ = current. */
export function zoomAtPoint(
  currentScale: number,
  currentOffset: { x: number; y: number },
  point: { x: number; y: number },
  center: { x: number; y: number },
  nextScale: number,
): { x: number; y: number } {
  return computeZoomOffset({
    startScale: currentScale,
    startOffset: currentOffset,
    startMid: point,
    currentMid: point,
    center,
    nextScale,
  });
}

// ── TG notification message builder (pure, unit-tested) ─────────────────────

/** Short one-line preview of a post body for the TG notification. */
export function buildWallPostPreview(body: string | null | undefined, max = 220): string {
  const flat = String(body ?? "").replace(/\s+/g, " ").trim();
  if (!flat) return "";
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
}

/** Escapes HTML special chars for Telegram HTML parse mode. */
export function escapeTelegramHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface WallPostNotifyInfo {
  authorName: string;
  body: string;
  photoCount: number;
  bikeTitles: string[];
  hasStats: boolean;
}

/**
 * HTML message for «new post on the wall» crew notifications. Pure — the
 * delivery transport lives in lib/wall-notify.ts; this builder is unit-tested
 * without any Supabase/Telegram imports.
 */
export function buildWallPostNotifyHtml(info: WallPostNotifyInfo): string {
  const lines: string[] = ["🟣 <b>Новый пост на стене экипажа</b>", ""];
  lines.push(`👤 ${escapeTelegramHtml(info.authorName || "Райдер")}`);
  const preview = buildWallPostPreview(info.body);
  if (preview) lines.push(`💬 «${escapeTelegramHtml(preview)}»`);
  if (info.photoCount > 0) {
    lines.push(`📷 ${info.photoCount} ${pluralRu(info.photoCount, ["фото", "фото", "фото"])}`);
  }
  if (info.bikeTitles.length > 0) {
    lines.push(`🏍 ${info.bikeTitles.map(escapeTelegramHtml).join(", ")}`);
  }
  if (info.hasStats) lines.push(`📊 делится статистикой поездок`);
  return lines.join("\n");
}
