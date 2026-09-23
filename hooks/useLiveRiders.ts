"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getMapRidersWriteHeaders } from "@/lib/map-riders-client-auth";

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
    Math.sin(dLat / 2) ** 2 +
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
// Watchdog (robustness pass 2026-09-23): no accepted fix for 45 s → one
// silent W3C kick. Freshness counts from the LATER of the last fix and the
// session start, so a slow cold start (and the window while start() is still
// awaiting Telegram's one-shot) never counts as staleness; kicks are also
// cooldown-throttled. W3C never pops a native dialog — this cannot resurrect
// the popup storm. Skipped while paused (the stream is deliberately stopped)
// and while the chip says "denied" (permission can only return via settings;
// kicking a denied watch is waste).
const WATCHDOG_TICK_MS = 15000;
const WATCHDOG_STALE_MS = 45000;
const WATCHDOG_KICK_COOLDOWN_MS = 30000;
type GpsSource = "telegram" | "browser";

/** Why the continuous W3C watch has no fix — surfaced in the ride strip so a
 *  silent GPS stream is never mistaken for a working one. */
export type LiveRidersGeoError = "denied" | "unavailable" | "timeout" | null;

/** Shared mapping for watch + one-shot error callbacks (same chip vocabulary). */
function geoErrorKind(error: GeolocationPositionError): NonNullable<LiveRidersGeoError> {
  if (error.code === error.PERMISSION_DENIED) return "denied";
  if (error.code === error.POSITION_UNAVAILABLE) return "unavailable";
  return "timeout";
}

// MR geo-fix: `WebApp.requestLocation` shows a NATIVE Telegram permission
// popup on EVERY invocation. Polling it on an interval (the old design:
// every GPS_INTERVAL_MS) produced the endless "allow location" dialog storm
// reported by riders. It is now a ONE-SHOT per geosharing start; the
// continuous stream always comes from the W3C `watchPosition` below.

