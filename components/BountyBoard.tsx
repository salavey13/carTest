"use client";

import { useEffect, useState } from "react";
import { supabaseAnon } from "@/hooks/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FaCheckCircle, FaHammer, FaClock, FaFire } from "react-icons/fa";

// Interface based on how we stored data in BountyBreeder
interface Bounty {
  id: string;
  amount: number;
  title: string;
  desc: string;
  status: 'open' | 'wip' | 'done';
  backers_count: number; // In a real app, you'd aggregate identical titles
}

export default function BountyBoard() {
  const [bounties, setBounties] = useState<Bounty[]>([]);

  useEffect(() => {
    // In reality, this should be a SQL View or a specialized RPC function
    // For now, we simulate fetching invoices and filtering client-side
    const fetchBounties = async () => {
      const { data } = await supabaseAnon
        .from('invoices')
        .select('*')
        .eq('status', 'paid') // Only paid votes count
        .order('amount', { ascending: false })
        .limit(10);

      if (data) {
        // Rudimentary parsing of the "BOUNTY: [Title] Desc" format
        const parsed = data
          .filter((inv: any) => typeof inv.metadata?.description === 'string' && inv.metadata.description.startsWith('BOUNTY:'))
          .map((inv: any) => {
            const raw = inv.metadata.description;
            const titleMatch = raw.match(/\[(.*?)\]/);
            const title = titleMatch ? titleMatch[1] : "Unknown Feature";
            const desc = raw.replace(/BOUNTY: \[.*?\]/, '').trim();
            
            return {
              id: inv.id,
              amount: inv.amount,
              title,
              desc,
              status: inv.metadata.status || 'open', // Admin can update metadata later to 'wip' or 'done'
              backers_count: 1
            };
          });
        setBounties(parsed);
      }
    };
    fetchBounties();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold font-orbitron text-white flex items-center gap-2">
          <FaFire className="text-orange-500" /> BOUNTY BOARD
        </h2>
        <span className="text-xs text-zinc-500 font-mono">TOP FUNDED REQUESTS</span>
      </div>

      <div className="grid gap-3">
        {bounties.length === 0 && (
          <div className="text-center p-8 border border-dashed border-zinc-800 rounded-xl text-zinc-600">
            Тишина в эфире. Стань первым заказчиком мутации.
          </div>
        )}

        {bounties.map((b) => (
          <Card key={b.id} className="bg-zinc-900/50 border-zinc-800 p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center hover:border-cyan-500/30 transition-colors">
            {/* Status Icon */}
            <div className="shrink-0">
              {b.status === 'done' && <FaCheckCircle className="text-green-500 w-6 h-6" />}
              {b.status === 'wip' && <FaHammer className="text-yellow-500 w-6 h-6 animate-pulse" />}
              {b.status === 'open' && <FaClock className="text-zinc-500 w-6 h-6" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-white font-bold text-sm truncate">{b.title}</h3>
                {b.status === 'wip' && <Badge variant="outline" className="text-[10px] text-yellow-500 border-yellow-500/30">BUILDING</Badge>}
              </div>
              <p className="text-xs text-zinc-400 line-clamp-1">{b.desc}</p>
            </div>

            {/* Value */}
            <div className="shrink-0 text-right">
              <div className="text-xl font-black text-cyan-400 font-mono">{b.amount} ★</div>
              <div className="text-[10px] text-zinc-600">FUNDED</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}