"use client";

import { FaShareNodes, FaFilePdf, FaSpinner } from "react-icons/fa6";
import { cn } from "@/lib/utils";

interface LobbyHeaderProps {
    name: string;
    mode: string;
    status: string;
    startAt: string | null;
    metadata: any; // Добавлено
    onPdf: () => void;
    onShare: () => void;
    loading: boolean;
}

export function LobbyHeader({ name, mode, status, startAt, metadata, onPdf, onShare, loading }: LobbyHeaderProps) {
    // Безопасное получение статуса согласования
    const approval = metadata?.approval_status || 'proposed';
    
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
                <button 
                    onClick={onPdf} 
                    disabled={loading} 
                    className="p-2 border border-zinc-800 text-zinc-600 hover:text-white transition-all active:scale-95"
                >
                    {loading ? <FaSpinner className="animate-spin" /> : <FaFilePdf />}
                </button>
                <button 
                    onClick={onShare} 
                    className="p-2 border border-zinc-800 text-zinc-600 hover:text-white transition-all active:scale-95"
                >
                    <FaShareNodes />
                </button>
            </div>
            
            <h1 className="text-2xl font-black uppercase tracking-[0.2em]">{name}</h1>
            
            <div className="flex flex-col items-center gap-2 mt-2">
                <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                    {mode} // ПЛАН: {startAt ? new Date(startAt).toLocaleString('ru-RU') : "НЕ ЗАДАНО"}
                </div>
                
                {status === 'open' && (
                    <div className={cn(
                        "px-3 py-1 border text-[9px] font-black tracking-widest uppercase animate-pulse transition-colors duration-500", 
                        statusColors[approval]
                    )}>
                        ● {statusLabels[approval]}
                    </div>
                )}
            </div>
        </div>
    );
}