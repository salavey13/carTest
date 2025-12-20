"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LiveHUDProps {
  startTime: string; // ISO string
  score: { red: number; blue: number };
}

export const LiveHUD = ({ startTime, score }: LiveHUDProps) => {
  const [elapsed, setElapsed] = useState("00:00:00");

  useEffect(() => {
    const start = new Date(startTime).getTime();
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const diff = now - start;
      
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setElapsed(
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="mb-6 space-y-px">
      {/* MISSION CLOCK - HARD WIREFRAME */}
      <div className="bg-[#000000] border border-zinc-800 p-4 text-center relative overflow-hidden">
         <div className="text-[10px] text-zinc-500 font-mono tracking-[0.4em] uppercase mb-2">TELEMETRY_CLOCK</div>
         <div className="text-6xl font-black font-mono text-white tracking-tighter">
             {elapsed}
         </div>
         {/* Scanning Line Hardware Alibi */}
         <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(transparent_50%,#fff_50%)] bg-[size:100%_2px]" />
      </div>

      {/* SCORE BAR - MONOCHROME HIGH CONTRAST */}
      <div className="flex h-16 border border-zinc-800 bg-[#000000]">
          <div className="flex-1 flex flex-col items-center justify-center border-r border-zinc-800">
              <span className="text-[9px] font-mono text-zinc-500 mb-1 tracking-widest uppercase">B_FORCE</span>
              <span className="text-3xl font-black font-mono text-white">{score.blue}</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
              <span className="text-[9px] font-mono text-zinc-500 mb-1 tracking-widest uppercase">R_CELL</span>
              <span className="text-3xl font-black font-mono text-white">{score.red}</span>
          </div>
      </div>
      
      <div className="text-[8px] font-mono text-zinc-600 text-center pt-2 tracking-[0.2em]">
          LIVE_DATA_FEED_ENCRYPTED_AES256
      </div>
    </div>
  );
};