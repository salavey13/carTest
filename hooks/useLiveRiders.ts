"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getMapRidersWriteHeaders } from "@/lib/map-riders-client-auth";

type TelegramWebApp = {
  requestLocation?: (callback?: (location: { latitude: number; longitude: number; altitude?: number | null; course?: number | null; horizontal_accuracy?: number | null }) => void) => Promise<unknown> | void;
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
  paused?: boolean;
  privacy?: {
    visibilityMode: "crew" | "public";
    homeBlurEnabled: boolean;
    autoExpireMinutes: 1 | 5 | 15 | 60;
    expiresAt: string | null;
  };
  onPosition?: (point: GPSPoint) => void;
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const aa =
    Math.sin(dLat / 2) **  reactor2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

const GPS_INTERVAL_MS = 3000;
const GPS_DISTANCE_M = 10;
const BATCH_FLUSH_MS = 5000;
const BATCH_MAX_SIZE = 10;
const TELEGRAM_MIN_INTERVAL_MS = 2500;
const ACCEPT_DEBOUNCE_MS = 800;
const SEND_THROTTLE_MS = 3000;
const SOURCE_SWITCH_DEBOUNCE_MS = 500;
type GpsSource = "telegram" | "browser";

export function useLiveRiders(options: UseLiveRidersOptions) {
  const { crewSlug, sessionId, userId, enabled, paused = false, privacy, onPosition } = options;
  const watchIdRef = useRef<number | null>(null);
  const lastAcceptedRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const batchQueueRef = useRef<GPSPoint[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const telegramTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseBrowserClient>["channel"]> | null>(null);
  const lastTelegramTsRef = useRef<number>(0);
  const lastSendTsRef = useRef<number>(0);
  const sourceLockRef = useRef<GpsSource | null>(null);
  const sourceLockAtRef = useRef<number>(0);
  const acceptDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPointRef = useRef<GPSPoint | null>(null);
  const lastBroadcastAtRef = useRef<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isUsingTelegram, setIsUsingTelegram] = useState(false);
  const [lastBroadcastAt, setLastBroadcastAt] = useState<string | null>(null);
  const [queuedPoints, setQueuedPoints] = useState(0);

  // Store latest privacy in a ref to stabilize flushBatch dependency
  const privacyRef = useRef(privacy);
  privacyRef.current = privacy;

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
      lastBroadcastAtRef.current = point.capturedAt;
      setLastBroadcastAt(point.capturedAt);
    },
    [userId],
  );

  const flushBatch = useCallback(async () => {
    const currentPrivacy = privacyRef.current;
    const points = batchQueueRef.current.splice(0, BATCH_MAX_SIZE);
    setQueuedPoints(batchQueueRef.current.length);
    if (points.length === 0 || !sessionId || !userId || paused) return;

    try {
      const headers = await getMapRidersWriteHeaders();
      const batchResponse = await fetch("/api/map-riders/batch-points", {
        method: "POST",
        headers,
        body: JSON.stringify({ sessionId, userId, crewSlug, points, privacy: currentPrivacy }),
      });
      if (batchResponse.ok) return;

      const lastPoint = points[points.length - 1];
      const fallbackHeaders = await getMapRidersWriteHeaders();
      await fetch("/api/map-riders/location", {
        method: "POST",
        headers: fallbackHeaders,
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
          privacy: currentPrivacy,
        }),
      });
    } catch {
      batchQueueRef.current.unshift(...points);
      setQueuedPoints(batchQueueRef.current.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, userId, crewSlug, paused]); // privacy removed; read from ref

  const acceptPointNow = useCallback(
    (point: GPSPoint, source: GpsSource) => {
      if (paused) return;
      if (privacy?.expiresAt && new Date(privacy.expiresAt).getTime() <= Date.now()) return;
      const now = Date.now();
      const sourceLock = sourceLockRef.current;
      if (sourceLock && sourceLock !== source && now - sourceLockAtRef.current < SOURCE_SWITCH_DEBOUNCE_MS) {
        return;
      }
      sourceLockRef.current = source;
      sourceLockAtRef.current = now;
      if (source === "telegram" && watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (now - lastSendTsRef.current < SEND_THROTTLE_MS) return;
      const last = lastAcceptedRef.current;
      if (last) {
        const elapsed = now - last.time;
        const dist = haversineMeters({ lat: point.lat, lng: point.lng }, { lat: last.lat, lng: last.lng });
        if (elapsed < GPS_INTERVAL_MS && dist < GPS_DISTANCE_M) return;
      }

      lastAcceptedRef.current = { lat: point.lat, lng: point.lng, time: now };
      lastSendTsRef.current = now;
      broadcastPosition(point);
      batchQueueRef.current.push(point);
      setQueuedPoints(batchQueueRef.current.length);
      onPosition?.(point);
      hapticPulse();
    },
    [broadcastPosition, onPosition, hapticPulse, paused, privacy?.expiresAt],
  );

  const acceptPoint = useCallback(
    (point: GPSPoint, source: GpsSource) => {
      if (!acceptDebounceTimerRef.current) {
        acceptPointNow(point, source);
      }
      pendingPointRef.current = point;
      if (acceptDebounceTimerRef.current) {
        clearTimeout(acceptDebounceTimerRef.current);
      }
      acceptDebounceTimerRef.current = setTimeout(() => {
        acceptDebounceTimerRef.current = null;
        const pending = pendingPointRef.current;
        pendingPointRef.current = null;
        if (pending) {
          acceptPointNow(pending, source);
        }
      }, ACCEPT_DEBOUNCE_MS);
    },
    [acceptPointNow],
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
      acceptPoint(point, "browser");
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
      const now = Date.now();
      if (now - lastTelegramTsRef.current < TELEGRAM_MIN_INTERVAL_MS) return;
      lastTelegramTsRef.current = now;
      gotPoint = true;
      acceptPoint({
        lat: Number(location.latitude),
        lng: Number(location.longitude),
        speedKmh: Number(location.speed || 0) * 3.6,
        heading: location.course != null ? Number(location.course) : null,
        accuracyMeters: location.horizontal_accuracy != null ? Number(location.horizontal_accuracy) : null,
        capturedAt: new Date().toISOString(),
      }, "telegram");
    };

    const maybePromise = webApp.requestLocation(handleLocation);
    if (maybePromise && typeof (maybePromise as Promise<unknown>).then === "function") {
      try {
        const resolved = (await maybePromise) as {
          latitude?: number;
          longitude?: number;
          speed?: number | null;
          course?: number | null;
          horizontal_accuracy?: number | null;
        };
        if (!gotPoint && resolved?.latitude != null && resolved?.longitude != null) {
          handleLocation(resolved);
        }
      } catch {
        return false;
      }
    } else {
      await new Promise<void>((resolve) => {
        let settled = false;
        let pollTimer: ReturnType<typeof setTimeout> | null = null;
        const timeout = setTimeout(() => {
          settled = true;
          if (pollTimer) {
            clearTimeout(pollTimer);
            pollTimer = null;
          }
          resolve();
        }, 2200);

        const check = () => {
          if (settled) return;
          if (gotPoint) {
            settled = true;
            clearTimeout(timeout);
            resolve();
            return;
          }
          pollTimer = setTimeout(check, 100);
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
      sourceLockRef.current = null;
      sourceLockAtRef.current = 0;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (telegramTimerRef.current) {
        clearInterval(telegramTimerRef.current);
        telegramTimerRef.current = null;
      }
      if (acceptDebounceTimerRef.current) {
        clearTimeout(acceptDebounceTimerRef.current);
        acceptDebounceTimerRef.current = null;
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

  return { isActive, isUsingTelegram, lastBroadcastAt, queuedPoints };
}