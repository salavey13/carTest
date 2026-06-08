// /components/map-riders/MapRidersClientRefactored.tsx
// Refactored orchestrator — ~120 lines, no business logic.
// All state lives in MapRidersProvider/useMapRiders.
// Layout: fullscreen map + vaul bottom sheet (taxi-style).

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Drawer } from "vaul";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppContext } from "@/contexts/AppContext";
import type { FranchizeCrewVM } from "@/app/franchize/actions";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";
import { useMaps } from "@/lib/maps/useMaps";
import { MapRidersProvider, useMapRiders, useMapRidersState } from "@/hooks/useMapRidersContext";
import { formatRideDuration, initialsFromName, riderDisplayName } from "@/lib/map-riders";
import { useLiveRiders } from "@/hooks/useLiveRiders";
import { useIsAdmin } from "@/app/franchize/hooks/useIsAdmin";
import { getMapRidersWriteHeaders } from "@/lib/map-riders-client-auth";
import { useMeetupCreator } from "@/hooks/useMeetupCreator";
import { FranchizeConfirmModal } from "@/app/franchize/components/FranchizeConfirmModal";
import { FranchizePromptModal } from "@/app/franchize/components/FranchizePromptModal";
import { RiderMarkerLayer } from "@/components/map-riders/RiderMarkerLayer";
import { RiderFAB } from "@/components/map-riders/RiderFAB";
import { RidersDrawer } from "@/components/map-riders/RidersDrawer";
import { StatusOverlay } from "@/components/map-riders/StatusOverlay";
import { SpeedGradientRoute } from "@/components/map-riders/SpeedGradientRoute";
import { MapRidersDebugPanel } from "@/components/map-riders/MapRidersDebugPanel";
import { MapRidersSkeleton } from "@/components/map-riders/LoadingSkeleton";
import { BeginnerRiderOnboardingQuiz } from "@/components/map-riders/BeginnerRiderOnboardingQuiz";
import { useSessionManager } from "@/app/franchize/hooks/useSessionManager";

// Lazy-load map (SSR disabled)
const RacingMap = dynamic(() => import("@/components/maps/RacingMap").then((mod) => mod.RacingMap), { ssr: false });

const DEFAULT_BOUNDS = { top: 56.42, bottom: 56.08, left: 43.66, right: 44.12 };
// HQ coordinates: пл. Комсомольская 2 (56.297654, 43.947218)
// Demo riders placed near HQ for realistic visualization
const HOME_BASE: [number, number] = [56.297654, 43.947218];
const DEMO_RIDER_OFFSETS: [number, number][] = [
  [56.301, 43.952],  // North-east of HQ
  [56.296, 43.935],  // South-west of HQ
  [56.294, 43.960],  // South-east of HQ
];
const MEETUP_ACTION_DEBOUNCE_MS = 2000;

// Snap labels for the 3-button control (matching vaul snapPoints)
const SNAP_POINTS = [0.2, 0.48, 0.86] as const;
const DRAWER_SNAP_POINTS: number[] = [...SNAP_POINTS];
type SnapLabel = "Мини" | "Средне" | "Макс";
const SNAP_LABELS: Record<number, SnapLabel> = { 0.2: "Мини", 0.48: "Средне", 0.86: "Макс" };

