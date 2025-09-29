"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Star, Package, Clock, Zap, Award, AlertTriangle, Users } from "lucide-react";

interface LeaderboardEntry {
  name: string;
  score: number;
  date: string;
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
  packings: number;
  stars: number;
  offloadUnits: number;
  salary: number;
  achievements: string[];
  sessionStart: number | null;
  errorCount: number;
  bossMode: boolean;
  bossTimer: number;
  leaderboard?: LeaderboardEntry[];
}

const formatDuration = (sec: number) => {
  if (!Number.isFinite(sec) || sec <= 0) return "00:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

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
    packings,
    stars,
    offloadUnits,
    salary,
    achievements,
    sessionStart,
    errorCount,
    bossMode,
    bossTimer,
    leaderboard,
  } = props;

  const safeLeaderboard = Array.isArray(leaderboard) ? leaderboard : [];
  const sessionSec = Math.max(0, Math.floor((Date.now() - (sessionStart || Date.now())) / 1000));
  const top = useMemo(() => safeLeaderboard.slice(0, 5), [safeLeaderboard]);

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
                <div className="flex-shrink-0 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 p-2">
                  <Zap className="w-5 h-5 text-white" />
                </div>
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
                  <div className="font-medium mt-1">{packings}</div>
                </div>
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

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-2 rounded-lg bg-background/40 border border-border text-[12px] flex flex-col">
              <div className="text-[11px] text-muted-foreground">Время сессии</div>
              <div className="font-mono font-semibold mt-1">{formatDuration(sessionSec)}</div>
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
              {(!achievements || achievements.length === 0) ? <div className="text-[12px] text-muted-foreground">—</div> : achievements.map((a, i) => (
                <div key={i} className="text-[12px] px-2 py-1 bg-foreground/6 rounded-full truncate">{a}</div>
              ))}
            </div>
          </div>
        </main>

        <aside className="w-full lg:w-72 flex-shrink-0">
          <div className="p-3 rounded-lg bg-background/50 border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold"><Award className="w-4 h-4 text-amber-400" /> Рейтинг</div>
              <div className="text-xs text-muted-foreground">Топ {top.length}</div>
            </div>

            <ol className="mt-3 space-y-2 text-[13px]">
              {top.length > 0 ? top.map((entry, idx) => (
                <li key={idx} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn("w-6 h-6 flex items-center justify-center rounded-md text-sm font-semibold", idx === 0 ? "bg-amber-300" : idx === 1 ? "bg-slate-300" : idx === 2 ? "bg-amber-100" : "bg-muted")}>{idx + 1}</div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{entry.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{entry.date}</div>
                    </div>
                  </div>
                  <div className="font-semibold">{entry.score}</div>
                </li>
              )) : <li className="text-[12px] text-muted-foreground">Пусто</li>}
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
                <div className="font-medium">{Number.isFinite(salary) ? salary.toLocaleString() : 0} руб</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}