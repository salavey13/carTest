"use client";

import React, { useState } from "react";
import { startGame, endGame, updateScore } from "../actions/game";
import { setLobbyApprovalStatus, proposeLobbyDate } from "../actions/lobby"; // NEW
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FaCheckDouble, FaMoneyBillWave, FaCalendarPlus } from "react-icons/fa6";

export const CommandConsole = ({ lobbyId, userId, status, score, lobby, isAdmin, onLoad }: any) => {
  const [isBusy, setIsBusy] = useState(false);
  const [newDate, setNewDate] = useState("");

  // ADMIN ACTIONS: Change the global booking status
  const handleApproval = async (newStatus: 'approved_unpaid' | 'approved_paid') => {
    setIsBusy(true);
    const res = await setLobbyApprovalStatus(lobbyId, newStatus);
    setIsBusy(false);
    if (res.success) {
        toast.success(`СТАТУС_ОБНОВЛЕН: ${newStatus.toUpperCase()}`);
        onLoad();
    } else toast.error(res.error);
  };

  const handlePropose = async () => {
    if (!newDate) return toast.error("ВЫБЕРИТЕ_ДАТУ");
    setIsBusy(true);
    const res = await proposeLobbyDate(lobbyId, userId, newDate);
    setIsBusy(false);
    if (res.success) {
        toast.success("ДАТА_ИЗМЕНЕНА // ГОЛОСОВАНИЕ_СБРОШЕНО");
        onLoad();
    } else toast.error(res.error);
  };

  if (status === 'finished') return null;

  return (
    <div className="space-y-6">
        {/* 1. PLANNING PHASE (Only in 'open' status) */}
        {status === 'open' && (
            <div className="space-y-4">
                {/* PROPOSE NEW DATE */}
                <div className="bg-zinc-950 border border-zinc-800 p-4">
                    <h4 className="text-[9px] text-zinc-600 mb-2 uppercase font-mono tracking-widest flex items-center gap-2">
                        <FaCalendarPlus /> ПЕРЕНОС_ОПЕРАЦИИ (OWNER)
                    </h4>
                    <div className="flex gap-2">
                        <input 
                            type="datetime-local" 
                            className="flex-1 bg-black border border-zinc-800 p-2 text-xs font-mono text-white outline-none focus:border-white"
                            onChange={(e) => setNewDate(e.target.value)}
                        />
                        <button onClick={handlePropose} disabled={isBusy} className="bg-white text-black px-4 text-[10px] font-black uppercase hover:bg-brand-cyan transition-colors">PUSH</button>
                    </div>
                </div>

                {/* FINAL ADMIN APPROVAL BUTTONS */}
                <div className="bg-zinc-950 border border-zinc-800 p-4">
                    <h4 className="text-[9px] text-zinc-600 mb-3 uppercase font-mono tracking-widest flex items-center gap-2">
                        <FaCheckDouble /> УТВЕРЖДЕНИЕ_ОРГАНИЗАТОРОМ
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={() => handleApproval('approved_unpaid')} 
                            disabled={isBusy}
                            className="bg-cyan-900/20 border border-cyan-500 text-cyan-400 py-3 text-[10px] font-black uppercase hover:bg-cyan-500 hover:text-black transition-all"
                        >
                            ОДОБРИТЬ_БЕЗ_ОПЛАТЫ
                        </button>
                        <button 
                            onClick={() => handleApproval('approved_paid')} 
                            disabled={isBusy}
                            className="bg-green-900/20 border border-green-500 text-green-400 py-3 text-[10px] font-black uppercase hover:bg-green-500 hover:text-black transition-all"
                        >
                            <FaMoneyBillWave className="inline mr-1" /> ОПЛАЧЕНО_OK
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* 2. COMBAT CONTROLS */}
        <div className="space-y-4">
            {status === 'open' ? (
                <button 
                    onClick={startGame} // Should be handleStart wrap
                    className="w-full bg-white text-black py-10 text-2xl font-black font-mono uppercase tracking-[0.4em] border-4 border-black outline outline-1 outline-white"
                >
                    НАЧАТЬ_БОЙ
                </button>
            ) : (
                <>
                    {/* Score Adjusters */}
                    <div className="grid grid-cols-2 gap-4">
                        <TeamAdjust team="blue" score={score.blue} onUpdate={(d:number) => updateScore(lobbyId, userId, 'blue', d)} />
                        <TeamAdjust team="red" score={score.red} onUpdate={(d:number) => updateScore(lobbyId, userId, 'red', d)} />
                    </div>
                    {/* End Game */}
                    <div className="grid grid-cols-3 gap-2 mt-4">
                        <button onClick={() => endGame(lobbyId, userId, 'blue')} className="border border-zinc-800 py-3 text-[10px] font-mono hover:bg-white hover:text-black transition-all">B_VICTORY</button>
                        <button onClick={() => endGame(lobbyId, userId, 'draw')} className="border border-zinc-800 py-3 text-[10px] font-mono hover:bg-zinc-800">STALEMATE</button>
                        <button onClick={() => endGame(lobbyId, userId, 'red')} className="border border-zinc-800 py-3 text-[10px] font-mono hover:bg-white hover:text-black transition-all">R_VICTORY</button>
                    </div>
                </>
            )}
        </div>
    </div>
  );
};

function TeamAdjust({ team, score, onUpdate }: any) {
    return (
        <div className="bg-[#000000] border border-zinc-800 p-4">
            <h4 className="text-zinc-600 font-mono text-[10px] mb-4 text-center uppercase">{team}_SCORE</h4>
            <div className="flex justify-between items-center">
                <button onClick={() => onUpdate(-1)} className="w-10 h-10 border border-zinc-800 text-zinc-600 hover:text-white">-</button>
                <span className="text-2xl font-mono text-white">{score}</span>
                <button onClick={() => onUpdate(1)} className="w-10 h-10 border border-zinc-800 text-zinc-600 hover:text-white">+</button>
            </div>
        </div>
    );
}