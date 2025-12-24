"use client";

import { getAllPublicCrews, getMapPresets } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { VibeMap, MapBounds, PointOfInterest } from '@/components/VibeMap';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FaShieldHalved, FaWarehouse, FaSackDollar, FaMapPin, FaAngleRight, FaPlus } from 'react-icons/fa6';
import { cn } from "@/lib/utils";

const Metric = ({ icon: Icon, value, label, color }: any) => (
    <div className="flex flex-col items-center p-2 bg-black/40 border border-white/5 rounded-sm">
        <Icon className={cn("text-lg mb-1", color || "text-zinc-500")} />
        <span className="text-lg font-black font-orbitron leading-none">{value}</span>
        <span className="text-[7px] uppercase font-mono tracking-tighter text-zinc-600 mt-1">{label}</span>
    </div>
);

function CrewsList() {
    const [crews, setCrews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    useEffect(() => {
        getAllPublicCrews().then(res => {
            if (res.success) setCrews(res.data || []);
            setLoading(false);
        });
    }, []);

    if (loading) return <Loading variant="bike" text="SCANNING SQUAD FREQUENCIES..." />;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4 lg:h-[80vh] overflow-y-auto no-scrollbar pr-2">
                {crews.map((crew, idx) => {
                    const isProvider = crew.metadata?.is_provider;
                    return (
                        <motion.div
                            key={crew.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            onMouseEnter={() => setHoveredId(crew.id)}
                            onMouseLeave={() => setHoveredId(null)}
                        >
                            <Link href={`/crews/${crew.slug}`} className="block group">
                                <div className={cn(
                                    "relative bg-zinc-900/80 border-2 transition-all duration-300 p-4 overflow-hidden",
                                    isProvider ? "border-amber-900/50 hover:border-amber-500" : "border-zinc-800 hover:border-cyan-500"
                                )}>
                                    {/* Decoration */}
                                    <div className="absolute top-0 right-0 p-1 opacity-10 font-black text-4xl select-none uppercase italic">
                                        {isProvider ? "ZONE" : "UNIT"}
                                    </div>

                                    <div className="flex gap-4 relative z-10">
                                        <div className="w-16 h-16 bg-black border border-zinc-700 shrink-0 overflow-hidden relative">
                                            <Image src={crew.logo_url || '/placeholder.svg'} alt="Logo" fill className="object-cover grayscale group-hover:grayscale-0 transition-all" />
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h2 className={cn(
                                                    "text-xl font-black font-orbitron italic truncate",
                                                    isProvider ? "text-amber-500" : "text-white group-hover:text-cyan-400"
                                                )}>{crew.name}</h2>
                                                {isProvider && <Badge className="bg-amber-600 text-[8px] h-4">PRO-HOST</Badge>}
                                            </div>
                                            <p className="text-[10px] text-zinc-500 font-mono line-clamp-2 leading-tight uppercase">
                                                {crew.description || "No mission brief provided."}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-4 gap-2 mt-4">
                                        <Metric icon={FaShieldHalved} value={crew.member_count} label="Operators" color={!isProvider ? "text-cyan-500" : ""} />
                                        <Metric icon={FaWarehouse} value={crew.vehicle_count} label="Arsenal" color={isProvider ? "text-amber-500" : ""} />
                                        <Metric icon={FaMapPin} value="HQ" label="Position" />
                                        <div className="flex items-center justify-center group-hover:bg-white group-hover:text-black bg-zinc-800 transition-colors">
                                            <FaAngleRight />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    );
                })}
            </div>

            <div className="hidden lg:block sticky top-24 h-[70vh] bg-black border border-zinc-800">
                 <VibeMap 
                    points={crews.filter(c => c.hq_location).map(c => ({
                        id: c.id,
                        name: c.name,
                        coords: [c.hq_location.split(',').map(Number)],
                        type: 'point',
                        icon: c.metadata?.is_provider ? '::FaStar::' : '::FaSkull::',
                        color: c.metadata?.is_provider ? 'bg-amber-600' : 'bg-cyan-600'
                    }))} 
                    highlightedPointId={hoveredId}
                    bounds={{ top: 56.4242, bottom: 56.08, left: 43.66, right: 44.1230 }}
                />
            </div>
        </div>
    );
}

export default function CrewsPage() {
    return (
        <div className="min-h-screen bg-[#050505] text-white pt-24 px-4 pb-32">
            <div className="max-w-7xl mx-auto">
                <div className="mb-10 text-center lg:text-left">
                    <h1 className="text-6xl font-black font-orbitron italic tracking-tighter uppercase drop-shadow-2xl">
                        Network_<span className="text-cyan-500">Crews</span>
                    </h1>
                    <p className="text-xs font-mono text-zinc-500 tracking-[0.4em] mt-2">GLOBAL_SQUAD_DATABASE_ACCESS_GRANTED</p>
                </div>
                <CrewsList />
            </div>
            <Link href="/crews/create" className="fixed bottom-24 right-6 z-50">
                <Button className="w-16 h-16 rounded-none bg-red-600 border-2 border-white text-white hover:bg-white hover:text-black transition-all rotate-45 shadow-[0_0_20px_rgba(220,38,38,0.5)]">
                    <FaPlus className="-rotate-45 text-2xl" />
                </Button>
            </Link>
        </div>
    );
}