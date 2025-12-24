"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCrewLiveDetails, requestToJoinCrew } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
    FaCrown, FaShieldHalved, FaSackDollar, FaMapLocationDot, 
    FaBolt, FaTerminal, FaPeopleGroup, FaWarehouse, FaCircleInfo,
    FaPhone, FaClock, FaCarSide, FaBus, FaPlus, FaCheck, FaHouseFire,
    FaFireBurner, FaLightbulb, FaFutbol, FaStar
} from 'react-icons/fa6';
import { cn } from '@/lib/utils';
import { useAppContext } from '@/contexts/AppContext';
import { toast } from 'sonner';
import { VibeMap } from '@/components/VibeMap';
import Link from "next/link";

// Icon Helper for Dynamic Amenities
const IconMap: Record<string, any> = {
    FaHouseFire: FaHouseFire,
    FaFireBurner: FaFireBurner,
    FaLightbulb: FaLightbulb,
    FaFutbol: FaFutbol,
    FaCar: FaCarSide,
};

export default function CrewDetailPage() {
    const { slug } = useParams();
    const router = useRouter();
    const { dbUser } = useAppContext();
    const [crew, setCrew] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!slug) return;
        getCrewLiveDetails(slug as string).then(res => {
            if (res.success) setCrew(res.data);
            else toast.error("FAILED_TO_FETCH_UNIT_INTEL");
            setLoading(false);
        });
    }, [slug]);

    if (loading) return <Loading variant="bike" text="ESTABLISHING_UPLINK..." />;
    if (!crew) return <div className="pt-40 text-center text-red-500 font-orbitron text-4xl">404: SIGNAL_LOST</div>;

    const meta = crew.metadata || {};
    const isProvider = meta.is_provider;
    const services = meta.services || [];
    const amenities = meta.amenities || [];
    const addons = meta.addons || [];
    const contacts = meta.contacts || {};
    const locationInfo = meta.location_details || {};
    
    // Safety checks for ID and Slug (Fixes the .slice error)
    const displayId = crew.id ? crew.id.split('-')[0].toUpperCase() : "UNKNOWN";
    const displaySlug = crew.slug ? crew.slug.toString() : "";
    
    const tbBudgetBase = Number(meta.teambuilding_budget_base || 0);
    const tbBudgetDynamic = Number(meta.teambuilding_budget_dynamic || 0);
    const totalBudget = tbBudgetBase + tbBudgetDynamic;

    const handleJoin = async () => {
        if (!dbUser) return toast.error("AUTH_REQUIRED");
        const res = await requestToJoinCrew(dbUser.user_id, dbUser.username || 'RECRUIT', crew.id);
        if (res.success) toast.success("JOIN_REQUEST_TRANSMITTED");
        else toast.error(res.error);
    };

    return (
        <div className="min-h-screen bg-[#020202] text-white font-mono pb-24">
            
            {/* --- 1. ADAPTIVE HERO --- */}
            <div className="relative h-[45vh] w-full overflow-hidden border-b border-zinc-800">
                <Image 
                    src={crew.vehicles?.[0]?.image_url || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f'} 
                    alt="cover" fill className="object-cover opacity-10 scale-110 blur-[4px]" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#020202] via-transparent to-transparent" />
                
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-8 md:p-12">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center md:items-end gap-6">
                        <motion.div 
                            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            className="w-24 h-24 sm:w-32 sm:h-32 bg-black border-2 border-zinc-800 shadow-2xl relative overflow-hidden shrink-0"
                        >
                            <Image src={crew.logo_url || '/placeholder.svg'} alt="Logo" fill className="object-cover" />
                        </motion.div>

                        <div className="text-center md:text-left flex-1 min-w-0 w-full">
                            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                                    <h1 className="text-2xl sm:text-4xl lg:text-7xl font-black font-orbitron uppercase tracking-tighter leading-none truncate max-w-full">
                                        {crew.name}
                                    </h1>
                                    {isProvider && <Badge className="bg-amber-600 font-black animate-pulse rounded-none">ACTIVE_HQ</Badge>}
                                </div>
                                <div className="flex items-center justify-center md:justify-start gap-4 text-[9px] sm:text-xs font-bold text-zinc-500 tracking-[0.2em] uppercase">
                                    <span className="bg-zinc-900 px-2 py-0.5 border border-zinc-800">ID: {displayId}</span>
                                    <span className="text-brand-cyan flex items-center gap-1">
                                        <FaMapLocationDot /> {crew.hq_location || "GRID_PENDING"}
                                    </span>
                                </div>
                            </motion.div>
                        </div>

                        <div className="flex gap-2">
                             <Button onClick={handleJoin} className="bg-white text-black font-black uppercase text-[10px] rounded-none h-12 px-6 hover:bg-brand-cyan transition-all">
                                <FaBolt className="mr-2" /> Enlist_Unit
                             </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- 2. MAIN CORE --- */}
            <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* SIDEBAR: CONTACTS & OUTCOMES */}
                    <div className="lg:col-span-4 space-y-6">
                        
                        {/* THE FUND TRACKER */}
                        {isProvider && (
                            <div className="bg-zinc-900/50 border border-amber-500/20 p-6 relative overflow-hidden">
                                <div className="flex items-center gap-2 text-amber-500 mb-6">
                                    <FaSackDollar />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Teambuilding_Fund</span>
                                </div>
                                <div className="text-5xl font-black font-orbitron text-white">
                                    {totalBudget.toLocaleString()}<span className="text-sm ml-1 text-amber-500">₽</span>
                                </div>
                                <div className="mt-4 flex justify-between text-[8px] font-black text-zinc-500 uppercase">
                                    <span>Base: {tbBudgetBase}</span>
                                    <span className="text-emerald-500">Outcome_Mining: +{tbBudgetDynamic}</span>
                                </div>
                                <div className="mt-6 h-1 bg-black w-full overflow-hidden">
                                    <motion.div 
                                        initial={{ width: 0 }} animate={{ width: '60%' }} 
                                        className="h-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" 
                                    />
                                </div>
                            </div>
                        )}

                        {/* CONTACT PANEL */}
                        <div className="bg-zinc-950 border border-zinc-900 p-6 space-y-4">
                            <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2 border-b border-zinc-900 pb-2">
                                <FaTerminal className="text-brand-cyan" /> Secure_Comms
                            </h3>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-xs">
                                    <FaPhone className="text-zinc-600" /> 
                                    <span className="font-bold text-zinc-300">{contacts.primary_phone || "SIGNAL_JAMMED"}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                    <FaClock className="text-zinc-600" /> 
                                    <span className="text-zinc-400">Ops: {contacts.working_hours || "24/7"}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                    <FaCrown className="text-amber-500" /> 
                                    <span className="text-zinc-400">Lead: {contacts.manager_sales || contacts.manager || "CMD"}</span>
                                </div>
                            </div>
                        </div>

                        {/* LOGISTICS & DIRECTIONS */}
                        {locationInfo.address && (
                            <div className="bg-zinc-950 border border-zinc-900 p-6 space-y-4">
                                <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2 border-b border-zinc-900 pb-2">
                                    <FaMapLocationDot className="text-emerald-500" /> Deployment_Grid
                                </h3>
                                <p className="text-xs text-zinc-400 font-bold uppercase mb-2">{locationInfo.address}</p>
                                
                                <div className="space-y-4">
                                    <div className="flex gap-3">
                                        <FaBus className="text-zinc-700 shrink-0 mt-1" />
                                        <div className="text-[10px] text-zinc-500 leading-tight uppercase">
                                            {locationInfo.public_transport || "CLASSIFIED_REACH"}
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <FaCarSide className="text-zinc-700 shrink-0 mt-1" />
                                        <div className="text-[10px] text-zinc-500 leading-tight uppercase">
                                            {locationInfo.car_directions || "FOLLOW_HQ_SIGNAL"}
                                        </div>
                                    </div>
                                </div>
                                
                                <Button 
                                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${crew.hq_location}`, '_blank')}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-none h-10 text-[9px] uppercase font-black hover:bg-white hover:text-black"
                                >
                                    OPEN_IN_GPS_MAPS
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* MAIN TABS CONTENT (Col 8) */}
                    <div className="lg:col-span-8">
                        <Tabs defaultValue={isProvider ? "services" : "roster"} className="w-full">
                            <TabsList className="bg-zinc-900 w-full justify-start rounded-none h-14 p-0 border-b border-zinc-800 no-scrollbar overflow-x-auto">
                                {isProvider && <TabsTrigger value="services" className="px-8 rounded-none h-full data-[state=active]:bg-amber-600 data-[state=active]:text-black font-black text-[10px]">SERVICES</TabsTrigger>}
                                <TabsTrigger value="roster" className="px-8 rounded-none h-full data-[state=active]:bg-brand-cyan data-[state=active]:text-black font-black text-[10px]">UNIT_ROSTER ({crew.members?.length || 0})</TabsTrigger>
                                <TabsTrigger value="amenities" className="px-8 rounded-none h-full data-[state=active]:bg-zinc-100 data-[state=active]:text-black font-black text-[10px]">AMENITIES</TabsTrigger>
                                <TabsTrigger value="garage" className="px-8 rounded-none h-full data-[state=active]:bg-red-600 data-[state=active]:text-black font-black text-[10px]">ARSENAL</TabsTrigger>
                            </TabsList>

                            {/* SERVICES TAB */}
                            <TabsContent value="services" className="mt-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {services.map((s: any) => (
                                        <motion.div key={s.id} whileHover={{ y: -5 }} className="bg-zinc-900 border border-zinc-800 overflow-hidden">
                                            <div className="h-44 relative overflow-hidden bg-black">
                                                <Image 
                                                    src={s.image_url || crew.logo_url || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f'} 
                                                    alt="s" fill className="object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-700" 
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-[#020202] to-transparent" />
                                                <div className="absolute bottom-4 left-4">
                                                    <Badge className="bg-black/80 rounded-none border-amber-600 text-amber-500 text-[8px] mb-2">FORCE: {s.min_players}+</Badge>
                                                    <h3 className="text-2xl font-black font-orbitron uppercase italic">{s.name}</h3>
                                                </div>
                                            </div>
                                            <div className="p-5 space-y-4">
                                                <p className="text-[10px] text-zinc-500 uppercase leading-relaxed h-10 overflow-hidden">
                                                    {s.description || "Mission details are currently classified."}
                                                </p>
                                                <div className="space-y-1.5">
                                                    {s.packages?.map((pkg: any) => (
                                                        <div key={pkg.id} className="flex justify-between items-center bg-black p-3 border border-white/5">
                                                            <div>
                                                                <div className="text-[9px] font-black text-white uppercase">{pkg.name}</div>
                                                                <div className="text-[7px] text-zinc-500 font-mono truncate max-w-[150px]">{pkg.includes}</div>
                                                            </div>
                                                            <div className="text-amber-500 font-black font-orbitron">{pkg.price} ₽</div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <Button 
                                                    onClick={() => router.push(`/strikeball?create=true&activity=${s.id}`)}
                                                    className="w-full bg-zinc-100 text-black font-black uppercase text-[10px] rounded-none h-12 hover:bg-amber-500 hover:text-white"
                                                >
                                                    BOOK_MISSION_PROPOSAL
                                                </Button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </TabsContent>

                            {/* AMENITIES TAB */}
                            <TabsContent value="amenities" className="mt-8">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {amenities.map((a: any) => {
                                        const AmenityIcon = IconMap[a.icon] || FaBolt;
                                        return (
                                            <div key={a.id} className="bg-zinc-950 border border-zinc-900 p-6 text-center group hover:border-white transition-all">
                                                <AmenityIcon className="mx-auto text-2xl text-zinc-700 group-hover:text-white transition-colors mb-4" />
                                                <div className="text-[9px] font-black uppercase text-zinc-500 group-hover:text-white">{a.name}</div>
                                            </div>
                                        );
                                    })}
                                    {/* Addons Section in Amenities */}
                                    {addons.length > 0 && (
                                        <div className="col-span-full mt-8">
                                            <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-4">Tactical_Addons</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {addons.map((addon: any, idx: number) => (
                                                    <div key={idx} className="flex justify-between items-center p-3 bg-zinc-900 border border-zinc-800">
                                                        <span className="text-[10px] font-bold text-zinc-400 uppercase">{addon.name}</span>
                                                        <span className="text-brand-cyan font-black text-xs">{addon.price} ₽ / {addon.unit}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            {/* ROSTER TAB */}
                            <TabsContent value="roster" className="mt-8 space-y-2">
                                {crew.members?.map((m: any) => (
                                    <div key={m.user_id} className="bg-zinc-950 border border-zinc-900 p-4 flex items-center justify-between group hover:border-brand-cyan transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-zinc-800 border border-zinc-700 overflow-hidden shrink-0">
                                                <img src={m.avatar_url || '/placeholder.svg'} className="w-full h-full object-cover" alt="avatar" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-white uppercase tracking-tighter">@{m.username}</span>
                                                    {m.role === 'owner' && <FaCrown className="text-amber-500 text-[10px]" />}
                                                </div>
                                                <div className="text-[8px] text-zinc-600 uppercase font-black">
                                                    Rank: {m.role} // CID: {m.user_id?.slice(0,8).toUpperCase() || "..."}
                                                </div>
                                            </div>
                                        </div>
                                        <Badge className="bg-zinc-900 text-emerald-500 text-[8px]">READY</Badge>
                                    </div>
                                ))}
                            </TabsContent>

                            {/* ARSENAL TAB */}
                            <TabsContent value="garage" className="mt-8">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 bg-zinc-900 border border-zinc-900">
                                    {crew.vehicles?.map((v: any) => (
                                        <Link key={v.id} href={`/rent/${v.id}`} className="bg-black aspect-square relative group overflow-hidden">
                                            <Image 
                                                src={v.image_url || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f'} 
                                                alt="v" fill className="object-cover opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" 
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent p-3 flex flex-col justify-end">
                                                <div className="text-[8px] font-black uppercase text-white truncate">{v.make}</div>
                                                <div className="text-[10px] font-black uppercase text-brand-cyan truncate leading-none">{v.model}</div>
                                                <div className="mt-2 text-[8px] text-red-500 font-black">{v.daily_price} XTR/Day</div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </div>

            {/* --- 3. BACKGROUND DECOR (Safety Sliced) --- */}
            <div className="max-w-7xl mx-auto px-4 py-20 text-center opacity-10 pointer-events-none select-none">
                <div className="text-[10vw] font-black font-orbitron leading-none italic text-zinc-900">
                    {displaySlug.slice(0, 10).toUpperCase()}
                </div>
            </div>
        </div>
    );
}