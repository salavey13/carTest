"use client";

import React from "react";
import { cn } from "@/lib/utils";

export const BattleReportView = ({ lobby, members, checkpoints }: any) => {
    const winner = lobby.metadata?.winner?.toUpperCase() || "СИГНАЛ_ПОТЕРЯН";
    const score = lobby.metadata?.score || { red: 0, blue: 0 };

    return (
        <div className="bg-[#000000] border border-zinc-800 p-8 space-y-8 animate-in fade-in duration-1000">
            <div className="text-center border-b border-zinc-900 pb-6">
                <h2 className="text-2xl font-black font-mono text-white tracking-[0.3em] uppercase">ИТОГОВЫЙ_ОТЧЕТ</h2>
                <p className="text-[9px] text-zinc-600 font-mono mt-2 uppercase">ID: {lobby.id.toUpperCase()}</p>
            </div>

            <div className="flex justify-between items-center py-4">
                <div className="text-center">
                    <div className="text-4xl font-black font-mono text-white">{score.blue}</div>
                    <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">СИНИЕ</div>
                </div>
                <div className="text-zinc-800 font-black text-xl font-mono">VS</div>
                <div className="text-center">
                    <div className="text-4xl font-black font-mono text-white">{score.red}</div>
                    <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">КРАСНЫЕ</div>
                </div>
            </div>

            <div className="border-t border-b border-zinc-900 py-6 text-center bg-zinc-950/30">
                <div className="text-[10px] text-zinc-600 font-mono uppercase tracking-[0.4em] mb-2">РЕЗУЛЬТАТ_ОПЕРАЦИИ</div>
                <div className={cn("text-3xl font-black font-mono uppercase tracking-tighter", winner === 'BLUE' ? "text-white underline" : "text-zinc-400")}>
                    ПОБЕДА КОМАНДЫ: {winner}
                </div>
            </div>

            <div className="space-y-3">
                <h4 className="text-[10px] text-zinc-500 font-bold font-mono uppercase tracking-widest">Лог_Контроля_Секторов</h4>
                {checkpoints.map((cp: any) => (
                    <div key={cp.id} className="flex justify-between items-center bg-zinc-950 p-3 border border-zinc-900">
                        <span className="text-xs font-mono text-zinc-400">СЕКТОР_{cp.name.toUpperCase()}</span>
                        <span className={cn("text-[10px] font-black font-mono px-2", cp.owner_team === 'blue' ? "bg-white text-black" : "bg-zinc-700 text-white")}>
                            {cp.owner_team.toUpperCase()}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};