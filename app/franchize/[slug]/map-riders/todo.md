

**TASK: Optimize MapRiders for 100+ concurrent riders on Supabase Free Tier**  
**Goal:** Replace heavy realtime writes/polling on `map_rider_points` with the new `live_locations` table + broadcast pattern (exactly as we did for live GPS).  
Keep **all existing functionality** (sessions, persistent points, meetups, leaderboards, route replay, VibeMap, stats) — just make the **live layer** scale perfectly.

### 1. Database — no changes needed
You already ran the perfect `live_locations` table + RLS (with JWT `auth.jwt() ->> 'chat_id'`).  
Leave `map_rider_sessions`, `map_rider_points` and `map_rider_meetups` exactly as they are — they are for **history and stats**.
FYI:
```sql
BEGIN;

DROP TABLE IF EXISTS public.live_locations CASCADE;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS public.live_locations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id text NOT NULL REFERENCES public.users(user_id),
  crew_slug text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  speed_kmh double precision,
  heading double precision,
  is_riding boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  location geography(POINT, 4326) GENERATED ALWAYS AS (
    ST_MakePoint(lng, lat)
  ) STORED
);

CREATE INDEX idx_live_locations_location ON public.live_locations USING GIST (location);
CREATE INDEX idx_live_locations_user_crew ON public.live_locations (user_id, crew_slug);
CREATE INDEX idx_live_locations_crew ON public.live_locations (crew_slug);
CREATE INDEX idx_live_locations_updated ON public.live_locations (updated_at);

ALTER TABLE public.live_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "riders see only nearby in same crew" ON public.live_locations;
DROP POLICY IF EXISTS "users can upsert own location" ON public.live_locations;
DROP POLICY IF EXISTS "users can update own location" ON public.live_locations;
DROP POLICY IF EXISTS "users can delete own location" ON public.live_locations;

CREATE POLICY "riders see only nearby in same crew"
ON public.live_locations
FOR SELECT
USING (
  crew_slug = (
    SELECT metadata->>'slug'
    FROM public.crews
    WHERE id = (
      SELECT crew_id
      FROM public.crew_members
      WHERE user_id = (auth.jwt() ->> 'chat_id')
      LIMIT 1
    )
  )
  AND (
    user_id = (auth.jwt() ->> 'chat_id')
    OR ST_DWithin(
      location,
      (SELECT location
       FROM public.live_locations
       WHERE user_id = (auth.jwt() ->> 'chat_id')
       ORDER BY updated_at DESC
       LIMIT 1),
      15000
    )
  )
);

CREATE POLICY "users can insert own location"
ON public.live_locations
FOR INSERT
WITH CHECK (user_id = (auth.jwt() ->> 'chat_id'));

CREATE POLICY "users can update own location"
ON public.live_locations
FOR UPDATE
USING (user_id = (auth.jwt() ->> 'chat_id'))
WITH CHECK (user_id = (auth.jwt() ->> 'chat_id'));

CREATE POLICY "users can delete own location"
ON public.live_locations
FOR DELETE
USING (user_id = (auth.jwt() ->> 'chat_id'));

COMMIT;
```
applyed to supabase successfully.


