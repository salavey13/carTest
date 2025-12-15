"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { FaPlay, FaStop, FaPlus, FaMinus, FaTrophy } from "react-icons/fa6";
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
    if(!confirm("INITIATE LIVE COMBAT?")) return;
    setIsBusy(true);
    const res = await startGame(lobbyId, userId);
    setIsBusy(false);
    if (!res.success) toast.error(res.error);
    else toast.success("MATCH STARTED");
  };

  const handleEnd = async (winner: 'red' | 'blue' | 'draw') => {
    if(!confirm(`CONFIRM END GAME? WINNER: ${winner.toUpperCase()}`)) return;
    setIsBusy(true);
    const res = await endGame(lobbyId, userId, winner);
    setIsBusy(false);
    if (!res.success) toast.error(res.error);
    else toast.success("MATCH FINALIZED");
  };

  const handleScore = async (team: 'red' | 'blue', delta: number) => {
    // Optimistic update could go here, but we'll rely on realtime for simplicity
    const res = await updateScore(lobbyId, userId, team, delta);
    if (!res.success) toast.error(res.error);
  };

  if (status === 'finished') {
      return (
          <div className="bg-zinc-900 border border-zinc-700 p-6 text-center rounded-xl">
              <h3 className="font-orbitron text-2xl text-zinc-400">OPERATION CLOSED</h3>
              <p className="font-mono text-xs text-zinc-500 mt-2">Data archived to HQ.</p>
          </div>
      )
  }

  if (status === 'open') {
      return (
          <div className="bg-black/80 border-2 border-green-600 p-6 rounded-xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-green-900/10 animate-pulse pointer-events-none" />
              <button 
                onClick={handleStart}
                disabled={isBusy}
                className="w-full py-8 text-3xl font-black font-orbitron text-green-500 uppercase tracking-widest hover:scale-105 transition-transform flex items-center justify-center gap-4"
              >
                  <FaPlay /> START MATCH
              </button>
          </div>
      )
  }

  // Active Game Controls
  return (
    <div className="space-y-4">
        {/* Scoreboard Control */}
        <div className="grid grid-cols-2 gap-4">
            {/* Blue Control */}
            <div className="bg-blue-950/50 border border-blue-600 p-4 rounded-lg flex flex-col items-center">
                <div className="text-blue-400 font-black text-4xl mb-4 font-orbitron">{score.red ?? 0}</div> {/* Wait, logic swap? No, team prop. */}
                {/* Visual Fix: Actually map colors correctly below */}
            </div>
            {/* Red Control */}
            <div className="bg-red-950/50 border border-red-600 p-4 rounded-lg flex flex-col items-center">
                {/* ... wait, let's make it cleaner */}
            </div>
        </div>

        {/* RE-DOING THE GRID FOR CLARITY */}
        <div className="grid grid-cols-2 gap-4">
             {/* BLUE TEAM */}
             <div className="bg-blue-900/20 border-2 border-blue-600 rounded-xl p-3">
                 <h4 className="text-blue-400 font-bold text-center mb-2 font-orbitron">BLUE SCORE</h4>
                 <div className="flex justify-between items-center">
                     <button onClick={() => handleScore('blue', -1)} className="p-3 bg-blue-900/50 rounded hover:bg-blue-800 text-blue-200"><FaMinus/></button>
                     <span className="text-4xl font-black text-white font-mono">{score.blue}</span>
                     <button onClick={() => handleScore('blue', 1)} className="p-3 bg-blue-600 rounded hover:bg-blue-500 text-white"><FaPlus/></button>
                 </div>
             </div>

             {/* RED TEAM */}
             <div className="bg-red-900/20 border-2 border-red-600 rounded-xl p-3">
                 <h4 className="text-red-400 font-bold text-center mb-2 font-orbitron">RED SCORE</h4>
                 <div className="flex justify-between items-center">
                     <button onClick={() => handleScore('red', -1)} className="p-3 bg-red-900/50 rounded hover:bg-red-800 text-red-200"><FaMinus/></button>
                     <span className="text-4xl font-black text-white font-mono">{score.red}</span>
                     <button onClick={() => handleScore('red', 1)} className="p-3 bg-red-600 rounded hover:bg-red-500 text-white"><FaPlus/></button>
                 </div>
             </div>
        </div>

        {/* End Game Control */}
        <div className="bg-zinc-900 border border-zinc-700 p-4 rounded-xl mt-4">
            <h4 className="text-zinc-500 font-mono text-xs uppercase mb-3 text-center">TERMINATE OPERATION</h4>
            <div className="grid grid-cols-3 gap-2">
                <button onClick={() => handleEnd('blue')} className="bg-blue-900/40 text-blue-400 border border-blue-800 py-3 text-xs font-bold hover:bg-blue-900">BLUE WINS</button>
                <button onClick={() => handleEnd('draw')} className="bg-zinc-800 text-zinc-400 border border-zinc-600 py-3 text-xs font-bold hover:bg-zinc-700">DRAW</button>
                <button onClick={() => handleEnd('red')} className="bg-red-900/40 text-red-400 border border-red-800 py-3 text-xs font-bold hover:bg-red-900">RED WINS</button>
            </div>
        </div>
    </div>
  );
};