// /hooks/useLiveRiders.ts
// GPS watcher with throttling (3s + 10m) + broadcast + batch queue.
// Replaces the inline useLiveRiders usage in MapRidersClient.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

interface GPSPoint {
  lat: number;
  lng: number;
  speedKmh: number;
  heading: number | null;
  accuracyMeters: number | null;
  capturedAt: string;
}

interface UseLiveRidersOptions {
  crewSlug: string;
  sessionId: string | null;
  userId: string | null;
  enabled: boolean;
  /** Called with each accepted GPS point (for local state + broadcast) */
  onPosition?: (point: GPSPoint) => void;
}

// Haversine for client-side distance threshold
function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

const GPS_INTERVAL_MS = 3000; // 3s minimum between accepted updates
const GPS_DISTANCE_M = 10;    // 10m minimum distance threshold
const BATCH_FLUSH_MS = 5000;  // Flush batch every 5s
const BATCH_MAX_SIZE = 10;

export function useLiveRiders(options: UseLiveRidersOptions) {
  const { crewSlug, sessionId, userId, enabled, onPosition } = options;
  const watchIdRef = useRef<number | null>(null);
  const lastAcceptedRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const batchQueueRef = useRef<GPSPoint[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isActive, setIsActive] = useState(false);

  // ── Broadcast position to Supabase Realtime ──
  const broadcastPosition = useCallback(
    (point: GPSPoint) => {
      if (!userId) return;
      const supabase = getSupabaseBrowserClient();
      const channel = supabase.channel(`map-riders:${crewSlug}`);
      channel.send({
        type: "broadcast",
        event: "rider:move",
        payload: {
          user_id: userId,
          lat: point.lat,
          lng: point.lng,
          speed_kmh: point.speedKmh,
          heading: point.heading,
          updated_at: point.capturedAt,
        },
      });
    },
    [crewSlug, userId],
  );

  // ── Flush batch to server ──
  const flushBatch = useCallback(async () => {
    const points = batchQueueRef.current.splice(0, BATCH_MAX_SIZE);
    if (points.length === 0 || !sessionId || !userId) return;

    try {
      const batchResponse = await fetch("/api/map-riders/batch-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userId, crewSlug, points }),
      });
      if (batchResponse.ok) {
        return;
      }

      const lastPoint = points[points.length - 1];
      await fetch("/api/map-riders/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userId,
          crewSlug,
          lat: lastPoint.lat,
          lon: lastPoint.lng,
          speedKmh: lastPoint.speedKmh,
          headingDeg: lastPoint.heading,
          accuracyMeters: lastPoint.accuracyMeters,
          capturedAt: lastPoint.capturedAt,
        }),
      });
    } catch {
      // Re-queue failed points at front
      batchQueueRef.current.unshift(...points);
    }
  }, [sessionId, userId, crewSlug]);

  // ── GPS handler ──
  const handlePosition = useCallback(
    (position: GeolocationPosition) => {
      const now = Date.now();
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const speedKmh = (position.coords.speed || 0) * 3.6;
      const heading = position.coords.heading ?? null;
      const accuracyMeters = position.coords.accuracy ?? null;
      const capturedAt = new Date().toISOString();

      // Throttle: skip if too close in time AND distance
      const last = lastAcceptedRef.current;
      if (last) {
        const elapsed = now - last.time;
        const dist = haversineMeters({ lat, lng }, { lat: last.lat, lng: last.lng });
        if (elapsed < GPS_INTERVAL_MS && dist < GPS_DISTANCE_M) return;
      }

      lastAcceptedRef.current = { lat, lng, time: now };
      const point: GPSPoint = { lat, lng, speedKmh, heading, accuracyMeters, capturedAt };

      // Broadcast for instant map update
      broadcastPosition(point);

      // Add to batch queue
      batchQueueRef.current.push(point);

      // Notify parent hook
      onPosition?.(point);
    },
    [broadcastPosition, onPosition],
  );

  const handleError = useCallback((err: GeolocationPositionError) => {
    console.warn("[MapRiders] GPS error:", err.message);
  }, []);

  // ── Start/stop GPS watcher ──
  useEffect(() => {
    if (!enabled || !navigator.geolocation) {
      setIsActive(false);
      return;
    }

    // Adjust accuracy based on visibility
    const highAccuracy = document.visibilityState === "visible";

    watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
      enableHighAccuracy: highAccuracy,
      timeout: highAccuracy ? 10000 : 30000,
      maximumAge: highAccuracy ? 0 : 60000,
    });
    setIsActive(true);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsActive(false);
    };
  }, [enabled, handlePosition, handleError]);

  // ── Visibility change → adjust GPS accuracy ──
  useEffect(() => {
    const onVisibility = () => {
      if (!enabled) return;
      // Restart watcher with new accuracy settings
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        const highAccuracy = !document.hidden;
        watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
          enableHighAccuracy: highAccuracy,
          timeout: highAccuracy ? 10000 : 30000,
          maximumAge: highAccuracy ? 0 : 60000,
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [enabled, handlePosition, handleError]);

  // ── Batch flush timer ──
  useEffect(() => {
    if (!enabled) return;
    flushTimerRef.current = setInterval(flushBatch, BATCH_FLUSH_MS);
    return () => {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    };
  }, [enabled, flushBatch]);

  return { isActive };
}