export function useLiveRiders(options: UseLiveRidersOptions) {
  const { crewSlug, sessionId, userId, enabled, paused = false, privacy, onPosition } = options;
  const watchIdRef = useRef<number | null>(null);
  const lastAcceptedRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const batchQueueRef = useRef<GPSPoint[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseBrowserClient>["channel"]> | null>(null);
  const browserFixSeenRef = useRef(false);
  const lastTelegramTsRef = useRef<number>(0);
  const lastSendTsRef = useRef<number>(0);
  const sourceLockRef = useRef<GpsSource | null>(null);
  const sourceLockAtRef = useRef<number>(0);
  const acceptDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPointRef = useRef<GPSPoint | null>(null);
  const lastBroadcastAtRef = useRef<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isUsingTelegram, setIsUsingTelegram] = useState(false);
  // True once the W3C watch produced at least one accepted point this session.
  // While false (dead/incomplete WebView geolocation), the cockpit offers a
  // manual one-shot Telegram refresh instead of any automatic popup loop.
  const [hasBrowserFix, setHasBrowserFix] = useState(false);
  // MR geo polish: the watch error callback used to swallow everything into a
  // console.warn — a rider with denied permission saw «Ты в эфире» and a map
  // that never moved, with zero explanation. Now the cockpit renders a
  // plain-language chip (denied → settings hint, timeout/unavailable → retry).
  const [geoError, setGeoError] = useState<LiveRidersGeoError>(null);
  const [lastBroadcastAt, setLastBroadcastAt] = useState<string | null>(null);
  const [queuedPoints, setQueuedPoints] = useState(0);

  // Store latest privacy/paused/onPosition in refs so the GPS pipeline stays
  // IDENTITY-STABLE: every dep we hang off acceptPointNow eventually reaches
  // the main watch effect (acceptPointNow → acceptPoint →
  // handleGeolocationPosition → effect deps), and an effect restart re-runs
  // the ONE-SHOT Telegram popup + clears the error chip. An inline onPosition
  // arrow (new identity each render) thus resurrected the popup storm exactly
  // in the denied scenario, and the pause toggle restarted it too. Refs make
  // the whole chain stable per enabled/userId session.
  const privacyRef = useRef(privacy);
  privacyRef.current = privacy;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onPositionRef = useRef(onPosition);
  onPositionRef.current = onPosition;
  // Mirror of the current chip kind for timer callbacks (never re-renders).
  const geoErrorKindRef = useRef<LiveRidersGeoError>(null);
  useEffect(() => {
    geoErrorKindRef.current = geoError;
  }, [geoError]);
  // Consecutive watch-error counter — transient kinds (timeout/unavailable)
  // must repeat before the chip shows, so a weak-signal error↔fix cycle
  // doesn't flicker it (denied is definitive and shows immediately).
  const watchErrorStreakRef = useRef(0);
  // Robustness pass (2026-09-23):
  //  · startTokenRef — guard against a stale async start() installing a watch
  //    after a rapid enabled-toggle cleanup (double-watch race);
  //  · degradedRef — after 4 consecutive watch errors with no fix at all the
  //    watch restarts with enableHighAccuracy=false (some WebViews never get a
  //    first GPS fix in high-accuracy mode but succeed immediately in
  //    network-only mode — one-time, per geosharing session);
  //  · watchdogTimerRef — 45 s with no accepted fix → one silent W3C kick
  //    (never a Telegram popup) to re-seed a dead watch.
  const startTokenRef = useRef(0);
  const degradedRef = useRef(false);
  const watchdogTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Watchdog anti-spam: freshness is measured from the LATER of the last fix
  // and the session start (a slow cold start is not staleness), and kicks are
  // cooldown-throttled so at most one silent kick per WATCHDOG_KICK_COOLDOWN_MS.
  const startedAtRef = useRef(0);
  const lastWatchdogKickAtRef = useRef(0);

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
    if (points.length === 0 || !sessionId || !userId || pausedRef.current) return;

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
  }, [sessionId, userId, crewSlug]); // privacy/paused read from refs

  const acceptPointNow = useCallback(
    (point: GPSPoint, source: GpsSource) => {
      // MR geo polish: a landed Telegram fix proves positioning works, so the
      // soft error chip (timeout/unavailable) must not keep claiming the
      // opposite — even when the point is throttled or the stream is paused.
      // "denied" stays — it describes the browser permission, which is exactly
      // why the manual one-shot is the only working source then.
      if (source === "telegram") {
        setGeoError((prev) => (prev === "denied" ? prev : null));
      }
      if (pausedRef.current) return;
      if (privacyRef.current?.expiresAt && new Date(privacyRef.current.expiresAt).getTime() <= Date.now()) return;
      const now = Date.now();
      const sourceLock = sourceLockRef.current;
      if (sourceLock && sourceLock !== source && now - sourceLockAtRef.current < SOURCE_SWITCH_DEBOUNCE_MS) {
        return;
      }
      sourceLockRef.current = source;
      sourceLockAtRef.current = now;
      // MR geo-fix: a Telegram fix must NOT clear the browser watch anymore —
      // the watch is the CONTINUOUS source, Telegram is the one-shot booster.
      if (source === "browser" && !browserFixSeenRef.current) {
        browserFixSeenRef.current = true;
        setHasBrowserFix(true);
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
      onPositionRef.current?.(point);
      hapticPulse();
    },
    // Refs above keep this STABLE across renders — any identity churn here
    // restarts the GPS effect below (popup + chip reset). See refs comment.
    [broadcastPosition, hapticPulse],
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
      // A real fix invalidates any stale error chip (React bails out when the
      // value is unchanged, so the success stream causes no extra renders)
      // and resets the consecutive-error streak.
      watchErrorStreakRef.current = 0;
      setGeoError(null);
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
          handleLocation({ ...resolved, latitude: resolved.latitude, longitude: resolved.longitude });
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

  /**
   * Manual one-shot Telegram fix (cockpit «Обновить гео» button). The ONLY
   * sanctioned way to re-invoke `WebApp.requestLocation` after the initial
   * popup — one deliberate tap, one popup, never automatic. Outside Telegram
   * (plain browser) it falls back to a silent W3C one-shot — no-op buttons
   * are worse than the right fix from the same tap.
   */
  const refreshTelegramFix = useCallback(() => {
    if (!enabled) return;
    void requestTelegramLocation().then((ok) => {
      if (ok) return;
      if (!navigator.geolocation) {
        setGeoError("unavailable");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        handleGeolocationPosition,
        // Deliberate tap → immediate feedback, no streak threshold: a silent
        // WebView (the exact scenario this button exists for) must still say
        // WHY nothing moved.
        (error) => setGeoError(geoErrorKind(error)),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
  }, [enabled, requestTelegramLocation, handleGeolocationPosition]);

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

    // Every toggle gets a fresh token: a start() awaiting Telegram's one-shot
    // popup must notice it was superseded and bail before touching the map.
    const token = ++startTokenRef.current;
    let cancelled = false;

    const start = async () => {
      browserFixSeenRef.current = false;
      degradedRef.current = false;
      startedAtRef.current = Date.now();
      lastWatchdogKickAtRef.current = 0;
      setHasBrowserFix(false);
      setGeoError(null);
      watchErrorStreakRef.current = 0;

      // ONE-SHOT native Telegram popup for a fast first fix (and to trigger
      // Telegram's own location grant). Must never be polled — see MR geo-fix.
      const telegramSuccess = await requestTelegramLocation();
      if (cancelled || token !== startTokenRef.current) return;
      setIsActive(true);
      setIsUsingTelegram(telegramSuccess);

      // Continuous source — ALWAYS the W3C watch (works inside Telegram
      // WebViews on Android & iOS after the native grant; outside Telegram
      // it is the only source anyway). If the WebView's geolocation is dead,
      // the rider gets the manual «Обновить гео» one-shot instead of popups.
      if (!navigator.geolocation) {
        setGeoError("unavailable");
        return;
      }

      // Accuracy can degrade one step: high first (visible screen), network
      // fallback after a dead high-accuracy streak (see degradedRef above).
      const installWatch = (highAccuracy: boolean) => {
        watchIdRef.current = navigator.geolocation.watchPosition(
          handleGeolocationPosition,
          (error) => {
            // MR geo polish: surface the failure instead of a console-only warn.
            // Transient kinds (timeout/unavailable) must repeat twice before the
            // chip shows — a weak-signal error↔fix cycle would otherwise flicker
            // it. "denied" is definitive (permission returns only via settings)
            // and shows immediately. watchPosition re-reports the same error —
            // the functional update keeps identical kinds from re-rendering.
            const kind = geoErrorKind(error);
            watchErrorStreakRef.current += 1;
            if (kind === "denied" || watchErrorStreakRef.current >= 2) {
              setGeoError((prev) => (prev === kind ? prev : kind));
            }
            console.warn("[useLiveRiders] Geolocation error:", error.message);
            // Robustness: a brand-new session that keeps erroring in
            // high-accuracy mode gets exactly ONE second chance in the cheaper
            // network-only mode before the rider is left with a dead stream.
            if (
              !browserFixSeenRef.current &&
              !degradedRef.current &&
              kind !== "denied" &&
              watchErrorStreakRef.current >= 4 &&
              navigator.geolocation
            ) {
              degradedRef.current = true;
              watchErrorStreakRef.current = 0;
              if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
              console.warn("[useLiveRiders] Falling back to low-accuracy watch");
              installWatch(false);
            }
          },
          {
            enableHighAccuracy: highAccuracy,
            timeout: highAccuracy ? 10000 : 30000,
            maximumAge: highAccuracy ? 0 : 60000,
          },
        );
      };

      installWatch(document.visibilityState === "visible");
    };

    start();

    return () => {
      cancelled = true;
      startTokenRef.current += 1; // invalidate any in-flight start()
      sourceLockRef.current = null;
      sourceLockAtRef.current = 0;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (acceptDebounceTimerRef.current) {
        clearTimeout(acceptDebounceTimerRef.current);
        acceptDebounceTimerRef.current = null;
      }
      watchErrorStreakRef.current = 0;
      setGeoError(null);
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

  // Robustness watchdog: a watch that stops producing fixes (WebView killed
  // the GPS thread, accuracy dead-loop) previously stayed silent until the
  // rider noticed themselves. Every 15 s check the freshness of the last
  // accepted fix; when it is older than WATCHDOG_STALE_MS (or never arrived)
  // fire ONE silent W3C one-shot — W3C never pops a native dialog, so this
  // cannot resurrect the popup storm. Skipped while paused (the stream is
  // deliberately stopped) and while the chip says "denied" (permission can
  // only return via settings; kicking a denied watch is waste).
  useEffect(() => {
    if (!enabled) return;
    watchdogTimerRef.current = setInterval(() => {
      if (pausedRef.current || document.visibilityState !== "visible") return;
      if (!navigator.geolocation) return;
      // "denied" can only clear via system settings — kick-waste; other kinds
      // (timeout/unavailable) are exactly what the kick is for.
      if (geoErrorKindRef.current === "denied") return;
      // Cold start is not staleness: measure from the later of last fix / start.
      const last = lastAcceptedRef.current;
      const since = Math.max(last?.time ?? 0, startedAtRef.current);
      if (Date.now() - since <= WATCHDOG_STALE_MS) return;
      // Cooldown: a kick can take up to 15 s to resolve — never stack two.
      if (Date.now() - lastWatchdogKickAtRef.current < WATCHDOG_KICK_COOLDOWN_MS) return;
      lastWatchdogKickAtRef.current = Date.now();
      navigator.geolocation.getCurrentPosition(
        handleGeolocationPosition,
        () => {
          /* silent: the watch's own error pipeline already reports */
        },
        { enableHighAccuracy: !degradedRef.current, timeout: 15000, maximumAge: 30000 },
      );
    }, WATCHDOG_TICK_MS);
    return () => {
      if (watchdogTimerRef.current) {
        clearInterval(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
    };
  }, [enabled, handleGeolocationPosition]);

  // MR geo-fix: visibility refresh is BROWSER-ONLY now. The old branch re-ran
  // `WebApp.requestLocation` on every app switch — another native popup each
  // time the rider returned to the mini app. W3C getCurrentPosition never pops.
  useEffect(() => {
    const handleVisibility = () => {
      if (!enabled || document.visibilityState !== "visible") return;
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
  }, [enabled, handleGeolocationPosition]);

  return { isActive, isUsingTelegram, hasBrowserFix, geoError, refreshTelegramFix, lastBroadcastAt, queuedPoints };
}