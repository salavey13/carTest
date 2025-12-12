"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseAnon } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { joinLobby, addNoobBot, togglePlayerStatus } from "../../actions";
import { SquadRoster } from "../../components/SquadRoster"; // NEW IMPORT

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

  if (!lobby) return <div className="flex h-screen items-center justify-center text-red-600 font-mono animate-pulse pt-20">ESTABLISHING UPLINK...</div>;

  const blueTeam = members.filter(m => m.team === 'blue');
  const redTeam = members.filter(m => m.team === 'red');

  return (
    <div className="pt-28 pb-32 px-2 min-h-screen text-white">
      
      {/* Lobby Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black font-orbitron uppercase tracking-widest">{lobby.name}</h1>
        <div className="inline-flex gap-4 mt-2 text-[10px] font-mono text-zinc-400 bg-black/50 px-4 py-1 border border-zinc-800 rounded-full">
          <span>MODE: {lobby.mode.toUpperCase()}</span>
          <span className="text-red-500">|</span>
          <span>STATUS: {lobby.status.toUpperCase()}</span>
        </div>
      </div>

      {/* Roster Grid */}
      <div className="flex flex-col md:flex-row gap-6 max-w-4xl mx-auto">
        <SquadRoster 
            teamName="BLUE SQUAD" 
            teamColor="blue" 
            members={blueTeam} 
            onToggleStatus={handleStatusToggle}
            onAddBot={() => handleAddBot('blue')}
            currentUserId={dbUser?.user_id}
        />
        
        <div className="text-center flex flex-col justify-center">
            <span className="font-black text-4xl italic text-zinc-700 font-orbitron">VS</span>
        </div>

        <SquadRoster 
            teamName="RED SQUAD" 
            teamColor="red" 
            members={redTeam} 
            onToggleStatus={handleStatusToggle}
            onAddBot={() => handleAddBot('red')}
            currentUserId={dbUser?.user_id}
        />
      </div>

      {/* Join Actions */}
      {!members.find(m => m.user_id === dbUser?.user_id) && (
        <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-30">
            <div className="grid grid-cols-2 gap-2 bg-black/80 p-2 border border-zinc-700 shadow-2xl backdrop-blur-md">
                <button onClick={() => joinLobby(dbUser!.user_id, lobby.id, 'blue')} className="bg-blue-900 hover:bg-blue-800 text-blue-100 font-bold py-4 uppercase tracking-widest border border-blue-500/30">
                    Join Blue
                </button>
                <button onClick={() => joinLobby(dbUser!.user_id, lobby.id, 'red')} className="bg-red-900 hover:bg-red-800 text-red-100 font-bold py-4 uppercase tracking-widest border border-red-500/30">
                    Join Red
                </button>
            </div>
        </div>
      )}
    </div>
  );
}