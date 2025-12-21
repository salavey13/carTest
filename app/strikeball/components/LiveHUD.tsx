"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface LiveHUDProps {
  startTime: string | null; // ISO string (scheduled or actual)
  score: { red: number; blue: number };
  status: 'open' | 'active' | 'finished';
}

export const LiveHUD = ({ startTime, score, status }: LiveHUDProps) => {
  const [displayTime, setDisplayTime] = useState("00:00:00");
  const [isTMinus, setIsTMinus] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    if (!startTime) {
        setDisplayTime("00:00:00");
        return;
    }

    const targetDate = new Date(startTime).getTime();
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      let diff: number;
      
      if (status === 'active') {
          // Режим секундомера (прошло времени с начала)
          diff = now - targetDate;
          setIsTMinus(false);
          setIsUrgent(false);
      } else {
          // Режим обратного отсчета (T-Minus)
          diff = targetDate - now;
          setIsTMinus(true);
          // Warning: Last 30 minutes (1800000 ms)
          setIsUrgent(diff > 0 && diff <= 1800000);
      }

      if (isNaN(diff)) {
          setDisplayTime("00:00:00");
          return;
      }

      const absDiff = Math.abs(diff);
      const h = Math.floor(absDiff / 3600000).toString().padStart(2, '0');
      const m = Math.floor((absDiff % 3600000) / 60000).toString().padStart(2, '0');
      const s = Math.floor((absDiff % 60000) / 1000).toString().padStart(2, '0');

      setDisplayTime(`${h}:${m}:${s}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, status]);

  return (
    <div className="mb-6 space-y-px">
      {/* MISSION CLOCK */}
      <div className={cn(
          "bg-[#000000] border p-4 text-center relative overflow-hidden transition-colors duration-500",
          isUrgent ? "border-red-600 shadow-[inset_0_0_20px_rgba(220,38,38,0.2)]" : "border-zinc-800"
      )}>
         <div className="text-[10px] text-zinc-500 font-mono tracking-[0.4em] uppercase mb-2">
             {isTMinus ? "T-MINUS_COUNTDOWN" : "TELEMETRY_COMBAT_CLOCK"}
         </div>
         
         <div className={cn(
             "text-6xl font-black font-mono tracking-tighter",
             isTMinus ? "text-brand-yellow" : "text-white",
             isUrgent && "text-red-500 animate-pulse"
         )}>
             {isTMinus && "-"}{displayTime}
         </div>

         {/* URGENT WARNING MESSAGE */}
         {isUrgent && (
             <div className="mt-4 py-1 bg-red-600 text-black text-[9px] font-black uppercase tracking-widest animate-bounce">
                 last half an hour hurry the fuck up you should already be there
             </div>
         )}

         <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(transparent_50%,#fff_50%)] bg-[size:100%_2px]" />
      </div>

      {/* SCORE BAR */}
      <div className="flex h-16 border border-zinc-800 bg-[#000000]">
          <div className="flex-1 flex flex-col items-center justify-center border-r border-zinc-800">
              <span className="text-[9px] font-mono text-zinc-500 mb-1 uppercase tracking-widest">B_FORCE</span>
              <span className="text-3xl font-black font-mono text-white">{score.blue}</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
              <span className="text-[9px] font-mono text-zinc-500 mb-1 uppercase tracking-widest">R_CELL</span>
              <span className="text-3xl font-black font-mono text-white">{score.red}</span>
          </div>
      </div>
      
      <div className="text-[8px] font-mono text-zinc-600 text-center pt-2 tracking-[0.2em] uppercase">
          {status === 'active' ? "Live_Data_Feed_Encrypted" : "Waiting_For_Combat_Signal"}
      </div>
    </div>
  );
};