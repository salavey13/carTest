"use client";

import React from "react";
import { cn } from "@/lib/utils";

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
  checkpointMain: string; // formatted time or --:--
  checkpointSub: string;
  changedCount: number;
  totalDelta: number;
  packings: number;
  stars: number;
  offloadUnits: number;
  salary: number;
  achievements: string[];
  sessionStart: number;
  errorCount: number;
  bossMode: boolean;
  bossTimer: number;
  leaderboard: LeaderboardEntry[];
}

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

  const sessionSec = Math.floor((Date.now() - sessionStart) / 1000);

  return (
    <div className="p-3 bg-muted rounded-lg text-[12px] space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Статистика</h3>
        <div className="text-[11px] opacity-80">Элементов: <b>{itemsCount}</b> · Уникальных ID: <b>{uniqueIds}</b></div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 bg-white/5 rounded flex flex-col gap-1">
          <div className="text-[11px]">Эффективность</div>
          <div className="text-lg font-bold">{score} <span className="text-xs opacity-70"> (Вал: {Math.floor(score/100)})</span></div>
          <div className="text-[11px] opacity-70">Ур: {level} · Серия: {streak} · Дни: {dailyStreak}</div>
        </div>

        <div className={cn("p-2 rounded", checkpointMain !== "--:--" ? "bg-emerald-600/10 border border-emerald-300" : "bg-yellow-600/5 border border-yellow-300")}>
          <div className="text-[11px]">Checkpoint</div>
          <div className="flex items-baseline gap-3">
            <div className="text-2xl font-mono font-bold">{checkpointMain}</div>
            <div className="text-[11px] opacity-80">
              {checkpointSub}
            </div>
          </div>
          <div className="text-[12px] mt-1 opacity-80">
            Изм. позиций: <b>{changedCount}</b> · Изменённое кол-во: <b>{totalDelta}</b>
            <div className="mt-1 text-[11px] opacity-80">
              Выдано единиц: <b>{offloadUnits}</b> · Зарплата: <b>{salary}</b> руб <span className="opacity-60 text-[10px]"> (50 руб/единица)</span>
            </div>
            <div className="mt-1 text-[11px] opacity-80">
              Упаковок: <b>{packings}</b> · Звёзд: <b>{stars}</b> <span className="opacity-60 text-[10px]"> (1 упаковка = 25⭐)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="text-[11px]">
        <div>Достижения: <span className="font-medium">{achievements.join(", ") || "—"}</span></div>
        <div className="mt-1">Время сессии: <b>{sessionSec}</b> сек · Ошибки: <b>{errorCount}</b></div>
        {bossMode && <div className="text-destructive">Критическая! Осталось: <b>{Math.floor(bossTimer/1000)}</b> сек</div>}
      </div>

      <div>
        <div className="text-[11px]">Рейтинг:</div>
        <ol className="list-decimal pl-4 text-[10px]">
          {leaderboard.map((entry, idx) => (
            <li key={idx}>{entry.name}: {entry.score} ({entry.date})</li>
          ))}
        </ol>
      </div>
    </div>
  );
}