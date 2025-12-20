"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface BattleReportViewProps {
    lobby: any;
    members: any[];
    checkpoints: any[];
}

export const BattleReportView = ({ lobby, members, checkpoints }: BattleReportViewProps) => {
    const winner = lobby.metadata?.winner?.toUpperCase() || "SIGNAL_LOST";
    const score = lobby.metadata?.score || { red: 0, blue: 0 };
    const blueCount = members.filter((m: any) => m.team === 'blue').length;
    const redCount = members.filter((m: any) => m.team === 'red').length;

    return (
        <div className="bg-[#000000] border border-zinc-800 p-8 space-y-8 animate-in fade-in duration-1000">
            {/* LOG HEADER */}
            <div className="text-center border-b border-zinc-900 pb-6">
                <h2 className="text-2xl font-black font-mono text-white tracking-[0.3em] uppercase">MISSION_DEBRIEF</h2>
                <p className="text-[9px] text-zinc-600 font-mono mt-2 tracking-widest uppercase">
                    ID: {lobby.id.toUpperCase()} // ARCHIVE_DATA_RECONSTRUCTED
                </p>
            </div>

            {/* SCORE COMPARISON */}
            <div className="flex justify-between items-center py-4">
                <div className="text-center space-y-1">
                    <div className="text-4xl font-black font-mono text-white">{score.blue}</div>
                    <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">B_FORCE ({blueCount})</div>
                </div>
                <div className="text-zinc-800 font-black text-xl font-mono">VS</div>
                <div className="text-center space-y-1">
                    <div className="text-4xl font-black font-mono text-white">{score.red}</div>
                    <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">R_CELL ({redCount})</div>
                </div>
            </div>

            {/* VICTOR PROTOCOL */}
            <div className="border-t border-b border-zinc-900 py-6 text-center bg-zinc-950/30">
                <div className="text-[10px] text-zinc-600 font-mono uppercase tracking-[0.4em] mb-2">Operational_Outcome</div>
                <div className={cn(
                    "text-3xl font-black font-mono uppercase tracking-tighter",
                    winner === 'BLUE' ? "text-white underline decoration-zinc-500" : 
                    winner === 'RED' ? "text-zinc-400" : "text-zinc-700"
                )}>
                    {winner} TEAM WINS
                </div>
            </div>

            {/* SECTOR STATUS LOG */}
            {checkpoints.length > 0 && (
                <div className="space-y-3">
                    <h4 className="text-[10px] text-zinc-500 font-bold font-mono uppercase tracking-widest">Sector_Control_Log</h4>
                    <div className="space-y-px">
                        {checkpoints.map((cp: any) => (
                            <div key={cp.id} className="flex justify-between items-center bg-zinc-950 p-3 border border-zinc-900">
                                <span className="text-xs font-mono text-zinc-400">SEC_{cp.name.toUpperCase()}</span>
                                <span className={cn(
                                    "text-[10px] font-black font-mono px-2 py-0.5", 
                                    cp.owner_team === 'blue' ? "bg-white text-black" : 
                                    cp.owner_team === 'red' ? "bg-zinc-700 text-white" : 
                                    "text-zinc-700"
                                )}>
                                    {cp.owner_team.toUpperCase()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* FOOTER DIAGNOSTICS */}
            <div className="pt-8 opacity-20 group">
                <div className="text-[7px] font-mono text-zinc-500 leading-tight uppercase">
                    SYS_DEBRIEF: Data integrity 98% // Timestamp: {new Date().toISOString()} // 
                    End_Reason: Commander_Manual_Termination // Packet_Loss: 0.02%
                </div>
            </div>
        </div>
    );
};