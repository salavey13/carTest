"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaShareNodes, FaFilePdf, FaSpinner, FaUserShield, FaCircleCheck, FaCircleXmark, FaPenToSquare, FaHourglassHalf, FaCrosshairs, FaStopwatch } from 'react-icons/fa6';
import { cn } from "@/lib/utils";
import { useAppContext } from "@/contexts/AppContext";
import { CreateLobbyForm } from "../../../components/CreateLobbyForm";
import { editLobby } from "../../actions/lobby";
import { approveProviderForLobby, rejectProviderForLobby } from "../../actions/providers"; // NEW IMPORT
import { toast } from 'sonner';

interface LobbyHeaderProps {
    name: string;
    mode: string;
    id: string;
    status: string;
    startAt: string | null;
    metadata: any;
    userMember: any; 
    isAdmin: boolean; 
    onPdf: () => void;
    onShare: () => void;
    loading: boolean;
    loadData?: () => void;
}

export function LobbyHeader({ name, mode, id, status, startAt, metadata, userMember, isAdmin, onPdf, onShare, loading, loadData }: LobbyHeaderProps) {
    const { userCrewInfo, dbUser } = useAppContext();
    const [isEditing, setIsEditing] = useState(false);
    const [isActionBusy, setIsActionBusy] = useState(false); // For approval/reject loading states

    // Determine if current user is the Owner of the Provider Crew
    // We check if the user's crew ID matches the lobby's provider ID
    const isProviderOwner = userCrewInfo?.id === metadata?.provider_id;

    // --- STATUS LOGIC ---
    const getApprovalStatus = () => metadata?.approval_status || 'proposed';
    const isProposalPending = status === 'open' && getApprovalStatus() === 'proposed';
    const isApproved = getApprovalStatus() === 'approved';
    const isRejected = getApprovalStatus() === 'rejected';

    const getStatusBadge = () => {
        if (isProposalPending) return { label: "ОТПРАВЛЕНО ПРОВАЙДЕРУ", colorClass: "text-amber-500 border-amber-900 bg-amber-950/20" };
        if (isApproved) return { label: "ПРОВАЙДЕР ОДОБРЕН", colorClass: "text-green-500 border-green-900 bg-green-950/20" };
        if (isRejected) return { label: "КОНТРАКТ РАЗОРВАН", colorClass: "text-red-500 border-red-900 bg-red-950/20" };
        return null;
    };

    // --- HANDLERS ---
    const handleEditSuccess = async (data: any) => {
        setIsEditing(false);
        toast.success("ОПЕРАЦИЯ ОБНОВЛЕНА");
        if (loadData) loadData();
    };

    const handleApprove = async () => {
        if (!dbUser?.user_id) return toast.error("ТРЕБУЕТСЯ АВТОРИЗАЦИЯ");
        if (!confirm("Вы принимаете ответственность за оборудование и поле. Утвердить предложение?")) return;
        
        setIsActionBusy(true);
        const res = await approveProviderForLobby(id, metadata.provider_id, dbUser.user_id);
        
        setIsActionBusy(false);
        if (res.success) {
            toast.success("ПРЕДЛОЖЕНИЕ ПРИНЯТО", {
                description: "Владелец лобби уведомлен."
            });
            loadData();
        } else {
            toast.error("Ошибка утверждения", { description: res.error });
        }
    };

    const handleReject = async () => {
        if (!dbUser?.user_id) return toast.error("ТРЕБУЕТСЯ АВТОРИЗАЦИЯ");
        if (!confirm("Вы уверены, что хотите отклонить предложение?")) return;

        setIsActionBusy(true);
        const res = await rejectProviderForLobby(id, metadata.provider_id, dbUser.user_id);
        
        setIsActionBusy(false);
        if (res.success) {
            toast.info("ПРЕДЛОЖЕНИЕ ОТКЛОНЕНО", {
                description: "Вы можете выбрать другого провайдера."
            });
            loadData();
        } else {
            toast.error("Ошибка отмены", { description: res.error });
        }
    };

    // --- RENDER ---
    const statusBadge = getStatusBadge();

    return (
        <div className="text-center mb-10 relative">
            {/* EDIT MODAL OVERLAY */}
            <AnimatePresence>
                {isEditing && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        onClick={() => setIsEditing(false)}
                        className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md"
                    >
                        <div className="bg-zinc-900 p-6 rounded-none border-4 border-brand-cyan shadow-[0_0_50px_rgba(220,38,38,0.5)] max-w-md w-full overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                             <h3 className="text-brand-cyan font-orbitron font-bold text-center text-xl mb-4 tracking-widest uppercase">РЕДАКТИРОВАНИЕ</h3>
                             
                             <CreateLobbyForm 
                                 isEdit={true}
                                 initialData={{
                                     id,
                                     name,
                                     mode,
                                     start_at: startAt,
                                     max_players: 0, 
                                     field_id: "",
                                     metadata: metadata,
                                     crew_id: undefined
                                 }}
                                 onSubmit={handleEditSuccess}
                             />
                             
                             <button onClick={() => setIsEditing(false)} className="w-full bg-zinc-700 hover:bg-zinc-600 text-white py-3 font-black font-orbitron uppercase tracking-wider transition-colors rounded-none mt-4">
                                 ОТМЕНА
                             </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ACTION BUTTONS (Top Right) */}
            <div className="absolute top-0 right-0 flex gap-3">
                {/* PDF Button */}
                <button onClick={onPdf} disabled={loading} className="p-2 border border-zinc-800 text-zinc-600 hover:text-white transition-all active:scale-95 rounded-none">
                    {loading ? <FaSpinner className="animate-spin" /> : <FaFilePdf />}
                </button>
                
                {/* Edit Button - Show only if owner or admin */}
                {(isAdmin || (isProviderOwner && isProposalPending)) && (
                    <button onClick={() => setIsEditing(true)} className="p-2 border border-zinc-800 text-zinc-600 hover:text-brand-cyan transition-all active:scale-95 rounded-none">
                        <FaPenToSquare />
                    </button>
                )}
                
                {/* Share Button */}
                <button onClick={onShare} className="p-2 border border-zinc-800 text-zinc-600 hover:text-white transition-all active:scale-95 rounded-none">
                    <FaShareNodes />
                </button>
            </div>
            
            {/* MISSION TITLE & STATUS BADGE */}
            <div className="flex flex-col items-center gap-2">
                <h1 className="text-2xl font-black uppercase tracking-[0.2em] italic">
                    {name} <span className="text-red-600">{mode}</span>
                </h1>
                
                {/* STATUS BADGE */}
                {statusBadge && (
                    <div className={cn("px-3 py-1 border text-[9px] font-black uppercase tracking-widest rounded-none shadow-sm", statusBadge.colorClass)}>
                        ● {statusBadge.label}
                    </div>
                )}
            </div>
            
            {/* DATE INFO */}
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                ПЛАН: {startAt ? new Date(startAt).toLocaleString('ru-RU') : "НЕ ЗАДАНО"}
            </div>

            {/* DESCRIPTION */}
            {metadata?.description && (
                 <p className="text-[11px] text-zinc-300 leading-relaxed px-4 py-3 border-y border-zinc-800/50 max-w-md mx-auto">
                    {metadata.description}
                 </p>
            )}

            {/* PROVIDER CONTROLS (Header Area - Only if Provider Owner) */}
            {/* Rendered in the header area for visibility */}
            {isProviderOwner && isProposalPending && (
                <div className="mt-4 p-4 bg-zinc-900/20 border border-zinc-800 rounded-none">
                    <div className="flex items-center justify-center gap-4">
                        <h4 className="text-[10px] text-brand-cyan font-bold uppercase tracking-widest">
                            УПРАВЛЕНИЕ ПРОВАЙДЕРУ
                        </h4>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleApprove}
                                disabled={isActionBusy || isApproved || isRejected}
                                className="flex-1 py-3 bg-green-600 border-white text-black text-xs font-bold uppercase tracking-wider hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {isActionBusy ? <FaSpinner className="animate-spin" /> : <FaCircleCheck />} ПРИНЯТЬ
                            </button>
                            <button 
                                onClick={handleReject}
                                disabled={isActionBusy || isApproved || isRejected}
                                className="flex-1 py-3 bg-red-600 border-white text-black text-xs font-bold uppercase tracking-wider hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {isActionBusy ? <FaSpinner className="animate-spin" /> : <FaCircleXmark />} ОТКЛОНИТЬ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}