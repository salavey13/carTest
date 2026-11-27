"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Zap, ChevronRight, RotateCcw, Loader2, Sparkles, Brain, Target,
  TrendingDown, TrendingUp, Trophy, Lightbulb, Gauge, Layers, Lock, CheckCircle2, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/contexts/AppContext";
import { useVprRoadmap } from "@/hooks/useVprRoadmap";
import {
  SUPER_MODES,
  SUPER_SUBJECT_META,
  SUPER_GAP_RATIO,
  type SuperModeKey,
  type SuperTestResult,
  type SuperSubjectDiag,
} from "@/lib/vprSuperTest";
import {
  startSuperTestAction,
  finishSuperTestAction,
  type SuperQuestionData,
} from "@/app/actions/vprSuperTestActions";

/*
 * task221: СУПЕРТЕСТ /vpr-super — динамическая диагностика 8 класса.
 * Случайные вопросы из всех предметов сразу → карта дыр → персональный
 * порядок разблокировки Матрицы. UI: три режима, кольцо-прогресс,
 * цветовой бейдж предмета на каждом вопросе, мгновенный фидбек,
 * радар-финал с per-subject вердиктами и топ-дырами.
 */

type Phase = "welcome" | "running" | "finished";

interface AnsweredRow {
  questionId: number;
  subjectSlug: string;
  wasCorrect: boolean;
}

