"use client";

import React, { useEffect, useState } from "react";
import { getProviderOffers } from "../../../actions/providers";
import { FaMotorcycle, FaGun, FaPersonSkiing, FaChevronRight } from "react-icons/fa6";
import { cn } from "@/lib/utils";

export function ProviderOffers({ playerCount }: { playerCount: number }) {
    const [offers, setOffers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getProviderOffers(playerCount).then(res => {
            if (res.success) setOffers(res.data);
            setLoading(false);
        });
    }, [playerCount]);

    if (loading) return <div className="animate-pulse text-[10px] text-zinc-500 font-mono">CALCULATING MARKET OFFERS...</div>;

    return (
        <div className="space-y-4">
            <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em]">Доступные Офферы для Группы ({playerCount})</h3>
            
            <div className="grid grid-cols-1 gap-2">
                {offers.map(provider => (
                    <div key={provider.providerSlug} className="bg-zinc-900/80 border border-zinc-800 p-4">
                        <div className="flex items-center gap-3 mb-4">
                            <img src={provider.logo} className="w-8 h-8 grayscale" alt="Logo" />
                            <span className="font-black text-xs uppercase tracking-widest">{provider.providerName}</span>
                        </div>
                        
                        <div className="space-y-2">
                            {provider.offers.map((offer: any) => (
                                <button 
                                    key={offer.serviceId}
                                    className="w-full flex justify-between items-center p-3 bg-black border border-zinc-800 hover:border-red-500 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <ServiceIcon type={offer.serviceId} />
                                        <div className="text-left">
                                            <div className="text-[10px] font-bold text-white uppercase">{offer.serviceName}</div>
                                            <div className="text-[8px] text-zinc-500">{offer.bestPackage.name} // {offer.bestPackage.includes}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-black text-red-500">{offer.totalPrice.toLocaleString()} ₽</div>
                                        <div className="text-[8px] text-zinc-600">{offer.perPerson} / чел</div>
                                    </div>
                                    <FaChevronRight className="text-zinc-800 group-hover:text-red-500 ml-2" />
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ServiceIcon({ type }: { type: string }) {
    if (type.includes('bike') || type.includes('enduro')) return <FaMotorcycle className="text-amber-500" />;
    if (type.includes('snow')) return <FaPersonSkiing className="text-cyan-400" />;
    return <FaGun className="text-red-600" />;
}