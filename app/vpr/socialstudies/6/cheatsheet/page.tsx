"use client";

import React, { useState } from "react";
import { ReadProgress } from "@/components/vpr/ReadProgress";
import { VprCtaTest } from "@/components/vpr/VprCtaTest";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Users, BookOpen, Lightbulb, Brain, Sparkles, User, Family,
  Activity, GraduationCap, Home,
} from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * task220: Обществознание — 6 класс. По описанию КИМ ВПР (ФИОКО, 2025):
 * 8 заданий — 2 с кратким ответом (комбинация цифр: выбор верных суждений,
 * соответствие) и 6 развёрнутых. Содержательные блоки 6 класса: человек
 * (биосоциальное существо, деятельность, познание), межличностные отношения
 * и семья, малые группы, общество. Упор — на понятия и определения (как
 * просил босс в task219 для истории: меньше дат, больше определений).
 */

// ============ ПОНЯТИЯ (формат «запишите термин») ============
const TERMS = [
  { def: "Существо, объединяющее биологическую природу (инстинкты, потребности тела) и социальную сущность (речь, сознание, деятельность)", term: "человек", tag: "человек" },
  { def: "Вид активности человека, направленный на достижение сознательной цели, создание полезного результата", term: "деятельность", tag: "деятельность" },
  { def: "Процесс получения знаний о мире — чувственный (ощущения) и рациональный (мышление)", term: "познание", tag: "познание" },
  { def: "Осознаваемая нужда человека в том, что необходимо для его существования и развития", term: "потребность", tag: "человек" },
  { def: "То, к чему стремится человек, планируя свою деятельность; идеальный образ будущего результата", term: "цель", tag: "деятельность" },
  { def: "Небольшая группа людей, объединённых общими делами, близким общением (семья, класс, компания друзей)", term: "малая группа", tag: "общество" },
  { def: "Обмен информацией, мыслями, чувствами между людьми с помощью языка и знаков", term: "общение", tag: "общество" },
  { def: "Малая группа, основанная на браке или кровном родстве, члены которой ведут общее хозяйство и связаны взаимной заботой", term: "семья", tag: "семья" },
  { def: "Правила поведения, сложившиеся в обществе как результат длительного опыта, передающиеся из поколения в поколение", term: "традиции", tag: "семья" },
  { def: "Время, остающееся у человека после обязательных дел (учёба, работа), которое он тратит по своему выбору", term: "свободное время (досуг)", tag: "человек" },
  { def: "Индивидуальные устойчивые свойства личности, проявляющиеся в поведении и отношении к людям и делу", term: "черты характера", tag: "человек" },
  { def: "Оценка человеком самого себя: своих качеств, возможностей, места среди людей", term: "самооценка", tag: "познание" },
];

// ============ ВИДЫ ДЕЯТЕЛЬНОСТИ (классика заданий «установи соответствие») ============
const ACTIVITIES = [
  { icon: Activity, name: "труд", desc: "создание полезных материальных и духовных ценностей (постройка дома, написание книги)", ex: "доярка доит корову" },
  { icon: BookOpen, name: "учение (познание)", desc: "получение и усвоение знаний о мире", ex: "шестиклассник делает домашку" },
  { icon: Users, name: "общение", desc: "обмен информацией и эмоциями между людьми", ex: "друзья обсуждают фильм" },
  { icon: Sparkles, name: "игра", desc: "деятельность ради удовольствия и отдыха, моделирует реальные ситуации", ex: "дети играют в «дочки-матери»" },
];

// ============ СЕМЬЯ (билет «семья и семейные традиции») ============
const FAMILY_TYPES = [
  { name: "нуклеарная (простая)", desc: "родители + дети (одно-два поколения)", ex: "мама, папа, сын" },
  { name: "расширенная (многопоколенная)", desc: "несколько поколений живёт вместе", ex: "бабушка + родители + дети" },
  { name: "полная", desc: "оба родителя", ex: "—" },
  { name: "неполная", desc: "один родитель с детьми", ex: "мама + дочь" },
];

const FAMILY_ROLES = [
  { role: "репродуктивная", what: "рождение и воспитание детей — продолжение рода" },
  { role: "хозяйственная", what: "ведение общего хозяйства, быт" },
  { role: "воспитательная", what: "передача детям норм, традиций, опыта" },
  { role: "эмоциональная", what: "поддержка, забота, чувство защищённости" },
  { role: "социального статуса", what: "семья даёт имя, гражданство, стартовые возможности" },
];

// ============ САМОПОЗНАНИЕ: этапы деятельности ============
const STAGES = [
  { n: 1, name: "цель", desc: "что я хочу получить? (создание плана в голове)" },
  { n: 2, name: "средства", desc: "что мне для этого нужно? (инструменты, знания)" },
  { n: 3, name: "действие", desc: "выполнение задуманного" },
  { n: 4, name: "результат", desc: "сравнение полученного с целью" },
];

