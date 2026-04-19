"use client";

interface MapRidersDebugPanelProps {
  activeRiders: number;
  sessionCount: number;
  pendingBatchPoints: number;
  isUsingTelegram: boolean;
  lastBroadcastAt: string | null;
}

export function MapRidersDebugPanel({
  activeRiders,
  sessionCount,
  pendingBatchPoints,
  isUsingTelegram,
  lastBroadcastAt,
}: MapRidersDebugPanelProps) {
  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="pointer-events-none absolute left-3 top-20 z-40 rounded-lg border border-cyan-300/40 bg-black/70 p-2 text-[11px] text-cyan-100 backdrop-blur">
      <div className="font-semibold text-cyan-200">MapRiders Debug</div>
      <div>Active riders: {activeRiders}</div>
      <div>Sessions: {sessionCount}</div>
      <div>Queued points: {pendingBatchPoints}</div>
      <div>Source: {isUsingTelegram ? "Telegram" : "Browser"}</div>
      <div>Last broadcast: {lastBroadcastAt ? new Date(lastBroadcastAt).toLocaleTimeString() : "—"}</div>
    </div>
  );
}
