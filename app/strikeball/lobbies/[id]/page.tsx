"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseAnon } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { joinLobby, addNoobBot, togglePlayerStatus } from "../../actions";
import { FaRobot, FaSkull, FaHeartPulse, FaUserAstronaut } from "react-icons/fa6";
import { cn } from "@/lib/utils";

export default function LobbyRoom() {
  const { id: lobbyId } = useParams(); 
  const { dbUser } = useAppContext();
  const [members, setMembers] = useState<any[]>([]);
  const [lobby, setLobby] = useState<any>(null);

  useEffect(() => {
    // Initial Load
    loadData();

    // Subscribe to realtime changes for tactical map updates
    const channel = supabaseAnon
      .channel(`lobby_${lobbyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'strikeball_members', filter: `lobby_id=eq.${lobbyId}` }, 
        () => loadData()
      )
      .subscribe();

    return () => { supabaseAnon.removeChannel(channel); };
  }, [lobbyId]);

  const loadData = async () => {
    const { data: l } = await supabaseAnon.from("strikeball_lobbies").select("*").eq("id", lobbyId).single();
    const { data: m } = await supabaseAnon.from("strikeball_members").select("*").eq("lobby_id", lobbyId);
    setLobby(l);
    setMembers(m || []);
  };

  const handleAddBot = async (team: string) => {
    await addNoobBot(lobbyId as string, team);
  };

  const handleStatusToggle = async (memberId: string, current: string) => {
    await togglePlayerStatus(memberId, current);
  };

  const TeamColumn = ({ team, color }: { team: string, color: string }) => {
    const teamMembers = members.filter(m => m.team === team);
    const borderColor = color === 'blue' ? 'border-blue-900' : 'border-red-900';
    const bgColor = color === 'blue' ? 'bg-blue-950/20' : 'bg-red-950/20';
    const textColor = color === 'blue' ? 'text-blue-500' : 'text-red-500';

    return (
      <div className={`flex-1 ${bgColor} border ${borderColor} rounded-xl p-3`}>
        <h3 className={`${textColor} font-black mb-4 uppercase text-center font-orbitron tracking-widest`}>{team} TEAM</h3>
        <div className="space-y-2">
          {teamMembers.length === 0 && <div className="text-center text-xs text-neutral-600 py-4">NO OPERATORS</div>}
          
          {teamMembers.map(m => (
             <div key={m.id} 
                  onClick={() => handleStatusToggle(m.id, m.status)}
                  className={cn(
                    "p-3 rounded-lg bg-neutral-900 border flex items-center justify-between cursor-pointer hover:bg-neutral-800 transition-all active:scale-95 select-none",
                    m.status === 'dead' ? "opacity-50 border-red-900/50" : "border-neutral-800"
                  )}>
                <div className="flex items-center gap-3">
                   {m.is_bot ? <FaRobot className="text-neutral-500" /> : <FaUserAstronaut className={textColor} />}
                   <span className={cn("text-sm font-bold", m.status === 'dead' ? 'line-through text-red-500' : 'text-white')}>
                      {m.user_id ? "Operator" : `Bot-${m.id.slice(0,4)}`}
                   </span>
                </div>
                {m.status === 'dead' ? <FaSkull className="text-red-600 animate-pulse"/> : <FaHeartPulse className="text-emerald-500"/>}
             </div>
          ))}
          <button 
            onClick={() => handleAddBot(team)} 
            className="w-full py-3 mt-2 text-xs font-mono text-neutral-500 border border-dashed border-neutral-800 rounded hover:bg-neutral-900 hover:text-neutral-300 transition-colors">
             + DEPLOY BOT
          </button>
        </div>
      </div>
    );
  };

  if (!lobby) return <div className="flex h-screen items-center justify-center text-emerald-500 font-mono animate-pulse">ESTABLISHING UPLINK...</div>;

  return (
    <div className="p-4 min-h-screen bg-black text-white">
      <div className="mb-6 pt-4 text-center">
        <h1 className="text-2xl font-orbitron font-bold text-white uppercase tracking-wider">{lobby.name}</h1>
        <div className="text-[10px] font-mono text-neutral-500 bg-neutral-900 inline-block px-2 py-1 rounded mt-2">
          MODE: {lobby.mode} | STATUS: {lobby.status}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <TeamColumn team="blue" color="blue" />
        <div className="text-center font-bold text-neutral-800 py-2 flex items-center justify-center font-orbitron text-xl">VS</div>
        <TeamColumn team="red" color="red" />
      </div>

      {/* Join Controls */}
      {!members.find(m => m.user_id === dbUser?.user_id) && (
        <div className="grid grid-cols-2 gap-4 fixed bottom-8 left-4 right-4 max-w-md mx-auto">
            <button onClick={() => joinLobby(dbUser!.user_id, lobby.id, 'blue')} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-900/50">
                JOIN BLUE
            </button>
            <button onClick={() => joinLobby(dbUser!.user_id, lobby.id, 'red')} className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-red-900/50">
                JOIN RED
            </button>
        </div>
      )}
    </div>
  );
}