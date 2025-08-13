export type StreamStatus = "scheduled" | "live" | "ended" | "cancelled";

export interface Stream {
  id: string;
  creatorId: string;
  title: string;
  description?: string;
  startAt: string; // ISO
  durationMinutes?: number;
  status: StreamStatus;
  streamKey?: string; // for RTMP
  ingestUrl?: string;  // optional
  createdAt: string;
  telemetry?: {
    maxViewers?: number;
    averageLatencyMs?: number;
  }
}