'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  BookOpen, Globe, Headphones, FileText, PenTool,
  SpellCheck, Lightbulb, Eye, EyeOff, Trophy, RotateCcw,
  Target, ArrowLeft, ArrowRight, CheckCircle2, XCircle,
  GraduationCap, MessageSquare, ListChecks, ChevronDown,
  ChevronUp, Volume2, Mail, RefreshCw,
} from 'lucide-react';

import {
  LISTENING_SETS, READING_SETS, GRAMMAR_SETS, EMAIL_TASKS,
  TENSES_DATA, PASSIVE_VOICE_RULE, PRONOUNS_DATA, IRREGULAR_VERBS,
  type ListeningSet, type ReadingSet, type GrammarSet, type EmailTask,
  type GrammarRule, type GrammarGap,
} from './questions-data';

// ─── Types ──────────────────────────────────────────────────────────────────────

type ModeTab = 'practice' | 'writing' | 'reference';
type PracticeType = 'listening' | 'reading' | 'grammar';
type RefTab = 'tenses' | 'pronouns' | 'passive' | 'verbs';

// ─── Template parser for grammar texts ──────────────────────────────────────────

type Segment = { type: 'text'; content: string } | { type: 'gap'; letter: string };

function parseGrammarTemplate(template: string): Segment[] {
  const parts = template.split(/\{\{([A-E])\}\}/);
  const segments: Segment[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (parts[i]) segments.push({ type: 'text', content: parts[i] });
    } else {
      segments.push({ type: 'gap', letter: parts[i] });
    }
  }
  return segments;
}

// ─── SVG Components ─────────────────────────────────────────────────────────────

function GlobeSVG() {
  return (
    <svg viewBox="0 0 120 120" className="w-20 h-20 sm:w-28 sm:h-28" aria-hidden="true">
      <defs>
        <linearGradient id="globeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Globe */}
      <circle cx="60" cy="60" r="42" fill="none" stroke="url(#globeGrad)" strokeWidth="2" filter="url(#glow)" />
      {/* Meridians */}
      <ellipse cx="60" cy="60" rx="18" ry="42" fill="none" stroke="#22d3ee" strokeWidth="1" opacity="0.4" />
      <ellipse cx="60" cy="60" rx="35" ry="42" fill="none" stroke="#22d3ee" strokeWidth="0.7" opacity="0.25" />
      {/* Parallels */}
      <ellipse cx="60" cy="42" rx="38" ry="8" fill="none" stroke="#06b6d4" strokeWidth="0.7" opacity="0.35" />
      <ellipse cx="60" cy="60" rx="42" ry="10" fill="none" stroke="#06b6d4" strokeWidth="1" opacity="0.4" />
      <ellipse cx="60" cy="78" rx="38" ry="8" fill="none" stroke="#06b6d4" strokeWidth="0.7" opacity="0.35" />
      {/* Axis tilt */}
      <line x1="60" y1="12" x2="60" y2="108" stroke="#0ea5e9" strokeWidth="0.5" opacity="0.3" />
      {/* Orbiting letter */}
      <g>
        <animateTransform attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur="12s" repeatCount="indefinite" />
        <text x="60" y="12" textAnchor="middle" fontSize="10" fill="#22d3ee" fontFamily="serif" fontWeight="bold">A</text>
      </g>
      <g>
        <animateTransform attributeName="transform" type="rotate" from="120 60 60" to="480 60 60" dur="12s" repeatCount="indefinite" />
        <text x="60" y="12" textAnchor="middle" fontSize="10" fill="#38bdf8" fontFamily="serif" fontWeight="bold">B</text>
      </g>
      <g>
        <animateTransform attributeName="transform" type="rotate" from="240 60 60" to="600 60 60" dur="12s" repeatCount="indefinite" />
        <text x="60" y="12" textAnchor="middle" fontSize="10" fill="#0ea5e9" fontFamily="serif" fontWeight="bold">E</text>
      </g>
    </svg>
  );
}

