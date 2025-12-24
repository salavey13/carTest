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
    
    // Логика сужения зоны (25 метров в минуту)
    const startTime = new Date(lobby.metadata?.actual_start_at || lobby.created_at).getTime();
    const elapsedMinutes = (Date.now() - startTime) / 60000;
    const initialRadius = 1000; 
    const currentRadius = Math.max(30, initialRadius - (elapsedMinutes * 25));

    const refreshPositions = useCallback(async () => {
        const res = await getLobbyGeoData(lobby.id);
        if (res.success) setPlayerPositions(res.data || []);
    }, [lobby.id]);

    useEffect(() => {
        refreshPositions();
        // Используем анонимный клиент только как триггер для обновления через Admin Action
        const channel = supabaseAnon
            .channel(`geo_sync_${lobby.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lobby_geo_pings', filter: `lobby_id=eq.${lobby.id}` }, refreshPositions)
            .subscribe();
        return () => { supabaseAnon.removeChannel(channel); };
    }, [lobby.id, refreshPositions]);

    // Радар близости врага
    useEffect(() => {
        const myPos = playerPositions.find(p => p.user_id === dbUser?.user_id);
        if (!myPos) return;

        const enemyNearby = playerPositions.some(p => 
            p.user_id !== dbUser?.user_id && 
            Math.sqrt(Math.pow(myPos.lat - p.lat, 2) + Math.pow(myPos.lng - p.lng, 2)) < 0.0003 // ~30 метров
        );

        if (enemyNearby && !isDanger) {
            setIsDanger(true);
            toast.error("ВНИМАНИЕ: КТО-ТО РЯДОМ! ДОСТАНЬ БЛАСТЕР", { position: "top-center" });
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        } else if (!enemyNearby) setIsDanger(false);
    }, [playerPositions, dbUser?.user_id, isDanger]);

    const points = playerPositions.map(pos => {
        const member = members.find((m: any) => m.user_id === pos.user_id);
        const isMe = pos.user_id === dbUser?.user_id;
        return {
            id: pos.user_id,
            name: member?.user?.username || "Боец",
            type: 'point',
            coords: [[pos.lat, pos.lng]] as [number, number][],
            icon: isMe ? '::FaUserAstronaut::' : '::FaSkull::',
            color: isMe ? 'bg-brand-cyan' : 'bg-red-600'
        };
    });

    return (
        <div className={cn(
            "relative h-[60vh] border-2 transition-all duration-500 overflow-hidden",
            isDanger ? "border-red-600 ring-4 ring-red-900/50 animate-pulse" : "border-zinc-800"
        )}>
            <VibeMap 
                points={points}
                bounds={{ top: 56.4, bottom: 56.1, left: 43.7, right: 44.1 }}
                imageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/city_grid_dark.jpg"
            />
            <div className="absolute top-4 left-4 z-20 bg-black/90 p-2 border border-brand-cyan font-mono text-[9px] uppercase">
                <div className="text-zinc-500">Радиус_Зоны</div>
                <div className="text-brand-cyan font-black text-xs">{Math.round(currentRadius)}M</div>
            </div>
        </div>
    );
}