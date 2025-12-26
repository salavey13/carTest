"use client";

import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Star, Package, Clock, Zap, Award, AlertTriangle, Users, TrendingUp, Target, Share2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";

/**
 * Flexible WarehouseStats:
 * - accepts either 'stats' object (legacy compact) or explicit props
 * - provides sensible defaults
 */

type LeaderboardEntry = { name: string; score: number; date: string; xtr?: number; };

interface IncomingProps {
  // legacy compact
  stats?: { changedCount?: number; totalDelta?: number; stars?: number; offloadUnits?: number; salary?: number };
  // explicit overrides
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
  // merge legacy stats object with explicit props; explicit props win
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

  const { user } = useAppContext();
  const [copied, setCopied] = useState(false);

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
    const text = `🏆 Мой счёт в Warehouse: ${score} очков! Уровень ${level}, серия ${streak}. Заработано ${totalXtr} XTR.`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("Счёт скопирован!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="p-3 bg-muted rounded-lg text-[13px]">
      <div className="flex flex-col lg:flex-row items-stretch gap-4">
        <main className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">Статистика склада</h3>
              <div className="mt-1 text-xs text-muted-foreground truncate">Элементов: <b>{itemsCount}</b> · Уник.: <b>{uniqueIds}</b></div>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <div className="text-xs text-muted-foreground">Ур: <b>{level}</b></div>
              <div className="text-xs text-muted-foreground">Серия: <b>{streak}</b></div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <section className="p-3 rounded-lg bg-background/50 border border-border flex flex-col">
              <div className="flex items-start gap-3">
                <motion.div
                  animate={{ rotate: efficiency > 50 ? 360 : 0 }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex-shrink-0 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 p-2"
                >
                  <Zap className="w-5 h-5 text-white" />
                </motion.div>
                <div className="min-w-0">
                  <div className="text-[11px] text-muted-foreground truncate">Эффективность</div>
                  <div className="text-lg font-bold truncate">{Number.isFinite(score) ? score.toLocaleString() : 0}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="flex flex-col">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2"><Star className="w-4 h-4 text-yellow-400" /> Звёзды</div>
                  <div className="font-medium mt-1">{Number.isFinite(stars) ? stars : 0}</div>
                </div>

                <div className="flex flex-col">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2"><Package className="w-4 h-4" /> Упаковок</div>
                  <div className="font-medium mt-1">0</div>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-border/50">
                <div className="text-[11px] text-muted-foreground flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Эффект.: {efficiency} ед/ч</div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2"><Clock className="w-4 h-4" /> Ср. время: {avgTimePerItem}s/ед</div>
              </div>
            </section>

            {/* FIXED: Dark mode variants added for better contrast */}
            <section className={cn(
              "p-3 rounded-lg border",
              changedCount > 0 
                ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800" 
                : "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800"
            )}>
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-muted-foreground">Checkpoint</div>
                <div className="text-[11px] text-muted-foreground truncate">—</div>
              </div>

              <div className="mt-2 flex items-baseline gap-3">
                <div className="font-mono text-2xl font-bold truncate">{changedCount}</div>
                <div className="text-sm text-muted-foreground">Изм. позиций: <b>{changedCount}</b></div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 text-[12px] text-muted-foreground">
                <div>Изменённое кол-во: <b className="text-foreground">{totalDelta}</b></div>
                <div>Выдано: <b className="text-foreground">{offloadUnits}</b> · Зарплата: <b className="text-foreground">{Number.isFinite(salary) ? salary.toLocaleString() : 0}</b> руб</div>
              </div>
            </section>
          </div>

          {/* FIXED: Dark mode variants added for the gradient */}
          <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 dark:from-green-950/40 dark:to-emerald-950/40 dark:border-green-800">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Target className="w-4 h-4 text-green-600 dark:text-green-400" />
                Ежедневные цели
              </h4>
              <Badge variant={totalXtr > 0 ? "default" : "secondary"} className="text-xs">
                {totalXtr} XTR
              </Badge>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-[11px] text-muted-foreground mb-1">Выдано ед.: {offloadUnits}/{dailyGoals.units}</div>
                <Progress value={unitsProgress} className="h-2" />
              </div>
              {errorFree && (
                <div className="text-[11px] text-green-600 dark:text-green-400 font-medium">✅ Без ошибок (бонус +{dailyGoals.xtr} XTR!)</div>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-2 rounded-lg bg-background/40 border border-border text-[12px] flex flex-col">
              <div className="text-[11px] text-muted-foreground">Время сессии</div>
              <div className="font-mono font-semibold mt-1">{formatDuration(sessionDuration)}</div>
            </div>

            <div className="p-2 rounded-lg bg-background/40 border border-border text-[12px] flex flex-col">
              <div className="text-[11px] text-muted-foreground">Ошибки</div>
              <div className="font-semibold mt-1 text-destructive">{errorCount}</div>
            </div>

            <div className="p-2 rounded-lg bg-background/40 border border-border text-[12px] flex flex-col">
              <div className="text-[11px] text-muted-foreground flex items-center gap-2">Босс режим: {bossMode ? <AlertTriangle className="w-4 h-4 text-destructive" /> : <Users className="w-4 h-4 text-muted-foreground" />}</div>
              <div className="font-semibold mt-1">{bossMode ? `${Math.max(0, Math.floor((bossTimer || 0) / 1000))} сек` : "—"}</div>
            </div>
          </div>

          <div className="mt-3">
            <div className="text-[11px] text-muted-foreground">Достижения</div>
            <div className="mt-1 flex flex-wrap gap-2">
              <AnimatePresence>
                {(!achievements || achievements.length === 0) ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[12px] text-muted-foreground">
                    —
                  </motion.div>
                ) : (
                  achievements.map((a, i) => (
                    <motion.div key={i} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-xs font-semibold text-white shadow-lg">
                      {a.split(" ")[0]}
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>

        <aside className="w-full lg:w-72 flex-shrink-0">
          <div className="p-3 rounded-lg bg-background/50 border border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-semibold"><Award className="w-4 h-4 text-amber-400" /> Рейтинг</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={shareScore}
                className="h-6 text-xs"
                disabled={copied}
              >
                <Share2 className="w-3 h-3 mr-1" />
                {copied ? "Скопировано!" : "Поделиться"}
              </Button>
            </div>

            <ol className="mt-3 space-y-2 text-[13px]">
              <AnimatePresence>
                {top.length > 0 ? top.map((entry, idx) => (
                  <motion.li key={idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* FIXED: Rank badges adjusted for dark mode contrast */}
                      <div className={cn("w-6 h-6 flex items-center justify-center rounded-full text-sm font-semibold",
                        idx === 0 ? "bg-amber-300 text-amber-800 dark:bg-amber-600 dark:text-amber-100" :
                          idx === 1 ? "bg-slate-300 text-slate-800 dark:bg-slate-600 dark:text-slate-200" :
                            idx === 2 ? "bg-amber-100 text-amber-800 dark:bg-amber-800 dark:text-amber-100" : "bg-muted text-muted-foreground dark:bg-muted/50 dark:text-muted-foreground"
                      )}>
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{entry.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{entry.date}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 font-semibold">
                      {entry.score}
                      {entry.xtr ? <Star className="w-3 h-3 text-yellow-400" /> : null}
                    </div>
                  </motion.li>
                )) : (
                  <motion.li initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[12px] text-muted-foreground">Пусто — будь первым!</motion.li>
                )}
              </AnimatePresence>
            </ol>
          </div>

          <div className="mt-3 p-3 rounded-lg bg-background/30 border border-border text-[12px]">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">Быстрые показатели</div>
            <div className="mt-2 grid grid-cols-1 gap-2">
              <div className="flex items-center justify-between">
                <div className="text-[12px]">Изм. позиций</div>
                <div className="font-medium">{changedCount}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-[12px]">Выдано ед.</div>
                <div className="font-medium">{offloadUnits}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-[12px]">Зарплата</div>
                <div className="font-medium">{Number.isFinite(salary) ? salary.toLocaleString() : 0} руб + {totalXtr} XTR</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}