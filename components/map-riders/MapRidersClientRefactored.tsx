// /components/map-riders/MapRidersClientRefactored.tsx
// Refactored orchestrator — ~120 lines, no business logic.
// All state lives in MapRidersProvider/useMapRiders.

"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppContext } from "@/contexts/AppContext";
import type { FranchizeCrewVM } from "@/app/franchize/actions";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";
import { useMaps } from "@/lib/maps/useMaps";
import { MapRidersProvider, useMapRiders } from "@/hooks/useMapRidersContext";
import { formatRideDuration, initialsFromName, riderDisplayName } from "@/lib/map-riders";
import { useLiveRiders } from "@/hooks/useLiveRiders";
import { getMapRidersWriteHeaders } from "@/lib/map-riders-client-auth";
import { FranchizeConfirmModal } from "@/app/franchize/components/FranchizeConfirmModal";
import { FranchizePromptModal } from "@/app/franchize/components/FranchizePromptModal";
import { RiderMarkerLayer } from "@/components/map-riders/RiderMarkerLayer";
import { RiderFAB } from "@/components/map-riders/RiderFAB";
import { RidersDrawer } from "@/components/map-riders/RidersDrawer";
import { StatusOverlay } from "@/components/map-riders/StatusOverlay";
import { SpeedGradientRoute } from "@/components/map-riders/SpeedGradientRoute";
import { MapRidersDebugPanel } from "@/components/map-riders/MapRidersDebugPanel";
import { MapRidersSkeleton } from "@/components/map-riders/LoadingSkeleton";

// Lazy-load map (SSR disabled)
const RacingMap = dynamic(() => import("@/components/maps/RacingMap").then((mod) => mod.RacingMap), { ssr: false });

const DEFAULT_BOUNDS = { top: 56.42, bottom: 56.08, left: 43.66, right: 44.12 };
const HOME_BASE: [number, number] = [56.204245, 43.798905];
const MEETUP_ACTION_DEBOUNCE_MS = 2000;

