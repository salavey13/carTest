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

  // --- VIBE GHOST LOGIC ---
  const sessionGV = useMemo(() => (offloadUnits * 7) + (Math.max(0, totalDelta - offloadUnits) * 3), [offloadUnits, totalDelta]);
  const squadTaxExpected = useMemo(() => Math.floor(salary * 0.13), [salary]);
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
    if (!Number.isFinite(sec) || sec <= 0) return "00:00";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0 ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const shareScore = () => {
    const text = `📦 MISSION REPORT: ${offloadUnits} units offloaded. Mined ${sessionGV} Ghost Vibes. Payout: ${salary} RUB. Tax: ${squadTaxExpected} RUB.`;
    navigator.clipboard.writeText(text).then(() => { setCopied(true); toast.success("Сводка скопирована!"); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="p-3 bg-muted rounded-lg text-[13px] border border-border/40 shadow-sm font-sans">
      <div className="flex flex-col lg:flex-row items-stretch gap-4">
        <main className="flex-1 min-w-0">
          
          {/* HEADER: Original Meta + Mission Info */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <h3 className="font-black text-sm uppercase tracking-tighter flex items-center gap-2">
                <ShieldAlert size={14} className="text-red-600" /> Operational SITREP
              </h3>
              <div className="mt-1 text-[10px] text-muted-foreground flex gap-2 font-mono">
                <span>SKU: {uniqueIds}</span>
                <span>TOTAL: {itemsCount}</span>
                <span className="text-brand-cyan">SESSION: {formatDuration(sessionDuration)}</span>
              </div>
            </div>
            <div className="flex gap-2">
               <Badge variant="outline" className="h-5 text-[9px] bg-background font-black">LVL {level}</Badge>
               {bossMode && <Badge className="h-5 text-[9px] bg-red-600 animate-pulse">BOSS_MODE: {Math.max(0, Math.floor(bossTimer / 1000))}s</Badge>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* COLUMN 1: KINETIC PERFORMANCE */}
            <section className="p-3 rounded-lg bg-background/60 border border-border flex flex-col relative group">
              <div className="flex items-start gap-3">
                <motion.div animate={{ rotate: efficiency > 50 ? 360 : 0 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="flex-shrink-0 rounded-full bg-emerald-500 p-1.5 shadow-lg shadow-emerald-500/20">
                  <Zap className="w-4 h-4 text-white" />
                </motion.div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">Combat_Efficiency</div>
                  <div className="text-lg font-black tracking-tight">{score.toLocaleString()}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="p-2 bg-zinc-950/20 rounded border border-transparent hover:border-border/40 transition-colors">
                  <div className="text-[9px] text-muted-foreground uppercase flex items-center gap-1"><Star size={10} className="text-yellow-400" /> Streak</div>
                  <div className="font-black text-xs text-brand-pink">{streak}</div>
                </div>
                <div className="p-2 bg-zinc-950/20 rounded border border-transparent hover:border-border/40 transition-colors">
                  <div className="text-[9px] text-muted-foreground uppercase flex items-center gap-1"><Ghost size={10} className="text-brand-purple" /> Session_GV</div>
                  <div className="font-black text-xs text-brand-purple">+{sessionGV}</div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-border/50 flex justify-between text-[9px] text-muted-foreground font-mono uppercase">
                <span>{efficiency} unit/h</span>
                <span>{avgTimePerItem}s/unit</span>
              </div>
            </section>

            {/* COLUMN 2: FINANCIAL HARVEST (The Lube) */}
            <section className={cn(
              "p-3 rounded-lg border flex flex-col justify-between",
              changedCount > 0 ? "bg-emerald-50/30 border-emerald-300 dark:bg-emerald-950/10 dark:border-emerald-800" : "bg-background/40 border-border"
            )}>
              <div className="flex justify-between items-start">
                <div>
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Market_Harvest</div>
                    <div className="mt-1 flex items-baseline gap-1">
                        <span className="font-black text-2xl text-emerald-600 dark:text-emerald-500">{salary.toLocaleString()}</span>
                        <span className="text-[9px] text-muted-foreground font-bold">RUB</span>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <Badge className="bg-emerald-600 text-[8px] h-4 rounded-none">POW_VERIFIED</Badge>
                    <span className="text-[8px] text-zinc-500 font-mono mt-1">{checkpointMain || "NO_CP"}</span>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-[10px] items-center pb-1.5 border-b border-border/30">
                    <span className="text-muted-foreground uppercase">Выгрузка (Actions):</span>
                    <span className="font-black">{offloadUnits} units</span>
                </div>
                <div className="flex justify-between text-[10px] items-center pt-0.5">
                    <span className="text-brand-pink font-bold flex items-center gap-1 uppercase">
                        <Users size={10} /> Squad_Fund (13%):
                    </span>
                    <span className="text-brand-pink font-black">+{squadTaxExpected} ₽</span>
                </div>
              </div>
            </section>
          </div>

          {/* PROGRESS: DAILY MILESTONES */}
          <div className="mt-3 p-3 rounded-lg bg-background/40 border border-border">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-black uppercase flex items-center gap-2 tracking-widest text-zinc-500">
                <Target size={12} className="text-green-500" /> Operational Quota
              </h4>
              <Badge variant={totalXtr > 0 ? "default" : "secondary"} className="text-[9px] h-4 font-black">
                {totalXtr} XTR BONUS
              </Badge>
            </div>
            <Progress value={unitsProgress} className="h-1 bg-zinc-800" />
            <div className="mt-2 flex justify-between items-center">
                <div className="text-[9px] text-muted-foreground uppercase">
                    Quota: {offloadUnits} / {dailyGoals.units} units
                </div>
                {errorCount > 0 && <span className="text-[9px] text-red-500 font-bold uppercase">Errors: {errorCount}</span>}
            </div>
          </div>
        </main>

        {/* SIDEBAR: PERSISTENT GHOST LEDGER */}
        <aside className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-3">
          
          {/* THE LEDGER Block */}
          <div className="p-3 rounded-lg bg-zinc-900 border-2 border-brand-purple shadow-lg shadow-purple-900/10 relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity"><Ghost size={80} /></div>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-brand-purple">
                    <Coins size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Ghost_Vault</span>
                </div>
                <div className="text-[8px] bg-brand-purple/20 text-brand-purple px-1.5 font-bold">NODE_01</div>
            </div>
            <div className="flex items-baseline gap-2">
                <div className="text-4xl font-black text-white tracking-tighter">{totalGhostBalance.toLocaleString()}</div>
                <div className="text-xs text-brand-purple font-bold">GV</div>
            </div>
            <div className="mt-3 flex justify-between items-center">
                <div className="text-[9px] text-zinc-500 uppercase font-mono">
                    Extraction: <span className="text-white">{Math.min(100, (totalGhostBalance/50000)*100).toFixed(1)}%</span>
                </div>
                <Button variant="ghost" onClick={shareScore} className="h-6 w-6 p-0 hover:text-brand-cyan"><Share2 size={12} /></Button>
            </div>
          </div>

          {/* ACHIEVEMENTS / RECENT LOGS (Integrated compatibility) */}
          <div className="p-3 rounded-lg bg-background/50 border border-border flex-1">
             <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 border-b border-border/50 pb-1 flex justify-between">
                <span>Roster_Intel</span>
                <span>Active</span>
             </div>
             
             {/* Render simple list of achievements split by space as requested */}
             <div className="flex flex-wrap gap-1.5 mb-4">
                {achievements.length > 0 ? achievements.map((a, i) => (
                    <div key={i} className="text-[8px] font-bold px-2 py-0.5 bg-brand-pink/10 text-brand-pink border border-brand-pink/20 rounded-none uppercase">
                        {a.split(" ")[0]}
                    </div>
                )) : <span className="text-[9px] text-zinc-700 italic">No medals earned.</span>}
             </div>

             {/* Top Leaderboard preserved */}
             <div className="space-y-1.5">
                {top.map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] p-1 rounded hover:bg-zinc-800/30 transition-colors">
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