// /components/map-riders/RidersDrawer.tsx
// Bottom sheet with rider list + session controls + meetup form.
// Uses vaul (already in deps).

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMapRiders } from "@/hooks/useMapRidersContext";
import { useAppContext } from "@/contexts/AppContext";
import { riderDisplayName, formatRideDuration } from "@/lib/map-riders";
import { toast } from "sonner";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { useMeetupCreator } from "@/hooks/useMeetupCreator";
import { useSessionManager } from "@/app/franchize/hooks/useSessionManager";
import type { FranchizeCrewVM } from "@/app/franchize/actions";
import { useRouter } from "next/navigation";

type RidersDrawerEmptyStateCopy = {
  history: string;
  meetups: string;
};

type RidersDrawerProps = {
  emptyStateCopy?: RidersDrawerEmptyStateCopy;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
  /** Карта-хозяин (для акцента в табе «Эфир»); может не приходить. */
  crew?: FranchizeCrewVM;
  /** Таб, который просят открыть извне («Топ» в нижней навигации → ride). */
  initialTab?: string;
  /** Конец заезда, начатого/остановленного из таба «Эфир» — тот же
   *  обработчик, что у FAB, чтобы кнопка «Поделиться заездом» поднялась. */
  onRideStopped?: (endedSessionId: string) => void;
};

const DEFAULT_EMPTY_STATE_COPY: RidersDrawerEmptyStateCopy = {
  history: "Пока тут пусто... maybe go ride first?",
  meetups: "Пока тут пусто... maybe go ride first?",
};

