"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type TelegramWebApp = {
  requestLocation?: (callback?: (location: { latitude: number; longitude: number; altitude?: number | null; course?: number | null; horizontal_accuracy?: number | null; speed?: number | null }) => void) => Promise<unknown> | void;
  HapticFeedback?: {
    impactOccurred?: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
  };
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

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
  onPosition?: (point: GPSPoint) => void;
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

const GPS_INTERVAL_MS = 3000;
const GPS_DISTANCE_M = 10;
const BATCH_FLUSH_MS = 5000;
const BATCH_MAX_SIZE = 10;

export function useLiveRiders(options: UseLiveRidersOptions) {
  const { crewSlug, sessionId, userId, enabled, onPosition } = options;
  const watchIdRef = useRef<number | null>(null);
  const lastAcceptedRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const batchQueueRef = useRef<GPSPoint[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const telegramTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseBrowserClient>["channel"]> | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isUsingTelegram, setIsUsingTelegram] = useState(false);

  const hapticPulse = useCallback(() => {
    if (typeof window === "undefined") return;
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
  }, []);

  const broadcastPosition = useCallback(
    (point: GPSPoint) => {
      if (!userId || !channelRef.current) return;
      channelRef.current.send({
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
    [userId],
  );

  const flushBatch = useCallback(async () => {
    const points = batchQueueRef.current.splice(0, BATCH_MAX_SIZE);
    if (points.length === 0 || !sessionId || !userId) return;

    try {
      const batchResponse = await fetch("/api/map-riders/batch-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userId, crewSlug, points }),
      });
      if (batchResponse.ok) return;

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
      batchQueueRef.current.unshift(...points);
    }
  }, [sessionId, userId, crewSlug]);

  const acceptPoint = useCallback(
    (point: GPSPoint) => {
      const now = Date.now();
      const last = lastAcceptedRef.current;
      if (last) {
        const elapsed = now - last.time;
        const dist = haversineMeters({ lat: point.lat, lng: point.lng }, { lat: last.lat, lng: last.lng });
        if (elapsed < GPS_INTERVAL_MS && dist < GPS_DISTANCE_M) return;
      }

      lastAcceptedRef.current = { lat: point.lat, lng: point.lng, time: now };
      broadcastPosition(point);
      batchQueueRef.current.push(point);
      onPosition?.(point);
      hapticPulse();
    },
    [broadcastPosition, onPosition, hapticPulse],
  );

  const handleGeolocationPosition = useCallback(
    (position: GeolocationPosition) => {
      const point: GPSPoint = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        speedKmh: (position.coords.speed || 0) * 3.6,
        heading: position.coords.heading ?? null,
        accuracyMeters: position.coords.accuracy ?? null,
        capturedAt: new Date().toISOString(),
      };
      acceptPoint(point);
    },
    [acceptPoint],
  );

  const requestTelegramLocation = useCallback(async () => {
    if (typeof window === "undefined") return false;
    const webApp = window.Telegram?.WebApp;
    if (!webApp?.requestLocation) return false;

    let gotPoint = false;
    const handleLocation = (location: {
      latitude: number;
      longitude: number;
      speed?: number | null;
      course?: number | null;
      horizontal_accuracy?: number | null;
    }) => {
      gotPoint = true;
      acceptPoint({
        lat: Number(location.latitude),
        lng: Number(location.longitude),
        speedKmh: Number(location.speed || 0) * 3.6,
        heading: location.course != null ? Number(location.course) : null,
        accuracyMeters: location.horizontal_accuracy != null ? Number(location.horizontal_accuracy) : null,
        capturedAt: new Date().toISOString(),
      });
    };

    const maybePromise = webApp.requestLocation(handleLocation);
    if (maybePromise && typeof (maybePromise as Promise<unknown>).then === "function") {
      try {
        const resolved = (await maybePromise) as any;
        if (!gotPoint && resolved?.latitude && resolved?.longitude) {
          handleLocation(resolved);
        }
      } catch {
        return false;
      }
    } else {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 2200);
        const check = () => {
          if (gotPoint) {
            clearTimeout(timeout);
            resolve();
            return;
          }
          setTimeout(check, 100);
        };
        check();
      });
    }

    setIsUsingTelegram(gotPoint);
    return gotPoint;
  }, [acceptPoint]);

  useEffect(() => {
    if (!enabled || !userId) {
      setIsActive(false);
      setIsUsingTelegram(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(`map-riders:${crewSlug}`);
    channel.subscribe();
    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [crewSlug, enabled, userId]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const start = async () => {
      const telegramSuccess = await requestTelegramLocation();
      if (cancelled) return;

      if (telegramSuccess) {
        setIsActive(true);
        setIsUsingTelegram(true);
        telegramTimerRef.current = setInterval(() => {
          requestTelegramLocation();
        }, GPS_INTERVAL_MS);
        return;
      }

      if (!navigator.geolocation) {
        setIsActive(false);
        return;
      }

      const highAccuracy = document.visibilityState === "visible";
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleGeolocationPosition,
        (error) => {
          console.warn("[useLiveRiders] Geolocation error:", error.message);
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: highAccuracy ? 10000 : 30000,
          maximumAge: highAccuracy ? 0 : 60000,
        },
      );
      setIsActive(true);
      setIsUsingTelegram(false);
    };

    start();

    return () => {
      cancelled = true;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (telegramTimerRef.current) {
        clearInterval(telegramTimerRef.current);
        telegramTimerRef.current = null;
      }
      setIsActive(false);
    };
  }, [enabled, handleGeolocationPosition, requestTelegramLocation]);

  useEffect(() => {
    if (!enabled) return;
    flushTimerRef.current = setInterval(flushBatch, BATCH_FLUSH_MS);
    return () => {
      if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
  }, [enabled, flushBatch]);

  useEffect(() => {
    const handleVisibility = () => {
      if (!enabled || document.visibilityState !== "visible") return;
      if (isUsingTelegram) {
        requestTelegramLocation();
        return;
      }
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          handleGeolocationPosition,
          () => {},
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        );
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [enabled, handleGeolocationPosition, isUsingTelegram, requestTelegramLocation]);

  return { isActive, isUsingTelegram };
}
