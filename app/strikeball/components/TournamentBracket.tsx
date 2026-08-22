"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { FaCrown, FaArrowRight } from "react-icons/fa6";
import { advanceMatch } from "../actions/tournament";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";

export const TournamentBracket = ({ matches }: { matches: any[] }) => {
    const semis = matches.filter(m => m.round === 1);
    const final = matches.find(m => m.round === 2);
    const { dbUser } = useAppContext();
    
    // Simple admin check: if you can see this page, and you are admin/organizer
    const canManage = dbUser?.role === 'admin' || dbUser?.role === 'vprAdmin';

    const handleWin = async (matchId: string, crewId: string, crewName: string) => {
        if (!confirm(`Declare ${crewName} as winner?`)) return;
        const res = await advanceMatch(matchId, crewId);
        if (res.success) {
            toast.success("Bracket Updated!");
            window.location.reload(); 
        } else {
            toast.error(res.error);
        }
    };

    const MatchCard = ({ match, isFinal }: any) => {
        if (!match) return <div className="w-56 h-32 bg-zinc-900 border border-dashed border-zinc-700 flex items-center justify-center text-zinc-600 font-mono">TBD</div>;

        const isCompleted = match.status === 'completed';

        return (
            <div className={cn(
                "w-64 bg-zinc-900 border-2 rounded-lg overflow-hidden transition-all relative group",
                isCompleted ? "border-emerald-600" : "border-zinc-700",
                isFinal && "border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
            )}>
                {/* Header Link */}
                <Link href={`/strikeball/lobbies/${match.lobby_id}`} className="block">
                    <div className="flex justify-between items-center p-2 bg-black/50 border-b border-zinc-800 hover:bg-zinc-800 transition-colors cursor-pointer">
                        <span className="text-[10px] font-mono text-zinc-500">MATCH {match.round === 2 ? "FINAL" : match.match_order + 1}</span>
                        <span className={cn("text-[9px] font-bold px-2 rounded", isCompleted ? "bg-green-900 text-green-400" : "bg-zinc-800 text-zinc-400")}>
                            {match.status?.toUpperCase() || 'PENDING'}
                        </span>
                        <FaArrowRight className="text-zinc-600 w-3 h-3" />
                    </div>
                </Link>
                
                {/* Team 1 */}
                <div className={cn("p-3 flex justify-between items-center", match.winner_crew_id === match.crew1_id && "bg-emerald-900/20")}>
                    <span className={cn("font-bold text-sm truncate", match.crew1 ? "text-white" : "text-zinc-600")}>
                        {match.crew1?.name || "TBD"}
                    </span>
                    {match.crew1 && !isCompleted && canManage && (
                        <button onClick={() => handleWin(match.id, match.crew1_id, match.crew1.name)} className="text-zinc-600 hover:text-amber-500 transition-colors" title="Advance">
                            <FaCrown />
                        </button>
                    )}
                    {match.winner_crew_id === match.crew1_id && <span className="text-emerald-500"><FaCrown/></span>}
                </div>

                <div className="h-px bg-zinc-800 mx-2" />

                {/* Team 2 */}
                <div className={cn("p-3 flex justify-between items-center", match.winner_crew_id === match.crew2_id && "bg-emerald-900/20")}>
                    <span className={cn("font-bold text-sm truncate", match.crew2 ? "text-white" : "text-zinc-600")}>
                        {match.crew2?.name || "TBD"}
                    </span>
                    {match.crew2 && !isCompleted && canManage && (
                        <button onClick={() => handleWin(match.id, match.crew2_id, match.crew2.name)} className="text-zinc-600 hover:text-amber-500 transition-colors" title="Advance">
                            <FaCrown />
                        </button>
                    )}
                    {match.winner_crew_id === match.crew2_id && <span className="text-emerald-500"><FaCrown/></span>}
                </div>
            </div>
        );
    };

    return (
        <div className="flex justify-center items-center gap-12 py-10 overflow-x-auto">
            
            {/* Round 1 (Semis) */}
            <div className="flex flex-col gap-16">
                {semis.map(m => (
                    <MatchCard key={m.id} match={m} />
                ))}
            </div>

            {/* Connectors */}
            <div className="flex flex-col justify-center h-full gap-4">
                 {/* Visual connectors could go here, simplified for now */}
                 <div className="text-zinc-700 font-black text-2xl">&gt;</div>
            </div>

            {/* Round 2 (Final) */}
            <div>
                 <MatchCard match={final} isFinal />
            </div>

        </div>
    );
};