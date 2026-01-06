"use client";

import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { 
  Star, Package, Clock, Zap, Award, 
  AlertTriangle, Users, TrendingUp, 
  Target, Share2, Ghost, ShieldAlert 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";

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
  // --- Сохраняем все деструктурированные пропсы ---
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

  // --- Новая логика Ghost Economy ---
  // Накапливаем Ghost Vibes за сессию (offload дает больше "вкуса")
  const sessionGhostVibes = useMemo(() => offloadUnits * 7 + (totalDelta - offloadUnits) * 3, [offloadUnits, totalDelta]);
  
  // Те самые 13% от выручки, которые владелец должен банде
  const teambuildingContribution = useMemo(() => Math.floor(salary * 0.13), [salary]);
  
  // Общий баланс из метаданных (кумулятивный)
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
    const text = `📊 СВОДКА ОПЕРАЦИИ: Выдано ${offloadUnits} ед. Намайнено ${sessionGhostVibes} GV. К выплате: ${salary} RUB.`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("Отчёт скопирован!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="p-3 bg-muted rounded-lg text-[13px] border border-border/50 shadow-inner">
      <div className="flex flex-col lg:flex-row items-stretch gap-4">
        <main className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-black text-sm uppercase tracking-tighter flex items-center gap-2">
                <ShieldAlert size={14} className="text-red-500" /> Отчет за смену
              </h3>
              <div className="mt-1 text-xs text-muted-foreground truncate">
                ID: {dbUser?.user_id?.slice(0, 8)} · Склад: <b>{itemsCount}</b> · Уник.: <b>{uniqueIds}</b>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-background">LVL {level}</Badge>
              <Badge variant="outline" className="text-xs border-brand-pink text-brand-pink">STREAK {streak}</Badge>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* СЕКЦИЯ 1: ПРОИЗВОДИТЕЛЬНОСТЬ (Original) */}
            <section className="p-3 rounded-lg bg-background/50 border border-border flex flex-col relative overflow-hidden group">
              <div className="flex items-start gap-3">
                <motion.div
                  animate={{ rotate: efficiency > 50 ? 360 : 0 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="flex-shrink-0 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 p-2 shadow-lg shadow-emerald-500/20"
                >
                  <Zap className="w-5 h-5 text-white" />
                </motion.div>
                <div className="min-w-0">
                  <div className="text-[11px] text-muted-foreground uppercase font-bold">Combat_Score</div>
                  <div className="text-lg font-black">{Number.isFinite(score) ? score.toLocaleString() : 0}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="flex flex-col p-1.5 bg-zinc-950/20 rounded">
                  <div className="text-[10px] text-muted-foreground flex items-center gap-2 uppercase"><Star className="w-3 h-3 text-yellow-400" /> Stars</div>
                  <div className="font-bold mt-0.5">{Number.isFinite(stars) ? stars : 0}</div>
                </div>
                <div className="flex flex-col p-1.5 bg-zinc-950/20 rounded">
                  <div className="text-[10px] text-muted-foreground flex items-center gap-2 uppercase"><Ghost className="w-3 h-3 text-brand-purple" /> Vibes</div>
                  <div className="font-bold mt-0.5 text-brand-purple">+{sessionGhostVibes}</div>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-border/50 flex justify-between">
                <div className="text-[10px] text-muted-foreground uppercase flex items-center gap-1"><TrendingUp size={12} /> {efficiency} ед/ч</div>
                <div className="text-[10px] text-muted-foreground uppercase flex items-center gap-1"><Clock size={12} /> {avgTimePerItem}s/ед</div>
              </div>
            </section>

            {/* СЕКЦИЯ 2: ХАРВЕСТ (Upgrade: RUB + Teambuilding Fund) */}
            <section className={cn(
              "p-3 rounded-lg border flex flex-col justify-between transition-all",
              changedCount > 0 
                ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/10 dark:border-emerald-900/50" 
                : "bg-background/50 border-border"
            )}>
              <div>
                <div className="flex items-center justify-between">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Market_Harvest</div>
                    <Badge className="bg-emerald-600 text-[9px] h-4">Verified</Badge>
                </div>

                <div className="mt-2 flex items-baseline gap-2">
                    <div className="font-black text-2xl text-emerald-600 dark:text-emerald-500">{salary.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground font-bold uppercase">RUB</div>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-[11px] items-center">
                    <span className="text-muted-foreground">Выгружено:</span>
                    <span className="font-bold">{offloadUnits} ед.</span>
                </div>
                <div className="flex justify-between text-[11px] items-center pt-1 border-t border-emerald-500/20">
                    <span className="text-brand-pink font-bold flex items-center gap-1">
                        <Users size={12} /> Squad_Tax (13%):
                    </span>
                    <span className="text-brand-pink font-black">+{teambuildingContribution} ₽</span>
                </div>
                <div className="text-[8px] text-zinc-500 italic leading-none">
                    * Ожидаемое пополнение фонда тимбилдинга
                </div>
              </div>
            </section>
          </div>

          {/* СЕКЦИЯ 3: DAILY GOALS (Original logic) */}
          <div className="mt-3 p-3 rounded-lg bg-background/50 border border-border">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-bold uppercase flex items-center gap-2 tracking-widest text-zinc-400">
                <Target className="w-3 h-3 text-green-500" />
                Ежедневные цели
              </h4>
              <Badge variant={totalXtr > 0 ? "default" : "secondary"} className="text-[10px] font-black">
                {totalXtr} XTR
              </Badge>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] text-muted-foreground mb-1 flex justify-between">
                    <span>Выдано: {offloadUnits}/{dailyGoals.units}</span>
                    <span>{unitsProgress.toFixed(0)}%</span>
                </div>
                <Progress value={unitsProgress} className="h-1" />
              </div>
              {errorFree && (
                <div className="text-[10px] text-green-500 font-bold flex items-center gap-1">
                    <Award size={12} /> PERFECT SHIFT: +{dailyGoals.xtr} XTR UNLOCKED
                </div>
              )}
            </div>
          </div>
        </main>

        {/* ASIDE: GHOST BALANCE & RATING */}
        <aside className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-3">
          {/* КУМУЛЯТИВНЫЙ БАЛАНС GV (Новый блок) */}
          <div className="p-3 rounded-lg bg-zinc-900 border-2 border-brand-purple shadow-[0_0_15px_rgba(168,85,247,0.1)] relative overflow-hidden group">
            <div className="absolute -right-2 -bottom-2 opacity-5 group-hover:opacity-10 transition-opacity">
                <Ghost size={60} />
            </div>
            <div className="text-[10px] text-brand-purple font-black uppercase tracking-widest mb-1">Ghost_Ledger_Total</div>
            <div className="flex items-baseline gap-2">
                <div className="text-3xl font-black text-white">{totalGhostBalance.toLocaleString()}</div>
                <div className="text-xs text-brand-purple font-bold">GV</div>
            </div>
            <div className="mt-2 text-[9px] text-zinc-500 leading-tight uppercase">
                Mining status: <span className="text-brand-green">Stable</span> <br/>
                Next unlock: <span className="text-white">Anduril_Blaster v2</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-background/50 border border-border flex-1">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-500">
                <Award className="w-4 h-4" /> Top Operators
              </div>
              <Button variant="ghost" size="sm" onClick={shareScore} className="h-6 text-[10px] font-bold">
                <Share2 className="w-3 h-3 mr-1" /> EXPORT
              </Button>
            </div>

            <ol className="space-y-2 text-[12px]">
              <AnimatePresence>
                {top.length > 0 ? top.map((entry, idx) => (
                  <motion.li key={idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between gap-2 p-1.5 rounded bg-zinc-950/20 border border-transparent hover:border-border/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn("w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black",
                        idx === 0 ? "bg-amber-500 text-black" :
                          idx === 1 ? "bg-slate-400 text-black" :
                            idx === 2 ? "bg-amber-800 text-white" : "bg-muted"
                      )}>
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold truncate uppercase">{entry.name}</div>
                      </div>
                    </div>
                    <div className="font-black text-brand-cyan">{entry.score}</div>
                  </motion.li>
                )) : (
                  <li className="text-zinc-600 italic text-[11px] text-center py-4 uppercase tracking-widest">Scanning local frequencies...</li>
                )}
              </AnimatePresence>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}