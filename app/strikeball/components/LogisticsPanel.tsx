"use client";

import React from "react";
import { FaCar } from "react-icons/fa6";
import { cn } from "@/lib/utils";

export const LogisticsPanel = ({
    userMember, members, carName, setCarName, driverSeats, setDriverSeats,
    onToggleDriver, onTogglePassenger, onUpdateCar, onJoinCar
}: any) => {
    const drivers = members.filter((m:any) => m.metadata?.transport?.role === 'driver');
    const pedestrians = members.filter((m:any) => m.metadata?.transport?.role === 'passenger' && !m.metadata.transport?.driver_id);
    const isDriver = userMember?.metadata?.transport?.role === 'driver';
    const isPassenger = userMember?.metadata?.transport?.role === 'passenger';

    return (
        <div className="space-y-4">
            <div className="bg-[#000000] p-6 border border-zinc-800">
                <h3 className="font-mono text-zinc-500 mb-6 text-xs tracking-[0.3em] flex items-center gap-2">
                    <FaCar /> ЛОГИСТИЧЕСКАЯ_СЕТЬ
                </h3>

                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className={cn("p-4 border transition-all cursor-pointer", isDriver ? "border-white bg-zinc-900" : "border-zinc-800")}>
                        <div onClick={onToggleDriver} className="text-center">
                            <div className="text-2xl mb-2">🚗</div>
                            <div className="font-bold text-[10px] font-mono uppercase tracking-widest">Оператор_Водитель</div>
                        </div>
                        {isDriver && (
                            <div className="mt-4 space-y-3">
                                <input className="w-full bg-black border border-zinc-800 p-2 text-[10px] font-mono text-white" value={carName} onChange={e => setCarName(e.target.value)} placeholder="ПОЗЫВНОЙ_АВТО" />
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setDriverSeats(Math.max(1, driverSeats - 1))} className="w-6 h-6 border border-zinc-800">-</button>
                                        <span className="font-mono text-xs">{driverSeats}</span>
                                        <button onClick={() => setDriverSeats(Math.min(8, driverSeats + 1))} className="w-6 h-6 border border-zinc-800">+</button>
                                    </div>
                                    <button onClick={onUpdateCar} className="text-[9px] font-mono border border-white px-2 py-1 uppercase">СИНХР</button>
                                </div>
                            </div>
                        )}
                    </div>

                    <button onClick={onTogglePassenger} className={cn("p-4 border transition-all flex flex-col items-center justify-center", isPassenger ? "border-amber-600 bg-amber-950/20" : "border-zinc-800")}>
                        <div className="text-2xl mb-2">🙋‍♂️</div>
                        <div className="font-bold text-[10px] font-mono uppercase tracking-widest">Нужен_Транспорт</div>
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="text-[9px] font-mono text-zinc-600 uppercase mb-3 tracking-widest">Активные_Конвои</div>
                    {drivers.map((driver:any) => (
                        <div key={driver.id} className="border border-zinc-900 p-3 bg-zinc-950/50">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-mono text-xs text-white uppercase">{driver.user?.username} <span className="text-zinc-600">[{driver.metadata.transport.car_name}]</span></span>
                                <span className="text-[10px] font-mono text-emerald-500">{driver.metadata.transport.seats} МЕСТ</span>
                            </div>
                            {!isDriver && isPassenger && <button onClick={() => onJoinCar(driver.id)} className="text-[9px] font-mono border border-emerald-900 text-emerald-500 px-2 uppercase">+ ЗАПРОСИТЬ_МЕСТО</button>}
                        </div>
                    ))}
                    {pedestrians.length > 0 && (
                        <div>
                            <div className="text-[9px] font-mono text-zinc-600 uppercase mb-3 tracking-widest">Свободный_Состав</div>
                            <div className="flex flex-wrap gap-2">
                                {pedestrians.map((p:any) => <span key={p.id} className="text-[9px] font-mono text-amber-500 border border-amber-900/30 px-2 py-1">{p.user?.username}</span>)}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};