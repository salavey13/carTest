"use client";

import Link from "next/link";
import { useAppContext } from "@/contexts/AppContext";
import { motion } from "framer-motion";
import { FaWifi, FaUserAstronaut, FaStopwatch } from "react-icons/fa6";
import { useEffect, useState } from "react";
import { supabaseAnon } from "@/hooks/supabase";

export default function StrikeballHeader() {
  const { user, dbUser } = useAppContext();
  const [activeLobby, setActiveLobby] = useState<any>(null);

  // Poll for active lobby if user is logged in
  useEffect(() => {
    if (!dbUser?.user_id) return;
    
    const checkActive = async () => {
        // Simple query: find a lobby where I am a member that is "active"
        const { data } = await supabaseAnon
            .from('lobby_members')
            .select('lobby_id, lobbies(status, start_at, name)')
            .eq('user_id', dbUser.user_id)
            .eq('lobbies.status', 'active') // Only fetch if lobby is officially started
            .maybeSingle();
        
        if (data && data.lobbies) {
            setActiveLobby(data.lobbies);
        } else {
            setActiveLobby(null);
        }
    };

    checkActive();
    // Poll every 30s
    const interval = setInterval(checkActive, 30000);
    return () => clearInterval(interval);
  }, [dbUser]);

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
               <div className="flex items-center gap-2 w-full justify-center animate-pulse text-red-500 font-bold font-mono text-[10px]">
                   <FaStopwatch />
                   <span>LIVE OPERATION: {activeLobby.name.toUpperCase()}</span>
               </div>
           ) : (
               <motion.div 
                 className="whitespace-nowrap text-[9px] font-mono text-red-400/80 uppercase tracking-widest"
                 animate={{ x: ["100%", "-100%"] }}
                 transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
               >
                 /// SYSTEM ONLINE /// WAITING FOR ORDERS ///
               </motion.div>
           )}
        </div>

        <div className="container mx-auto px-4 h-11 flex items-center justify-between">
          <Link href="/strikeball" className="flex items-center gap-3 group">
            <div className="relative w-8 h-8 flex items-center justify-center bg-zinc-900 border border-red-700 rounded-sm group-hover:bg-red-700 transition-colors duration-300">
              <span className="font-orbitron font-black text-white italic text-sm">SB</span>
            </div>
            <h1 className="font-orbitron font-black text-lg leading-none text-zinc-100 italic tracking-tighter">
              STRIKE<span className="text-red-600">BALL</span>
            </h1>
          </Link>

          <div className="flex items-center gap-4">
             {activeLobby && (
                 <Link href={`/strikeball/lobbies/${activeLobby.id}`} className="bg-red-600 text-white text-[10px] px-2 py-1 rounded animate-pulse font-bold">
                     RETURN TO GAME
                 </Link>
             )}
             
            <Link href="/profile" className="flex items-center gap-2 pl-4 border-l border-zinc-800">
               <div className="text-right hidden xs:block">
                 <div className="text-[10px] font-bold text-zinc-300 leading-none tracking-wider">
                   {user?.username?.toUpperCase() || "RECRUIT"}
                 </div>
               </div>
               <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400 group-hover:text-white transition-all">
                 <FaUserAstronaut />
               </div>
            </Link>
          </div>
        </div>
      </div>
    </motion.header>
  );
}