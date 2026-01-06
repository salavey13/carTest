"use client";

import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { 
  Star, Package, Clock, Zap, Award, 
  AlertTriangle, Users, TrendingUp, 
  Target, Share2, Ghost, ShieldAlert, Coins 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";

// --- TYPES preserved ---
type LeaderboardEntry = { name: string; score: number; date: string; xtr?: number; };

interface IncomingProps {
  stats?: { changedCount?: number; totalDelta?: number; stars?: number; offloadUnits?: number; salary?: number };
  itemsCount?: number;
  uniqueIds?: number;
  score?: number;
  level?: number;
  streak?: number;
  dailyStreak?: number;
  checkpointMain?: string;
  checkpointSub?: string;
  changedCount?: number;
  totalDelta?: number;
  stars?: number;
  offloadUnits?: number;
  salary?: number;
  achievements?: string[];
  sessionStart?: number | null;
  errorCount?: number;
  bossMode?: boolean;
  bossTimer?: number;
  leaderboard?: LeaderboardEntry[];
  efficiency?: number;
  avgTimePerItem?: number;
  dailyGoals?: { units: number; errors: number; xtr: number };
  sessionDuration?: number;
}

export default function WarehouseStats(inProps: IncomingProps) {
  // --- COMPATIBILITY LAYER (No props skipped) ---
  const stats = inProps.stats || {};
  const itemsCount = inProps.itemsCount ?? 0;
  const uniqueIds = inProps.uniqueIds ?? 0;
  const score = inProps.score ?? 0;
  const level = inProps.level ?? 1;
  const streak = inProps.streak ?? 0;
  const dailyStreak = inProps.dailyStreak ?? 0;
  const checkpointMain = inProps.checkpointMain;
  const checkpointSub = inProps.checkpointSub;
  const changedCount = inProps.changedCount ?? stats.changedCount ?? 0;
  const totalDelta = inProps.totalDelta ?? stats.totalDelta ?? 0;
  const stars = inProps.stars ?? stats.stars ?? 0;
  const offloadUnits = inProps.offloadUnits ?? stats.offloadUnits ?? 0;
  const salary = inProps.salary ?? stats.salary ?? 0;
  const achievements = inProps.achievements ?? [];
  const sessionDuration = inProps.sessionDuration ?? 0;
  const errorCount = inProps.errorCount ?? 0;
  const bossMode = inProps.bossMode ?? false;
  const bossTimer = inProps.bossTimer ?? 0;
  const leaderboard = inProps.leaderboard ?? [];
  const efficiency = inProps.efficiency ?? 0;
  const avgTimePerItem = inProps.avgTimePerItem ?? 0;
  const dailyGoals = inProps.dailyGoals ?? { units: 100, errors: 0, xtr: 100 };

  const { dbUser } = useAppContext();
  const [copied, setCopied] = useState(false);

  // --- GHOST ECONOMY CALCULATIONS ---
  const sessionGV = useMemo(() => (offloadUnits * 7) + (Math.max(0, totalDelta - offloadUnits) * 3), [offloadUnits, totalDelta]);
  const squadTax = useMemo(() => Math.floor(salary * 0.13), [salary]);
  const totalGhostBalance = dbUser?.metadata?.cyberFitness?.ghost_stats?.balance || 0;

  const top = useMemo(() => (Array.isArray(leaderboard) ? leaderboard.slice(0, 3) : []), [leaderboard]);
  const unitsProgress = useMemo(() => Math.min(100, (offloadUnits / (dailyGoals?.units || 1)) * 100), [offloadUnits, dailyGoals]);
  const errorFree = errorCount === 0 && sessionDuration > 3600;

  const totalXtr = useMemo(() => {
    let earned = 0;
    if (unitsProgress >= 100) earned += 50;
    if (errorFree) earned += (dailyGoals?.xtr || 0);
    return earned;
  }, [unitsProgress, errorFree, dailyGoals]);

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0 ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const shareScore = () => {
    const text = `📊 SITREP: ${offloadUnits} Out. +${sessionGV} GV Mined. Payout: ${salary} RUB.`;
    navigator.clipboard.writeText(text).then(() => { setCopied(true); toast.success("Copied to clipboard!"); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-[13px] font-mono">
      <div className="flex flex-col lg:flex-row gap-4">
        <main className="flex-1">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-black text-white uppercase flex items-center gap-2">
                <ShieldAlert size={14} className="text-red-600" /> Operational_Status
              </h3>
              <div className="text-[10px] text-zinc-500 mt-1">ID: {dbUser?.user_id?.slice(0,8)} | T: {formatDuration(sessionDuration)}</div>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="h-5 text-[9px] border-zinc-700 text-zinc-400">LVL {level}</Badge>
              <Badge variant="outline" className="h-5 text-[9px] border-brand-pink text-brand-pink">STREAK {streak}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* PERFORMANCE */}
            <section className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg relative overflow-hidden group">
              <div className="flex items-start gap-3">
                <motion.div animate={{ rotate: efficiency > 50 ? 360 : 0 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="p-1.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)]">
                  <Zap size={14} className="text-black" />
                </motion.div>
                <div>
                  <div className="text-[10px] text-zinc-500 font-bold uppercase">Combat_Score</div>
                  <div className="text-lg font-black text-white">{score.toLocaleString()}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="bg-black/40 p-2 border border-zinc-800 rounded">
                    <div className="text-[8px] text-zinc-500 uppercase flex items-center gap-1"><Ghost size={10} className="text-brand-purple" /> Session_GV</div>
                    <div className="text-xs font-black text-brand-purple">+{sessionGV}</div>
                </div>
                <div className="bg-black/40 p-2 border border-zinc-800 rounded">
                    <div className="text-[8px] text-zinc-500 uppercase flex items-center gap-1"><Star size={10} className="text-yellow-500" /> Stars</div>
                    <div className="text-xs font-black text-white">{stars}</div>
                </div>
              </div>
            </section>

            {/* HARVEST */}
            <section className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col justify-between">
              <div>
                <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Market_Harvest</div>
                <div className="flex items-baseline gap-1">
                    <span className="font-black text-2xl text-emerald-500">{salary.toLocaleString()}</span>
                    <span className="text-[9px] text-zinc-600 font-bold uppercase">RUB</span>
                </div>
              </div>
              <div className="mt-4 pt-2 border-t border-zinc-800">
                <div className="flex justify-between text-[10px] items-center text-brand-pink">
                    <span className="font-bold flex items-center gap-1"><Users size={10} /> SQUAD_TAX (13%):</span>
                    <span className="font-black">+{squadTax} ₽</span>
                </div>
              </div>
            </section>
          </div>

          {/* GOALS */}
          <div className="mt-3 p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">Operational Quota</span>
              <Badge variant={totalXtr > 0 ? "default" : "secondary"} className="text-[8px] h-4">{totalXtr} XTR</Badge>
            </div>
            <Progress value={unitsProgress} className="h-1 bg-zinc-800" />
            <div className="mt-2 text-[9px] text-zinc-500 flex justify-between uppercase">
                <span>{offloadUnits} / {dailyGoals.units} units</span>
                {errorCount > 0 && <span className="text-red-500 font-bold">Errors: {errorCount}</span>}
            </div>
          </div>
        </main>

        {/* SIDEBAR */}
        <aside className="w-full lg:w-64 flex flex-col gap-3">
          <div className="p-3 bg-zinc-900 border-2 border-brand-purple rounded-lg relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity"><Ghost size={80} /></div>
            <div className="text-[10px] text-brand-purple font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                <Coins size={12} /> Ghost_Ledger
            </div>
            <div className="text-3xl font-black text-white tracking-tighter">{totalGhostBalance.toLocaleString()} <span className="text-xs text-brand-purple">GV</span></div>
            <div className="mt-2 text-[9px] text-zinc-500 uppercase font-mono">
                System_Node: <span className="text-white">Active</span>
            </div>
          </div>

          <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg flex-1">
            <div className="flex justify-between items-center mb-3 border-b border-zinc-800 pb-2">
                <span className="text-[9px] font-black uppercase text-amber-500">Elite_Operators</span>
                <Button variant="ghost" onClick={shareScore} className="h-5 w-5 p-0 hover:text-brand-cyan"><Share2 size={10} /></Button>
            </div>
            <div className="space-y-1.5">
                {top.map((entry, idx) => (
                  <div key={idx} className="flex justify-between text-[11px] p-1 rounded hover:bg-zinc-800/50">
                    <span className="font-bold text-zinc-400">0{idx+1} <span className="text-zinc-200 ml-1">{entry.name}</span></span>
                    <span className="font-black text-brand-cyan">{entry.score}</span>
                  </div>
                ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}