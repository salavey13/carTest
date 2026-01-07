"use client";

import React, { useEffect, useState } from "react";
import { getProviderOffers, selectProviderForLobby, approveProviderForLobby, rejectProviderForLobby } from "../../../actions/providers";
import { 
    FaMotorcycle, FaGun, FaPersonSkiing, FaChevronRight, 
    FaCubes, FaTerminal, FaLock, FaUsers, FaClock, 
    FaMapLocationDot, FaShieldHeart, FaCircleInfo, FaSnowflake,
    FaGamepad, FaPaintRoller, FaVrCardboard, FaCircleCheck, FaXmark
} from "react-icons/fa6";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useAppContext } from "@/contexts/AppContext";

// Activity type to icon mapping
const activityIcons: Record<string, React.ReactNode> = {
    strikeball: <FaGun />,
    paintball: <FaPaintRoller />,
    lazertag: <FaGamepad />,
    snowboard: <FaPersonSkiing />,
    vr: <FaVrCardboard />,
    default: <FaCubes />
};

export function ProviderOffers({ lobbyId, playerCount, activityType, selectedProviderId, selectedServiceId }: any) {
    const { dbUser } = useAppContext();
    const [providers, setProviders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>(activityType || 'all');

    useEffect(() => {
        getProviderOffers(playerCount, filter === 'all' ? undefined : filter).then(res => {
            if (res.success) setProviders(res.data);
            setLoading(false);
        });
    }, [playerCount, filter]);

    const handleSelect = async (providerId: string, offer: any) => {
        if (!offer.isAvailable) return toast.error(offer.lockReason);
        const res = await selectProviderForLobby(lobbyId, providerId, offer);
        if (res.success) toast.success("Контракт отправлен провайдеру!");
    };

    const handleApprove = async () => {
        if (!dbUser?.user_id) return toast.error("Authorization Required");
        // Only one provider can be "active" in the lobby proposal state at a time (usually)
        const providerId = selectedProviderId;
        if (!providerId) return toast.error("No provider selected");
        
        const res = await approveProviderForLobby(lobbyId, providerId, dbUser.user_id);
        if (res.success) {
            toast.success("ОФЕРТА ПРИНЯТА!", {
                description: "Владелец лобби уведомлен.",
                icon: <FaCircleCheck className="text-brand-cyan" />
            });
        } else {
            toast.error("Ошибка одобрения", { description: res.error });
        }
    };

    const handleReject = async () => {
        if (!dbUser?.user_id) return toast.error("Authorization Required");
        const providerId = selectedProviderId;
        if (!providerId) return toast.error("No provider selected");
        
        const res = await rejectProviderForLobby(lobbyId, providerId, dbUser.user_id);
        if (res.success) {
            toast.info("ОФЕРТА ОТКЛОНЕНА", {
                description: "Можете выбрать другого провайдера.",
                icon: <FaXmark className="text-red-500" />
            });
        } else {
            toast.error("Ошибка отмены", { description: res.error });
        }
    };

    if (loading) return <div className="p-4 border border-zinc-800 animate-pulse text-[10px] font-mono text-zinc-500 uppercase">Scanning Tactical Market...</div>;

    // Extract unique activity types for filter
    const activityTypes = Array.from(new Set(
        providers.flatMap(p => p.offers.map((o: any) => o.serviceId))
    ));

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end border-b border-zinc-800 pb-2">
                <h3 className="text-xs font-black font-orbitron uppercase tracking-widest text-zinc-400">Рынок Операций</h3>
                <span className="text-[9px] font-mono text-brand-cyan uppercase">Найдено: {providers.length} локаций</span>
            </div>
            
            {/* Activity Type Filter */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                <button
                    onClick={() => setFilter('all')}
                    className={cn(
                        "px-3 py-1 text-[9px] font-black uppercase border transition-all whitespace-nowrap",
                        filter === 'all' 
                            ? "bg-brand-cyan text-black border-brand-cyan" 
                            : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300"
                    )}
                >
                    Все активности
                </button>
                {activityTypes.map(type => (
                    <button
                        key={type}
                        onClick={() => setFilter(type)}
                        className={cn(
                            "px-3 py-1 text-[9px] font-black uppercase border transition-all whitespace-nowrap flex items-center gap-1",
                            filter === type 
                                ? "bg-brand-cyan text-black border-brand-cyan" 
                                : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300"
                        )}
                    >
                        {activityIcons[type] || activityIcons.default}
                        {type}
                    </button>
                ))}
            </div>
            
            {providers.map(provider => {
                // PERMISSION CHECK: Is current user the owner of this Provider (Crew)?
                const isProviderOwner = dbUser?.user_id === provider.owner_id;
                const isCurrentProposal = selectedProviderId === provider.providerId;
                
                return (
                <div key={provider.providerId} className={cn(
                    "bg-zinc-950 border-2 transition-all overflow-hidden",
                    isCurrentProposal ? "border-brand-cyan shadow-[0_0_25px_rgba(0,255,255,0.1)]" : "border-zinc-900"
                )}>
                    {/* Header: Provider Intel */}
                    <div className="p-4 bg-zinc-900/50 flex justify-between items-start relative">
                        <Link href={`/crews/${provider.providerSlug}`} className="flex gap-4 group">
                            <img src={provider.logo} className="w-12 h-12 bg-black border border-zinc-700 grayscale group-hover:grayscale-0 transition-all" />
                            <div>
                                <h4 className="font-black text-sm uppercase group-hover:text-brand-cyan">{provider.providerName}</h4>
                                <div className="flex items-center gap-3 text-[9px] text-zinc-500 font-mono mt-1">
                                    <span className="flex items-center gap-1"><FaMapLocationDot /> {provider.location}</span>
                                    <span className="flex items-center gap-1"><FaClock /> {provider.working_hours || "10:00-22:00"}</span>
                                </div>
                            </div>
                        </Link>
                        
                        {/* CONTROLS: Show Badge OR Approval Buttons */}
                        <div className="flex flex-col items-end gap-2">
                            {isCurrentProposal ? (
                                isProviderOwner ? (
                                    // APPROVER UI (Provider Owner)
                                    <div className="flex gap-1">
                                        <button 
                                            onClick={handleReject}
                                            className="px-2 py-1 bg-red-900/20 border border-red-800 text-red-400 text-[8px] font-black uppercase hover:bg-red-900 hover:text-red-300 transition-colors"
                                        >
                                            REJECT
                                        </button>
                                        <button 
                                            onClick={handleApprove}
                                            className="px-2 py-1 bg-green-900/20 border border-green-800 text-green-400 text-[8px] font-black uppercase hover:bg-green-900 hover:text-green-300 transition-colors"
                                        >
                                            APPROVE
                                        </button>
                                    </div>
                                ) : (
                                    // VIEWER UI (Regular User) - Shows "WAITING FOR PROVIDER" badge
                                    <Badge className="bg-brand-cyan text-black font-black text-[8px] rounded-none">PENDING_APPROVAL</Badge>
                                )
                            ) : (
                                // STATUS: If not selected, show basic status icon or nothing
                                <div className="text-zinc-600">
                                    <FaCircleInfo />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Amenities Bar */}
                    {provider.amenities?.length > 0 && (
                        <div className="flex gap-4 px-4 py-2 bg-black/40 border-y border-zinc-900 overflow-x-auto no-scrollbar">
                            {provider.amenities.map((a: any) => (
                                <div key={a.id} className="flex items-center gap-1.5 shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                                    <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-tighter">{a.name}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Offers List */}
                    <div className="p-2 space-y-2">
                        {provider.offers.map((offer: any) => {
                            const isSelected = selectedServiceId === offer.serviceId && selectedProviderId === provider.providerId;
                            
                            return (
                                <button 
                                    key={offer.serviceId}
                                    onClick={() => handleSelect(provider.providerId, offer)}
                                    disabled={!isProviderOwner && isCurrentProposal} // Disable selection if provider is already selected by someone else
                                    className={cn(
                                        "w-full p-4 border text-left transition-all relative group",
                                        !offer.isAvailable ? "opacity-40 cursor-not-allowed border-zinc-900" :
                                        isSelected ? "border-brand-cyan bg-brand-cyan/5" : "border-zinc-800 hover:border-zinc-600 bg-zinc-900/30"
                                    )}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                {activityIcons[offer.serviceId] || activityIcons.default}
                                                <h5 className="font-black text-xs uppercase">{offer.serviceName}</h5>
                                                {offer.age_limit && <span className="text-[8px] border border-zinc-700 px-1 text-zinc-500">{offer.age_limit}+</span>}
                                            </div>
                                            <p className="text-[10px] text-zinc-500 leading-tight max-w-[200px]">{offer.description}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-black font-orbitron text-white">{offer.totalPrice.toLocaleString()} {offer.currency || '₽'}</div>
                                            <div className="text-[9px] font-mono text-zinc-600">{offer.perPerson} {offer.currency || '₽'} / за бойца</div>
                                        </div>
                                    </div>

                                    {offer.isAvailable ? (
                                        <div className="mt-3 flex items-center gap-4 text-[9px] font-mono">
                                            <span className="text-brand-cyan flex items-center gap-1">
                                                <FaShieldHeart /> {offer.bestPackage.includes}
                                            </span>
                                            {offer.gear_info && <span className="text-zinc-500 italic">Экип: {offer.gear_info}</span>}
                                        </div>
                                    ) : (
                                        <div className="mt-3 text-[9px] text-red-900 font-black uppercase flex items-center gap-1">
                                            <FaLock /> {offer.lockReason}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
                );
            })}
        </div>
    );
}