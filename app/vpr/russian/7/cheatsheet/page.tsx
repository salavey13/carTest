'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  BookOpen, PenTool, SpellCheck, ChevronDown, ChevronUp,
  Lightbulb, Eye, MousePointerClick, Trophy, RotateCcw,
  Target, ArrowLeft, ArrowRight, CheckCircle2, XCircle,
  GraduationCap, MessageSquare, ListChecks, ChevronRight,
} from 'lucide-react';

import {
  DICTATION_TEXTS, SUPPORT_QUESTIONS, SPELLING_RULES,
  RULE_TAG_DISPLAY, SUPPORT_TYPE_DISPLAY,
  type DictationGap, type SupportQuestion, type GapKind, type RuleTag,
} from './questions-data';

// ─── Types ──────────────────────────────────────────────────────────────────────

type DictAnswer = string | { ne: string; separate: boolean; nn?: string };
type Segment = { type: 'text'; content: string } | { type: 'gap'; gapId: number };
type ModeTab = 'dictation' | 'support';
type SidebarTab = 'rules' | 'stats';

// ─── Template parser ────────────────────────────────────────────────────────────

function parseTemplate(template: string): Segment[] {
  const parts = template.split(/\{\{(\d+)\}\}/);
  const segments: Segment[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      // text segment
      if (parts[i]) segments.push({ type: 'text', content: parts[i] });
    } else {
      // gap segment
      segments.push({ type: 'gap', gapId: parseInt(parts[i], 10) });
    }
  }
  return segments;
}

// ─── Gap validation ─────────────────────────────────────────────────────────────

function validateGap(gap: DictationGap, answer: DictAnswer): boolean {
  if (gap.kind === 'letter' || gap.kind === 'z-s') {
    const correctStr = gap.correct as string;
    const answerStr = (typeof answer === 'string' ? answer : '').toLowerCase();
    return answerStr === correctStr.toLowerCase();
  }
  if (gap.kind === 'n-nn') {
    return typeof answer === 'string' && answer === gap.correct;
  }
  if (gap.kind === 'comma') {
    const answerStr = typeof answer === 'string' ? answer : '';
    return answerStr === ',';
  }
  if (gap.kind === 'ne-simple') {
    if (typeof answer !== 'object' || typeof gap.correct !== 'object') return false;
    return answer.ne === gap.correct.ne && answer.separate === gap.correct.separate;
  }
  if (gap.kind === 'ne-complex') {
    if (typeof answer !== 'object' || typeof gap.correct !== 'object') return false;
    return (
      answer.ne === gap.correct.ne &&
      answer.separate === gap.correct.separate &&
      answer.nn === (gap.correct as { ne: string; separate: boolean; nn?: string }).nn
    );
  }
  return false;
}

// ─── SVG Components ─────────────────────────────────────────────────────────────

function PenSVG() {
  return (
    <svg viewBox="0 0 120 120" className="w-20 h-20 sm:w-28 sm:h-28" aria-hidden="true">
      <defs>
        <linearGradient id="penGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Quill body */}
      <path
        d="M60 15 C60 15, 52 35, 48 55 C45 68, 50 78, 56 85 L60 100 L64 85 C70 78, 75 68, 72 55 C68 35, 60 15, 60 15Z"
        fill="url(#penGrad)" stroke="#c4b5fd" strokeWidth="0.8" filter="url(#glow)"
      />
      {/* Nib line */}
      <line x1="60" y1="85" x2="60" y2="105" stroke="#e9d5ff" strokeWidth="1.5" strokeLinecap="round" />
      {/* Ink dot pulsing */}
      <circle cx="60" cy="108" r="2.5" fill="#a78bfa">
        <animate attributeName="r" values="2.5;4;2.5" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
      </circle>
      {/* Orbiting Cyrillic letters */}
      {[
        { letter: 'а', delay: 0, radius: 32 },
        { letter: 'я', delay: 0.6, radius: 38 },
        { letter: 'з', delay: 1.2, radius: 28 },
        { letter: 'ы', delay: 1.8, radius: 35 },
        { letter: 'к', delay: 2.4, radius: 30 },
      ].map(({ letter, delay, radius }) => (
        <text
          key={letter}
          fontSize="9"
          fill="#c4b5fd"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="serif"
        >
          <animateMotion
            dur="8s"
            repeatCount="indefinite"
            begin={`${delay}s`}
            path={`M60,${60 - radius} A${radius},${radius} 0 1,1 59.99,${60 - radius}`}
          />
          {letter}
        </text>
      ))}
    </svg>
  );
}

function SentenceTreeSVG() {
  return (
    <svg viewBox="0 0 200 80" className="w-40 h-16" aria-hidden="true">
      <defs>
        <linearGradient id="treeLine" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
      </defs>
      {/* Nodes */}
      <rect x="5" y="30" width="55" height="22" rx="6" fill="#1e1035" stroke="#a78bfa" strokeWidth="0.8" />
      <text x="32" y="45" textAnchor="middle" fontSize="8" fill="#c4b5fd" fontFamily="serif">подлежащее</text>
      <rect x="75" y="30" width="50" height="22" rx="6" fill="#1e1035" stroke="#c084fc" strokeWidth="0.8" />
      <text x="100" y="45" textAnchor="middle" fontSize="8" fill="#c4b5fd" fontFamily="serif">сказуемое</text>
      <rect x="140" y="30" width="55" height="22" rx="6" fill="#1e1035" stroke="#e879f9" strokeWidth="0.8" />
      <text x="167" y="45" textAnchor="middle" fontSize="8" fill="#e9d5ff" fontFamily="serif">дополнение</text>
      {/* Connecting lines */}
      <line x1="60" y1="41" x2="75" y2="41" stroke="url(#treeLine)" strokeWidth="1.2">
        <animate attributeName="opacity" values="0.4;1;0.4" dur="3s" repeatCount="indefinite" />
      </line>
      <line x1="125" y1="41" x2="140" y2="41" stroke="url(#treeLine)" strokeWidth="1.2">
        <animate attributeName="opacity" values="0.4;1;0.4" dur="3s" repeatCount="indefinite" begin="1.5s" />
      </line>
    </svg>
  );
}

