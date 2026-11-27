"use client";

import React, { useState } from "react";
import { ReadProgress } from "@/components/vpr/ReadProgress";
import { VprCtaTest } from "@/components/vpr/VprCtaTest";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  BookOpen, Lightbulb, Brain, Sparkles, Clock, Repeat, HelpCircle, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * task220b: Английский язык — 8 класс. ВПР-8: чтение с пониманием,
 * грамматика (форма слова в скобках), лексика в контексте, письмо.
 * Грамматическое ядро 8 класса (Spotlight/Rainbow): Present Perfect vs
 * Past Simple, Present Perfect Continuous, Passive Voice (все времена),
 * Conditionals 0/1/2, Reported Speech, модальные глаголы долженствования.
 */

// ============ ВРЕМЕНА: Perfect-семейство ============
const TENSES = [
  {
    name: "Present Perfect",
    color: "text-cyan-400",
    form: "have/has + V3",
    when: "результат к настоящему моменту / опыт / новости",
    markers: "already, just, never, ever, yet, recently, since, for",
    ex: "I have just finished my homework.",
  },
  {
    name: "Present Perfect Continuous",
    color: "text-emerald-400",
    form: "have/has been + V-ing",
    when: "действие длилось и ДЛИТСЯ / только что закончилось с видимым следом",
    markers: "for, since, all day, how long",
    ex: "She has been reading for two hours. (и до сих пор / устла)",
  },
  {
    name: "Past Simple vs Present Perfect",
    color: "text-amber-400",
    form: "V2 vs have + V3",
    when: "Past Simple: указано время в прошлом (yesterday, in 2010, ago). Perfect: времени нет / связь с настоящим",
    markers: "yesterday → V2; ever/never → Perfect",
    ex: "I saw him yesterday. ≠ I have seen him. (когда? — неважно, результат)",
  },
];

// ============ PASSIVE VOICE ============
const PASSIVE = [
  { tense: "Present Simple Passive", form: "am/is/are + V3", ex: "English IS SPOKEN in many countries." },
  { tense: "Past Simple Passive", form: "was/were + V3", ex: "The book WAS WRITTEN in 1860." },
  { tense: "Future Simple Passive", form: "will be + V3", ex: "The bridge WILL BE BUILT next year." },
  { tense: "Present Perfect Passive", form: "have/has been + V3", ex: "The letters HAVE BEEN SENT." },
];

// ============ CONDITIONALS ============
const CONDITIONALS = [
  { n: "Zero", formula: "If + Present Simple, Present Simple", when: "всегда правда / законы", ex: "If you heat water to 100°C, it boils." },
  { n: "First", formula: "If + Present Simple, will + V1", when: "реальное будущее условие", ex: "If it rains, we will stay at home." },
  { n: "Second", formula: "If + Past Simple, would + V1", when: "нереальное настоящее/мечта", ex: "If I were you, I would apologise." },
];

// ============ REPORTED SPEECH ============
const REPORTED = [
  { direct: "«I am busy», he said.", reported: "He said (that) he WAS busy.", shift: "am → was (сдвиг времени назад)" },
  { direct: "«We have finished», they said.", reported: "They said they HAD finished.", shift: "have finished → had finished" },
  { direct: "«I will call you».", reported: "He said he WOULD call me.", shift: "will → would" },
  { direct: "«Do you like tea?»", reported: "He asked IF I liked tea.", shift: "общий вопрос → if/whether, прямой порядок слов" },
  { direct: "«Where do you live?»", reported: "She asked WHERE I lived.", shift: "спец. вопрос: Wh + утвердительный порядок" },
];

// ============ МОДАЛЬНЫЕ ============
const MODALS = [
  { m: "must", use: "сильная необходимость (правило, приказ)", neg: "mustn't = запрещено", ex: "You must wear a uniform." },
  { m: "have to", use: "вынужден обстоятельствами", neg: "don't have to = не нужно", ex: "I have to get up early." },
  { m: "should", use: "совет", neg: "shouldn't", ex: "You should see a doctor." },
  { m: "can / could", use: "способность / просьба", neg: "can't", ex: "Could you help me?" },
  { m: "may / might", use: "разрешение / вероятность", neg: "may not", ex: "It might rain." },
];

