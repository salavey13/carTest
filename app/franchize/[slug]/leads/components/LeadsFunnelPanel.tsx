// /app/franchize/[slug]/leads/components/LeadsFunnelPanel.tsx
//
// ВОРОНКА KPI — оцифровка отдела продаж из протокола встречи:
//   Активность (лиды) → Диалог (отработан) → КЭВ (договор/бронь) → Сделка.
//
// Под ступенями — конверсии между уровнями, чипы «сегодня» (лиды, обработано,
// прогресс нормы дня), норма недели КЭВ, «горячие ждут» (не слить целевых!),
// тест-драйвы и средний чек (юнит-экономика лайт). Все цифры — из
// lib/lead-kpi.ts; здесь только визуализация.

"use client";

import { motion } from "framer-motion";
import {
  Users,
  MessagesSquare,
  KeyRound,
  Handshake,
  TrendingUp,
  Flame,
  Bike,
  Receipt,
  CalendarDays,
  ArrowRight,
} from "lucide-react";
import { NORM_KEV_PER_WEEK, type LeadKpiMetrics } from "../lib/lead-kpi";
import { fmtDurationMs } from "../lib/lead-speed";

// Сегмент воронки ПАЙПЛАЙНА (референс-дизайн §2): стадия + цвет + счётчик.
export interface StageSegment {
  key: string;
  label: string;
  color: string;
  count: number;
}

interface LeadsFunnelPanelProps {
  kpi: LeadKpiMetrics;
  T: any;
  /** Распределение лидов по стадиям пайплайна — горизонтальная полоса-воронка
   *  над KPI-ступенями. Клик по сегменту фильтрует список по стадии. */
  stageBreakdown?: StageSegment[];
  /** Активный stage-фильтр списка (подсветка сегмента). */
  activeStage?: string;
  /** Колбэк клика: получает key сегмента; повторный клик по активному — "all"
   *  (сброс) обрабатывается в панели, родителю летит уже готовое значение. */
  onStageSelect?: (key: string) => void;
}

function pct(v: number | null): string {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}

