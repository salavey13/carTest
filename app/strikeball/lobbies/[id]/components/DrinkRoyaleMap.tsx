"use client";

import React, { useEffect, useState, useCallback } from "react";
import { VibeMap } from "@/components/VibeMap";
import { supabaseAnon } from "@/hooks/supabase";
import { getLobbyGeoData } from "../../../actions/lobby";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function DrinkRoyaleMap({ lobby, members, dbUser }: any) {
    const [playerPositions, setPlayerPositions] = useState<any[]>([]);
    const [isDanger, setIsDanger] = useState(false);
    
    // Зона сужается
    const startTime = new Date(lobby.metadata?.actual_start_at || lobby.created_at).getTime();
    const elapsedMinutes = (Date.now() - startTime) / 60000;
    const currentRadius = Math.max(30, 1000 - (elapsedMinutes * 20));

    const refreshPositions = useCallback(async () => {
        const res = await getLobbyGeoData(lobby.id);
        if (res.success) setPlayerPositions(res.data || []);
    }, [lobby.id]);

    useEffect(() => {
        refreshPositions();
        const channel = supabaseAnon
            .channel(`geo_trigger_${lobby.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lobby_geo_pings', filter: `lobby_id=eq.${lobby.id}` }, refreshPositions)
            .subscribe();
        return () => { supabaseAnon.removeChannel(channel); };
    }, [lobby.id, refreshPositions]);

    // Радар близости (30 метров)
    useEffect(() => {
        const myPing = playerPositions.find(p => p.user_id === dbUser?.user_id);
        if (!myPing) return;

        const enemyNearby = playerPositions.some(p => 
            p.user_id !== dbUser?.user_id && 
            Math.sqrt(Math.pow(myPing.lat - p.lat, 2) + Math.pow(myPing.lng - p.lng, 2)) < 0.0003
        );

        if (enemyNearby && !isDanger) {
            setIsDanger(true);
            toast.error("ВРАГ ПОБЛИЗОСТИ! ПРИГОТОВИТЬ БЛАСТЕР", { position: "top-center" });
            if (navigator.vibrate) navigator.vibrate(500);
        } else if (!enemyNearby) setIsDanger(false);
    }, [playerPositions, dbUser?.user_id, isDanger]);

    const points = playerPositions.map(pos => {
        const m = members.find((mem: any) => mem.user_id === pos.user_id);
        return {
            id: pos.user_id,
            name: m?.user?.username || "Юнит",
            coords: [[pos.lat, pos.lng]] as [number, number][],
            type: 'point',
            icon: pos.user_id === dbUser?.user_id ? '::FaUserAstronaut::' : '::FaSkull::',
            color: pos.user_id === dbUser?.user_id ? 'bg-brand-cyan' : 'bg-red-600'
        };
    });

    return (
        <div className={cn(
            "relative h-[60vh] border-2 transition-all duration-500 overflow-hidden",
            isDanger ? "border-red-600 ring-4 ring-red-900/30 animate-pulse" : "border-zinc-800"
        )}>
            <VibeMap points={points} bounds={{ top: 56.42, bottom: 56.08, left: 43.66, right: 44.12 }} imageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_20250721_203250-d268820b-f598-42ce-b8af-60689a7cc79e.jpg" />
            <div className="absolute top-4 left-4 z-20 bg-black/90 p-2 border border-brand-cyan font-mono text-[9px] uppercase">
                <div className="text-zinc-500">Радиус_Зоны</div>
                <div className="text-brand-cyan font-black">{Math.round(currentRadius)}M</div>
            </div>
        </div>
    );
}