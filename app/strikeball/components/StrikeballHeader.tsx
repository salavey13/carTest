"use client";

import Link from "next/link";
import { useAppContext } from "@/contexts/AppContext";
import { motion } from "framer-motion";
import { FaWifi, FaUserAstronaut, FaStopwatch } from "react-icons/fa6";
import { useEffect, useState } from "react";

export default function StrikeballHeader() {
  const { user, activeLobby } = useAppContext(); // Data comes from global context now
  const [elapsed, setElapsed] = useState("00:00");

  // Local UI Timer (Ticks every second based on context data)
  useEffect(() => {
      if (!activeLobby?.actual_start_at) {
          setElapsed("00:00");
          return;
      }
      
      const start = new Date(activeLobby.actual_start_at).getTime();
      
      // Update immediately
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

          // Format: HH:MM:SS or MM:SS depending on duration
          if (h > 0) {
              setElapsed(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
          } else {
              setElapsed(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
          }
      };

      updateTimer(); // Initial call
      const interval = setInterval(updateTimer, 1000);

      return () => clearInterval(interval);
  }, [activeLobby]);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 80, damping: 15 }}
      className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
    >
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md border-b-2 border-red-900 pointer-events-auto h-16 shadow-[0_5px_20px_rgba(255,0,0,0.1)]">
        
        {/* Ticker / Status Line */}
        <div className="h-5 bg-red-950/40 border-b border-red-900/30 overflow-hidden flex items-center justify-between px-2">
           {activeLobby ? (
               <Link 
                 href={`/strikeball/lobbies/${activeLobby.id}`} 
                 className="flex items-center gap-2 w-full justify-center animate-pulse text-red-500 font-bold font-mono text-[10px] hover:text-white cursor-pointer transition-colors"
               >
                   <FaStopwatch />
                   <span>IN COMBAT: {activeLobby.name.toUpperCase()} [{elapsed}]</span>
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

        <div className="container mx-auto px-4 h-11 flex items-center justify-between">
          
          {/* Brand */}
          <Link href="/strikeball" className="flex items-center gap-3 group">
            <div className="relative w-8 h-8 flex items-center justify-center bg-zinc-900 border border-red-700 rounded-sm group-hover:bg-red-700 transition-colors duration-300">
              <span className="font-orbitron font-black text-white italic text-sm">SB</span>
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
          <div className="flex items-center gap-4">
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
      </div>
    </motion.header>
  );
}