export function LeadsFunnelPanel({ kpi, T, stageBreakdown, activeStage, onStageSelect }: LeadsFunnelPanelProps) {
  const { funnel } = kpi;
  const stageTotal = stageBreakdown?.reduce((s, x) => s + x.count, 0) ?? 0;
  // Конверсия для футера полосы (референс: «Конверсия: 34%») — в сделку,
  // а если сделок ещё нет — в КЭВ, чтобы полоса не показывала «—» на живом пайплайне.
  const stripConversion = kpi.dealRate != null ? pct(kpi.dealRate) : pct(kpi.kevRate);

  const steps = [
    {
      key: "leads",
      label: "Лиды",
      sub: "вход в воронку",
      value: funnel.leads,
      color: "#3b82f6",
      icon: Users,
      rate: null as number | null,
    },
    {
      key: "dialogs",
      label: "Диалог",
      sub: "отработан",
      value: funnel.dialogs,
      color: "#06b6d4",
      icon: MessagesSquare,
      rate: kpi.responseRate,
    },
    {
      key: "kev",
      label: "КЭВ",
      sub: "договор / бронь",
      value: funnel.kev,
      color: "#f59e0b",
      icon: KeyRound,
      rate: kpi.kevRate,
    },
    {
      key: "deals",
      label: "Сделки",
      sub: "аренда / продажа",
      value: funnel.deals,
      color: "#22c55e",
      icon: Handshake,
      rate: kpi.dealRate,
    },
  ];

  const normPct = Math.round(Math.min(1, kpi.normProgress) * 100);
  const weekProgress = kpi.kevThisWeek / NORM_KEV_PER_WEEK;
  const weekPct = Math.round(Math.min(1, weekProgress) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border p-3 sm:p-4"
      style={{ borderColor: T.border, backgroundColor: T.bgCard }}
    >
      {/* Шапка */}
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" style={{ color: T.accent }} />
          <h3 className="text-sm font-bold" style={{ color: T.text }}>
            Воронка KPI
          </h3>
          <span className="text-[10px]" style={{ color: T.textFaint }}>
            Активность → Диалог → КЭВ → Сделка
          </span>
        </div>
        <span className="text-[10px]" style={{ color: T.textFaint }}>
          Ср. скорость ответа: {kpi.speed.medianMs != null ? fmtDurationMs(kpi.speed.medianMs) : "—"}
        </span>
      </div>

      {/* ВОРОНКА ПАЙПЛАЙНА (референс §2): горизонтальная полоса цветных
          сегментов по стадиям — ширина пропорциональна числу лидов, внутри
          счётчик + подпись. POINTINESS (референс): каждый сегмент заострён
          справа (clip-path шеврон), у всех кроме первого слева ответная
          выемка — полоса читается как настоящая сужающаяся воронка, а не
          ряд скруглённых плашек. Сплошная заливка цветом стадии, белые
          цифры — как в моке. Клик = фильтр списка по стадии (повторный клик —
          сброс), активный сегмент подсвечен свечением (drop-shadow работает
          ПОВЕРХ clip-path, в отличие от ring/outline, которые срезаются).
          На мобиле полоса скроллится, минимальная ширина сегмента —
          тап-таргет. */}
      {stageBreakdown && stageBreakdown.length > 0 && (
        <div className="mb-3">
          <div
            className="flex gap-1 overflow-x-auto pb-1"
            style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
            role="group"
            aria-label="Воронка пайплайна по стадиям"
          >
            {stageBreakdown.map((seg, idx) => {
              const active = activeStage === seg.key;
              return (
                <button
                  key={seg.key}
                  type="button"
                  onClick={() => onStageSelect?.(active ? "all" : seg.key)}
                  aria-pressed={active}
                  title={`${seg.label}: ${seg.count}${onStageSelect ? (active ? " — снять фильтр" : " — фильтровать список") : ""}`}
                  className="min-h-[52px] shrink-0 grow basis-0 cursor-pointer text-center transition active:scale-[0.97]"
                  style={{
                    minWidth: 72,
                    flexGrow: Math.max(1, seg.count),
                    flexBasis: 0,
                    paddingLeft: 12,
                    paddingRight: 8,
                    // Шеврон: острый правый край 9px + ответная выемка слева
                    // (кроме первого сегмента — плоский левый край, как в моке).
                    clipPath:
                      idx === 0
                        ? "polygon(0 0, calc(100% - 9px) 0, 100% 50%, calc(100% - 9px) 100%, 0 100%)"
                        : "polygon(0 0, calc(100% - 9px) 0, 100% 50%, calc(100% - 9px) 100%, 0 100%, 9px 50%)",
                    backgroundColor: seg.color,
                    opacity: active ? 1 : 0.85,
                    // Активный (выбранный фильтр): внутренняя белая кайма
                    // (box-shadow срезается clip-path в шеврон — то, что
                    // нужно) + свечение наружу (drop-shadow работает поверх
                    // clip-path, в отличие от ring/outline).
                    boxShadow: active ? "inset 0 0 0 2px rgba(255,255,255,0.7)" : undefined,
                    filter: active ? `drop-shadow(0 0 8px ${seg.color})` : undefined,
                  }}
                >
                  {/* РЕФЕРЕНС §2: подпись СВЕРХУ (переносится на 2 строки,
                      белая), крупный счётчик ПОД ней — зеркалит мок. */}
                  <span
                    className="block px-0.5 text-[10px] font-bold leading-[1.15] text-white"
                  >
                    {seg.label}
                  </span>
                  <span
                    className="block text-base font-black leading-tight tabular-nums text-white"
                  >
                    {seg.count}
                  </span>
                </button>
              );
            })}
          </div>
          {/* РЕФЕРЕНС: футер полосы — ярким первичным текстом (в моке
              «Всего лидов: 128» / «Конверсия: 34%» белые и заметные). */}
          <div className="mt-1 flex items-center justify-between text-[11px] font-semibold" style={{ color: T.text }}>
            <span>Всего лидов: {stageTotal}</span>
            <span>Конверсия: {stripConversion}</span>
          </div>
        </div>
      )}

      {/* Ступени воронки */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <div
              key={s.key}
              className="relative rounded-xl border px-3 py-2"
              style={{ borderColor: T.border, backgroundColor: T.borderSoft }}
            >
              {/* Соединитель ступеней — узел-стрелка в зазоре сетки (sm+,
                  где воронка в одну строку; на мобиле 2 колонки и он лишний). */}
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -left-3 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border sm:flex"
                  style={{ borderColor: T.border, backgroundColor: T.bgCard }}
                >
                  <ArrowRight className="h-2.5 w-2.5" style={{ color: T.textFaint }} />
                </span>
              )}
              <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: s.color }} />
                <p className="truncate text-[10px] font-medium uppercase tracking-wider" style={{ color: T.textFaint }}>
                  {s.label}
                </p>
              </div>
              <p className="mt-0.5 text-lg font-black leading-tight tracking-tight" style={{ color: s.color }}>
                {s.value}
              </p>
              <p className="text-[10px] leading-tight" style={{ color: T.textFaint }}>
                {s.rate != null ? `${pct(s.rate)} от лидов` : s.sub}
              </p>
              {/* Конверсия с предыдущей ступени — бейдж справа */}
              {i > 0 && steps[i - 1].value > 0 && (
                <span
                  className="absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                  style={{
                    backgroundColor: `${steps[i - 1].color}22`,
                    color: steps[i - 1].color,
                  }}
                  title={`Конверсия «${steps[i - 1].label}» → «${s.label}»`}
                >
                  {Math.round((s.value / steps[i - 1].value) * 100)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Норма дня */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[10px]" style={{ color: T.textFaint }}>
          <span>Норма дня: обработано {kpi.handledToday} из 4</span>
          <span style={{ color: kpi.normProgress >= 1 ? "#22c55e" : T.textMuted }}>
            {kpi.normProgress >= 1 ? `перевыполнена ×${kpi.normProgress.toFixed(1)}` : `${normPct}%`}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: T.borderSoft }}>
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, normPct)}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{
              backgroundColor: kpi.normProgress >= 1 ? "#22c55e" : T.accent,
            }}
          />
        </div>
      </div>

      {/* Норма недели по КЭВ (протокол: нормирование в недельном выражении) */}
      <div className="mt-2.5">
        <div className="mb-1 flex items-center justify-between text-[10px]" style={{ color: T.textFaint }}>
          <span>Норма недели КЭВ: {kpi.kevThisWeek} из {NORM_KEV_PER_WEEK}</span>
          <span style={{ color: weekProgress >= 1 ? "#22c55e" : T.textMuted }}>
            {weekProgress >= 1 ? `выполнена ×${weekProgress.toFixed(1)}` : `${weekPct}%`}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: T.borderSoft }}>
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, weekPct)}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{
              backgroundColor: weekProgress >= 1 ? "#22c55e" : "#f59e0b",
            }}
          />
        </div>
      </div>

      {/* Чипы активности / юнит-экономики */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
          style={{ borderColor: T.border, color: T.textMuted }}
          title="Лидов пришло сегодня"
        >
          <CalendarDays className="h-3 w-3" />
          Сегодня лидов: {kpi.leadsToday}
        </span>
        <span
          className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
          style={{ borderColor: T.border, color: T.textMuted }}
          title="Лидов пришло за текущую рабочую неделю (с понедельника)"
        >
          <CalendarDays className="h-3 w-3" />
          Неделя лидов: {kpi.leadsThisWeek}
        </span>
        {kpi.salesTotal > 0 && (
          <span
            className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
            style={{ borderColor: "rgba(139,92,246,0.4)", color: "#8b5cf6" }}
            title="Продаж байков — направление «продажи» из протокола"
          >
            🛵 Продаж: {kpi.salesTotal}
          </span>
        )}
        {kpi.hotTotal > 0 && (
          <span
            className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
            style={{
              borderColor: kpi.hotWaiting > 0 ? "rgba(239,68,68,0.45)" : "rgba(34,197,94,0.4)",
              color: kpi.hotWaiting > 0 ? "#ef4444" : "#22c55e",
              backgroundColor: kpi.hotWaiting > 0 ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.06)",
            }}
            title="Горячие лиды (temperature=hot) без ответа — главная задача: не слить целевых"
          >
            <Flame className="h-3 w-3" />
            {kpi.hotWaiting > 0 ? `Горячих ждут: ${kpi.hotWaiting}` : "Горячие — все отвечены"}
            {kpi.hotWaiting > 0 && (
              <motion.span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: "#ef4444" }}
                animate={{ opacity: [1, 0.25, 1] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              />
            )}
          </span>
        )}
        {kpi.testdrives > 0 && (
          <span
            className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
            style={{ borderColor: "rgba(245,158,11,0.4)", color: "#f59e0b" }}
            title="Лиды с заявленным тест-драйвом (из AI-анализа Авито) — КЭВ-приглашения"
          >
            <Bike className="h-3 w-3" />
            Тест-драйвы: {kpi.testdrives}
          </span>
        )}
        {/* «Продавай 7 дней в неделю» (курс 2026): сб+вс = +104 дня = +29% к году.
            Чип показывает покрытие выходных лидов — где теряем деньги. */}
        {kpi.weekendLeads > 0 && (
          <span
            className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
            style={{
              borderColor:
                kpi.weekendHandled < kpi.weekendLeads ? "rgba(245,158,11,0.4)" : "rgba(34,197,94,0.4)",
              color: kpi.weekendHandled < kpi.weekendLeads ? "#f59e0b" : "#22c55e",
            }}
            title="Выходные лиды (сб/вс) и сколько из них обработано — «продавай 7 дней в неделю»: +29% выручки за счёт выходных"
          >
            <CalendarDays className="h-3 w-3" />
            Выходные: {kpi.weekendHandled}/{kpi.weekendLeads}
          </span>
        )}
        {/* EDGE CASE: Number.isFinite — страховка, чтобы битые данные никогда
            не отрисовали «NaN ₽» / «Infinity ₽» (либ уже гарантирует конечность). */}
        {kpi.avgDealCheck != null && Number.isFinite(kpi.avgDealCheck) && (
          <span
            className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
            style={{ borderColor: "rgba(34,197,94,0.4)", color: "#22c55e" }}
            title={`Выручка экипажа: ${Math.round(kpi.revenue).toLocaleString("ru-RU")} ₽`}
          >
            <Receipt className="h-3 w-3" />
            Ср. чек: {Math.round(kpi.avgDealCheck).toLocaleString("ru-RU")} ₽
          </span>
        )}
      </div>
    </motion.div>
  );
}
