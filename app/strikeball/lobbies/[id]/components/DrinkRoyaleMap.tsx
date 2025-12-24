"use client";
import { VibeMap } from "@/components/VibeMap";
import { useEffect, useState } from "react";
import { supabaseAnon } from "@/hooks/supabase";

export function DrinkRoyaleMap({ lobby, members, dbUser }: any) {
    const [playerPositions, setPlayerPositions] = useState<any[]>([]);
    
    // Calculate current shrinking radius based on time elapsed
    const startTime = new Date(lobby.metadata?.actual_start_at || lobby.created_at).getTime();
    const elapsedMinutes = (Date.now() - startTime) / 60000;
    const initialRadius = 1000; // 1km
    const currentRadius = Math.max(50, initialRadius - (elapsedMinutes * 20)); // Shrinks 20m per minute

    useEffect(() => {
        const channel = supabaseAnon
            .channel(`geo_${lobby.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lobby_geo_pings', filter: `lobby_id=eq.${lobby.id}` }, 
            (payload) => {
                setPlayerPositions(prev => {
                    const filtered = prev.filter(p => p.user_id !== payload.new.user_id);
                    return [...filtered, payload.new];
                });
            })
            .subscribe();
        return () => { supabaseAnon.removeChannel(channel); };
    }, [lobby.id]);

    const points = playerPositions.map(pos => ({
        id: pos.user_id,
        name: members.find((m: any) => m.user_id === pos.user_id)?.user?.username || "Unit",
        type: 'point',
        coords: [[pos.lat, pos.lng]],
        icon: pos.user_id === dbUser?.user_id ? '::FaUser::' : '::FaSkull::',
        color: pos.user_id === dbUser?.user_id ? 'bg-cyan-500' : 'bg-red-500'
    }));

    return (
        <div className="relative h-[65vh]">
            <VibeMap 
                points={points}
                bounds={/* Center on lobby coordinates */}
                imageUrl={/* Urban map overlay */}
            />
            
            {/* The Shrinking Zone Alert */}
            <div className="absolute top-4 right-4 bg-red-950/90 border border-red-500 p-2 font-mono text-[10px] animate-pulse">
                ZONE_RADIUS: {Math.round(currentRadius)}m
                <br />
                STATUS: SHRINKING_ACTIVE
            </div>
        </div>
    );
}