export default function SuperTestPage() {
  const router = useRouter();
  const { dbUser, isLoading: isUserLoading } = useAppContext();
  const { progress: roadmapProgress } = useVprRoadmap();

  const [phase, setPhase] = useState<Phase>("welcome");
  const [mode, setMode] = useState<SuperModeKey>("standard");
  const [questions, setQuestions] = useState<SuperQuestionData[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answersLog, setAnswersLog] = useState<AnsweredRow[]>([]);
  const [score, setScore] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SuperTestResult | null>(null);
  const [gaps, setGaps] = useState<string[]>([]);

  const total = questions.length;
  const q = questions[qIndex];
  const correctAnswerId = useMemo(
    () => q?.vpr_answers.find((a) => a.is_correct)?.id ?? null,
    [q]
  );

  // ── запуск ──
  const startTest = useCallback(async (m: SuperModeKey) => {
    setIsLoading(true);
    try {
      const res = await startSuperTestAction(m);
      if (!res.success || !res.questions || res.questions.length === 0) {
        toast.error(res.error || "Не удалось собрать супертест");
        return;
      }
      setMode(m);
      setQuestions(res.questions);
      setSessionId(res.sessionId ?? null);
      setQIndex(0);
      setPicked(null);
      setRevealed(false);
      setAnswersLog([]);
      setScore(0);
      setResult(null);
      setGaps([]);
      setPhase("running");
    } catch (e) {
      toast.error("Ошибка запуска супертеста");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── ответ ──
  const answer = useCallback((answerId: number) => {
    if (revealed || !q || correctAnswerId === null) return;
    setPicked(answerId);
    setRevealed(true);
    const wasCorrect = answerId === correctAnswerId;
    setAnswersLog((prev) => [...prev, { questionId: q.id, subjectSlug: q.subjectSlug, wasCorrect }]);
    if (wasCorrect) setScore((s) => s + 1);
  }, [revealed, q, correctAnswerId]);

  // ── следующий / финиш ──
  const next = useCallback(async () => {
    if (qIndex + 1 < total) {
      setQIndex((i) => i + 1);
      setPicked(null);
      setRevealed(false);
      return;
    }
    // финиш
    setIsLoading(true);
    try {
      const res = await finishSuperTestAction({
        userId: dbUser?.user_id ? String(dbUser.user_id) : null,
        mode,
        answers: answersLog,
      });
      if (!res.success || !res.result) {
        toast.error(res.error || "Не удалось сохранить результат");
        return;
      }
      setResult(res.result);
      setGaps(res.gaps ?? []);
      setPhase("finished");
    } catch {
      toast.error("Ошибка завершения");
    } finally {
      setIsLoading(false);
    }
  }, [qIndex, total, dbUser?.user_id, mode, answersLog]);

  // ══════════════════ WELCOME ══════════════════
  if (phase === "welcome") {
    return (
      <div className="min-h-screen bg-[#030712] text-zinc-200 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Link href="/vpr-tests" className="text-xs font-mono text-zinc-500 hover:text-cyan-400 transition-colors uppercase tracking-widest">
              ← VPR_tests
            </Link>
            <div className="mt-6 flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 flex items-center justify-center">
                <Zap className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-cyan-400">diagnostic protocol</div>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black text-white leading-none mb-4">
              СУПЕР<span className="text-cyan-400">ТЕСТ</span>
            </h1>
            <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-xl mb-3">
              Все предметы 8 класса в одном прогоне: алгебра, геометрия, вероятность,
              русский, обе истории и литература — вперемешку и случайно.
            </p>
            <p className="text-zinc-500 text-[13px] leading-relaxed max-w-xl mb-8">
              Задача — не оценка, а <span className="text-white font-semibold">карта дыр</span>: система
              покажет слабые места и выстроит твою личную Матрицу — слабейшие предметы
              разблокируются первыми.
            </p>

            {/* чипы предметов */}
            <div className="flex flex-wrap gap-2 mb-10">
              {Object.entries(SUPER_SUBJECT_META).map(([slug, m]) => (
                <motion.span
                  key={slug}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05 * Object.keys(SUPER_SUBJECT_META).indexOf(slug) }}
                  className="px-3 py-1.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border"
                  style={{ color: m.color, borderColor: `${m.color}30`, backgroundColor: `${m.color}0d` }}
                >
                  {m.short}
                </motion.span>
              ))}
            </div>

            {/* выбор режима */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
              {(Object.keys(SUPER_MODES) as SuperModeKey[]).map((k) => {
                const m = SUPER_MODES[k];
                const active = mode === k;
                return (
                  <motion.button
                    key={k}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setMode(k)}
                    className={cn(
                      "relative p-5 rounded-2xl border text-left transition-all",
                      active
                        ? "border-cyan-500/60 bg-cyan-950/20 shadow-[0_0_30px_rgba(34,211,238,0.12)]"
                        : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700"
                    )}
                  >
                    <div className={cn("font-mono font-bold text-sm mb-1", active ? "text-cyan-400" : "text-zinc-300")}>
                      {m.label}
                    </div>
                    <div className="text-[11px] text-zinc-500 leading-snug">{m.desc}</div>
                    {active && (
                      <motion.div layoutId="super-mode-dot" className="absolute top-4 right-4 w-2 h-2 rounded-full bg-cyan-400" />
                    )}
                  </motion.button>
                );
              })}
            </div>

            <Button
              size="lg"
              disabled={isLoading}
              onClick={() => startTest(mode)}
              className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-400 text-black font-black text-base px-10 py-6 rounded-xl uppercase tracking-wider"
            >
              {isLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Zap className="w-5 h-5 mr-2" />}
              Запустить диагностику
            </Button>

            <p className="mt-4 text-[11px] text-zinc-600 font-mono">
              // вопросы тянутся случайно из реальных ВПР-вариантов · без таймера · без наказания за ошибки
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  // ══════════════════ RUNNING ══════════════════
  if (phase === "running" && q) {
    const meta = SUPER_SUBJECT_META[q.subjectSlug] ?? SUPER_SUBJECT_META.algebra;
    const pct = total > 0 ? Math.round(((qIndex + (revealed ? 1 : 0)) / total) * 100) : 0;
    const isLast = qIndex + 1 === total;

    return (
      <div className="min-h-screen bg-[#030712] text-zinc-200 relative flex flex-col">
        {/* ── верхняя панель: кольцо + миникарта предметов ── */}
        <div className="sticky top-0 z-20 bg-[#030712]/90 backdrop-blur border-b border-zinc-900">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
            {/* кольцо-прогресс */}
            <div className="relative w-11 h-11 shrink-0">
              <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#18181b" strokeWidth="4" />
                <motion.circle
                  cx="18" cy="18" r="15.5" fill="none"
                  stroke="url(#superGrad)" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 15.5}
                  animate={{ strokeDashoffset: 2 * Math.PI * 15.5 * (1 - pct / 100) }}
                  transition={{ duration: 0.5 }}
                />
                <defs>
                  <linearGradient id="superGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-white">
                {qIndex + 1}/{total}
              </div>
            </div>

            {/* миникарта: точки по предметам сессии */}
            <div className="flex-1 min-w-0 overflow-x-auto">
              <div className="flex items-center gap-1.5">
                {(() => {
                  // порядок предметов как встречаются в вопросах (без повторов)
                  const seen: string[] = [];
                  for (const qq of questions) if (!seen.includes(qq.subjectSlug)) seen.push(qq.subjectSlug);
                  return seen.map((s) => {
                    const m = SUPER_SUBJECT_META[s] ?? SUPER_SUBJECT_META.algebra;
                    const qs = questions.filter((qq) => qq.subjectSlug === s);
                    const answered = answersLog.filter((a) => a.subjectSlug === s);
                    const correct = answered.filter((a) => a.wasCorrect).length;
                    const done = answered.length === qs.length;
                    return (
                      <div
                        key={s}
                        className="flex items-center gap-1 px-2 py-1 rounded-md border text-[9px] font-mono font-bold"
                        style={{
                          color: m.color,
                          borderColor: `${m.color}${done ? "50" : "22"}`,
                          backgroundColor: `${m.color}${done ? "18" : "08"}`,
                        }}
                        title={m.label}
                      >
                        {m.short}
                        <span className="text-zinc-500">{correct}/{qs.length}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-600">score</div>
              <div className="font-mono font-black text-lg leading-none text-white">{score}</div>
            </div>
          </div>
        </div>

        {/* ── вопрос ── */}
        <div className="flex-1 flex items-start sm:items-center justify-center px-4 sm:px-6 py-8">
          <div className="w-full max-w-3xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={q.id}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.25 }}
              >
                {/* бейдж предмета */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-6"
                  style={{ color: meta.color, borderColor: `${meta.color}40`, backgroundColor: `${meta.color}10` }}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider">{meta.label}</span>
                </motion.div>

                <h2 className="text-lg sm:text-2xl font-bold text-white leading-relaxed mb-8 whitespace-pre-wrap">
                  {q.text}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {q.vpr_answers.map((opt, oi) => {
                    const isRight = opt.is_correct;
                    const isPicked = picked === opt.id;
                    return (
                      <motion.button
                        key={opt.id}
                        whileHover={!revealed ? { scale: 1.015 } : undefined}
                        whileTap={!revealed ? { scale: 0.985 } : undefined}
                        onClick={() => answer(opt.id)}
                        disabled={revealed}
                        className={cn(
                          "relative p-4 rounded-xl border text-left font-medium text-[14px] transition-colors min-h-[64px]",
                          !revealed && "border-zinc-800 bg-zinc-950/70 hover:border-zinc-600 hover:bg-zinc-900",
                          revealed && isRight && "border-green-500/70 bg-green-950/30 text-green-300",
                          revealed && isPicked && !isRight && "border-red-500/70 bg-red-950/30 text-red-300",
                          revealed && !isRight && !isPicked && "border-zinc-800/60 bg-zinc-950/40 opacity-50"
                        )}
                      >
                        <span className="font-mono text-[10px] text-zinc-600 mr-2">{String.fromCharCode(65 + oi)}</span>
                        {opt.text}
                        {revealed && isRight && <CheckCircle2 className="absolute top-3.5 right-3 w-4 h-4 text-green-400" />}
                        {revealed && isPicked && !isRight && <XCircle className="absolute top-3.5 right-3 w-4 h-4 text-red-400" />}
                      </motion.button>
                    );
                  })}
                </div>

                {/* разбор + кнопка дальше */}
                <AnimatePresence>
                  {revealed && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6"
                    >
                      {q.explanation && (
                        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/70 mb-5">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Lightbulb className="w-3.5 h-3.5 text-yellow-400" />
                            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">разбор</span>
                          </div>
                          <p className="text-[13px] text-zinc-400 leading-relaxed whitespace-pre-wrap">{q.explanation}</p>
                        </div>
                      )}
                      <Button
                        onClick={next}
                        disabled={isLoading}
                        size="lg"
                        className="w-full sm:w-auto bg-white text-black hover:bg-zinc-200 font-black px-8"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {isLast ? "Итоги диагностики" : "Следующий вопрос"}
                        {!isLast && <ChevronRight className="w-4 h-4 ml-1" />}
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════ FINISHED ══════════════════
  if (phase === "finished" && result) {
    const pct = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;
    // сортировка: худшие первыми
    const sorted = [...result.perSubject].sort((a, b) => a.correct / a.asked - b.correct / b.asked);
    const best = sorted[sorted.length - 1];
    const worstGaps = sorted.filter((d) => d.correct / d.asked < SUPER_GAP_RATIO).slice(0, 3);
    const grade = pct >= 85 ? "S" : pct >= 70 ? "A" : pct >= 55 ? "B" : pct >= 40 ? "C" : "D";

    return (
      <div className="min-h-screen bg-[#030712] text-zinc-200 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          {/* ── hero-итог ── */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-10">
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500 mb-3">
              diagnostic complete · {SUPER_MODES[result.mode].label}
            </div>
            <div className="flex items-center justify-center gap-6 mb-6">
              <div className="relative w-28 h-28">
                <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="#18181b" strokeWidth="3.5" />
                  <motion.circle
                    cx="18" cy="18" r="15.5" fill="none"
                    stroke={pct >= 70 ? "#4ade80" : pct >= 50 ? "#facc15" : "#f87171"}
                    strokeWidth="3.5" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 15.5}
                    initial={{ strokeDashoffset: 2 * Math.PI * 15.5 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 15.5 * (1 - pct / 100) }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-white">{pct}%</span>
                  <span className="text-[10px] font-mono text-zinc-500">{result.score}/{result.total}</span>
                </div>
              </div>
              <div className="text-left">
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">rank</div>
                <div className={cn(
                  "text-6xl font-black leading-none",
                  grade === "S" ? "text-cyan-400" : grade === "A" ? "text-green-400" : grade === "B" ? "text-yellow-400" : grade === "C" ? "text-orange-400" : "text-red-400"
                )}>
                  {grade}
                </div>
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">Карта дыр построена</h1>
            <p className="text-zinc-500 text-sm max-w-md mx-auto">
              Матрица перестроена под тебя: слабейшие предметы теперь стоят первыми
              уровнями — качай их, пока свежие.
            </p>
          </motion.div>

          {/* ── per-subject бары ── */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Gauge className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">Диагностика по предметам</span>
            </div>
            <div className="space-y-2">
              {sorted.map((d, i) => {
                const m = SUPER_SUBJECT_META[d.slug] ?? SUPER_SUBJECT_META.algebra;
                const p = d.asked > 0 ? Math.round((d.correct / d.asked) * 100) : 0;
                const isGap = p < SUPER_GAP_RATIO * 100;
                return (
                  <motion.div
                    key={d.slug}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="flex items-center gap-3"
                  >
                    <span className="w-10 text-[10px] font-mono font-bold" style={{ color: m.color }}>{m.short}</span>
                    <div className="flex-1 h-7 rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden relative">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${p}%` }}
                        transition={{ duration: 0.8, delay: 0.15 + i * 0.07, ease: "easeOut" }}
                        className="h-full rounded-r-lg"
                        style={{ backgroundColor: isGap ? "#ef4444" : m.color, opacity: isGap ? 0.75 : 0.85 }}
                      />
                      <span className="absolute inset-y-0 left-3 flex items-center text-[11px] font-mono font-bold text-white/90">
                        {m.label} — {d.correct}/{d.asked}
                      </span>
                      {isGap && (
                        <span className="absolute inset-y-0 right-3 flex items-center gap-1 text-[9px] font-mono font-bold uppercase text-red-300">
                          <TrendingDown className="w-3 h-3" /> дыра
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* ── вердикты: топ-дыры + лучший ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="p-5 rounded-2xl border border-red-500/25 bg-red-950/10">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-red-400" />
                <span className="text-xs font-mono uppercase tracking-wider text-red-300">Приоритет №1</span>
              </div>
              {worstGaps.length > 0 ? (
                <>
                  <div className="text-lg font-black text-white mb-1">
                    {SUPER_SUBJECT_META[worstGaps[0].slug]?.label ?? worstGaps[0].slug}
                  </div>
                  <p className="text-[12px] text-zinc-400 leading-relaxed">
                    {worstGaps[0].correct}/{worstGaps[0].asked} — ниже порога {Math.round(SUPER_GAP_RATIO * 100)}%.
                    Шпаргалка по этому предмету теперь Level 1 твоей Матрицы.
                  </p>
                  {worstGaps.length > 1 && (
                    <p className="text-[11px] text-zinc-500 mt-2">
                      Также в зоне риска: {worstGaps.slice(1).map((g) => SUPER_SUBJECT_META[g.slug]?.label ?? g.slug).join(", ")}.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[13px] text-zinc-400 leading-relaxed">
                  Дыр ниже порога {Math.round(SUPER_GAP_RATIO * 100)}% не найдено — держишь удар по всем фронтам 💪
                </p>
              )}
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="p-5 rounded-2xl border border-green-500/25 bg-green-950/10">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-green-400" />
                <span className="text-xs font-mono uppercase tracking-wider text-green-300">Сильная сторона</span>
              </div>
              <div className="text-lg font-black text-white mb-1">
                {best ? (SUPER_SUBJECT_META[best.slug]?.label ?? best.slug) : "—"}
              </div>
              <p className="text-[12px] text-zinc-400 leading-relaxed">
                {best ? `${best.correct}/${best.asked} — этот фронт держится, можно ограничиться повторением перед самим ВПР.` : "Пройди диагностику, чтобы найти сильные стороны."}
              </p>
            </motion.div>
          </div>

          {/* ── личный порядок ── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mb-8">
            <div className="p-5 rounded-2xl border border-cyan-500/25 bg-cyan-950/10">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono uppercase tracking-wider text-cyan-300">Личный порядок Матрицы</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {result.order.map((s, i) => {
                  const m = SUPER_SUBJECT_META[s] ?? SUPER_SUBJECT_META.algebra;
                  const diag = result.perSubject.find((d) => d.slug === s);
                  const p = diag && diag.asked > 0 ? Math.round((diag.correct / diag.asked) * 100) : null;
                  return (
                    <React.Fragment key={s}>
                      {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-zinc-700 shrink-0" />}
                      <span
                        className="px-2.5 py-1 rounded-md border text-[10px] font-mono font-bold"
                        style={{ color: m.color, borderColor: `${m.color}35`, backgroundColor: `${m.color}0d` }}
                        title={`${m.label}${p !== null ? ` — ${p}%` : ""}`}
                      >
                        {i + 1}. {m.short}{p !== null ? ` ${p}%` : ""}
                      </span>
                    </React.Fragment>
                  );
                })}
              </div>
              <p className="text-[11px] text-zinc-500 mt-3">
                Порядок применён к твоей дорожке разблокировки: слабейшие предметы — первыми уровнями.
              </p>
            </div>
          </motion.div>

          {/* ── CTA ── */}
          <div className="flex flex-col sm:flex-row gap-3">
            {worstGaps.length > 0 && (
              <Button
                size="lg"
                onClick={() => router.push(`/vpr/${worstGaps[0].slug}/8/cheatsheet`)}
                className="flex-1 bg-white text-black hover:bg-zinc-200 font-black text-base py-6"
              >
                <BookIconFix /> Шпаргалка: {SUPER_SUBJECT_META[worstGaps[0].slug]?.short}
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push("/vpr-matrix")}
              className="flex-1 border-zinc-700 text-white font-bold text-base py-6"
            >
              <Sparkles className="w-4 h-4 mr-2" /> Открыть Матрицу
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={() => { setPhase("welcome"); setResult(null); }}
              className="text-zinc-400 font-bold py-6"
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Ещё раз
            </Button>
          </div>

          {!dbUser && !isUserLoading && (
            <p className="mt-5 text-center text-[11px] text-zinc-600">
              // гостевой режим: результат сохранён локально; авторизуйся через Telegram, чтобы закрепить личный порядок
            </p>
          )}
        </div>
      </div>
    );
  }

  // fallback: загрузка
  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
    </div>
  );
}

/** мини-иконка книги для CTA (без отдельного импорта BookOpen — экономия чанка) */
function BookIconFix() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  );
}
