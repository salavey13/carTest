// /app/franchize/[slug]/leads/components/LeadSpeedPanel.tsx
//
// СКОРОСТЬ ОБРАБОТКИ ЛИДОВ — счётчики по просьбе босса
// («add counters to visualize lead handling speed»).
//
// Полоса под KPI-картами: медианная скорость ответа, сколько обработано
// сегодня, сколько ЖДУТ (живая очередь) и сколько из них уже за пределами
// SLA-суток. Под ней — стопка-бар распределения времени ответа (зелёный →
// красный) и чипы перезвонов. Оператор за секунду видит, где застревает
// скорость, и кого спасать первым (подсказка «дольше всех ждут» — в
// tooltip плитки «Ждут ответа»). Ниже — «Общие факторы побед» (wave
// «Hormozi Blueprint», шаг 9 common factors analysis): честное сравнение
// закрытых побед/потерь по скорости/каналу/выходным/диалогу — только когда
// в обеих группах достаточно данных (n-гварды в lib/lead-win-patterns.ts).
//
// Все цифры приходят из lib/lead-speed.ts (чистый расчёт); компонент только
// визуализирует. nowTick родителя обновляет метрики раз в минуту.

"use client";

import { motion } from "framer-motion";
import { Timer, CheckCheck, Hourglass, AlarmClock, PhoneCall, TrendingUp } from "lucide-react";
import type { LeadSpeedMetrics } from "../lib/lead-speed";
import { fmtDurationMs } from "../lib/lead-speed";
import type { WinPattern } from "../lib/lead-win-patterns";

interface LeadSpeedPanelProps {
  metrics: LeadSpeedMetrics;
  /** «Общие факторы побед» из kpi-агрегата (могут отсутствовать — блок молчит). */
  winPatterns?: WinPattern[];
  T: any;
}

interface Tile {
  icon: typeof Timer;
  label: string;
  value: string;
  color: string;
  title?: string;
  /** Критическая метрика (> 0) — мигающая точка привлекает взгляд. */
  pulse?: boolean;
}

export function LeadSpeedPanel({ metrics, winPatterns = [], T }: LeadSpeedPanelProps) {
  const totalHandledTimed = metrics.buckets.reduce((s, b) => s + b.count, 0);

  const tiles: Tile[] = [
    {
      icon: Timer,
      label: "Медиана ответа",
      value: metrics.medianMs != null ? fmtDurationMs(metrics.medianMs) : "—",
      color: T.accent,
      title:
        metrics.avgMs != null
          ? `Средняя — ${fmtDurationMs(metrics.avgMs)}, лучший ответ — ${fmtDurationMs(metrics.fastestMs ?? 0)}`
          : "Пока нет отметок «обработан» с временем — медиана появится после первой отметки",
    },
    {
      icon: CheckCheck,
      label: "Обработано сегодня",
      value: String(metrics.handledToday),
      color: "#10b981",
      title: `Всего обработано: ${metrics.handledTotal} · дошли до аренды/покупки: ${metrics.converted}`,
    },
    {
      icon: Hourglass,
      label: "Ждут ответа",
      value: String(metrics.waitingTotal),
      color: metrics.waitingTotal > 0 ? "#f59e0b" : T.textMuted,
      title:
        metrics.worstWaiting.length > 0
          ? `Дольше всех ждут: ${metrics.worstWaiting
              .map((w) => `${w.name} (${fmtDurationMs(w.ageMs)})`)
              .join(", ")}`
          : "Очередь пуста — все лиды отработаны",
    },
    {
      icon: AlarmClock,
      label: "Ждут > 24 ч",
      value: String(metrics.waitingOver24h),
      color: metrics.waitingOver24h > 0 ? "#ef4444" : T.textMuted,
      pulse: metrics.waitingOver24h > 0,
      title:
        metrics.waitingOver1h > 0
          ? `Из них дольше часа ждут: ${metrics.waitingOver1h}`
          : "Пока никто не просрочил SLA-сутки",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border p-3 sm:p-4"
      style={{ borderColor: T.border, backgroundColor: T.bgCard }}
    >
      {/* Плитки-счётчики */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.label}
              title={t.title}
              className="rounded-xl border px-3 py-2"
              style={{ borderColor: T.border, backgroundColor: T.borderSoft }}
            >
              <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: t.color }} />
                <p className="truncate text-[10px] font-medium uppercase tracking-wider" style={{ color: T.textFaint }}>
                  {t.label}
                </p>
                {t.pulse && (
                  <motion.span
                    aria-hidden="true"
                    className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: "#ef4444" }}
                    animate={{ opacity: [1, 0.25, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  />
                )}
              </div>
              <p className="mt-0.5 text-lg font-black leading-tight tracking-tight" style={{ color: t.color }}>
                {t.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Распределение скорости: стопка-бар + легенда */}
      {totalHandledTimed > 0 && (
        <>
          <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: T.borderSoft }}>
            {metrics.buckets.map((b) =>
              b.count > 0 ? (
                <motion.div
                  key={b.key}
                  className="h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(b.count / totalHandledTimed) * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  style={{ backgroundColor: b.color }}
                  title={`${b.label}: ${b.count}`}
                />
              ) : null,
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {metrics.buckets.map((b) => (
              <span key={b.key} className="flex items-center gap-1 text-[10px]" style={{ color: T.textMuted }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: b.color }} />
                {b.label} · {b.count}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Перезвоны */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
          style={{
            borderColor: metrics.callbacksOverdue > 0 ? "rgba(239,68,68,0.45)" : T.border,
            color: metrics.callbacksOverdue > 0 ? "#ef4444" : T.textMuted,
            backgroundColor: metrics.callbacksOverdue > 0 ? "rgba(239,68,68,0.08)" : "transparent",
          }}
        >
          <PhoneCall className="h-3 w-3" />
          {metrics.callbacksOverdue > 0
            ? `Просрочено перезвонов: ${metrics.callbacksOverdue}`
            : `Перезвонов в работе: ${metrics.callbacksPending}`}
        </span>
        {metrics.waitingTotal > 0 && (
          <span className="text-[10px]" style={{ color: T.textFaint }}>
            Правило 5 минут (курс 2026): после 5 минут тишины шанс сделки −80% · ответ в первую минуту = +391%
          </span>
        )}
      </div>

      {/* Общие факторы побед (Hormozi, common factors analysis): показываем
          только когда данных достаточно — иначе честно молчим. */}
      {winPatterns.length > 0 && (
        <div
          className="mt-3 rounded-xl border px-3 py-2"
          style={{ borderColor: "#f5b3012e", backgroundColor: "#f5b3010a" }}
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 shrink-0" style={{ color: "#f5b301" }} aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#f5b301" }}>
              Общие факторы побед
            </span>
            <span className="text-[10px]" style={{ color: T.textFaint }}>
              что отличает закрытые сделки от потерь
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {winPatterns.map((p) => (
              <div
                key={p.key}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px]"
                title={p.hint}
              >
                <span className="font-semibold" style={{ color: T.text }}>
                  {p.label}
                </span>
                <span style={{ color: "#22c55e" }}>у побед {Math.round(p.wonShare * 100)}%</span>
                <span style={{ color: T.textFaint }}>vs</span>
                <span style={{ color: T.textMuted }}>у потерь {Math.round(p.lostShare * 100)}%</span>
                <span className="text-[10px]" style={{ color: T.textFaint }}>
                  (n={p.wonN}/{p.lostN})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
