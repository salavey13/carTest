"use client";

import React, { useState } from "react";
import { ReadProgress } from "@/components/vpr/ReadProgress";
import { VprCtaTest } from "@/components/vpr/VprCtaTest";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  BookOpen, Lightbulb, Brain, Sparkles, Ear, Link2, Scale, HelpCircle, Shuffle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * task220: Английский язык — 6 класс. Структура ВПР-6 (по разборам
 * демоверсий): (1) аудирование — 5 предложений True/False; (2) чтение —
 * текст + задания на понимание (match); (3) грамматика/лексика — формы
 * слова в скобках (Present Simple / Past Simple / Comparative); письменная
 * часть. Грамматическое ядро 6 класса:Present/Past Simple, степени
 * сравнения, союзные слова who/which/that, as…as, типы вопросов.
 */

// ============ ВРЕМЕНА: Present vs Past Simple ============
const TENSES = [
  {
    name: "Present Simple",
    color: "text-cyan-400",
    when: "регулярно / всегда / факты",
    markers: "always, usually, often, every day, never",
    form: "V / V-s (he/she/it)",
    ex: "She goes to school every day.",
    neg: "doesn't go",
    q: "Does she go…?",
  },
  {
    name: "Past Simple",
    color: "text-amber-400",
    when: "завершённое действие в прошлом",
    markers: "yesterday, last week, ago, in 2010",
    form: "V2 (правильные: -ed)",
    ex: "We visited London last summer.",
    neg: "didn't visit",
    q: "Did you visit…?",
  },
];

const IRREGULARS = [
  { v1: "go", v2: "went" }, { v1: "see", v2: "saw" }, { v1: "buy", v2: "bought" },
  { v1: "take", v2: "took" }, { v1: "make", v2: "made" }, { v1: "have", v2: "had" },
  { v1: "do", v2: "did" }, { v1: "eat", v2: "ate" }, { v1: "write", v2: "wrote" },
  { v1: "come", v2: "came" }, { v1: "say", v2: "said" }, { v1: "get", v2: "got" },
];

// ============ СТЕПЕНИ СРАВНЕНИЯ ============
const COMPARISON = [
  { rule: "1 слог: -er / -est", ex: "tall → taller → the tallest", note: "big → bigger (удваиваем согласную)" },
  { rule: "2+ слога: more / the most", ex: "interesting → more interesting → the most interesting", note: "никаких interestinger!" },
  { rule: "y на конце: -ier / -iest", ex: "happy → happier → the happiest", note: "y → i + er" },
  { rule: "as … as (такой же…как)", ex: "He is as tall as his brother.", note: "утверждение равенства" },
  { rule: "not so … as (не такой…как)", ex: "This film is not so interesting as that one.", note: "отрицание равенства" },
];

const IRREGULAR_ADJ = [
  { base: "good / well", comp: "better", sup: "the best" },
  { base: "bad", comp: "worse", sup: "the worst" },
  { base: "little", comp: "less", sup: "the least" },
  { base: "much / many", comp: "more", sup: "the most" },
];

// ============ WHO / WHICH / THAT + ВОПРОСЫ ============
const RELATIVES = [
  { word: "who", use: "о людях: A pilot is a person who flies planes.", color: "text-cyan-400" },
  { word: "which / that", use: "о вещах и животных: I lost the pen which/that you gave me.", color: "text-emerald-400" },
  { word: "whose", use: "чей: That's the boy whose dog I found.", color: "text-violet-400" },
  { word: "where", use: "о местах: This is the school where I study.", color: "text-amber-400" },
];

const QUESTIONS = [
  { type: "общий (yes/no)", formula: "Do/Does/Did + подлежащее + V…?", ex: "Do you like tea?" },
  { type: "специальный", formula: "Wh-word + do/does/did + V…?", ex: "Where do you live?" },
  { type: "к подлежащему", formula: "Who/What + V(-s)…? (БЕЗ do!)", ex: "Who lives here?" },
  { type: "альтернативный", formula: "… or …?", ex: "Tea or coffee?" },
  { type: "разделительный (tag)", formula: "…, don't you? / …, isn't he?", ex: "You like it, don't you?" },
];