// ── Inner component (uses context) ──
function MapRidersInner({ crew }: { crew: FranchizeCrewVM }) {
  const { dbUser } = useAppContext();
  const { state, dispatch, crewSlug, fetchSnapshot, fetchSessionDetail } = useMapRiders();
  const [isQuickMeetupSaving, setIsQuickMeetupSaving] = useState(false);
  const [selectedMeetupId, setSelectedMeetupId] = useState<string | null>(null);
  const [isMeetupDeleting, setIsMeetupDeleting] = useState(false);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [promptValue, setPromptValue] = useState("Точка встречи");
  const lastMeetupActionAtRef = useRef(0);
  const surface = crewPaletteForSurface(crew.theme);
  const mapEngine = process.env.NEXT_PUBLIC_MAP_ENGINE || "leaflet";
  const useLeafletMap = mapEngine !== "vibemap";
  const mapBounds = crew.contacts.map.bounds || DEFAULT_BOUNDS;
  const { mapData } = useMaps({
    mapId: crew.contacts.map?.id || undefined,
    crewSlug,
    defaultTileLayer: "cartodb-dark",
  });

  // ── GPS tracking hook ──
  const { isUsingTelegram, lastBroadcastAt, queuedPoints } = useLiveRiders({
    crewSlug,
    sessionId: state.sessionId,
    userId: dbUser?.user_id || null,
    enabled: state.shareEnabled && Boolean(state.sessionId),
    onPosition: (point) => {
      if (!dbUser?.user_id) return;
      dispatch({
        type: "rider/moved",
        payload: {
          user_id: dbUser.user_id,
          lat: point.lat,
          lng: point.lng,
          speed_kmh: point.speedKmh,
          heading: point.heading,
          updated_at: point.capturedAt,
        },
        selfUserId: dbUser.user_id,
      });
    },
  });

  // ── Build map points from state ──
  const mapPoints = useMemo(() => {
    const riderPoints = Array.from(state.liveRiders.values())
      .filter((r) => r.status !== "evicted")
      .map((rider) => {
        const session = state.sessions.find((s) => s.user_id === rider.user_id);
        const name = riderDisplayName(session?.users, rider.user_id);
        const isStale = rider.status === "stale";
        return {
          id: `live-rider-${rider.user_id}`,
          name: `${name} • ${Math.round(rider.speed_kmh)} км/ч`,
          type: "point" as const,
          icon: `image:https://placehold.co/56x56/${rider.isSelf ? "facc15" : isStale ? "4b5563" : "111827"}/ffffff?text=${encodeURIComponent(initialsFromName(name))}`,
          color: rider.isSelf ? "#facc15" : isStale ? "#6b7280" : "#60a5fa",
          coords: [[rider.lat, rider.lng]] as [number, number][],
        };
      });

    const demoPoints =
      riderPoints.length > 0
        ? []
        : [
            {
              id: "demo-rider-alpha",
              name: "Demo Rider База • 14 км/ч",
              type: "point" as const,
              icon: "image:https://placehold.co/56x56/111827/ffffff?text=SB",
              color: "#60a5fa",
              coords: [HOME_BASE],
            },
          ];

    const meetupPoints = state.meetups.map((m) => ({
      id: `meetup-${m.id}`,
      name: `${m.title}${m.comment ? ` — ${m.comment}` : ""}`,
      type: "point" as const,
      icon: "::FaLocationDot::",
      color: "#f97316",
      coords: [[m.lat, m.lon]] as [number, number][],
    }));

    const routePoints =
      state.sessionDetail?.points?.length
        ? [
            {
              id: `route-${state.sessionDetail.session.id}`,
              name: `Маршрут`,
              type: "path" as const,
              icon: "::FaRoute::",
              color: "#22c55e",
              coords: state.sessionDetail.points.map((p) => [p.lat, p.lon] as [number, number]),
            },
          ]
        : [];

    const sanitizedMapPoints = (mapData?.points || []).filter((point) => {
      const normalizedId = String(point.id || "").toLowerCase();
      const normalizedName = String(point.name || "").toLowerCase();
      return normalizedId !== "demo-rider-beta" && !normalizedName.includes("demo rider beta");
    });

    return [...sanitizedMapPoints, ...routePoints, ...riderPoints, ...demoPoints, ...meetupPoints];
  }, [state.liveRiders, state.sessions, state.meetups, state.sessionDetail, mapData?.points]);

  const heroStats = [
    { label: "В эфире", value: state.stats.activeRiders, icon: "::FaSatelliteDish::" },
    { label: "Точки встречи", value: state.stats.meetupCount, icon: "::FaUsersViewfinder::" },
    { label: "Км за 7 дней", value: state.stats.totalWeeklyDistanceKm, icon: "::FaRoad::" },
  ];

  const handleQuickMeetupCreate = useCallback(async () => {
    if (!dbUser?.user_id) {
      toast.error("Авторизуйся в Telegram/VIP BIKE");
      return;
    }
    if (!state.selectedMeetupPoint) {
      toast.error("Сначала выбери точку на карте");
      return;
    }
    const now = Date.now();
    if (now - lastMeetupActionAtRef.current < MEETUP_ACTION_DEBOUNCE_MS) {
      toast.info("Подожди пару секунд перед следующим действием");
      return;
    }
    lastMeetupActionAtRef.current = now;

    setPromptValue("Точка встречи");
    setIsPromptOpen(true);
  }, [dbUser?.user_id, state.selectedMeetupPoint]);

  const selectedMeetup = useMemo(() => state.meetups.find((meetup) => meetup.id === selectedMeetupId) || null, [state.meetups, selectedMeetupId]);

  const handleMeetupDelete = useCallback(async () => {
    if (!dbUser?.user_id) {
      toast.error("Авторизуйся в Telegram/VIP BIKE");
      return;
    }
    if (!selectedMeetup) {
      toast.error("Сначала выбери meetup-поинт");
      return;
    }
    const now = Date.now();
    if (now - lastMeetupActionAtRef.current < MEETUP_ACTION_DEBOUNCE_MS) {
      toast.info("Подожди пару секунд перед следующим действием");
      return;
    }
    lastMeetupActionAtRef.current = now;

    setIsConfirmOpen(true);
  }, [dbUser?.user_id, selectedMeetup]);

  const handlePromptSubmit = useCallback(
    async (value: string) => {
      if (!dbUser?.user_id || !state.selectedMeetupPoint) return;
      const title = value.trim();
      if (title.length < 2) {
        toast.error("Название точки должно быть минимум 2 символа");
        return;
      }

      setIsPromptOpen(false);
      setIsQuickMeetupSaving(true);
      try {
        const [lat, lon] = state.selectedMeetupPoint;
        const headers = await getMapRidersWriteHeaders();
        const response = await fetch("/api/map-riders/meetups", {
          method: "POST",
          headers,
          body: JSON.stringify({
            crewSlug,
            userId: dbUser.user_id,
            title,
            comment: "Добавлено с карты",
            lat,
            lon,
          }),
        });

        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || "Не удалось создать meetup");
        dispatch({ type: "ui/select-meetup-point", payload: null });
        await fetchSnapshot();
        toast.success("Meetup добавлен по выбранной точке");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ошибка создания meetup");
      } finally {
        setIsQuickMeetupSaving(false);
      }
    },
    [crewSlug, dbUser, dispatch, fetchSnapshot, state.selectedMeetupPoint],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!dbUser?.user_id || !selectedMeetup) return;

    setIsConfirmOpen(false);
    setIsMeetupDeleting(true);
    try {
      const headers = await getMapRidersWriteHeaders();
      const response = await fetch("/api/map-riders/meetups", {
        method: "DELETE",
        headers,
        body: JSON.stringify({
          meetupId: selectedMeetup.id,
          crewSlug,
          userId: dbUser.user_id,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Не удалось удалить meetup");

      setSelectedMeetupId(null);
      dispatch({ type: "ui/select-meetup-point", payload: null });
      await fetchSnapshot();
      toast.success("Meetup удалён");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка удаления meetup");
    } finally {
      setIsMeetupDeleting(false);
    }
  }, [crewSlug, dbUser, dispatch, fetchSnapshot, selectedMeetup]);

  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-20 md:pt-24"
      style={{
        ["--mr-accent" as string]: crew.theme.palette.accentMain,
        ["--mr-accent-hover" as string]: crew.theme.palette.accentMainHover,
        ["--mr-border" as string]: crew.theme.palette.borderSoft,
        ["--mr-card" as string]: surface.subtleCard.backgroundColor,
        ["--mr-text" as string]: crew.theme.palette.textPrimary,
        ["--mr-muted" as string]: crew.theme.palette.textSecondary,
      }}
    >
      {/* ── MAP (fullscreen hero) ── */}
      <section className="relative -mx-4 overflow-hidden border md:mx-0 md:rounded-3xl" style={{ borderColor: `${crew.theme.palette.borderSoft}aa` }}>
        <div className="absolute inset-0 z-0">
          {useLeafletMap ? (
            <RacingMap
              points={mapPoints}
              bounds={mapData?.bounds || mapBounds || DEFAULT_BOUNDS}
              className="h-full min-h-[62vh] w-full md:min-h-[74vh]"
              tileLayer={mapData?.meta.tileLayer || "cartodb-dark"}
              onMapClick={(coords) => {
                setSelectedMeetupId(null);
                dispatch({ type: "ui/select-meetup-point", payload: coords });
              }}
              onMapLongPress={(coords) => {
                setSelectedMeetupId(null);
                dispatch({ type: "ui/select-meetup-point", payload: coords });
              }}
              onPointClick={(point) => {
                const pointId = String(point.id || "");
                if (pointId.startsWith("meetup-")) {
                  const meetupId = pointId.replace(/^meetup-/, "");
                  setSelectedMeetupId(meetupId);
                  dispatch({ type: "ui/select-meetup-point", payload: null });
                }
              }}
            >
              {state.sessionDetail?.points?.length ? <SpeedGradientRoute points={state.sessionDetail.points} /> : null}
              <RiderMarkerLayer />
            </RacingMap>
          ) : (
            <div className="flex h-full min-h-[62vh] items-center justify-center text-muted-foreground md:min-h-[74vh]">
              Режим VibeMap (резерв) — установи NEXT_PUBLIC_MAP_ENGINE=leaflet
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-black/30 via-transparent to-black/30" />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 h-5 bg-[var(--mr-card)]/95 backdrop-blur-sm" />
          <MapRidersDebugPanel
            activeRiders={state.liveRiders.size}
            sessionCount={state.sessions.length}
            pendingBatchPoints={queuedPoints}
            isUsingTelegram={isUsingTelegram}
            lastBroadcastAt={lastBroadcastAt}
          />
        </div>

        {/* Floating badges */}
        <div className="pointer-events-none relative z-30 flex min-h-[62vh] flex-col justify-between p-3 md:min-h-[74vh] md:p-6">
          <div className="flex flex-wrap gap-2">
            <Badge className="border bg-black/55 text-white backdrop-blur-md">{useLeafletMap ? `Leaflet${isUsingTelegram ? " + Telegram GPS" : " + Browser GPS"}` : "VibeMap"}</Badge>
            {mapData?.routes?.length ? <Badge className="border border-sky-300/50 bg-sky-500/20 text-sky-100">{mapData.routes.length} маршрутов</Badge> : null}
            {state.liveRiders.size === 0 && state.sessions.length === 0 ? (
              <Badge className="border border-emerald-300/40 bg-emerald-500/20 text-emerald-100">Демо-режим</Badge>
            ) : null}
          </div>
          <div className="flex justify-end">
            <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-white/30 bg-black/50 px-3 py-1 text-xs text-white">
              <span>
                {selectedMeetup
                  ? `Точка встречи: ${selectedMeetup.title}`
                  : state.selectedMeetupPoint
                  ? `Точка: ${state.selectedMeetupPoint[0].toFixed(4)}, ${state.selectedMeetupPoint[1].toFixed(4)}`
                  : "Тапни по карте, чтобы выбрать точку или уже созданный meetup"}
              </span>
              <Button
                type="button"
                size="sm"
                disabled={
                  selectedMeetup
                    ? isMeetupDeleting
                    : !state.selectedMeetupPoint || isQuickMeetupSaving
                }
                className="h-6 min-w-6 rounded-full px-2 text-xs leading-none text-black"
                style={{ backgroundColor: crew.theme.palette.accentMain }}
                onClick={selectedMeetup ? handleMeetupDelete : handleQuickMeetupCreate}
                aria-label={selectedMeetup ? "Удалить выбранный meetup" : "Создать meetup из выбранной точки"}
              >
                {selectedMeetup ? (isMeetupDeleting ? "…" : "−") : isQuickMeetupSaving ? "…" : "+"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS + CONTROL (below map) ── */}
      <section className="grid gap-4 lg:grid-cols-[1.5fr,1fr]">
        {/* Stats card */}
        <div className="rounded-2xl border p-6 backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)" }}>
          <Badge className="mb-3 w-fit border" style={{ borderColor: `${crew.theme.palette.accentMain}55`, backgroundColor: `${crew.theme.palette.accentMain}18`, color: crew.theme.palette.accentMain }}>
            {(crew.header.brandName || crew.name || "VIP BIKE").toUpperCase()} • MAPRIDERS
          </Badge>
          <h2 className="mt-3 font-orbitron text-3xl" style={{ color: crew.theme.palette.textPrimary }}>
            Карта райдеров в реальном времени
          </h2>
          <p className="mt-2 max-w-2xl text-base" style={{ color: crew.theme.palette.textSecondary }}>
            Один тап — и экипаж видит твой маршрут, скорость и meetup-пины.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {heroStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border p-4" style={{ borderColor: `${crew.theme.palette.borderSoft}aa`, backgroundColor: `${crew.theme.palette.bgBase}66` }}>
                <div className="mb-2" style={{ color: crew.theme.palette.accentMain }}>
                  <VibeContentRenderer content={stat.icon} />
                </div>
                <div className="text-2xl font-semibold" style={{ color: crew.theme.palette.textPrimary }}>{stat.value}</div>
                <div className="text-sm" style={{ color: crew.theme.palette.textSecondary }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Rider control panel */}
        <div className="rounded-2xl border p-6 backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)" }}>
          <h3 className="font-orbitron text-xl" style={{ color: crew.theme.palette.textPrimary }}>Пульт райдера</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {state.shareEnabled ? "Ты сейчас в эфире на карте" : "Геошеринг выключен"}
          </p>
          <div className="mt-4 space-y-3">
            <Button asChild variant="outline" className="w-full justify-center">
              <Link href="/admin/map-routes">Открыть маршруты карты</Link>
            </Button>
            <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
              <Input
                value={state.rideName}
                onChange={(event) => dispatch({ type: "ui/set-ride-name", payload: event.target.value })}
                placeholder="Название заезда"
                className="h-9"
              />
              <Input
                value={state.vehicleLabel}
                onChange={(event) => dispatch({ type: "ui/set-vehicle-label", payload: event.target.value })}
                placeholder="Мотоцикл"
                className="h-9"
              />
              <Select
                value={state.rideMode}
                onValueChange={(value: "rental" | "personal") => dispatch({ type: "ui/set-ride-mode", payload: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Режим поездки" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rental">Аренда</SelectItem>
                  <SelectItem value="personal">Личный</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* TODO: Wire up session start/stop from useSessionManager */}
            <Button
              type="button"
              disabled={state.shareEnabled}
              className="w-full text-black"
              style={{ backgroundColor: crew.theme.palette.accentMain }}
              onClick={async () => {
                if (!dbUser?.user_id) { toast.error("Авторизуйся"); return; }
                try {
                  const headers = await getMapRidersWriteHeaders();
                  const res = await fetch("/api/map-riders/session", {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ action: "start", userId: dbUser.user_id, crewSlug, rideName: state.rideName, vehicleLabel: state.vehicleLabel, rideMode: state.rideMode, visibility: "crew" }),
                  });
                  const json = await res.json();
                  if (!res.ok || !json.success) throw new Error(json.error);
                  dispatch({ type: "share/started", payload: { sessionId: json.data.id, rideName: state.rideName, vehicleLabel: state.vehicleLabel, rideMode: state.rideMode } });
                  toast.success("MapRiders активирован!");
                } catch (err) { toast.error(err instanceof Error ? err.message : "Ошибка запуска"); }
              }}
            >
              <VibeContentRenderer content="::FaLocationArrow::" className="mr-2" />
              Включить геошеринг
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!state.shareEnabled}
              className="w-full"
              onClick={async () => {
                if (!dbUser?.user_id || !state.sessionId) return;
                try {
                  const headers = await getMapRidersWriteHeaders();
                  const res = await fetch("/api/map-riders/session", {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ action: "stop", sessionId: state.sessionId, userId: dbUser.user_id, crewSlug, routePoints: [] }),
                  });
                  const json = await res.json();
                  if (!res.ok || !json.success) throw new Error(json.error);
                  dispatch({ type: "share/stopped" });
                  await fetchSnapshot();
                  toast.success("Заезд завершён");
                } catch (err) { toast.error(err instanceof Error ? err.message : "Ошибка остановки"); }
              }}
            >
              <VibeContentRenderer content="::FaPowerOff::" className="mr-2" />
              Завершить заезд
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={`https://t.me/share/url?url=${encodeURIComponent(`https://t.me/oneBikePlsBot/app?startapp=mapriders_${crewSlug}`)}&text=${encodeURIComponent(`${crew.header.brandName || "VIP BIKE"} MapRiders`)}`}>
                Поделиться в Telegram
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── LEADERBOARD (simplified, loads separately) ── */}
      <LeaderboardSection crew={crew} crewSlug={crewSlug} />
      {state.isLoading ? <MapRidersSkeleton /> : null}
      <StatusOverlay />
      <RiderFAB />
      <RidersDrawer />
      <FranchizePromptModal
        open={isPromptOpen}
        onClose={() => setIsPromptOpen(false)}
        onSubmit={handlePromptSubmit}
        title="Название точки встречи"
        placeholder="Точка встречи"
        defaultValue={promptValue}
      />
      <FranchizeConfirmModal
        open={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Удалить meetup?"
        message={selectedMeetup ? `Удалить meetup «${selectedMeetup.title}»?` : "Удалить выбранную точку встречи?"}
        confirmText="Удалить"
        cancelText="Отмена"
        variant="danger"
      />
    </div>
  );
}

