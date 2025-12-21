"use client";

import { FaShareNodes, FaFilePdf, FaSpinner, FaUserShield, FaCircleCheck, FaCircleXmark } from "react-icons/fa6";
import { cn } from "@/lib/utils";

interface LobbyHeaderProps {
    name: string;
    mode: string;
    status: string;
    startAt: string | null;
    metadata: any;
    userMember: any; // Добавлен для отслеживания голоса
    isAdmin: boolean; // Добавлен для отображения прав
    onPdf: () => void;
    onShare: () => void;
    loading: boolean;
}

export function LobbyHeader({ name, mode, status, startAt, metadata, userMember, isAdmin, onPdf, onShare, loading }: LobbyHeaderProps) {
    const approval = metadata?.approval_status || 'proposed';
    const myVote = userMember?.metadata?.vote;
    
    const statusColors: any = {
        proposed: "text-amber-500 border-amber-900 bg-amber-950/20",
        approved_unpaid: "text-brand-cyan border-cyan-900 bg-cyan-950/20",
        approved_paid: "text-green-500 border-green-900 bg-green-950/20"
    };

    const statusLabels: any = {
        proposed: "НА_СОГЛАСОВАНИИ",
        approved_unpaid: "ОДОБРЕНО (ЖДЕМ ОПЛАТУ)",
        approved_paid: "ПОДТВЕРЖДЕНО И ОПЛАЧЕНО"
    };

    return (
        <div className="text-center mb-10 relative">
            <div className="absolute top-0 right-0 flex gap-3">
                <button onClick={onPdf} disabled={loading} className="p-2 border border-zinc-800 text-zinc-600 hover:text-white transition-all active:scale-95 rounded-none">
                    {loading ? <FaSpinner className="animate-spin" /> : <FaFilePdf />}
                </button>
                <button onClick={onShare} className="p-2 border border-zinc-800 text-zinc-600 hover:text-white transition-all active:scale-95 rounded-none">
                    <FaShareNodes />
                </button>
            </div>
            
            <div className="flex items-center justify-center gap-2 mb-2">
                {isAdmin && <FaUserShield className="text-brand-purple text-lg" title="Администратор операции" />}
                <h1 className="text-2xl font-black uppercase tracking-[0.2em] italic">{name}</h1>
            </div>
            
            <div className="flex flex-col items-center gap-3 mt-2">
                <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest bg-zinc-900 px-2 py-0.5">
                    {mode} // ПЛАН: {startAt ? new Date(startAt).toLocaleString('ru-RU') : "НЕ ЗАДАНО"}
                </div>
                
                {status === 'open' && (
                    <div className="flex items-center gap-4">
                        {/* Системный статус */}
                        <div className={cn("px-3 py-1 border text-[9px] font-black tracking-widest uppercase animate-pulse", statusColors[approval])}>
                            ● {statusLabels[approval]}
                        </div>

                        {/* Личный статус голоса */}
                        {myVote && (
                            <div className={cn("flex items-center gap-1.5 text-[9px] font-bold uppercase", myVote === 'ok' ? "text-green-500" : "text-red-500")}>
                                {myVote === 'ok' ? <FaCircleCheck /> : <FaCircleXmark />}
                                {myVote === 'ok' ? "Вы_ОК" : "Вы_не_можете"}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}