export function RidersDrawer({ emptyStateCopy = DEFAULT_EMPTY_STATE_COPY, externalOpen, onExternalOpenChange, crew, initialTab, onRideStopped }: RidersDrawerProps) {
  const { state, dispatch, crewSlug, fetchSnapshot, fetchSessionDetail } = useMapRiders();
  const { dbUser } = useAppContext();
  // Rider profile v1: name → public profile. A <Link> inside the row <button>
  // would be invalid HTML (interactive-in-interactive), so: span + router push
  // + stopPropagation (tap the name, not the row).
  const router = useRouter();
  const openRiderProfile = (userId: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/franchize/${crewSlug}/rider/${userId}`);
  };
  const contentRef = useRef<HTMLDivElement | null>(null);

  const [meetupTitle, setMeetupTitle] = useState("Точка сбора");
  const [meetupComment, setMeetupComment] = useState("");
  const [isReplayOpen, setIsReplayOpen] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const { createMeetup, isSubmitting } = useMeetupCreator(crewSlug);

  // Use external control if provided, otherwise use internal state
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalOpen !== undefined ? externalOpen : internalIsOpen;
  const setIsOpen = onExternalOpenChange || setInternalIsOpen;
  // Контролируемый таб: извне могут попросить ride («Топ» в нижней навигации).
  const [tab, setTab] = useState<string>(initialTab ?? "riders");
  useEffect(() => {
    if (isOpen && initialTab) setTab(initialTab);
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefersReducedMotion(media.matches);
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  const drawerSnapPoints = useMemo(() => (prefersReducedMotion ? [1] : [0.64, 380 / 820, 640 / 820]), [prefersReducedMotion]);
  // Акцент экипажа для таба «Эфир» (канвас-безопасный hex; авто-тема → amber).
  const accentColor = crew?.theme.isAuto ? "#facc15" : crew?.theme.palette.accentMain || "#facc15";
  const activeHistoryWarmupSessions = useMemo(
    () => state.sessions.filter((session) => session.status === "active" && Number(session.total_distance_km || 0) <= 0),
    [state.sessions],
  );

  useEffect(() => {
    if (!isOpen) return;
    const node = contentRef.current;
    if (!node) return;

    const focusable = node.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }
      if (event.key !== "Tab" || !first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => node.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const handleCreateMeetup = useCallback(async () => {
    if (!dbUser?.user_id) {
      toast.error("Ткни по карте и авторизуйся");
      return;
    }
    const created = await createMeetup({
      userId: dbUser.user_id,
      title: meetupTitle,
      comment: meetupComment,
      successMessage: "Meetup сохранён и опубликован в экипаже",
      clearForm: () => {
        setMeetupTitle("Точка сбора");
        setMeetupComment("");
      },
    });
    if (created) {
      setMeetupTitle("Точка сбора");
      setMeetupComment("");
    }
  }, [createMeetup, dbUser?.user_id, meetupComment, meetupTitle]);

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 md:hidden">
      <Drawer.Root
        open={isOpen}
        onOpenChange={(nextOpen) => {
          setIsOpen(nextOpen);
          dispatch({ type: "ui/toggle-drawer" });
        }}
        snapPoints={drawerSnapPoints}
      >
        <Drawer.Handle
          className="pointer-events-auto mx-auto mb-1 h-1.5 w-12 rounded-full bg-white/30"
          onClick={() => setInternalIsOpen((prev) => !prev)}
        />
        {isOpen ? (
          <Drawer.Content
            ref={contentRef}
            role="dialog"
            aria-label="Панель райдеров и meetup"
            className="pointer-events-auto mx-auto flex h-full w-full max-w-lg flex-col rounded-t-2xl bg-black/90 backdrop-blur-xl"
          >
          <Tabs value={tab} onValueChange={setTab} className="flex h-full flex-col">
            <div className="border-b border-white/10 px-4 pt-3">
              <TabsList className="grid w-full grid-cols-4 bg-transparent">
                <TabsTrigger value="riders" className="text-xs data-[state=active]:bg-white/10">
                  Riders ({state.sessions.length})
                </TabsTrigger>
                <TabsTrigger value="meetups" className="text-xs data-[state=active]:bg-white/10">
                  Meetups ({state.meetups.length})
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs data-[state=active]:bg-white/10">
                  History
                </TabsTrigger>
                <TabsTrigger value="ride" className="text-xs data-[state=active]:bg-white/10">
                  Эфир
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── Riders tab ── */}
            <TabsContent value="riders" className="flex-1 overflow-auto p-4">
              <div className="space-y-2">
                {state.sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => fetchSessionDetail(session.id)}
                    className="flex w-full items-center justify-between rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-left transition hover:border-amber-300/70"
                  >
                    <div>
                      {/* Rider profile v1: tap the name → public profile. */}
                      <span
                        role="link"
                        tabIndex={0}
                        onClick={openRiderProfile(session.user_id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openRiderProfile(session.user_id)(e as unknown as React.MouseEvent);
                          }
                        }}
                        className="cursor-pointer text-sm font-medium text-white underline-offset-2 hover:underline"
                      >
                        {riderDisplayName(session.users, session.user_id)}
                      </span>
                      <div className="text-[11px] text-zinc-400">{session.ride_name || "Без названия"}</div>
                    </div>
                    <div className="text-right text-xs text-amber-100">
                      <div>{Number(session.total_distance_km || 0).toFixed(1)} км</div>
                      <div>{Number(session.latest_speed_kmh || 0).toFixed(0)} км/ч</div>
                    </div>
                  </button>
                ))}
                {!state.sessions.length && (
                  <div className="rounded-xl border border-dashed border-white/25 p-4 text-center text-xs text-muted-foreground">
                    Никого в эфире. Включи live share!
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Meetups tab ── */}
            <TabsContent value="meetups" className="flex-1 overflow-auto p-4">
              <div className="space-y-3">
                {state.selectedMeetupPoint && (
                  <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-3">
                    <Label htmlFor="map-riders-meetup-title" className="text-xs text-amber-200">
                      Название
                    </Label>
                    <Input
                      id="map-riders-meetup-title"
                      value={meetupTitle}
                      onChange={(e) => setMeetupTitle(e.target.value)}
                      className="mt-1 bg-transparent text-white"
                    />
                    <Label htmlFor="map-riders-meetup-comment" className="mt-2 text-xs text-amber-200">
                      Комментарий
                    </Label>
                    <Input
                      id="map-riders-meetup-comment"
                      value={meetupComment}
                      onChange={(e) => setMeetupComment(e.target.value)}
                      placeholder="Ориентир"
                      className="mt-1 bg-transparent text-white"
                    />
                    <Button type="button" size="sm" className="mt-2 w-full" disabled={isSubmitting} onClick={handleCreateMeetup}>
                      {isSubmitting ? "Сохраняем meetup..." : "Сохранить meetup"}
                    </Button>
                  </div>
                )}
                {state.meetups.map((m) => (
                  <div key={m.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <div className="text-sm font-medium text-orange-300">{m.title}</div>
                    {m.comment && <div className="text-xs text-zinc-400">{m.comment}</div>}
                  </div>
                ))}
                {!state.meetups.length && !state.selectedMeetupPoint && (
                  <div className="rounded-xl border border-dashed border-white/25 p-4 text-center text-xs text-muted-foreground">
                    {emptyStateCopy.meetups}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── History tab ── */}
            <TabsContent value="history" className="flex-1 overflow-auto p-4">
              <div className="space-y-2">
                {activeHistoryWarmupSessions.map((session) => {
                  const selectedSessionId = state.sessionDetail?.session?.id;
                  const capturedRoutePoints = selectedSessionId === session.id ? state.sessionDetail?.points?.length || 0 : 0;
                  const gpsWarmupHint = capturedRoutePoints > 0
                    ? "Маршрут записывается, но дистанция еще не посчитана."
                    : "⚠️ GPS прогревается, подожди секунду...";

                  return (
                    <div key={`active-warmup-${session.id}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => fetchSessionDetail(session.id)}
                        className="flex w-full items-center justify-between text-left transition hover:text-emerald-100"
                      >
                        <div>
                          <span
                            role="link"
                            tabIndex={0}
                            onClick={openRiderProfile(session.user_id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openRiderProfile(session.user_id)(e as unknown as React.MouseEvent);
                              }
                            }}
                            className="cursor-pointer text-sm font-medium text-white underline-offset-2 hover:underline"
                          >
                            {riderDisplayName(session.users, session.user_id)}
                          </span>
                          <div className="text-xs text-zinc-400">{session.ride_name || "Без названия"} • {formatRideDuration(0)}</div>
                        </div>
                        <div className="text-right text-sm text-emerald-200">
                          <div>{Number(session.total_distance_km || 0).toFixed(1)} км</div>
                          <div className="text-xs">{Number(session.latest_speed_kmh || 0).toFixed(0)} км/ч</div>
                        </div>
                      </button>
                      <div className="mt-2 text-[11px] text-zinc-400">{gpsWarmupHint}</div>
                    </div>
                  );
                })}
                {state.recentCompleted.map((session) => (
                  <div key={session.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => fetchSessionDetail(session.id)}
                      className="flex w-full items-center justify-between text-left transition hover:text-emerald-100"
                    >
                      <div>
                        <div className="text-sm font-medium text-white">{session.rider_name}</div>
                        <div className="text-xs text-zinc-400">{session.ride_name || "Без названия"} • {formatRideDuration(session.duration_seconds)}</div>
                      </div>
                      <div className="text-right text-sm text-emerald-200">
                        <div>{Number(session.total_distance_km || 0).toFixed(1)} км</div>
                        <div className="text-xs">avg {Number(session.avg_speed_kmh || 0).toFixed(1)}</div>
                      </div>
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2 h-8 w-full border-emerald-300/40 text-emerald-100"
                      onClick={async () => {
                        await fetchSessionDetail(session.id);
                        setIsReplayOpen(true);
                      }}
                    >
                      Открыть replay
                    </Button>
                  </div>
                ))}
                {!state.recentCompleted.length && !activeHistoryWarmupSessions.length && (
                  <div className="rounded-xl border border-dashed border-white/25 p-4 text-center text-xs text-muted-foreground">
                    {emptyStateCopy.history}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Ride tab («Эфир»): пульт заезда + приватность + зал славы.
                Сюда переехал бывший «Пульт райдера» из шита — шит теперь
                целиком отдан стене экипажа. ── */}
            <TabsContent value="ride" className="flex-1 overflow-auto p-4">
              <RideControlsPanel accentColor={accentColor} onRideStopped={onRideStopped} />
              <LeaderboardPanel accentColor={accentColor} />
            </TabsContent>
          </Tabs>
          </Drawer.Content>
        ) : null}
      </Drawer.Root>

      {isReplayOpen ? (
        <ReplayFullscreen
          points={state.sessionDetail?.points || []}
          title={state.sessionDetail?.session?.ride_name || "Маршрут заезда"}
          onClose={() => setIsReplayOpen(false)}
        />
      ) : null}
    </div>
  );
}

