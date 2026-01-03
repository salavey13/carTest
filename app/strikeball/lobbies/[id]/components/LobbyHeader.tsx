"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaShareNodes, FaFilePdf, FaSpinner, FaUserShield, FaCircleCheck, FaCircleXmark, FaPenToSquare } from "react-icons/fa6";
import { cn } from "@/lib/utils";
import { CreateLobbyForm } from "../../components/CreateLobbyForm"; // Import reused form
import { editLobby } from "../../actions/lobby"; // Import edit action
import { toast } from 'sonner';

interface LobbyHeaderProps {
    name: string;
    mode: string;
    id: string; // Added ID for editing
    status: string;
    startAt: string | null;
    metadata: any;
    userMember: any; 
    isAdmin: boolean; 
    onPdf: () => void;
    onShare: () => void;
    loading: boolean;
    // Callback to reload data after edit
    loadData?: () => void;
}

export function LobbyHeader({ name, mode, id, status, startAt, metadata, userMember, isAdmin, onPdf, onShare, loading, loadData }: LobbyHeaderProps) {
    const approval = metadata?.approval_status || 'proposed';
    const myVote = userMember?.metadata?.vote;
    const [isEditing, setIsEditing] = useState(false);

    const handleEditSuccess = async () => {
        setIsEditing(false);
        toast.success("ОПЕРАЦИЯ ОБНОВЛЕНА");
        if (loadData) loadData();
    };
    
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
                                     max_players: 0, // Will be filled by effect if needed
                                     field_id: "", // Placeholder, will be filled by effect
                                     metadata: metadata,
                                     crew_id: undefined // Not exposed in header, but needed for form logic if available
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

            <div className="absolute top-0 right-0 flex gap-3">
                <button onClick={onPdf} disabled={loading} className="p-2 border border-zinc-800 text-zinc-600 hover:text-white transition-all active:scale-95 rounded-none">
                    {loading ? <FaSpinner className="animate-spin" /> : <FaFilePdf />}
                </button>
                {/* --- NEW EDIT BUTTON --- */}
                <button onClick={() => setIsEditing(true)} className="p-2 border border-zinc-800 text-zinc-600 hover:text-brand-cyan transition-all active:scale-95 rounded-none">
                    <FaPenToSquare />
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