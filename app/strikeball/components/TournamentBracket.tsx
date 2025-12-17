"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

// Simple 4-team visualizer
export const TournamentBracket = ({ matches }: { matches: any[] }) => {
    const semis = matches.filter(m => m.round === 1);
    const final = matches.find(m => m.round === 2);

    return (
        <div className="flex justify-center items-center gap-8 py-10 overflow-x-auto">
            
            {/* Round 1 (Semis) */}
            <div className="flex flex-col gap-12">
                {semis.map(m => (
                    <MatchCard key={m.id} match={m} />
                ))}
            </div>

            {/* Connectors */}
            <div className="flex flex-col justify-around h-full">
                 <div className="border-r-2 border-t-2 border-b-2 border-red-500 w-8 h-32" />
            </div>

            {/* Round 2 (Final) */}
            <div>
                 <MatchCard match={final} isFinal />
            </div>

        </div>
    );
};

const MatchCard = ({ match, isFinal }: any) => {
    if (!match) return <div className="w-48 h-24 bg-zinc-900 border border-dashed border-zinc-700 flex items-center justify-center text-zinc-600 font-mono">TBD</div>;

    const winnerId = match.lobby?.winner === 'blue' ? match.crew1_id : (match.lobby?.winner === 'red' ? match.crew2_id : null);

    return (
        <Link href={`/strikeball/lobbies/${match.lobby_id}`} className="block">
            <div className={cn(
                "w-56 bg-zinc-900 border-2 rounded-lg overflow-hidden transition-all hover:scale-105",
                match.status === 'completed' ? "border-emerald-600" : "border-zinc-700 hover:border-red-500",
                isFinal && "border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
            )}>
                <div className="flex justify-between items-center p-2 bg-black/50 border-b border-zinc-800">
                    <span className="text-[10px] font-mono text-zinc-500">MATCH {match.match_order + 1}</span>
                    <span className={cn("text-[9px] font-bold px-2 rounded", match.status === 'completed' ? "bg-green-900 text-green-400" : "bg-zinc-800 text-zinc-400")}>
                        {match.status?.toUpperCase() || 'PENDING'}
                    </span>
                </div>
                
                {/* Team 1 */}
                <div className={cn("p-3 flex justify-between", winnerId === match.crew1_id && "bg-emerald-900/20")}>
                    <span className={cn("font-bold", match.crew1 ? "text-white" : "text-zinc-600")}>
                        {match.crew1?.name || "TBD"}
                    </span>
                    {winnerId === match.crew1_id && <span className="text-emerald-500">🏆</span>}
                </div>

                <div className="h-px bg-zinc-800 mx-2" />

                {/* Team 2 */}
                <div className={cn("p-3 flex justify-between", winnerId === match.crew2_id && "bg-emerald-900/20")}>
                    <span className={cn("font-bold", match.crew2 ? "text-white" : "text-zinc-600")}>
                        {match.crew2?.name || "TBD"}
                    </span>
                    {winnerId === match.crew2_id && <span className="text-emerald-500">🏆</span>}
                </div>
            </div>
        </Link>
    );
};