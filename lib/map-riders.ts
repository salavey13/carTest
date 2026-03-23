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
  users?: {
    username?: string | null;
    full_name?: string | null;
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
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} ч ${minutes} мин`;
  return `${minutes} мин`;
}

export function riderDisplayName(user: RiderSessionRow["users"] | MeetupRow["users"] | null | undefined, fallbackId?: string) {
  return user?.full_name || user?.username || fallbackId || "Rider";
}
