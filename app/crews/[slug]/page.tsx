"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getCrewLiveDetails } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FaCrown, FaShieldHalved, FaSackDollar, FaMapLocationDot, FaAnglesRight, FaListCheck } from 'react-icons/fa6';
import { cn } from '@/lib/utils';

export default function CrewDetailPage() {
    const { slug } = useParams();
    const [crew, setCrew] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getCrewLiveDetails(slug as string).then(res => {
            if (res.success) setCrew(res.data);
            setLoading(false);
        });
    }, [slug]);

    if (loading) return <Loading variant="bike" text="SYNCING COMMAND CENTER..." />;
    if (!crew) return <div className="pt-40 text-center text-red-500 font-orbitron">ERROR: UNIT_DATA_CORRUPT</div>;

    const meta = crew.metadata || {};
    const isProvider = meta.is_provider;
    const services = meta.services || [];
    const baseBudget = meta.teambuilding_budget_base || 0;
    const dynamicBudget = meta.teambuilding_budget_dynamic || 0;
    const totalBudget = baseBudget + dynamicBudget;

    return (
        <div className="min-h-screen bg-[#020202] text-white font-mono">
            {/* 1. HERO SECTION - Fixed width title for mobile */}
            <div className="relative h-[50vh] md:h-[40vh] w-full overflow-hidden">
                <Image src={crew.vehicles?.[0]?.image_url || 'https://images.unsplash.com/photo-1542281286-9e0a16bb7366'} alt="bg" fill className="object-cover opacity-30 blur-sm" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#020202] via-[#020202]/40 to-transparent" />
                
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center md:items-end gap-6">
                        <div className="w-24 h-24 md:w-32 md:h-32 bg-black border-4 border-zinc-800 shadow-2xl shrink-0 relative overflow-hidden">
                            <Image src={crew.logo_url || '/placeholder.svg'} alt="Logo" fill className="object-cover" />
                        </div>
                        <div className="text-center md:text-left flex-1 min-w-0">
                            <div className="flex flex-col md:flex-row items-center gap-3">
                                <h1 className="text-3xl sm:text-4xl md:text-6xl font-black font-orbitron uppercase tracking-tighter leading-none truncate max-w-full">
                                    {crew.name}
                                </h1>
                                {isProvider && <Badge className="bg-amber-600 font-black animate-pulse">PRO_HOST</Badge>}
                            </div>
                            <p className="text-zinc-500 font-bold tracking-[0.2em] mt-2 uppercase text-[10px] md:text-xs">
                                CID: {crew.id.split('-')[0]} // LOC: {crew.hq_location || "SECURE_ZONE"}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    
                    {/* LEFT SIDEBAR: INTEL & FUNDS */}
                    <div className="space-y-6">
                        {isProvider && (
                            <motion.div 
                                initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                                className="bg-zinc-900 border-l-4 border-amber-500 p-6 shadow-2xl"
                            >
                                <div className="flex items-center gap-2 text-amber-500 mb-4">
                                    <FaSackDollar />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Teambuilding_Fund</span>
                                </div>
                                <div className="text-4xl font-black font-orbitron mb-1">{totalBudget.toLocaleString()} ₽</div>
                                <div className="flex justify-between text-[8px] font-bold text-zinc-600 uppercase mb-4">
                                    <span>Base: {baseBudget}</span>
                                    <span>Mined: {dynamicBudget}</span>
                                </div>
                                <div className="h-1 bg-zinc-800 w-full rounded-full overflow-hidden">
                                    <motion.div className="h-full bg-amber-500" initial={{ width: 0 }} animate={{ width: '45%' }} />
                                </div>
                                <p className="text-[7px] text-zinc-500 mt-3 italic uppercase leading-relaxed">
                                    * Outcome-based growth: 13% of all hosted lobby revenue automatically fuels this fund.
                                </p>
                            </motion.div>
                        )}

                        <div className="bg-zinc-950 border border-zinc-800 p-6">
                            <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <FaListCheck /> Mission_Manifesto
                            </h3>
                            <p className="text-sm text-zinc-400 italic leading-relaxed">
                                "{crew.description || "No mission description provided by commander."}"
                            </p>
                        </div>
                    </div>

                    {/* MAIN CONTENT: SERVICES OR ROSTER */}
                    <div className="lg:col-span-2">
                        <Tabs defaultValue={isProvider ? "services" : "roster"} className="w-full">
                            <TabsList className="bg-zinc-900 w-full justify-start rounded-none h-14 p-0 border-b-2 border-zinc-800 overflow-x-auto no-scrollbar">
                                {isProvider && (
                                    <TabsTrigger value="services" className="px-8 rounded-none h-full data-[state=active]:bg-amber-600 font-black tracking-widest text-xs">
                                        SERVICES
                                    </TabsTrigger>
                                )}
                                <TabsTrigger value="roster" className="px-8 rounded-none h-full data-[state=active]:bg-brand-cyan font-black tracking-widest text-xs">
                                    UNIT_ROSTER ({crew.members?.length})
                                </TabsTrigger>
                                <TabsTrigger value="garage" className="px-8 rounded-none h-full data-[state=active]:bg-red-600 font-black tracking-widest text-xs">
                                    ARSENAL
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="services" className="mt-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {services.map((s: any) => (
                                        <div key={s.id} className="bg-zinc-900/50 border border-zinc-800 group hover:border-amber-500 transition-all">
                                            <div className="h-40 relative overflow-hidden">
                                                <Image src={s.image_url || crew.logo_url || '/placeholder.svg'} alt="s" fill className="object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                                                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent" />
                                                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                                                    <span className="text-2xl font-black font-orbitron uppercase italic">{s.name}</span>
                                                </div>
                                            </div>
                                            <div className="p-5 space-y-4">
                                                <p className="text-[10px] text-zinc-500 uppercase leading-tight">{s.description}</p>
                                                <div className="space-y-1">
                                                    {s.packages?.map((pkg: any) => (
                                                        <div key={pkg.id} className="flex justify-between items-center bg-black/40 p-2 border border-white/5">
                                                            <div className="text-[9px] font-bold uppercase">{pkg.name}</div>
                                                            <div className="text-amber-500 font-black font-orbitron">{pkg.price} ₽</div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <Button className="w-full bg-amber-600 hover:bg-white hover:text-black font-black uppercase text-[10px] tracking-widest rounded-none h-10">
                                                    Deploy Operation
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="roster" className="mt-8 space-y-2">
                                {crew.members?.map((m: any) => (
                                    <div key={m.user_id} className="bg-zinc-950 border border-zinc-900 p-4 flex items-center justify-between group hover:border-brand-cyan transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-none bg-zinc-800 border border-zinc-700 overflow-hidden shrink-0">
                                                <img src={m.avatar_url || '/placeholder.svg'} className="w-full h-full object-cover" />
                                            </div>
                                            <div>
                                                <div className="font-bold uppercase tracking-tighter">@{m.username}</div>
                                                <div className="text-[8px] text-zinc-600 uppercase font-mono">{m.role} // CID_{m.user_id.slice(0,5)}</div>
                                            </div>
                                        </div>
                                        {m.role === 'owner' && <FaCrown className="text-amber-500" />}
                                    </div>
                                ))}
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </div>
        </div>
    );
}