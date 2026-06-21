"use client";

import type { RealtimeConnectionStatus } from "@/app/franchize/hooks/useSupabaseRealtime";

interface ConnectionStatusProps {
  status: RealtimeConnectionStatus;
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const statusConfig = {
    connected: {
      color: "bg-emerald-500",
      pulse: true,
      label: "Live",
    },
    connecting: {
      color: "bg-amber-500",
      pulse: false,
      label: "Reconnecting...",
    },
    disconnected: {
      color: "bg-rose-500",
      pulse: false,
      label: "Connection lost — refresh page",
    },
  };

  const config = statusConfig[status];

  return (
    <div
      className="flex items-center gap-2"
      title={config.label}
    >
      <div
        className={`h-2 w-2 rounded-full ${config.color} ${
          config.pulse ? "animate-pulse" : ""
        }`}
      />
      <span className="text-[10px] text-muted-foreground">
        {config.label}
      </span>
    </div>
  );
}
