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

// --- TYPES & INTERFACES ---
type LeaderboardEntry = { 
  name: string; 
  score: number; 
  date: string; 
  xtr?: number; 
};

interface IncomingProps {
  stats?: { 
    changedCount?: number; 
    totalDelta?: number; 
    stars?: number; 
    offloadUnits?: number; 
    salary?: number 
  };
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
  // --- DATA DESTRUCTURING ---
  const stats = inProps.stats || {};
  const itemsCount = inProps.itemsCount ?? 0;
  const uniqueIds = inProps.uniqueIds ?? 0;
  const score = inProps.score ?? 0;
  const level = inProps.level ?? 1;
  const streak = inProps.streak ?? 0;
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

  // --- GHOST ECONOMY LOGIC ---
  
  // 1. Сессионный майнинг (сколько намайнено за текущий заход)
  // Offload (выдача) - 7 GV, Onload (приемка/перемещение) - 3 GV
  const sessionGhostVibes = useMemo(() => 
    (offloadUnits * 7) + (Math.max(0, totalDelta - offloadUnits) * 3), 
  [offloadUnits, totalDelta]);
  
  // 2. Налог на тимбилдинг (13% от зарплаты, "ожидаемый" от владельца)
  const teambuildingContribution = useMemo(() => 
    Math.floor(salary * 0.13), 
  [salary]);
  
