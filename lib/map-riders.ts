export type MapRiderStatus = "active" | "completed";
export type RideVisibility = "crew" | "all_auth";
export type RideMode = "rental" | "personal";

export interface RiderPoint {
  lat: number;
  lon: number;
  speedKmh: number;
  capturedAt: string;
}

export interface RiderSessionRow {
  id: string;
  crew_slug: string;
  user_id: string;
  ride_name: string | null;
  vehicle_label: string | null;
  ride_mode: RideMode;
  visibility: RideVisibility;
  status: MapRiderStatus;
  sharing_enabled: boolean;
  started_at: string;
  ended_at: string | null;
  last_ping_at: string | null;
  latest_lat: number | null;
  latest_lon: number | null;
  latest_speed_kmh: number | null;
  avg_speed_kmh: number | null;
  max_speed_kmh: number | null;
  total_distance_km: number | null;
  duration_seconds: number | null;
  stats: Record<string, unknown> | null;
  route_bounds: Record<string, unknown> | null;
  users?: {
    username?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

export interface MeetupRow {
  id: string;
  crew_slug: string;
  created_by_user_id: string;
  title: string;
  comment: string | null;
  lat: number;
  lon: number;
  scheduled_at: string | null;
  created_at: string;
  photo_url?: string | null;
  users?: {
    username?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

export function toRad(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return earthRadiusKm * c;
}

export function calcDurationSeconds(startedAt: string, endedAt?: string | null) {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  return Math.max(0, Math.round((end - start) / 1000));
}

export function safeAverageSpeed(distanceKm: number, durationSeconds: number) {
  if (!durationSeconds) return 0;
  return (distanceKm / durationSeconds) * 3600;
}

export function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "MR";
}

export function formatRideDuration(seconds: number) {
  if (seconds === 0) return "Только что начали!";
  if (!Number.isFinite(seconds) || seconds < 0) return "Меньше минуты";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} ч ${minutes} мин`;
  if (minutes <= 0) return "Меньше минуты";
  return `${minutes} мин`;
}

export function riderDisplayName(user: RiderSessionRow["users"] | MeetupRow["users"] | null | undefined, fallbackId?: string) {
  return user?.full_name || user?.username || fallbackId || "Rider";
}

/** Derive a meetup draft (title/comment) from a wall post with a geotag — the
 *  «post → map point» interlink (reverse of the meetup popup's «Написать пост
 *  на стене»). Title: geo label wins over post text (the label is the human
 *  place name the author picked), whitespace collapsed to single spaces so
 *  multi-line posts become one-line titles; both respect the meetups POST
 *  schema caps (title ≤80/min 2, comment ≤240). Clamps are surrogate-pair
 *  aware (emoji-heavy posts must not end in a lone half of 🏁). The comment
 *  credits the POST author (the meetup creator is the tapper, shown by the
 *  popup meta row) so the point's origin stays visible on the map. */
export function meetupDraftFromPost(
  label: string | null | undefined,
  text: string | null | undefined,
  authorName: string,
): { title: string; comment: string } {
  const source = [label?.trim(), text?.trim()].find((value) => (value?.length ?? 0) >= 2);
  const collapsed = (source || "").replace(/\s+/g, " ").trim();
  const title = clampUtf16(collapsed, 80);
  const author = authorName.trim() || "райдер";
  return { title: title.length >= 2 ? title : "Точка из поста", comment: clampUtf16(`Из поста · ${author}`, 240) };
}

/** UTF-16-budget clamp that never leaves a trailing lone surrogate (a sliced
 *  🏁 renders as � and zod/Postgres happily store it). */
function clampUtf16(value: string, max: number): string {
  let cut = value.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  return cut;
}

/** Deep-link to Yandex.Maps routing TO the given point: empty start segment
 *  (`rtext=~lat,lng`) makes the app plan from the user's current location.
 *  Used by the meetup popup «Маршрут» button — riders actually ride to these
 *  points, and the in-app Leaflet map has no turn-by-turn navigation. */
export function yandexMapsRouteUrl(lat: number, lng: number): string {
  const a = Number(lat);
  const b = Number(lng);
  // DB-числовые координаты не бывают NaN, но деградация должна быть валидной
  // ссылкой (карта без маршрута), а не rtext=~NaN,NaN.
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "https://yandex.ru/maps/";
  const coord = `${a.toFixed(6)},${b.toFixed(6)}`;
  return `https://yandex.ru/maps/?rtext=~${encodeURIComponent(coord)}`;
}

/** WCAG relative luminance of an sRGB channel (0..1 input). */
function srgbLuminanceComponent(v: number): number {
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/**
 * Is the given CSS color dark? Pure heuristic for the map-riders sliding
 * sheet: a translucent sheet over a LIGHT map tile layer needs a dark tint,
 * and the tint must follow the CARD theme, not the app theme (a fixed
 * light-themed crew keeps a light sheet in the rider's dark mode).
 * Understands #rgb/#rrggbb/rgba()/rgb()/hsl(); anything unparsable (CSS
 * vars, color-mix, …) conservatively reports DARK — the vip-bike-style dark
 * crews are the case the tint exists for.
 */
export function isDarkCssColor(color: string | null | undefined): boolean {
  const raw = (color ?? "").trim().toLowerCase();
  if (!raw || raw.startsWith("var(") || raw.startsWith("color-mix(")) return true;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/;
  if (hex.test(raw)) {
    const body = raw.slice(1);
    const full = body.length === 3 ? body.split("").map((c) => c + c).join("") : body;
    const r = parseInt(full.slice(0, 2), 16) / 255;
    const g = parseInt(full.slice(2, 4), 16) / 255;
    const b = parseInt(full.slice(4, 6), 16) / 255;
    return 0.2126 * srgbLuminanceComponent(r) + 0.7152 * srgbLuminanceComponent(g) + 0.0722 * srgbLuminanceComponent(b) < 0.2;
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.%]+))?\s*\)$/;
  const m = rgb.exec(raw);
  if (m) {
    const r = Number(m[1]) / 255;
    const g = Number(m[2]) / 255;
    const b = Number(m[3]) / 255;
    if ([r, g, b].some((v) => !Number.isFinite(v) || v < 0 || v > 1)) return true;
    return 0.2126 * srgbLuminanceComponent(r) + 0.7152 * srgbLuminanceComponent(g) + 0.0722 * srgbLuminanceComponent(b) < 0.2;
  }
  return true;
}