/**
 * Пульт заезда: бывший «Пульт райдера» из шита. Start/stop дублирует жёлтый
 * FAB, но здесь же живут название заезда, мотоцикл, режим, приватность
 * (видимость / авто-стоп / размытие дома) и пауза трансляции.
 */
function RideControlsPanel({ accentColor, onRideStopped }: { accentColor: string; onRideStopped?: (endedSessionId: string) => void }) {
  const { state, dispatch } = useMapRiders();
  const { canStart, canStop, startSession, stopSession } = useSessionManager({
    authErrorMessage: "Авторизуйся",
    stopSuccessMessage: "Заезд завершён",
    onRideStopped,
  });

  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">Эфир и заезд</h3>
        <Badge className="w-fit border-none" style={{ backgroundColor: `${accentColor}22`, color: accentColor }}>
          {state.shareEnabled ? (state.sharePaused ? "пауза" : "в эфире") : "выключен"}
        </Badge>
      </div>

      <div className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
        <Label htmlFor="map-riders-drawer-ride-name" className="sr-only">
          Название заезда
        </Label>
        <Input
          id="map-riders-drawer-ride-name"
          value={state.rideName}
          onChange={(event) => dispatch({ type: "ui/set-ride-name", payload: event.target.value })}
          placeholder="Название заезда"
          className="h-9 bg-transparent text-white"
        />
        <Label htmlFor="map-riders-drawer-vehicle-label" className="sr-only">
          Мотоцикл
        </Label>
        <Input
          id="map-riders-drawer-vehicle-label"
          value={state.vehicleLabel}
          onChange={(event) => dispatch({ type: "ui/set-vehicle-label", payload: event.target.value })}
          placeholder="Мотоцикл"
          className="h-9 bg-transparent text-white"
        />
        <Select
          value={state.rideMode}
          onValueChange={(value: "rental" | "personal") => dispatch({ type: "ui/set-ride-mode", payload: value })}
        >
          <SelectTrigger aria-label="Режим поездки" className="h-9 bg-transparent text-white">
            <SelectValue placeholder="Режим поездки" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rental">Аренда</SelectItem>
            <SelectItem value="personal">Личный</SelectItem>
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Select value={state.visibilityMode} onValueChange={(value: "crew" | "public") => dispatch({ type: "privacy/set-visibility", payload: value })}>
            <SelectTrigger aria-label="Кто видит мою позицию" className="h-9 bg-transparent text-white">
              <SelectValue placeholder="Видимость" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="crew">Только экипаж</SelectItem>
              <SelectItem value="public">Все авторизованные</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(state.autoExpireMinutes)} onValueChange={(value: "1" | "5" | "15" | "60") => dispatch({ type: "privacy/set-auto-expire", payload: Number(value) as 1 | 5 | 15 | 60 })}>
            <SelectTrigger aria-label="Автоматически остановить геошеринг" className="h-9 bg-transparent text-white">
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
        <Button type="button" variant="outline" size="sm" className="w-full border-white/20 text-white" onClick={() => dispatch({ type: "privacy/toggle-home-blur" })}>
          {state.homeBlurEnabled ? "Дом размыт: ВКЛ" : "Дом размыт: ВЫКЛ"}
        </Button>
      </div>

      <Button
        type="button"
        disabled={!canStart}
        className="w-full text-black"
        style={{ backgroundColor: accentColor }}
        onClick={startSession}
      >
        <VibeContentRenderer content="::FaLocationArrow::" className="mr-2" />
        Включить геошеринг
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!state.shareEnabled}
          className="w-full border-white/20 text-white"
          onClick={() => dispatch({ type: "privacy/toggle-pause" })}
        >
          <VibeContentRenderer content={state.sharePaused ? "::FaPlay::" : "::FaPause::"} className="mr-2" />
          {state.sharePaused ? "Продолжить" : "Пауза"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!canStop}
          className="w-full border-white/20 text-white"
          onClick={stopSession}
        >
          <VibeContentRenderer content="::FaPowerOff::" className="mr-2" />
          Завершить
        </Button>
      </div>
    </section>
  );
}

