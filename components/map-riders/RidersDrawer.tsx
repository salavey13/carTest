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
import { useMapRiders } from "@/hooks/useMapRidersContext";
import { useAppContext } from "@/contexts/AppContext";
import { riderDisplayName, formatRideDuration } from "@/lib/map-riders";
import { toast } from "sonner";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { useMeetupCreator } from "@/hooks/useMeetupCreator";

export function RidersDrawer() {
  const { state, dispatch, crewSlug, fetchSnapshot, fetchSessionDetail } = useMapRiders();
  const { dbUser } = useAppContext();
  const contentRef = useRef<HTMLDivElement | null>(null);

  const [meetupTitle, setMeetupTitle] = useState("Точка сбора");
  const [meetupComment, setMeetupComment] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isReplayOpen, setIsReplayOpen] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const { createMeetup, isSubmitting } = useMeetupCreator(crewSlug);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefersReducedMotion(media.matches);
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  const drawerSnapPoints = useMemo(() => (prefersReducedMotion ? [1] : [0.64, 380 / 820, 640 / 820]), [prefersReducedMotion]);

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
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
      <Drawer.Root
        open={isOpen}
        onOpenChange={(nextOpen) => {
          setIsOpen(nextOpen);
          dispatch({ type: "ui/toggle-drawer" });
        }}
        snapPoints={drawerSnapPoints}
      >
        <Drawer.Handle
          className="mx-auto mb-1 h-1.5 w-12 rounded-full bg-white/30"
          onClick={() => setIsOpen((prev) => !prev)}
        />
        <Drawer.Content
          ref={contentRef}
          role="dialog"
          aria-label="Панель райдеров и meetup"
          className="mx-auto flex h-full w-full max-w-lg flex-col rounded-t-2xl bg-black/90 backdrop-blur-xl"
        >
          <Tabs defaultValue="riders" className="flex h-full flex-col">
            <div className="border-b border-white/10 px-4 pt-3">
              <TabsList className="grid w-full grid-cols-3 bg-transparent">
                <TabsTrigger value="riders" className="text-xs data-[state=active]:bg-white/10">
                  Riders ({state.sessions.length})
                </TabsTrigger>
                <TabsTrigger value="meetups" className="text-xs data-[state=active]:bg-white/10">
                  Meetups ({state.meetups.length})
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs data-[state=active]:bg-white/10">
                  History
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
                      <div className="text-sm font-medium text-white">{riderDisplayName(session.users, session.user_id)}</div>
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
                    <Label className="text-xs text-amber-200">Название</Label>
                    <Input value={meetupTitle} onChange={(e) => setMeetupTitle(e.target.value)} className="mt-1 bg-transparent text-white" />
                    <Label className="mt-2 text-xs text-amber-200">Комментарий</Label>
                    <Input value={meetupComment} onChange={(e) => setMeetupComment(e.target.value)} placeholder="Ориентир" className="mt-1 bg-transparent text-white" />
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
                    Ткни по карте, чтобы создать meetup
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── History tab ── */}
            <TabsContent value="history" className="flex-1 overflow-auto p-4">
              <div className="space-y-2">
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
                {!state.recentCompleted.length && (
                  <div className="rounded-xl border border-dashed border-white/25 p-4 text-center text-xs text-muted-foreground">
                    Заверши первый заезд, чтобы увидеть историю
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </Drawer.Content>
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

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black/95 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-emerald-200/80">Route replay</div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>Закрыть</Button>
      </div>

      <div className="mt-4 flex-1 rounded-xl border border-white/10 bg-white/5 p-3">
        {!total ? (
          <div className="text-sm text-zinc-400">Нет точек маршрута для воспроизведения.</div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300">
              <div>Точка: {index + 1} / {total}</div>
              <div className="text-right">Скорость: {Number(current?.speedKmh || 0).toFixed(1)} км/ч</div>
              <div className="col-span-2 break-all text-zinc-400">
                {current?.capturedAt ? new Date(current.capturedAt).toLocaleString("ru-RU") : "—"}
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded bg-white/10">
              <div className="h-full rounded bg-emerald-400 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(total - 1, 0)}
              value={index}
              onChange={(event) => setIndex(Number(event.target.value))}
              className="w-full"
            />
            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="outline" onClick={() => setIndex((prev) => Math.max(prev - 1, 0))}>← Шаг</Button>
              <Button type="button" onClick={() => setPlaying((prev) => !prev)} disabled={total < 2}>
                {playing ? "Пауза" : "Play"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setIndex((prev) => Math.min(prev + 1, Math.max(total - 1, 0)))}>Шаг →</Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button type="button" size="sm" variant={speedMs === 250 ? "default" : "outline"} onClick={() => setSpeedMs(250)}>x2</Button>
              <Button type="button" size="sm" variant={speedMs === 500 ? "default" : "outline"} onClick={() => setSpeedMs(500)}>x1</Button>
              <Button type="button" size="sm" variant={speedMs === 1000 ? "default" : "outline"} onClick={() => setSpeedMs(1000)}>x0.5</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