function LetterChainSVG() {
  const morphemes = [
    { label: 'приставка', color: '#a78bfa', bg: '#2d1854' },
    { label: 'корень', color: '#c084fc', bg: '#3b1f70' },
    { label: 'суффикс', color: '#e879f9', bg: '#4a1d7a' },
    { label: 'окончание', color: '#f0abfc', bg: '#5b2188' },
  ];
  return (
    <svg viewBox="0 0 320 40" className="w-64 h-10" aria-hidden="true">
      {morphemes.map((m, i) => {
        const x = i * 82;
        return (
          <g key={m.label}>
            <rect x={x + 2} y="8" width="72" height="24" rx="4" fill={m.bg} stroke={m.color} strokeWidth="0.7" />
            <text x={x + 38} y="24" textAnchor="middle" fontSize="8" fill={m.color} fontFamily="sans-serif">
              {m.label}
            </text>
            {i < morphemes.length - 1 && (
              <line x1={x + 74} y1="20" x2={x + 82} y2="20" stroke={m.color} strokeWidth="1" opacity="0.6" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Background Pattern ─────────────────────────────────────────────────────────

function BackgroundPattern() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Gradient blurs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-900/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-900/15 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-fuchsia-900/10 rounded-full blur-3xl" />
      {/* Dot grid */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.07]">
        <defs>
          <pattern id="dotGrid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.8" fill="#a78bfa" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dotGrid)" />
      </svg>
    </div>
  );
}

// ─── Main Page Component ────────────────────────────────────────────────────────

export default function Russian7Cheatsheet() {
  const dictationText = DICTATION_TEXTS[0];
  const segments = useMemo(() => parseTemplate(dictationText.template), [dictationText.template]);

  // ── Dictation state ──
  const [dictAnswers, setDictAnswers] = useState<Record<number, DictAnswer>>({});
  const [activeGapId, setActiveGapId] = useState<number | null>(null);
  const [dictSubmitted, setDictSubmitted] = useState(false);
  const [letterInput, setLetterInput] = useState('');
  const [neComplexStep, setNeComplexStep] = useState<1 | 2 | 3>(1);
  const [neComplexTemp, setNeComplexTemp] = useState<{ ne?: string; separate?: boolean; nn?: string }>({});
  const [showHint, setShowHint] = useState(false);
  const [expandedGap, setExpandedGap] = useState<number | null>(null);

  // ── Support questions state ──
  const [supportIdx, setSupportIdx] = useState(0);
  const [supportAnswers, setSupportAnswers] = useState<Record<number, number[]>>({});
  const [supportSubmitted, setSupportSubmitted] = useState<Record<number, boolean>>({});
  const [showSupportHint, setShowSupportHint] = useState(false);
  const [supportPassageOpen, setSupportPassageOpen] = useState<Record<number, boolean>>({});

  // ── UI state ──
  const [modeTab, setModeTab] = useState<ModeTab>('dictation');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('rules');
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  // ── Refs ──
  const gapRefs = useRef<Record<number, HTMLSpanElement | null>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Computed values ──
  const activeGap = useMemo(
    () => dictationText.gaps.find((g) => g.id === activeGapId) ?? null,
    [activeGapId, dictationText.gaps]
  );

  const answeredCount = useMemo(() => Object.keys(dictAnswers).length, [dictAnswers]);
  const totalGaps = dictationText.gaps.length;
  const dictProgress = (answeredCount / totalGaps) * 100;

  // Per-gap correctness after submission
  const gapResults = useMemo(() => {
    if (!dictSubmitted) return {};
    const results: Record<number, boolean> = {};
    dictationText.gaps.forEach((g) => {
      const ans = dictAnswers[g.id];
      results[g.id] = ans !== undefined ? validateGap(g, ans) : false;
    });
    return results;
  }, [dictSubmitted, dictAnswers, dictationText.gaps]);

  // Per-rule accuracy stats
  const ruleStats = useMemo(() => {
    const stats: Record<string, { correct: number; total: number }> = {};
    dictationText.gaps.forEach((g) => {
      if (!stats[g.rule]) stats[g.rule] = { correct: 0, total: 0 };
      stats[g.rule].total++;
      if (dictSubmitted && gapResults[g.id]) {
        stats[g.rule].correct++;
      }
    });
    return stats;
  }, [dictationText.gaps, dictSubmitted, gapResults]);

  const dictCorrectCount = useMemo(
    () => Object.values(gapResults).filter(Boolean).length,
    [gapResults]
  );

  // Support question scores
  const supportCorrectCount = useMemo(() => {
    let count = 0;
    SUPPORT_QUESTIONS.forEach((q) => {
      if (!supportSubmitted[q.id]) return;
      const userAns = supportAnswers[q.id] ?? [];
      if (q.multiSelect && q.correctIndices) {
        const sorted1 = [...userAns].sort();
        const sorted2 = [...q.correctIndices].sort();
        if (sorted1.length === sorted2.length && sorted1.every((v, i) => v === sorted2[i])) count++;
      } else if (q.correctAnswer !== undefined && q.options) {
        const selectedIdx = userAns[0];
        if (selectedIdx !== undefined && q.options[selectedIdx] === q.correctAnswer) count++;
      }
    });
    return count;
  }, [supportAnswers, supportSubmitted]);

  const allSupportDone = useMemo(
    () => SUPPORT_QUESTIONS.every((q) => supportSubmitted[q.id]),
    [supportSubmitted]
  );

  const showResults = dictSubmitted && allSupportDone;

  // ── Handlers ──

  const handleGapClick = useCallback((gapId: number) => {
    if (dictSubmitted) return;
    setActiveGapId(gapId);
    setNeComplexStep(1);
    setNeComplexTemp({});
    setShowHint(false);
    // Focus input for letter type
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [dictSubmitted]);

  const submitLetterAnswer = useCallback(() => {
    if (!activeGapId || !letterInput.trim()) return;
    setDictAnswers((prev) => ({ ...prev, [activeGapId]: letterInput.trim() }));
    setLetterInput('');
    // Auto-advance
    const gapIds = dictationText.gaps.map((g) => g.id);
    const currentIdx = gapIds.indexOf(activeGapId);
    if (currentIdx < gapIds.length - 1) {
      setActiveGapId(gapIds[currentIdx + 1]);
    } else {
      setActiveGapId(null);
    }
  }, [activeGapId, letterInput, dictationText.gaps]);

  const submitChoiceAnswer = useCallback(
    (value: DictAnswer) => {
      if (!activeGapId) return;
      setDictAnswers((prev) => ({ ...prev, [activeGapId]: value }));
      // Auto-advance
      const gapIds = dictationText.gaps.map((g) => g.id);
      const currentIdx = gapIds.indexOf(activeGapId);
      if (currentIdx < gapIds.length - 1) {
        setActiveGapId(gapIds[currentIdx + 1]);
      } else {
        setActiveGapId(null);
      }
    },
    [activeGapId, dictationText.gaps]
  );

  const submitNeComplex = useCallback(() => {
    if (!activeGapId) return;
    const answer: { ne: string; separate: boolean; nn?: string } = {
      ne: neComplexTemp.ne ?? 'не',
      separate: neComplexTemp.separate ?? false,
      nn: neComplexTemp.nn,
    };
    setDictAnswers((prev) => ({ ...prev, [activeGapId]: answer }));
    setNeComplexStep(1);
    setNeComplexTemp({});
    // Auto-advance
    const gapIds = dictationText.gaps.map((g) => g.id);
    const currentIdx = gapIds.indexOf(activeGapId);
    if (currentIdx < gapIds.length - 1) {
      setActiveGapId(gapIds[currentIdx + 1]);
    } else {
      setActiveGapId(null);
    }
  }, [activeGapId, neComplexTemp, dictationText.gaps]);

  const handleCheckDictation = useCallback(() => {
    setDictSubmitted(true);
    setActiveGapId(null);
  }, []);

  const handleReset = useCallback(() => {
    setDictAnswers({});
    setActiveGapId(null);
    setDictSubmitted(false);
    setLetterInput('');
    setNeComplexStep(1);
    setNeComplexTemp({});
    setShowHint(false);
    setExpandedGap(null);
    setSupportAnswers({});
    setSupportSubmitted({});
    setShowSupportHint(false);
    setSupportIdx(0);
  }, []);

  const toggleSupportOption = useCallback(
    (qId: number, idx: number) => {
      if (supportSubmitted[qId]) return;
      setSupportAnswers((prev) => {
        const current = prev[qId] ?? [];
        if (current.includes(idx)) {
          return { ...prev, [qId]: current.filter((i) => i !== idx) };
        }
        return { ...prev, [qId]: [...current, idx] };
      });
    },
    [supportSubmitted]
  );

  const handleSupportSubmit = useCallback(
    (qId: number) => {
      setSupportSubmitted((prev) => ({ ...prev, [qId]: true }));
    },
    []
  );

  // Focus input when active gap changes to letter type
  useEffect(() => {
    if (activeGap?.kind === 'letter') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [activeGap]);

  // ── Helper: get display text for a gap answer ──
  const formatAnswerDisplay = useCallback((gap: DictationGap, answer: DictAnswer): string => {
    if (gap.kind === 'letter') return answer as string;
    if (gap.kind === 'n-nn') return answer as string;
    if (gap.kind === 'z-s') return answer as string;
    if (gap.kind === 'comma') {
      return (answer as string) === ',' ? '✓' : '✗';
    }
    if (gap.kind === 'ne-simple') {
      const a = answer as { ne: string; separate: boolean };
      return a.separate ? `${a.ne} (раздельно)` : `${a.ne} (слитно)`;
    }
    if (gap.kind === 'ne-complex') {
      const a = answer as { ne: string; separate: boolean; nn?: string };
      const nePart = a.separate ? `${a.ne} ... (раздельно)` : `${a.ne}... (слитно)`;
      return a.nn ? `${nePart}, ${a.nn}` : nePart;
    }
    return '';
  }, []);

  // ── Grade calculation ──
  const totalCorrect = dictCorrectCount + supportCorrectCount;
  const totalQuestions = totalGaps + SUPPORT_QUESTIONS.length;
  const percentage = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  const grade = useMemo(() => {
    if (percentage >= 90) return { label: 'Отлично', color: 'text-green-400', emoji: '🏆' };
    if (percentage >= 70) return { label: 'Хорошо', color: 'text-yellow-400', emoji: '⭐' };
    if (percentage >= 50) return { label: 'Удовлетворительно', color: 'text-orange-400', emoji: '📖' };
    return { label: 'Нужно подтянуть', color: 'text-red-400', emoji: '💪' };
  }, [percentage]);

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0612] text-gray-100">
      <BackgroundPattern />

      {/* ═══════ 1. HEADER ═══════ */}
      <header className="relative overflow-hidden border-b border-violet-900/30">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="flex-shrink-0"
            >
              <PenSVG />
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-center sm:text-left flex-1"
            >
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-violet-400 via-purple-300 to-fuchsia-400 bg-clip-text text-transparent">
                РУССКИЙ ЯЗЫК
              </h1>
              <p className="text-sm sm:text-base text-violet-300/70 mt-1">
                7 класс — Орфография, Пунктуация, Морфология
              </p>
              <p className="text-xs text-violet-400/50 mt-0.5">
                {dictationText.title} &middot; {dictationText.vprType}
              </p>
            </motion.div>

            {/* Score badge + controls */}
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex items-center gap-3"
            >
              <div className="flex items-center gap-2 bg-violet-900/30 border border-violet-500/20 rounded-lg px-3 py-1.5">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-amber-300">
                  {dictCorrectCount}/{totalGaps}
                </span>
                {allSupportDone && (
                  <span className="text-xs text-violet-400">
                    + {supportCorrectCount}/{SUPPORT_QUESTIONS.length}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-violet-400 hover:text-violet-200 hover:bg-violet-900/30"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Сброс
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-violet-400 hover:text-violet-200 hover:bg-violet-900/30"
              >
                <BookOpen className="w-4 h-4" />
              </Button>
            </motion.div>
          </div>

          {/* Progress bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="mt-4"
          >
            <div className="flex justify-between text-xs text-violet-400/60 mb-1">
              <span>Прогресс диктанта</span>
              <span>{answeredCount} из {totalGaps}</span>
            </div>
            <Progress value={dictProgress} className="h-2 bg-violet-950/50" />
          </motion.div>
        </div>
      </header>

      {/* ═══════ SIDEBAR ═══════ */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full sm:w-96 bg-[#0e081a]/95 backdrop-blur-xl border-l border-violet-800/30 z-50 overflow-y-auto"
          >
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-violet-200">Справочник</h2>
                <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)} className="text-violet-400">
                  ✕
                </Button>
              </div>

              {/* Sidebar tabs */}
              <div className="flex gap-2 mb-4">
                <Button
                  variant={sidebarTab === 'rules' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSidebarTab('rules')}
                  className={
                    sidebarTab === 'rules'
                      ? 'bg-violet-700/50 text-violet-100'
                      : 'text-violet-400 hover:text-violet-200'
                  }
                >
                  <SpellCheck className="w-4 h-4 mr-1" />
                  Правила
                </Button>
                <Button
                  variant={sidebarTab === 'stats' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSidebarTab('stats')}
                  className={
                    sidebarTab === 'stats'
                      ? 'bg-violet-700/50 text-violet-100'
                      : 'text-violet-400 hover:text-violet-200'
                  }
                >
                  <Target className="w-4 h-4 mr-1" />
                  Статистика
                </Button>
              </div>

              <AnimatePresence mode="wait">
                {sidebarTab === 'rules' ? (
                  <motion.div
                    key="rules"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-2"
                  >
                    {SPELLING_RULES.map((rule) => (
                      <div key={rule.id} className="border border-violet-800/20 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
                          className="w-full flex items-center justify-between p-3 text-left hover:bg-violet-900/20 transition-colors"
                        >
                          <span className="text-sm font-medium text-violet-200">{rule.title}</span>
                          <Badge variant="outline" className="text-[10px] border-violet-700/40 text-violet-400">
                            {RULE_TAG_DISPLAY[rule.tag]?.label}
                          </Badge>
                        </button>
                        <AnimatePresence>
                          {expandedRule === rule.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3 space-y-2">
                                <p className="text-sm text-violet-300/80">{rule.rule}</p>
                                <div className="space-y-1">
                                  {rule.examples.map((ex, i) => (
                                    <p key={i} className="text-xs text-fuchsia-300/70 font-mono">
                                      {ex}
                                    </p>
                                  ))}
                                </div>
                                <div className="flex items-start gap-2 bg-amber-900/10 rounded px-2 py-1.5">
                                  <Lightbulb className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                                  <p className="text-xs text-amber-300/70">{rule.tip}</p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    key="stats"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    {dictSubmitted ? (
                      <>
                        <p className="text-sm text-violet-300/70 mb-2">
                          Результаты по категориям правил:
                        </p>
                        {Object.entries(ruleStats).map(([tag, stat]) => {
                          const display = RULE_TAG_DISPLAY[tag as RuleTag];
                          const pct = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
                          return (
                            <div key={tag} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-violet-300">{display?.label ?? tag}</span>
                                <span className={`${pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                  {stat.correct}/{stat.total}
                                </span>
                              </div>
                              <div className="h-2 bg-violet-950/50 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.6 }}
                                  className={`h-full rounded-full ${
                                    pct >= 70
                                      ? 'bg-green-500'
                                      : pct >= 40
                                        ? 'bg-yellow-500'
                                        : 'bg-red-500'
                                  }`}
                                />
                              </div>
                            </div>
                          );
                        })}

                        {/* Decorative SVGs */}
                        <div className="mt-6 pt-4 border-t border-violet-800/20 space-y-3">
                          <SentenceTreeSVG />
                          <LetterChainSVG />
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <Target className="w-10 h-10 text-violet-600 mx-auto mb-3" />
                        <p className="text-sm text-violet-400/60">
                          Статистика появится после проверки диктанта
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar overlay on mobile */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 z-40 sm:hidden"
          />
        )}
      </AnimatePresence>

      {/* ═══════ 2. MODE TABS ═══════ */}
      <div className="max-w-5xl mx-auto px-4 mt-6">
        <div className="flex gap-2 p-1 bg-violet-950/40 rounded-xl border border-violet-800/20 max-w-xs">
          <button
            onClick={() => setModeTab('dictation')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              modeTab === 'dictation'
                ? 'bg-violet-700/50 text-violet-100 shadow-lg shadow-violet-900/30'
                : 'text-violet-400 hover:text-violet-200'
            }`}
          >
            <PenTool className="w-4 h-4 inline mr-1.5" />
            Сплошной текст
          </button>
          <button
            onClick={() => setModeTab('support')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              modeTab === 'support'
                ? 'bg-violet-700/50 text-violet-100 shadow-lg shadow-violet-900/30'
                : 'text-violet-400 hover:text-violet-200'
            }`}
          >
            <ListChecks className="w-4 h-4 inline mr-1.5" />
            Типы заданий
          </button>
        </div>
      </div>

      {/* ═══════ MAIN CONTENT ═══════ */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {modeTab === 'dictation' ? (
            <motion.div
              key="dictation"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* ─── 3. DICTATION ENGINE ─── */}

              {!dictSubmitted ? (
                <>
                  {/* Dictation text with interactive gaps */}
                  <Card className="bg-[#0e081a]/80 border-violet-800/20 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base sm:text-lg text-violet-100 flex items-center gap-2">
                            <MousePointerClick className="w-4 h-4 text-fuchsia-400" />
                            Нажимайте на пропуски, чтобы вставить буквы и знаки
                          </CardTitle>
                          <p className="text-xs text-violet-400/60 mt-1">
                            {answeredCount} из {totalGaps} пропусков заполнено
                          </p>
                        </div>
                        {answeredCount === totalGaps && (
                          <Button
                            onClick={handleCheckDictation}
                            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-900/40"
                          >
                            <SpellCheck className="w-4 h-4 mr-1.5" />
                            Проверить
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {/* Flowing text with inline gaps */}
                      <div className="text-base sm:text-lg leading-relaxed sm:leading-loose text-gray-200 font-serif">
                        {segments.map((seg, i) => {
                          if (seg.type === 'text') {
                            // Handle paragraph breaks
                            const parts = seg.content.split('\n');
                            return parts.map((line, li) => (
                              <span key={`${i}-${li}`}>
                                {li > 0 && <br />}
                                <br />
                                {line}
                              </span>
                            ));
                          }
                          // Gap
                          const gap = dictationText.gaps.find((g) => g.id === seg.gapId);
                          if (!gap) return null;
                          const isAnswered = dictAnswers[gap.id] !== undefined;
                          const isActive = activeGapId === gap.id;
                          const tagDisplay = RULE_TAG_DISPLAY[gap.rule];

                          return (
                            <span
                              key={`gap-${gap.id}`}
                              ref={(el) => { gapRefs.current[gap.id] = el; }}
                              onClick={() => handleGapClick(gap.id)}
                              className={`
                                relative cursor-pointer mx-0.5 rounded px-0.5 transition-all duration-200 select-none
                                ${isActive
                                  ? 'bg-fuchsia-600/30 ring-2 ring-fuchsia-400 scale-105'
                                  : isAnswered
                                    ? 'bg-green-600/20 ring-1 ring-green-500/40'
                                    : `bg-violet-800/30 ring-1 ring-violet-600/30 hover:bg-violet-700/40 hover:ring-violet-500/50`
                                }
                              `}
                            >
                              {/* Display text */}
                              <span className={`
                                ${isAnswered ? 'text-green-300' : isActive ? 'text-fuchsia-200' : 'text-violet-300'}
                                ${gap.kind === 'comma' ? 'font-bold' : ''}
                              `}>
                                {isAnswered ? (
                                  <span className="flex items-center gap-0.5">
                                    <CheckCircle2 className="w-3 h-3 text-green-400" />
                                    <span className="text-xs font-mono">
                                      {formatAnswerDisplay(gap, dictAnswers[gap.id])}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-xs sm:text-sm font-mono">{gap.display}</span>
                                )}
                              </span>

                              {/* Gap number badge */}
                              <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-violet-900 text-[9px] text-violet-300 flex items-center justify-center border border-violet-700/50">
                                {gap.id}
                              </span>
                            </span>
                          );
                        })}
                      </div>

                      {/* Gap interaction widget */}
                      <AnimatePresence mode="wait">
                        {activeGap && (
                          <motion.div
                            key={activeGap.id}
                            initial={{ opacity: 0, y: 15, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                            exit={{ opacity: 0, y: -10, height: 0 }}
                            transition={{ duration: 0.25 }}
                            className="mt-6 pt-4 border-t border-violet-800/20"
                          >
                            {/* Gap header */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="border-violet-600/40 text-violet-300 text-xs">
                                  Пропуск {activeGap.id}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${RULE_TAG_DISPLAY[activeGap.rule]?.color ?? 'border-violet-700/40 text-violet-400'}`}
                                >
                                  {RULE_TAG_DISPLAY[activeGap.rule]?.label}
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowHint(!showHint)}
                                className="text-amber-400 hover:text-amber-300 hover:bg-amber-900/20 text-xs"
                              >
                                <Lightbulb className="w-3.5 h-3.5 mr-1" />
                                Подсказка
                              </Button>
                            </div>

                            <AnimatePresence>
                              {showHint && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="mb-3 p-3 bg-amber-900/10 border border-amber-800/20 rounded-lg"
                                >
                                  <p className="text-sm text-amber-300/80">{activeGap.hint}</p>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Input by kind */}
                            {activeGap.kind === 'letter' && (
                              <div className="flex items-center gap-3">
                                <div className="text-sm text-violet-300/70 font-mono">{activeGap.display}</div>
                                <Input
                                  ref={inputRef}
                                  value={letterInput}
                                  onChange={(e) => setLetterInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') submitLetterAnswer();
                                  }}
                                  maxLength={2}
                                  className="w-16 h-10 text-center text-lg font-bold bg-violet-950/50 border-violet-600/30 text-violet-100 focus:border-fuchsia-500"
                                  placeholder="?"
                                />
                                <Button
                                  onClick={submitLetterAnswer}
                                  disabled={!letterInput.trim()}
                                  className="bg-violet-700/50 hover:bg-violet-600/50 text-violet-100"
                                >
                                  <ArrowRight className="w-4 h-4" />
                                </Button>
                              </div>
                            )}

                            {activeGap.kind === 'n-nn' && (
                              <div className="flex gap-3">
                                {(activeGap.options ?? ['н', 'нн']).map((opt) => (
                                  <Button
                                    key={opt}
                                    onClick={() => submitChoiceAnswer(opt)}
                                    variant="outline"
                                    className="flex-1 h-12 text-lg font-bold border-violet-600/30 text-violet-200 hover:bg-violet-700/30 hover:border-violet-500/50 font-mono"
                                  >
                                    {opt}
                                  </Button>
                                ))}
                              </div>
                            )}

                            {activeGap.kind === 'z-s' && (
                              <div className="flex gap-3">
                                {(activeGap.options ?? ['с', 'з']).map((opt) => (
                                  <Button
                                    key={opt}
                                    onClick={() => submitChoiceAnswer(opt)}
                                    variant="outline"
                                    className="flex-1 h-12 text-lg font-bold border-violet-600/30 text-violet-200 hover:bg-violet-700/30 hover:border-violet-500/50 font-mono"
                                  >
                                    {opt}
                                  </Button>
                                ))}
                              </div>
                            )}

                            {activeGap.kind === 'comma' && (
                              <div className="flex gap-3">
                                {(activeGap.options ?? []).map((opt) => (
                                  <Button
                                    key={opt}
                                    onClick={() => submitChoiceAnswer(opt === 'Запятая нужна' ? ',' : '')}
                                    variant="outline"
                                    className="flex-1 h-12 text-sm border-violet-600/30 text-violet-200 hover:bg-violet-700/30 hover:border-violet-500/50"
                                  >
                                    {opt}
                                  </Button>
                                ))}
                              </div>
                            )}

                            {activeGap.kind === 'ne-simple' && (
                              <div className="flex gap-3">
                                {(activeGap.options ?? []).map((opt) => {
                                  const isSeparate = opt.includes('раздельно');
                                  return (
                                    <Button
                                      key={opt}
                                      onClick={() =>
                                        submitChoiceAnswer({ ne: 'не', separate: isSeparate })
                                      }
                                      variant="outline"
                                      className="flex-1 h-12 text-sm border-violet-600/30 text-violet-200 hover:bg-violet-700/30 hover:border-violet-500/50"
                                    >
                                      {opt}
                                    </Button>
                                  );
                                })}
                              </div>
                            )}

                            {activeGap.kind === 'ne-complex' && (
                              <div className="space-y-3">
                                {/* Step indicators */}
                                <div className="flex items-center gap-2 text-xs text-violet-400/60">
                                  <span className={neComplexStep >= 1 ? 'text-fuchsia-300' : ''}>1. не/ни</span>
                                  <ChevronRight className="w-3 h-3" />
                                  <span className={neComplexStep >= 2 ? 'text-fuchsia-300' : ''}>2. слитно/раздельно</span>
                                  <ChevronRight className="w-3 h-3" />
                                  <span className={neComplexStep >= 3 ? 'text-fuchsia-300' : ''}>3. н/нн</span>
                                </div>

                                {/* Step 1: не / ни */}
                                {neComplexStep === 1 && (
                                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                                    <p className="text-sm text-violet-300/70 mb-2">Выберите: не или ни?</p>
                                    <div className="flex gap-3">
                                      <Button
                                        onClick={() => {
                                          setNeComplexTemp((p) => ({ ...p, ne: 'не' }));
                                          setNeComplexStep(2);
                                        }}
                                        variant="outline"
                                        className="flex-1 h-10 border-violet-600/30 text-violet-200 hover:bg-violet-700/30"
                                      >
                                        не
                                      </Button>
                                      <Button
                                        onClick={() => {
                                          setNeComplexTemp((p) => ({ ...p, ne: 'ни' }));
                                          setNeComplexStep(2);
                                        }}
                                        variant="outline"
                                        className="flex-1 h-10 border-violet-600/30 text-violet-200 hover:bg-violet-700/30"
                                      >
                                        ни
                                      </Button>
                                    </div>
                                  </motion.div>
                                )}

                                {/* Step 2: слитно / раздельно */}
                                {neComplexStep === 2 && (
                                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                                    <p className="text-sm text-violet-300/70 mb-2">
                                      «{neComplexTemp.ne}» пишется слитно или раздельно?
                                    </p>
                                    <div className="flex gap-3">
                                      <Button
                                        onClick={() => {
                                          setNeComplexTemp((p) => ({ ...p, separate: false }));
                                          setNeComplexStep(3);
                                        }}
                                        variant="outline"
                                        className="flex-1 h-10 border-violet-600/30 text-violet-200 hover:bg-violet-700/30"
                                      >
                                        Слитно
                                      </Button>
                                      <Button
                                        onClick={() => {
                                          setNeComplexTemp((p) => ({ ...p, separate: true }));
                                          setNeComplexStep(3);
                                        }}
                                        variant="outline"
                                        className="flex-1 h-10 border-violet-600/30 text-violet-200 hover:bg-violet-700/30"
                                      >
                                        Раздельно
                                      </Button>
                                    </div>
                                  </motion.div>
                                )}

                                {/* Step 3: н / нн */}
                                {neComplexStep === 3 && (
                                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                                    <p className="text-sm text-violet-300/70 mb-2">Сколько «н» в слове?</p>
                                    <div className="flex gap-3">
                                      <Button
                                        onClick={() => {
                                          setNeComplexTemp((p) => ({ ...p, nn: 'н' }));
                                          submitNeComplex();
                                        }}
                                        variant="outline"
                                        className="flex-1 h-10 border-violet-600/30 text-violet-200 hover:bg-violet-700/30 font-mono text-lg"
                                      >
                                        н
                                      </Button>
                                      <Button
                                        onClick={() => {
                                          setNeComplexTemp((p) => ({ ...p, nn: 'нн' }));
                                          submitNeComplex();
                                        }}
                                        variant="outline"
                                        className="flex-1 h-10 border-violet-600/30 text-violet-200 hover:bg-violet-700/30 font-mono text-lg"
                                      >
                                        нн
                                      </Button>
                                    </div>
                                  </motion.div>
                                )}
                              </div>
                            )}

                            {/* Active gap word info */}
                            <div className="mt-3 text-xs text-violet-500/50">
                              Слово: <span className="text-violet-400/60">{activeGap.fullWord}</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>

                  {/* Check button (when all gaps filled) */}
                  {answeredCount > 0 && answeredCount < totalGaps && (
                    <div className="mt-4 text-center">
                      <Button
                        onClick={handleCheckDictation}
                        variant="outline"
                        className="border-violet-700/30 text-violet-300 hover:bg-violet-800/20"
                      >
                        <SpellCheck className="w-4 h-4 mr-1.5" />
                        Проверить ({answeredCount}/{totalGaps})
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                /* ─── ANALYSIS VIEW (after submission) ─── */
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-6"
                >
                  {/* Score summary */}
                  <Card className="bg-gradient-to-br from-violet-900/30 to-fuchsia-900/20 border-violet-700/20">
                    <CardContent className="p-6 text-center">
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, type: 'spring' }}
                      >
                        <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-2" />
                        <h2 className="text-2xl font-bold text-violet-100">
                          {dictCorrectCount} из {totalGaps}
                        </h2>
                        <p className="text-sm text-violet-300/60 mt-1">
                          {dictCorrectCount === totalGaps
                            ? 'Идеально! Все пропуски заполнены верно!'
                            : dictCorrectCount >= totalGaps * 0.7
                              ? 'Отличный результат!'
                              : 'Есть над чем поработать. Изучите правила ниже.'}
                        </p>
                      </motion.div>
                    </CardContent>
                  </Card>

                  {/* Correct text with gap highlights */}
                  <Card className="bg-[#0e081a]/80 border-violet-800/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-violet-300 flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Исправленный текст
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="text-base sm:text-lg leading-relaxed sm:leading-loose text-gray-200 font-serif">
                        {segments.map((seg, i) => {
                          if (seg.type === 'text') {
                            const parts = seg.content.split('\n');
                            return parts.map((line, li) => (
                              <span key={`at-${i}-${li}`}>
                                {li > 0 && <br />}
                                <br />
                                {line}
                              </span>
                            ));
                          }
                          const gap = dictationText.gaps.find((g) => g.id === seg.gapId);
                          if (!gap) return null;
                          const isCorrect = gapResults[gap.id] ?? false;

                          return (
                            <span
                              key={`ares-${gap.id}`}
                              onClick={() => setExpandedGap(expandedGap === gap.id ? null : gap.id)}
                              className={`
                                cursor-pointer mx-0.5 rounded px-0.5 transition-all
                                ${isCorrect
                                  ? 'bg-green-600/20 ring-1 ring-green-500/30'
                                  : 'bg-red-600/20 ring-1 ring-red-500/30'
                                }
                              `}
                            >
                              <span className={`text-xs sm:text-sm font-mono ${isCorrect ? 'text-green-300' : 'text-red-300'}`}>
                                {isCorrect ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 inline text-green-400 mr-0.5" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 inline text-red-400 mr-0.5" />
                                )}
                                {gap.fullWord}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Per-rule breakdown */}
                  <Card className="bg-[#0e081a]/80 border-violet-800/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-violet-300 flex items-center gap-2">
                        <GraduationCap className="w-4 h-4" />
                        Разбивка по правилам
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      {Object.entries(ruleStats).map(([tag, stat]) => {
                        const display = RULE_TAG_DISPLAY[tag as RuleTag];
                        const pct = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
                        return (
                          <div
                            key={tag}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-violet-900/20 transition-colors"
                          >
                            <Badge
                              variant="outline"
                              className={`text-[10px] flex-shrink-0 ${display?.color ?? ''}`}
                            >
                              {display?.label ?? tag}
                            </Badge>
                            <div className="flex-1 h-2 bg-violet-950/50 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.8, delay: 0.1 }}
                                className={`h-full rounded-full ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              />
                            </div>
                            <span className={`text-xs font-medium ${pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {stat.correct}/{stat.total}
                            </span>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>

                  {/* Expandable per-gap explanations */}
                  <Card className="bg-[#0e081a]/80 border-violet-800/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-violet-300 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Пояснения к ошибкам
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-1">
                      {dictationText.gaps.map((gap) => {
                        const isCorrect = gapResults[gap.id] ?? false;
                        const isExpanded = expandedGap === gap.id;
                        const tagDisplay = RULE_TAG_DISPLAY[gap.rule];

                        return (
                          <div key={gap.id} className="border border-violet-800/10 rounded-lg overflow-hidden">
                            <button
                              onClick={() => setExpandedGap(isExpanded ? null : gap.id)}
                              className="w-full flex items-center gap-2 p-3 text-left hover:bg-violet-900/15 transition-colors"
                            >
                              {isCorrect ? (
                                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                              )}
                              <span className={`text-sm ${isCorrect ? 'text-green-300/80' : 'text-red-300'}`}>
                                {gap.display} → {gap.fullWord}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[9px] ml-auto flex-shrink-0 ${tagDisplay?.color ?? ''}`}
                              >
                                {tagDisplay?.label}
                              </Badge>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                              )}
                            </button>
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-3 pb-3">
                                    <p className="text-sm text-violet-300/70 leading-relaxed">
                                      {gap.explanation}
                                    </p>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>

                  {/* Continue to supporting questions */}
                  {!allSupportDone && (
                    <div className="text-center py-4">
                      <Button
                        onClick={() => setModeTab('support')}
                        className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-900/40"
                      >
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Перейти к типам заданий
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          ) : (
            /* ─── 4. SUPPORTING QUESTIONS ─── */
            <motion.div
              key="support"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <SupportingQuestionsEngine
                questions={SUPPORT_QUESTIONS}
                supportIdx={supportIdx}
                setSupportIdx={setSupportIdx}
                supportAnswers={supportAnswers}
                setSupportAnswers={setSupportAnswers}
                supportSubmitted={supportSubmitted}
                handleSupportSubmit={handleSupportSubmit}
                showSupportHint={showSupportHint}
                setShowSupportHint={setShowSupportHint}
                supportPassageOpen={supportPassageOpen}
                setSupportPassageOpen={setSupportPassageOpen}
                toggleSupportOption={toggleSupportOption}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════ 6. RESULTS SUMMARY ═══════ */}
        {showResults && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8"
          >
            <Card className="bg-gradient-to-br from-violet-900/40 to-fuchsia-900/30 border-violet-600/30 shadow-2xl shadow-violet-900/30">
              <CardContent className="p-6 sm:p-8 text-center space-y-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                >
                  <span className="text-5xl">{grade.emoji}</span>
                </motion.div>
                <div>
                  <h2 className={`text-2xl sm:text-3xl font-bold ${grade.color}`}>
                    {grade.label}
                  </h2>
                  <p className="text-sm text-violet-300/60 mt-1">
                    Общий результат: {totalCorrect} из {totalQuestions} ({percentage}%)
                  </p>
                </div>

                {/* Score breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
                  <div className="bg-violet-950/40 rounded-lg p-4 border border-violet-800/20">
                    <p className="text-xs text-violet-400/60 mb-1">Диктант</p>
                    <p className="text-2xl font-bold text-violet-200">
                      {dictCorrectCount}<span className="text-sm text-violet-500">/{totalGaps}</span>
                    </p>
                  </div>
                  <div className="bg-violet-950/40 rounded-lg p-4 border border-violet-800/20">
                    <p className="text-xs text-violet-400/60 mb-1">Типы заданий</p>
                    <p className="text-2xl font-bold text-violet-200">
                      {supportCorrectCount}<span className="text-sm text-violet-500">/{SUPPORT_QUESTIONS.length}</span>
                    </p>
                  </div>
                </div>

                {/* Per-rule chart */}
                <div className="max-w-sm mx-auto space-y-2 text-left">
                  <p className="text-xs text-violet-400/60 text-center">Точность по правилам</p>
                  {Object.entries(ruleStats).map(([tag, stat]) => {
                    const display = RULE_TAG_DISPLAY[tag as RuleTag];
                    const pct = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
                    return (
                      <div key={tag} className="flex items-center gap-2">
                        <span className="text-[10px] text-violet-400/60 w-20 truncate">
                          {display?.label ?? tag}
                        </span>
                        <div className="flex-1 h-3 bg-violet-950/50 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: 0.4 }}
                            className={`h-full rounded-full ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          />
                        </div>
                        <span className="text-[10px] text-violet-400/60 w-8 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>

                {/* Reset button */}
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="border-violet-700/30 text-violet-300 hover:bg-violet-800/20"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Начать заново
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </main>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="mt-auto border-t border-violet-900/20 py-4">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between text-xs text-violet-500/40">
          <span>ВПР Русский язык — 7 класс</span>
          <div className="flex items-center gap-3">
            <SentenceTreeSVG />
            <LetterChainSVG />
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Supporting Questions Engine (sub-component) ────────────────────────────────

interface SupportEngineProps {
  questions: SupportQuestion[];
  supportIdx: number;
  setSupportIdx: (i: number) => void;
  supportAnswers: Record<number, number[]>;
  setSupportAnswers: React.Dispatch<React.SetStateAction<Record<number, number[]>>>;
  supportSubmitted: Record<number, boolean>;
  handleSupportSubmit: (qId: number) => void;
  showSupportHint: boolean;
  setShowSupportHint: (v: boolean) => void;
  supportPassageOpen: Record<number, boolean>;
  setSupportPassageOpen: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  toggleSupportOption: (qId: number, idx: number) => void;
}

function SupportingQuestionsEngine({
  questions,
  supportIdx,
  setSupportIdx,
  supportAnswers,
  supportSubmitted,
  handleSupportSubmit,
  showSupportHint,
  setShowSupportHint,
  supportPassageOpen,
  setSupportPassageOpen,
  toggleSupportOption,
}: SupportEngineProps) {
  const q = questions[supportIdx];

  const isSubmitted = q ? (supportSubmitted[q.id] ?? false) : false;
  const userAnswer = q ? (supportAnswers[q.id] ?? []) : [];
  const typeDisplay = q ? SUPPORT_TYPE_DISPLAY[q.type] : null;

  // Check if answer is correct — must be before early return to satisfy hooks rules
  const isCorrect = useMemo(() => {
    if (!q || !isSubmitted) return null;
    if (q.type === 'polysemous') return true; // all are correct
    if (q.multiSelect && q.correctIndices) {
      const sorted1 = [...userAnswer].sort();
      const sorted2 = [...q.correctIndices].sort();
      return sorted1.length === sorted2.length && sorted1.every((v, i) => v === sorted2[i]);
    }
    if (q.correctAnswer !== undefined && q.options) {
      const selectedIdx = userAnswer[0];
      return selectedIdx !== undefined && q.options[selectedIdx] === q.correctAnswer;
    }
    return null;
  }, [q, isSubmitted, userAnswer]);

  if (!q) return null;

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSupportIdx(Math.max(0, supportIdx - 1))}
          disabled={supportIdx === 0}
          className="text-violet-400 hover:text-violet-200 disabled:opacity-30"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Назад
        </Button>
        <span className="text-xs text-violet-400/60">
          {supportIdx + 1} из {questions.length}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSupportIdx(Math.min(questions.length - 1, supportIdx + 1))}
          disabled={supportIdx === questions.length - 1}
          className="text-violet-400 hover:text-violet-200 disabled:opacity-30"
        >
          Далее
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Question card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={q.id}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25 }}
        >
          <Card className="bg-[#0e081a]/80 border-violet-800/20">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="border-violet-600/40 text-violet-300 text-xs">
                    {q.vprType}
                  </Badge>
                  <Badge variant="outline" className={`text-xs ${typeDisplay?.color ?? ''}`}>
                    {typeDisplay?.label}
                  </Badge>
                </div>
                {!isSubmitted && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSupportHint(!showSupportHint)}
                    className="text-amber-400 hover:text-amber-300 hover:bg-amber-900/20 text-xs flex-shrink-0"
                  >
                    <Lightbulb className="w-3.5 h-3.5 mr-1" />
                    Подсказка
                  </Button>
                )}
              </div>
              <CardTitle className="text-sm sm:text-base text-violet-100 mt-2 leading-relaxed">
                {q.text}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {/* Hint */}
              <AnimatePresence>
                {showSupportHint && q.hint && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-3 bg-amber-900/10 border border-amber-800/20 rounded-lg"
                  >
                    <p className="text-sm text-amber-300/80">{q.hint}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Passage (collapsible) */}
              {q.passage && (
                <div className="border border-violet-800/15 rounded-lg overflow-hidden">
                  <button
                    onClick={() =>
                      setSupportPassageOpen((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                    }
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-violet-900/15 transition-colors"
                  >
                    <span className="text-xs text-violet-300/70 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      Текст для чтения
                    </span>
                    {supportPassageOpen[q.id] ? (
                      <ChevronUp className="w-3.5 h-3.5 text-violet-500" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-violet-500" />
                    )}
                  </button>
                  <AnimatePresence>
                    {supportPassageOpen[q.id] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 max-h-64 overflow-y-auto custom-scrollbar">
                          <p className="text-sm text-violet-300/70 leading-relaxed whitespace-pre-line">
                            {q.passage}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Options */}
              {q.options && (
                <div className="space-y-2">
                  {q.multiSelect ? (
                    // Multi-select (checkboxes)
                    q.options.map((opt, idx) => {
                      const isSelected = userAnswer.includes(idx);
                      let showCorrect = false;
                      let showWrong = false;
                      if (isSubmitted) {
                        if (q.correctIndices?.includes(idx)) showCorrect = true;
                        else if (isSelected) showWrong = true;
                      }
                      return (
                        <button
                          key={idx}
                          onClick={() => toggleSupportOption(q.id, idx)}
                          disabled={isSubmitted}
                          className={`
                            w-full text-left p-3 rounded-lg border transition-all text-sm
                            ${isSubmitted && showCorrect
                              ? 'border-green-500/40 bg-green-900/15 text-green-300'
                              : isSubmitted && showWrong
                                ? 'border-red-500/40 bg-red-900/15 text-red-300'
                                : isSelected
                                  ? 'border-fuchsia-500/40 bg-fuchsia-900/20 text-fuchsia-200'
                                  : 'border-violet-800/20 bg-violet-950/30 text-violet-300/80 hover:bg-violet-900/20 hover:border-violet-700/30'
                            }
                          `}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`
                              w-4 h-4 mt-0.5 rounded border flex-shrink-0 flex items-center justify-center
                              ${isSelected ? 'border-fuchsia-500 bg-fuchsia-600/30' : 'border-violet-600/40'}
                              ${isSubmitted && showCorrect ? 'border-green-500 bg-green-600/30' : ''}
                              ${isSubmitted && showWrong ? 'border-red-500 bg-red-600/30' : ''}
                            `}>
                              {isSelected && !isSubmitted && (
                                <CheckCircle2 className="w-3 h-3 text-fuchsia-300" />
                              )}
                              {isSubmitted && showCorrect && (
                                <CheckCircle2 className="w-3 h-3 text-green-400" />
                              )}
                              {isSubmitted && showWrong && (
                                <XCircle className="w-3 h-3 text-red-400" />
                              )}
                            </div>
                            <span>{opt}</span>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    // Single-select (radio / click)
                    q.options.map((opt, idx) => {
                      const isSelected = userAnswer[0] === idx;
                      let showCorrect = false;
                      let showWrong = false;
                      if (isSubmitted && q.correctAnswer !== undefined) {
                        if (opt === q.correctAnswer) showCorrect = true;
                        else if (isSelected) showWrong = true;
                      }
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            if (!isSubmitted) {
                              supportAnswers[q.id] = [idx];
                            }
                          }}
                          disabled={isSubmitted}
                          className={`
                            w-full text-left p-3 rounded-lg border transition-all text-sm
                            ${isSubmitted && showCorrect
                              ? 'border-green-500/40 bg-green-900/15 text-green-300'
                              : isSubmitted && showWrong
                                ? 'border-red-500/40 bg-red-900/15 text-red-300'
                                : isSelected
                                  ? 'border-fuchsia-500/40 bg-fuchsia-900/20 text-fuchsia-200'
                                  : 'border-violet-800/20 bg-violet-950/30 text-violet-300/80 hover:bg-violet-900/20 hover:border-violet-700/30'
                            }
                          `}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`
                              w-4 h-4 mt-0.5 rounded-full border flex-shrink-0
                              ${isSelected ? 'border-fuchsia-500' : 'border-violet-600/40'}
                              ${isSubmitted && showCorrect ? 'border-green-500' : ''}
                              ${isSubmitted && showWrong ? 'border-red-500' : ''}
                            `}>
                              {(isSelected || (isSubmitted && showCorrect)) && (
                                <div className={`
                                  w-full h-full rounded-full scale-50 mt-0.5
                                  ${isSubmitted && showCorrect ? 'bg-green-400' : 'bg-fuchsia-400'}
                                  ${isSubmitted && showWrong ? 'bg-red-400' : ''}
                                `} />
                              )}
                            </div>
                            <span>{opt}</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {/* Submit button */}
              {!isSubmitted && q.type !== 'polysemous' && (
                <Button
                  onClick={() => handleSupportSubmit(q.id)}
                  disabled={userAnswer.length === 0}
                  className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white disabled:opacity-40"
                >
                  <SpellCheck className="w-4 h-4 mr-1.5" />
                  Ответить
                </Button>
              )}

              {/* Polysemous auto-accept */}
              {!isSubmitted && q.type === 'polysemous' && (
                <Button
                  onClick={() => handleSupportSubmit(q.id)}
                  className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white"
                >
                  Все варианты верны — Продолжить
                </Button>
              )}

              {/* Explanation after submission */}
              <AnimatePresence>
                {isSubmitted && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    {/* Result badge */}
                    <div className={`mb-3 p-3 rounded-lg ${
                      isCorrect === true
                        ? 'bg-green-900/15 border border-green-800/20'
                        : isCorrect === false
                          ? 'bg-red-900/15 border border-red-800/20'
                          : 'bg-violet-900/15 border border-violet-800/20'
                    }`}>
                      <p className={`text-sm font-medium flex items-center gap-1.5 ${
                        isCorrect === true
                          ? 'text-green-300'
                          : isCorrect === false
                            ? 'text-red-300'
                            : 'text-violet-300'
                      }`}>
                        {isCorrect === true && <CheckCircle2 className="w-4 h-4" />}
                        {isCorrect === false && <XCircle className="w-4 h-4" />}
                        {isCorrect === true ? 'Верно!' : isCorrect === false ? 'Неверно' : 'Все верно'}
                      </p>
                    </div>

                    {/* Explanation text */}
                    <div className="p-3 bg-violet-950/40 rounded-lg border border-violet-800/15">
                      <p className="text-sm text-violet-300/70 leading-relaxed whitespace-pre-line">
                        {q.explanation}
                      </p>
                    </div>

                    {/* Next button */}
                    {supportIdx < questions.length - 1 && (
                      <Button
                        onClick={() => {
                          setSupportIdx(supportIdx + 1);
                          setShowSupportHint(false);
                        }}
                        variant="outline"
                        className="w-full mt-3 border-violet-700/30 text-violet-300 hover:bg-violet-800/20"
                      >
                        Следующее задание
                        <ArrowRight className="w-4 h-4 ml-1.5" />
                      </Button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Question dots navigation */}
      <div className="flex justify-center gap-1.5 mt-4">
        {questions.map((sq, i) => (
          <button
            key={sq.id}
            onClick={() => setSupportIdx(i)}
            className={`
              w-2.5 h-2.5 rounded-full transition-all
              ${i === supportIdx
                ? 'bg-fuchsia-400 scale-125'
                : supportSubmitted[sq.id]
                  ? 'bg-violet-600'
                  : 'bg-violet-800/40 hover:bg-violet-700/50'
              }
            `}
            title={`${sq.vprType}`}
          />
        ))}
      </div>
    </div>
  );
}
