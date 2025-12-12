"use client";

import React, { useEffect, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { getOpenLobbies, joinLobby } from "../actions";
import { getAllPublicCrews } from "@/app/rentals/actions"; 
import { toast } from "sonner";
import Link from "next/link";
import { FaUsers, FaSkull } from "react-icons/fa6";

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
  const [crews, setCrews] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
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

  const handleJoin = async (e: React.MouseEvent, lobbyId: string) => {
    e.preventDefault(); // Prevent navigation when clicking the Join button
    e.stopPropagation();
    
    if (!userId) return toast.error("LOGIN REQUIRED");
    const res = await joinLobby(userId, lobbyId);
    if (!res.success) toast.error(res.error);
    else toast.success("DEPLOYED!");
  };

  return (
    <div className="pt-28 pb-32 px-4 min-h-screen bg-transparent text-white font-orbitron">
      
      {/* SECTION 1: LIVE OPERATIONS (Lobbies) */}
      <h2 className="text-2xl font-black mb-4 text-red-600 tracking-tighter uppercase border-b-2 border-red-900/50 pb-2 flex items-center gap-2">
        <span className="animate-pulse">●</span> Live Operations
      </h2>
      
      {loading ? (
        <div className="py-8 font-mono text-red-500/50 text-sm animate-pulse">SCANNING FREQUENCIES...</div>
      ) : (
        <div className="space-y-3 mb-10">
          {lobbies.length === 0 && <div className="text-zinc-600 text-xs font-mono border border-dashed border-zinc-800 p-4">NO ACTIVE SKIRMISHES DETECTED.</div>}
          
          {lobbies.map(l => (
            <Link key={l.id} href={`/strikeball/lobbies/${l.id}`} className="block group">
              <div className="bg-zinc-900/90 border border-zinc-700 p-4 flex justify-between items-center hover:border-red-500 hover:bg-zinc-800 transition-colors shadow-lg relative overflow-hidden">
                
                {/* Hover Effect Bar */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div>
                  <div className="font-bold text-white text-lg leading-none group-hover:text-red-400 transition-colors">{l.name}</div>
                  <div className="text-[10px] text-zinc-400 font-mono mt-1">
                    {l.mode?.toUpperCase()} // {l.max_players} SLOTS // {l.start_at ? new Date(l.start_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'NOW'}
                  </div>
                </div>
                
                <button 
                  onClick={(e) => handleJoin(e, l.id)} 
                  className="bg-red-900/50 text-red-100 px-5 py-2 text-sm font-black border border-red-600 hover:bg-red-600 transition-all active:scale-95 z-10"
                >
                  JOIN
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* SECTION 2: REGISTERED SQUADS (Crews) */}
      <h2 className="text-2xl font-black mb-4 text-cyan-500 tracking-tighter uppercase border-b-2 border-cyan-900/50 pb-2 flex items-center gap-2">
        <FaUsers /> Registered Squads
      </h2>

      <div className="grid grid-cols-1 gap-3">
        {loading && crews.length === 0 && <div className="py-4 text-xs font-mono text-cyan-500/50">RETRIEVING DATABASE...</div>}
        
        {!loading && crews.length === 0 && <div className="text-zinc-600 text-xs font-mono border border-dashed border-zinc-800 p-4">NO SQUADS REGISTERED.</div>}

        {crews.map(crew => (
           <Link key={crew.id} href={`/wb/${crew.slug}`} className="block group">
             <div className="bg-zinc-900/80 border border-zinc-800 p-3 flex items-center gap-4 hover:bg-zinc-800 hover:border-cyan-500 transition-all">
                {/* Logo/Avatar */}
                <div className="w-14 h-14 bg-black border border-zinc-700 flex-shrink-0 relative overflow-hidden">
                   {crew.logo_url ? (
                       <img src={crew.logo_url} alt={crew.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0" />
                   ) : (
                       <div className="w-full h-full flex items-center justify-center text-zinc-700 font-black text-2xl">?</div>
                   )}
                </div>
                
                <div className="flex-1">
                   <div className="font-bold text-zinc-200 text-lg leading-none group-hover:text-cyan-400 transition-colors">{crew.name}</div>
                   <div className="text-[9px] text-zinc-500 font-mono mt-1 flex gap-2">
                      <span className="bg-zinc-950 px-1 rounded text-cyan-600">MEMBERS: {crew.member_count}</span>
                      <span className="bg-zinc-950 px-1 rounded text-amber-600">FLEET: {crew.vehicle_count}</span>
                   </div>
                </div>
                
                <div className="text-zinc-700 group-hover:text-cyan-500">
                    <FaSkull />
                </div>
             </div>
           </Link>
        ))}
      </div>

    </div>
  );
}