// ============ КВИЗ ============
const QUIZ = [
  {
    q: "She _____ to the cinema yesterday.",
    options: ["goes", "went", "go", "will go"],
    correct: 1,
    hint: "yesterday = маркер Past Simple → went (2-я форма go).",
  },
  {
    q: "Look! My brother _____ football in the yard.",
    options: ["plays", "play", "is playing", "played"],
    correct: 2,
    hint: "Look! = сейчас, в момент речи → Present Continuous (am/is/are + V-ing).",
  },
  {
    q: "This book is _____ than that one.",
    options: ["interesting", "more interesting", "most interesting", "interestinger"],
    correct: 1,
    hint: "Многосложное прилагательное → more + interesting. -er нельзя.",
  },
  {
    q: "A doctor is a person _____ helps sick people.",
    options: ["which", "who", "whose", "where"],
    correct: 1,
    hint: "Говорим о людях → who. Which/that — про вещи.",
  },
  {
    q: "He is as tall _____ his father.",
    options: ["than", "then", "as", "like"],
    correct: 2,
    hint: "Конструкция as … as = «такой же… как». Than — только с comparative.",
  },
  {
    q: "_____ you see the film last night?",
    options: ["Do", "Does", "Did", "Are"],
    correct: 2,
    hint: "last night = прошлое → Past Simple → Did + see (инфинитив!).",
  },
  {
    q: "My day was the _____ in my life!",
    options: ["good", "better", "best", "goodest"],
    correct: 2,
    hint: "Превосходная степень + the; good — неправильное: good → better → the best.",
  },
  {
    q: "Where _____ he usually have lunch?",
    options: ["do", "does", "is", "did"],
    correct: 1,
    hint: "usually = Present Simple; he = 3-е лицо ед.ч. → does.",
  },
];

