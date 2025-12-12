"use client";

import React, { useEffect, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { getOpenLobbies, joinLobby } from "../actions";
import { getAllPublicCrews } from "@/app/rentals/actions"; // Reuse this!
import { toast } from "sonner";
import Link from "next/link";

type Lobby = {
  id: string;
  name: string;
  mode?: string;
  max_players?: number;
  created_at?: string;
  start_at?: string;
};

export default function LobbiesPageClient() {
  const { dbUser } = useAppContext();
  const userId = dbUser?.user_id ?? null;
  
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [crews, setCrews] = useState<any[]>([]); // New state for crews
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      // Parallel fetch
      const [lobbyRes, crewRes] = await Promise.all([
        getOpenLobbies(),
        getAllPublicCrews()
      ]);

      if (lobbyRes.success) setLobbies(lobbyRes.data || []);
      if (crewRes.success) setCrews(crewRes.data || []);
      
    } catch (e) {
      toast.error("Signal Lost: " + ((e as Error).message));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleJoin = async (lobbyId: string) => {
    if (!userId) return toast.error("LOGIN REQUIRED");
    const res = await joinLobby(userId, lobbyId);
    if (!res.success) toast.error(res.error);
    else toast.success("DEPLOYED!");
  };

  return (
    <div className="pt-28 pb-32 px-4 min-h-screen bg-zinc-950 text-white font-orbitron">
      
      {/* SECTION 1: LIVE OPERATIONS (Lobbies) */}
      <h2 className="text-2xl font-black mb-4 text-red-600 tracking-tighter uppercase border-b border-red-900/50 pb-2">
        Live Operations
      </h2>
      
      {loading ? (
        <div className="text-center py-4 font-mono text-red-500 animate-pulse">SCANNING...</div>
      ) : (
        <div className="space-y-3 mb-8">
          {lobbies.length === 0 && <div className="text-zinc-600 text-xs font-mono">NO ACTIVE SKIRMISHES</div>}
          {lobbies.map(l => (
            <div key={l.id} className="bg-zinc-900/80 border border-zinc-700 p-4 flex justify-between items-center hover:border-red-500 transition-colors">
              <div>
                <div className="font-bold text-white">{l.name}</div>
                <div className="text-[10px] text-zinc-400 font-mono">{l.mode?.toUpperCase()} // {l.max_players} SLOTS</div>
              </div>
              <button onClick={() => handleJoin(l.id)} className="bg-red-900/50 text-red-100 px-4 py-2 text-xs font-bold border border-red-700 hover:bg-red-700">
                JOIN
              </button>
            </div>
          ))}
        </div>
      )}

      {/* SECTION 2: REGISTERED SQUADS (Crews) */}
      <h2 className="text-2xl font-black mb-4 text-cyan-500 tracking-tighter uppercase border-b border-cyan-900/50 pb-2">
        Registered Squads
      </h2>

      <div className="grid grid-cols-1 gap-3">
        {crews.map(crew => (
           <Link key={crew.id} href={`/wb/${crew.slug}`} className="block">
             <div className="bg-zinc-900/50 border border-zinc-800 p-4 flex items-center gap-4 hover:bg-zinc-800 hover:border-cyan-500/50 transition-all">
                {/* Logo/Avatar */}
                <div className="w-12 h-12 bg-black border border-zinc-700 flex-shrink-0 relative">
                   {crew.logo_url ? (
                       <img src={crew.logo_url} alt={crew.name} className="w-full h-full object-cover opacity-80" />
                   ) : (
                       <div className="w-full h-full flex items-center justify-center text-zinc-600 font-black">?</div>
                   )}
                </div>
                
                <div>
                   <div className="font-bold text-zinc-200 text-lg leading-none">{crew.name}</div>
                   <div className="text-[10px] text-cyan-600 font-mono mt-1">
                      MEMBERS: {crew.member_count} // VEHICLES: {crew.vehicle_count}
                   </div>
                </div>
             </div>
           </Link>
        ))}
      </div>

    </div>
  );
}