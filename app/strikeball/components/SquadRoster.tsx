"use client";

import { cn } from "@/lib/utils";
import { FaSkull, FaHeartPulse, FaRobot, FaUserAstronaut, FaCrown } from "react-icons/fa6";

interface Member {
  id: string;
  user_id: string | null;
  is_bot: boolean;
  role: string;
  status: string; // 'alive', 'dead'
  joined_at: string;
}

interface SquadRosterProps {
  teamName: string;
  teamColor: 'red' | 'blue';
  members: Member[];
  onToggleStatus: (id: string, current: string) => void;
  onAddBot?: () => void;
  currentUserId?: string;
}

export const SquadRoster = ({ teamName, teamColor, members, onToggleStatus, onAddBot, currentUserId }: SquadRosterProps) => {
  
  const isRed = teamColor === 'red';
  const accentColor = isRed ? 'text-red-500' : 'text-blue-500';
  const borderColor = isRed ? 'border-red-900' : 'border-blue-900';
  const bgGradient = isRed 
    ? 'bg-gradient-to-b from-red-950/40 to-transparent' 
    : 'bg-gradient-to-b from-blue-950/40 to-transparent';

  return (
    <div className={cn("flex-1 border-2 rounded-sm overflow-hidden", borderColor, bgGradient)}>
      {/* Header */}
      <div className={cn("px-4 py-2 font-black italic text-xl uppercase tracking-widest flex justify-between items-center border-b", borderColor, isRed ? "bg-red-900/20" : "bg-blue-900/20")}>
        <span className={accentColor}>{teamName}</span>
        <span className="text-zinc-500 text-sm font-mono">{members.filter(m => m.status === 'alive').length}/{members.length} ALIVE</span>
      </div>

      {/* List */}
      <div className="divide-y divide-zinc-800/50">
        {members.length === 0 && (
           <div className="p-6 text-center font-mono text-xs text-zinc-600 animate-pulse">
             AWAITING CONNECTION...
           </div>
        )}

        {members.map(m => {
          const isDead = m.status === 'dead';
          const isMe = m.user_id === currentUserId;

          return (
            <div 
              key={m.id} 
              onClick={() => onToggleStatus(m.id, m.status)}
              className={cn(
                "p-3 flex items-center justify-between cursor-pointer transition-colors group",
                isDead ? "bg-black/40 opacity-60 grayscale" : "hover:bg-white/5",
                isMe && "bg-white/5 border-l-2 border-emerald-500"
              )}
            >
              {/* Left: Icon & Name */}
              <div className="flex items-center gap-3">
                <div className={cn("w-2 h-2 rounded-full shadow-[0_0_5px_currentColor]", isDead ? "text-zinc-700 bg-zinc-700" : (isRed ? "text-red-500 bg-red-500" : "text-blue-500 bg-blue-500"))} />
                
                {m.role === 'owner' && <FaCrown className="text-amber-500 w-3 h-3" />}
                {m.is_bot ? <FaRobot className="text-zinc-600" /> : <FaUserAstronaut className="text-zinc-400" />}
                
                <div className="flex flex-col">
                  <span className={cn("font-bold text-sm leading-none", isDead ? "text-zinc-500 line-through" : "text-zinc-200")}>
                    {m.user_id ? "OPERATOR" : `BOT-${m.id.slice(0,4).toUpperCase()}`}
                  </span>
                  <span className="text-[9px] font-mono text-zinc-600">PING: {Math.floor(Math.random() * 50) + 10}ms</span>
                </div>
              </div>

              {/* Right: Status Icon */}
              <div className="font-mono font-bold">
                {isDead ? (
                  <div className="flex items-center gap-1 text-red-700">
                    <FaSkull /> <span>KIA</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-emerald-600">
                    <FaHeartPulse className="animate-pulse" /> <span>100%</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Add Button */}
      {onAddBot && (
        <button 
          onClick={onAddBot}
          className={cn("w-full py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-colors border-t border-zinc-800 text-zinc-500 hover:text-zinc-300")}
        >
          + Deploy Reinforcement Unit
        </button>
      )}
    </div>
  );
};