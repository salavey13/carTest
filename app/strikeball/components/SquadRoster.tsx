"use client";

import { cn } from "@/lib/utils";
import { FaSkull, FaHeartPulse, FaRobot, FaUserAstronaut, FaCrown, FaPlus, FaXmark } from "react-icons/fa6";

export const SquadRoster = ({ teamName, teamColor, members, onToggleStatus, onAddBot, onKick, currentUserId }: any) => {
  const isRed = teamColor === 'red';
  
  return (
    <div className={cn("flex-1 flex flex-col bg-black min-h-[300px]", isRed ? "border-red-900" : "border-blue-900")}>
      <div className={cn("px-4 py-3 font-black text-xs uppercase tracking-widest flex justify-between items-center border-b border-zinc-900", isRed ? "text-red-500" : "text-blue-400")}>
        <span>{teamName}</span>
        <span className="text-[10px] font-mono opacity-50">{members.filter((m:any) => m.status === 'alive').length}/{members.length} LIVE</span>
      </div>

      <div className="flex-1 divide-y divide-zinc-900">
        {members.map((m:any) => (
            <div key={m.id} className={cn("flex items-center justify-between p-3 transition-opacity", m.status === 'dead' ? "opacity-30 grayscale" : "")}>
                <div className="flex items-center gap-3">
                    <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor]", isRed ? "text-red-500 bg-red-500" : "text-blue-500 bg-blue-500")} />
                    {m.is_bot ? <FaRobot className="text-zinc-600" /> : <FaUserAstronaut className="text-zinc-400" />}
                    <div className="flex flex-col">
                        <span className="font-bold text-[11px] leading-none uppercase">{m.is_bot ? `BOT_${m.id.slice(0,4)}` : (m.user?.username || 'OPERATOR')}</span>
                        <span className="text-[8px] font-mono text-zinc-700 mt-1 uppercase">SIGNAL: {Math.floor(Math.random()*40)+10}MS</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {m.status === 'dead' ? <FaSkull className="text-red-900 text-xs" /> : <FaHeartPulse className="text-emerald-900 text-xs animate-pulse" />}
                    {onKick && m.is_bot && (
                        <button onClick={() => onKick(m.id)} className="text-zinc-800 hover:text-red-600"><FaXmark size={12}/></button>
                    )}
                </div>
            </div>
        ))}
      </div>

      {onAddBot && (
          <button onClick={onAddBot} className="w-full py-3 bg-zinc-950 text-zinc-600 text-[9px] font-black uppercase tracking-widest hover:text-white border-t border-zinc-900 flex items-center justify-center gap-2">
              <FaPlus size={8} /> Добавить_Бота
          </button>
      )}
    </div>
  );
};