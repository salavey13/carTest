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
