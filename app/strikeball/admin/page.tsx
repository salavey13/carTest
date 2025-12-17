"use client";

import React, { useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { validateScannedCode } from "../actions/admin";
import { toast } from "sonner";
import { FaQrcode, FaBoxOpen, FaUsers, FaShieldHalved } from "react-icons/fa6";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { motion } from "framer-motion";

export default function AdminDashboard() {
  const { tg, dbUser } = useAppContext();
  const [lastScan, setLastScan] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleScan = () => {
    if (!tg?.showScanQrPopup) {
        // Dev Fallback
        const mockCode = prompt("DEV: Enter code (e.g. gear_buy_gear-gun-01)");
        if (mockCode) processCode(mockCode);
        return;
    }

    tg.showScanQrPopup({
        text: "ADMIN MODE: SCAN TARGET"
    }, (text) => {
        tg.closeScanQrPopup();
        if (text) processCode(text);
        return true;
    });
  };

  const processCode = async (code: string) => {
      setLoading(true);
      toast.loading("Analyzing...");
      
      const res = await validateScannedCode(dbUser?.user_id!, code);
      
      toast.dismiss();
      setLoading(false);

      if (res.success) {
          setLastScan(res);
          // Play sound if possible
          if (res.type === 'gear_issue') toast.success(`ISSUED: ${res.data.name}`);
          else toast.info(`SCANNED: ${res.type}`);
      } else {
          toast.error(res.error);
          setLastScan(null);
      }
  };

  return (
    <div className="min-h-screen bg-black text-white pt-24 px-4 font-mono">
        <div className="border-b-2 border-red-600 pb-4 mb-8">
            <h1 className="text-4xl font-black text-red-600 font-orbitron">OVERSEER</h1>
            <p className="text-xs text-zinc-500 uppercase tracking-widest">FIELD COMMAND INTERFACE</p>
        </div>

        {/* SCANNER BUTTON */}
        <button 
            onClick={handleScan}
            className="w-full aspect-video border-4 border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center gap-4 hover:border-red-500 hover:bg-zinc-900/50 transition-all group mb-8"
        >
            <FaQrcode className="text-6xl text-zinc-700 group-hover:text-red-500 transition-colors" />
            <span className="text-xl font-bold text-zinc-500 group-hover:text-white">INITIATE SCAN</span>
        </button>

        {/* RESULT DISPLAY */}
        {lastScan && (
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-900 border border-zinc-700 p-6 rounded-xl mb-8"
            >
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">SCAN RESULT</div>
                
                {lastScan.type === 'gear_issue' && (
                    <div className="text-center">
                        <FaBoxOpen className="text-emerald-500 text-4xl mx-auto mb-2" />
                        <h2 className="text-2xl font-bold text-white">{lastScan.data.name}</h2>
                        <div className="text-emerald-400 font-bold mt-2">STOCK: {lastScan.data.remaining}</div>
                        <div className="mt-4 p-2 bg-emerald-900/20 text-emerald-500 border border-emerald-900 rounded">
                            ITEM ISSUED / STOCK DEDUCTED
                        </div>
                    </div>
                )}

                {lastScan.type === 'lobby_info' && (
                    <div className="text-center">
                        <FaUsers className="text-cyan-500 text-4xl mx-auto mb-2" />
                        <h2 className="text-2xl font-bold text-white">{lastScan.data.name}</h2>
                        <div className="text-zinc-400 mt-1">STATUS: {lastScan.data.status?.toUpperCase()}</div>
                        <div className="text-cyan-400 font-bold mt-2">PLAYERS: {lastScan.data.count}</div>
                    </div>
                )}
            </motion.div>
        )}

        {/* QUICK ACTIONS */}
        <div className="grid grid-cols-2 gap-4">
             <Link href="/strikeball/shop" className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center gap-3 hover:border-emerald-500 transition-colors">
                 <FaShieldHalved className="text-emerald-500" />
                 <div className="text-xs font-bold">MANAGE<br/>ARMORY</div>
             </Link>
             <Link href="/strikeball/lobbies" className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center gap-3 hover:border-cyan-500 transition-colors">
                 <FaUsers className="text-cyan-500" />
                 <div className="text-xs font-bold">MANAGE<br/>SQUADS</div>
             </Link>
        </div>
    </div>
  );
}