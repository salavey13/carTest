"use client";

import { cn } from "@/lib/utils";
import { FaSkull, FaHeartPulse, FaRobot, FaUserAstronaut, FaCrown, FaPlus, FaXmark, FaGun } from "react-icons/fa6";

// Updated Interface
interface Member {
  id: string;
  user_id: string | null;
  is_bot: boolean;
  role: string;
  status: string; 
  joined_at: string;
  team: string; 
  gear?: { item_name: string; item_type?: string }[]; // New prop
}

interface SquadRosterProps {
  teamName: string;
  teamColor: 'red' | 'blue';
  members: Member[];
  onToggleStatus: (id: string, current: string) => void;
  onAddBot?: () => void;
  onInvite?: () => void;
  onKick?: (id: string) => void;
  currentUserId?: string;
}

export const SquadRoster = ({ teamName, teamColor, members, onToggleStatus, onAddBot, onInvite, onKick, currentUserId }: SquadRosterProps) => {
  const isRed = teamColor === 'red';
  const accentColor = isRed ? 'text-red-500' : 'text-blue-500';
  const borderColor = isRed ? 'border-red-900' : 'border-blue-900';
  const bgGradient = isRed ? 'bg-gradient-to-b from-red-950/40 to-transparent' : 'bg-gradient-to-b from-blue-950/40 to-transparent';

  return (
    <div className={cn("flex-1 border-2 rounded-sm overflow-hidden flex flex-col", borderColor, bgGradient)}>
      <div className={cn("px-4 py-2 font-black italic text-xl uppercase tracking-widest flex justify-between items-center border-b", borderColor, isRed ? "bg-red-900/20" : "bg-blue-900/20")}>
        <span className={accentColor}>{teamName}</span>
        <span className="text-zinc-500 text-sm font-mono">{members.filter(m => m.status === 'alive').length}/{members.length} ALIVE</span>
      </div>

      <div className="flex-1 divide-y divide-zinc-800/50 min-h-[200px]">
        {members.length === 0 && (
           <div className="p-6 text-center font-mono text-xs text-zinc-600 animate-pulse">AWAITING CONNECTION...</div>
        )}

        {members.map(m => {
          const isDead = m.status === 'dead';
          const isMe = m.user_id === currentUserId;
          // Basic gear summary: Count weapons
          const weapons = m.gear?.filter(g => g.item_type === 'weapon').length || 0;

          return (
            <div key={m.id} className={cn("flex items-center justify-between transition-colors group relative", isDead ? "bg-black/40 opacity-60 grayscale" : "hover:bg-white/5", isMe && "bg-white/5 border-l-2 border-emerald-500")}>
              <div className="flex-1 p-3 flex items-center justify-between cursor-pointer" onClick={() => onToggleStatus(m.id, m.status)}>
                  <div className="flex items-center gap-3">
                    <div className={cn("w-2 h-2 rounded-full shadow-[0_0_5px_currentColor]", isDead ? "text-zinc-700 bg-zinc-700" : (isRed ? "text-red-500 bg-red-500" : "text-blue-500 bg-blue-500"))} />
                    
                    {m.role === 'owner' && <FaCrown className="text-amber-500 w-3 h-3" />}
                    {m.is_bot ? <FaRobot className="text-zinc-600" /> : <FaUserAstronaut className="text-zinc-400" />}
                    
                    <div className="flex flex-col">
                      <span className={cn("font-bold text-sm leading-none", isDead ? "text-zinc-500 line-through" : "text-zinc-200")}>
                        {m.is_bot ? `BOT-${m.id.slice(0,4).toUpperCase()}` : (m.user_id ? "OPERATOR" : "UNKNOWN")}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-mono text-zinc-600">PING: {Math.floor(Math.random() * 50) + 10}ms</span>
                          {/* Gear Icon */}
                          {weapons > 0 && (
                              <span className="flex items-center text-[9px] text-zinc-400 gap-1 bg-zinc-800 px-1 rounded">
                                  <FaGun size={8} /> {weapons > 1 ? `x${weapons}` : ''}
                              </span>
                          )}
                      </div>
                    </div>
                  </div>

                  <div className="font-mono font-bold mr-2">
                    {isDead ? (
                      <div className="flex items-center gap-1 text-red-700"><FaSkull /> <span>KIA</span></div>
                    ) : (
                      <div className="flex items-center gap-1 text-emerald-600"><FaHeartPulse className="animate-pulse" /> <span>100%</span></div>
                    )}
                  </div>
              </div>
              {m.is_bot && onKick && <button onClick={(e) => { e.stopPropagation(); onKick(m.id); }} className="h-full px-3 text-zinc-700 hover:text-red-500 hover:bg-red-900/20 transition-colors border-l border-zinc-800/50"><FaXmark /></button>}
            </div>
          );
        })}
      </div>

      <div className="flex text-[10px] font-bold uppercase tracking-widest border-t border-zinc-800 divide-x divide-zinc-800">
          {onAddBot && <button onClick={onAddBot} className="flex-1 py-3 hover:bg-white/10 transition-colors text-zinc-500 hover:text-zinc-300 flex items-center justify-center gap-2"><FaRobot /> Add Bot</button>}
          {onInvite && <button onClick={onInvite} className="flex-1 py-3 hover:bg-white/10 transition-colors text-zinc-500 hover:text-zinc-300 flex items-center justify-center gap-2"><FaPlus /> Invite</button>}
      </div>
    </div>
  );
};