my current maphriders approach:
```sql
create extension if not exists pgcrypto;

create table if not exists public.map_rider_sessions (
  id uuid primary key default gen_random_uuid(),
  crew_slug text not null,
  user_id text not null references public.users(user_id) on delete cascade,
  ride_name text,
  vehicle_label text,
  ride_mode text not null default 'rental' check (ride_mode in ('rental', 'personal')),
  visibility text not null default 'crew' check (visibility in ('crew', 'all_auth')),
  status text not null default 'active' check (status in ('active', 'completed')),
  sharing_enabled boolean not null default true,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_ping_at timestamptz,
  latest_lat double precision,
  latest_lon double precision,
  latest_speed_kmh double precision not null default 0,
  avg_speed_kmh double precision not null default 0,
  max_speed_kmh double precision not null default 0,
  total_distance_km double precision not null default 0,
  duration_seconds integer not null default 0,
  stats jsonb not null default '{}'::jsonb,
  route_bounds jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists map_rider_sessions_crew_slug_idx on public.map_rider_sessions (crew_slug, status, started_at desc);
create index if not exists map_rider_sessions_user_idx on public.map_rider_sessions (user_id, started_at desc);

create table if not exists public.map_rider_points (
  id bigserial primary key,
  session_id uuid not null references public.map_rider_sessions(id) on delete cascade,
  crew_slug text not null,
  user_id text not null references public.users(user_id) on delete cascade,
  lat double precision not null,
  lon double precision not null,
  speed_kmh double precision not null default 0,
  heading_deg double precision,
  accuracy_meters double precision,
  captured_at timestamptz not null default now()
);

create index if not exists map_rider_points_session_idx on public.map_rider_points (session_id, captured_at asc);
create index if not exists map_rider_points_crew_idx on public.map_rider_points (crew_slug, captured_at desc);

create table if not exists public.map_rider_meetups (
  id uuid primary key default gen_random_uuid(),
  crew_slug text not null,
  created_by_user_id text not null references public.users(user_id) on delete cascade,
  title text not null,
  comment text,
  lat double precision not null,
  lon double precision not null,
  scheduled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists map_rider_meetups_crew_idx on public.map_rider_meetups (crew_slug, created_at desc);

alter table public.map_rider_sessions enable row level security;
alter table public.map_rider_points enable row level security;
alter table public.map_rider_meetups enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'map_rider_sessions' and policyname = 'Public can read map rider sessions'
  ) then
    create policy "Public can read map rider sessions" on public.map_rider_sessions for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'map_rider_points' and policyname = 'Public can read map rider points'
  ) then
    create policy "Public can read map rider points" on public.map_rider_points for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'map_rider_meetups' and policyname = 'Public can read map rider meetups'
  ) then
    create policy "Public can read map rider meetups" on public.map_rider_meetups for select using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'map_rider_sessions'
  ) then
    alter publication supabase_realtime add table public.map_rider_sessions;
  end if;

  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'map_rider_meetups'
  ) then
    alter publication supabase_realtime add table public.map_rider_meetups;
  end if;
end $$;
```