// ============ КВИЗ ============
const QUIZ = [
  {
    q: "I _____ this film three times already.",
    options: ["saw", "have seen", "see", "had seen"],
    correct: 1,
    hint: "already + результат-опыт → Present Perfect: have + V3.",
  },
  {
    q: "She _____ for the exam since morning — she looks exhausted!",
    options: ["prepares", "prepared", "has been preparing", "is preparing"],
    correct: 2,
    hint: "since morning + видимый результат (устала) → Present Perfect Continuous.",
  },
  {
    q: "The window _____ by the boys yesterday.",
    options: ["was broken", "broke", "is broken", "has broken"],
    correct: 0,
    hint: "yesterday + пассивное значение (окно сломали, а не окно сломало) → Past Simple Passive: was + V3.",
  },
  {
    q: "If it _____ tomorrow, we will stay at home.",
    options: ["will rain", "rains", "rained", "would rain"],
    correct: 1,
    hint: "First Conditional: If + Present Simple (rains), will + V1. Никогда will в if-части!",
  },
  {
    q: "If I were rich, I _____ around the world.",
    options: ["will travel", "travel", "would travel", "travelled"],
    correct: 2,
    hint: "Second Conditional (мечта, нереально): If + Past Simple, would + V1.",
  },
  {
    q: "He said he _____ busy.",
    options: ["is", "was", "will be", "has been"],
    correct: 1,
    hint: "Reported Speech: сдвиг назад — am → was.",
  },
  {
    q: "«Where do you live?» → She asked where…",
    options: ["do I live", "I live", "did I live", "I lived"],
    correct: 3,
    hint: "Wh-вопрос в косвенной речи: прямой порядок слов + сдвиг времени назад (do you live → I lived).",
  },
  {
    q: "You _____ smoke here — it's a hospital!",
    options: ["don't have to", "mustn't", "shouldn't", "needn't"],
    correct: 1,
    hint: "Запрет → mustn't. Don't have to = «не обязательно», это не запрет.",
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
                ? "Grammar engine v8 загружен."
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

export default function EnglishCheatsheet8() {
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
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest">english // 8 класс</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight mb-4">
            English <span className="text-cyan-400">Grade 8</span>
            <span className="block text-xl sm:text-2xl text-zinc-400 font-bold mt-2">Perfect · Passive · Conditionals</span>
          </h1>
          {/* HERO-иллюстрация (task220) */}
          <div className="relative mb-6 overflow-hidden rounded-none border border-cyan-500/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/english-8.jpg"
              alt="English Grade 8 — неоновая иллюстрация"
              className="w-full h-auto opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent" />
          </div>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-2xl">
            Грамматика 8 класса — уровень «взрослого» английского: Perfect-семейство,
            пассивный залог во всех временах, условные предложения и косвенная речь.
            ВПР проверяет именно выбор формы — эта шпаргалка даёт формулу + маркер.
          </p>
          <div className="flex flex-wrap gap-2 mt-6">
            {["3 Perfect-времени", "Passive ×4", "Conditionals ×3", "Reported Speech", "квиз 8"].map((t) => (
              <span key={t} className="px-3 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-[10px] font-mono text-cyan-300/80 uppercase tracking-wider">
                {t}
              </span>
            ))}
          </div>
        </motion.header>

        {/* ============ TOPIC 1: PERFECT ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Clock className="text-cyan-400" /> 1. Perfect-семейство
          </h2>
          <div className="space-y-3">
            {TENSES.map((t) => (
              <Card key={t.name} className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-5">
                  <div className={cn("font-mono font-bold text-sm mb-2", t.color)}>{t.name}</div>
                  <div className="text-[13px] text-zinc-400 mb-2"><b className="text-zinc-300">Форма:</b> <span className="font-mono">{t.form}</span></div>
                  <div className="text-[13px] text-zinc-400 mb-2"><b className="text-zinc-300">Когда:</b> {t.when}</div>
                  <div className="text-[12px] text-zinc-500 font-mono mb-2">маркеры: {t.markers}</div>
                  <div className="p-2 bg-black/30 rounded border border-zinc-800 font-mono text-[12px] text-zinc-300">{t.ex}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="bg-cyan-950/10 border-cyan-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-cyan-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: есть время в прошлом → Past Simple</p>
                <p>Yерsiдe, last week, in 2010, two days ago — железные маркеры Past Simple (V2). Помни: Past Simple + уже никогда Perfect в одном предложении с таким маркером.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 2: PASSIVE ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Repeat className="text-emerald-400" /> 2. Passive Voice
          </h2>
          <p className="text-xs text-zinc-500 mb-4 font-mono">// пассив: важен объект, а не исполнитель (или он неизвестен)</p>
          <div className="space-y-2">
            {PASSIVE.map((p) => (
              <div key={p.tense} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                <span className="text-emerald-400 font-mono font-semibold text-[12px] min-w-[210px]">{p.tense}</span>
                <span className="text-white font-mono text-[12px] min-w-[150px]">{p.form}</span>
                <span className="text-zinc-500 font-mono text-[12px]">{p.ex}</span>
              </div>
            ))}
          </div>
          <Card className="bg-emerald-950/10 border-emerald-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-emerald-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: «кем? чем?» = by/with</p>
                <p>The novel was written BY Tolstoy (исполнитель). The sand castle was made WITH a bucket (инструмент). Формула времени берётся из активного предложения, дальше be + V3.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 3: CONDITIONALS ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <HelpCircle className="text-amber-400" /> 3. Conditionals
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {CONDITIONALS.map((c, i) => (
              <motion.div
                key={c.n}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl"
              >
                <div className="text-amber-400 font-bold text-sm mb-2">{c.n} Conditional</div>
                <div className="text-[12px] font-mono text-zinc-300 mb-2">{c.formula}</div>
                <div className="text-[11px] text-zinc-500 mb-2">{c.when}</div>
                <div className="text-[11px] text-zinc-600 font-mono">{c.ex}</div>
              </motion.div>
            ))}
          </div>
          <Card className="bg-amber-950/10 border-amber-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-amber-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: никакого will после if</p>
                <p>If it WILL rain — грубейшая ошибка. В if-части только Present Simple (или Past Simple во 2-м типе). will/would — только во второй части предложения.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 4: REPORTED + MODALS ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <MessageSquare className="text-rose-400" /> 4. Reported Speech + модальные
          </h2>
          <Card className="bg-zinc-900 border-zinc-800 mb-4">
            <CardHeader><CardTitle className="font-mono text-sm text-white">Косвенная речь: сдвиг назад</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {REPORTED.map((r) => (
                <div key={r.direct} className="p-3 bg-black/30 rounded border border-zinc-800">
                  <div className="text-zinc-500 font-mono text-[12px] mb-1">{r.direct}</div>
                  <div className="text-rose-300 font-mono text-[12px] mb-1">→ {r.reported}</div>
                  <div className="text-zinc-600 text-[10px]">{r.shift}</div>
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-zinc-800 text-left">
                  <th className="py-2 pr-4 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Модальный</th>
                  <th className="py-2 pr-4 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Значение</th>
                  <th className="py-2 pr-4 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Отрицание</th>
                  <th className="py-2 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Пример</th>
                </tr>
              </thead>
              <tbody>
                {MODALS.map((m) => (
                  <tr key={m.m} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                    <td className="py-2.5 pr-4 text-rose-400 font-mono font-bold">{m.m}</td>
                    <td className="py-2.5 pr-4 text-zinc-300">{m.use}</td>
                    <td className="py-2.5 pr-4 text-zinc-500 font-mono text-[12px]">{m.neg}</td>
                    <td className="py-2.5 text-zinc-500 font-mono text-[12px]">{m.ex}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Card className="bg-rose-950/10 border-rose-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-rose-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: mustn't ≠ don't have to</p>
                <p>Топ-ловушка ВПР: mustn't = ЗАПРЕЩЕНО (You mustn't smoke), don't have to = НЕ ОБЯЗАН, можно не делать (You don't have to come early). Противоположные смыслы!</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 5: КВИЗ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Brain className="text-cyan-400" /> 5. Quiz: формат ВПР
          </h2>
          <VprQuizInline quiz={QUIZ} />
        </section>

        {/* CTA */}
        <VprCtaTest
          slug="english-8"
          subjectTitle="Английский язык"
          nextHref="/vpr/socialstudies/8/cheatsheet"
          nextTitle="Обществознание"
          accentShadow="rgba(34,211,238,1)"
        />
      </div>
    </div>
  );
}