function BookStackSVG() {
  return (
    <svg viewBox="0 0 80 60" className="w-16 h-12 opacity-40" aria-hidden="true">
      <rect x="8" y="15" width="55" height="10" rx="1.5" fill="#0ea5e9" opacity="0.7">
        <animate attributeName="opacity" values="0.5;0.9;0.5" dur="3s" repeatCount="indefinite" />
      </rect>
      <rect x="12" y="27" width="50" height="10" rx="1.5" fill="#22d3ee" opacity="0.6">
        <animate attributeName="opacity" values="0.4;0.8;0.4" dur="3s" begin="0.5s" repeatCount="indefinite" />
      </rect>
      <rect x="6" y="39" width="58" height="10" rx="1.5" fill="#38bdf8" opacity="0.5">
        <animate attributeName="opacity" values="0.3;0.7;0.3" dur="3s" begin="1s" repeatCount="indefinite" />
      </rect>
      <rect x="14" y="3" width="48" height="10" rx="1.5" fill="#06b6d4" opacity="0.8">
        <animate attributeName="opacity" values="0.6;1;0.6" dur="3s" begin="1.5s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}

function LetterChainSVG() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return (
    <svg viewBox="0 0 400 24" className="w-48 h-3 opacity-30" aria-hidden="true">
      {letters.split('').map((ch, i) => (
        <text key={i} x={i * 15 + 5} y="16" fontSize="11" fill="#22d3ee" fontFamily="monospace">
          {ch}
          <animate attributeName="opacity" values="0.2;0.7;0.2" dur="2s" begin={`${i * 0.1}s`} repeatCount="indefinite" />
        </text>
      ))}
    </svg>
  );
}

function BackgroundPattern() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-950/20 via-transparent to-transparent" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-900/5 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/4 w-72 h-72 bg-sky-900/5 rounded-full blur-3xl" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════════

export default function EnglishVPR7() {
  // ── Mode ──
  const [mode, setMode] = useState<ModeTab>('practice');

  // ── Practice state ──
  const [practiceType, setPracticeType] = useState<PracticeType>('reading');
  const [readingIdx, setReadingIdx] = useState(0);
  const [grammarIdx, setGrammarIdx] = useState(0);
  const [listeningIdx, setListeningIdx] = useState(0);

  // Answers: readingSetId → { A: idx, B: idx, ... }
  const [readingAnswers, setReadingAnswers] = useState<Record<number, Record<string, number>>>({});
  const [readingSubmitted, setReadingSubmitted] = useState<Record<number, boolean>>({});
  const [grammarAnswers, setGrammarAnswers] = useState<Record<number, Record<string, number>>>({});
  const [grammarSubmitted, setGrammarSubmitted] = useState<Record<number, boolean>>({});
  const [listeningAnswers, setListeningAnswers] = useState<Record<number, Record<string, number>>>({});
  const [listeningSubmitted, setListeningSubmitted] = useState<Record<number, boolean>>({});

  // UI toggles
  const [showReadingHint, setShowReadingHint] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [passageOpen, setPassageOpen] = useState(true);
  const [showExplanation, setShowExplanation] = useState<Record<string, boolean>>({});

  // ── Email state ──
  const [emailIdx, setEmailIdx] = useState(0);
  const [emailText, setEmailText] = useState('');
  const [showSample, setShowSample] = useState(false);
  const [emailTipsOpen, setEmailTipsOpen] = useState(false);

  // ── Reference state ──
  const [refTab, setRefTab] = useState<RefTab>('tenses');

  // ── Computed ──
  const readingSet = READING_SETS[readingIdx];
  const grammarSet = GRAMMAR_SETS[grammarIdx];
  const listeningSet = LISTENING_SETS[listeningIdx];
  const emailTask = EMAIL_TASKS[emailIdx];

  const wordCount = useMemo(() => emailText.trim().split(/\s+/).filter(Boolean).length, [emailText]);

  // Reading scores
  const readingCorrectCount = useMemo(() => {
    const set = READING_SETS[readingIdx];
    const ans = readingAnswers[set.id];
    if (!ans || !readingSubmitted[set.id]) return 0;
    return set.questions.filter((q) => ans[q.letter] === q.correctIndex).length;
  }, [readingIdx, readingAnswers, readingSubmitted]);

  // Grammar scores
  const grammarCorrectCount = useMemo(() => {
    const set = GRAMMAR_SETS[grammarIdx];
    const ans = grammarAnswers[set.id];
    if (!ans || !grammarSubmitted[set.id]) return 0;
    return set.gaps.filter((g) => ans[g.letter] === g.correctIndex).length;
  }, [grammarIdx, grammarAnswers, grammarSubmitted]);

  // Listening scores
  const listeningCorrectCount = useMemo(() => {
    const set = LISTENING_SETS[listeningIdx];
    const ans = listeningAnswers[set.id];
    if (!ans || !listeningSubmitted[set.id]) return 0;
    return set.questions.filter((q) => ans[q.letter] === q.correctIndex).length;
  }, [listeningIdx, listeningAnswers, listeningSubmitted]);

  // ── Handlers ──
  const handleSelectAnswer = useCallback((
    answers: Record<number, Record<string, number>>,
    setAnswers: React.Dispatch<React.SetStateAction<Record<number, Record<string, number>>>>,
    submitted: Record<number, boolean>,
    setId: number,
    letter: string,
    idx: number,
  ) => {
    if (submitted[setId]) return;
    setAnswers((prev) => ({
      ...prev,
      [setId]: { ...prev[setId], [letter]: idx },
    }));
  }, []);

  const handleSubmitSet = useCallback((
    submitted: Record<number, boolean>,
    setSubmitted: React.Dispatch<React.SetStateAction<Record<number, boolean>>>,
    setId: number,
    answers: Record<string, number>,
    totalQ: number,
  ) => {
    if (Object.keys(answers).length < totalQ) return;
    setSubmitted((prev) => ({ ...prev, [setId]: true }));
  }, []);

  const handleReset = useCallback(() => {
    setReadingAnswers({});
    setReadingSubmitted({});
    setGrammarAnswers({});
    setGrammarSubmitted({});
    setListeningAnswers({});
    setListeningSubmitted({});
    setShowReadingHint(false);
    setShowTranscript(false);
    setShowExplanation({});
    setEmailText('');
    setShowSample(false);
    setPassageOpen(true);
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '1') setPracticeType('listening');
      if (e.key === '2') setPracticeType('reading');
      if (e.key === '3') setPracticeType('grammar');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#050d18] text-gray-100">
      <BackgroundPattern />

      {/* ═══════ 1. HEADER ═══════ */}
      <header className="relative overflow-hidden border-b border-cyan-900/30">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="flex-shrink-0"
            >
              <GlobeSVG />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center sm:text-left"
            >
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-400 bg-clip-text text-transparent">
                ВПР — Английский язык
              </h1>
              <p className="text-cyan-500/60 text-sm mt-1">7 класс · Interactive Practice · 4 VPR Types</p>
              <div className="flex items-center gap-3 mt-2 justify-center sm:justify-start">
                <Badge variant="outline" className="border-cyan-700/40 text-cyan-400 text-xs">
                  <Headphones className="w-3 h-3 mr-1" /> Listening
                </Badge>
                <Badge variant="outline" className="border-cyan-700/40 text-cyan-400 text-xs">
                  <FileText className="w-3 h-3 mr-1" /> Reading
                </Badge>
                <Badge variant="outline" className="border-cyan-700/40 text-cyan-400 text-xs">
                  <SpellCheck className="w-3 h-3 mr-1" /> Grammar
                </Badge>
                <Badge variant="outline" className="border-cyan-700/40 text-cyan-400 text-xs">
                  <Mail className="w-3 h-3 mr-1" /> Writing
                </Badge>
              </div>
            </motion.div>
          </div>
        </div>
      </header>

      {/* ═══════ 2. MODE TABS ═══════ */}
      <div className="sticky top-0 z-30 bg-[#050d18]/90 backdrop-blur-md border-b border-cyan-900/20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-1 py-2">
            {([
              { key: 'practice' as ModeTab, label: 'Практика ВПР', icon: Target },
              { key: 'writing' as ModeTab, label: 'Письмо', icon: PenTool },
              { key: 'reference' as ModeTab, label: 'Справочник', icon: BookOpen },
            ]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                  ${mode === key
                    ? 'bg-cyan-900/30 text-cyan-300 border border-cyan-700/40'
                    : 'text-cyan-500/50 hover:text-cyan-400 hover:bg-cyan-900/10'
                  }
                `}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════ 3. MAIN CONTENT ═══════ */}
      <main className="relative z-10 max-w-5xl mx-auto px-4 py-6 sm:py-8">

        {/* ══════ PRACTICE MODE ══════ */}
        {mode === 'practice' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

            {/* Practice type selector */}
            <div className="flex flex-wrap gap-2 mb-6">
              {([
                { key: 'listening' as PracticeType, label: 'Listening (Type 1)', icon: Headphones, kbd: '1' },
                { key: 'reading' as PracticeType, label: 'Reading (Type 2)', icon: FileText, kbd: '2' },
                { key: 'grammar' as PracticeType, label: 'Grammar (Type 3)', icon: SpellCheck, kbd: '3' },
              ]).map(({ key, label, icon: Icon, kbd }) => (
                <button
                  key={key}
                  onClick={() => setPracticeType(key)}
                  className={`
                    flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border
                    ${practiceType === key
                      ? 'bg-cyan-800/30 text-cyan-200 border-cyan-600/40 shadow-lg shadow-cyan-900/20'
                      : 'bg-cyan-950/20 text-cyan-500/60 border-cyan-800/20 hover:bg-cyan-900/20 hover:text-cyan-400'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  <kbd className="ml-1 px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-400/50 text-[10px] font-mono">{kbd}</kbd>
                </button>
              ))}
            </div>

            {/* ─── READING COMPREHENSION ─── */}
            {practiceType === 'reading' && readingSet && (
              <ReadingEngine
                set={readingSet}
                answers={readingAnswers[readingSet.id] ?? {}}
                submitted={readingSubmitted[readingSet.id] ?? false}
                correctCount={readingCorrectCount}
                passageOpen={passageOpen}
                setPassageOpen={setPassageOpen}
                showHint={showReadingHint}
                setShowHint={setShowReadingHint}
                showExplanation={showExplanation}
                setShowExplanation={setShowExplanation}
                onSelect={(letter, idx) => handleSelectAnswer(
                  readingAnswers, setReadingAnswers, readingSubmitted, readingSet.id, letter, idx,
                )}
                onSubmit={() => handleSubmitSet(
                  readingSubmitted, setReadingSubmitted, readingSet.id,
                  readingAnswers[readingSet.id] ?? {}, readingSet.questions.length,
                )}
                onPrev={() => setReadingIdx(Math.max(0, readingIdx - 1))}
                onNext={() => setReadingIdx(Math.min(READING_SETS.length - 1, readingIdx + 1))}
                idx={readingIdx}
                total={READING_SETS.length}
              />
            )}

            {/* ─── GRAMMAR GAP-FILL ─── */}
            {practiceType === 'grammar' && grammarSet && (
              <GrammarEngine
                set={grammarSet}
                answers={grammarAnswers[grammarSet.id] ?? {}}
                submitted={grammarSubmitted[grammarSet.id] ?? false}
                correctCount={grammarCorrectCount}
                showExplanation={showExplanation}
                setShowExplanation={setShowExplanation}
                onSelect={(letter, idx) => handleSelectAnswer(
                  grammarAnswers, setGrammarAnswers, grammarSubmitted, grammarSet.id, letter, idx,
                )}
                onSubmit={() => handleSubmitSet(
                  grammarSubmitted, setGrammarSubmitted, grammarSet.id,
                  grammarAnswers[grammarSet.id] ?? {}, grammarSet.gaps.length,
                )}
                onPrev={() => setGrammarIdx(Math.max(0, grammarIdx - 1))}
                onNext={() => setGrammarIdx(Math.min(GRAMMAR_SETS.length - 1, grammarIdx + 1))}
                idx={grammarIdx}
                total={GRAMMAR_SETS.length}
              />
            )}

            {/* ─── LISTENING COMPREHENSION ─── */}
            {practiceType === 'listening' && listeningSet && (
              <ListeningEngine
                set={listeningSet}
                answers={listeningAnswers[listeningSet.id] ?? {}}
                submitted={listeningSubmitted[listeningSet.id] ?? false}
                correctCount={listeningCorrectCount}
                showTranscript={showTranscript}
                setShowTranscript={setShowTranscript}
                showExplanation={showExplanation}
                setShowExplanation={setShowExplanation}
                onSelect={(letter, idx) => handleSelectAnswer(
                  listeningAnswers, setListeningAnswers, listeningSubmitted, listeningSet.id, letter, idx,
                )}
                onSubmit={() => handleSubmitSet(
                  listeningSubmitted, setListeningSubmitted, listeningSet.id,
                  listeningAnswers[listeningSet.id] ?? {}, listeningSet.questions.length,
                )}
                onPrev={() => setListeningIdx(Math.max(0, listeningIdx - 1))}
                onNext={() => setListeningIdx(Math.min(LISTENING_SETS.length - 1, listeningIdx + 1))}
                idx={listeningIdx}
                total={LISTENING_SETS.length}
              />
            )}

            {/* Reset button */}
            <div className="flex justify-center pt-4">
              <Button
                onClick={handleReset}
                variant="outline"
                className="border-cyan-800/30 text-cyan-500/70 hover:bg-cyan-900/20 hover:text-cyan-300"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Начать заново
              </Button>
            </div>
          </motion.div>
        )}

        {/* ══════ WRITING MODE ══════ */}
        {mode === 'writing' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <WritingEngine
              task={emailTask}
              emailText={emailText}
              setEmailText={setEmailText}
              wordCount={wordCount}
              showSample={showSample}
              setShowSample={setShowSample}
              tipsOpen={emailTipsOpen}
              setTipsOpen={setEmailTipsOpen}
              onPrev={() => setEmailIdx(Math.max(0, emailIdx - 1))}
              onNext={() => setEmailIdx(Math.min(EMAIL_TASKS.length - 1, emailIdx + 1))}
              idx={emailIdx}
              total={EMAIL_TASKS.length}
            />
          </motion.div>
        )}

        {/* ══════ REFERENCE MODE ══════ */}
        {mode === 'reference' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ReferencePanel refTab={refTab} setRefTab={setRefTab} />
          </motion.div>
        )}
      </main>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="mt-auto border-t border-cyan-900/20 py-4">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between text-xs text-cyan-500/40">
          <span>ВПР English — 7 класс</span>
          <div className="flex items-center gap-3">
            <BookStackSVG />
            <LetterChainSVG />
          </div>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════
