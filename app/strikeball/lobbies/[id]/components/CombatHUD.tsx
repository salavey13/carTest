"use client";

import { DominationHUD } from "../../../components/DominationHUD";
import { LiveHUD } from "../../../components/LiveHUD";
import { CommandConsole } from "../../../components/CommandConsole";
import { AdminCheckpointPanel } from "../../../components/AdminCheckpointPanel";
import { voteForLobbyDate } from "../../../actions/lobby";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// --- Вспомогательный компонент планирования ---
function PlanningPanel({ lobby, userMember, dbUser, loadData }: any) {
    const currentVote = userMember?.metadata?.vote;

    const handleVote = async (vote: 'ok' | 'not_ok') => {
        if (!dbUser?.user_id) return toast.error("ТРЕБУЕТСЯ_АВТОРИЗАЦИЯ");
        
        const res = await voteForLobbyDate(lobby.id, dbUser.user_id, vote);
        if (res.success) {
            toast.success(vote === 'ok' ? "ГОТОВНОСТЬ_ПОДТВЕРЖДЕНА" : "ОТКАЗ_ЗАРЕГИСТРИРОВАН");
            loadData(); // Синхронизация стейта
        } else {
            toast.error(res.error);
        }
    };

    if (!lobby.start_at) return null;

    return (
        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-none mb-6 relative overflow-hidden">
            {/* Декоративный фон для фазы планирования */}
            <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-cyan to-transparent" />
            
            <h4 className="text-[10px] font-mono text-zinc-500 mb-4 uppercase tracking-widest text-center italic relative z-10">
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
                    Я_В_ДЕЛЕ [OK]
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
                    НЕ_СМОГУ
                </button>
            </div>
        </div>
    );
}

// --- Основной компонент CombatHUD ---
export function CombatHUD({ lobby, isOwner, members, loadData, dbUser, isAdmin }: any) {
    // Находим членство текущего пользователя
    const userMember = members?.find((m: any) => m.user_id === dbUser?.user_id);

    // Determine if this user is a "Commander" (Owner or App Admin)
    const isCommander = isOwner || isAdmin;

    return (
        <div className="space-y-4">
            {/* Панель планирования показывается только в статусе 'open' */}
            {lobby.status === 'open' && (
                <PlanningPanel 
                    lobby={lobby} 
                    userMember={userMember} 
                    dbUser={dbUser} 
                    loadData={loadData} 
                />
            )}

            {/* Телеметрия боя / Обратный отсчет */}
            <DominationHUD lobbyId={lobby.id} />
            <LiveHUD 
                startTime={lobby.status === 'active' ? lobby.metadata?.actual_start_at : lobby.start_at} 
                score={lobby.metadata?.score || {red:0, blue:0}} 
                status={lobby.status}
            />

            {/* Консоль командира (Владелец или Админ системы) */}
            {isCommander && (
                <div className="space-y-4 pt-10 border-t border-zinc-900">
                    <CommandConsole 
                        lobbyId={lobby.id} 
                        userId={dbUser!.user_id} 
                        status={lobby.status} 
                        score={lobby.metadata?.score || {red:0, blue:0}} 
                        lobby={lobby}
                        isAdmin={isAdmin}
                        onLoad={loadData}
                    />
                    <AdminCheckpointPanel lobbyId={lobby.id} onLoad={loadData} />
                </div>
            )}
        </div>
    );
}