"use client";

import React, { useEffect, useState } from "react";
import { getProviderOffers, selectProviderForLobby } from "../../../actions/providers";
import { FaMotorcycle, FaGun, FaPersonSkiing, FaChevronRight, FaCubes, FaTerminal, FaCircleCheck } from "react-icons/fa6";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";

export function ProviderOffers({ lobbyId, playerCount, selectedProviderId }: { lobbyId: string, playerCount: number, selectedProviderId?: string }) {
    const [offers, setOffers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSelecting, setIsSelecting] = useState(false);

    useEffect(() => {
        getProviderOffers(playerCount).then(res => {
            if (res.success) setOffers(res.data);
            setLoading(false);
        });
    }, [playerCount]);

    const handleSelectOffer = async (providerId: string, providerSlug: string, offer: any) => {
        setIsSelecting(true);
        const res = await selectProviderForLobby(lobbyId, providerId, offer);
        setIsSelecting(false);
        
        if (res.success) {
            toast.success(`Оффер от ${providerSlug.toUpperCase()} принят!`);
        } else {
            toast.error(res.error);
        }
    };

    if (loading) return <div className="animate-pulse text-[10px] text-zinc-500 font-mono">SCANNIG MARKET FOR BEST DEALS...</div>;

    return (
        <div className="space-y-4">
            <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em] flex justify-between">
                <span>Доступные Офферы ({playerCount} чел)</span>
                <span className="text-red-500">Live Prices</span>
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
                {offers.map(provider => {
                    const isSelected = selectedProviderId === provider.providerId;
                    
                    return (
                        <div key={provider.providerSlug} className={cn(
                            "bg-zinc-900/60 border p-4 transition-all",
                            isSelected ? "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]" : "border-zinc-800"
                        )}>
                            <div className="flex justify-between items-center mb-4">
                                <Link href={`/crews/${provider.providerSlug}`} className="flex items-center gap-3 group">
                                    <div className="w-10 h-10 relative bg-black border border-zinc-700 overflow-hidden">
                                        <img src={provider.logo} className="w-full h-full object-cover grayscale group-hover:grayscale-0" alt="Logo" />
                                    </div>
                                    <div>
                                        <span className="font-black text-xs uppercase tracking-widest block group-hover:text-red-500">{provider.providerName}</span>
                                        <span className="text-[8px] text-zinc-600 font-mono uppercase">{provider.location || 'Tactical Location'}</span>
                                    </div>
                                </Link>
                                {isSelected && (
                                    <div className="text-[9px] bg-emerald-500 text-black px-2 py-0.5 font-black uppercase">Выбрано</div>
                                )}
                            </div>
                            
                            <div className="space-y-1.5">
                                {provider.offers.map((offer: any) => (
                                    <button 
                                        key={offer.serviceId}
                                        disabled={isSelecting}
                                        onClick={() => handleSelectOffer(provider.providerId, provider.providerSlug, offer)}
                                        className={cn(
                                            "w-full flex justify-between items-center p-3 bg-black border transition-all group relative overflow-hidden",
                                            isSelected && offer.serviceId === offer.serviceId ? "border-emerald-900" : "border-zinc-800 hover:border-red-600"
                                        )}
                                    >
                                        <div className="flex items-center gap-3 relative z-10">
                                            <ServiceIcon type={offer.serviceId} />
                                            <div className="text-left">
                                                <div className="text-[10px] font-bold text-white uppercase">{offer.serviceName}</div>
                                                <div className="text-[8px] text-zinc-500 leading-tight">
                                                    {offer.bestPackage.name} | {offer.bestPackage.includes}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right relative z-10">
                                            <div className="text-sm font-black text-red-500 group-hover:scale-110 transition-transform">
                                                {offer.totalPrice.toLocaleString()} ₽
                                            </div>
                                            <div className="text-[8px] text-zinc-600">{offer.perPerson} / чел</div>
                                        </div>
                                        
                                        {/* Background hover effect */}
                                        <div className="absolute inset-0 bg-gradient-to-r from-red-600/0 via-red-600/5 to-red-600/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function ServiceIcon({ type }: { type: string }) {
    const t = type.toLowerCase();
    if (t.includes('bike') || t.includes('enduro')) return <FaMotorcycle className="text-amber-500" />;
    if (t.includes('snow')) return <FaPersonSkiing className="text-cyan-400" />;
    if (t.includes('paintball')) return <FaCubes className="text-orange-500" />; // Missing paintball icon fix
    if (t.includes('cyber') || t.includes('wms')) return <FaTerminal className="text-brand-cyan" />;
    return <FaGun className="text-red-600" />;
}