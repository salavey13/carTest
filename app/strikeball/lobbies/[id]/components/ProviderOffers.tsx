"use client";

import React, { useEffect, useState } from "react";
import { getProviderOffers, selectProviderForLobby } from "../../../actions/providers";
import { FaMotorcycle, FaGun, FaPersonSkiing, FaChevronRight, FaCubes, FaTerminal, FaLock, FaUsers } from "react-icons/fa6";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";

export function ProviderOffers({ lobbyId, playerCount, selectedProviderId, selectedServiceId }: { 
    lobbyId: string, 
    playerCount: number, 
    selectedProviderId?: string,
    selectedServiceId?: string 
}) {
    const [providers, setProviders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSelecting, setIsSelecting] = useState(false);

    useEffect(() => {
        getProviderOffers(playerCount).then(res => {
            if (res.success) setProviders(res.data);
            setLoading(false);
        });
    }, [playerCount]);

    const handleSelectOffer = async (providerId: string, providerSlug: string, offer: any) => {
        if (!offer.isAvailable) return toast.error(offer.lockReason);
        
        setIsSelecting(true);
        const res = await selectProviderForLobby(lobbyId, providerId, offer);
        setIsSelecting(false);
        
        if (res.success) {
            toast.success(`Контракт с ${providerSlug.toUpperCase()} инициирован!`);
        } else {
            toast.error(res.error);
        }
    };

    if (loading) return <div className="animate-pulse text-[10px] text-zinc-500 font-mono">SCANNIG MARKET FOR BEST DEALS...</div>;

    return (
        <div className="space-y-4">
            <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em] flex justify-between">
                <span>Рынок Услуг // Группа: {playerCount}</span>
                <span className="text-red-500 animate-pulse">LIVE_PRICES</span>
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
                {providers.map(provider => {
                    // BUG FIX: Ensure we compare the actual UUIDs
                    const isProviderSelected = selectedProviderId === provider.providerId;
                    
                    return (
                        <div key={provider.providerId} className={cn(
                            "bg-zinc-900/60 border p-4 transition-all relative",
                            isProviderSelected ? "border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]" : "border-zinc-800"
                        )}>
                            <div className="flex justify-between items-center mb-4">
                                <Link href={`/crews/${provider.providerSlug}`} className="flex items-center gap-3 group">
                                    <div className="w-10 h-10 relative bg-black border border-zinc-700 overflow-hidden">
                                        <img src={provider.logo} className="w-full h-full object-cover grayscale group-hover:grayscale-0" alt="Logo" />
                                    </div>
                                    <div>
                                        <span className="font-black text-xs uppercase tracking-widest block group-hover:text-red-500">{provider.providerName}</span>
                                        <span className="text-[8px] text-zinc-600 font-mono uppercase">{provider.location || 'Tactical HQ'}</span>
                                    </div>
                                </Link>
                                {isProviderSelected && (
                                    <div className="text-[9px] bg-emerald-500 text-black px-2 py-0.5 font-black uppercase flex items-center gap-1">
                                        АКТИВНЫЙ_ШТАБ
                                    </div>
                                )}
                            </div>
                            
                            <div className="space-y-1.5">
                                {provider.offers.map((offer: any) => {
                                    const isThisServiceSelected = isProviderSelected && selectedServiceId === offer.serviceId;
                                    
                                    return (
                                        <button 
                                            key={offer.serviceId}
                                            disabled={isSelecting || !offer.isAvailable}
                                            onClick={() => handleSelectOffer(provider.providerId, provider.providerSlug, offer)}
                                            className={cn(
                                                "w-full flex justify-between items-center p-3 transition-all group relative overflow-hidden border",
                                                !offer.isAvailable ? "bg-black/20 border-zinc-900 cursor-not-allowed opacity-60" : 
                                                isThisServiceSelected ? "bg-emerald-950/20 border-emerald-500" : "bg-black border-zinc-800 hover:border-red-600"
                                            )}
                                        >
                                            <div className="flex items-center gap-3 relative z-10 text-left">
                                                <div className={cn("transition-colors", !offer.isAvailable ? "text-zinc-700" : "text-white")}>
                                                    {offer.isAvailable ? <ServiceIcon type={offer.serviceId} /> : <FaLock size={12} className="text-red-900" />}
                                                </div>
                                                <div>
                                                    <div className={cn(
                                                        "text-[10px] font-bold uppercase",
                                                        !offer.isAvailable ? "text-zinc-600" : "text-white"
                                                    )}>
                                                        {offer.serviceName}
                                                    </div>
                                                    <div className="text-[8px] text-zinc-500 leading-tight">
                                                        {offer.isAvailable ? `${offer.bestPackage.name} | ${offer.bestPackage.includes}` : offer.lockReason}
                                                    </div>
                                                </div>
                                            </div>

                                            {offer.isAvailable ? (
                                                <div className="text-right relative z-10">
                                                    <div className="text-sm font-black text-red-500 group-hover:scale-110 transition-transform">
                                                        {offer.totalPrice.toLocaleString()} ₽
                                                    </div>
                                                    <div className="text-[8px] text-zinc-600 font-mono">{offer.perPerson} / чел</div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 text-[8px] font-mono text-red-900 uppercase font-bold">
                                                    <FaUsers size={10} /> {offer.minPlayers} min
                                                </div>
                                            )}
                                            
                                            {offer.isAvailable && (
                                                <div className="absolute inset-0 bg-gradient-to-r from-red-600/0 via-red-600/5 to-red-600/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                            )}
                                        </button>
                                    );
                                })}
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
    if (t.includes('paintball')) return <FaCubes className="text-orange-500" />;
    if (t.includes('cyber') || t.includes('wms')) return <FaTerminal className="text-brand-cyan" />;
    return <FaGun className="text-red-600" />;
}