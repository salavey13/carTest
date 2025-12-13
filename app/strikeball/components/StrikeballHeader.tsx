"use client";

import Link from "next/link";
import { useAppContext } from "@/contexts/AppContext";
import { motion } from "framer-motion";
import { FaWifi, FaUserAstronaut, FaSkull } from "react-icons/fa6";
import { cn } from "@/lib/utils";

export default function StrikeballHeader() {
  const { user } = useAppContext();

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 80, damping: 15 }}
      className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
    >
      {/* 1. Top Bar Background (Glassmorphism + Border) */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md border-b-2 border-red-900 pointer-events-auto h-16 shadow-[0_5px_20px_rgba(255,0,0,0.1)]">
        
        {/* Ticker Tape */}
        <div className="h-5 bg-red-950/40 border-b border-red-900/30 overflow-hidden flex items-center">
           <motion.div 
             className="whitespace-nowrap text-[9px] font-mono text-red-400/80 uppercase tracking-widest pl-4"
             animate={{ x: ["0%", "-100%"] }}
             transition={{ repeat: Infinity, duration: 30, ease: "linear" }}
           >
             /// CONNECTED TO STRIKEBALL.NET /// REGION: CIS /// LATENCY: 24ms /// OPERATOR: {user?.username || "GUEST"} /// READY TO FRAG ///
           </motion.div>
        </div>

        {/* Main Content Row */}
        <div className="container mx-auto px-4 h-11 flex items-center justify-between">
          
          {/* BRAND */}
          <Link href="/strikeball" className="flex items-center gap-3 group">
            <div className="relative w-8 h-8 flex items-center justify-center bg-zinc-900 border border-red-700 rounded-sm group-hover:bg-red-700 transition-colors duration-300">
              <span className="font-orbitron font-black text-white italic text-sm">SB</span>
              {/* Tech Bits */}
              <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-red-500 opacity-50" />
              <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-red-500 opacity-50" />
            </div>
            <div>
              <h1 className="font-orbitron font-black text-lg leading-none text-zinc-100 italic tracking-tighter shadow-black drop-shadow-md">
                STRIKE<span className="text-red-600">BALL</span>
              </h1>
            </div>
          </Link>

          {/* STATUS MODULE */}
          <div className="flex items-center gap-4">
            
            {/* Ping / Net Graph */}
            <div className="hidden sm:flex flex-col items-end">
               <div className="flex gap-0.5 items-end h-3">
                  <div className="w-1 h-1 bg-emerald-600" />
                  <div className="w-1 h-2 bg-emerald-600" />
                  <div className="w-1 h-3 bg-emerald-500 animate-pulse" />
               </div>
               <span className="text-[8px] font-mono text-emerald-500/80">ONLINE</span>
            </div>

            {/* Profile Badge */}
            <Link href="/profile" className="flex items-center gap-2 pl-4 border-l border-zinc-800">
               <div className="text-right hidden xs:block">
                 <div className="text-[10px] font-bold text-zinc-300 leading-none tracking-wider">
                   {user?.username?.toUpperCase() || "RECRUIT"}
                 </div>
                 <div className="text-[8px] text-red-500 font-mono leading-none mt-0.5">
                   TIER 1
                 </div>
               </div>
               <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:border-red-500 transition-all">
                 {user?.photo_url ? (
                   <img src={user.photo_url} alt="Profile" className="w-full h-full object-cover opacity-80" />
                 ) : (
                   <FaUserAstronaut />
                 )}
               </div>
            </Link>

          </div>
        </div>
      </div>
    </motion.header>
  );
}