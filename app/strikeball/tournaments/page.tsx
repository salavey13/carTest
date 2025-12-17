"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseAnon } from "@/hooks/supabase";
import { FaTrophy, FaPlus } from "react-icons/fa6";
import { useAppContext } from "@/contexts/AppContext";
import { createTournament } from "../actions/tournament";
import { getAllPublicCrews } from "@/app/rentals/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function TournamentsPage() {
  const { dbUser, isAdmin } = useAppContext();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [crews, setCrews] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedCrews, setSelectedCrews] = useState<string[]>([]);
  const [tourneyName, setTourneyName] = useState("");

  useEffect(() => {
    const load = async () => {
        const { data } = await supabaseAnon.from("tournaments").select("*").order("created_at", { ascending: false });
        setTournaments(data || []);
        
        const crewRes = await getAllPublicCrews();
        if(crewRes.success) setCrews(crewRes.data || []);
    };
    load();
  }, []);

  const handleCreate = async () => {
      if (!dbUser?.user_id) return;
      if (selectedCrews.length !== 4) return toast.error("Select exactly 4 crews for MVP");
      
      const res = await createTournament(dbUser.user_id, tourneyName, selectedCrews);
      if (res.success) {
          toast.success("Tournament Bracket Generated!");
          window.location.reload(); // Lazy reload
      } else {
          toast.error(res.error);
      }
  };

  const toggleCrewSelection = (id: string) => {
      if (selectedCrews.includes(id)) setSelectedCrews(prev => prev.filter(c => c !== id));
      else {
          if (selectedCrews.length >= 4) return;
          setSelectedCrews(prev => [...prev, id]);
      }
  };

  return (
    <div className="pt-28 pb-32 px-4 min-h-screen bg-transparent text-white font-orbitron">
        
        <div className="text-center mb-8 border-b-2 border-amber-500/50 pb-4">
            <h1 className="text-4xl font-black text-amber-500 tracking-tighter drop-shadow-lg">IRON LEAGUE</h1>
            <p className="text-xs font-mono text-zinc-500 tracking-[0.5em] mt-2">OFFICIAL TOURNAMENT BRACKETS</p>
        </div>

        {/* LIST */}
        <div className="space-y-4">
            {tournaments.map(t => (
                <Link key={t.id} href={`/strikeball/tournaments/${t.id}`} className="block group">
                    <div className="bg-zinc-900/80 border border-zinc-700 p-6 flex justify-between items-center hover:border-amber-500 transition-all hover:scale-[1.02]">
                        <div>
                            <div className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">{t.name}</div>
                            <div className="text-xs font-mono text-zinc-500 mt-1">Status: {t.status.toUpperCase()}</div>
                        </div>
                        <FaTrophy className="text-3xl text-zinc-700 group-hover:text-amber-500 transition-colors" />
                    </div>
                </Link>
            ))}
        </div>

        {/* CREATE (Admin Only) */}
        {dbUser && ( // Ideally check isAdmin()
            <div className="mt-12 border-t border-zinc-800 pt-8">
                <button onClick={() => setIsCreating(!isCreating)} className="w-full py-4 border-2 border-dashed border-zinc-700 text-zinc-500 hover:text-white hover:border-white transition-colors uppercase font-bold flex items-center justify-center gap-2">
                    <FaPlus /> Initialize Tournament
                </button>

                {isCreating && (
                    <div className="mt-6 bg-zinc-900 p-4 border border-zinc-700">
                        <input className="w-full bg-black border border-zinc-700 p-2 mb-4 text-white" placeholder="Tournament Name" value={tourneyName} onChange={e => setTourneyName(e.target.value)} />
                        
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            {crews.map(c => (
                                <div 
                                    key={c.id} 
                                    onClick={() => toggleCrewSelection(c.id)}
                                    className={cn("p-2 border cursor-pointer text-xs font-bold", selectedCrews.includes(c.id) ? "bg-amber-900/50 border-amber-500 text-amber-100" : "bg-black border-zinc-800 text-zinc-500")}
                                >
                                    {c.name}
                                </div>
                            ))}
                        </div>
                        
                        <button onClick={handleCreate} className="w-full bg-amber-600 text-black font-black py-3 hover:bg-amber-500">GENERATE BRACKET</button>
                    </div>
                )}
            </div>
        )}
    </div>
  );
}