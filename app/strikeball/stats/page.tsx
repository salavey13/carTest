"use client";

import React, { useEffect, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { motion } from "framer-motion";
import { FaSkull, FaCrosshairs, FaMedal, FaPersonRifle, FaClock } from "react-icons/fa6";
import Image from "next/image";
import { cn } from "@/lib/utils";

// Mock Data for "Fake" stats until we have a match history table
const MOCK_STATS = {
    matches: 0,
    wins: 0,
    kd: "0.0",
    accuracy: "N/A",
    favoriteWeapon: "NOT ASSIGNED"
};

const StatCard = ({ label, value, icon: Icon, color, delay }: any) => (
    <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.5 }}
        className="bg-zinc-900/80 border border-zinc-800 p-4 flex items-center justify-between group hover:border-red-500/50 transition-colors"
    >
        <div>
            <div className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase mb-1">{label}</div>
            <div className={cn("text-2xl font-black font-orbitron", color)}>{value}</div>
        </div>
        <div className="p-3 bg-black/50 rounded-sm border border-zinc-800 group-hover:border-red-500/30">
            <Icon className={cn("w-6 h-6", color)} />
        </div>
    </motion.div>
);

export default function StatsPage() {
    const { user, userCrewInfo } = useAppContext();
    const [stats, setStats] = useState(MOCK_STATS);

    // In a real app, you'd fetch stats from `lobby_members` history here
    
    return (
        <div className="pt-28 pb-32 px-4 min-h-screen text-white font-orbitron">
            
            {/* Header */}
            <div className="text-center mb-10">
                <h1 className="text-4xl font-black text-red-600 tracking-tighter uppercase drop-shadow-lg">
                    ЛИЧНОЕ ДЕЛО
                </h1>
                <div className="text-[10px] font-mono text-zinc-500 bg-zinc-900/80 inline-block px-4 py-1 mt-2 border border-zinc-800">
                    ID: {user?.id || "UNKNOWN"} // STATUS: ACTIVE
                </div>
            </div>

            {/* Operator Card */}
            <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="max-w-2xl mx-auto bg-black/60 backdrop-blur-md border-2 border-zinc-800 p-6 mb-8 relative overflow-hidden"
            >
                {/* Decorative scanning line */}
                <motion.div 
                    className="absolute top-0 left-0 right-0 h-1 bg-red-500/50 blur-sm z-0"
                    animate={{ top: ["0%", "100%"] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />

                <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
                    <div className="w-24 h-24 bg-zinc-900 border-2 border-red-900 flex-shrink-0 relative">
                        {user?.photo_url ? (
                            <Image src={user.photo_url} alt="User" fill className="object-cover grayscale hover:grayscale-0 transition-all" />
                        ) : (
                            <div className="flex items-center justify-center h-full text-zinc-700 text-4xl">?</div>
                        )}
                        <div className="absolute bottom-0 right-0 bg-red-600 text-white text-[9px] font-bold px-1">LVL 1</div>
                    </div>
                    
                    <div className="text-center sm:text-left">
                        <h2 className="text-2xl font-bold text-zinc-100">{user?.username || "OPERATOR"}</h2>
                        <div className="text-sm font-mono text-red-400 mt-1">
                            {userCrewInfo ? `SQUAD: ${userCrewInfo.name.toUpperCase()}` : "NO SQUAD AFFILIATION"}
                        </div>
                        <div className="flex gap-2 mt-3 justify-center sm:justify-start">
                            <span className="px-2 py-0.5 bg-zinc-800 text-[10px] text-zinc-400 border border-zinc-700">ASSAULT</span>
                            <span className="px-2 py-0.5 bg-zinc-800 text-[10px] text-zinc-400 border border-zinc-700">RECON</span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="max-w-2xl mx-auto grid grid-cols-2 gap-3 mb-8">
                <StatCard label="МАТЧЕЙ" value={stats.matches} icon={FaClock} color="text-zinc-300" delay={0.1} />
                <StatCard label="ПОБЕД" value={stats.wins} icon={FaMedal} color="text-amber-500" delay={0.2} />
                <StatCard label="K/D RATIO" value={stats.kd} icon={FaSkull} color="text-red-500" delay={0.3} />
                <StatCard label="ТОЧНОСТЬ" value={stats.accuracy} icon={FaCrosshairs} color="text-cyan-500" delay={0.4} />
            </div>

            {/* Performance Graph Placeholder */}
            <div className="max-w-2xl mx-auto">
                <div className="bg-zinc-900/40 border border-zinc-800 p-4 relative">
                    <h3 className="text-xs font-mono text-zinc-500 mb-4 uppercase">Боевая Эффективность (Симуляция)</h3>
                    
                    <div className="h-32 flex items-end gap-1">
                        {[...Array(20)].map((_, i) => {
                            const height = Math.floor(Math.random() * 80) + 10;
                            return (
                                <motion.div 
                                    key={i}
                                    initial={{ height: 0 }}
                                    animate={{ height: `${height}%` }}
                                    transition={{ delay: i * 0.05, duration: 0.5 }}
                                    className="flex-1 bg-red-900/50 hover:bg-red-500 transition-colors border-t border-red-500/30"
                                />
                            )
                        })}
                    </div>
                    
                    {/* Grid lines */}
                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:100%_20px]" />
                </div>
                <p className="text-[10px] text-zinc-600 font-mono mt-2 text-center">
                    * Данные обновляются после подтверждения результатов командиром лобби.
                </p>
            </div>

        </div>
    );
}