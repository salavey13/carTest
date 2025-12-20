"use client";

import React, { useEffect, useState } from "react";

export const LiveHUD = ({ startTime, score }: any) => {
  const [elapsed, setElapsed] = useState("00:00:00");

  useEffect(() => {
    const start = new Date(startTime).getTime();
    const interval = setInterval(() => {
      const diff = Math.max(0, new Date().getTime() - start);
      const h = Math.floor(diff / 3600000).toString().padStart(2,'0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2,'0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2,'0');
      setElapsed(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="mb-6 space-y-px">
      <div className="bg-[#000000] border border-zinc-800 p-4 text-center relative overflow-hidden">
         <div className="text-[10px] text-zinc-500 font-mono tracking-[0.4em] uppercase mb-2">ЧАСЫ_ТЕЛЕМЕТРИИ</div>
         <div className="text-6xl font-black font-mono text-white tracking-tighter">{elapsed}</div>
         <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(transparent_50%,#fff_50%)] bg-[size:100%_2px]" />
      </div>

      <div className="flex h-16 border border-zinc-800 bg-[#000000]">
          <div className="flex-1 flex flex-col items-center justify-center border-r border-zinc-800">
              <span className="text-[9px] font-mono text-zinc-500 mb-1 uppercase tracking-widest">СИНИЕ_СИЛЫ</span>
              <span className="text-3xl font-black font-mono text-white">{score.blue}</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
              <span className="text-[9px] font-mono text-zinc-500 mb-1 uppercase tracking-widest">КРАСНАЯ_ЯЧЕЙКА</span>
              <span className="text-3xl font-black font-mono text-white">{score.red}</span>
          </div>
      </div>
      <div className="text-[8px] font-mono text-zinc-600 text-center pt-2 tracking-[0.2em]">КАНАЛ_ДАННЫХ_ЗАШИФРОВАН_AES256</div>
    </div>
  );
};