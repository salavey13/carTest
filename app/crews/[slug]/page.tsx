"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getCrewLiveDetails } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FaCrown, FaShieldHalved, FaSackDollar, FaTerminal, FaMapLocationDot, FaBolt } from 'react-icons/fa6';
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

    if (loading) return <Loading variant="bike" text="DECRYPTING CREW_INTEL..." />;
    if (!crew) return <div className="pt-40 text-center text-red-500 font-black">CREW_NOT_FOUND</div>;

    const isProvider = crew.metadata?.is_provider;
    const services = crew.metadata?.services || [];
    const tbBudget = (crew.metadata?.teambuilding_budget_base || 0) + (crew.metadata?.teambuilding_budget_dynamic || 0);

    return (
        <div className="min-h-screen bg-black text-white font-mono">
            {/* 1. HERO HEADER */}
            <div className="relative h-[40vh] w-full overflow-hidden border-b-4 border-zinc-900">
                <Image 
                    src={crew.vehicles?.[0]?.image_url || 'https://images.unsplash.com/photo-1532074534361-bb09a38ca917?q=80&w=2000'} 
                    alt="Cover" fill className="object-cover opacity-40 blur-sm scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                
                <div className="absolute bottom-8 left-8 flex items-end gap-6">
                    <div className="w-32 h-32 bg-black border-4 border-zinc-800 shadow-2xl relative">
                        <Image src={crew.logo_url || '/placeholder.svg'} alt="Logo" fill className="object-cover" />
                    </div>
                    <div className="pb-2">
                        <div className="flex items-center gap-3">
                            <h1 className="text-5xl font-black font-orbitron uppercase tracking-tighter">{crew.name}</h1>
                            {isProvider && <Badge className="bg-amber-600 font-black italic">PROVIDER_UNLOCKED</Badge>}
                        </div>
                        <p className="text-zinc-500 font-bold tracking-widest mt-1 uppercase">HQ_LOC: {crew.hq_location || "CLASSIFIED"}</p>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    
                    {/* LEFT COL: STATS & BUDGET */}
                    <div className="space-y-8">
                        {isProvider && (
                            <motion.div 
                                initial={{ scale: 0.9, opacity: 0 }} 
                                animate={{ scale: 1, opacity: 1 }}
                                className="p-6 bg-zinc-900 border-l-4 border-amber-500 shadow-[20px_20px_0_rgba(245,158,11,0.05)]"
                            >
                                <div className="flex items-center gap-2 text-amber-500 mb-2">
                                    <FaSackDollar />
                                    <span className="text-[10px] font-black uppercase tracking-widest">TeamBuilding_Fund</span>
                                </div>
                                <div className="text-4xl font-black font-orbitron">{tbBudget.toLocaleString()} ₽</div>
                                <div className="mt-4 h-1 bg-zinc-800 w-full overflow-hidden">
                                    <motion.div 
                                        className="h-full bg-amber-500" 
                                        initial={{ width: 0 }} animate={{ width: '65%' }} 
                                    />
                                </div>
                                <p className="text-[8px] text-zinc-600 mt-2 uppercase italic">Funded by 13% transaction mining from active lobbies.</p>
                            </motion.div>
                        )}

                        <div className="bg-zinc-950 border border-zinc-800 p-6 space-y-4">
                            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-900 pb-2">Manifesto</h3>
                            <p className="text-sm text-zinc-400 italic leading-relaxed">"{crew.description || "The mission is everything."}"</p>
                        </div>

                        <div className="grid grid-cols-2 gap-px bg-zinc-800 border border-zinc-800">
                            <div className="bg-black p-4 text-center">
                                <div className="text-xs text-zinc-600 uppercase font-bold">Commander</div>
                                <div className="text-sm font-bold text-cyan-500">@{crew.owner?.username}</div>
                            </div>
                            <div className="bg-black p-4 text-center">
                                <div className="text-xs text-zinc-600 uppercase font-bold">Status</div>
                                <div className="text-sm font-bold text-emerald-500 uppercase tracking-widest animate-pulse">Online</div>
                            </div>
                        </div>
                    </div>

                    {/* MAIN COL: SERVICES OR ROSTER */}
                    <div className="lg:col-span-2">
                        <Tabs defaultValue={isProvider ? "services" : "roster"} className="w-full">
                            <TabsList className="bg-zinc-900 w-full justify-start rounded-none h-12 p-0 border-b border-zinc-800">
                                {isProvider && <TabsTrigger value="services" className="px-8 rounded-none data-[state=active]:bg-amber-600 font-black">SERVICES</TabsTrigger>}
                                <TabsTrigger value="roster" className="px-8 rounded-none data-[state=active]:bg-cyan-600 font-black">ROSTER ({crew.members?.length})</TabsTrigger>
                                <TabsTrigger value="garage" className="px-8 rounded-none data-[state=active]:bg-red-600 font-black">GARAGE</TabsTrigger>
                            </TabsList>

                            <TabsContent value="services" className="mt-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {services.map((s: any) => (
                                        <div key={s.id} className="bg-zinc-950 border border-zinc-800 hover:border-amber-500 transition-colors group">
                                            <div className="p-4 border-b border-zinc-900 flex justify-between items-center">
                                                <span className="text-lg font-black font-orbitron text-white uppercase tracking-tighter">{s.name}</span>
                                                <Badge className="bg-zinc-800">{s.min_players}+ Players</Badge>
                                            </div>
                                            <div className="p-4 space-y-3">
                                                {s.packages?.map((pkg: any) => (
                                                    <div key={pkg.id} className="flex justify-between items-center bg-black/40 p-3 border border-white/5">
                                                        <div>
                                                            <div className="text-[10px] font-black text-white uppercase">{pkg.name}</div>
                                                            <div className="text-[8px] text-zinc-500">{pkg.includes}</div>
                                                        </div>
                                                        <div className="text-amber-500 font-black">{pkg.price} ₽</div>
                                                    </div>
                                                ))}
                                                <Button className="w-full rounded-none bg-zinc-100 text-black font-black uppercase text-xs hover:bg-amber-500 hover:text-white transition-all">
                                                    Deploy Mission
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="roster" className="mt-8 space-y-2">
                                {crew.members?.map((m: any) => (
                                    <div key={m.user_id} className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-900 group hover:border-cyan-500 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full border-2 border-zinc-800 overflow-hidden group-hover:border-cyan-500">
                                                <img src={m.avatar_url || '/placeholder.svg'} className="w-full h-full object-cover" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-white uppercase tracking-tighter">@{m.username}</div>
                                                <div className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest">{m.role} // CID_{m.user_id.slice(0,6)}</div>
                                            </div>
                                        </div>
                                        {m.role === 'owner' && <FaCrown className="text-amber-500" />}
                                    </div>
                                ))}
                            </TabsContent>

                            <TabsContent value="garage" className="mt-8">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-zinc-900 border border-zinc-900">
                                    {crew.vehicles?.map((v: any) => (
                                        <Link key={v.id} href={`/rent/${v.id}`} className="bg-black aspect-square relative group overflow-hidden">
                                            <Image src={v.image_url} alt="v" fill className="object-cover opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent p-2 flex flex-col justify-end">
                                                <span className="text-[10px] font-black uppercase truncate">{v.make} {v.model}</span>
                                                <span className="text-[8px] text-red-500 font-mono">{v.daily_price} XTR/Day</span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </div>
        </div>
    );
}