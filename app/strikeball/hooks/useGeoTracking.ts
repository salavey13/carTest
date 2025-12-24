"use client";
import { useEffect, useRef } from 'react';
import { updatePlayerLocation } from '../actions/game';

export function useGeoTracking(lobbyId: string, userId: string, active: boolean) {
    const lastPing = useRef<number>(0);

    useEffect(() => {
        if (!active || !lobbyId || !userId) return;

        const track = () => {
            // Rate limit pings to every 30 seconds to save battery
            if (Date.now() - lastPing.current < 30000) return;

            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    lastPing.current = Date.now();
                    await updatePlayerLocation(lobbyId, userId, pos.coords.latitude, pos.coords.longitude);
                },
                (err) => console.warn("GPS_SIGNAL_LOST", err),
                { enableHighAccuracy: true }
            );
        };

        const interval = setInterval(track, 15000); // Check every 15s, ping every 30s
        return () => clearInterval(interval);
    }, [lobbyId, userId, active]);
}