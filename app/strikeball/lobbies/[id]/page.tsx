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
    loadData();
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

  const handleAddBot = async (team: string) => { await addNoobBot(lobbyId as string, team); };
  const handleStatusToggle = async (memberId: string, current: string) => { await togglePlayerStatus(memberId, current); };

  const TeamColumn = ({ team, color }: { team: string, color: string }) => {
    const teamMembers = members.filter(m => m.team === team);
    const borderColor = color === 'blue' ? 'border-blue-900' : 'border-red-900';
    const textColor = color === 'blue' ? 'text-blue-500' : 'text-red-500';

    return (
      <div className={`flex-1 bg-zinc-900/30 border ${borderColor} p-3`}>
        <h3 className={`${textColor} font-black mb-4 uppercase text-center font-orbitron tracking-widest`}>{team} TEAM</h3>
        <div className="space-y-2">
          {teamMembers.map(m => (
             <div key={m.id} onClick={() => handleStatusToggle(m.id, m.status)}
                  className={cn("p-3 border flex items-center justify-between cursor-pointer hover:bg-zinc-800 transition-all select-none",
                    m.status === 'dead' ? "opacity-50 border-red-900/50 bg-red-950/10" : "border-zinc-800 bg-zinc-900")}>
                <div className="flex items-center gap-3">
                   {m.is_bot ? <FaRobot className="text-zinc-600" /> : <FaUserAstronaut className={textColor} />}
                   <span className={cn("text-sm font-bold font-mono", m.status === 'dead' ? 'line-through text-red-600' : 'text-zinc-200')}>
                      {m.user_id ? "Operator" : `Bot-${m.id.slice(0,4)}`}
                   </span>
                </div>
                {m.status === 'dead' ? <FaSkull className="text-red-600 animate-pulse"/> : <FaHeartPulse className="text-emerald-600"/>}
             </div>
          ))}
          <button onClick={() => handleAddBot(team)} className="w-full py-3 mt-2 text-[10px] font-mono text-zinc-600 border border-dashed border-zinc-800 hover:bg-zinc-900 hover:text-zinc-400 uppercase tracking-widest">+ Add Bot</button>
        </div>
      </div>
    );
  };

  if (!lobby) return <div className="flex h-screen items-center justify-center text-red-600 font-mono animate-pulse pt-20">ESTABLISHING UPLINK...</div>;

  return (
    // Added pt-24
    <div className="pt-24 pb-24 p-4 min-h-screen bg-zinc-950 text-white">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-orbitron font-black text-white uppercase tracking-wider">{lobby.name}</h1>
        <div className="text-[10px] font-mono text-zinc-500 mt-1 uppercase">
          MODE: {lobby.mode} // STATUS: {lobby.status}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <TeamColumn team="blue" color="blue" />
        <div className="text-center font-black text-zinc-800 py-2 flex items-center justify-center font-orbitron text-3xl italic">VS</div>
        <TeamColumn team="red" color="red" />
      </div>

      {!members.find(m => m.user_id === dbUser?.user_id) && (
        <div className="grid grid-cols-2 gap-4 fixed bottom-24 left-4 right-4 max-w-md mx-auto z-20">
            <button onClick={() => joinLobby(dbUser!.user_id, lobby.id, 'blue')} className="bg-blue-900/80 border border-blue-600 text-blue-100 font-bold py-4 shadow-[0_0_20px_rgba(30,64,175,0.5)]">JOIN BLUE</button>
            <button onClick={() => joinLobby(dbUser!.user_id, lobby.id, 'red')} className="bg-red-900/80 border border-red-600 text-red-100 font-bold py-4 shadow-[0_0_20px_rgba(220,38,38,0.5)]">JOIN RED</button>
        </div>
      )}
    </div>
  );
}