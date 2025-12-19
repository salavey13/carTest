"use client";

import Link from "next/link";
import { useAppContext } from "@/contexts/AppContext";
import { motion } from "framer-motion";
import { FaWifi, FaUserAstronaut, FaStopwatch, FaCrosshairs } from "react-icons/fa6";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export default function StrikeballHeader() {
  const { user, activeLobby } = useAppContext(); // Consuming global context
  const [elapsed, setElapsed] = useState("00:00");

  // Local UI Timer (Ticks every second based on context data)
  useEffect(() => {
      if (!activeLobby?.actual_start_at) {
          setElapsed("00:00");
          return;
      }
      
      const start = new Date(activeLobby.actual_start_at).getTime();
      
      const updateTimer = () => {
          const now = new Date().getTime();
          const diff = now - start;
          
          if (diff < 0) {
              setElapsed("00:00");
              return;
          }

          const h = Math.floor(diff / (1000 * 60 * 60));
          const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const s = Math.floor((diff % (1000 * 60)) / 1000);

          if (h > 0) {
              setElapsed(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
          } else {
              setElapsed(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
          }
      };

      updateTimer(); 
      const interval = setInterval(updateTimer, 1000);

      return () => clearInterval(interval);
  }, [activeLobby]);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 80, damping: 15 }}
      className={cn(
          "fixed top-0 left-0 right-0 z-50 pointer-events-none transition-colors duration-500",
          // Ghost Vis: More intense header if active
          activeLobby ? "bg-black/95 border-b-2 border-red-600" : "bg-black/80 border-b-2 border-red-900"
      )}
    >
      <div className="absolute inset-0 backdrop-blur-md pointer-events-none" />

      {/* Ticker / Status Line */}
      <div className="relative z-10 h-6 bg-red-950/40 border-b border-red-900/30 overflow-hidden flex items-center justify-between px-2">
           {activeLobby ? (
               // ACTIVE COMBAT LINK
               <Link 
                 href={`/strikeball/lobbies/${activeLobby.id}`} 
                 className="pointer-events-auto flex items-center gap-3 w-full justify-center text-red-500 font-bold font-mono text-[11px] hover:text-white hover:bg-red-900/50 transition-colors h-full"
               >
                   <FaStopwatch className="animate-pulse" />
                   <span className="tracking-widest animate-pulse">ОПЕРАЦИЯ: {activeLobby.name.toUpperCase()} [{elapsed}]</span>
                   <FaCrosshairs className="animate-spin-slow" />
               </Link>
           ) : (
               <motion.div 
                 className="whitespace-nowrap text-[9px] font-mono text-red-400/80 uppercase tracking-widest"
                 animate={{ x: ["100%", "-100%"] }}
                 transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
               >
                 /// SYSTEM ONLINE /// WAITING FOR ORDERS /// NO ACTIVE SIGNALS ///
               </motion.div>
           )}
      </div>

      <div className="relative z-10 container mx-auto px-4 h-12 flex items-center justify-between">
          
          {/* Brand */}
          <Link href="/strikeball" className="pointer-events-auto flex items-center gap-3 group">
            <div className={cn("relative w-8 h-8 flex items-center justify-center border rounded-sm transition-colors duration-300", activeLobby ? "bg-red-600 border-white text-white" : "bg-zinc-900 border-red-700 text-white group-hover:bg-red-700")}>
              <span className="font-orbitron font-black italic text-sm">SB</span>
              {/* Tech Decorations */}
              <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-red-500 opacity-50" />
              <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-red-500 opacity-50" />
            </div>
            <div>
              <h1 className="font-orbitron font-black text-lg leading-none text-zinc-100 italic tracking-tighter shadow-black drop-shadow-md">
                STRIKE<span className="text-red-600">BALL</span>
              </h1>
            </div>
          </Link>

          {/* Right Controls */}
          <div className="pointer-events-auto flex items-center gap-4">
             {/* If game is active, show quick return button if not clicking ticker */}
             {activeLobby && (
                 <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-red-500 animate-pulse">
                    <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                    LIVE
                 </div>
             )}
             
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
    </motion.header>
  );
}