"use client";

import React, { useState, useEffect } from "react";
import { FaCar, FaUserGroup, FaCirclePlus } from "react-icons/fa6";
import { cn } from "@/lib/utils";

export const LogisticsPanel = ({ userMember, members, onToggleDriver, onJoinCar }: any) => {
    // Внутренние состояния для формы водителя
    const [carName, setCarName] = useState(userMember?.metadata?.transport?.car_name || "");
    const [seats, setSeats] = useState(userMember?.metadata?.transport?.seats || 3);

    const drivers = members.filter((m: any) => m.metadata?.transport?.role === 'driver');
    const pedestrians = members.filter((m: any) => m.metadata?.transport?.role === 'passenger' && !m.metadata.transport?.driver_id);
    
    const isDriver = userMember?.metadata?.transport?.role === 'driver';
    const isPassenger = userMember?.metadata?.transport?.role === 'passenger';

    if (!userMember) {
        return <div className="p-8 text-center border border-dashed border-zinc-800 text-zinc-500 font-mono">ВСТУПИТЕ В ОТРЯД ДЛЯ ДОСТУПА К ЛОГИСТИКЕ</div>;
    }

    return (
        <div className="space-y-4">
            <div className="bg-zinc-950 p-6 border border-zinc-900 shadow-2xl">
                <h3 className="font-mono text-zinc-500 mb-6 text-[10px] tracking-[0.3em] flex items-center gap-2 uppercase">
                    <FaCar /> КАНАЛ_ТРАНСПОРТНОЙ_ЛОГИСТИКИ
                </h3>

                <div className="grid grid-cols-2 gap-4 mb-8">
                    {/* КАРТА ВОДИТЕЛЯ */}
                    <div className={cn("p-4 border transition-all", isDriver ? "border-white bg-zinc-900" : "border-zinc-800")}>
                        <button onClick={() => onToggleDriver(isDriver ? 'none' : 'driver', seats, carName)} className="w-full text-center">
                            <div className="text-2xl mb-2">🚗</div>
                            <div className="font-black text-[10px] uppercase tracking-widest">Я_ЗА_РУЛЕМ</div>
                        </button>
                        
                        {isDriver && (
                            <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <input className="w-full bg-black border border-zinc-800 p-2 text-[10px] font-mono text-white outline-none focus:border-white uppercase" value={carName} onChange={e => setCarName(e.target.value)} placeholder="ПОЗЫВНОЙ_АВТО" />
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 bg-black border border-zinc-800 px-2 py-1">
                                        <button onClick={() => setSeats(Math.max(1, seats - 1))} className="text-zinc-500 hover:text-white">-</button>
                                        <span className="font-mono text-xs w-4 text-center">{seats}</span>
                                        <button onClick={() => setSeats(Math.min(8, seats + 1))} className="text-zinc-500 hover:text-white">+</button>
                                    </div>
                                    <button onClick={() => onToggleDriver('driver', seats, carName)} className="text-[8px] font-black border border-white px-2 py-1.5 uppercase bg-white text-black hover:bg-zinc-200">Обновить</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* КАРТА ПЕШЕХОДА */}
                    <button 
                        onClick={() => onToggleDriver(isPassenger ? 'none' : 'passenger', 0, '')} 
                        className={cn("p-4 border transition-all flex flex-col items-center justify-center", isPassenger ? "border-amber-600 bg-amber-950/20 text-amber-500 shadow-[0_0_15px_rgba(217,119,6,0.2)]" : "border-zinc-800 text-zinc-600")}
                    >
                        <div className="text-2xl mb-2">🙋‍♂️</div>
                        <div className="font-black text-[10px] uppercase tracking-widest">НУЖНО_МЕСТО</div>
                    </button>
                </div>

                {/* СПИСОК КОНВОЕВ */}
                <div className="space-y-6">
                    <div>
                        <div className="text-[9px] font-mono text-zinc-600 uppercase mb-3 tracking-widest border-b border-zinc-900 pb-1">Активные_Конвои</div>
                        <div className="grid grid-cols-1 gap-2">
                        {drivers.map((driver: any) => {
                            const ps = members.filter((m: any) => m.metadata?.transport?.driver_id === driver.id);
                            const maxSeats = driver.metadata.transport.seats || 3;
                            const isFull = ps.length >= maxSeats;
                            
                            return (
                                <div key={driver.id} className="border border-zinc-900 p-3 bg-zinc-950/30 flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-xs text-white uppercase tracking-tight">
                                            {driver.user?.username || 'БОЕЦ'} 
                                            <span className="text-zinc-600 ml-2">[{driver.metadata.transport.car_name || 'БЕЗ_ИМЕНИ'}]</span>
                                        </span>
                                        <span className={cn("text-[9px] font-mono mt-1", isFull ? "text-red-500" : "text-emerald-500")}>
                                            ЗАНЯТО: {ps.length} / {maxSeats} МЕСТ
                                        </span>
                                    </div>
                                    
                                    {!isDriver && isPassenger && !isFull && userMember.metadata?.transport?.driver_id !== driver.id && (
                                        <button onClick={() => onJoinCar(driver.id)} className="text-[9px] font-black border border-emerald-500 text-emerald-500 px-3 py-2 uppercase hover:bg-emerald-500 hover:text-black transition-all">
                                            В_МАШИНУ
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                        {drivers.length === 0 && <div className="text-center py-4 text-[9px] text-zinc-700 uppercase italic">Машин_не_обнаружено</div>}
                        </div>
                    </div>

                    {pedestrians.length > 0 && (
                        <div>
                            <div className="text-[9px] font-mono text-zinc-600 uppercase mb-3 tracking-widest border-b border-zinc-900 pb-1">Пехота_без_транспорта</div>
                            <div className="flex flex-wrap gap-2">
                                {pedestrians.map((p: any) => (
                                    <span key={p.id} className="text-[8px] font-black text-amber-500 bg-amber-950/20 border border-amber-900/30 px-2 py-1 uppercase">
                                        {p.user?.username}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};