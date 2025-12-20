"use client";

import React, { useState } from "react";
import { startGame, endGame, updateScore } from "../actions/game";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CommandConsoleProps {
  lobbyId: string;
  userId: string;
  status: string;
  score: { red: number; blue: number };
}

export const CommandConsole = ({ lobbyId, userId, status, score }: CommandConsoleProps) => {
  const [isBusy, setIsBusy] = useState(false);

  const handleStart = async () => {
    if(!confirm("INITIATE LIVE COMBAT SIGNAL?")) return;
    setIsBusy(true);
    const res = await startGame(lobbyId, userId);
    setIsBusy(false);
    if (!res.success) toast.error(res.error);
  };

  const handleEnd = async (winner: 'red' | 'blue' | 'draw') => {
    if(!confirm(`TERMINATE OPS? WINNER: ${winner.toUpperCase()}`)) return;
    setIsBusy(true);
    const res = await endGame(lobbyId, userId, winner);
    setIsBusy(false);
    if (!res.success) toast.error(res.error);
  };

  const handleScore = async (team: 'red' | 'blue', delta: number) => {
    const res = await updateScore(lobbyId, userId, team, delta);
    if (!res.success) toast.error(res.error);
  };

  if (status === 'finished') {
      return (
          <div className="bg-[#000000] border border-zinc-800 p-8 text-center">
              <h3 className="font-mono text-xl text-zinc-500 tracking-[0.3em]">SIGNAL_LOST</h3>
              <p className="font-mono text-[9px] text-zinc-700 mt-2 uppercase">Awaiting debrief protocols...</p>
          </div>
      )
  }

  if (status === 'open') {
      return (
          <button 
            onClick={handleStart}
            disabled={isBusy}
            className="w-full bg-white text-black py-10 text-2xl font-black font-mono uppercase tracking-[0.4em] hover:bg-zinc-200 transition-colors border-4 border-black outline outline-1 outline-white"
          >
              INIT_COMBAT
          </button>
      )
  }

  return (
    <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
             {/* BLUE TEAM ADJUST */}
             <div className="bg-[#000000] border border-zinc-800 p-4">
                 <h4 className="text-zinc-500 font-mono text-[10px] mb-4 text-center tracking-widest uppercase">B_ADJUST</h4>
                 <div className="flex justify-between items-center">
                     <button onClick={() => handleScore('blue', -1)} className="w-10 h-10 border border-zinc-800 text-zinc-500 hover:text-white">-</button>
                     <span className="text-2xl font-mono text-white">{score.blue}</span>
                     <button onClick={() => handleScore('blue', 1)} className="w-10 h-10 border border-zinc-800 text-zinc-500 hover:text-white">+</button>
                 </div>
             </div>

             {/* RED TEAM ADJUST */}
             <div className="bg-[#000000] border border-zinc-800 p-4">
                 <h4 className="text-zinc-500 font-mono text-[10px] mb-4 text-center tracking-widest uppercase">R_ADJUST</h4>
                 <div className="flex justify-between items-center">
                     <button onClick={() => handleScore('red', -1)} className="w-10 h-10 border border-zinc-800 text-zinc-500 hover:text-white">-</button>
                     <span className="text-2xl font-mono text-white">{score.red}</span>
                     <button onClick={() => handleScore('red', 1)} className="w-10 h-10 border border-zinc-800 text-zinc-500 hover:text-white">+</button>
                 </div>
             </div>
        </div>

        {/* TERMINATE PROTOCOLS */}
        <div className="border border-red-900 bg-[#000000] p-4">
            <h4 className="text-red-900 font-mono text-[9px] uppercase mb-4 text-center tracking-[0.3em]">Termination_Override</h4>
            <div className="grid grid-cols-3 gap-2">
                <button onClick={() => handleEnd('blue')} className="border border-zinc-800 py-3 text-[10px] font-mono hover:bg-white hover:text-black transition-colors uppercase">B_VICTORY</button>
                <button onClick={() => handleEnd('draw')} className="border border-zinc-800 py-3 text-[10px] font-mono hover:bg-zinc-800 transition-colors uppercase">STALEMATE</button>
                <button onClick={() => handleEnd('red')} className="border border-zinc-800 py-3 text-[10px] font-mono hover:bg-white hover:text-black transition-colors uppercase">R_VICTORY</button>
            </div>
        </div>
    </div>
  );
};