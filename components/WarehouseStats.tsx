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

  // --- GHOST ECONOMY: РУСИФИЦИРОВАННЫЕ РАСЧЕТЫ ---
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
    const text = `📊 ОТЧЕТ ОПЕРАЦИИ:
Выдано: ${offloadUnits} ед.
Намайнено: ${sessionGV} GV.
К выплате: ${salary} RUB.
Налог Squad (13%): ${squadTax} RUB.`;
    navigator.clipboard.writeText(text).then(() => { setCopied(true); toast.success("Отчет скопирован!"); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="p-3 bg-card border border-border rounded-xl text-[13px] font-mono shadow-sm">
      <div className="flex flex-col lg:flex-row gap-4">
        <main className="flex-1">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-black text-foreground uppercase flex items-center gap-2 tracking-tighter">
                <ShieldAlert size={14} className="text-destructive" /> Оперативная_Сводка
              </h3>
              <div className="text-[10px] text-muted-foreground mt-1 uppercase">ID: {dbUser?.user_id?.slice(0,8)} | ВРЕМЯ: {formatDuration(sessionDuration)}</div>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="h-5 text-[9px] border-border text-secondary-foreground">УР {level}</Badge>
              <Badge variant="outline" className="h-5 text-[9px] border-brand-pink text-brand-pink uppercase bg-brand-pink/10">СЕРИЯ {streak}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* ЭФФЕКТИВНОСТЬ */}
            <section className="p-3 bg-secondary border border-border rounded-lg relative overflow-hidden group">
              <div className="flex items-start gap-3">
                <motion.div animate={{ rotate: efficiency > 50 ? 360 : 0 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="p-1.5 bg-brand-green rounded-full shadow-lg shadow-brand-green/20">
                  <Zap size={14} className="text-white dark:text-black" />
                </motion.div>
                <div>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Боевой_Счет</div>
                  <div className="text-lg font-black text-foreground">{score.toLocaleString()}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="bg-background/50 p-2 border border-border rounded">
                    <div className="text-[8px] text-muted-foreground uppercase flex items-center gap-1"><Ghost size={10} className="text-brand-purple" /> Сессия_GV</div>
                    <div className="text-xs font-black text-brand-purple">+{sessionGV}</div>
                </div>
                <div className="bg-background/50 p-2 border border-border rounded">
                    <div className="text-[8px] text-muted-foreground uppercase flex items-center gap-1"><Star size={10} className="text-brand-gold" /> Звезды</div>
                    <div className="text-xs font-black text-foreground">{stars}</div>
                </div>
              </div>
            </section>

            {/* ХАРВЕСТ */}
            <section className="p-3 bg-secondary border border-border rounded-lg flex flex-col justify-between">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Рыночный_Харвест</div>
                <div className="flex items-baseline gap-1">
                    <span className="font-black text-2xl text-brand-green">{salary.toLocaleString()}</span>
                    <span className="text-[9px] text-muted-foreground font-bold uppercase">RUB</span>
                </div>
              </div>
              <div className="mt-4 pt-2 border-t border-border">
                <div className="flex justify-between text-[10px] items-center text-brand-pink">
                    <span className="font-bold flex items-center gap-1 uppercase tracking-tighter"><Users size={10} /> Налог_Squad (13%):</span>
                    <span className="font-black">+{squadTax} ₽</span>
                </div>
              </div>
            </section>
          </div>

          {/* ЦЕЛИ */}
          <div className="mt-3 p-3 bg-muted border border-border rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Оперативная Квота</span>
              <Badge variant={totalXtr > 0 ? "default" : "secondary"} className="text-[8px] h-4">{totalXtr} XTR БОНУС</Badge>
            </div>
            <Progress value={unitsProgress} className="h-1 bg-secondary" />
            <div className="mt-2 text-[9px] text-muted-foreground flex justify-between uppercase font-mono">
                <span>{offloadUnits} / {dailyGoals.units} ЕД.</span>
                {errorCount > 0 && <span className="text-destructive font-bold">ОШИБКИ: {errorCount}</span>}
            </div>
          </div>
        </main>

        {/* САЙДБАР */}
        <aside className="w-full lg:w-64 flex flex-col gap-3">
          {/* ПРИЗРАЧНЫЙ РЕЕСТР */}
          <div className="p-3 bg-secondary border-2 border-brand-purple rounded-lg relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity"><Ghost size={80} /></div>
            <div className="text-[10px] text-brand-purple font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                <Coins size={12} /> Призрачный_Реестр
            </div>
            <div className="text-3xl font-black text-foreground tracking-tighter">{totalGhostBalance.toLocaleString()} <span className="text-xs text-brand-purple">GV</span></div>
            <div className="mt-2 text-[9px] text-muted-foreground uppercase font-mono">
                Статус: <span className="text-foreground">Автономно</span>
            </div>
          </div>

          {/* РЕЙТИНГ */}
          <div className="p-3 bg-secondary border border-border rounded-lg flex-1">
            <div className="flex justify-between items-center mb-3 border-b border-border pb-2">
                <span className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-500 tracking-tighter">Элитные Операторы</span>
                <Button variant="ghost" onClick={shareScore} className="h-5 w-5 p-0 hover:text-brand-cyan text-foreground"><Share2 size={10} /></Button>
            </div>
            <div className="space-y-1.5">
                {top.map((entry, idx) => (
                  <div key={idx} className="flex justify-between text-[11px] p-1 rounded hover:bg-accent/50 transition-colors">
                    <span className="font-bold text-muted-foreground">0{idx+1} <span className="text-foreground ml-1 uppercase">{entry.name}</span></span>
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