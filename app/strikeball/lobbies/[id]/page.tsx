"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseAnon } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { joinLobby, addNoobBot, togglePlayerStatus } from "../../actions";
import { SquadRoster } from "../../components/SquadRoster";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function LobbyRoom() {
  const { id: lobbyId } = useParams(); 
  const { dbUser } = useAppContext();
  const [members, setMembers] = useState<any[]>([]);
  const [lobby, setLobby] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();

    // Subscribe to realtime changes on 'lobby_members'
    const channel = supabaseAnon
      .channel(`lobby_${lobbyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobby_members', filter: `lobby_id=eq.${lobbyId}` }, 
        () => loadData()
      )
      .subscribe();

    return () => { supabaseAnon.removeChannel(channel); };
  }, [lobbyId]);

  const loadData = async () => {
    const { data: l, error: lobbyError } = await supabaseAnon
        .from("lobbies")
        .select("*")
        .eq("id", lobbyId)
        .single();
    
    if (lobbyError) {
        setError("LOBBY NOT FOUND");
        return;
    }

    const { data: m } = await supabaseAnon
        .from("lobby_members")
        .select("*")
        .eq("lobby_id", lobbyId);

    setLobby(l);
    setMembers(m || []);
  };

  const handleAddBot = async (team: string) => { 
      const res = await addNoobBot(lobbyId as string, team);
      if (!res.success) toast.error(res.error);
  };

  const handleStatusToggle = async (memberId: string, current: string) => { 
      await togglePlayerStatus(memberId, current); 
  };

  // NEW: Handle Team Joining / Switching
  const handleJoinTeam = async (team: string) => {
      if (!dbUser) { toast.error("Log in first"); return; }
      
      const res = await joinLobby(dbUser.user_id, lobbyId as string, team);
      if (res.success) {
          toast.success(res.message);
          loadData(); // Force refresh to see change immediately
      } else {
          toast.error(res.error || "Failed");
      }
  };

  if (error) return <div className="text-center pt-32 text-red-600 font-mono">{error}</div>;
  if (!lobby) return <div className="text-center pt-32 text-red-600 font-mono animate-pulse">CONNECTING...</div>;

  const blueTeam = members.filter(m => m.team === 'blue');
  const redTeam = members.filter(m => m.team === 'red');
  const userMember = members.find(m => m.user_id === dbUser?.user_id);

  return (
    <div className="pt-28 pb-32 px-2 min-h-screen text-white">
      
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black font-orbitron uppercase tracking-widest">{lobby.name}</h1>
        <div className="inline-flex gap-4 mt-2 text-[10px] font-mono text-zinc-400 bg-black/50 px-4 py-1 border border-zinc-800 rounded-full">
          <span>MODE: {lobby.mode ? lobby.mode.toUpperCase() : 'UNKNOWN'}</span>
          <span className="text-red-500">|</span>
          <span>STATUS: {lobby.status ? lobby.status.toUpperCase() : 'UNKNOWN'}</span>
        </div>
      </div>

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

      {/* TEAM SELECTION: Show if not member OR allow switching */}
      <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-30">
          <div className="grid grid-cols-2 gap-2 bg-black/80 p-2 border border-zinc-700 shadow-2xl backdrop-blur-md">
              <button 
                onClick={() => handleJoinTeam('blue')} 
                className={cn(
                    "font-bold py-4 uppercase tracking-widest border border-blue-500/30 transition-all",
                    userMember?.team === 'blue' ? "bg-blue-600 text-white shadow-[0_0_15px_blue]" : "bg-blue-900/40 text-blue-200 hover:bg-blue-800"
                )}
                disabled={userMember?.team === 'blue'}
              >
                  {userMember?.team === 'blue' ? "DEPLOYED BLUE" : "JOIN BLUE"}
              </button>
              
              <button 
                onClick={() => handleJoinTeam('red')} 
                className={cn(
                    "font-bold py-4 uppercase tracking-widest border border-red-500/30 transition-all",
                    userMember?.team === 'red' ? "bg-red-600 text-white shadow-[0_0_15px_red]" : "bg-red-900/40 text-red-200 hover:bg-red-800"
                )}
                disabled={userMember?.team === 'red'}
              >
                  {userMember?.team === 'red' ? "DEPLOYED RED" : "JOIN RED"}
              </button>
          </div>
      </div>
    </div>
  );
}