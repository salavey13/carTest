"use client";
import { useEffect, useRef } from "react";
import { updatePlayerLocation } from "../actions/game";
import { updateUserSettings } from "@/app/actions";

export function useGeoTracking(lobbyId: string, userId: string, active: boolean, dbUser: any) {
  const lastPing = useRef<number>(0);
  const hasInitialized = useRef(false);
  const currentPermission = useRef<'granted' | 'denied' | 'prompt'>(
    (dbUser?.metadata?.geoPermission as 'granted' | 'denied' | 'prompt') || 'prompt'
  );

  const savePermission = async (status: 'granted' | 'denied') => {
    if (currentPermission.current === status) return;
    currentPermission.current = status;
    await updateUserSettings(userId, { geoPermission: status });
  };

  const tryPing = async () => {
    if (Date.now() - lastPing.current < 30_000) return;

    // Query Permissions API first (if available & status unknown)
    if (currentPermission.current === 'prompt' && navigator.permissions) {
      try {
        const result = await navigator.permissions.query({ name: "geolocation" as any });
        if (result.state === 'granted') {
          await savePermission('granted');
        } else if (result.state === 'denied') {
          await savePermission('denied');
          return;
        }
      } catch {}
    }

    // Only attempt GPS if explicitly granted
    if (currentPermission.current !== 'granted') return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        lastPing.current = Date.now();
        await savePermission('granted'); // ensure persistence
        await updatePlayerLocation(lobbyId, userId, pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        console.warn("📍 GPS error:", err);
        if (err.code === err.PERMISSION_DENIED) {
          savePermission('denied');
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  };

  useEffect(() => {
    if (!active || !lobbyId || !userId) return;

    // Sync state from metadata on every render (for real-time sync)
    currentPermission.current = (dbUser?.metadata?.geoPermission as 'granted' | 'denied' | 'prompt') || 'prompt';

    if (!hasInitialized.current) {
      hasInitialized.current = true;
      if (currentPermission.current === 'granted') {
        tryPing(); // immediate ping on first mount
      }
    }

    const interval = setInterval(tryPing, 15_000);
    return () => clearInterval(interval);
  }, [lobbyId, userId, active, dbUser?.metadata?.geoPermission]);
}