"use client";

import React, { useEffect, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { getOpenLobbies, joinLobby, getUserActiveLobbies } from "../actions/lobby";
import { getAllPublicCrews } from "@/app/rentals/actions"; 
import { toast } from "sonner";
import Link from "next/link";
import { FaUsers, FaSkull, FaDoorOpen, FaShieldHalved } from "react-icons/fa6";
import { cn } from "@/lib/utils";

type Lobby = {
  id: string;
  name: string;
  mode?: string;
  max_players?: number;
  created_at?: string;
  start_at?: string;
  host_crew?: { id: string, name: string, logo_url: string, slug: string } | null;
};

export default function LobbiesPageClient() {
  const { dbUser } = useAppContext();
  const userId = dbUser?.user_id ?? null;
  
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [crews, setCrews] = useState<any[]>([]); 
  const [myLobbies, setMyLobbies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [lobbyRes, crewRes, myLobbiesRes] = await Promise.all([
        getOpenLobbies(),
        getAllPublicCrews(),
        userId ? getUserActiveLobbies(userId) : { success: true, data: [] }
      ]);

      if (lobbyRes.success) setLobbies(lobbyRes.data || []);
      if (crewRes.success) setCrews(crewRes.data || []);
      if (myLobbiesRes.success) setMyLobbies(myLobbiesRes.data || []);
      
    } catch (e) {
      toast.error("Связь потеряна: " + ((e as Error).message));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [userId]);

  const handleJoin = async (e: React.MouseEvent, lobbyId: string) => {
    e.preventDefault(); 
    e.stopPropagation();
    if (!userId) return toast.error("ТРЕБУЕТСЯ ВХОД");
    const res = await joinLobby(userId, lobbyId);
    if (!res.success) toast.error(res.error);
    else {
        toast.success(res.message);
        setMyLobbies(prev => [...prev, lobbyId]);
    }
  };

  return (
    <div className="pt-28 pb-32 px-4 min-h-screen bg-transparent text-white font-orbitron">
      
      {/* SECTION 1: LIVE OPERATIONS */}
      <h2 className="text-2xl font-black mb-4 text-red-600 tracking-tighter uppercase border-b-2 border-red-900/50 pb-2 flex items-center gap-2">
        <span className="animate-pulse">●</span> Активные Операции
      </h2>
      
      {loading ? (
        <div className="py-8 font-mono text-red-500/50 text-sm animate-pulse">СКАНИРОВАНИЕ ЧАСТОТ...</div>
      ) : (
        <div className="space-y-3 mb-10">
          {lobbies.length === 0 && <div className="text-zinc-600 text-xs font-mono border border-dashed border-zinc-800 p-4">НЕТ АКТИВНЫХ БОЕВ.</div>}
          
          {lobbies.map(l => {
            const isMember = myLobbies.includes(l.id);
            const isCrewHosted = !!l.host_crew;
            
            return (
            <Link key={l.id} href={`/strikeball/lobbies/${l.id}`} className="block group">
              <div className={cn(
                  "bg-zinc-900/90 border border-zinc-700 p-4 flex justify-between items-center transition-colors shadow-lg relative overflow-hidden",
                  isMember ? "hover:border-emerald-500" : "hover:border-red-500 hover:bg-zinc-800"
              )}>
                {/* Crew Hosted Badge */}
                {isCrewHosted && (
                    <div className="absolute top-0 right-0 bg-cyan-900/80 text-cyan-200 text-[9px] font-bold px-2 py-0.5 flex items-center gap-1 z-10 border-l border-b border-cyan-700">
                        <FaShieldHalved size={8} /> {l.host_crew?.name}
                    </div>
                )}

                <div className={cn("absolute left-0 top-0 bottom-0 w-1 opacity-0 group-hover:opacity-100 transition-opacity", isMember ? "bg-emerald-500" : "bg-red-600")} />
                
                <div className="flex-1">
                  <div className={cn("font-bold text-lg leading-none transition-colors mb-1", isMember ? "text-emerald-400 group-hover:text-emerald-300" : "text-white group-hover:text-red-400")}>
                    {l.name}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-2">
                     <span className="bg-zinc-800 px-1.5 py-0.5 rounded">{l.mode?.toUpperCase()}</span>
                     <span>{l.max_players} МЕСТ</span>
                     <span className={cn(l.start_at ? "text-amber-500" : "text-green-500")}>
                        {l.start_at ? new Date(l.start_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'СЕЙЧАС'}
                     </span>
                  </div>
                </div>
                
                {isMember ? (
                    <div className="bg-emerald-900/50 text-emerald-100 px-4 py-2 text-xs font-black border border-emerald-600 flex items-center gap-2">
                        ВХОД <FaDoorOpen />
                    </div>
                ) : (
                    <button onClick={(e) => handleJoin(e, l.id)} className="bg-red-900/50 text-red-100 px-4 py-2 text-xs font-black border border-red-600 hover:bg-red-600 transition-all active:scale-95 z-10">
                    ВСТУПИТЬ
                    </button>
                )}
              </div>
            </Link>
          )})}
        </div>
      )}

      {/* SECTION 2: REGISTERED SQUADS */}
      <h2 className="text-2xl font-black mb-4 text-cyan-500 tracking-tighter uppercase border-b-2 border-cyan-900/50 pb-2 flex items-center gap-2">
        <FaUsers /> Постоянные Отряды
      </h2>

      <div className="grid grid-cols-1 gap-3">
        {crews.map(crew => (
           <Link key={crew.id} href={`/crews/${crew.slug}`} className="block group">
             <div className="bg-zinc-900/80 border border-zinc-800 p-3 flex items-center gap-4 hover:bg-zinc-800 hover:border-cyan-500 transition-all">
                <div className="w-14 h-14 bg-black border border-zinc-700 flex-shrink-0 relative overflow-hidden">
                   {crew.logo_url ? (
                       <img src={crew.logo_url} alt={crew.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 grayscale group-hover:grayscale-0 transition-all" />
                   ) : (
                       <div className="w-full h-full flex items-center justify-center text-zinc-700 font-black text-2xl">?</div>
                   )}
                </div>
                <div className="flex-1">
                   <div className="font-bold text-zinc-200 text-lg leading-none group-hover:text-cyan-400 transition-colors">{crew.name}</div>
                   <div className="text-[9px] text-zinc-500 font-mono mt-1 flex gap-2">
                      <span className="bg-zinc-950 px-1 rounded text-cyan-600">БОЙЦЫ: {crew.member_count}</span>
                      <span className="bg-zinc-950 px-1 rounded text-amber-600">ТЕХНИКА: {crew.vehicle_count}</span>
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