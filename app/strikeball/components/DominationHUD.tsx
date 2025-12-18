"use client";

import React, { useEffect, useState } from "react";
import { supabaseAnon } from "@/hooks/supabase";
import { getLobbyCheckpoints } from "../actions/domination";
import { cn } from "@/lib/utils";
import { FaFlag } from "react-icons/fa6";

export const DominationHUD = ({ lobbyId }: { lobbyId: string }) => {
  const [points, setPoints] = useState<any[]>([]);

  const load = async () => {
      const res = await getLobbyCheckpoints(lobbyId);
      if (res.success) setPoints(res.data);
  };

  useEffect(() => {
      load();
      const channel = supabaseAnon
          .channel(`domination_${lobbyId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'lobby_checkpoints', filter: `lobby_id=eq.${lobbyId}` }, () => load())
          .subscribe();
      return () => { supabaseAnon.removeChannel(channel); };
  }, [lobbyId]);

  if (points.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-2 mb-4">
        {points.map(p => {
            const isBlue = p.owner_team === 'blue';
            const isRed = p.owner_team === 'red';
            const isNeutral = p.owner_team === 'neutral';

            return (
                <div key={p.id} className={cn(
                    "border-2 rounded p-2 text-center transition-all duration-500 relative overflow-hidden",
                    isBlue ? "bg-blue-900/50 border-blue-500 text-blue-100" :
                    isRed ? "bg-red-900/50 border-red-500 text-red-100" :
                    "bg-zinc-900 border-zinc-700 text-zinc-500"
                )}>
                    {/* Pulsing Capture Effect */}
                    {(isBlue || isRed) && (
                        <div className={cn("absolute inset-0 opacity-20 animate-pulse", isBlue ? "bg-blue-400" : "bg-red-400")} />
                    )}
                    
                    <div className="relative z-10 flex flex-col items-center">
                        <FaFlag className={cn("mb-1", isNeutral && "opacity-50")} />
                        <span className="font-black font-orbitron text-xs uppercase">{p.name}</span>
                    </div>
                </div>
            )
        })}
    </div>
  );
};