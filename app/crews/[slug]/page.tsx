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
    FaBolt, FaTerminal, FaPeopleGroup, FaWarehouse, FaCircleInfo 
} from 'react-icons/fa6';
import { cn } from '@/lib/utils';
import Link from "next/link";
import { useAppContext } from '@/contexts/AppContext';
import { toast } from 'sonner';
import { VibeMap } from '@/components/VibeMap';

export default function CrewDetailPage() {
    const { slug } = useParams();
    const router = useRouter();
    const { dbUser } = useAppContext();
    const [crew, setCrew] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
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
        <div className="min-h-screen bg-[#050505] text-white font-mono selection:bg-brand-cyan selection:text-black">
            
            {/* --- 1. RESPONSIVE HERO SECTION --- */}
            <div className="relative h-[45vh] w-full overflow-hidden border-b-2 border-zinc-800">
                <Image 
                    src={crew.vehicles?.[0]?.image_url || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f'} 
                    alt="cover" fill className="object-cover opacity-20 scale-105 blur-[2px]" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
                
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-8 md:p-12">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center md:items-end gap-6">
                        {/* Unit Icon */}
                        <motion.div 
                            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            className="w-24 h-24 sm:w-32 sm:h-32 bg-black border-4 border-zinc-800 shadow-[0_0_30px_rgba(0,0,0,0.5)] relative overflow-hidden"
                        >
                            <Image src={crew.logo_url || '/placeholder.svg'} alt="Logo" fill className="object-cover" />
                        </motion.div>

                        {/* Title Block - Responsive Width Fix */}
                        <div className="text-center md:text-left flex-1 min-w-0 w-full">
                            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                                    <h1 className="text-3xl sm:text-5xl lg:text-7xl font-black font-orbitron uppercase tracking-tighter leading-[0.8] truncate max-w-full drop-shadow-2xl">
                                        {crew.name}
                                    </h1>
                                    {isProvider && (
                                        <Badge className="bg-amber-600 border-none text-[10px] sm:text-xs font-black italic rounded-none px-3 animate-pulse">
                                            OFFICIAL_HOST
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center justify-center md:justify-start gap-4 text-[10px] sm:text-xs font-bold text-zinc-500 tracking-[0.2em] uppercase">
                                    <span>CID: {crew.id.split('-')[0]}</span>
                                    <span className="text-zinc-800">|</span>
                                    <span className="text-brand-cyan flex items-center gap-1">
                                        <FaMapLocationDot /> {crew.hq_location || "GRID_PENDING"}
                                    </span>
                                </div>
                            </motion.div>
                        </div>

                        {/* Action CTA */}
                        <div className="flex gap-2">
                             <Button onClick={handleJoin} className="bg-white text-black font-black uppercase text-xs rounded-none h-12 px-8 hover:bg-brand-cyan transition-all group">
                                <FaBolt className="mr-2 group-hover:animate-bounce" /> Enlist_Now
                             </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- 2. GRID CONTENT --- */}
            <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* SIDEBAR (Col 4) */}
                    <div className="lg:col-span-4 space-y-6">
                        
                        {/* FUND CARD: THE OUTCOME ENGINE */}
                        {isProvider && (
                            <motion.div 
                                initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                                className="bg-zinc-900 border border-amber-900/30 p-6 relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-24 h-24 opacity-5 pointer-events-none">
                                    <FaSackDollar className="w-full h-full rotate-12" />
                                </div>
                                
                                <div className="flex items-center gap-2 text-amber-500 mb-6">
                                    <FaSackDollar />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Unit_Teambuilding_Fund</span>
                                </div>

                                <div className="space-y-1">
                                    <div className="text-5xl font-black font-orbitron text-white">
                                        {totalBudget.toLocaleString()}<span className="text-xl ml-1 text-zinc-500">₽</span>
                                    </div>
                                    <div className="flex justify-between text-[9px] font-bold uppercase">
                                        <span className="text-zinc-500">Base_Alloc: {tbBudgetBase}</span>
                                        <span className="text-emerald-500">Dynamic_ROI: +{tbBudgetDynamic}</span>
                                    </div>
                                </div>

                                <div className="mt-6 space-y-2">
                                    <div className="h-1.5 bg-black w-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }} animate={{ width: '70%' }} 
                                            className="h-full bg-gradient-to-r from-amber-600 to-amber-400" 
                                        />
                                    </div>
                                    <p className="text-[8px] text-zinc-500 uppercase leading-relaxed italic">
                                        Outcome Status: 13% Revenue Mining Active. This unit earns social capital from every successful lobby execution.
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {/* MANIFESTO */}
                        <div className="bg-zinc-950 border border-zinc-900 p-6 space-y-4">
                            <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] flex items-center gap-2">
                                <FaTerminal className="text-brand-cyan" /> Unit_Manifesto
                            </h3>
                            <p className="text-sm text-zinc-400 leading-relaxed italic">
                                "{crew.description || "In the absence of orders, go find something and kill it."}"
                            </p>
                        </div>

                        {/* COMMANDER STATUS */}
                        <div className="grid grid-cols-2 gap-px bg-zinc-800 border border-zinc-800">
                            <div className="bg-black p-4">
                                <div className="text-[9px] text-zinc-600 font-black uppercase mb-1">Commander</div>
                                <Link href={`/profile/${crew.owner?.user_id}`} className="text-xs font-bold text-white hover:text-brand-cyan transition-colors">
                                    @{crew.owner?.username}
                                </Link>
                            </div>
                            <div className="bg-black p-4 text-right">
                                <div className="text-[9px] text-zinc-600 font-black uppercase mb-1">Status</div>
                                <div className="text-xs font-black text-emerald-500 uppercase animate-pulse">Ready_For_Ops</div>
                            </div>
                        </div>

                        {/* MAP PREVIEW */}
                        <div className="h-64 bg-zinc-900 border border-zinc-800 overflow-hidden grayscale contrast-125 brightness-75 hover:grayscale-0 transition-all duration-700">
                             <VibeMap 
                                points={[{ id: 'hq', name: 'HQ_POSITION', coords: [crew.hq_location?.split(',').map(Number) || [56.32, 44.00]], type: 'point', icon: '::FaSkull::', color: 'bg-red-600' }]}
                                bounds={{ top: 56.5, bottom: 56.0, left: 43.5, right: 44.5 }}
                             />
                        </div>
                    </div>

                    {/* MAIN CONTENT (Col 8) */}
                    <div className="lg:col-span-8">
                        <Tabs defaultValue={isProvider ? "services" : "roster"} className="w-full">
                            <TabsList className="w-full justify-start bg-transparent h-14 p-0 space-x-1 border-b border-zinc-900 rounded-none overflow-x-auto no-scrollbar">
                                {isProvider && (
                                    <TabsTrigger value="services" className="px-8 rounded-none h-full data-[state=active]:bg-amber-600 data-[state=active]:text-black font-black tracking-widest text-[10px]">
                                        SERVICES
                                    </TabsTrigger>
                                )}
                                <TabsTrigger value="roster" className="px-8 rounded-none h-full data-[state=active]:bg-brand-cyan data-[state=active]:text-black font-black tracking-widest text-[10px]">
                                    UNIT_ROSTER ({crew.members?.length})
                                </TabsTrigger>
                                <TabsTrigger value="garage" className="px-8 rounded-none h-full data-[state=active]:bg-red-600 data-[state=active]:text-black font-black tracking-widest text-[10px]">
                                    ARSENAL
                                </TabsTrigger>
                            </TabsList>

                            {/* SERVICES TAB */}
                            <TabsContent value="services" className="mt-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {services.length > 0 ? services.map((s: any) => (
                                        <motion.div 
                                            key={s.id} 
                                            whileHover={{ y: -5 }}
                                            className="bg-zinc-900/40 border border-zinc-800 hover:border-amber-500 transition-all group overflow-hidden"
                                        >
                                            <div className="h-44 relative overflow-hidden">
                                                <Image 
                                                    src={s.image_url || crew.logo_url || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f'} 
                                                    alt="s" fill className="object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-110" 
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
                                                <div className="absolute bottom-4 left-4">
                                                    <Badge className="bg-black/80 text-[8px] mb-2 rounded-none border-amber-600 text-amber-500">
                                                        MIN_FORCE: {s.min_players}
                                                    </Badge>
                                                    <h3 className="text-2xl font-black font-orbitron uppercase italic leading-none">{s.name}</h3>
                                                </div>
                                            </div>
                                            <div className="p-6 space-y-6">
                                                <p className="text-[10px] text-zinc-500 uppercase tracking-wider leading-relaxed h-12 overflow-hidden">
                                                    {s.description || "Mission details are currently classified. Contact commander for briefing."}
                                                </p>
                                                
                                                <div className="space-y-1.5">
                                                    {s.packages?.map((pkg: any) => (
                                                        <div key={pkg.id} className="flex justify-between items-center bg-black/60 p-3 border border-white/5 group-hover:border-amber-900/50 transition-colors">
                                                            <div>
                                                                <div className="text-[10px] font-black text-white uppercase tracking-tighter">{pkg.name}</div>
                                                                <div className="text-[8px] text-zinc-600 font-mono truncate max-w-[150px]">{pkg.includes}</div>
                                                            </div>
                                                            <div className="text-amber-500 font-black font-orbitron text-lg">{pkg.price}<span className="text-[10px] ml-1">₽</span></div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <Button 
                                                    onClick={() => router.push(`/strikeball?create=true&activity=${s.id}`)}
                                                    className="w-full bg-zinc-100 text-black font-black uppercase text-xs rounded-none h-12 hover:bg-amber-500 hover:text-white transition-all shadow-[0_5px_15px_rgba(255,255,255,0.05)]"
                                                >
                                                    Deploy_Operation
                                                </Button>
                                            </div>
                                        </motion.div>
                                    )) : (
                                        <div className="col-span-full py-20 text-center border-2 border-dashed border-zinc-900">
                                            <FaCircleInfo className="mx-auto text-4xl text-zinc-800 mb-4" />
                                            <p className="text-zinc-600 font-black uppercase text-xs">Service_Catalog_Offline</p>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            {/* ROSTER TAB */}
                            <TabsContent value="roster" className="mt-8">
                                <div className="space-y-2">
                                    {crew.members?.map((m: any) => (
                                        <div key={m.user_id} className="bg-zinc-950 border border-zinc-900 p-4 flex items-center justify-between group hover:border-brand-cyan transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-none bg-zinc-800 border border-zinc-700 overflow-hidden shrink-0 group-hover:border-brand-cyan transition-colors">
                                                    <img src={m.avatar_url || '/placeholder.svg'} className="w-full h-full object-cover" alt="avatar" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-white uppercase tracking-tighter">@{m.username}</span>
                                                        {m.role === 'owner' && <FaCrown className="text-amber-500 text-xs" />}
                                                    </div>
                                                    <div className="text-[8px] text-zinc-600 uppercase font-bold tracking-[0.2em]">
                                                        Rank: {m.role} // CID: {m.user_id.slice(0,8).toUpperCase()}
                                                    </div>
                                                </div>
                                            </div>
                                            <Badge className="bg-zinc-900 text-emerald-500 border-none font-black text-[8px] animate-pulse">ACTIVE</Badge>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>

                            {/* GARAGE/ARSENAL TAB */}
                            <TabsContent value="garage" className="mt-8">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 bg-zinc-900 border border-zinc-900">
                                    {crew.vehicles?.map((v: any) => (
                                        <Link key={v.id} href={`/rent/${v.id}`} className="bg-black aspect-square relative group overflow-hidden">
                                            <Image 
                                                src={v.image_url || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f'} 
                                                alt="v" fill className="object-cover opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" 
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent p-3 flex flex-col justify-end">
                                                <span className="text-[9px] font-black uppercase truncate text-white">{v.make}</span>
                                                <span className="text-[10px] font-black uppercase truncate text-brand-cyan">{v.model}</span>
                                                <div className="mt-1 text-[8px] text-red-500 font-bold">{v.daily_price} XTR/Day</div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </TabsContent>

                        </Tabs>
                    </div>
                </div>
            </div>

            {/* --- FOOTER DECOR --- */}
            <div className="max-w-7xl mx-auto px-4 py-20 text-center opacity-20 pointer-events-none">
                <div className="text-[15vw] font-black font-orbitron leading-none select-none italic text-zinc-900">
                    {crew.slug.slice(0, 8).toUpperCase()}
                </div>
            </div>
        </div>
    );
}