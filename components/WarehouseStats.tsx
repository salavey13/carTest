"use client";

import React, { useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Star, Package, Clock, Zap, Award, AlertTriangle, Users, TrendingUp, Target, Crown, Share2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";

interface LeaderboardEntry {
  name: string;
  score: number;
  date: string;
  xtr: number; // Новое: XTR earned
}

interface WarehouseStatsProps {
  itemsCount: number;
  uniqueIds: number;
  score: number;
  level: number;
  streak: number;
  dailyStreak: number;
  checkpointMain: string;
  checkpointSub: string;
  changedCount: number;
  totalDelta: number;
  stars: number;
  offloadUnits: number;
  salary: number;
  achievements: string[];
  sessionStart: number | null;
  errorCount: number;
  bossMode: boolean;
  bossTimer: number;
  leaderboard?: LeaderboardEntry[];
  efficiency?: number; // Новое
  avgTimePerItem?: number; // Новое
  dailyGoals?: { units: number; errors: number; xtr: number }; // Новое
  sessionDuration?: number; // Новое
}

const formatDuration = (sec: number) => {
  if (!Number.isFinite(sec) || sec <= 0) return "00:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const AchievementBadge: React.FC<{ name: string; xtr?: number }> = ({ name, xtr }) => (
  <motion.div
    initial={{ scale: 0.8, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: "spring", stiffness: 400, damping: 17 }}
    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-xs font-semibold text-white shadow-lg"
  >
    {name.split(" ")[0]}
    {xtr && <span className="text-xs">⭐{xtr}</span>}
  </motion.div>
);

export default function WarehouseStats(props: WarehouseStatsProps) {
  const {
    itemsCount,
    uniqueIds,
    score,
    level,
    streak,
    dailyStreak,
    checkpointMain,
    checkpointSub,
    changedCount,
    totalDelta,
    stars,
    offloadUnits,
    salary,
    achievements,
    sessionStart,
    errorCount,
    bossMode,
    bossTimer,
    leaderboard,
    efficiency = 0,
    avgTimePerItem = 0,
    dailyGoals = { units: 100, errors: 0, xtr: 100 },
    sessionDuration = 0,
  } = props;

  const { user } = useAppContext();
  const [copied, setCopied] = useState(false);

  const safeLeaderboard = Array.isArray(leaderboard) ? leaderboard : [];
  const top = useMemo(() => safeLeaderboard.slice(0, 3), [safeLeaderboard]);

  const unitsProgress = useMemo(() => Math.min(100, (offloadUnits / dailyGoals.units) * 100), [offloadUnits, dailyGoals.units]);
  const errorFree = errorCount === 0 && sessionDuration > 3600; // бонус за zero errors в длинной сессии

  const totalXtr = useMemo(() => {
    let earned = 0;
    if (unitsProgress >= 100) earned += 50;
    if (errorFree) earned += dailyGoals.xtr;
    return earned;
  }, [unitsProgress, errorFree, dailyGoals.xtr]);

  const shareScore = () => {
    const text = `🏆 Мой счёт в Warehouse Quest: ${score} очков! Уровень ${level}, серия ${streak}. Заработано ${totalXtr} XTR. Присоединяйся!`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("Счёт скопирован!", { description: "Поделись в чате для XTR-бонуса" });
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
                  <div className="text-[11px] text-muted-foreground truncate sm:hidden">Ур: <b>{level}</b> · Серия: <b>{streak}</b></div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="flex flex-col">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2"><Star className="w-4 h-4 text-yellow-400" /> Звёзды</div>
                  <div className="font-medium mt-1">{Number.isFinite(stars) ? stars.toLocaleString() : 0}</div>
                </div>

                <div className="flex flex-col">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2"><Package className="w-4 h-4" /> Упаковок</div>
                  <div className="font-medium mt-1">0</div>
                </div>
              </div>

              {/* Новое: Efficiency & Avg Time */}
              <div className="mt-2 pt-2 border-t border-border/50">
                <div className="text-[11px] text-muted-foreground flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Эффект.: {efficiency} ед/ч</div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2"><Clock className="w-4 h-4" /> Ср. время: {avgTimePerItem}s/ед</div>
              </div>
            </section>

            <section className={cn("p-3 rounded-lg border", checkpointMain !== "--:--" ? "bg-emerald-50 border-emerald-200" : "bg-yellow-50 border-yellow-200")}>
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-muted-foreground">Checkpoint</div>
                <div className="text-[11px] text-muted-foreground truncate">{checkpointSub}</div>
              </div>

              <div className="mt-2 flex items-baseline gap-3">
                <div className="font-mono text-2xl font-bold truncate">{checkpointMain}</div>
                <div className="text-sm text-muted-foreground">Изм. позиций: <b>{changedCount}</b></div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 text-[12px] text-muted-foreground">
                <div>Изменённое кол-во: <b className="text-foreground">{totalDelta}</b></div>
                <div>Выдано: <b className="text-foreground">{offloadUnits}</b> · Зарплата: <b className="text-foreground">{Number.isFinite(salary) ? salary.toLocaleString() : 0}</b> руб</div>
              </div>
            </section>
          </div>

          {/* Новое: Daily Goals Progress */}
          <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Target className="w-4 h-4 text-green-600" />
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
                <div className="text-[11px] text-green-600 font-medium">✅ Без ошибок (бонус +{dailyGoals.xtr} XTR!)</div>
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
              <div className="text-[11px] text-muted-foreground flex items-center gap-2">Режим босс: {bossMode ? <AlertTriangle className="w-4 h-4 text-destructive" /> : <Users className="w-4 h-4 text-muted-foreground" />}</div>
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
                    <AchievementBadge key={i} name={a} xtr={parseInt(a.match(/\+(\d+) XTR/)?.[1] || "0")} />
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
                  <motion.li
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn("w-6 h-6 flex items-center justify-center rounded-full text-sm font-semibold", 
                        idx === 0 ? "bg-amber-300 text-amber-800" : 
                        idx === 1 ? "bg-slate-300 text-slate-800" : 
                        idx === 2 ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"
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
                      {entry.xtr > 0 && <Star className="w-3 h-3 text-yellow-400 fill-current" />}
                    </div>
                  </motion.li>
                )) : (
                  <motion.li
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[12px] text-muted-foreground"
                  >
                    Пусто — будь первым!
                  </motion.li>
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