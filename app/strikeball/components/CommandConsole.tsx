"use client";

import React, { useState } from "react";
import { startGame, endGame, updateScore } from "../actions/game";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const CommandConsole = ({ lobbyId, userId, status, score }: any) => {
  const [isBusy, setIsBusy] = useState(false);

  const handleStart = async () => {
    if(!confirm("АКТИВИРОВАТЬ_БОЕВОЙ_РЕЖИМ?")) return;
    setIsBusy(true);
    const res = await startGame(lobbyId, userId);
    setIsBusy(false);
    if (!res.success) toast.error(res.error);
  };

  const handleEnd = async (winner: 'red' | 'blue' | 'draw') => {
    if(!confirm(`ЗАВЕРШИТЬ_ОПЕРАЦИЮ? ПОБЕДА: ${winner.toUpperCase()}`)) return;
    setIsBusy(true);
    const res = await endGame(lobbyId, userId, winner);
    setIsBusy(false);
    if (!res.success) toast.error(res.error);
  };

  if (status === 'finished') {
      return (
          <div className="bg-[#000000] border border-zinc-800 p-8 text-center">
              <h3 className="font-mono text-xl text-zinc-700 tracking-[0.3em]">СИГНАЛ_РАЗОРВАН</h3>
              <p className="font-mono text-[9px] text-zinc-800 mt-2 uppercase">ОЖИДАНИЕ_ПРОТОКОЛОВ_ДЕБРИФИНГА...</p>
          </div>
      )
  }

  if (status === 'open') {
      return (
          <button 
            onClick={handleStart}
            disabled={isBusy}
            className="w-full bg-white text-black py-10 text-2xl font-black font-mono uppercase tracking-[0.4em] hover:bg-zinc-200 transition-all border-4 border-black outline outline-1 outline-white"
          >
              НАЧАТЬ_БОЙ
          </button>
      )
  }

  return (
    <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
             <div className="bg-[#000000] border border-zinc-800 p-4">
                 <h4 className="text-zinc-600 font-mono text-[10px] mb-4 text-center tracking-widest uppercase">КОРР_СИНИХ</h4>
                 <div className="flex justify-between items-center">
                     <button onClick={() => updateScore(lobbyId, userId, 'blue', -1)} className="w-10 h-10 border border-zinc-800 text-zinc-600 hover:text-white">-</button>
                     <span className="text-2xl font-mono text-white">{score.blue}</span>
                     <button onClick={() => updateScore(lobbyId, userId, 'blue', 1)} className="w-10 h-10 border border-zinc-800 text-zinc-600 hover:text-white">+</button>
                 </div>
             </div>

             <div className="bg-[#000000] border border-zinc-800 p-4">
                 <h4 className="text-zinc-600 font-mono text-[10px] mb-4 text-center tracking-widest uppercase">КОРР_КРАСНЫХ</h4>
                 <div className="flex justify-between items-center">
                     <button onClick={() => updateScore(lobbyId, userId, 'red', -1)} className="w-10 h-10 border border-zinc-800 text-zinc-600 hover:text-white">-</button>
                     <span className="text-2xl font-mono text-white">{score.red}</span>
                     <button onClick={() => updateScore(lobbyId, userId, 'red', 1)} className="w-10 h-10 border border-zinc-800 text-zinc-600 hover:text-white">+</button>
                 </div>
             </div>
        </div>

        <div className="border border-red-900 bg-[#000000] p-4">
            <h4 className="text-red-950 font-mono text-[9px] uppercase mb-4 text-center tracking-[0.3em]">Принудительное_Завершение</h4>
            <div className="grid grid-cols-3 gap-2">
                <button onClick={() => handleEnd('blue')} className="border border-zinc-900 py-3 text-[10px] font-mono hover:bg-white hover:text-black transition-all uppercase">СИНИЕ_WIN</button>
                <button onClick={() => handleEnd('draw')} className="border border-zinc-900 py-3 text-[10px] font-mono hover:bg-zinc-800 transition-all uppercase">НИЧЬЯ</button>
                <button onClick={() => handleEnd('red')} className="border border-zinc-900 py-3 text-[10px] font-mono hover:bg-white hover:text-black transition-all uppercase">КРАСНЫЕ_WIN</button>
            </div>
        </div>
    </div>
  );
};