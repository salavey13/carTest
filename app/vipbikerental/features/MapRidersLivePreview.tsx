/**
 * MapRidersLivePreview.tsx
 * =========================
 * Live map preview section with rider locations and meetups.
 * VIP Bike franchise feature — other franchises would have different social features.
 */
"use client";

import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import type { MapRidersOverview } from "./shared/types";
import { formatCompactNumber, formatRideDuration, normalizeMapPoint, fallbackMapLocations, fallbackMeetups, mapRidersJourney } from "./shared/constants";

export function MapRidersLivePreview({ overview, crewSlug = "vip-bike" }: { overview: MapRidersOverview | null; crewSlug?: string }) {
  const liveLocations = (overview?.liveLocations?.length ? overview.liveLocations : fallbackMapLocations).slice(0, 3);
  const meetups = (overview?.meetups?.length ? overview.meetups : fallbackMeetups).slice(0, 2);
  const latestRide = overview?.latestCompleted?.[0];
  const activeRiders = formatCompactNumber(overview?.stats?.activeRiders, liveLocations.length);
  const meetupCount = formatCompactNumber(overview?.stats?.meetupCount, meetups.length);
  const weeklyDistance = formatCompactNumber(overview?.stats?.totalWeeklyDistanceKm, 127);
  const isMapRidersWarmup = Boolean(overview && !overview.liveLocations?.length && !overview.meetups?.length && !overview.latestCompleted?.length && Number(overview.stats?.activeRiders || 0) <= 0 && Number(overview.stats?.totalWeeklyDistanceKm || 0) <= 0);
  const latestRideDistanceKm = Number(latestRide?.total_distance_km || 0);
  const latestRideHint = latestRide ? latestRideDistanceKm <= 0 ? "Последний заезд сохранён, дистанция ещё уточняется." : null : "Ждём первый живой заезд — он появится здесь после старта MapRiders.";
  const speedPath = "M4 42 C18 34 24 18 38 28 C50 36 58 12 70 22 C82 30 88 18 96 10";

  return (
    <section>
      <div className="mb-8 text-center">
        <h2 className="font-orbitron text-3xl sm:text-4xl">MapRiders — карта, которой реально хочется пользоваться</h2>
        <p className="mx-auto mt-3 max-w-3xl text-muted-foreground">Райдеры, встречи и последние поездки — без тяжёлой карты на первом экране.</p>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Link href={`/franchize/${crewSlug}/map-riders`} className="group relative min-h-[360px] overflow-hidden rounded-3xl border border-primary/35 bg-[#d8c99b] p-5 text-[#182016] shadow-2xl shadow-black/20" aria-label="Открыть полную карту MapRiders">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(255,244,196,0.78),transparent_28%),radial-gradient(circle_at_72%_64%,rgba(48,142,94,0.30),transparent_30%),linear-gradient(135deg,rgba(255,249,219,0.82),rgba(96,131,91,0.42))]" />
          <svg className="absolute inset-0 h-full w-full opacity-80" viewBox="0 0 100 100" aria-hidden="true" preserveAspectRatio="none">
            <path d="M-6 78 C18 66 30 54 52 54 C70 54 84 42 106 30" fill="none" stroke="rgba(31,54,36,0.20)" strokeWidth="10" strokeLinecap="round" />
            <path d="M-4 76 C18 64 30 52 52 52 C70 52 84 40 104 28" fill="none" stroke="rgba(255,246,210,0.78)" strokeWidth="3" strokeLinecap="round" />
            <path d="M8 14 C24 22 28 36 42 42 C56 49 68 44 91 56" fill="none" stroke="rgba(23,88,63,0.42)" strokeWidth="2" strokeLinecap="round" strokeDasharray="7 4" />
            <path d="M2 40 C20 35 28 28 42 26 C58 23 69 16 98 12" fill="none" stroke="rgba(171,112,38,0.45)" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M12 92 C22 78 34 72 48 72 C64 72 74 82 92 78" fill="none" stroke="rgba(24,89,116,0.32)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(24,32,22,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(24,32,22,0.08)_1px,transparent_1px)] bg-[size:34px_34px] mix-blend-multiply" />
          {liveLocations.map((location, index) => {
            const point = normalizeMapPoint(location.lat, location.lng, index);
            return (
              <div key={location.user_id || `${location.lat}-${location.lng}-${index}`} className="absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2" style={{ left: `${point.left}%`, top: `${point.top}%` }}>
                <span className="relative flex h-4 w-4"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-600 opacity-50" /><span className="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-emerald-600 shadow-[0_0_16px_rgba(22,163,74,0.8)]" /></span>
                <span className="rounded-full border border-emerald-900/15 bg-white/75 px-2 py-1 text-[10px] font-semibold text-emerald-950 shadow-sm backdrop-blur-sm">{Math.round(Number(location.speed_kmh || 0)) || 18} км/ч</span>
              </div>
            );
          })}
          {meetups.map((meetup, index) => {
            const point = normalizeMapPoint(meetup.lat, meetup.lng, index + 4);
            return (
              <div key={`${meetup.title || "vstrecha"}-${index}`} className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-amber-900/20 bg-amber-100/85 px-3 py-2 text-xs font-semibold text-amber-950 shadow-sm backdrop-blur-sm" style={{ left: `${point.left}%`, top: `${point.top}%` }}>
                <VibeContentRenderer content="::FaLocationDot::" className="mr-1 inline text-amber-700" />{meetup.title || "Точка встречи"}
              </div>
            );
          })}
          <div className="relative z-10 flex h-full min-h-[320px] flex-col justify-between">
            <div className="max-w-md rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md">
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-900/70">превью маршрута</p>
              <h3 className="mt-2 font-orbitron text-2xl text-[#182016]">Райдеры на карте прямо сейчас</h3>
              <p className="mt-2 text-sm text-[#354131]">Откроется полная карта с геопозицией, встречами и рейтингом.</p>
              {isMapRidersWarmup ? <p className="mt-2 text-xs font-medium text-emerald-950/70">Живые данные появятся после первого заезда — пока показываем демо-сцену.</p> : null}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[{ label: "онлайн", value: activeRiders }, { label: "за неделю", value: `${weeklyDistance} км` }, { label: "встречи", value: meetupCount }].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/60 bg-white/70 p-3 shadow-sm backdrop-blur-md">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#52604d]">{stat.label}</p>
                  <p className="mt-1 font-orbitron text-lg text-[#182016]">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </Link>
        <div className="space-y-4">
          <Card className="border-border/70 bg-card/60">
            <CardHeader><CardTitle className="text-xl"><VibeContentRenderer content="::FaFlagCheckered:: Последняя поездка" /></CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-xl border border-border/60 bg-background/40 p-3"><p className="text-xs text-muted-foreground">Райдер</p><p className="mt-1 font-medium">{latestRide?.rider_name || "Ждём первый заезд"}</p></div>
                <div className="rounded-xl border border-border/60 bg-background/40 p-3"><p className="text-xs text-muted-foreground">Дистанция</p><p className="mt-1 font-medium">{latestRide ? `${formatCompactNumber(latestRide.total_distance_km, 0)} км` : "—"}</p></div>
                <div className="rounded-xl border border-border/60 bg-background/40 p-3"><p className="text-xs text-muted-foreground">Время</p><p className="mt-1 font-medium">{formatRideDuration(latestRide?.duration_seconds)}</p></div>
              </div>
              {latestRideHint ? <p className="text-xs text-muted-foreground">{latestRideHint}</p> : null}
              <svg viewBox="0 0 100 48" className="h-24 w-full rounded-2xl border border-border/60 bg-background/40 p-3" role="img" aria-label="Мини график скорости последней поездки">
                <path d={speedPath} fill="none" stroke="currentColor" strokeWidth="3" className="text-primary drop-shadow-[0_0_8px_rgba(255,170,80,0.65)]" />
                <path d="M4 42 L96 42" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/40" />
              </svg>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {mapRidersJourney.map((item) => (
              <Card key={item.title} className="border-border/70 bg-card/60">
                <CardHeader className="pb-2"><CardTitle className="text-sm">{item.title}</CardTitle></CardHeader>
                <CardContent><p className="text-xs text-muted-foreground">{item.text}</p></CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}