component and actions:
```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { VibeMap } from "@/components/VibeMap";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { formatRideDuration, initialsFromName, riderDisplayName } from "@/lib/map-riders";
import { useAppContext } from "@/contexts/AppContext";
import type { FranchizeCrewVM } from "@/app/franchize/actions";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";

type SnapshotData = {
  activeSessions: any[];
  meetups: any[];
  weeklyLeaderboard: Array<{ rank: number; riderName: string; distanceKm: number; sessions: number; avgSpeedKmh: number; maxSpeedKmh: number }>;
  latestCompleted: any[];
  stats: { activeRiders: number; meetupCount: number; totalWeeklyDistanceKm: number };
};

type SessionDetail = {
  session: any;
  points: Array<{ lat: number; lon: number; speedKmh: number; capturedAt: string }>;
};

const DEFAULT_BOUNDS = { top: 56.42, bottom: 56.08, left: 43.66, right: 44.12 };

export function MapRidersClient({ crew, slug }: { crew: FranchizeCrewVM; slug?: string }) {
  const { dbUser, userCrewInfo } = useAppContext();
  const crewSlug = crew.slug || slug || userCrewInfo?.slug || "vip-bike";
  const mapBounds = crew.contacts.map.bounds || DEFAULT_BOUNDS;
  const mapImageUrl = crew.contacts.map.imageUrl;
  const surface = crewPaletteForSurface(crew.theme);
  const shareStartParam = `mapriders_${crewSlug}`;
  const shareDeepLink = `https://t.me/oneBikePlsBot/app?startapp=${shareStartParam}`;
  const shareCopy = `${crew.header.brandName || crew.name || "VIP BIKE"} MapRiders — карта экипажа, live-share и meetup-пины в одном окне`;
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMeetupPoint, setSelectedMeetupPoint] = useState<[number, number] | null>(null);
  const [meetupTitle, setMeetupTitle] = useState("Точка сбора");
  const [meetupComment, setMeetupComment] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [rideName, setRideName] = useState("Вечерний выезд");
  const [vehicleLabel, setVehicleLabel] = useState("VIP bike");
  const [rideMode, setRideMode] = useState<"rental" | "personal">("rental");
  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareStatus, setShareStatus] = useState("Геошеринг выключен");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const watchRef = useRef<number | null>(null);
  const lastCoordsRef = useRef<{ lat: number; lon: number } | null>(null);
  const activeOwnSession = useMemo(
    () => snapshot?.activeSessions.find((session) => session.user_id === dbUser?.user_id) || null,
    [snapshot?.activeSessions, dbUser?.user_id],
  );

  const fetchSnapshot = useCallback(async () => {
    setLoading((prev) => prev && !snapshot);
    try {
      const response = await fetch(`/api/map-riders?slug=${encodeURIComponent(crewSlug)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Не удалось загрузить MapRiders");
      setSnapshot(result.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить карту райдеров");
    } finally {
      setLoading(false);
    }
  }, [crewSlug, snapshot]);

  const fetchSessionDetail = useCallback(async (nextSessionId: string) => {
    try {
      const response = await fetch(`/api/map-riders/session/${nextSessionId}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Не удалось загрузить трек");
      setSessionDetail(result.data);
      setSelectedSessionId(nextSessionId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось открыть маршрут");
    }
  }, []);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  useEffect(() => {
    if (!snapshot || selectedSessionId || !snapshot.latestCompleted[0]?.id) return;
    fetchSessionDetail(snapshot.latestCompleted[0].id);
  }, [snapshot, selectedSessionId, fetchSessionDetail]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`map-riders:${crewSlug}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "map_rider_sessions", filter: `crew_slug=eq.${crewSlug}` }, () => fetchSnapshot())
      .on("postgres_changes", { event: "*", schema: "public", table: "map_rider_meetups", filter: `crew_slug=eq.${crewSlug}` }, () => fetchSnapshot())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [crewSlug, fetchSnapshot]);

  useEffect(() => {
    if (activeOwnSession?.id) {
      setSessionId(activeOwnSession.id);
      setShareEnabled(true);
      setShareStatus("Ты сейчас в эфире на карте");
    } else {
      setSessionId(null);
      setShareEnabled(false);
      setShareStatus("Геошеринг выключен");
    }
  }, [activeOwnSession?.id]);

  const stopWatcher = useCallback(() => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }, []);

  const pushLocation = useCallback(async (position: GeolocationPosition, nextSessionId: string) => {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const prev = lastCoordsRef.current;
    if (prev && Math.abs(prev.lat - lat) < 0.00003 && Math.abs(prev.lon - lon) < 0.00003) {
      return;
    }
    lastCoordsRef.current = { lat, lon };

    await fetch("/api/map-riders/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: nextSessionId,
        userId: dbUser?.user_id,
        crewSlug,
        lat,
        lon,
        speedKmh: Math.max(0, Number(position.coords.speed || 0) * 3.6),
        headingDeg: position.coords.heading || null,
        accuracyMeters: position.coords.accuracy || null,
        capturedAt: new Date(position.timestamp).toISOString(),
      }),
    });
  }, [crewSlug, dbUser?.user_id]);

  const beginWatch = useCallback((nextSessionId: string) => {
    if (!navigator.geolocation) {
      toast.error("Браузер не поддерживает геолокацию");
      return;
    }
    stopWatcher();
    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        pushLocation(position, nextSessionId).catch((error) => {
          toast.error(error instanceof Error ? error.message : "Не удалось отправить геопоинт");
        });
      },
      (error) => {
        toast.error(`Геолокация недоступна: ${error.message}`);
        setShareStatus("Нет доступа к GPS");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 },
    );
  }, [pushLocation, stopWatcher]);

  const handleStartSharing = useCallback(async () => {
    if (!dbUser?.user_id) {
      toast.error("Сначала авторизуйся в Telegram/VIP BIKE");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/map-riders/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          userId: dbUser.user_id,
          crewSlug,
          rideName,
          vehicleLabel,
          rideMode,
          visibility: "crew",
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Не удалось запустить заезд");
      const nextSessionId = result.data.id as string;
      setSessionId(nextSessionId);
      setShareEnabled(true);
      setShareStatus("Делимся локацией в реальном времени");
      beginWatch(nextSessionId);
      await fetchSnapshot();
      toast.success("MapRiders активирован. Экипаж видит твой маршрут.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось запустить MapRiders");
    } finally {
      setIsSubmitting(false);
    }
  }, [beginWatch, crewSlug, dbUser?.user_id, fetchSnapshot, rideMode, rideName, vehicleLabel]);

  const handleStopSharing = useCallback(async () => {
    if (!dbUser?.user_id || !sessionId) return;
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/map-riders/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop", sessionId, userId: dbUser.user_id, crewSlug }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Не удалось завершить заезд");
      stopWatcher();
      setShareEnabled(false);
      setSessionId(null);
      setShareStatus("Заезд завершён и сохранён в статистику");
      await fetchSnapshot();
      toast.success("Маршрут закрыт. Статистика обновлена.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось завершить заезд");
    } finally {
      setIsSubmitting(false);
    }
  }, [crewSlug, dbUser?.user_id, fetchSnapshot, sessionId, stopWatcher]);

  useEffect(() => () => stopWatcher(), [stopWatcher]);

  const handleCreateMeetup = useCallback(async () => {
    if (!dbUser?.user_id || !selectedMeetupPoint) {
      toast.error("Выбери точку на карте и авторизуйся");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/map-riders/meetups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crewSlug,
          userId: dbUser.user_id,
          title: meetupTitle,
          comment: meetupComment,
          lat: selectedMeetupPoint[0],
          lon: selectedMeetupPoint[1],
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Не удалось создать точку встречи");
      toast.success("Точка встречи сохранена для всего экипажа");
      setMeetupComment("");
      setSelectedMeetupPoint(null);
      await fetchSnapshot();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить meetup");
    } finally {
      setIsSubmitting(false);
    }
  }, [crewSlug, dbUser?.user_id, fetchSnapshot, meetupComment, meetupTitle, selectedMeetupPoint]);

  const mapPoints = useMemo(() => {
    const riderPoints = (snapshot?.activeSessions || [])
      .filter((session) => typeof session.latest_lat === "number" && typeof session.latest_lon === "number")
      .map((session) => ({
        id: `rider-${session.id}`,
        name: `${riderDisplayName(session.users, session.user_id)} • ${Math.round(Number(session.latest_speed_kmh || 0))} км/ч`,
        type: "point" as const,
        icon: `image:https://placehold.co/56x56/${session.user_id === dbUser?.user_id ? "facc15" : "111827"}/ffffff?text=${encodeURIComponent(initialsFromName(riderDisplayName(session.users, session.user_id)))}`,
        color: session.user_id === dbUser?.user_id ? "#facc15" : "#60a5fa",
        coords: [[Number(session.latest_lat), Number(session.latest_lon)]],
      }));

    const meetupPoints = (snapshot?.meetups || []).map((meetup) => ({
      id: `meetup-${meetup.id}`,
      name: `${meetup.title}${meetup.comment ? ` — ${meetup.comment}` : ""}`,
      type: "point" as const,
      icon: "::FaLocationDot::",
      color: "#f97316",
      coords: [[Number(meetup.lat), Number(meetup.lon)]],
    }));

    const routePoints = sessionDetail?.points?.length
      ? [{
          id: `route-${sessionDetail.session.id}`,
          name: `Маршрут ${sessionDetail.session.rider_name}`,
          type: "path" as const,
          icon: "::FaRoute::",
          color: "#22c55e",
          coords: sessionDetail.points.map((point) => [point.lat, point.lon] as [number, number]),
        }]
      : [];

    return [...routePoints, ...riderPoints, ...meetupPoints];
  }, [dbUser?.user_id, sessionDetail, snapshot?.activeSessions, snapshot?.meetups]);

  const heroStats = [
    { label: "В эфире", value: snapshot?.stats.activeRiders ?? 0, icon: "::FaSatelliteDish::" },
    { label: "Точки встречи", value: snapshot?.stats.meetupCount ?? 0, icon: "::FaUsersViewfinder::" },
    { label: "Км за 7 дней", value: snapshot?.stats.totalWeeklyDistanceKm ?? 0, icon: "::FaRoad::" },
  ];

  const mapTools = [
    {
      title: "Брендинг / карта",
      description: "Открыть карту внутри франшизного кастомайзера и поправить GPS, bounds и image URL.",
      href: `/franchize/create?slug=${crewSlug}`,
      cta: "Открыть branding",
    },
    {
      title: "Контакты с картой",
      description: "Проверить публичную контактную страницу команды и то, как карта вписана в crew-shell.",
      href: `/franchize/${crewSlug}/contacts`,
      cta: "Смотреть contacts",
    },
    {
      title: "Админ-гараж",
      description: "Быстрый вход в admin-поверхность экипажа: storefront, техника и рядом все map-сценарии.",
      href: `/franchize/${crewSlug}/admin`,
      cta: "Открыть admin",
    },
    {
      title: "Калибратор карты",
      description: "Если картинка карты кривая — открой калибратор и сохрани новый preset с точными bounds.",
      href: "/admin/map-calibrator",
      cta: "Калибровать",
    },
  ];

  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-24 md:pt-28"
      style={{
        ["--mr-accent" as string]: crew.theme.palette.accentMain,
        ["--mr-accent-hover" as string]: crew.theme.palette.accentMainHover,
        ["--mr-border" as string]: crew.theme.palette.borderSoft,
        ["--mr-card" as string]: surface.subtleCard.backgroundColor,
        ["--mr-text" as string]: crew.theme.palette.textPrimary,
        ["--mr-muted" as string]: crew.theme.palette.textSecondary,
      }}
    >
      <section className="grid gap-4 lg:grid-cols-[1.5fr,1fr]">
        <Card className="border backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)", boxShadow: "0 30px 80px rgba(15,23,42,0.24)" }}>
          <CardHeader>
            <Badge className="w-fit border hover:opacity-100" style={{ borderColor: `${crew.theme.palette.accentMain}55`, backgroundColor: `${crew.theme.palette.accentMain}18`, color: crew.theme.palette.accentMain }}>{(crew.header.brandName || crew.name || "VIP BIKE").toUpperCase()} • MAPRIDERS</Badge>
            <CardTitle className="mt-3 font-orbitron text-3xl" style={{ color: crew.theme.palette.textPrimary }}>Карта райдеров в реальном времени</CardTitle>
            <CardDescription className="max-w-2xl text-base" style={{ color: crew.theme.palette.textSecondary }}>
              Один тап — и авторизованный байкер делится маршрутом как в Telegram live location: команда видит движение, точки встречи, скорость и недельный прогресс. Deeplink уже несёт franchize slug и корректно возвращает в `/franchize/{slug}/map-riders`.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {heroStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border p-4" style={{ borderColor: `${crew.theme.palette.borderSoft}aa`, backgroundColor: `${crew.theme.palette.bgBase}66` }}>
                <div className="mb-2" style={{ color: crew.theme.palette.accentMain }}><VibeContentRenderer content={stat.icon} /></div>
                <div className="text-2xl font-semibold" style={{ color: crew.theme.palette.textPrimary }}>{stat.value}</div>
                <div className="text-sm" style={{ color: crew.theme.palette.textSecondary }}>{stat.label}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)", boxShadow: "0 30px 80px rgba(15,23,42,0.24)" }}>
          <CardHeader>
            <CardTitle className="font-orbitron text-xl" style={{ color: crew.theme.palette.textPrimary }}>Пульт райдера</CardTitle>
            <CardDescription>{shareStatus}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ride-name">Название заезда</Label>
                <Input id="ride-name" value={rideName} onChange={(event) => setRideName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle-label">Байк</Label>
                <Input id="vehicle-label" value={vehicleLabel} onChange={(event) => setVehicleLabel(event.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant={rideMode === "rental" ? "default" : "outline"} onClick={() => setRideMode("rental")}>Арендный байк</Button>
              <Button type="button" variant={rideMode === "personal" ? "default" : "outline"} onClick={() => setRideMode("personal")}>Свой байк</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" disabled={isSubmitting || shareEnabled} onClick={handleStartSharing} className="text-black" style={{ backgroundColor: crew.theme.palette.accentMain }}>
                <VibeContentRenderer content="::FaLocationArrow::" className="mr-2" />
                Включить live share
              </Button>
              <Button type="button" variant="outline" disabled={isSubmitting || !shareEnabled} onClick={handleStopSharing}>
                <VibeContentRenderer content="::FaPowerOff::" className="mr-2" />
                Завершить заезд
              </Button>
            </div>
            <div className="rounded-2xl border p-3 text-sm" style={{ borderColor: `${crew.theme.palette.accentMain}33`, backgroundColor: `${crew.theme.palette.accentMain}12`, color: crew.theme.palette.textPrimary }}>
              <div className="font-medium">Крутые фишки сверху базового запроса</div>
              <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: crew.theme.palette.textSecondary }}>
                <li>Convoy Pulse: видно, кто в эфире прямо сейчас и с какой скоростью идёт колонна.</li>
                <li>Meetup Pins: можно ткнуть в карту, задать точку встречи и комментарий для всей команды.</li>
                <li>Route Replay: любой завершённый заезд открывается по кнопке с визуальным треком и KPI.</li>
              </ul>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href={`https://t.me/share/url?url=${encodeURIComponent(shareDeepLink)}&text=${encodeURIComponent(shareCopy)}`} target="_blank">
                Открыть Telegram-share мост
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr,0.9fr]">
        <Card className="border backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)", boxShadow: "0 30px 80px rgba(15,23,42,0.24)" }}>
          <CardHeader>
            <CardTitle className="font-orbitron text-xl" style={{ color: crew.theme.palette.textPrimary }}>Городская карта экипажа</CardTitle>
            <CardDescription>Тапни по карте, чтобы поставить meetup-поинт. Зелёным — выбранный маршрут, жёлтым/синим — активные райдеры.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[520px] overflow-hidden rounded-3xl border" style={{ borderColor: `${crew.theme.palette.borderSoft}aa` }}>
              <VibeMap points={mapPoints} bounds={mapBounds ?? DEFAULT_BOUNDS} imageUrl={mapImageUrl} isEditable onMapClick={(coords) => setSelectedMeetupPoint(coords)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="border backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)", boxShadow: "0 30px 80px rgba(15,23,42,0.24)" }}>
            <CardHeader>
              <CardTitle className="font-orbitron text-lg" style={{ color: crew.theme.palette.textPrimary }}>Новая точка встречи</CardTitle>
              <CardDescription>
                {selectedMeetupPoint ? `Выбрано: ${selectedMeetupPoint[0].toFixed(5)}, ${selectedMeetupPoint[1].toFixed(5)}` : "Нажми на карту, чтобы выбрать точку"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="meetup-title">Заголовок</Label>
                <Input id="meetup-title" value={meetupTitle} onChange={(event) => setMeetupTitle(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meetup-comment">Комментарий</Label>
                <Textarea id="meetup-comment" value={meetupComment} onChange={(event) => setMeetupComment(event.target.value)} placeholder="Например: собираемся тут в 21:00, есть парковка и кофе" />
              </div>
              <Button type="button" className="w-full" disabled={isSubmitting || !selectedMeetupPoint} onClick={handleCreateMeetup}>Сохранить meetup</Button>
            </CardContent>
          </Card>

          <Card className="border backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)", boxShadow: "0 30px 80px rgba(15,23,42,0.24)" }}>
            <CardHeader>
              <CardTitle className="font-orbitron text-lg" style={{ color: crew.theme.palette.textPrimary }}>Онлайн-райдеры</CardTitle>
              <CardDescription>{loading ? "Обновляем эфир..." : `${snapshot?.activeSessions.length || 0} райдеров сейчас на карте`}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(snapshot?.activeSessions || []).map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => fetchSessionDetail(session.id)}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left transition hover:border-amber-400/50"
                >
                  <div>
                    <div className="font-medium text-white">{riderDisplayName(session.users, session.user_id)}</div>
                    <div className="text-xs text-muted-foreground">{session.ride_name || "Без названия"} • {session.vehicle_label || "байк не указан"}</div>
                  </div>
                  <div className="text-right text-sm text-amber-200">
                    <div>{Number(session.total_distance_km || 0).toFixed(1)} км</div>
                    <div>{Number(session.latest_speed_kmh || 0).toFixed(0)} км/ч</div>
                  </div>
                </button>
              ))}
              {!snapshot?.activeSessions?.length && <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">Пока никто не в эфире. Запусти live share первым.</div>}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <Card className="border backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)", boxShadow: "0 30px 80px rgba(15,23,42,0.24)" }}>
          <CardHeader>
            <CardTitle className="font-orbitron text-xl" style={{ color: crew.theme.palette.textPrimary }}>Разбор выбранного заезда</CardTitle>
            <CardDescription>Показываем маршрут, скорость, среднюю скорость и длительность по кнопке.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sessionDetail ? (
              <>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="text-xs text-muted-foreground">Райдер</div><div className="mt-1 text-lg text-white">{sessionDetail.session.rider_name}</div></div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="text-xs text-muted-foreground">Дистанция</div><div className="mt-1 text-lg text-white">{Number(sessionDetail.session.total_distance_km || 0).toFixed(1)} км</div></div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="text-xs text-muted-foreground">Средняя скорость</div><div className="mt-1 text-lg text-white">{Number(sessionDetail.session.avg_speed_kmh || 0).toFixed(1)} км/ч</div></div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="text-xs text-muted-foreground">Максимум</div><div className="mt-1 text-lg text-white">{Number(sessionDetail.session.max_speed_kmh || 0).toFixed(1)} км/ч</div></div>
                </div>
                <Separator />
                <div className="text-sm text-muted-foreground">Длительность: {formatRideDuration(Number(sessionDetail.session.duration_seconds || 0))}. Точек в треке: {sessionDetail.points.length}.</div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">Выбери активный или завершённый заезд, чтобы раскрыть маршрут и статистику.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)", boxShadow: "0 30px 80px rgba(15,23,42,0.24)" }}>
          <CardHeader>
            <CardTitle className="font-orbitron text-xl" style={{ color: crew.theme.palette.textPrimary }}>Недельный зал славы</CardTitle>
            <CardDescription>Кто больше всех проехал за 7 дней — тот выше в таблице.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(snapshot?.weeklyLeaderboard || []).map((row) => (
              <div key={`${row.rank}-${row.riderName}`} className="grid grid-cols-[56px,1fr,88px] items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="text-center font-orbitron text-xl text-amber-300">#{row.rank}</div>
                <div>
                  <div className="font-medium text-white">{row.riderName}</div>
                  <div className="text-xs text-muted-foreground">{row.sessions} заезд(ов) • ср. {row.avgSpeedKmh} км/ч • max {row.maxSpeedKmh} км/ч</div>
                </div>
                <div className="text-right text-lg text-white">{row.distanceKm} км</div>
              </div>
            ))}
            {!snapshot?.weeklyLeaderboard?.length && <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">Лидерборд наполнится после первых треков.</div>}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="border backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)", boxShadow: "0 30px 80px rgba(15,23,42,0.24)" }}>
          <CardHeader>
            <CardTitle className="font-orbitron text-xl" style={{ color: crew.theme.palette.textPrimary }}>Последние завершённые выезды</CardTitle>
            <CardDescription>Открывай любой заезд кнопкой, чтобы увидеть маршрут на карте.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(snapshot?.latestCompleted || []).map((session) => (
              <button key={session.id} type="button" onClick={() => fetchSessionDetail(session.id)} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left transition hover:border-emerald-400/50">
                <div>
                  <div className="font-medium text-white">{session.rider_name}</div>
                  <div className="text-xs text-muted-foreground">{session.ride_name || "Без названия"} • {formatRideDuration(Number(session.duration_seconds || 0))}</div>
                </div>
                <div className="text-right text-sm text-emerald-200">
                  <div>{Number(session.total_distance_km || 0).toFixed(1)} км</div>
                  <div>avg {Number(session.avg_speed_kmh || 0).toFixed(1)}</div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="border backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)", boxShadow: "0 30px 80px rgba(15,23,42,0.24)" }}>
          <CardHeader>
            <CardTitle className="font-orbitron text-xl" style={{ color: crew.theme.palette.textPrimary }}>Как это работает</CardTitle>
            <CardDescription>Короткий сценарий для байкеров и админов.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><span className="font-medium text-white">1.</span> Авторизованный райдер жмёт “Включить live share”, выбирает: арендный или свой байк.</div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><span className="font-medium text-white">2.</span> MapRiders начинает писать точки маршрута, считает дистанцию, среднюю и максимальную скорость.</div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><span className="font-medium text-white">3.</span> Любой участник видит всех активных райдеров, meetup-пины и недельный лидерборд.</div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><span className="font-medium text-white">4.</span> После завершения поездки маршрут остаётся доступен по кнопке “открыть заезд”.</div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {mapTools.map((tool) => (
          <Card key={tool.href} className="border backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)" }}>
            <CardHeader>
              <CardTitle className="text-lg font-semibold" style={{ color: crew.theme.palette.textPrimary }}>{tool.title}</CardTitle>
              <CardDescription style={{ color: crew.theme.palette.textSecondary }}>{tool.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href={tool.href}>{tool.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
```

```ts
// /lib/map-riders.ts
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
```



 OPTIMIZE MAP RIDERS TO HANDLE 100 RIDERS AND USE LIVE_LOCATIONS TABLE AS EXAMPLE OF PROPER WAY;)







### 2. Use new hook (exactly this file)

**`/hooks/useLiveRiders.ts`**

```tsx
"use client";
import { useEffect, useRef } from "react";
import { supabaseAnon } from "@/lib/supabase-browser";
import { useAppContext } from "@/contexts/AppContext";

const THROTTLE_MS = 3000;        // 3 seconds
const MIN_DISTANCE_M = 15;

export function useLiveRiders(crewSlug: string) {
  const { dbUser } = useAppContext();
  const lastSentRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const channelRef = useRef<any>(null);

  const sendPosition = async (position: GeolocationPosition) => {
    if (!dbUser?.user_id || !crewSlug) return;

    const { latitude: lat, longitude: lng, speed, heading, accuracy } = position.coords;
    const now = Date.now();

    const last = lastSentRef.current;
    if (last) {
      const distance = Math.hypot(lat - last.lat, lng - last.lng) * 111_000;
      if (distance < MIN_DISTANCE_M && now - last.ts < THROTTLE_MS) return;
    }

    const payload = {
      user_id: dbUser.user_id,
      crew_slug: crewSlug,
      lat,
      lng,
      speed_kmh: (speed || 0) * 3.6,
      heading: heading || null,
      is_riding: true,
    };

    // 1. Fast broadcast (instant for everyone)
    supabaseAnon.channel(`map:${crewSlug}`).send({
      type: "broadcast",
      event: "position",
      payload,
    });

    // 2. Upsert to live_locations (ephemeral + spatial RLS)
    await supabaseAnon.from("live_locations").upsert(payload, { onConflict: "user_id" });

    lastSentRef.current = { lat, lng, ts: now };
  };

  // Subscribe to live positions
  useEffect(() => {
    if (!crewSlug) return;
    const channel = supabaseAnon.channel(`map:${crewSlug}`);

    channel.on("broadcast", { event: "position" }, ({ payload }) => {
      // TODO: your VibeMap will listen to this via a global store or prop later
      window.dispatchEvent(new CustomEvent("live-rider-update", { detail: payload }));
    }).subscribe();

    channelRef.current = channel;

    return () => supabaseAnon.removeChannel(channel);
  }, [crewSlug]);

  // GPS watcher
  useEffect(() => {
    if (!navigator.geolocation || !dbUser?.user_id) return;
    const watchId = navigator.geolocation.watchPosition(sendPosition, console.error, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000,
    });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [dbUser?.user_id, crewSlug]);

  return { sendPosition };
}
```

### 3. Update MapRidersClient.tsx (minimal changes)

In your existing `MapRidersClient` component:

- Import the hook at the top:
  ```tsx
  import { useLiveRiders } from "@/hooks/useLiveRiders";
  ```

- Inside the component, right after `const crewSlug = ...` add:
  ```tsx
  useLiveRiders(crewSlug);   // ← starts live GPS + broadcast subscription
  ```

- Add this useEffect to receive live updates and feed them to `VibeMap` (add `liveRiders` state):
  ```tsx
  const [liveRiders, setLiveRiders] = useState<any[]>([]);

  useEffect(() => {
    const handler = (e: any) => {
      setLiveRiders(prev => {
        const exists = prev.find(r => r.user_id === e.detail.user_id);
        if (exists) return prev.map(r => r.user_id === e.detail.user_id ? e.detail : r);
        return [...prev, e.detail];
      });
    };
    window.addEventListener("live-rider-update", handler);
    return () => window.removeEventListener("live-rider-update", handler);
  }, []);
  ```

- Pass `liveRiders` to your `VibeMap` (you already have `points={mapPoints}` — just merge live riders into it or add a new prop).

### 4. Update your API routes (critical for scale)

- **`/api/map-riders/location`** → change to **upsert only to `live_locations`** (remove heavy insert to `map_rider_points` on every ping).  
  Keep the old `map_rider_points` insert **only** when the ride ends (`handleStopSharing`).

- In `pushLocation` calls from client → you can keep the fetch for now, but the new hook already handles live upsert + broadcast, so the API route can become a simple no-op or just update session `last_ping_at`.

### 5. Cleanup & final touches

- Remove the old realtime postgres_changes on `map_rider_points` (it will die under load). Keep only on `map_rider_sessions` and `map_rider_meetups`.
- In `VibeMap` you can now show yellow/blue live dots from `liveRiders` array (they update instantly via broadcast).
- Test with 2–3 devices sending GPS → you should stay under 40 msg/sec even with 100 riders.

**When finished reply exactly:**  
“MapRiders optimized with live_locations + broadcast. Now scales to 100+ riders on free tier. Live updates are instant and spatial-filtered.” to telegram using skill.

Add demo data and make a screenshot:)