// ── Lazy-loaded leaderboard (own fetch) ──
function LeaderboardSection({ crew, crewSlug }: { crew: FranchizeCrewVM; crewSlug: string }) {
  const surface = crewPaletteForSurface(crew.theme);
  const { state } = useMapRiders();

  return (
    <section className="rounded-2xl border p-6 backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)" }}>
      <h3 className="font-orbitron text-xl" style={{ color: crew.theme.palette.textPrimary }}>Недельный зал славы</h3>
      <div className="mt-4 space-y-3">
        {state.leaderboard.map((row) => (
          <div key={row.userId} className="grid grid-cols-[56px,1fr,88px] items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="text-center font-orbitron text-xl text-amber-300">#{row.rank}</div>
            <div>
              <div className="font-medium text-white">{row.riderName}</div>
              <div className="text-xs text-muted-foreground">{row.sessions} заезд(ов) • средняя {row.avgSpeedKmh} км/ч</div>
            </div>
            <div className="text-right text-lg text-white">{row.distanceKm} км</div>
          </div>
        ))}
        {!state.leaderboard.length && <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">Лидерборд наполнится после первых треков.</div>}
      </div>
    </section>
  );
}

// ── Exported wrapper with provider ──
export function MapRidersClientRefactored({ crew, slug }: { crew: FranchizeCrewVM; slug?: string }) {
  const resolvedSlug = crew.slug || slug || "vip-bike";
  return (
    <MapRidersProvider crew={crew} slug={resolvedSlug}>
      <MapRidersInner crew={crew} />
    </MapRidersProvider>
  );
}
