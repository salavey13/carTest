// /components/map-riders/MapRidersSheetPanels.tsx
// Task 60 (2026-10-02): RidersDrawer MERGED into the main map sheet.
//
// The map-riders surface used to have TWO stacked sliding bottom sheets: the
// main vaul sheet (the wall feed) AND a second vaul drawer (RidersDrawer)
// that slid over it when the nav tapped «Топ»/«Лист». Two handles, two drag
// surfaces, two Esc/focus scopes — overkill (boss report), plus RidersDrawer
// rendered a stray handle pill ABOVE the closed drawer that floated over the
// bottom nav (z-40 > nav z-30), and its handle onClick toggled dead internal
// state in externally-controlled mode.
//
// The fix: ONE sheet. These panels are plain (no vaul!) segment bodies the
// main sheet renders in-place:
//   - SheetListPanel («Лист») — riders in the air, meetups, ride journal;
//   - SheetTopPanel («Топ»)  — ride controls (эфир) + weekly leaderboard;
//   - ReplayFullscreen — ported verbatim from the old RidersDrawer file.
// Everything reads the SAME MapRidersProvider context as before, so no
// state or API contract changed — only the container. Styling moved from
// hardcoded white/* to the crew --mr-* tokens so the merged deck reads as
// one family with the wall.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMapRiders } from "@/hooks/useMapRidersContext";
import { useAppContext } from "@/contexts/AppContext";
import { riderDisplayName, formatRideDuration } from "@/lib/map-riders";
import { toast } from "sonner";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { useMeetupCreator } from "@/hooks/useMeetupCreator";
import { useSessionManager } from "@/app/franchize/hooks/useSessionManager";
import type { FranchizeCrewVM } from "@/app/franchize/actions";
import Link from "next/link";
import { Network as NetworkIcon, ExternalLink } from "lucide-react";
import { CrewDiscoveryGraph } from "@/app/franchize/discovery/CrewDiscoveryGraph";
import type { CrewNetworkModelResult } from "@/app/franchize/discovery/load-network-model";

/** Segments of the merged single sheet — mirror the bottom nav 1:1.
 *  2026-10-04: + "network" — «Сеть» was the only nav tab hard-navigating
 *  AWAY from the map (Link to /franchize/discovery); now it selects a deck
 *  segment with the same crew-discovery graph, so every tab lives in ONE
 *  sliding sheet (boss: «polish network tab in sliding on map-riders»). */
export type MapRidersSheetSegment = "wall" | "list" | "top" | "network";

// Inset surface for nested cards: mixes the border tone into transparency —
// keeps working for every crew palette without alpha-on-var Tailwind tricks.
const PANEL_INSET = { backgroundColor: "color-mix(in srgb, var(--mr-border) 22%, transparent)", borderColor: "var(--mr-border)" } as const;
const PANEL_CARD = { backgroundColor: "var(--mr-card)", borderColor: "var(--mr-border)" } as const;

// ── «Лист» segment: riders + meetups + journal (formerly 3 drawer tabs) ──────

