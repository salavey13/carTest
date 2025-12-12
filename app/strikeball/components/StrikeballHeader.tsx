"use client";

import Link from "next/link";
import { useAppContext } from "@/contexts/AppContext";
import { motion } from "framer-motion";
import { FaWifi, FaBatteryFull, FaUserAstronaut } from "react-icons/fa6";
import { cn } from "@/lib/utils";

export default function StrikeballHeader() {
  const { user } = useAppContext();

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/90 backdrop-blur-md border-b-2 border-red-900/50 text-white font-orbitron"
    >
      {/* Top Ticker Line */}
      <div className="bg-red-950/30 w-full overflow-hidden whitespace-nowrap border-b border-red-900/30">
        <motion.div 
          className="inline-block text-[9px] font-mono text-red-400/80 py-0.5 px-4"
          animate={{ x: ["100%", "-100%"] }}
          transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
        >
          SYSTEM ONLINE // WEATHER: CLEAR // SATELLITE UPLINK: ESTABLISHED // WELCOME OPERATOR {user?.username?.toUpperCase() || "GUEST"} // PREPARE FOR DEPLOYMENT //
        </motion.div>
      </div>

      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        
        {/* Left: Brand / Home Link */}
        <Link href="/strikeball" className="group flex items-center gap-3">
          <div className="relative w-8 h-8 flex items-center justify-center bg-red-900/20 border border-red-600 rounded-sm group-hover:bg-red-600 transition-colors">
            <span className="text-lg font-black italic">S</span>
            {/* Corner decorations */}
            <div className="absolute -top-px -left-px w-1 h-1 bg-red-500" />
            <div className="absolute -bottom-px -right-px w-1 h-1 bg-red-500" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black tracking-tighter leading-none text-zinc-100 group-hover:text-red-500 transition-colors">
              SB<span className="text-red-600">OPS</span>
            </span>
            <span className="text-[8px] tracking-[0.3em] text-zinc-500 font-mono">TACTICAL</span>
          </div>
        </Link>

        {/* Right: HUD Status Elements */}
        <div className="flex items-center gap-4">
          
          {/* Connection Status */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-emerald-500/80">
            <span className="animate-pulse">ONLINE</span>
            <FaWifi />
          </div>

          {/* User Badge */}
          <Link href="/profile">
            <div className="flex items-center gap-2 pl-4 border-l border-zinc-800">
              <div className="text-right hidden xs:block">
                <div className="text-[10px] font-bold text-zinc-300 leading-none">
                  {user?.username || "UNKNOWN"}
                </div>
                <div className="text-[8px] text-red-500 font-mono leading-none mt-0.5">
                  LVL 1 OPERATOR
                </div>
              </div>
              <div className="w-8 h-8 bg-zinc-900 border border-zinc-700 rounded-sm flex items-center justify-center text-zinc-400">
                <FaUserAstronaut />
              </div>
            </div>
          </Link>
        </div>
      </div>
      
      {/* Decorative Bottom scanline */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
    </motion.header>
  );
}