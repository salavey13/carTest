"use client";

import Link from "next/link";
import { useAppContext } from "@/contexts/AppContext";
import { motion } from "framer-motion";
import { FaWifi, FaUserSecret } from "react-icons/fa6";
import { cn } from "@/lib/utils";

export default function StrikeballHeader() {
  const { user } = useAppContext();

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b-2 border-red-900 text-white font-orbitron"
    >
      {/* Ticker Line */}
      <div className="bg-red-950/50 w-full overflow-hidden whitespace-nowrap border-b border-red-800/30 h-6 flex items-center">
        <motion.div 
          className="inline-block text-[10px] font-mono text-red-400 tracking-widest py-0.5"
          animate={{ x: ["100%", "-100%"] }}
          transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
        >
          /// SKIRMISH_OS v2.0 /// SATELLITE UPLINK: STABLE /// WEATHER: OPTIMAL /// WELCOME COMMANDER {user?.username?.toUpperCase() || "GUEST"} /// PREPARE FOR DEPLOYMENT /// NO CHEATING ALLOWED ///
        </motion.div>
      </div>

      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        
        {/* Brand */}
        <Link href="/strikeball" className="group flex items-center gap-3">
          <div className="relative w-10 h-10 flex items-center justify-center bg-zinc-900 border-2 border-red-600 rounded-sm group-hover:bg-red-600 transition-colors">
            <span className="text-xl font-black italic">Q</span>
            {/* Tech Decoration */}
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/50" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/50" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tighter leading-none text-zinc-100 group-hover:text-red-500 transition-colors italic">
              ARENA
            </span>
            <span className="text-[9px] tracking-[0.2em] text-red-500 font-mono">TACTICAL.NET</span>
          </div>
        </Link>

        {/* HUD Elements */}
        <div className="flex items-center gap-4">
          
          {/* Signal Strength */}
          <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-emerald-500">
            <span className="animate-pulse">PING: 24ms</span>
            <FaWifi />
          </div>

          {/* User Status */}
          <Link href="/profile">
            <div className="flex items-center gap-2 pl-4 border-l border-zinc-800">
              <div className="text-right hidden xs:block">
                <div className="text-[10px] font-bold text-zinc-300 leading-none">
                  {user?.username?.toUpperCase() || "UNKNOWN"}
                </div>
                <div className="text-[8px] text-red-500 font-mono leading-none mt-0.5">
                  STATUS: ACTIVE
                </div>
              </div>
              <div className="w-9 h-9 bg-zinc-900 border border-zinc-700 rounded-sm flex items-center justify-center text-zinc-400 hover:text-red-500 hover:border-red-500 transition-colors">
                <FaUserSecret />
              </div>
            </div>
          </Link>
        </div>
      </div>
    </motion.header>
  );
}