export function SheetListPanel({
  crew,
  onSelectSession,
}: {
  crew: FranchizeCrewVM;
  /** Row tap fetches the session route — the deck collapses so the map shows it. */
  onSelectSession?: (sessionId: string) => void;
}) {
  const { state, crewSlug, fetchSessionDetail } = useMapRiders();
  const { dbUser } = useAppContext();
  // Rider profile v1: name → public profile. A <Link> inside the row <button>
  // would be invalid HTML (interactive-in-interactive), so: span + router push
  // + stopPropagation (tap the name, not the row).
  const router = useRouter();
  const openRiderProfile = (userId: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/franchize/${crewSlug}/rider/${userId}`);
  };

  const [meetupTitle, setMeetupTitle] = useState("Точка сбора");
  const [meetupComment, setMeetupComment] = useState("");
  const [isReplayOpen, setIsReplayOpen] = useState(false);
  const { createMeetup, isSubmitting } = useMeetupCreator(crewSlug);

  const emptyStateCopy = useMemo(
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

  const selectSession = useCallback(
    (sessionId: string) => {
      void fetchSessionDetail(sessionId);
      onSelectSession?.(sessionId);
    },
    [fetchSessionDetail, onSelectSession],
  );

  const activeHistoryWarmupSessions = useMemo(
    () => state.sessions.filter((session) => session.status === "active" && Number(session.total_distance_km || 0) <= 0),
    [state.sessions],
  );

  const sectionTitle = "text-xs font-semibold uppercase tracking-wider text-[var(--mr-muted)]";

  return (
    <div className="space-y-4">
      {/* ── В эфире сейчас ── */}
      <section className="space-y-2">
        <h4 className={sectionTitle}>В эфире сейчас · {state.sessions.length}</h4>
        <div className="space-y-2">
          {state.sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => selectSession(session.id)}
              title="Показать маршрут на карте"
              className="flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition hover:border-[var(--mr-accent)]"
              style={PANEL_CARD}
            >
              <div>
                {/* Rider profile v1: tap the name → public profile (span+router,
                    no <a>-inside-<button>). */}
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
                  className="cursor-pointer text-sm font-medium text-[var(--mr-text)] underline-offset-2 hover:underline"
                >
                  {riderDisplayName(session.users, session.user_id)}
                </span>
                <div className="text-[11px] text-[var(--mr-muted)]">{session.ride_name || "Без названия"}</div>
              </div>
              <div className="text-right text-xs" style={{ color: crew.theme.isAuto ? "#facc15" : crew.theme.palette.accentMain }}>
                <div>{Number(session.total_distance_km || 0).toFixed(1)} км</div>
                <div>{Number(session.latest_speed_kmh || 0).toFixed(0)} км/ч</div>
              </div>
            </button>
          ))}
          {!state.sessions.length && (
            <div className="rounded-xl border border-dashed p-4 text-center text-xs text-[var(--mr-muted)]" style={{ borderColor: "var(--mr-border)" }}>
              Никого в эфире. Включи live share!
            </div>
          )}
        </div>
      </section>

      {/* ── Точки встреч ── */}
      <section className="space-y-2">
        <h4 className={sectionTitle}>Точки встреч · {state.meetups.length}</h4>
        <div className="space-y-3">
          {state.selectedMeetupPoint && (
            <div className="rounded-xl border p-3" style={{ borderColor: "color-mix(in srgb, var(--mr-accent) 35%, transparent)", backgroundColor: "color-mix(in srgb, var(--mr-accent) 10%, transparent)" }}>
              <Label htmlFor="map-riders-meetup-title" className="text-xs text-[var(--mr-text)]">
                Название
              </Label>
              <Input
                id="map-riders-meetup-title"
                value={meetupTitle}
                onChange={(e) => setMeetupTitle(e.target.value)}
                className="mt-1 border-[var(--mr-border)] bg-transparent text-[var(--mr-text)]"
              />
              <Label htmlFor="map-riders-meetup-comment" className="mt-2 text-xs text-[var(--mr-text)]">
                Комментарий
              </Label>
              <Input
                id="map-riders-meetup-comment"
                value={meetupComment}
                onChange={(e) => setMeetupComment(e.target.value)}
                placeholder="Ориентир"
                className="mt-1 border-[var(--mr-border)] bg-transparent text-[var(--mr-text)]"
              />
              <Button
                type="button"
                size="sm"
                className="mt-2 w-full text-[var(--mr-base)]"
                style={{ backgroundColor: "var(--mr-accent)" }}
                disabled={isSubmitting}
                onClick={handleCreateMeetup}
              >
                {isSubmitting ? "Сохраняем meetup..." : "Сохранить meetup"}
              </Button>
            </div>
          )}
          {state.meetups.map((m) => (
            <div key={m.id} className="rounded-xl border px-3 py-2" style={PANEL_CARD}>
              <div className="text-sm font-medium" style={{ color: crew.theme.isAuto ? "#fb923c" : crew.theme.palette.accentMain }}>
                {m.title}
              </div>
              {m.comment && <div className="text-xs text-[var(--mr-muted)]">{m.comment}</div>}
            </div>
          ))}
          {!state.meetups.length && !state.selectedMeetupPoint && (
            <div className="rounded-xl border border-dashed p-4 text-center text-xs text-[var(--mr-muted)]" style={{ borderColor: "var(--mr-border)" }}>
              {emptyStateCopy.meetups}
            </div>
          )}
        </div>
      </section>

      {/* ── Журнал заездов ── */}
      <section className="space-y-2">
        <h4 className={sectionTitle}>Журнал заездов</h4>
        <div className="space-y-2">
          {activeHistoryWarmupSessions.map((session) => {
            const selectedSessionId = state.sessionDetail?.session?.id;
            const capturedRoutePoints = selectedSessionId === session.id ? state.sessionDetail?.points?.length || 0 : 0;
            const gpsWarmupHint = capturedRoutePoints > 0
              ? "Маршрут записывается, но дистанция еще не посчитана."
              : "⚠️ GPS прогревается, подожди секунду...";

            return (
              <div key={`active-warmup-${session.id}`} className="rounded-xl border px-3 py-2.5" style={PANEL_CARD}>
                <button
                  type="button"
                  onClick={() => selectSession(session.id)}
                  className="flex w-full items-center justify-between text-left transition hover:brightness-110"
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
                      className="cursor-pointer text-sm font-medium text-[var(--mr-text)] underline-offset-2 hover:underline"
                    >
                      {riderDisplayName(session.users, session.user_id)}
                    </span>
                    <div className="text-xs text-[var(--mr-muted)]">{session.ride_name || "Без названия"} • {formatRideDuration(0)}</div>
                  </div>
                  <div className="text-right text-sm text-emerald-300">
                    <div>{Number(session.total_distance_km || 0).toFixed(1)} км</div>
                    <div className="text-xs">{Number(session.latest_speed_kmh || 0).toFixed(0)} км/ч</div>
                  </div>
                </button>
                <div className="mt-2 text-[11px] text-[var(--mr-muted)]">{gpsWarmupHint}</div>
              </div>
            );
          })}
          {state.recentCompleted.map((session) => (
            <div key={session.id} className="rounded-xl border px-3 py-2.5" style={PANEL_CARD}>
              <button
                type="button"
                onClick={() => selectSession(session.id)}
                className="flex w-full items-center justify-between text-left transition hover:brightness-110"
              >
                <div>
                  <div className="text-sm font-medium text-[var(--mr-text)]">{session.rider_name}</div>
                  <div className="text-xs text-[var(--mr-muted)]">{session.ride_name || "Без названия"} • {formatRideDuration(session.duration_seconds)}</div>
                </div>
                <div className="text-right text-sm text-emerald-300">
                  <div>{Number(session.total_distance_km || 0).toFixed(1)} км</div>
                  <div className="text-xs">avg {Number(session.avg_speed_kmh || 0).toFixed(1)}</div>
                </div>
              </button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 h-8 w-full border-emerald-300/40 text-emerald-200"
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
            <div className="rounded-xl border border-dashed p-4 text-center text-xs text-[var(--mr-muted)]" style={{ borderColor: "var(--mr-border)" }}>
              {emptyStateCopy.history}
            </div>
          )}
        </div>
      </section>

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

// ── «Топ» segment: ride controls + weekly leaderboard (formerly ride tab) ───

export function SheetTopPanel({ crew, onRideStopped }: { crew: FranchizeCrewVM; onRideStopped?: (endedSessionId: string) => void }) {
  const accentColor = crew.theme.isAuto ? "#facc15" : crew.theme.palette.accentMain || "#facc15";
  return (
    <div className="space-y-3">
      <RideControlsPanel accentColor={accentColor} onRideStopped={onRideStopped} />
      <LeaderboardPanel accentColor={accentColor} />
    </div>
  );
}

// ── «Сеть» segment: the global crew graph inside the deck (2026-10-04) ───────

/**
 * The «Сеть экипажей» discovery graph, embedded in the sheet. The model
 * arrives as plain props from the map-riders server page (same loader as
 * the /franchize/discovery page); the graph itself is the SAME component
 * the full page renders — circles drag, taps refocus the BFS rings, the
 * selected-crew panel links back into each crew's surfaces.
 */
export function SheetNetworkPanel({ network }: { network: CrewNetworkModelResult | null }) {
  if (!network || network.nodes.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border p-4" style={PANEL_CARD}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--mr-text)]">
            <NetworkIcon className="h-4 w-4" aria-hidden />
            Сеть экипажей
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-[var(--mr-muted)]">
            Пока сеть пуста — как только в экипажах появятся люди, здесь нарисуются круги экипажей и связи между ними.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {/* Caption line — same family as the wall's hairline header */}
      <div className="relative flex items-center gap-2 pb-1">
        <h3 className="font-orbitron flex items-center gap-2 text-sm text-[var(--mr-text)]">
          <NetworkIcon className="h-4 w-4" aria-hidden />
          Сеть экипажей
        </h3>
        <span aria-hidden className="absolute inset-x-0 -bottom-px h-px" style={{ background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--mr-accent) 70%, transparent) 45%, transparent)" }} />
        <Link
          href="/franchize/discovery"
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--mr-muted)] transition hover:text-[var(--mr-text)]"
        >
          Вся сеть
          <ExternalLink className="h-3 w-3" aria-hidden />
        </Link>
      </div>
      {/* Stats chips — parity with the discovery page header */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
        <span className="rounded-full border px-2.5 py-1" style={PANEL_INSET}>{network.nodes.length} экипажей</span>
        <span className="rounded-full border px-2.5 py-1" style={PANEL_INSET}>{network.peopleCount} человек</span>
        <span className="rounded-full border px-2.5 py-1" style={PANEL_INSET}>{network.connectionCount} связей</span>
      </div>
      {/* Hint — one line instead of the page's full paragraph (sheet space) */}
      <p className="text-xs leading-relaxed text-[var(--mr-muted)]">
        Круг — экипаж (размер — сколько людей), линия — общие люди. Тап по кругу перестраивает сеть вокруг него, круги можно таскать.
      </p>
      <CrewDiscoveryGraph
        nodes={network.nodes}
        links={network.links}
        bloggers={network.bloggers}
        bloggerLinks={network.bloggerLinks}
      />
    </div>
  );
}

/**
 * Пульт заезда: start/stop дублирует жёлтый FAB, но здесь же живут название
 * заезда, мотоцикл, режим, приватность (видимость / авто-стоп / размытие
 * дома) и пауза трансляции.
 */
function RideControlsPanel({ accentColor, onRideStopped }: { accentColor: string; onRideStopped?: (endedSessionId: string) => void }) {
  const { state, dispatch } = useMapRiders();
  const { canStart, canStop, startSession, stopSession } = useSessionManager({
    authErrorMessage: "Авторизуйся",
    stopSuccessMessage: "Заезд завершён",
    onRideStopped,
  });

  return (
    <section className="space-y-3 rounded-2xl border p-3" style={PANEL_CARD}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--mr-text)]">Эфир и заезд</h3>
        <Badge className="w-fit border-none" style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 14%, transparent)`, color: accentColor }}>
          {state.shareEnabled ? (state.sharePaused ? "пауза" : "в эфире") : "выключен"}
        </Badge>
      </div>

      <div className="space-y-2 rounded-xl border p-3" style={PANEL_INSET}>
        <Label htmlFor="map-riders-drawer-ride-name" className="sr-only">
          Название заезда
        </Label>
        <Input
          id="map-riders-drawer-ride-name"
          value={state.rideName}
          onChange={(event) => dispatch({ type: "ui/set-ride-name", payload: event.target.value })}
          placeholder="Название заезда"
          className="h-9 border-[var(--mr-border)] bg-transparent text-[var(--mr-text)]"
        />
        <Label htmlFor="map-riders-drawer-vehicle-label" className="sr-only">
          Мотоцикл
        </Label>
        <Input
          id="map-riders-drawer-vehicle-label"
          value={state.vehicleLabel}
          onChange={(event) => dispatch({ type: "ui/set-vehicle-label", payload: event.target.value })}
          placeholder="Мотоцикл"
          className="h-9 border-[var(--mr-border)] bg-transparent text-[var(--mr-text)]"
        />
        <Select
          value={state.rideMode}
          onValueChange={(value: "rental" | "personal") => dispatch({ type: "ui/set-ride-mode", payload: value })}
        >
          <SelectTrigger aria-label="Режим поездки" className="h-9 border-[var(--mr-border)] bg-transparent text-[var(--mr-text)]">
            <SelectValue placeholder="Режим поездки" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rental">Аренда</SelectItem>
            <SelectItem value="personal">Личный</SelectItem>
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Select value={state.visibilityMode} onValueChange={(value: "crew" | "public") => dispatch({ type: "privacy/set-visibility", payload: value })}>
            <SelectTrigger aria-label="Кто видит мою позицию" className="h-9 border-[var(--mr-border)] bg-transparent text-[var(--mr-text)]">
              <SelectValue placeholder="Видимость" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="crew">Только экипаж</SelectItem>
              <SelectItem value="public">Все авторизованные</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(state.autoExpireMinutes)} onValueChange={(value: "1" | "5" | "15" | "60") => dispatch({ type: "privacy/set-auto-expire", payload: Number(value) as 1 | 5 | 15 | 60 })}>
            <SelectTrigger aria-label="Автоматически остановить геошеринг" className="h-9 border-[var(--mr-border)] bg-transparent text-[var(--mr-text)]">
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
        <Button type="button" variant="outline" size="sm" className="w-full border-[var(--mr-border)] text-[var(--mr-text)]" onClick={() => dispatch({ type: "privacy/toggle-home-blur" })}>
          {state.homeBlurEnabled ? "Дом размыт: ВКЛ" : "Дом размыт: ВЫКЛ"}
        </Button>
      </div>

      <Button
        type="button"
        disabled={!canStart}
        className="w-full text-[var(--mr-base)]"
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
          className="w-full border-[var(--mr-border)] text-[var(--mr-text)]"
          onClick={() => dispatch({ type: "privacy/toggle-pause" })}
        >
          <VibeContentRenderer content={state.sharePaused ? "::FaPlay::" : "::FaPause::"} className="mr-2" />
          {state.sharePaused ? "Продолжить" : "Пауза"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!canStop}
          className="w-full border-[var(--mr-border)] text-[var(--mr-text)]"
          onClick={stopSession}
        >
          <VibeContentRenderer content="::FaPowerOff::" className="mr-2" />
          Завершить
        </Button>
      </div>
    </section>
  );
}

