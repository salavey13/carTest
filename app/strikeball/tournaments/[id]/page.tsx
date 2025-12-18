"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchTournament } from "../../actions/tournament";
import { TournamentBracket } from "../../components/TournamentBracket";
import { Loading } from "@/components/Loading";
import { cn } from "@/lib/utils";
import { FaTrophy } from "react-icons/fa6";

export default function TournamentDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
      fetchTournament(id as string).then(res => setData(res));
  }, [id]);

  if (!data) return <Loading variant="bike" text="ЗАГРУЗКА СЕТКИ..." />;

  return (
    <div className="pt-28 pb-32 px-4 min-h-screen bg-transparent text-white font-orbitron overflow-x-hidden">
        
        <div className="text-center mb-8 border-b-2 border-amber-500/50 pb-6 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20">
                <FaTrophy className="text-9xl text-amber-500" />
            </div>
            <div className="text-xs font-mono text-amber-600 mb-2 tracking-[0.5em] uppercase relative z-10">
                ПРОТОКОЛ ТУРНИРА
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white uppercase relative z-10 drop-shadow-lg">
                {data.tourney.name}
            </h1>
            <div className="mt-4 flex justify-center gap-4 text-[10px] font-mono text-zinc-400">
                <span className="bg-zinc-900 px-2 py-1 rounded border border-zinc-800">STATUS: {data.tourney.status.toUpperCase()}</span>
                <span className="bg-zinc-900 px-2 py-1 rounded border border-zinc-800">FORMAT: 4X4 ELIMINATION</span>
            </div>
        </div>

        {/* The Tree */}
        <div className="overflow-x-auto pb-8 scrollbar-hide">
            <div className="min-w-[800px] flex justify-center py-10">
                <TournamentBracket matches={data.matches} />
            </div>
        </div>

        <div className="text-center text-xs font-mono text-zinc-600 mt-8 border-t border-zinc-900 pt-4">
            ВЫБЕРИТЕ МАТЧ ДЛЯ ПЕРЕХОДА В КОМАНДНЫЙ ПУНКТ
        </div>
    </div>
  );
}