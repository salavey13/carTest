// /components/map-riders/StatusOverlay.tsx
// Floating compact stats bar shown when user is actively sharing.
// Semi-transparent with backdrop blur, sits at top of map.

"use client";

import { useEffect, useState } from "react";
import { useMapRidersState } from "@/hooks/useMapRidersContext";
import { SPEED_BANDS } from "@/components/map-riders/speedGradient";

export function StatusOverlay() {
  const { state } = useMapRidersState();
  const [elapsed, setElapsed] = useState("0:00");

  // Live elapsed timer
  useEffect(() => {
    if (!state.shareEnabled || !state.sessionId) return;

    const session = state.sessions.find((s) => s.id === state.sessionId);
    if (!session) return;

    const startedAt = new Date(session.started_at).getTime();

    const tick = () => {
      const now = Date.now();
      const seconds = Math.floor((now - startedAt) / 1000);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      setElapsed(`${mins}:${secs.toString().padStart(2, "0")}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [state.shareEnabled, state.sessionId, state.sessions]);

  if (!state.shareEnabled) return null;

  const session = state.sessions.find((s) => s.id === state.sessionId);
  const distanceKm = Number(session?.total_distance_km || 0);
  const speedKmh = Number(session?.latest_speed_kmh || 0);
  const hasDistance = distanceKm > 0;
  const hasSpeed = speedKmh > 0;
  const distance = hasDistance ? `${distanceKm.toFixed(1)} км` : "0 км";
  const speed = hasSpeed ? `${Math.round(speedKmh)} км/ч` : "Ожидаем твою скорость...";
  const showSpeedLegend = Boolean(state.sessionDetail?.points?.length);

  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-[60] -translate-x-1/2 space-y-1.5 md:top-5">
      <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-black/60 px-3 py-1.5 text-white backdrop-blur-xl">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <span className="text-xs font-medium text-red-300">LIVE</span>
        </div>
        <div className="h-4 w-px bg-white/20" />
        <div className="text-center">
          <div className="text-[9px] uppercase tracking-wider text-zinc-400">Время</div>
          <div className="font-mono text-xs font-semibold">{elapsed}</div>
        </div>
        <div className="h-4 w-px bg-white/20" />
        <div className="text-center">
          <div className="text-[9px] uppercase tracking-wider text-zinc-400">Дист.</div>
          <div className="font-mono text-xs font-semibold">{distance}</div>
          {!hasDistance ? <div className="text-[10px] text-zinc-400">Жми, чтобы увидеть статистику 🏎</div> : null}
        </div>
        <div className="h-4 w-px bg-white/20" />
        <div className="text-center">
          <div className="text-[9px] uppercase tracking-wider text-zinc-400">Скор.</div>
          <div className={`font-mono text-xs font-semibold ${hasSpeed ? "" : "animate-pulse"}`}>{speed}</div>
        </div>
      </div>
      {showSpeedLegend ? (
        <div className="rounded-xl border border-white/20 bg-black/60 px-3 py-2 text-[10px] text-white backdrop-blur-xl">
          <div className="mb-1 font-medium text-zinc-300">Route speed legend</div>
          <div className="flex items-center gap-2">
            {SPEED_BANDS.map((band) => (
              <div key={band.label} className="flex items-center gap-1">
                <span className={`h-2 w-4 rounded ${band.colorClass}`} /> <span>{band.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
