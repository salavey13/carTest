"use client";

import React, { useMemo } from "react";
import { voteForLobbyDate } from "../../../actions/lobby";
import { toast } from "sonner";
import { FaCircleCheck, FaCircleXmark, FaHourglassHalf, FaUserShield } from "react-icons/fa6";
import { cn } from "@/lib/utils";

interface PlanningPanelProps {
    lobby: any;
    userMember: any;
    dbUser: any;
    loadData?: () => void;
}

export function PlanningPanel({ lobby, userMember, dbUser, loadData }: PlanningPanelProps) {
    const currentVote = userMember?.metadata?.vote;
    const currentUserId = dbUser?.user_id;

    // Determine if current user is the OWNER of the selected PROVIDER
    // Note: We check lobby.provider_id. If user owns the crew with that ID, they can approve.
    const isProviderOwner = useMemo(() => {
        const providerId = lobby?.provider_id;
        // For now, we rely on context or just check if user is in a 'provider' role if available,
        // BUT strictly: If user is the owner of the crew `lobby.provider_id`, they can approve.
        // We don't have 'crew' info here directly, so we assume a simplified check or passed props.
        // For this implementation, we assume if `lobby.provider_id` is set, we need a way to verify ownership.
        // Since `dbUser` is passed, we can't query server.
        // We will add a visual cue that requires the user to be a provider.
        // *Improvement:* If you pass `isOwnerOfProvider` prop down the line, we can lock the button securely.
        // For now, let's assume if `provider_id` is set, *someone* with ID `currentUserId` *should* be able to approve.
        return !!providerId; 
    }, [lobby?.provider_id, currentUserId]);

    const handleVote = async (vote: 'ok' | 'not_ok') => {
        if (!currentUserId) return toast.error("ТРЕБУЕТСЯ АВТОРИЗАЦИЯ");
        
        const res = await voteForLobbyDate(lobby.id, currentUserId, vote);
        if (res.success) {
            toast.success(vote === 'ok' ? "ГОТОВНОСТЬ ПОДТВЕРЖДЕНА" : "ОТКАЗ ЗАРЕГИСТРИРОВАН");
            loadData(); // Синхронизация стейта
        } else {
            toast.error(res.error);
        }
    };

    if (!lobby.start_at) return null;

    // Priority Check: If there is a Provider Proposal to approve, show those controls. 
    // Otherwise show standard planning controls.
    // NOTE: Provider Approval is handled in CommandConsole now.
    const hasProviderProposal = lobby.approval_status === 'proposed';
    const canManageProvider = isProviderOwner && hasProviderProposal;

    return (
        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-none mb-6 relative overflow-hidden">
            {/* Декоративный фон для фазы планирования */}
            <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-cyan to-transparent" />
            
            {/* CASE 1: STANDARD PLANNING (VOTING) */}
            {/* NOTE: Provider approval is now in CommandConsole. This panel focuses on User/Member voting. */}
            <div className="relative z-10">
                <h4 className="text-[10px] font-mono text-zinc-500 mb-4 uppercase tracking-widest text-center italic">
                     Подтвердите готовность на: <br/>
                    <span className="text-white not-italic text-sm">
                        {new Date(lobby.start_at).toLocaleString('ru-RU', { 
                            day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' 
                        })}
                    </span>
                </h4>
                
                <div className="grid grid-cols-2 gap-2 relative z-10">
                    <button 
                        onClick={() => handleVote('ok')}
                        className={cn(
                            "py-3 font-black text-[10px] transition-all border uppercase tracking-tighter",
                            currentVote === 'ok' 
                                ? "bg-green-600 border-white text-black shadow-[0_0_15px_rgba(34,197,94,0.4)]" 
                                : "bg-black border-zinc-800 text-green-500 hover:border-green-500"
                        )}
                    >
                        {/* FIXED ICON */}
                        <FaCircleCheck /> Я_В_ДЕЛЕ [OK]
                    </button>
                    <button 
                        onClick={() => handleVote('not_ok')}
                        className={cn(
                            "py-3 font-black text-[10px] transition-all border uppercase tracking-tighter",
                            currentVote === 'not_ok' 
                                ? "bg-red-600 border-white text-black shadow-[0_0_15px_rgba(220,38,38,0.4)]" 
                                : "bg-black border-zinc-800 text-red-500 hover:border-red-500"
                        )}
                    >
                        <FaCircleXmark /> НЕ_СМОГУ
                    </button>
                </div>
            </div>
        </div>
    );
}