  // 3. Общий баланс из метаданных (Cumulative Ghost Vibes)
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
    if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const shareScore = () => {
    const text = `📊 ОПЕРАЦИЯ ЗАВЕРШЕНА:
ID: ${dbUser?.user_id?.slice(0,8)}
Выдано: ${offloadUnits} ед.
Зарплата: ${salary} RUB
Ghost Vibes: +${sessionGhostVibes} GV
Налог Squad (13%): ${teambuildingContribution} RUB`;
    
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("Тактическая сводка скопирована!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="p-3 bg-muted rounded-lg text-[13px] border border-border/50">
      <div className="flex flex-col lg:flex-row items-stretch gap-4">
        
        {/* MAIN HUD: PERFORMANCE & HARVEST */}
        <main className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <h3 className="font-black text-sm uppercase tracking-tighter flex items-center gap-2">
                <ShieldAlert size={14} className="text-red-500" /> Боевая статистика
              </h3>
              <div className="mt-1 text-[11px] text-muted-foreground truncate">
                Склад: <b>{itemsCount}</b> · Уник: <b>{uniqueIds}</b> · Сессия: <b>{formatDuration(sessionDuration)}</b>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] bg-background">LVL {level}</Badge>
              <Badge variant="outline" className="text-[10px] border-brand-pink text-brand-pink">STREAK {streak}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* CARD 1: PERFORMANCE (COMBAT SCORE) */}
            <section className="p-3 rounded-lg bg-background/60 border border-border flex flex-col relative overflow-hidden group">
              <div className="flex items-start gap-3">
                <motion.div
                  animate={{ rotate: efficiency > 50 ? 360 : 0 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="flex-shrink-0 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 p-2 shadow-md"
                >
                  <Zap className="w-4 h-4 text-white" />
                </motion.div>
                <div className="min-w-0">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">Combat_Score</div>
                  <div className="text-lg font-black">{score.toLocaleString()}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="flex flex-col p-1.5 bg-zinc-950/20 rounded border border-transparent hover:border-border/50 transition-colors">
                  <div className="text-[9px] text-muted-foreground flex items-center gap-1 uppercase"><Star size={10} className="text-yellow-400" /> Stars</div>
                  <div className="font-bold text-xs">{stars}</div>
                </div>
                <div className="flex flex-col p-1.5 bg-zinc-950/20 rounded border border-transparent hover:border-border/50 transition-colors">
                  <div className="text-[9px] text-muted-foreground flex items-center gap-1 uppercase"><Ghost size={10} className="text-brand-purple" /> Vibes</div>
                  <div className="font-bold text-xs text-brand-purple">+{sessionGhostVibes}</div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-border/50 flex justify-between text-[10px] text-muted-foreground uppercase font-mono">
                <div className="flex items-center gap-1"><TrendingUp size={10} /> {efficiency} ед/ч</div>
                <div className="flex items-center gap-1"><Clock size={10} /> {avgTimePerItem}s/ед</div>
              </div>
            </section>

            {/* CARD 2: HARVEST (MONEY & TAX) */}
            <section className={cn(
              "p-3 rounded-lg border flex flex-col justify-between transition-all",
              changedCount > 0 
                ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/10 dark:border-emerald-900/50" 
                : "bg-background/50 border-border"
            )}>
              <div className="flex justify-between items-start">
                <div>
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Market_Harvest</div>
                    <div className="mt-1 flex items-baseline gap-1">
                        <span className="font-black text-2xl text-emerald-600 dark:text-emerald-500">{salary.toLocaleString()}</span>
                        <span className="text-[9px] text-muted-foreground font-bold">RUB</span>
                    </div>
                </div>
                <Badge className="bg-emerald-600 text-[8px] h-4 rounded-none">VERIFIED</Badge>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-[11px] items-center">
                    <span className="text-muted-foreground uppercase text-[9px]">Выгрузка за смену:</span>
                    <span className="font-bold">{offloadUnits} ед.</span>
                </div>
                <div className="flex justify-between text-[11px] items-center pt-1.5 border-t border-emerald-500/20">
                    <span className="text-brand-pink font-bold flex items-center gap-1 uppercase text-[9px]">
                        <Users size={10} /> Squad_Tax (13%):
                    </span>
                    <span className="text-brand-pink font-black">+{teambuildingContribution} ₽</span>
                </div>
              </div>
            </section>
          </div>

          {/* PROGRESS: DAILY GOALS */}
          <div className="mt-3 p-3 rounded-lg bg-background/40 border border-border">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-black uppercase flex items-center gap-2 tracking-widest text-zinc-500">
                <Target size={12} className="text-green-500" /> Operational Goals
              </h4>
              <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-zinc-400">{offloadUnits}/{dailyGoals.units}</span>
                  <Badge variant={totalXtr > 0 ? "default" : "secondary"} className="text-[9px] h-4 px-1.5">
                    {totalXtr} XTR
                  </Badge>
              </div>
            </div>
            <Progress value={unitsProgress} className="h-1 bg-zinc-800" />
            {errorFree && (
              <div className="mt-2 text-[10px] text-green-500 font-bold flex items-center gap-1 uppercase">
                  <Award size={12} /> Status: Perfect Shift (+{dailyGoals.xtr} XTR Bonus)
              </div>
            )}
          </div>
        </main>

        {/* ASIDE: GHOST LEDGER & LEADERBOARD */}
        <aside className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-3">
          
          {/* THE GHOST LEDGER (Cumulative Balance) */}
          <div className="p-3 rounded-lg bg-zinc-900 border-2 border-brand-purple shadow-[0_0_20px_rgba(168,85,247,0.15)] relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Ghost size={80} />
            </div>
            <div className="flex items-center gap-2 text-brand-purple mb-2">
                <Coins size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">Ghost_Ledger_Total</span>
            </div>
            <div className="flex items-baseline gap-2">
                <div className="text-4xl font-black text-white tracking-tighter">
                  {totalGhostBalance.toLocaleString()}
                </div>
                <div className="text-xs text-brand-purple font-bold">GV</div>
            </div>
            <div className="mt-3 text-[9px] text-zinc-500 leading-tight uppercase font-mono">
                System_Node: <span className="text-brand-green">Authorized</span> <br/>
                Escape_Velocity: <span className="text-white">{Math.min(100, (totalGhostBalance/50000)*100).toFixed(1)}%</span>
            </div>
          </div>

          {/* SQUAD RANKINGS */}
          <div className="p-3 rounded-lg bg-background/50 border border-border flex-1">
            <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-amber-500">
                <Award size={14} /> Elite Operators
              </div>
              <Button variant="ghost" size="sm" onClick={shareScore} className="h-5 px-1 text-[9px] font-bold hover:bg-brand-cyan/20 hover:text-brand-cyan">
                <Share2 size={10} className="mr-1" /> EXPORT
              </Button>
            </div>

            <ol className="space-y-1.5">
              <AnimatePresence>
                {top.length > 0 ? top.map((entry, idx) => (
                  <motion.li 
                    key={idx} 
                    initial={{ opacity: 0, x: -10 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    className="flex items-center justify-between gap-2 p-1 rounded bg-zinc-950/10 hover:bg-zinc-950/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn("w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-black",
                        idx === 0 ? "bg-amber-500 text-black shadow-[0_0_8px_rgba(245,158,11,0.5)]" :
                        idx === 1 ? "bg-slate-400 text-black" :
                        idx === 2 ? "bg-amber-800 text-white" : "bg-muted"
                      )}>
                        {idx + 1}
                      </div>
                      <div className="font-bold truncate uppercase text-[11px] tracking-tight">
                        {entry.name}
                      </div>
                    </div>
                    <div className="font-black text-brand-cyan text-[11px]">{entry.score}</div>
                  </motion.li>
                )) : (
                  <li className="text-zinc-600 italic text-[10px] text-center py-6 uppercase tracking-widest animate-pulse">
                    Scanning Signal...
                  </li>
                )}
              </AnimatePresence>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}