"use client";
import { useEffect } from 'react';
import { updatePlayerLocation } from '../actions/game';

export function useGeoTracking(lobbyId: string, userId: string, active: boolean) {
    useEffect(() => {
        if (!active || !lobbyId || !userId) return;

        const track = () => {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    await updatePlayerLocation(lobbyId, userId, pos.coords.latitude, pos.coords.longitude);
                },
                (err) => console.error("Location denied", err),
                { enableHighAccuracy: true }
            );
        };

        track(); // Initial ping
        const interval = setInterval(track, 45000); // 45s cycle for battery efficiency
        return () => clearInterval(interval);
    }, [lobbyId, userId, active]);
}