function VprQuizInline({ quiz }: { quiz: typeof QUIZ }) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [order, setOrder] = useState(() => quiz.map((_, i) => i).sort(() => Math.random() - 0.5));

  const q = quiz[order[idx]];
  const done = idx >= order.length;

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-white">
          <span className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-cyan-400" /> Question {Math.min(idx + 1, order.length)}/{order.length}
          </span>
          <span className="text-xs font-mono text-zinc-500">score: {score}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!done ? (
          <>
            <p className="text-sm sm:text-base font-bold text-white mb-5 leading-relaxed font-mono">{q.q}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {q.options.map((opt, oi) => {
                const isRight = oi === q.correct;
                const isPicked = picked === oi;
                return (
                  <Button
                    key={oi}
                    variant="outline"
                    disabled={picked !== null}
                    onClick={() => { setPicked(oi); if (isRight) setScore(score + 1); }}
                    className={cn(
                      "justify-start text-left normal-case text-[13px] font-mono",
                      picked !== null && isRight && "border-green-500 bg-green-950/40 text-green-300",
                      picked !== null && isPicked && !isRight && "border-red-500 bg-red-950/40 text-red-300",
                      picked === null && "border-zinc-700 hover:border-cyan-500/50"
                    )}
                  >
                    {opt}
                  </Button>
                );
              })}
            </div>
            {picked !== null && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
                <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                  {picked === q.correct ? "✓ Correct! " : "✗ Wrong. "}
                  {q.hint}
                </p>
                <Button
                  onClick={() => { setIdx(idx + 1); setPicked(null); }}
                  className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold"
                >
                  {idx === order.length - 1 ? "Finish" : "Next"} <Sparkles className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>
            )}
          </>
        ) : (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">{score === order.length ? "🏆" : score >= order.length * 0.7 ? "✅" : "🔁"}</div>
            <p className="text-white font-bold text-lg mb-1">{score}/{order.length}</p>
            <p className="text-zinc-500 text-sm mb-5">
              {score >= order.length * 0.7
                ? "Grammar engine загружен."
                : "Перечитай таблицы выше и вернись: feed → fight → fail → repeat."}
            </p>
            <Button
              variant="outline"
              onClick={() => { setIdx(0); setPicked(null); setScore(0); setOrder(quiz.map((_, i) => i).sort(() => Math.random() - 0.5)); }}
              className="border-zinc-600 text-zinc-300"
            >
              Try again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function EnglishCheatsheet6() {
  return (
    <div className="min-h-screen bg-[#030712] text-zinc-200 relative">
      <ReadProgress />
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

        {/* ============ HEADER + HERO ============ */}
        <motion.header initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-14">
          <div className="flex items-center gap-2 mb-4">
            <Link href="/vpr-tests" className="text-xs font-mono text-zinc-500 hover:text-cyan-400 transition-colors uppercase tracking-widest">
              ← VPR_tests
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest">english // 6 класс</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight mb-4">
            English <span className="text-cyan-400">Grade 6</span>
            <span className="block text-xl sm:text-2xl text-zinc-400 font-bold mt-2">Tenses · Degrees · Who/Which · Questions</span>
          </h1>
          {/* HERO-иллюстрация (task220) */}
          <div className="relative mb-6 overflow-hidden rounded-none border border-cyan-500/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/english-6.jpg"
              alt="English Grade 6 — неоновая иллюстрация"
              className="w-full h-auto opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent" />
          </div>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-2xl">
            ВПР по английскому в 6 классе: аудирование (True/False), чтение с пониманием
            и грамматика — вставить форму слова. Шпаргалка закрывает грамматическое ядро:
            Present/Past Simple, Present Continuous, степени сравнения, who/which и все типы вопросов.
          </p>
          <div className="flex flex-wrap gap-2 mt-6">
            {["2 времени + Continuous", "степени сравнения", "who/which/that", "12 неправильных глаголов", "квиз 8"].map((t) => (
              <span key={t} className="px-3 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-[10px] font-mono text-cyan-300/80 uppercase tracking-wider">
                {t}
              </span>
            ))}
          </div>
        </motion.header>

        {/* ============ TOPIC 1: ВРЕМЕНА ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Ear className="text-cyan-400" /> 1. Tenses: два главных + Continuous
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {TENSES.map((t) => (
              <Card key={t.name} className="bg-zinc-900 border-zinc-800">
                <CardHeader><CardTitle className={cn("font-mono", t.color)}>{t.name}</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-[13px]">
                  <div className="text-zinc-500"><b className="text-zinc-300">Когда:</b> {t.when}</div>
                  <div className="text-zinc-500"><b className="text-zinc-300">Маркеры:</b> <span className="font-mono text-zinc-400">{t.markers}</span></div>
                  <div className="text-zinc-500"><b className="text-zinc-300">Форма:</b> <span className="font-mono text-zinc-400">{t.form}</span></div>
                  <div className="p-2 bg-black/30 rounded border border-zinc-800 font-mono text-zinc-300">{t.ex}</div>
                  <div className="text-zinc-500">− {t.neg} / ? {t.q}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="bg-zinc-900 border-zinc-800 mb-4">
            <CardHeader><CardTitle className="font-mono text-sm text-emerald-400">+ Present Continuous (по сигналу Look! / now)</CardTitle></CardHeader>
            <CardContent className="text-[13px] text-zinc-400">
              <p className="mb-2">am/is/are + V-ing — действие происходит СЕЙЧАС: <span className="font-mono text-zinc-300">Look! He is playing football.</span></p>
              <p>Маркеры: now, at the moment, Look! Listen!</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle className="font-mono text-sm text-amber-400">12 неправильных глаголов must-know</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {IRREGULARS.map((v) => (
                  <div key={v.v1} className="p-2 bg-black/30 rounded border border-zinc-800 text-center font-mono text-[12px]">
                    <span className="text-zinc-400">{v.v1}</span>
                    <span className="text-zinc-600"> → </span>
                    <span className="text-amber-400">{v.v2}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-cyan-950/10 border-cyan-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-cyan-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: ищи маркер времени</p>
                <p>В задании «вставь форму» 90% ответа — в маркере: yesterday → V2; every day → V/V-s; Look! → is V-ing. Сначала маркер, потом форма.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 2: СТЕПЕНИ СРАВНЕНИЯ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Scale className="text-emerald-400" /> 2. Degrees of Comparison
          </h2>
          <div className="space-y-2 mb-4">
            {COMPARISON.map((c) => (
              <div key={c.rule} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                <span className="text-[13px] text-emerald-400 font-semibold min-w-[180px]">{c.rule}</span>
                <span className="text-[12px] text-zinc-300 font-mono flex-1">{c.ex}</span>
                <span className="text-[11px] text-zinc-600">{c.note}</span>
              </div>
            ))}
          </div>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle className="font-mono text-sm text-rose-400">Неправильные прилагательные</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {IRREGULAR_ADJ.map((a) => (
                  <div key={a.base} className="p-2 bg-black/30 rounded border border-zinc-800 text-center font-mono text-[11px]">
                    <div className="text-zinc-400">{a.base}</div>
                    <div className="text-rose-400">{a.comp}</div>
                    <div className="text-rose-300">{a.sup}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 3: WHO/WHICH + ВОПРОСЫ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Link2 className="text-violet-400" /> 3. Who / Which + типы вопросов
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {RELATIVES.map((r) => (
              <div key={r.word} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
                <div className={cn("font-mono font-bold text-sm mb-2", r.color)}>{r.word}</div>
                <p className="text-[12px] text-zinc-400 font-mono leading-relaxed">{r.use}</p>
              </div>
            ))}
          </div>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle className="font-mono text-sm text-white flex items-center gap-2"><HelpCircle className="w-4 h-4 text-amber-400" /> 5 типов вопросов</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {QUESTIONS.map((q) => (
                  <div key={q.type} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                    <span className="text-[13px] text-amber-400 font-semibold min-w-[170px]">{q.type}</span>
                    <span className="text-[12px] text-zinc-400 font-mono">{q.formula}</span>
                    <span className="text-[12px] text-zinc-600 font-mono">{q.ex}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-violet-950/10 border-violet-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-violet-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: «кто делает?» без do</p>
                <p>Вопрос к подлежащему (Who lives here?) — единственный, где НЕ нужен do/does/did: who само заменяет подлежащее, глагол сразу с -s.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 4: КВИЗ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Brain className="text-cyan-400" /> 4. Quiz: формат ВПР
          </h2>
          <VprQuizInline quiz={QUIZ} />
        </section>

        {/* CTA */}
        <VprCtaTest
          slug="english-6"
          subjectTitle="Английский язык"
          nextHref="/vpr/history/6/cheatsheet"
          nextTitle="История"
          accentShadow="rgba(34,211,238,1)"
        />
      </div>
    </div>
  );
}
