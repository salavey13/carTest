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

    if (loading) return <div className="p-4 border border-border animate-pulse text-[10px] font-mono text-muted-foreground uppercase">Scanning Tactical Market...</div>;

    // Extract unique activity types for filter
    const activityTypes = Array.from(new Set(
        providers.flatMap(p => p.offers.map((o: any) => o.serviceId))
    ));

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end border-b border-border pb-2">
                <h3 className="text-xs font-black font-orbitron uppercase tracking-widest text-foreground/70">Рынок Операций</h3>
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
                            : "bg-muted text-muted-foreground border-border hover:text-foreground hover:border-muted-foreground/50"
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
                                : "bg-muted text-muted-foreground border-border hover:text-foreground hover:border-muted-foreground/50"
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
                    "bg-card border border-border transition-all overflow-hidden shadow-sm", // Fixed contrast: bg-card, border-border
                    isCurrentProposal ? "border-brand-cyan shadow-[0_0_25px_rgba(0,255,255,0.1)]" : "hover:border-muted-foreground/30"
                )}>
                    {/* Header: Provider Intel */}
                    <div className="p-4 bg-muted/30 flex justify-between items-start relative">
                        <Link href={`/crews/${provider.providerSlug}`} className="flex gap-4 group">
                            <img src={provider.logo} className="w-12 h-12 bg-black border border-border grayscale group-hover:grayscale-0 transition-all object-cover rounded-md" />
                            <div>
                                <h4 className="font-black text-sm uppercase group-hover:text-brand-cyan text-foreground">{provider.providerName}</h4>
                                <div className="flex items-center gap-3 text-[9px] text-muted-foreground font-mono mt-1">
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
                                            className="px-2 py-1 bg-destructive/10 border border-destructive text-destructive text-[8px] font-black uppercase hover:bg-destructive hover:text-destructive-foreground transition-colors"
                                        >
                                            REJECT
                                        </button>
                                        <button 
                                            onClick={handleApprove}
                                            className="px-2 py-1 bg-brand-green/10 border border-brand-green text-brand-green text-[8px] font-black uppercase hover:bg-brand-green hover:text-white transition-colors"
                                        >
                                            APPROVE
                                        </button>
                                    </div>
                                ) : (
                                    // VIEWER UI (Regular User)
                                    <Badge className="bg-brand-cyan text-black font-black text-[8px] rounded-none">PENDING_APPROVAL</Badge>
                                )
                            ) : (
                                <div className="text-muted-foreground">
                                    <FaCircleInfo />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Amenities Bar */}
                    {provider.amenities?.length > 0 && (
                        <div className="flex gap-4 px-4 py-2 bg-card border-y border-border overflow-x-auto no-scrollbar">
                            {provider.amenities.map((a: any) => (
                                <div key={a.id} className="flex items-center gap-1.5 shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                                    <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tighter">{a.name}</span>
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
                                    disabled={!isProviderOwner && isCurrentProposal}
                                    className={cn(
                                        "w-full p-4 border text-left transition-all relative group",
                                        !offer.isAvailable ? "opacity-40 cursor-not-allowed border-border" :
                                        isSelected ? "border-brand-cyan bg-brand-cyan/5" : "border-border hover:border-muted-foreground/50 bg-card/50"
                                    )}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                {activityIcons[offer.serviceId] || activityIcons.default}
                                                <h5 className="font-black text-xs uppercase text-foreground">{offer.serviceName}</h5>
                                                {offer.age_limit && <span className="text-[8px] border border-border px-1 text-muted-foreground">{offer.age_limit}+</span>}
                                            </div>
                                            <p className="text-[10px] text-muted-foreground leading-tight max-w-[200px]">{offer.description}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-black font-orbitron text-foreground">{offer.totalPrice.toLocaleString()} {offer.currency || '₽'}</div>
                                            <div className="text-[9px] font-mono text-muted-foreground">{offer.perPerson} {offer.currency || '₽'} / за бойца</div>
                                        </div>
                                    </div>

                                    {offer.isAvailable ? (
                                        <div className="mt-3 flex items-center gap-4 text-[9px] font-mono text-foreground">
                                            <span className="text-brand-cyan flex items-center gap-1">
                                                <FaShieldHeart /> {offer.bestPackage.includes}
                                            </span>
                                            {offer.gear_info && <span className="text-muted-foreground italic">Экип: {offer.gear_info}</span>}
                                        </div>
                                    ) : (
                                        <div className="mt-3 text-[9px] text-destructive font-black uppercase flex items-center gap-1">
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