"use client";

import { useCallback, useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAppContext } from "@/contexts/AppContext";

const THROTTLE_MS = 3000;
const MIN_DISTANCE_M = 15;

type LiveRiderPoint = {
  lat: number;
  lng: number;
  speedKmh: number;
  heading: number | null;
  accuracyMeters: number | null;
  capturedAt: string;
};

export function useLiveRiders(
  crewSlug: string,
  options?: {
    enabled?: boolean;
    onPosition?: (point: LiveRiderPoint) => void | Promise<void>;
  },
) {
  const { dbUser } = useAppContext();
  const enabled = options?.enabled ?? true;
  const lastSentRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const onPositionRef = useRef(options?.onPosition);

  useEffect(() => {
    onPositionRef.current = options?.onPosition;
  }, [options?.onPosition]);

  const sendPosition = useCallback(async (position: GeolocationPosition) => {
    if (!dbUser?.user_id || !crewSlug || !enabled) return;

    const supabase = getSupabaseBrowserClient();
    const { latitude: lat, longitude: lng, speed, heading, accuracy } = position.coords;
    const now = Date.now();

    const last = lastSentRef.current;
    if (last) {
      const distance = Math.hypot(lat - last.lat, lng - last.lng) * 111_000;
      if (distance < MIN_DISTANCE_M && now - last.ts < THROTTLE_MS) return;
    }

    const speedKmh = Math.max(0, Number(speed || 0) * 3.6);
    const payload = {
      user_id: dbUser.user_id,
      crew_slug: crewSlug,
      lat,
      lng,
      speed_kmh: speedKmh,
      heading: heading || null,
      is_riding: true,
    };

    supabase.channel(`map:${crewSlug}`).send({
      type: "broadcast",
      event: "position",
      payload,
    });

    const { error } = await supabase.from("live_locations").upsert(payload, { onConflict: "user_id" });
    if (error) {
      console.error("[useLiveRiders] upsert failed", error.message);
    }

    if (onPositionRef.current) {
      await onPositionRef.current({
        lat,
        lng,
        speedKmh,
        heading: heading || null,
        accuracyMeters: accuracy || null,
        capturedAt: new Date(position.timestamp).toISOString(),
      });
    }

    lastSentRef.current = { lat, lng, ts: now };
  }, [crewSlug, dbUser?.user_id, enabled]);

  useEffect(() => {
    if (!crewSlug) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(`map:${crewSlug}`);

    channel.on("broadcast", { event: "position" }, ({ payload }) => {
      window.dispatchEvent(new CustomEvent("live-rider-update", { detail: payload }));
    }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [crewSlug]);

  useEffect(() => {
    if (!navigator.geolocation || !dbUser?.user_id || !crewSlug || !enabled) return;

    const watchId = navigator.geolocation.watchPosition(sendPosition, console.error, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [crewSlug, dbUser?.user_id, enabled, sendPosition]);

  return { sendPosition };
}
