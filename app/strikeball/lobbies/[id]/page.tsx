"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseAnon } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { joinLobby, addNoobBot, togglePlayerStatus } from "../../actions";
import { FaRobot, FaSkull, FaHeartPulse } from "react-icons/fa6";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function LobbyRoom() {
  const { id: lobbyId } = useParams(); 
  const { dbUser } = useAppContext();
  const [members, setMembers] = useState<any[]>([]);
  const [lobby, setLobby] = useState<any>(null);

  // Real-time subscription to member status
  useEffect(() => {
    const channel = supabaseAnon
      .channel(`lobby_${lobbyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'strikeball_members', filter: `lobby_id=eq.${lobbyId}` }, 
        (payload) => {
           loadData(); // Brute force refresh for MVP
        }
      )
      .subscribe();

    loadData();
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
    // Basic "Admin/Owner" check logic would go here
    await togglePlayerStatus(memberId, current);
  };

  const TeamColumn = ({ team, color }: { team: string, color: string }) => (
    <div className={`flex-1 bg-${color}-950/30 border border-${color}-900 rounded-lg p-2`}>
      <h3 className={`text-${color}-500 font-bold mb-2 uppercase text-center`}>{team} TEAM</h3>
      <div className="space-y-2">
        {members.filter(m => m.team === team).map(m => (
           <div key={m.id} 
                onClick={() => handleStatusToggle(m.id, m.status)}
                className={cn(
                  "p-2 rounded bg-neutral-900 border flex items-center justify-between cursor-pointer hover:bg-neutral-800",
                  m.status === 'dead' ? "opacity-50 border-red-900" : "border-neutral-700"
                )}>
              <div className="flex items-center gap-2">
                 {m.is_bot ? <FaRobot className="text-neutral-500" /> : <span className="w-2 h-2 rounded-full bg-green-500"/>}
                 <span className={m.status === 'dead' ? 'line-through text-red-500' : 'text-white'}>
                    {m.user_id ? "Operator" : "Noob Bot"}
                 </span>
              </div>
              {m.status === 'dead' ? <FaSkull className="text-red-500"/> : <FaHeartPulse className="text-emerald-500"/>}
           </div>
        ))}
        <button onClick={() => handleAddBot(team)} className="w-full py-2 text-xs text-neutral-500 border border-dashed border-neutral-800 rounded hover:bg-neutral-900">
           + ADD BOT
        </button>
      </div>
    </div>
  );

  if (!lobby) return <div className="p-10 text-center">Loading Tactical Data...</div>;

  return (
    <div className="p-4 min-h-screen bg-black text-white">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-orbitron font-bold text-white">{lobby.name}</h1>
        <div className="text-xs font-mono text-neutral-500">MODE: {lobby.mode} | ID: {lobby.id.slice(0,6)}</div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <TeamColumn team="blue" color="blue" />
        <div className="text-center font-bold text-neutral-700 py-2">VS</div>
        <TeamColumn team="red" color="red" />
      </div>

      {/* QR Code Stub (Path C) */}
      <div className="mt-8 p-4 bg-white rounded-xl text-black text-center">
         <p className="font-bold text-sm mb-2">SCAN TO JOIN</p>
         <div className="w-32 h-32 bg-neutral-200 mx-auto animate-pulse rounded-lg flex items-center justify-center text-xs text-neutral-500">
            [QR GENERATED HERE]
            <br/>
            {lobby.qr_code_hash?.slice(0,8)}
         </div>
      </div>
    </div>
  );
}