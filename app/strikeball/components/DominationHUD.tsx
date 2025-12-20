"use client";

import React, { useEffect, useState } from "react";
import { supabaseAnon } from "@/hooks/supabase";
import { getLobbyCheckpoints } from "../actions/domination";
import { cn } from "@/lib/utils";

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
    <div className="grid grid-cols-3 gap-px bg-zinc-800 border border-zinc-800 mb-4">
        {points.map(p => {
            const isBlue = p.owner_team === 'blue';
            const isRed = p.owner_team === 'red';

            return (
                <div key={p.id} className={cn(
                    "h-20 flex flex-col items-center justify-center transition-colors duration-200",
                    isBlue ? "bg-white text-black" : 
                    isRed ? "bg-zinc-700 text-white" : 
                    "bg-[#000000] text-zinc-600"
                )}>
                    <div className="text-[9px] font-mono font-bold uppercase tracking-tighter mb-1">
                        SEC_{p.name}
                    </div>
                    <div className="text-2xl font-black font-mono">
                        {isBlue ? "B" : isRed ? "R" : "•"}
                    </div>
                    {/* Status Pip */}
                    {(isBlue || isRed) && (
                        <div className={cn("w-1 h-1 mt-1 animate-pulse", isBlue ? "bg-black" : "bg-white")} />
                    )}
                </div>
            )
        })}
    </div>
  );
};