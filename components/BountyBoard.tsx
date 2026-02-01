"use client";

import { useEffect, useState } from "react";
import { fetchActiveBounties, BountyItem } from "@/app/wblanding/actions_bounty"; // LOCAL ACTION
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FaCheckCircle, FaHammer, FaClock, FaFire, FaTrophy } from "react-icons/fa";
import { motion } from "framer-motion";

export default function BountyBoard() {
  const [bounties, setBounties] = useState<BountyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Client-side call to Server Action (Secure Bridge)
    fetchActiveBounties().then(res => {
      if (res.success) setBounties(res.data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
        <div>
            <h2 className="text-2xl font-bold font-orbitron text-white flex items-center gap-2">
            <FaFire className="text-orange-500 animate-pulse" /> BOUNTY BOARD
            </h2>
            <p className="text-xs text-zinc-500 font-mono mt-1">Рынок мутаций. Голосуй рублем.</p>
        </div>
        <div className="text-right">
            <span className="text-xs text-zinc-600 font-mono block">TOTAL POOL</span>
            <span className="text-xl font-black text-green-500 font-mono">
                {bounties.reduce((acc, b) => acc + b.amount, 0).toLocaleString()} ★
            </span>
        </div>
      </div>

      <div className="grid gap-3 max-h-[600px] overflow-y-auto pr-2 simple-scrollbar">
        {loading && <div className="text-center py-10 text-zinc-600 animate-pulse font-mono">SCANNING LEDGER...</div>}
        
        {!loading && bounties.length === 0 && (
          <div className="text-center p-8 border border-dashed border-zinc-800 rounded-xl text-zinc-600">
            <FaTrophy className="mx-auto mb-3 text-zinc-700 w-8 h-8" />
            <p>Тишина в эфире. Твой шанс стать первым заказчиком.</p>
          </div>
        )}

        {bounties.map((b, i) => (
          <motion.div 
            key={b.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="bg-zinc-900/50 border-zinc-800 p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center hover:bg-zinc-900 hover:border-cyan-500/30 transition-all group">
                {/* Status Icon */}
                <div className="shrink-0 pt-1 sm:pt-0">
                {b.status === 'done' && <FaCheckCircle className="text-green-500 w-5 h-5" />}
                {b.status === 'wip' && <FaHammer className="text-yellow-500 w-5 h-5 animate-pulse" />}
                {b.status === 'open' && <FaClock className="text-zinc-600 group-hover:text-cyan-500 transition-colors w-5 h-5" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-bold text-sm truncate pr-2">{b.title}</h3>
                    {b.status === 'wip' && <Badge variant="outline" className="text-[9px] h-4 px-1 text-yellow-500 border-yellow-500/30 bg-yellow-500/10">WIP</Badge>}
                    {i < 3 && b.status === 'open' && <Badge variant="outline" className="text-[9px] h-4 px-1 text-orange-500 border-orange-500/30 bg-orange-500/10">HOT</Badge>}
                </div>
                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{b.description}</p>
                </div>

                {/* Value */}
                <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto mt-2 sm:mt-0 border-t sm:border-0 border-zinc-800 pt-2 sm:pt-0">
                    <span className="text-[10px] text-zinc-600 font-mono sm:mb-1">BID AMOUNT</span>
                    <div className="text-lg font-black text-cyan-400 font-mono bg-cyan-950/30 px-2 rounded border border-cyan-500/20">
                        {b.amount} ★
                    </div>
                </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}