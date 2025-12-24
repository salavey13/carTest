"use client";
import { VibeMap } from "@/components/VibeMap";
import { useEffect, useState } from "react";
import { supabaseAnon } from "@/hooks/supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function DrinkRoyaleMap({ lobby, members, dbUser }: any) {
    const [playerPositions, setPlayerPositions] = useState<any[]>([]);
    const [isDanger, setIsDanger] = useState(false);
    
    const startTime = new Date(lobby.metadata?.actual_start_at || lobby.created_at).getTime();
    const elapsedMinutes = (Date.now() - startTime) / 60000;
    const initialRadius = 1500; // 1.5km
    const currentRadius = Math.max(30, initialRadius - (elapsedMinutes * 25)); // Shrinks 25m/min

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

    // Danger Proximity Check
    useEffect(() => {
        const myPing = playerPositions.find(p => p.user_id === dbUser?.user_id);
        if (!myPing) return;

        const enemyNearby = playerPositions.some(p => 
            p.user_id !== dbUser?.user_id && 
            Math.sqrt(Math.pow(myPing.lat - p.lat, 2) + Math.pow(myPing.lng - p.lng, 2)) < 0.0004 // ~40 meters
        );

        if (enemyNearby && !isDanger) {
            setIsDanger(true);
            toast.error("ВРАГ ПОБЛИЗОСТИ! ПРИГОТОВИТЬ БЛАСТЕР", { position: "top-center" });
            if (navigator.vibrate) navigator.vibrate(500);
        } else if (!enemyNearby) {
            setIsDanger(false);
        }
    }, [playerPositions, dbUser?.user_id, isDanger]);

    const points = playerPositions.map(pos => ({
        id: pos.user_id,
        name: members.find((m: any) => m.user_id === pos.user_id)?.user?.username || "Unit",
        type: 'point',
        coords: [[pos.lat, pos.lng]],
        icon: pos.user_id === dbUser?.user_id ? '::FaUserAstronaut::' : '::FaSkull::',
        color: pos.user_id === dbUser?.user_id ? 'bg-brand-cyan' : 'bg-red-600'
    }));

    return (
        <div className={cn(
            "relative h-[65vh] border-2 transition-colors duration-500",
            isDanger ? "border-red-600 animate-pulse ring-4 ring-red-900/50" : "border-zinc-800"
        )}>
            <VibeMap 
                points={points}
                bounds={{ top: 56.4, bottom: 56.1, left: 43.7, right: 44.1 }}
                imageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/city_grid_dark.jpg"
            />
            
            <div className="absolute top-4 left-4 bg-black/90 p-2 border border-brand-cyan font-mono text-[9px]">
                <div className="text-zinc-500 uppercase">Current_Zone</div>
                <div className="text-brand-cyan font-black">{Math.round(currentRadius)}M</div>
            </div>
        </div>
    );
}