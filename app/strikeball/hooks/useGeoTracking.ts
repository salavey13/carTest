"use client";
import { useEffect, useRef } from "react";
import { updatePlayerLocation } from "../actions/game";
import { updateUserSettings } from "@/app/actions";

export function useGeoTracking(lobbyId: string, userId: string, active: boolean, dbUser: any) {
  const lastPing = useRef<number>(0);
  const hasFetchedPermission = useRef(false);

  useEffect(() => {
    if (!active || !lobbyId || !userId) return;

    // 1. Read persisted permission from metadata
    const persistedPerm = dbUser?.metadata?.geoPermission as 'granted' | 'denied' | 'prompt' | undefined;
    let currentPermission: 'granted' | 'denied' | 'prompt' = persistedPerm || 'prompt';

    // Helper: safe save to DB
    const savePermission = async (status: 'granted' | 'denied') => {
      if (currentPermission === status) return;
      currentPermission = status;
      await updateUserSettings(userId, { geoPermission: status });
    };

    // 2. Helper: try to get position *only if granted*
    const tryPing = async () => {
      if (Date.now() - lastPing.current < 30_000) return;

      // If we don’t know, try querying (modern browsers)
      if (currentPermission === 'prompt' && navigator.permissions) {
        try {
          const result = await navigator.permissions.query({ name: "geolocation" as any });
          if (result.state === 'granted') {
            currentPermission = 'granted';
            await savePermission('granted');
          } else if (result.state === 'denied') {
            currentPermission = 'denied';
            await savePermission('denied');
            return;
          }
          // 'prompt' remains prompt — defer to manual action
        } catch {}
      }

      // Only proceed if granted
      if (currentPermission !== 'granted') return;

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          lastPing.current = Date.now();
          await savePermission('granted'); // ensure saved
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

    // On first mount: if we already know permission → ping immediately
    if (!hasFetchedPermission.current) {
      hasFetchedPermission.current = true;
      if (persistedPerm === 'granted') {
        tryPing(); // fast path
      }
    }

    // Then periodic (won’t prompt unless unknown)
    const interval = setInterval(tryPing, 15_000);
    return () => clearInterval(interval);
  }, [lobbyId, userId, active, dbUser?.metadata?.geoPermission]); // ✅ re-run if metadata changes
}