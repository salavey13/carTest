"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchTournament } from "../../actions/tournament";
import { TournamentBracket } from "../../components/TournamentBracket";
import { Loading } from "@/components/Loading";

export default function TournamentDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
      fetchTournament(id as string).then(res => setData(res));
  }, [id]);

  if (!data) return <Loading variant="bike" text="LOADING BRACKET..." />;

  return (
    <div className="pt-28 pb-32 px-4 min-h-screen bg-transparent text-white font-orbitron overflow-x-hidden">
        
        <div className="text-center mb-8">
            <div className="text-xs font-mono text-amber-600 mb-1 tracking-widest">TOURNAMENT PROTOCOL</div>
            <h1 className="text-3xl font-black text-white uppercase">{data.tourney.name}</h1>
        </div>

        {/* The Tree */}
        <div className="overflow-x-auto pb-8">
            <div className="min-w-[600px] flex justify-center">
                <TournamentBracket matches={data.matches} />
            </div>
        </div>

        <div className="text-center text-xs font-mono text-zinc-600 mt-8">
            Select a match to enter the Command Lobby.
        </div>
    </div>
  );
}