// ============ КВИЗ ============
const QUIZ = [
  {
    q: "Запишите термин: «Вид активности человека, направленный на достижение сознательно поставленной цели»",
    options: ["инстинкт", "деятельность", "общение", "поведение"],
    correct: 1,
    hint: "Три признака деятельности: сознательная цель + создание результата + план/средства. Инстинкт — это про животных.",
  },
  {
    q: "Человек — существо…",
    options: ["биологическое", "социальное", "биосоциальное", "духовное"],
    correct: 2,
    hint: "Двойная природа: тело и инстинкты — от биологии; речь, мышление, деятельность — от общества.",
  },
  {
    q: "Шестиклассник делает уроки. Это вид деятельности:",
    options: ["труд", "игра", "учение", "общение"],
    correct: 2,
    hint: "Учение = усвоение знаний. Хоть оценка «работы» и похожа на труд, цель — знания, а не продукт.",
  },
  {
    q: "Какое слово пропущено: «малая группа, основанная на браке или кровном родстве, члены которой ведут общее хозяйство» — это …",
    options: ["класс", "семья", "народ", "государство"],
    correct: 1,
    hint: "Три признака семьи: брак/родство + общее хозяйство + взаимная забота и поддержка.",
  },
  {
    q: "Правильная последовательность этапов деятельности:",
    options: [
      "цель → средства → действие → результат",
      "средства → цель → результат → действие",
      "действие → цель → средства → результат",
      "результат → цель → средства → действие",
    ],
    correct: 0,
    hint: "Сначала ЗАДУМАЛ (цель), потом нашёл инструменты, потом СДЕЛАЛ, потом сравнил с замыслом.",
  },
  {
    q: "Время, которое остаётся у человека после обязательных дел и которое он тратит по собственному выбору, называется:",
    options: ["рабочим", "свободным (досуг)", "учебным", "календарным"],
    correct: 1,
    hint: "Досуг = «моё» время: хобби, спорт, встречи с друзьями, чтение по желанию.",
  },
  {
    q: "Что из перечисленного — функция семьи?",
    options: [
      "сбор налогов",
      "рождение и воспитание детей",
      "защита государственных границ",
      "выпуск денег",
    ],
    correct: 1,
    hint: "Репродуктивная функция — продолжение рода. Налоги и границы — функции государства.",
  },
  {
    q: "Устойчивые правила поведения, передающиеся из поколения в поколение, — это:",
    options: ["законы", "традиции", "инстинкты", "рефлексы"],
    correct: 1,
    hint: "Законы пишет государство, традиции складываются исторически сами (как праздновать Новый год в семье).",
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
            <Brain className="w-5 h-5 text-blue-400" /> Вопрос {Math.min(idx + 1, order.length)}/{order.length}
          </span>
          <span className="text-xs font-mono text-zinc-500">счёт: {score}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!done ? (
          <>
            <p className="text-sm sm:text-base font-bold text-white mb-5 leading-relaxed">{q.q}</p>
            <div className="grid grid-cols-1 gap-2.5">
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
                      "justify-start text-left normal-case text-[13px] font-medium",
                      picked !== null && isRight && "border-green-500 bg-green-950/40 text-green-300",
                      picked !== null && isPicked && !isRight && "border-red-500 bg-red-950/40 text-red-300",
                      picked === null && "border-zinc-700 hover:border-blue-500/50"
                    )}
                  >
                    <span className="font-mono text-zinc-600 mr-2">{String.fromCharCode(65 + oi)}</span>
                    {opt}
                  </Button>
                );
              })}
            </div>
            {picked !== null && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
                <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                  {picked === q.correct ? "✓ Верно. " : "✗ Неверно. "}
                  {q.hint}
                </p>
                <Button
                  onClick={() => { setIdx(idx + 1); setPicked(null); }}
                  className="bg-blue-500 hover:bg-blue-400 text-white font-bold"
                >
                  {idx === order.length - 1 ? "Итоги" : "Дальше"} <Sparkles className="w-4 h-4 ml-1" />
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
                ? "Обществоведческий протокол загружен."
                : "Перечитай понятия выше и вернись: feed → fight → fail → repeat."}
            </p>
            <Button
              variant="outline"
              onClick={() => { setIdx(0); setPicked(null); setScore(0); setOrder(quiz.map((_, i) => i).sort(() => Math.random() - 0.5)); }}
              className="border-zinc-600 text-zinc-300"
            >
              Пройти снова
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SocialStudiesCheatsheet6() {
  return (
    <div className="min-h-screen bg-[#030712] text-zinc-200 relative">
      <ReadProgress />
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

        {/* ============ HEADER + HERO ============ */}
        <motion.header initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-14">
          <div className="flex items-center gap-2 mb-4">
            <Link href="/vpr-tests" className="text-xs font-mono text-zinc-500 hover:text-blue-400 transition-colors uppercase tracking-widest">
              ← VPR_tests
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="text-xs font-mono text-blue-400 uppercase tracking-widest">обществознание // 6 класс</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight mb-4">
            Обществознание <span className="text-blue-400">6 класса</span>
            <span className="block text-xl sm:text-2xl text-zinc-400 font-bold mt-2">Человек · Деятельность · Семья</span>
          </h1>
          {/* HERO-иллюстрация (task220) */}
          <div className="relative mb-6 overflow-hidden rounded-none border border-blue-500/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/socialstudies-6.jpg"
              alt="Обществознание 6 класс — неоновая иллюстрация"
              className="w-full h-auto opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent" />
          </div>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-2xl">
            ВПР по обществознанию в 6 классе — 8 заданий: выбор верных суждений, соответствия
            и развёрнутые ответы-рассуждения. Ядро курса — сам человек: его потребности,
            деятельность и познание, малые группы и семья. Всё построено на понятиях и определениях.
          </p>
          <div className="flex flex-wrap gap-2 mt-6">
            {["12 понятий", "4 вида деятельности", "5 функций семьи", "квиз 8 вопросов"].map((t) => (
              <span key={t} className="px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 text-[10px] font-mono text-blue-300/80 uppercase tracking-wider">
                {t}
              </span>
            ))}
          </div>
        </motion.header>

        {/* ============ TOPIC 1: ПОНЯТИЯ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <BookOpen className="text-blue-400" /> 1. Понятия курса: термин по определению
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TERMS.map((t, i) => (
              <motion.div
                key={t.term}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 4) * 0.05 }}
                className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-blue-500/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-400 font-bold font-mono text-sm">{t.term}</span>
                  <span className="text-[9px] uppercase tracking-wider text-zinc-600 font-mono">{t.tag}</span>
                </div>
                <p className="text-[13px] text-zinc-400 leading-relaxed">{t.def}</p>
              </motion.div>
            ))}
          </div>
          <Card className="bg-blue-950/10 border-blue-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-blue-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак:definitions-формат ВПР</p>
                <p>В развёрнутых заданиях ВПР просится не список слов, а рассуждение: определение → пример → вывод. Увидел «объясните, почему…» — строй ответ по этой схеме, и минимум 2 из 2 баллов твои.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 2: ВИДЫ ДЕЯТЕЛЬНОСТИ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Activity className="text-emerald-400" /> 2. Четыре вида деятельности
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ACTIVITIES.map((a, i) => (
              <motion.div
                key={a.name}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="bg-zinc-900 border-zinc-800 h-full">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <a.icon className="w-6 h-6 text-emerald-400" />
                      <h3 className="text-base font-bold text-white">{a.name}</h3>
                    </div>
                    <p className="text-[13px] text-zinc-400 leading-relaxed mb-2">{a.desc}</p>
                    <p className="text-[12px] text-emerald-300/70 font-mono">пример: {a.ex}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
          <Card className="bg-emerald-950/10 border-emerald-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-emerald-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: спроси «зачем?»</p>
                <p>Зачем человек это делает? Создать продукт → труд. Узнать новое → учение. Обменяться информацией → общение. Ради удовольствия, «понарошку» → игра.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 3: ЭТАПЫ ДЕЯТЕЛЬНОСТИ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <GraduationCap className="text-amber-400" /> 3. Структура деятельности
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STAGES.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center"
              >
                <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-mono font-bold text-sm">
                  {s.n}
                </div>
                <div className="text-white font-bold text-sm mb-1">{s.name}</div>
                <div className="text-[11px] text-zinc-500 leading-snug">{s.desc}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ============ TOPIC 4: СЕМЬЯ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Family className="text-rose-400" /> 4. Семья: типы и функции
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader><CardTitle className="text-sm text-white font-mono">ТИПЫ СЕМЬИ</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {FAMILY_TYPES.map((t) => (
                  <div key={t.name} className="text-[13px]">
                    <span className="text-rose-400 font-semibold">{t.name}</span>
                    <span className="text-zinc-500"> — {t.desc}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader><CardTitle className="text-sm text-white font-mono">ФУНКЦИИ СЕМЬИ</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {FAMILY_ROLES.map((t) => (
                  <div key={t.role} className="text-[13px]">
                    <span className="text-rose-400 font-semibold">{t.role}</span>
                    <span className="text-zinc-500"> — {t.what}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          <Card className="bg-rose-950/10 border-rose-500/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Home className="text-rose-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: «два поколения» в задании</p>
                <p>В заданиях ВПР часто описывают семью по списку членов. Считай поколения: однопоколенная (супруги) → простая; три и больше (внуки+родители+бабушки) → расширенная.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 5: КВИЗ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Brain className="text-blue-400" /> 5. Квиз: формат ВПР
          </h2>
          <VprQuizInline quiz={QUIZ} />
        </section>

        {/* CTA */}
        <VprCtaTest
          slug="socialstudies-6"
          subjectTitle="Обществознание"
          nextHref="/vpr/english/6/cheatsheet"
          nextTitle="Английский язык"
          accentShadow="rgba(59,130,246,1)"
        />
      </div>
    </div>
  );
}
