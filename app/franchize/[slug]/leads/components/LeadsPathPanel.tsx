// /app/franchize/[slug]/leads/components/LeadsPathPanel.tsx
//
// ── «ПУТЬ ОПЕРАТОРА»: лестница, которая растёт по одному шагу за смену ──────
//
// КЛИЕНТСКАЯ ПРОСЬБА: «introduce all steps one by one … spread to several
// iterations, adding one more step each time … engaging gamification».
// Панель рисует результат чистого ядра lib/lead-path.ts:
//   • открытые шаги — с чек-прогрессом по ОЧКАМ прозрачного лидерборда;
//   • текущий шаг подсвечен, его подсказка объясняет, какие действия дают
//     очки (не только закрытия — взял в работу, перезвон, задача, заметка);
//   • нераскрытые шаги — замки-тизеры: «новый шаг — следующая смена»;
//   • завершение шага = мягкая анимация + вибро (buzz) — празднуется один раз
//     (состояние celebrated живёт в users.metadata.leads_path).
//
// CREW-ONLY: панель монтируется только экипажем (как достижения/лидерборд).

"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Lock, Map as MapIcon } from "lucide-react";
import type { ThemeTokens } from "../hooks/useTheme";
import {
  LEAD_PATH_STEPS,
  type LeadPathProgress,
  type LeadPathState,
  type LeadPathStep,
  type LeadPathStepView,
} from "../lib/lead-path";

function buzz(ms = 10): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(ms);
    }
  } catch { /* no haptics on desktop */ }
}

interface Props {
  progress: LeadPathProgress;
  state: LeadPathState;
  /** Мои очки из серверного лидерборда — прогресс-бар текущего шага. */
  myPoints: number;
  /** Патч состояния (drip/catch-up/celebrated) — родитель сохраняет в metadata. */
  onStatePatch: (next: LeadPathState) => void;
  T: ThemeTokens;
}

/** Одна плитка шага: done / current / open / locked. */
function StepCell({
  step,
  view,
  pct,
  myPoints,
  T,
}: {
  step: LeadPathStep;
  view: LeadPathStepView;
  pct: number;
  myPoints: number;
  T: ThemeTokens;
}) {
  if (view === "locked") {
    return (
      <div
        className="flex min-w-[132px] shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-2xl border border-dashed px-3 py-3"
        style={{ borderColor: T.border, backgroundColor: "transparent" }}
        title="Новый шаг откроется в следующую смену — возвращайся!"
      >
        <Lock className="h-4 w-4" style={{ color: T.textFaint }} aria-hidden />
        <p className="text-[11px] font-semibold" style={{ color: T.textFaint }}>???</p>
        <p className="text-[10px] leading-tight" style={{ color: T.textFaint }}>
          следующая смена
        </p>
      </div>
    );
  }

  const done = view === "done";
  const current = view === "current";
  const accent = done ? "#22c55e" : current ? T.accent : T.textMuted;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 24, stiffness: 260 }}
      className="relative flex min-w-[150px] shrink-0 snap-start flex-col gap-1.5 rounded-2xl border px-3 py-3"
      style={{
        borderColor: current ? `${T.accent}88` : T.border,
        backgroundColor: current ? `${T.accent}0f` : T.bgCard,
        boxShadow: current ? `0 4px 18px ${T.accent}22` : "none",
      }}
      aria-current={current ? "step" : undefined}
    >
      <div className="flex items-center gap-2">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-base"
          style={{ backgroundColor: done ? "#22c55e1f" : `${T.accent}14` }}
          aria-hidden
        >
          {done ? <Check className="h-4 w-4" style={{ color: "#22c55e" }} /> : step.emoji}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-bold leading-tight" style={{ color: T.text }}>
            {step.title}
          </p>
          <p className="text-[10px] font-semibold" style={{ color: accent }}>
            {done ? "готово" : `${Math.min(myPoints, step.points)} / ${step.points} очков`}
          </p>
        </div>
      </div>
      {(current || view === "open") && (
        <p className="text-[10px] leading-snug" style={{ color: T.textMuted }}>
          {step.hint}
        </p>
      )}
      {current && step.points > 0 && (
        <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: T.borderSoft }}>
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{ backgroundColor: T.accent }}
          />
        </div>
      )}
    </motion.div>
  );
}