/** Недельный зал славы (переехал из шита без изменений логики). */
function LeaderboardPanel({ accentColor }: { accentColor: string }) {
  const { state } = useMapRiders();

  return (
    <section className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
        <span style={{ color: accentColor }}>🏆</span> Недельный зал славы
      </h3>
      <div className="mt-3 space-y-2">
        {state.leaderboard.map((row) => (
          <div key={row.userId} className="grid grid-cols-[44px,1fr,72px] items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <div className="text-center font-orbitron text-lg" style={{ color: accentColor }}>#{row.rank}</div>
            <div>
              <div className="text-sm font-medium text-white">{row.riderName}</div>
              <div className="text-[11px] text-zinc-400">{row.sessions} заезд(ов) • средняя {row.avgSpeedKmh} км/ч</div>
            </div>
            <div className="text-right text-sm text-white">{row.distanceKm} км</div>
          </div>
        ))}
        {!state.leaderboard.length && (
          <div className="rounded-xl border border-dashed border-white/25 p-3 text-center text-xs text-muted-foreground">
            Лидерборд наполнится после первых треков.
          </div>
        )}
      </div>
    </section>
  );
}

function ReplayFullscreen({
  points,
  title,
  onClose,
}: {
  points: Array<{ lat: number; lon: number; speedKmh: number; capturedAt: string }>;
  title: string;
  onClose: () => void;
}) {
  const total = points.length;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState<250 | 500 | 1000>(500);
  const current = points[index];

  const replayGeometry = useMemo(() => {
    if (!points.length) {
      return { path: "", playedPath: "", currentPoint: null as { x: number; y: number } | null, distanceKm: 0, durationLabel: formatRideDuration(0) };
    }

    const padding = 7;
    const width = 100;
    const height = 100;
    const lats = points.map((point) => point.lat);
    const lons = points.map((point) => point.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const latSpan = Math.max(maxLat - minLat, 0.0001);
    const lonSpan = Math.max(maxLon - minLon, 0.0001);

    const project = (point: { lat: number; lon: number }) => ({
      x: padding + ((point.lon - minLon) / lonSpan) * (width - padding * 2),
      y: height - padding - ((point.lat - minLat) / latSpan) * (height - padding * 2),
    });

    const projected = points.map(project);
    const makePath = (items: Array<{ x: number; y: number }>) =>
      items.map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");

    const played = projected.slice(0, Math.min(index + 1, projected.length));
    let distanceKm = 0;
    for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
      const prev = points[pointIndex - 1];
      const next = points[pointIndex];
      const latRad = (next.lat - prev.lat) * (Math.PI / 180);
      const lonRad = (next.lon - prev.lon) * (Math.PI / 180);
      const prevLatRad = prev.lat * (Math.PI / 180);
      const nextLatRad = next.lat * (Math.PI / 180);
      const a = Math.sin(latRad / 2) ** 2 + Math.cos(prevLatRad) * Math.cos(nextLatRad) * Math.sin(lonRad / 2) ** 2;
      distanceKm += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    const startedMs = new Date(points[0]?.capturedAt || Date.now()).getTime();
    const endedMs = new Date(points[points.length - 1]?.capturedAt || Date.now()).getTime();
    const durationSeconds = Number.isFinite(startedMs) && Number.isFinite(endedMs) ? Math.max(0, Math.round((endedMs - startedMs) / 1000)) : 0;

    return {
      path: makePath(projected),
      playedPath: makePath(played),
      currentPoint: projected[index] || projected[0] || null,
      distanceKm,
      durationLabel: formatRideDuration(durationSeconds),
    };
  }, [index, points]);

  useEffect(() => {
    if (!playing || total < 2) return;
    const timer = setInterval(() => {
      setIndex((prev) => {
        if (prev >= total - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, speedMs);
    return () => clearInterval(timer);
  }, [playing, speedMs, total]);

  useEffect(() => {
    setIndex(0);
    setPlaying(false);
  }, [total]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setIndex((prev) => Math.min(prev + 1, Math.max(total - 1, 0)));
      if (event.key === "ArrowLeft") setIndex((prev) => Math.max(prev - 1, 0));
      if (event.key === " ") {
        event.preventDefault();
        setPlaying((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, total]);

  const progress = total > 1 ? (index / (total - 1)) * 100 : 0;
  const currentTime = current?.capturedAt ? new Date(current.capturedAt).toLocaleString("ru-RU") : "—";

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black/95 p-4 text-white" role="dialog" aria-modal="true" aria-label="Полноэкранный replay маршрута">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-emerald-200/80">Route replay cockpit</div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <div className="mt-1 text-xs text-zinc-400">Space — play/pause • ←/→ — шаг • Esc — закрыть</div>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onClose} aria-label="Закрыть replay маршрута">
          Закрыть
        </Button>
      </div>

      <div className="mt-4 grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative min-h-[46vh] overflow-hidden rounded-2xl border border-emerald-300/20 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.22),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-3 shadow-2xl shadow-emerald-950/40">
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:28px_28px]" />
          {!total ? (
            <div className="relative z-10 flex h-full items-center justify-center rounded-xl border border-dashed border-white/20 px-4 text-center text-sm text-zinc-400">
              Нет точек маршрута для воспроизведения — GPS ещё прогревается или заезд только начался.
            </div>
          ) : (
            <svg className="relative z-10 h-full min-h-[46vh] w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Схема replay маршрута">
              <path d={replayGeometry.path} fill="none" stroke="rgba(148,163,184,0.42)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              <path d={replayGeometry.playedPath || replayGeometry.path} fill="none" stroke="url(#map-riders-replay-gradient)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              <defs>
                <linearGradient id="map-riders-replay-gradient" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="52%" stopColor="#facc15" />
                  <stop offset="100%" stopColor="#fb923c" />
                </linearGradient>
              </defs>
              {replayGeometry.currentPoint ? (
                <g>
                  <circle cx={replayGeometry.currentPoint.x} cy={replayGeometry.currentPoint.y} r="4.4" fill="rgba(16,185,129,0.22)" />
                  <circle cx={replayGeometry.currentPoint.x} cy={replayGeometry.currentPoint.y} r="2" fill="#fef3c7" stroke="#10b981" strokeWidth="0.9" />
                </g>
              ) : null}
            </svg>
          )}
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/55 px-3 py-2 text-xs backdrop-blur">
            <span>{replayGeometry.distanceKm.toFixed(2)} км</span>
            <span>{replayGeometry.durationLabel}</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
        </div>

        <aside className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300">
            <div className="rounded-xl bg-black/30 p-3">
              <div className="text-zinc-500">Точка</div>
              <div className="mt-1 text-lg text-white">{total ? index + 1 : 0} / {total}</div>
            </div>
            <div className="rounded-xl bg-black/30 p-3 text-right">
              <div className="text-zinc-500">Скорость</div>
              <div className="mt-1 text-lg text-emerald-200">{Number(current?.speedKmh || 0).toFixed(1)} км/ч</div>
            </div>
            <div className="col-span-2 rounded-xl bg-black/30 p-3">
              <div className="text-zinc-500">Время GPS</div>
              <div className="mt-1 break-all text-white">{currentTime}</div>
            </div>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded bg-white/10" aria-hidden="true">
            <div className="h-full rounded bg-emerald-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <Label htmlFor="map-riders-replay-position" className="mt-4 text-xs text-zinc-400">
            Timeline scrubber
          </Label>
          <input
            id="map-riders-replay-position"
            type="range"
            min={0}
            max={Math.max(total - 1, 0)}
            value={index}
            onChange={(event) => setIndex(Number(event.target.value))}
            className="mt-2 w-full accent-emerald-300"
          />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Button type="button" variant="outline" onClick={() => setIndex((prev) => Math.max(prev - 1, 0))}>← Шаг</Button>
            <Button type="button" onClick={() => setPlaying((prev) => !prev)} disabled={total < 2} aria-pressed={playing}>
              {playing ? "Пауза" : "Play"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setIndex((prev) => Math.min(prev + 1, Math.max(total - 1, 0)))}>Шаг →</Button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Button type="button" size="sm" variant={speedMs === 250 ? "default" : "outline"} onClick={() => setSpeedMs(250)} aria-pressed={speedMs === 250}>x2</Button>
            <Button type="button" size="sm" variant={speedMs === 500 ? "default" : "outline"} onClick={() => setSpeedMs(500)} aria-pressed={speedMs === 500}>x1</Button>
            <Button type="button" size="sm" variant={speedMs === 1000 ? "default" : "outline"} onClick={() => setSpeedMs(1000)} aria-pressed={speedMs === 1000}>x0.5</Button>
          </div>
          <div className="mt-auto pt-4 text-xs text-zinc-500">
            Replay не пишет данные обратно — это безопасный просмотр уже сохранённого трека.
          </div>
        </aside>
      </div>
    </div>
  );
}
