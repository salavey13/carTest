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
    <div className="mb-6">
      {/* Timer Box */}
      <div className="bg-black border-2 border-red-600 rounded-lg p-2 mb-4 text-center shadow-[0_0_20px_rgba(220,38,38,0.4)] relative overflow-hidden">
         <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,0,0,0.1)_10px,rgba(255,0,0,0.1)_20px)]" />
         <div className="text-[10px] text-red-500 font-mono tracking-[0.3em] uppercase mb-1">Mission Clock</div>
         <div className="text-5xl font-black font-mono text-red-100 tracking-wider relative z-10">
             {elapsed}
         </div>
      </div>

      {/* Score Bar */}
      <div className="flex h-12 rounded-lg overflow-hidden border-2 border-zinc-800">
          <div className="flex-1 bg-blue-900 flex items-center justify-center relative">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400" />
              <span className="text-2xl font-black italic font-orbitron text-white">{score.blue}</span>
          </div>
          <div className="w-1 bg-black" />
          <div className="flex-1 bg-red-900 flex items-center justify-center relative">
              <div className="absolute right-0 top-0 bottom-0 w-1 bg-red-400" />
              <span className="text-2xl font-black italic font-orbitron text-white">{score.red}</span>
          </div>
      </div>
    </div>
  );
};