export function LeadsPathPanel({ progress, state, myPoints, onStatePatch, T }: Props) {
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);
  // «Праздновали» — из состояния (metadata), чтобы перезагрузка не повторяла
  // конфетти; локальный ref гасит двойную отработку внутри сессии.
  const celebratedRef = useRef<Set<string>>(new Set(state.celebrated));

  // Завершение нового шага → отметить в celebrated + вибро.
  useEffect(() => {
    if (progress.doneCount <= 0) return;
    const step = LEAD_PATH_STEPS[Math.min(progress.doneCount - 1, LEAD_PATH_STEPS.length - 1)];
    if (!step) return;
    if (celebratedRef.current.has(step.id)) return;
    celebratedRef.current.add(step.id);
    setJustCompletedId(step.id);
    buzz(12);
    onStatePatch({ ...state, celebrated: [...state.celebrated, step.id].slice(-20) });
    const t = setTimeout(() => setJustCompletedId(null), 2600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.doneCount]);

  const stepsToShow = LEAD_PATH_STEPS.slice(0, Math.max(progress.revealed, 0));
  const lockedLeft = LEAD_PATH_STEPS.length - stepsToShow.length;
  const allDone = progress.doneCount >= LEAD_PATH_STEPS.length;

  return (
    <div
      className="rounded-2xl border p-4"
      style={{ borderColor: T.border, backgroundColor: T.bgCard }}
      aria-label="Путь оператора"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapIcon className="h-4 w-4" style={{ color: T.accent }} aria-hidden />
          <h3 className="text-sm font-bold" style={{ color: T.text }}>Путь оператора</h3>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: `${T.accent}1a`, color: T.accent }}>
            {progress.doneCount}/{LEAD_PATH_STEPS.length}
          </span>
        </div>
        <p className="text-[10px] font-semibold" style={{ color: T.textFaint }}>
          новый шаг — каждая смена
        </p>
      </div>

      {/* Лестница: горизонтальный снап-скролл (мобайл) / перенос (sm+) */}
      <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
        {stepsToShow.map((step, i) => (
          <div key={step.id} className="relative">
            <StepCell
              step={step}
              view={progress.views[i]}
              pct={i === progress.currentIndex ? progress.currentPct : 0}
              myPoints={myPoints}
              T={T}
            />
            {/* Мягкое празднование завершённого шага */}
            {justCompletedId === step.id && (
              <motion.div
                initial={{ opacity: 0, scale: 0.7, y: -6 }}
                animate={{ opacity: [0, 1, 1, 0], scale: [0.7, 1.15, 1, 1.05], y: [-6, 0, 0, -10] }}
                transition={{ duration: 2.4, times: [0, 0.15, 0.7, 1] }}
                className="pointer-events-none absolute -top-2 right-1 rounded-full px-2 py-0.5 text-[10px] font-black shadow"
                style={{ backgroundColor: "#22c55e", color: "#04150a" }}
              >
                шаг закрыт! +1 откроется со сменой
              </motion.div>
            )}
          </div>
        ))}
        {/* Тизер следующего шага — интрига вместо когнитивной перегрузки */}
        {lockedLeft > 0 && (
          <div className="flex min-w-[132px] shrink-0 snap-start items-center" title="Шаги открываются по одной смене">
            <StepCell step={LEAD_PATH_STEPS[stepsToShow.length]} view="locked" pct={0} myPoints={myPoints} T={T} />
          </div>
        )}
      </div>

      {allDone && (
        <p className="mt-3 text-[11px] font-semibold" style={{ color: T.accent }}>
          👑 Весь путь пройден — держи топ-3 в лидерборде!
        </p>
      )}
    </div>
  );
}
