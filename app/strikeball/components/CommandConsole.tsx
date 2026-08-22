"use client";

import React, { useState } from "react";
import { startGame, endGame, updateScore } from "../actions/game";
import { setLobbyApprovalStatus, proposeLobbyDate } from "../actions/lobby";
import { approveProviderForLobby, rejectProviderForLobby } from "../actions/providers";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FaCheckDouble, FaMoneyBillWave, FaCalendarPlus, FaPlay, FaCircleCheck, FaXmark, FaUserShield, FaShieldHeart } from "react-icons/fa6";

export const CommandConsole = ({ lobbyId, providerId, userId, status, score, isAdmin, onLoad }: any) => {
    const [isBusy, setIsBusy] = useState(false);
    const [newDate, setNewDate] = useState("");

    const handleStart = async () => {
        if(!confirm("АКТИВИРОВАТЬ_БОЕВОЙ_РЕЖИМ?")) return;
        setIsBusy(true);
        const res = await startGame(lobbyId, userId);
        setIsBusy(false);
        if (res.success) {
            toast.success("COMBAT_INITIATED");
            onLoad();
        } else toast.error(res.error);
    };

    // Обработка одобрения провайдера
    const handleAcceptProvider = async () => {
        if (!providerId) return toast.error("Ошибка: Не выбран провайдер");
        if (!confirm("Вы принимаете ответственность за оборудование и поле. Утвердить предложение?")) return;

        setIsBusy(true);
        const res = await approveProviderForLobby(lobbyId, providerId, userId);
        
        setIsBusy(false);
        if (res.success) {
            toast.success("Контракт утвержден!", {
                description: "Владелец лобби уведомлен."
            });
            onLoad();
        } else {
            toast.error("Ошибка утверждения", { description: res.error });
        }
    };

    // Обработка отклонения провайдера
    const handleRejectProvider = async () => {
        if (!providerId) return toast.error("Ошибка: Не выбран провайдер");
        if (!confirm("Вы уверены, что хотите отклонить предложение?")) return;

        setIsBusy(true);
        const res = await rejectProviderForLobby(lobbyId, providerId, userId);
        
        setIsBusy(false);
        if (res.success) {
            toast.info("Предложение отклонено.", {
                description: "Провайдер отключен от лобби."
            });
            onLoad();
        } else {
            toast.error("Ошибка отмены", { description: res.error });
        }
    };

    // Логика отображения кнопок
    // Если есть активное предложение от провайдера (providerId существует), показываем кнопки провайдера
    // Если статус игры "open" и providerId == null, показываем кнопки администратора (Одобрение даты)
    const hasProviderProposal = !!providerId && status === 'open';
    const showAdminControls = status === 'open' && !hasProviderProposal;
    const showProviderControls = status === 'open' && hasProviderProposal;

    const handleApproval = async (newStatus: 'approved_unpaid' | 'approved_paid') => {
        setIsBusy(true);
        const res = await setLobbyApprovalStatus(lobbyId, newStatus);
        setIsBusy(false);
        if (res.success) {
            toast.success(`СТАТУС_ОБНОВЛЕН: ${newStatus.toUpperCase()}`);
            onLoad();
        } else toast.error(res.error);
    };

    if (status === 'finished') return null;

    return (
        <div className="space-y-6">
            {status === 'open' && (
                <div className="space-y-4">
                    {/* БЛОК АДМИНИСТРАТОРА (Управление датами) */}
                    {showAdminControls && (
                        <div className="bg-zinc-950 border border-zinc-800 p-4">
                            <h4 className="text-[9px] text-zinc-600 mb-3 uppercase font-mono tracking-widest flex items-center gap-2">
                                <FaCheckDouble /> УТВЕРЖДЕНИЕ_ОРГАНИЗАТОРОМ
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={() => handleApproval('approved_unpaid')} 
                                    disabled={isBusy}
                                    className="bg-cyan-900/20 border border-cyan-500 text-cyan-400 py-3 text-[10px] font-black uppercase hover:bg-cyan-500 hover:text-black transition-all"
                                >
                                    ОДОБРИТЬ
                                </button>
                                <button 
                                    onClick={() => handleApproval('approved_paid')} 
                                    disabled={isBusy}
                                    className="bg-green-900/20 border border-green-500 text-green-400 py-3 text-[10px] font-black uppercase hover:bg-green-500 hover:text-black transition-all"
                                >
                                    <FaMoneyBillWave className="inline mr-1" /> ОПЛАЧЕНО_OK
                                </button>
                            </div>
                        </div>
                    )}

                    {/* БЛОК ПРОВАЙДЕРА (Управление предложением) */}
                    {showProviderControls && (
                        <div className="bg-zinc-950 border border-zinc-800 p-4 relative overflow-hidden">
                            {/* Градиентная рамка для привлечения внимания */}
                            <div className="absolute inset-0 border-2 border-brand-cyan opacity-30 pointer-events-none"></div>
                            
                            <h4 className="text-[9px] text-brand-cyan mb-3 uppercase font-mono tracking-widest flex items-center gap-2 relative z-10">
                                <FaUserShield /> УПРАВЛЕНИЕ_ЛОББИ
                            </h4>
                            <div className="text-[8px] text-zinc-400 mb-4">
                                Владелец лобби предлагает использование ваших услуг. 
                                Просмотрите детали ниже и подтвердите или отклоните.
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={handleAcceptProvider}
                                    disabled={isBusy}
                                    className="w-full bg-green-600 border-white text-black py-4 text-sm font-black uppercase tracking-wider transition-all active:scale-95 shadow-[0_0_15px_rgba(34,197,94,0.4)] hover:bg-green-500"
                                >
                                    <FaCircleCheck className="text-lg mr-2" />
                                    ПРИНЯТЬ ПРЕДЛОЖЕНИЕ
                                </button>
                                <button 
                                    onClick={handleRejectProvider}
                                    disabled={isBusy}
                                    className="w-full bg-red-600 border-white text-black py-4 text-sm font-black uppercase tracking-wider transition-all active:scale-95 shadow-[0_0_15px_rgba(220,38,38,0.4)] hover:bg-red-500"
                                >
                                    <FaXmark className="text-lg mr-2" />
                                    ОТКЛОНЯТЬ ПРЕДЛОЖЕНИЕ
                                </button>
                            </div>
                            
                            <div className="text-[8px] text-zinc-400 font-mono text-center pt-2 flex items-center gap-2">
                                <FaShieldHeart className="text-brand-red-orange" /> ПРОВЕРКА ДОСТАВКИ...
                            </div>
                        </div>
                    )}

                    {/* КНОПКА СТАРТА БОЯ */}
                    <button 
                        onClick={handleStart}
                        disabled={isBusy || showProviderControls} // Блокируем старт, если есть необработанный запрос провайдера
                        className="w-full bg-white text-black py-10 text-2xl font-black font-mono uppercase tracking-[0.4em] border-4 border-black outline outline-1 outline-white hover:bg-zinc-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FaPlay className="inline mr-4 mb-1" /> НАЧАТЬ_БОЙ
                    </button>
                </div>
            )}

            {status === 'active' && (
                <>
                    <div className="grid grid-cols-2 gap-4">
                        <TeamAdjust team="blue" score={score.blue} onUpdate={(d:number) => updateScore(lobbyId, userId, 'blue', d).then(onLoad)} />
                        <TeamAdjust team="red" score={score.red} onUpdate={(d:number) => updateScore(lobbyId, userId, 'red', d).then(onLoad)} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4">
                        <button onClick={() => endGame(lobbyId, userId, 'blue').then(onLoad)} className="border border-zinc-800 py-3 text-[10px] font-mono hover:bg-white hover:text-black">B_WIN</button>
                        <button onClick={() => endGame(lobbyId, userId, 'draw').then(onLoad)} className="border border-zinc-800 py-3 text-[10px] font-mono hover:bg-zinc-800">DRAW</button>
                        <button onClick={() => endGame(lobbyId, userId, 'red').then(onLoad)} className="border border-zinc-800 py-3 text-[10px] font-mono hover:bg-white hover:text-black">R_WIN</button>
                    </div>
                </>
            )}
        </div>
    );
};

function TeamAdjust({ team, score, onUpdate }: any) {
    return (
        <div className="bg-[#000000] border border-zinc-800 p-4">
            <h4 className="text-zinc-600 font-mono text-[10px] mb-4 text-center uppercase tracking-widest">{team}</h4>
            <div className="flex justify-between items-center">
                <button onClick={() => onUpdate(-1)} className="w-10 h-10 border border-zinc-800 text-zinc-500 hover:text-white">-</button>
                <span className="text-2xl font-mono text-white">{score}</span>
                <button onClick={() => onUpdate(1)} className="w-10 h-10 border border-zinc-800 text-zinc-500 hover:text-white">+</button>
            </div>
        </div>
    );
}