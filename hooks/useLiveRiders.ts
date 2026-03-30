"use client";
import { useEffect, useRef } from "react";
import { supabaseAnon } from "@/lib/supabase-browser";
import { useAppContext } from "@/contexts/AppContext";

const THROTTLE_MS = 3000;        // 3 seconds
const MIN_DISTANCE_M = 15;

export function useLiveRiders(crewSlug: string) {
  const { dbUser } = useAppContext();
  const lastSentRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const channelRef = useRef<any>(null);

  const sendPosition = async (position: GeolocationPosition) => {
    if (!dbUser?.user_id || !crewSlug) return;

    const { latitude: lat, longitude: lng, speed, heading, accuracy } = position.coords;
    const now = Date.now();

    const last = lastSentRef.current;
    if (last) {
      const distance = Math.hypot(lat - last.lat, lng - last.lng) * 111_000;
      if (distance < MIN_DISTANCE_M && now - last.ts < THROTTLE_MS) return;
    }

    const payload = {
      user_id: dbUser.user_id,
      crew_slug: crewSlug,
      lat,
      lng,
      speed_kmh: (speed || 0) * 3.6,
      heading: heading || null,
      is_riding: true,
    };

    // 1. Fast broadcast (instant for everyone)
    supabaseAnon.channel(`map:${crewSlug}`).send({
      type: "broadcast",
      event: "position",
      payload,
    });

    // 2. Upsert to live_locations (ephemeral + spatial RLS)
    await supabaseAnon.from("live_locations").upsert(payload, { onConflict: "user_id" });

    lastSentRef.current = { lat, lng, ts: now };
  };

  // Subscribe to live positions
  useEffect(() => {
    if (!crewSlug) return;
    const channel = supabaseAnon.channel(`map:${crewSlug}`);

    channel.on("broadcast", { event: "position" }, ({ payload }) => {
      // TODO: your VibeMap will listen to this via a global store or prop later
      window.dispatchEvent(new CustomEvent("live-rider-update", { detail: payload }));
    }).subscribe();

    channelRef.current = channel;

    return () => supabaseAnon.removeChannel(channel);
  }, [crewSlug]);

  // GPS watcher
  useEffect(() => {
    if (!navigator.geolocation || !dbUser?.user_id) return;
    const watchId = navigator.geolocation.watchPosition(sendPosition, console.error, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000,
    });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [dbUser?.user_id, crewSlug]);

  return { sendPosition };
}