// READING ENGINE
// ═══════════════════════════════════════════════════════════════════════════════════

function ReadingEngine({
  set, answers, submitted, correctCount,
  passageOpen, setPassageOpen, showHint, setShowHint,
  showExplanation, setShowExplanation,
  onSelect, onSubmit, onPrev, onNext, idx, total,
}: {
  set: ReadingSet;
  answers: Record<string, number>;
  submitted: boolean;
  correctCount: number;
  passageOpen: boolean;
  setPassageOpen: (v: boolean) => void;
  showHint: boolean;
  setShowHint: (v: boolean) => void;
  showExplanation: Record<string, boolean>;
  setShowExplanation: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onSelect: (letter: string, idx: number) => void;
  onSubmit: () => void;
  onPrev: () => void;
  onNext: () => void;
  idx: number;
  total: number;
}) {
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onPrev} disabled={idx === 0}
          className="text-cyan-400 hover:text-cyan-200 disabled:opacity-30">
          <ArrowLeft className="w-4 h-4 mr-1" /> Назад
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-cyan-600/40 text-cyan-300 text-xs">{set.vprType}</Badge>
          <span className="text-xs text-cyan-500/60">{idx + 1} / {total}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onNext} disabled={idx === total - 1}
          className="text-cyan-400 hover:text-cyan-200 disabled:opacity-30">
          Далее <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={set.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>

          <Card className="bg-[#081424]/80 border-cyan-800/20">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base sm:text-lg text-cyan-100">
                  <FileText className="w-4 h-4 inline mr-2 text-cyan-400" />
                  {set.title}
                </CardTitle>
                <Button variant="ghost" size="sm"
                  onClick={() => setPassageOpen(!passageOpen)}
                  className="text-cyan-500 hover:text-cyan-300 text-xs">
                  {passageOpen ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                  {passageOpen ? 'Скрыть' : 'Текст'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {/* Passage */}
              <AnimatePresence>
                {passageOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 bg-cyan-950/20 rounded-lg border border-cyan-800/15">
                      <p className="text-sm sm:text-base text-gray-300 leading-relaxed whitespace-pre-line font-serif">
                        {set.passage}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Questions */}
              {set.questions.map((q) => {
                const selectedIdx = answers[q.letter];
                const isCorrect = submitted && selectedIdx === q.correctIndex;
                const isWrong = submitted && selectedIdx !== undefined && selectedIdx !== q.correctIndex;
                const expOpen = showExplanation[q.letter];

                return (
                  <div key={q.letter} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-cyan-900/30 border border-cyan-700/30 flex items-center justify-center text-xs font-bold text-cyan-300">
                        {q.letter}
                      </span>
                      <p className="text-sm text-gray-200 flex-1">{q.question}</p>
                      {submitted && isCorrect && <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />}
                      {submitted && isWrong && <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 ml-9">
                      {q.options.map((opt, oi) => {
                        const isSelected = selectedIdx === oi;
                        const showCorrectOpt = submitted && oi === q.correctIndex;
                        const showWrongOpt = submitted && isSelected && oi !== q.correctIndex;
                        return (
                          <button
                            key={oi}
                            onClick={() => onSelect(q.letter, oi)}
                            disabled={submitted}
                            className={`
                              text-left p-2.5 rounded-lg border text-sm transition-all
                              ${showCorrectOpt
                                ? 'border-green-500/40 bg-green-900/15 text-green-300'
                                : showWrongOpt
                                  ? 'border-red-500/40 bg-red-900/15 text-red-300'
                                  : isSelected
                                    ? 'border-cyan-500/40 bg-cyan-900/20 text-cyan-200'
                                    : 'border-cyan-800/15 bg-cyan-950/10 text-gray-400 hover:bg-cyan-900/10 hover:border-cyan-700/20'
                              }
                            `}
                          >
                            <div className="flex items-start gap-2">
                              <div className={`
                                w-3.5 h-3.5 mt-0.5 rounded-full border flex-shrink-0 flex items-center justify-center
                                ${isSelected ? 'border-cyan-400' : 'border-cyan-800/30'}
                                ${showCorrectOpt ? 'border-green-400' : ''}
                                ${showWrongOpt ? 'border-red-400' : ''}
                              `}>
                                {(isSelected || showCorrectOpt) && (
                                  <div className={`w-1.5 h-1.5 rounded-full ${showCorrectOpt ? 'bg-green-400' : 'bg-cyan-400'}`} />
                                )}
                              </div>
                              <span className="text-xs sm:text-sm">{opt}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {/* Explanation toggle */}
                    {submitted && (
                      <button
                        onClick={() => setShowExplanation(prev => ({ ...prev, [q.letter]: !prev[q.letter] }))}
                        className="ml-9 text-xs text-cyan-500/60 hover:text-cyan-400 flex items-center gap-1 transition-colors"
                      >
                        {expOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {expOpen ? 'Скрыть' : 'Пояснение'}
                      </button>
                    )}
                    <AnimatePresence>
                      {expOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="ml-9 overflow-hidden"
                        >
                          <div className="p-3 bg-cyan-950/30 rounded-lg border border-cyan-800/15">
                            <p className="text-xs text-cyan-300/70 leading-relaxed">{q.explanation}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {/* Progress + Submit */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-cyan-500/50">{answeredCount} / {set.questions.length} ответов</p>
                {!submitted ? (
                  <Button
                    onClick={onSubmit}
                    disabled={answeredCount < set.questions.length}
                    className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white disabled:opacity-40 shadow-lg shadow-cyan-900/30"
                  >
                    <SpellCheck className="w-4 h-4 mr-1.5" />
                    Проверить
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge className={`${correctCount === set.questions.length ? 'bg-green-900/40 text-green-300 border-green-700/30' : 'bg-amber-900/40 text-amber-300 border-amber-700/30'}`}>
                      {correctCount}/{set.questions.length} correct
                    </Badge>
                    <Badge variant="outline" className="border-cyan-700/30 text-cyan-400 text-xs font-mono">
                      {set.answerKey}
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Question dots */}
      <div className="flex justify-center gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <button key={i} onClick={() => { /* nav handled by prev/next */ }}
            className={`w-2.5 h-2.5 rounded-full transition-all ${i === idx ? 'bg-cyan-400 scale-125' : i < idx ? 'bg-cyan-600' : 'bg-cyan-800/40'}`} />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════
// GRAMMAR ENGINE
// ═══════════════════════════════════════════════════════════════════════════════════

function GrammarEngine({
  set, answers, submitted, correctCount,
  showExplanation, setShowExplanation,
  onSelect, onSubmit, onPrev, onNext, idx, total,
}: {
  set: GrammarSet;
  answers: Record<string, number>;
  submitted: boolean;
  correctCount: number;
  showExplanation: Record<string, boolean>;
  setShowExplanation: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onSelect: (letter: string, idx: number) => void;
  onSubmit: () => void;
  onPrev: () => void;
  onNext: () => void;
  idx: number;
  total: number;
}) {
  const answeredCount = Object.keys(answers).length;
  const segments = useMemo(() => parseGrammarTemplate(set.template), [set.template]);

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onPrev} disabled={idx === 0}
          className="text-cyan-400 hover:text-cyan-200 disabled:opacity-30">
          <ArrowLeft className="w-4 h-4 mr-1" /> Назад
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-cyan-600/40 text-cyan-300 text-xs">{set.vprType}</Badge>
          <span className="text-xs text-cyan-500/60">{idx + 1} / {total}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onNext} disabled={idx === total - 1}
          className="text-cyan-400 hover:text-cyan-200 disabled:opacity-30">
          Далее <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={set.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>

          <Card className="bg-[#081424]/80 border-cyan-800/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg text-cyan-100">
                <SpellCheck className="w-4 h-4 inline mr-2 text-cyan-400" />
                {set.title} — Grammar
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {/* Text with gaps */}
              <div className="p-4 bg-cyan-950/20 rounded-lg border border-cyan-800/15">
                <div className="text-sm sm:text-base text-gray-300 leading-relaxed font-serif">
                  {segments.map((seg, i) => {
                    if (seg.type === 'text') {
                      const parts = seg.content.split('\n');
                      return parts.map((line, li) => (
                        <span key={`${i}-${li}`}>
                          {li > 0 && <br />}
                          {line}
                        </span>
                      ));
                    }
                    const gap = set.gaps.find(g => g.letter === seg.letter);
                    if (!gap) return null;
                    const selectedIdx = answers[gap.letter];
                    const isCorrect = submitted && selectedIdx === gap.correctIndex;
                    const isWrong = submitted && selectedIdx !== undefined && selectedIdx !== gap.correctIndex;

                    return (
                      <span
                        key={`gap-${gap.letter}`}
                        className={`
                          relative cursor-pointer mx-0.5 rounded px-1 transition-all select-none
                          ${isCorrect ? 'bg-green-600/20 ring-1 ring-green-500/40'
                            : isWrong ? 'bg-red-600/20 ring-1 ring-red-500/40'
                            : selectedIdx !== undefined
                              ? 'bg-cyan-600/20 ring-1 ring-cyan-500/40'
                              : 'bg-cyan-800/30 ring-1 ring-cyan-700/30 hover:bg-cyan-700/40 hover:ring-cyan-500/50'
                          }
                        `}
                      >
                        <span className={`
                          text-xs font-mono font-bold
                          ${isCorrect ? 'text-green-300' : isWrong ? 'text-red-300'
                            : selectedIdx !== undefined ? 'text-cyan-200' : 'text-cyan-400'}
                        `}>
                          {gap.letter}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Gap options */}
              {set.gaps.map((gap) => {
                const selectedIdx = answers[gap.letter];
                const isCorrect = submitted && selectedIdx === gap.correctIndex;
                const isWrong = submitted && selectedIdx !== undefined && selectedIdx !== gap.correctIndex;
                const expOpen = showExplanation[gap.letter];

                return (
                  <div key={gap.letter} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-cyan-900/30 border border-cyan-700/30 flex items-center justify-center text-xs font-bold text-cyan-300">
                        {gap.letter}
                      </span>
                      <p className="text-xs text-cyan-400/60 flex-1">
                        {gap.options.map((opt, oi) => `${oi + 1}) ${opt}`).join('  ')}
                      </p>
                      {submitted && isCorrect && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                      {submitted && isWrong && <XCircle className="w-4 h-4 text-red-400" />}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 ml-9">
                      {gap.options.map((opt, oi) => {
                        const isSelected = selectedIdx === oi;
                        const showCorrectOpt = submitted && oi === gap.correctIndex;
                        const showWrongOpt = submitted && isSelected && oi !== gap.correctIndex;
                        return (
                          <button
                            key={oi}
                            onClick={() => onSelect(gap.letter, oi)}
                            disabled={submitted}
                            className={`
                              text-left p-2 rounded-lg border text-xs sm:text-sm transition-all
                              ${showCorrectOpt
                                ? 'border-green-500/40 bg-green-900/15 text-green-300'
                                : showWrongOpt
                                  ? 'border-red-500/40 bg-red-900/15 text-red-300'
                                  : isSelected
                                    ? 'border-cyan-500/40 bg-cyan-900/20 text-cyan-200'
                                    : 'border-cyan-800/15 bg-cyan-950/10 text-gray-400 hover:bg-cyan-900/10'
                              }
                            `}
                          >
                            <span className="font-mono text-cyan-500/50 mr-1">{oi + 1})</span>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {/* Rule tag + explanation */}
                    {submitted && (
                      <button
                        onClick={() => setShowExplanation(prev => ({ ...prev, [gap.letter]: !prev[gap.letter] }))}
                        className="ml-9 text-xs text-cyan-500/60 hover:text-cyan-400 flex items-center gap-1 transition-colors"
                      >
                        {expOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        <Badge variant="outline" className="text-[10px] border-cyan-700/20 text-cyan-500/50 py-0">{gap.rule}</Badge>
                        {expOpen ? ' Скрыть' : ' Пояснение'}
                      </button>
                    )}
                    <AnimatePresence>
                      {expOpen && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }} className="ml-9 overflow-hidden">
                          <div className="p-3 bg-cyan-950/30 rounded-lg border border-cyan-800/15">
                            <p className="text-xs text-cyan-300/70 leading-relaxed">{gap.explanation}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {/* Progress + Submit */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-cyan-500/50">{answeredCount} / {set.gaps.length} gaps</p>
                {!submitted ? (
                  <Button
                    onClick={onSubmit}
                    disabled={answeredCount < set.gaps.length}
                    className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white disabled:opacity-40 shadow-lg shadow-cyan-900/30"
                  >
                    <SpellCheck className="w-4 h-4 mr-1.5" />
                    Проверить
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge className={`${correctCount === set.gaps.length ? 'bg-green-900/40 text-green-300 border-green-700/30' : 'bg-amber-900/40 text-amber-300 border-amber-700/30'}`}>
                      {correctCount}/{set.gaps.length} correct
                    </Badge>
                    <Badge variant="outline" className="border-cyan-700/30 text-cyan-400 text-xs font-mono">
                      {set.answerKey}
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Question dots */}
      <div className="flex justify-center gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <button key={i}
            className={`w-2.5 h-2.5 rounded-full transition-all ${i === idx ? 'bg-cyan-400 scale-125' : i < idx ? 'bg-cyan-600' : 'bg-cyan-800/40'}`} />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════
// LISTENING ENGINE
// ═══════════════════════════════════════════════════════════════════════════════════

function ListeningEngine({
  set, answers, submitted, correctCount,
  showTranscript, setShowTranscript,
  showExplanation, setShowExplanation,
  onSelect, onSubmit, onPrev, onNext, idx, total,
}: {
  set: ListeningSet;
  answers: Record<string, number>;
  submitted: boolean;
  correctCount: number;
  showTranscript: boolean;
  setShowTranscript: (v: boolean) => void;
  showExplanation: Record<string, boolean>;
  setShowExplanation: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onSelect: (letter: string, idx: number) => void;
  onSubmit: () => void;
  onPrev: () => void;
  onNext: () => void;
  idx: number;
  total: number;
}) {
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onPrev} disabled={idx === 0}
          className="text-cyan-400 hover:text-cyan-200 disabled:opacity-30">
          <ArrowLeft className="w-4 h-4 mr-1" /> Назад
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-cyan-600/40 text-cyan-300 text-xs">{set.vprType}</Badge>
          <span className="text-xs text-cyan-500/60">{idx + 1} / {total}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onNext} disabled={idx === total - 1}
          className="text-cyan-400 hover:text-cyan-200 disabled:opacity-30">
          Далее <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={set.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>

          <Card className="bg-[#081424]/80 border-cyan-800/20">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base sm:text-lg text-cyan-100">
                  <Headphones className="w-4 h-4 inline mr-2 text-cyan-400" />
                  {set.title}
                </CardTitle>
                <Button variant="ghost" size="sm"
                  onClick={() => setShowTranscript(!showTranscript)}
                  className={`text-xs ${showTranscript ? 'text-cyan-400' : 'text-cyan-500/50'}`}>
                  {showTranscript ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                  Transcript
                </Button>
              </div>
              {/* Audio simulation notice */}
              <div className="flex items-center gap-2 mt-2 p-2.5 rounded-lg bg-amber-900/10 border border-amber-800/15">
                <Volume2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-300/70">
                  В настоящем ВПР вы услышите диалог дважды. Здесь — читайте transcript для подготовки.
                </p>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {/* Transcript (collapsible) */}
              <AnimatePresence>
                {showTranscript && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 bg-cyan-950/20 rounded-lg border border-cyan-800/15">
                      <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line font-serif italic">
                        {set.transcript}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Questions (3 options each) */}
              {set.questions.map((q) => {
                const selectedIdx = answers[q.letter];
                const isCorrect = submitted && selectedIdx === q.correctIndex;
                const isWrong = submitted && selectedIdx !== undefined && selectedIdx !== q.correctIndex;
                const expOpen = showExplanation[q.letter];

                return (
                  <div key={q.letter} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-cyan-900/30 border border-cyan-700/30 flex items-center justify-center text-xs font-bold text-cyan-300">
                        {q.letter}
                      </span>
                      <p className="text-sm text-gray-200 flex-1">{q.question}</p>
                      {submitted && isCorrect && <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />}
                      {submitted && isWrong && <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 ml-9">
                      {q.options.map((opt, oi) => {
                        const isSelected = selectedIdx === oi;
                        const showCorrectOpt = submitted && oi === q.correctIndex;
                        const showWrongOpt = submitted && isSelected && oi !== q.correctIndex;
                        return (
                          <button
                            key={oi}
                            onClick={() => onSelect(q.letter, oi)}
                            disabled={submitted}
                            className={`
                              text-left p-2.5 rounded-lg border text-sm transition-all
                              ${showCorrectOpt
                                ? 'border-green-500/40 bg-green-900/15 text-green-300'
                                : showWrongOpt
                                  ? 'border-red-500/40 bg-red-900/15 text-red-300'
                                  : isSelected
                                    ? 'border-cyan-500/40 bg-cyan-900/20 text-cyan-200'
                                    : 'border-cyan-800/15 bg-cyan-950/10 text-gray-400 hover:bg-cyan-900/10'
                              }
                            `}
                          >
                            <div className="flex items-start gap-2">
                              <div className={`
                                w-3.5 h-3.5 mt-0.5 rounded-full border flex-shrink-0 flex items-center justify-center
                                ${isSelected ? 'border-cyan-400' : 'border-cyan-800/30'}
                                ${showCorrectOpt ? 'border-green-400' : ''}
                                ${showWrongOpt ? 'border-red-400' : ''}
                              `}>
                                {(isSelected || showCorrectOpt) && (
                                  <div className={`w-1.5 h-1.5 rounded-full ${showCorrectOpt ? 'bg-green-400' : 'bg-cyan-400'}`} />
                                )}
                              </div>
                              <span className="text-xs sm:text-sm">{opt}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {submitted && (
                      <button
                        onClick={() => setShowExplanation(prev => ({ ...prev, [q.letter]: !prev[q.letter] }))}
                        className="ml-9 text-xs text-cyan-500/60 hover:text-cyan-400 flex items-center gap-1 transition-colors"
                      >
                        {expOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {expOpen ? 'Скрыть' : 'Пояснение'}
                      </button>
                    )}
                    <AnimatePresence>
                      {expOpen && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }} className="ml-9 overflow-hidden">
                          <div className="p-3 bg-cyan-950/30 rounded-lg border border-cyan-800/15">
                            <p className="text-xs text-cyan-300/70 leading-relaxed">{q.explanation}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {/* Progress + Submit */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-cyan-500/50">{answeredCount} / {set.questions.length} ответов</p>
                {!submitted ? (
                  <Button
                    onClick={onSubmit}
                    disabled={answeredCount < set.questions.length}
                    className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white disabled:opacity-40 shadow-lg shadow-cyan-900/30"
                  >
                    <SpellCheck className="w-4 h-4 mr-1.5" />
                    Проверить
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge className={`${correctCount === set.questions.length ? 'bg-green-900/40 text-green-300 border-green-700/30' : 'bg-amber-900/40 text-amber-300 border-amber-700/30'}`}>
                      {correctCount}/{set.questions.length} correct
                    </Badge>
                    <Badge variant="outline" className="border-cyan-700/30 text-cyan-400 text-xs font-mono">
                      {set.answerKey}
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Question dots */}
      <div className="flex justify-center gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <button key={i}
            className={`w-2.5 h-2.5 rounded-full transition-all ${i === idx ? 'bg-cyan-400 scale-125' : i < idx ? 'bg-cyan-600' : 'bg-cyan-800/40'}`} />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════
// WRITING ENGINE (Type 4 — Email)
// ═══════════════════════════════════════════════════════════════════════════════════

function WritingEngine({
  task, emailText, setEmailText, wordCount,
  showSample, setShowSample, tipsOpen, setTipsOpen,
  onPrev, onNext, idx, total,
}: {
  task: EmailTask;
  emailText: string;
  setEmailText: (v: string) => void;
  wordCount: number;
  showSample: boolean;
  setShowSample: (v: boolean) => void;
  tipsOpen: boolean;
  setTipsOpen: (v: boolean) => void;
  onPrev: () => void;
  onNext: () => void;
  idx: number;
  total: number;
}) {
  const wordPercent = Math.min(100, Math.round((wordCount / task.wordLimit.max) * 100));
  const inRange = wordCount >= task.wordLimit.min && wordCount <= task.wordLimit.max;
  const tooShort = wordCount > 0 && wordCount < task.wordLimit.min;
  const tooLong = wordCount > task.wordLimit.max;

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onPrev} disabled={idx === 0}
          className="text-cyan-400 hover:text-cyan-200 disabled:opacity-30">
          <ArrowLeft className="w-4 h-4 mr-1" /> Назад
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-cyan-600/40 text-cyan-300 text-xs">{task.vprType}</Badge>
          <span className="text-xs text-cyan-500/60">{idx + 1} / {total}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onNext} disabled={idx === total - 1}
          className="text-cyan-400 hover:text-cyan-200 disabled:opacity-30">
          Далее <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={task.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>

          <Card className="bg-[#081424]/80 border-cyan-800/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg text-cyan-100">
                <Mail className="w-4 h-4 inline mr-2 text-cyan-400" />
                Email Writing — {task.subject}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {/* Incoming email */}
              <div className="p-4 bg-cyan-950/20 rounded-lg border border-cyan-800/15">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-3.5 h-3.5 text-cyan-500/50" />
                  <span className="text-xs text-cyan-400/70 font-mono">
                    From: {task.from.email}
                  </span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed italic font-serif">
                  {task.incomingEmail}
                </p>
              </div>

              {/* 3 questions to answer */}
              <div className="p-3 bg-amber-900/10 rounded-lg border border-amber-800/15">
                <p className="text-xs text-amber-300/80 font-medium mb-2 flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Answer these 3 questions:
                </p>
                {task.questions.map((q, i) => (
                  <div key={i} className="flex items-start gap-2 ml-4 mb-1">
                    <span className="text-amber-400/60 text-xs font-bold mt-0.5">{i + 1}.</span>
                    <p className="text-xs text-amber-200/70">{q}</p>
                  </div>
                ))}
              </div>

              {/* Writing area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-cyan-400/60 flex items-center gap-1">
                    <PenTool className="w-3 h-3" /> Your reply ({task.wordLimit.min}–{task.wordLimit.max} words)
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono ${inRange ? 'text-green-400' : tooShort ? 'text-amber-400' : tooLong ? 'text-red-400' : 'text-cyan-500/50'}`}>
                      {wordCount} words
                    </span>
                    {inRange && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
                  </div>
                </div>
                <Progress value={wordPercent} className="h-1.5"
                  indicatorClassName={inRange ? 'bg-green-500' : tooShort ? 'bg-amber-500' : tooLong ? 'bg-red-500' : 'bg-cyan-500'} />
                <textarea
                  value={emailText}
                  onChange={(e) => setEmailText(e.target.value)}
                  placeholder="Dear Kieran,&#10;&#10;Thank you for your letter!..."
                  rows={10}
                  className="w-full bg-cyan-950/30 border border-cyan-800/20 rounded-lg p-3 text-sm text-gray-200 placeholder:text-cyan-600/30 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 resize-y font-serif"
                />
              </div>

              {/* Tips + Sample toggles */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm"
                  onClick={() => setTipsOpen(!tipsOpen)}
                  className={`text-xs border-cyan-800/30 ${tipsOpen ? 'text-cyan-300 bg-cyan-900/20' : 'text-cyan-500/60'}`}>
                  <Lightbulb className="w-3.5 h-3.5 mr-1" />
                  Tips {tipsOpen ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                </Button>
                <Button variant="outline" size="sm"
                  onClick={() => setShowSample(!showSample)}
                  className={`text-xs border-cyan-800/30 ${showSample ? 'text-cyan-300 bg-cyan-900/20' : 'text-cyan-500/60'}`}>
                  <Eye className="w-3.5 h-3.5 mr-1" />
                  Sample Answer {showSample ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                </Button>
              </div>

              {/* Tips */}
              <AnimatePresence>
                {tipsOpen && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="p-3 bg-cyan-950/30 rounded-lg border border-cyan-800/15 space-y-1.5">
                      {task.tips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-cyan-500/40 text-xs mt-0.5">{i + 1}.</span>
                          <p className="text-xs text-cyan-300/70 leading-relaxed">{tip}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Sample answer */}
              <AnimatePresence>
                {showSample && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="p-4 bg-green-950/20 rounded-lg border border-green-800/15">
                      <p className="text-xs text-green-400/60 font-medium mb-2 flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5" />
                        Sample Answer ({task.sampleAnswer.trim().split(/\s+/).length} words)
                      </p>
                      <p className="text-sm text-green-300/80 leading-relaxed whitespace-pre-line font-serif">
                        {task.sampleAnswer}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Question dots */}
      <div className="flex justify-center gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <button key={i}
            className={`w-2.5 h-2.5 rounded-full transition-all ${i === idx ? 'bg-cyan-400 scale-125' : i < idx ? 'bg-cyan-600' : 'bg-cyan-800/40'}`} />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════
// REFERENCE PANEL
// ═══════════════════════════════════════════════════════════════════════════════════

function ReferencePanel({
  refTab, setRefTab,
}: {
  refTab: RefTab;
  setRefTab: (t: RefTab) => void;
}) {
  const tabs: { key: RefTab; label: string; icon: typeof BookOpen }[] = [
    { key: 'tenses', label: 'Tenses', icon: ListChecks },
    { key: 'pronouns', label: 'Pronouns', icon: MessageSquare },
    { key: 'passive', label: 'Passive', icon: RefreshCw },
    { key: 'verbs', label: 'Irregular V.', icon: BookOpen },
  ];

  return (
    <div className="space-y-4">
      {/* Tab selector */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key}
            onClick={() => setRefTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border
              ${refTab === key
                ? 'bg-cyan-800/30 text-cyan-200 border-cyan-600/40'
                : 'bg-cyan-950/20 text-cyan-500/60 border-cyan-800/20 hover:bg-cyan-900/20'
              }
            `}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Tenses */}
      {refTab === 'tenses' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {TENSES_DATA.map((t, i) => (
            <motion.div key={t.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="bg-[#081424]/80 border-cyan-800/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `hsl(${190 + i * 15}, 80%, 60%)` }} />
                    <CardTitle className="text-sm text-cyan-200">{t.title}</CardTitle>
                    <span className="text-xs text-cyan-500/50 ml-auto">{t.russian}</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded bg-cyan-950/20">
                      <span className="text-cyan-500/50 block mb-0.5">Formula</span>
                      <span className="text-cyan-200 font-mono">{t.formula}</span>
                    </div>
                    <div className="p-2 rounded bg-cyan-950/20">
                      <span className="text-cyan-500/50 block mb-0.5">Negative</span>
                      <span className="text-cyan-200 font-mono text-xs">{t.negative}</span>
                    </div>
                    <div className="p-2 rounded bg-cyan-950/20">
                      <span className="text-cyan-500/50 block mb-0.5">Question</span>
                      <span className="text-cyan-200 font-mono text-xs">{t.question}</span>
                    </div>
                  </div>
                  <p className="text-xs text-cyan-400/60">{t.usage}</p>
                  <div className="space-y-1">
                    {t.examples.map((ex, ei) => (
                      <p key={ei} className="text-xs text-gray-300/80 pl-2 border-l-2 border-cyan-800/20">
                        {ex}
                      </p>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {t.markers.map((m) => (
                      <Badge key={m} variant="outline" className="text-[10px] border-cyan-800/20 text-cyan-500/50 py-0 px-1.5">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Pronouns */}
      {refTab === 'pronouns' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="bg-[#081424]/80 border-cyan-800/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-cyan-200">Pronouns — Личные местоимения</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-1">
                <div className="p-2 rounded bg-cyan-950/20 text-center text-xs">
                  <span className="text-cyan-500/50 block mb-1">Subject</span>
                  {PRONOUNS_DATA.map(p => (
                    <p key={p.subject} className="text-cyan-200 font-mono">{p.subject}</p>
                  ))}
                </div>
                <div className="p-2 rounded bg-cyan-950/20 text-center text-xs">
                  <span className="text-cyan-500/50 block mb-1">Object</span>
                  {PRONOUNS_DATA.map(p => (
                    <p key={p.object} className="text-cyan-200 font-mono">{p.object}</p>
                  ))}
                </div>
                <div className="p-2 rounded bg-cyan-950/20 text-center text-xs">
                  <span className="text-cyan-500/50 block mb-1">Possessive</span>
                  {PRONOUNS_DATA.map(p => (
                    <p key={p.possessive} className="text-cyan-200 font-mono">{p.possessive}</p>
                  ))}
                </div>
                <div className="p-2 rounded bg-cyan-950/20 text-xs">
                  <span className="text-cyan-500/50 block mb-1">Example</span>
                  {PRONOUNS_DATA.map(p => (
                    <p key={p.subject} className="text-cyan-300/60 font-serif">
                      {p.subject === 'I' ? '...love' : p.subject === 'You' ? '...like' : p.subject === 'He' ? '...is' : p.subject === 'She' ? '...has' : '...are'} {p.object}
                    </p>
                  ))}
                </div>
              </div>
              <div className="mt-3 p-2 bg-amber-900/10 rounded border border-amber-800/15">
                <p className="text-xs text-amber-300/70">
                  <strong className="text-amber-300">Tip:</strong> After prepositions and verbs, use OBJECT pronouns (me, him, her, them). Never &quot;I like he&quot; — say &quot;I like him.&quot;
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Passive Voice */}
      {refTab === 'passive' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="bg-[#081424]/80 border-cyan-800/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-cyan-200">Passive Voice — Пассивный залог</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="p-3 rounded-lg bg-cyan-950/20">
                <p className="text-xs text-cyan-500/50 mb-1">Formula</p>
                <p className="text-base text-cyan-200 font-mono">{PASSIVE_VOICE_RULE.formula}</p>
              </div>
              <p className="text-xs text-cyan-400/60">{PASSIVE_VOICE_RULE.tip}</p>
              <div className="space-y-1.5">
                {PASSIVE_VOICE_RULE.examples.map((ex, i) => (
                  <div key={i} className="p-2 rounded bg-cyan-950/20 border-l-2 border-cyan-600/30">
                    <p className="text-sm text-gray-300 font-serif">{ex}</p>
                  </div>
                ))}
              </div>
              <div className="p-2 bg-amber-900/10 rounded border border-amber-800/15">
                <p className="text-xs text-amber-300/70">
                  <strong className="text-amber-300">VPR tip:</strong> Look for &quot;by&quot; phrases and think: does the subject DO the action or RECEIVE it?
                  Active: &quot;Shakespeare wrote Hamlet.&quot; → Passive: &quot;Hamlet was written by Shakespeare.&quot;
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { tense: 'Present', formula: 'am/is/are + V3', ex: 'The room is cleaned.' },
                  { tense: 'Past', formula: 'was/were + V3', ex: 'The book was written.' },
                  { tense: 'Future', formula: 'will be + V3', ex: 'It will be done.' },
                  { tense: 'Present Perfect', formula: 'have/has been + V3', ex: 'It has been finished.' },
                ].map(({ tense, formula, ex }) => (
                  <div key={tense} className="p-2 rounded bg-cyan-950/20">
                    <span className="text-cyan-400/70 font-medium">{tense}</span>
                    <span className="text-cyan-500/50 ml-1 font-mono text-xs">{formula}</span>
                    <p className="text-gray-400 mt-0.5 italic font-serif">{ex}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Irregular Verbs */}
      {refTab === 'verbs' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="bg-[#081424]/80 border-cyan-800/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-cyan-200">
                Irregular Verbs — Неправильные глаголы
                <Badge variant="outline" className="text-[10px] border-cyan-700/30 text-cyan-400 py-0 ml-2">
                  {IRREGULAR_VERBS.length} verbs
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                {IRREGULAR_VERBS.map((v, i) => (
                  <div key={i} className={`
                    flex items-center gap-2 px-2 py-1.5 rounded text-xs
                    ${i % 2 === 0 ? 'bg-cyan-950/10' : 'bg-transparent'}
                  `}>
                    <span className="text-cyan-300 font-mono w-20 truncate">{v.v1}</span>
                    <span className="text-cyan-400/60 font-mono w-20 truncate">{v.v2}</span>
                    <span className="text-cyan-500/50 font-mono flex-1 truncate">{v.v3}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-2 bg-amber-900/10 rounded border border-amber-800/15">
                <p className="text-xs text-amber-300/70">
                  <strong className="text-amber-300">VPR tip:</strong> V1 = infinitive (base form), V2 = Past Simple, V3 = Past Participle.
                  Used in: Past Simple (V2), Present Perfect (have/has + V3), Passive Voice (am/is/are + V3).
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
