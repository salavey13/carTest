"use client";

import React, { useEffect, useState, useCallback } from "react";
import { VibeMap } from "@/components/VibeMap";
import { supabaseAnon } from "@/hooks/supabase"; // Only for Realtime ping
import { getLobbyGeoData } from "../../../actions/lobby";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function DrinkRoyaleMap({ lobby, members, dbUser }: any) {
    const [playerPositions, setPlayerPositions] = useState<any[]>([]);
    const [isDanger, setIsDanger] = useState(false);

    // 1. Privileged Data Fetching
    const refreshPositions = useCallback(async () => {
        const res = await getLobbyGeoData(lobby.id);
        if (res.success) {
            setPlayerPositions(res.data || []);
        }
    }, [lobby.id]);

    // 2. Realtime Listener (Privilege Abstraction)
    useEffect(() => {
        refreshPositions();
        
        // We subscribe to the table, but we don't trust the payload.
        // We just use the event as a trigger to fetch clean data via the Server Action.
        const channel = supabaseAnon
            .channel(`geo_trigger_${lobby.id}`)
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'lobby_geo_pings', filter: `lobby_id=eq.${lobby.id}` }, 
                () => refreshPositions() 
            )
            .subscribe();

        return () => { supabaseAnon.removeChannel(channel); };
    }, [lobby.id, refreshPositions]);

    // 3. Danger Radar Logic
    useEffect(() => {
        const myPing = playerPositions.find(p => p.user_id === dbUser?.user_id);
        if (!myPing) return;

        const enemyNearby = playerPositions.some(p => 
            p.user_id !== dbUser?.user_id && 
            Math.sqrt(Math.pow(myPing.lat - p.lat, 2) + Math.pow(myPing.lng - p.lng, 2)) < 0.0004 // ~40m
        );

        if (enemyNearby && !isDanger) {
            setIsDanger(true);
            toast.error("ВРАГ В ЗОНЕ ПОРАЖЕНИЯ!", { position: "top-center", className: "bg-red-950 border-red-500 text-white font-black" });
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        } else if (!enemyNearby) {
            setIsDanger(false);
        }
    }, [playerPositions, dbUser?.user_id, isDanger]);

    const points = playerPositions.map(pos => {
        const memberInfo = members.find((m: any) => m.user_id === pos.user_id);
        return {
            id: pos.user_id,
            name: memberInfo?.user?.username || "Unknown Unit",
            type: 'point',
            coords: [[pos.lat, pos.lng]] as [number, number][],
            icon: pos.user_id === dbUser?.user_id ? '::FaUserAstronaut::' : '::FaSkull::',
            color: pos.user_id === dbUser?.user_id ? 'bg-brand-cyan' : 'bg-red-600'
        };
    });

    return (
        <div className={cn(
            "relative h-[65vh] border-2 transition-all duration-500 overflow-hidden rounded-lg",
            isDanger ? "border-red-600 ring-4 ring-red-900/50 animate-pulse" : "border-zinc-800"
        )}>
            <VibeMap 
                points={points}
                bounds={{ top: 56.45, bottom: 56.05, left: 43.6, right: 44.2 }}
                imageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/city_grid_dark.jpg"
            />
            
            <div className="absolute top-4 left-4 z-20 bg-black/90 p-3 border border-red-900 shadow-2xl">
                <div className="text-[8px] text-zinc-600 font-black uppercase tracking-widest">Zone_Status</div>
                <div className="text-red-500 font-mono text-xs font-black animate-pulse">SHRINKING_ACTIVE</div>
            </div>
        </div>
    );
}