// ── Inner component (uses context) ──
function MapRidersInner({ crew }: { crew: FranchizeCrewVM }) {
  const { dbUser } = useAppContext();
  const { state, dispatch, crewSlug, fetchSnapshot, fetchSessionDetail } = useMapRiders();
  const isAdmin = useIsAdmin();
  const [isQuickMeetupSaving, setIsQuickMeetupSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [activeSnap, setActiveSnap] = useState<number>(0.48);
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
  const { createMeetup } = useMeetupCreator(crewSlug);
  const { canStart, canStop, startSession, stopSession } = useSessionManager({
    authErrorMessage: "Авторизуйся",
    stopSuccessMessage: "Заезд завершён",
  });
  const drawerEmptyStateCopy = useMemo(
    () => ({
      history:
        state.recentCompleted.length > 0
          ? `У вас ${state.recentCompleted.length} завершённых заезд(ов) за эту неделю 🏆`
          : "Пока тут пусто... maybe go ride first?",
      meetups:
        state.meetups.length > 0
          ? `Активных точек встречи: ${state.meetups.length}. Тапни на карту, чтобы добавить свою.`
          : "Пока тут пусто... maybe go ride first?",
    }),
    [state.meetups.length, state.recentCompleted.length],
  );

  // ── Inject crew theme CSS vars for FranchizeMapBottomNav ──
  useEffect(() => {
    const root = document.documentElement;
    const prevAccent = root.style.getPropertyValue("--fr-map-nav-accent");
    const prevText = root.style.getPropertyValue("--fr-map-nav-text");
    const prevBg = root.style.getPropertyValue("--fr-map-nav-bg");
    root.style.setProperty("--fr-map-nav-accent", crew.theme.palette.accentMain);
    root.style.setProperty("--fr-map-nav-text", crew.theme.palette.textPrimary);
    root.style.setProperty("--fr-map-nav-bg", crew.theme.palette.bgBase);
    return () => {
      if (prevAccent) root.style.setProperty("--fr-map-nav-accent", prevAccent); else root.style.removeProperty("--fr-map-nav-accent");
      if (prevText) root.style.setProperty("--fr-map-nav-text", prevText); else root.style.removeProperty("--fr-map-nav-text");
      if (prevBg) root.style.setProperty("--fr-map-nav-bg", prevBg); else root.style.removeProperty("--fr-map-nav-bg");
    };
  }, [crew.theme.palette.accentMain, crew.theme.palette.bgBase, crew.theme.palette.textPrimary]);

  useEffect(() => {
    const { documentElement, body } = document;
    const prevHtmlOverscroll = documentElement.style.overscrollBehavior;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    const prevBodyOverflow = body.style.overflow;

    // Telegram WebView can route gesture intent to page scroll unless we lock overscroll.
    documentElement.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";

    return () => {
      documentElement.style.overscrollBehavior = prevHtmlOverscroll;
      body.style.overscrollBehavior = prevBodyOverscroll;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  // ── GPS tracking hook ──
  const { isUsingTelegram, lastBroadcastAt, queuedPoints } = useLiveRiders({
    crewSlug,
    sessionId: state.sessionId,
    userId: dbUser?.user_id || null,
    enabled: state.shareEnabled && Boolean(state.sessionId),
    paused: state.sharePaused,
    privacy: {
      visibilityMode: state.visibilityMode,
      homeBlurEnabled: state.homeBlurEnabled,
      autoExpireMinutes: state.autoExpireMinutes,
      expiresAt: state.shareExpiresAt,
    },
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
  const riderPoints = useMemo(
    () =>
      Array.from(state.liveRiders.values())
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
        }),
    [state.liveRiders, state.sessions],
  );
  const showDemo = riderPoints.length === 0 && !state.shareEnabled;

  const staticMapPoints = useMemo(() => {
    return (mapData?.points || []).filter((point) => {
      const normalizedId = String(point.id || "").toLowerCase();
      const normalizedName = String(point.name || "").toLowerCase();
      // Filter out demo rider points from old locations
      return (
        normalizedId !== "demo-rider-beta" &&
        !normalizedName.includes("demo rider beta") &&
        normalizedId !== "vip-base-point" &&
        normalizedId !== "vip-riverside-safe-point" &&
        normalizedId !== "vip-demo-rider-a" &&
        normalizedId !== "vip-demo-rider-b" &&
        normalizedId !== "vip-demo-rider-c" &&
        !normalizedName.includes("demo rider") &&
        !normalizedName.includes("rider •")
      );
    });
  }, [mapData?.points, mapData?.bounds]);

  const mapPoints = useMemo(() => {
    const demoPoints = showDemo
      ? DEMO_RIDER_OFFSETS.map((coords, index) => ({
          id: `demo-rider-${String.fromCharCode(65 + index)}`,
          name: `Demo Rider ${String.fromCharCode(65 + index)} • ${12 + index * 2} км/ч`,
          type: "point" as const,
          icon: `image:https://placehold.co/56x56/111827/ffffff?text=${String.fromCharCode(65 + index)}`,
          color: "#60a5fa",
          coords: [coords],
          markerClassName: "animate-in fade-in duration-300",
        }))
      : [];

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

    return [...staticMapPoints, ...routePoints, ...riderPoints, ...demoPoints, ...meetupPoints];
  }, [staticMapPoints, riderPoints, showDemo, state.meetups, state.sessionDetail]);

  const riderStatusCounts = useMemo(() => {
    const riders = Array.from(state.liveRiders.values());
    return {
      live: riders.filter((rider) => rider.status === "live").length,
      stale: riders.filter((rider) => rider.status === "stale").length,
      offline: riders.filter((rider) => rider.status === "evicted").length,
    };
  }, [state.liveRiders]);

  const heroStats = useMemo(
    () => [
      { label: "В эфире", value: state.stats.activeRiders, icon: "::FaSatelliteDish::" },
      { label: "Точки встречи", value: state.stats.meetupCount, icon: "::FaUsersViewfinder::" },
      { label: "Км за 7 дней", value: state.stats.totalWeeklyDistanceKm, icon: "::FaRoad::" },
    ],
    [state.stats.activeRiders, state.stats.meetupCount, state.stats.totalWeeklyDistanceKm],
  );

  const shareModeLabel = state.visibilityMode === "public" ? "публично" : "экипаж";
  const nextAutoStopLabel = state.shareExpiresAt
    ? new Date(state.shareExpiresAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : `${state.autoExpireMinutes} мин`;

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
  const selectedMeetupOwnerLabel = useMemo(() => {
    if (!selectedMeetup) return null;
    const fullName = selectedMeetup.users?.full_name?.trim();
    const username = selectedMeetup.users?.username?.trim();
    if (fullName) return fullName;
    if (username) return `@${username}`;
    return selectedMeetup.created_by_user_id;
  }, [selectedMeetup]);
  const isSelectedMeetupOwnedByCurrentUser = useMemo(() => {
    if (!selectedMeetup || !dbUser?.user_id) return false;
    return selectedMeetup.created_by_user_id === dbUser.user_id;
  }, [dbUser?.user_id, selectedMeetup]);

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

      setIsPromptOpen(false);
      setIsQuickMeetupSaving(true);
      try {
        await createMeetup({
          userId: dbUser.user_id,
          title: value,
          comment: "Добавлено с карты",
          point: state.selectedMeetupPoint,
          successMessage: "Meetup добавлен по выбранной точке",
        });
      } finally {
        setIsQuickMeetupSaving(false);
      }
    },
    [createMeetup, dbUser?.user_id, state.selectedMeetupPoint],
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
      className="fixed inset-0 isolate h-[100dvh] w-full overflow-hidden"
      style={{
        ["--mr-accent" as string]: crew.theme.palette.accentMain,
        ["--mr-accent-hover" as string]: crew.theme.palette.accentMainHover,
        ["--mr-border" as string]: crew.theme.palette.borderSoft,
        ["--mr-card" as string]: surface.subtleCard.backgroundColor,
        ["--mr-text" as string]: crew.theme.palette.textPrimary,
        ["--mr-muted" as string]: crew.theme.palette.textSecondary,
      }}
    >
      {/* ── MAP (fullscreen background) ── */}
      <section className="fixed inset-0 overflow-hidden [touch-action:pan-x_pan-y_pinch-zoom]" style={{ borderColor: `${crew.theme.palette.borderSoft}aa` }}>
        <div className="absolute inset-0 z-0">
          {useLeafletMap ? (
            <RacingMap
              points={mapPoints}
              bounds={mapData?.bounds || mapBounds || DEFAULT_BOUNDS}
              className="h-full min-h-[100dvh] w-full"
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
            <div className="flex h-full min-h-[100dvh] items-center justify-center text-muted-foreground">
              Режим VibeMap (резерв) — установи NEXT_PUBLIC_MAP_ENGINE=leaflet
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-black/30 via-transparent to-black/30" />
          <MapRidersDebugPanel
            activeRiders={state.liveRiders.size}
            sessionCount={state.sessions.length}
            pendingBatchPoints={queuedPoints}
            isUsingTelegram={isUsingTelegram}
            lastBroadcastAt={lastBroadcastAt}
          />
        </div>

        {/* Floating badges (absolute top, no viewport-height flex) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 md:p-6">
          <div className="flex flex-wrap gap-2">
            <Badge className="border bg-black/55 text-white backdrop-blur-md">{useLeafletMap ? `Leaflet${isUsingTelegram ? " + Telegram GPS" : " + Browser GPS"}` : "VibeMap"}</Badge>
            <Badge className="border border-emerald-300/45 bg-emerald-500/20 text-emerald-100">live {riderStatusCounts.live}</Badge>
            {riderStatusCounts.stale ? <Badge className="border border-amber-300/45 bg-amber-500/20 text-amber-100">stale {riderStatusCounts.stale}</Badge> : null}
            {mapData?.routes?.length ? <Badge className="border border-sky-300/50 bg-sky-500/20 text-sky-100">{mapData.routes.length} маршрутов</Badge> : null}
            <Badge className="border border-white/20 bg-black/45 text-white/90">{shareModeLabel} • автостоп {nextAutoStopLabel}</Badge>
            {showDemo ? (
              <Badge className="border border-emerald-300/40 bg-emerald-500/20 text-emerald-100">Демо-режим</Badge>
            ) : null}
          </div>
          <div className="mt-2 flex justify-end">
            <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-2xl border border-white/30 bg-black/60 px-3 py-2 text-xs text-white shadow-2xl shadow-black/30 backdrop-blur-md">
              <span className="min-w-0">
                <span className="block font-medium text-white">
                  {selectedMeetup
                    ? `Точка встречи: ${selectedMeetup.title}`
                    : state.selectedMeetupPoint
                    ? `Точка: ${state.selectedMeetupPoint[0].toFixed(4)}, ${state.selectedMeetupPoint[1].toFixed(4)}`
                    : "Тапни — выбрать, удерживай — meetup"}
                </span>
                <span className="block text-[11px] text-white/65">Long-press не двигает карту и сразу готовит точку встречи.</span>
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

      {/* ── DRAGGABLE TAXI-STYLE BOTTOM SHEET (vaul) ── */}
      <Drawer.Root
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        snapPoints={DRAWER_SNAP_POINTS}
        activeSnapPoint={activeSnap}
        setActiveSnapPoint={(snapPoint) => {
          if (typeof snapPoint === "number") setActiveSnap(snapPoint);
        }}
        dismissible={false}
        modal={false}
      >
        <Drawer.Portal>
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-20 pointer-events-none">
            <div className={`rounded-t-[1.4rem] border border-white/15 bg-[var(--mr-card)]/96 p-3 shadow-[0_-20px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl ${activeSnap <= 0.2 ? "pointer-events-none" : "pointer-events-auto"}`}><Drawer.Handle className="pointer-events-auto mx-auto mb-2 h-1.5 w-14 rounded-full bg-white/35" />
            {/* Snap control buttons */}
            <div className="pointer-events-auto mb-3 flex items-center justify-between gap-2">
              <h3 className="font-orbitron text-sm text-white/90">Панель райдера</h3>
              <div className="pointer-events-auto flex gap-1.5">
                {SNAP_POINTS.map((snap) => (
                  <Button
                    key={snap}
                    type="button"
                    size="sm"
                    variant={activeSnap === snap ? "default" : "outline"}
                    className="h-7 px-2 text-xs"
                    onClick={() => setActiveSnap(snap)}
                  >
                    {SNAP_LABELS[snap]}
                  </Button>
                ))}
              </div>
            </div>
            <div className={`mx-auto max-h-[82dvh] w-full max-w-6xl overflow-y-auto pb-[calc(8.5rem+env(safe-area-inset-bottom))] [touch-action:pan-y] ${activeSnap <= 0.2 ? "pointer-events-none opacity-70" : "pointer-events-auto opacity-100"}`}>
              <BeginnerRiderOnboardingQuiz crew={crew} />
              <div className="mt-3 grid gap-3 lg:grid-cols-[1.35fr,1fr]">

        {/* Stats card */}
        <div className="rounded-2xl border p-4 backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)" }}>
          <Badge className="mb-3 w-fit border" style={{ borderColor: `${crew.theme.palette.accentMain}55`, backgroundColor: `${crew.theme.palette.accentMain}18`, color: crew.theme.palette.accentMain }}>
            {(crew.header.brandName || crew.name || "VIP BIKE").toUpperCase()} • MAPRIDERS
          </Badge>
          <h2 className="mt-2 font-orbitron text-2xl" style={{ color: crew.theme.palette.textPrimary }}>
            Карта райдеров в реальном времени
          </h2>
          <p className="mt-1 max-w-2xl text-sm" style={{ color: crew.theme.palette.textSecondary }}>
            Один тап — и экипаж видит твой маршрут, скорость и meetup-пины.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {heroStats.map((stat) => (
              <div key={stat.label} className="rounded-xl border p-3" style={{ borderColor: `${crew.theme.palette.borderSoft}aa`, backgroundColor: `${crew.theme.palette.bgBase}66` }}>
                <div className="mb-2" style={{ color: crew.theme.palette.accentMain }}>
                  <VibeContentRenderer content={stat.icon} />
                </div>
                <div className="text-xl font-semibold" style={{ color: crew.theme.palette.textPrimary }}>{stat.value}</div>
                <div className="text-xs" style={{ color: crew.theme.palette.textSecondary }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Rider control panel */}
        <div className="rounded-2xl border p-4 backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)" }}>
          <h3 className="font-orbitron text-xl" style={{ color: crew.theme.palette.textPrimary }}>Пульт райдера</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {state.shareEnabled ? "Ты сейчас в эфире на карте" : "Геошеринг выключен"}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-2 py-2 text-emerald-100">
              <div className="font-semibold">{riderStatusCounts.live}</div>
              <div className="text-[10px] uppercase tracking-wide text-emerald-200/70">live</div>
            </div>
            <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 px-2 py-2 text-amber-100">
              <div className="font-semibold">{riderStatusCounts.stale}</div>
              <div className="text-[10px] uppercase tracking-wide text-amber-200/70">stale</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-white">
              <div className="font-semibold">{queuedPoints}</div>
              <div className="text-[10px] uppercase tracking-wide text-white/60">queue</div>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {isAdmin ? (
              <Button asChild variant="outline" className="w-full justify-center">
                <Link href="/admin/map-routes">Открыть маршруты карты</Link>
              </Button>
            ) : null}
            <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
              <Label htmlFor="map-riders-ride-name" className="sr-only">
                Название заезда
              </Label>
              <Input
                id="map-riders-ride-name"
                value={state.rideName}
                onChange={(event) => dispatch({ type: "ui/set-ride-name", payload: event.target.value })}
                placeholder="Название заезда"
                className="h-9"
              />
              <Label htmlFor="map-riders-vehicle-label" className="sr-only">
                Мотоцикл
              </Label>
              <Input
                id="map-riders-vehicle-label"
                value={state.vehicleLabel}
                onChange={(event) => dispatch({ type: "ui/set-vehicle-label", payload: event.target.value })}
                placeholder="Мотоцикл"
                className="h-9"
              />
              <Select
                value={state.rideMode}
                onValueChange={(value: "rental" | "personal") => dispatch({ type: "ui/set-ride-mode", payload: value })}
              >
                <SelectTrigger aria-label="Режим поездки" className="h-9">
                  <SelectValue placeholder="Режим поездки" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rental">Аренда</SelectItem>
                  <SelectItem value="personal">Личный</SelectItem>
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Select value={state.visibilityMode} onValueChange={(value: "crew" | "public") => dispatch({ type: "privacy/set-visibility", payload: value })}>
                    <SelectTrigger aria-label="Кто видит мою позицию" className="h-9">
                      <SelectValue placeholder="Видимость" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="crew">Только экипаж</SelectItem>
                      <SelectItem value="public">Все авторизованные</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Select value={String(state.autoExpireMinutes)} onValueChange={(value: "1" | "5" | "15" | "60") => dispatch({ type: "privacy/set-auto-expire", payload: Number(value) as 1 | 5 | 15 | 60 })}>
                    <SelectTrigger aria-label="Автоматически остановить геошеринг" className="h-9">
                      <SelectValue placeholder="Авто-стоп" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 мин</SelectItem>
                      <SelectItem value="5">5 мин</SelectItem>
                      <SelectItem value="15">15 мин</SelectItem>
                      <SelectItem value="60">60 мин</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => dispatch({ type: "privacy/toggle-home-blur" })}>
                {state.homeBlurEnabled ? "Дом размыт: ВКЛ" : "Дом размыт: ВЫКЛ"}
              </Button>
            </div>
            <Button
              type="button"
              disabled={!canStart}
              className="w-full text-black"
              style={{ backgroundColor: crew.theme.palette.accentMain }}
              onClick={startSession}
            >
              <VibeContentRenderer content="::FaLocationArrow::" className="mr-2" />
              Включить геошеринг
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!state.shareEnabled}
              className="w-full"
              onClick={() => dispatch({ type: "privacy/toggle-pause" })}
            >
              <VibeContentRenderer content={state.sharePaused ? "::FaPlay::" : "::FaPause::"} className="mr-2" />
              {state.sharePaused ? "Возобновить трансляцию" : "Пауза трансляции"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!canStop}
              className="w-full"
              onClick={stopSession}
            >
              <VibeContentRenderer content="::FaPowerOff::" className="mr-2" />
              Завершить заезд
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={`https://t.me/share/url?url=${encodeURIComponent(`https://t.me/oneBikePlsBot/app?startapp=mapriders_${crewSlug}`)}&text=${encodeURIComponent(`${crew.header.brandName || "VIP BIKE"} MapRiders`)}`}>
                Поделиться в Telegram
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/franchize/${crewSlug}/community`}>События и партнёры</Link>
            </Button>
          </div>
        </div>
              </div>
              <div className="mt-4">
                <LeaderboardSection crew={crew} crewSlug={crewSlug} />
              </div>
            </div>
          </div>
        </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
      {state.isLoading ? <MapRidersSkeleton /> : null}
      <StatusOverlay />
      <RiderFAB />
      <RidersDrawer emptyStateCopy={drawerEmptyStateCopy} />
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
        confirmDisabled={isMeetupDeleting}
        message={
          selectedMeetup
            ? `Удалить meetup «${selectedMeetup.title}»?\n\nВладелец: ${selectedMeetupOwnerLabel || "неизвестно"}${
                isSelectedMeetupOwnedByCurrentUser ? " (вы)" : ""
              }.\nУдаление доступно автору, owner экипажа или admin.`
            : "Удалить выбранную точку встречи?"
        }
        confirmText={isMeetupDeleting ? "Удаляем…" : "Удалить"}
        cancelText="Отмена"
        variant="danger"
      />
    </div>
  );
}

// ── Lazy-loaded leaderboard (own fetch) ──
function LeaderboardSection({ crew, crewSlug }: { crew: FranchizeCrewVM; crewSlug: string }) {
  const surface = crewPaletteForSurface(crew.theme);
  const { state } = useMapRidersState();

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