/** Недельный зал славы (переехал из шита в RidersDrawer, теперь сюда — без
 *  изменений логики; рестайл под --mr-* токены экипажа). */
function LeaderboardPanel({ accentColor }: { accentColor: string }) {
  const { state } = useMapRiders();

  return (
    <section className="rounded-2xl border p-3" style={PANEL_CARD}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--mr-text)]">
        <span style={{ color: accentColor }}>🏆</span> Недельный зал славы
      </h3>
      <div className="mt-3 space-y-2">
        {state.leaderboard.map((row) => (
          <div key={row.userId} className="grid grid-cols-[44px,1fr,72px] items-center gap-2 rounded-xl border px-3 py-2" style={PANEL_INSET}>
            <div className="text-center font-orbitron text-lg" style={{ color: accentColor }}>#{row.rank}</div>
            <div>
              <div className="text-sm font-medium text-[var(--mr-text)]">{row.riderName}</div>
              <div className="text-[11px] text-[var(--mr-muted)]">{row.sessions} заезд(ов) • средняя {row.avgSpeedKmh} км/ч</div>
            </div>
            <div className="text-right text-sm text-[var(--mr-text)]">{row.distanceKm} км</div>
          </div>
        ))}
        {!state.leaderboard.length && (
          <div className="rounded-xl border border-dashed p-3 text-center text-xs text-[var(--mr-muted)]" style={{ borderColor: "var(--mr-border)" }}>
            Лидерборд наполнится после первых треков.
          </div>
        )}
      </div>
    </section>
  );
}

// ── Replay cockpit (ported verbatim from RidersDrawer) ──────────────────────

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
    setIndex(0);
    setPlaying(false);
  }, [total]);

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
              Нет точек маршрута для воспроизведения — GPS еще прогревается или заезд только начался.
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
