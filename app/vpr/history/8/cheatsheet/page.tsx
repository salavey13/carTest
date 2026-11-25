"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Landmark, BookOpen, Lightbulb, Brain, Code, Sparkles,
  CheckCircle2, XCircle, Crown, Factory, Scroll, Train, Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- ТИМЛАЙН: ХРОНОЛОГИЯ XIX ВЕКА ---
const TIMELINE = [
  { year: "1801", event: "Взойдение Александра I на престол", detail: "После убийства Павла I. «Негласный комитет» и либеральные начинания" },
  { year: "1812", event: "Отечественная война", detail: "Бородино (сентябрь), совет в Филях, пожар Москвы, гибель армии Наполеона" },
  { year: "1825", event: "Восстание декабристов", detail: "14 декабря, Сенатская площадь. Программы: «Конституция» Муравьёва и «Русская правда» Пестеля" },
  { year: "1837", event: "Открытие первой железной дороги", detail: "Петербург — Царское Село. Начало индустриализации" },
  { year: "1861", event: "Отмена крепостного права", detail: "Манифест 19 февраля. Александр II — «Царь-Освободитель». Временнообязанные и выкупные платежи" },
  { year: "1864", event: "Земская и судебная реформы", detail: "Выборные земства, гласный состязательный суд, присяжные заседатели" },
  { year: "1881", event: "Убийство Александра II", detail: "1 марта, народовольцы. Конец реформ, контрреформы Александра III" },
];

// --- КВИЗ: ЛИЧНОСТИ И СОБЫТИЯ ---
const HISTORY_QUIZ = [
  {
    q: "Кто возглавлял Южное общество декабристов и разработал «Русскую правду»?",
    options: ["Пестель", "Муравьёв", "Рылеев", "Пушкин"],
    correct: 0,
    hint: "Автор радикальной программы — республика, ликвидация самодержавия и крепостничества",
  },
  {
    q: "Что такое «временнообязанные крестьяне» после 1861 года?",
    options: ["Крестьяне, продолжавшие нести повинности до полного выкупа земли", "Крестьяне, сразу получившие землю бесплатно", "Городские рабочие", "Разряд казаков"],
    correct: 0,
    hint: "До заключения выкупной сделки крестьяне обязаны были платить оброк и отбывать барщину",
  },
  {
    q: "Какая реформа была проведена в 1874 году?",
    options: ["Военная (всеобщая повинность вместо рекрутчины)", "Судебная", "Земская", "Финансовая"],
    correct: 0,
    hint: "Служить стали все мужчины с 21 года, жребий определял срок — 6 лет",
  },
  {
    q: "Кто такой С. Ю. Витте?",
    options: ["Министр финансов, индустриализация и золотой рубль", "Народоволец, убивший Александра II", "Герой войны 1812 года", "Автор судебной реформы"],
    correct: 0,
    hint: "Его реформа денежного обращения (1897) ввела золотое обеспечение рубля",
  },
  {
    q: "Что произошло 1 марта 1881 года?",
    options: ["Убийство Александра II народовольцами", "Отмена крепостного права", "Бородинское сражение", "Восстание декабристов"],
    correct: 0,
    hint: "Взрыв на набережной Екатерининского канала — царь-реформатор погиб от второй бомбы",
  },
];

export default function History8Cheatsheet() {
  const [timelineIdx, setTimelineIdx] = useState(0);
  const [quizIdx, setQuizIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  const current = HISTORY_QUIZ[quizIdx];
  const ev = TIMELINE[timelineIdx];

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-300 font-sans p-4 md:p-8 selection:bg-brand-yellow/30 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "30px 30px" }}
      />

      <div className="max-w-4xl mx-auto relative z-10">
        {/* HEADER */}
        <header className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-1.5 rounded-full text-xs font-medium mb-6"
          >
            <Sparkles className="w-4 h-4 text-brand-yellow" />
            <span>Помощник по Истории • 8 класс • XIX век</span>
          </motion.div>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
            Chrono <span className="text-brand-yellow">Archive</span>
          </h1>
          <p className="text-zinc-500 text-lg">Россия XIX века: от Бородино до индустриализации. Всё — по полочкам.</p>
        </header>

        {/* TOPIC 0: ТИМЛАЙН (пошаговый) */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Scroll className="text-blue-400" /> 0. Хронология: семь вех века
          </h2>
          <Card className="bg-zinc-900/50 border-blue-500/30 mb-6">
            <CardHeader className="border-b border-blue-500/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <Landmark className="w-5 h-5 text-blue-400" /> Веха {timelineIdx + 1} из {TIMELINE.length}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="mb-6 p-4 bg-black border border-blue-500/20 rounded-xl">
                <div className="text-center mb-2">
                  <span className="text-3xl font-black text-brand-yellow font-mono">{ev.year}</span>
                </div>
                <div className="text-lg font-bold text-center text-white mb-2">{ev.event}</div>
                <div className="text-sm text-center text-zinc-400">{ev.detail}</div>
              </div>
              <div className="flex justify-between items-center">
                <Button onClick={() => setTimelineIdx((p) => Math.max(p - 1, 0))} disabled={timelineIdx === 0} variant="outline" size="sm" className="border-blue-500/30 text-blue-400">
                  ← Назад
                </Button>
                <div className="flex gap-1.5">
                  {TIMELINE.map((_, idx) => (
                    <div key={idx} className={cn("w-2 h-2 rounded-full transition-all", idx === timelineIdx ? "bg-brand-yellow" : "bg-zinc-700")} />
                  ))}
                </div>
                <Button onClick={() => setTimelineIdx((p) => Math.min(p + 1, TIMELINE.length - 1))} disabled={timelineIdx === TIMELINE.length - 1} variant="outline" size="sm" className="border-blue-500/30 text-blue-400">
                  Дальше →
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* TOPIC 1: ВОЙНА 1812 */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Flag className="text-red-400" /> 1. Отечественная война 1812
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-red-400">Причины и итоги</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div>• Континентальная блокада Англии разоряла дворян</div>
                <div>• Итог: гибель Великой армии, заграничные походы 1813–14, взятие Парижа</div>
                <div className="text-zinc-500 text-xs">Заграничный поход → создание «Священного союза» (1815)</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-red-400">Герои наизусть</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div>• Кутузов — главнокомандующий, стратегия «змей»</div>
                <div>• Багратион — левый фланг Бородина</div>
                <div>• Барклай-де-Толли — тактика отступления и Тарутинский манёвр</div>
                <div>• Наполеон — «армия двунадесяти языков», 600 000 солдат</div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* TOPIC 2: ДЕКАБРИСТЫ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Crown className="text-violet-400" /> 2. Декабристы: две программы
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="p-5 bg-zinc-900 border border-violet-500/20 rounded-xl">
              <div className="font-black text-white mb-2">«Конституция» Н. Муравьёва</div>
              <div className="text-sm text-zinc-400 space-y-1.5">
                <div>• Конституционная монархия</div>
                <div>• Федеративное устройство (13 держав + 2 области)</div>
                <div>• Земля — крестьянам по 2 десятины, помещикам — остальное</div>
              </div>
            </div>
            <div className="p-5 bg-zinc-900 border border-violet-500/20 rounded-xl">
              <div className="font-black text-white mb-2">«Русская правда» П. Пестеля</div>
              <div className="text-sm text-zinc-400 space-y-1.5">
                <div>• Республика, однопалатный парламент — Народное вече</div>
                <div>• Единая неделимая держава</div>
                <div>• Земля делится: общественная (нельзя продать) + частная</div>
              </div>
            </div>
          </div>
          <div className="p-4 bg-yellow-900/10 border border-brand-yellow/20 rounded-xl flex items-start gap-3">
            <Lightbulb className="text-brand-yellow w-8 h-8 shrink-0" />
            <div className="text-sm">
              <p className="font-bold text-white mb-1">Почему проиграли 14 декабря 1825?</p>
              <p>Восставшие простояли на Сенатской площади до сумерек без вождей (Трубецкой не явился), без плана действий и поддержки горожан. «Союз спасения» → «Союз благоденствия» → Северное и Южное общества — путь организаций знаешь — знаешь ответ на вопрос «движение декабристов».</p>
            </div>
          </div>
        </section>

        {/* TOPIC 3: РЕФОРМЫ АЛЕКСАНДРА II */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Factory className="text-green-400" /> 3. Великие реформы 1860–70-х
          </h2>
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-sm font-mono space-y-3">
            <div className="text-zinc-500">// Даты реформ — машина для памяти:</div>
            <div className="text-white pl-4"><span className="text-green-400">1861</span> — крестьяне (Манифест 19 февраля)</div>
            <div className="text-white pl-4"><span className="text-green-400">1863</span> — университетская (автономия)</div>
            <div className="text-white pl-4"><span className="text-green-400">1864</span> — земская + судебная (один год!)</div>
            <div className="text-white pl-4"><span className="text-green-400">1870</span> — городская (думы)</div>
            <div className="text-white pl-4"><span className="text-green-400">1874</span> — военная (всеобщая повинность)</div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-green-400">Судебная реформа 1864</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1.5">
                <div>• Гласность, состязательность (прокурор ↔ адвокат)</div>
                <div>• Присяжные заседатели — судебные уставы</div>
                <div>• Мировые суды для крестьянских дел</div>
                <div>• «Ловушка»: для крестьян оставался волостной суд</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-green-400">Суть реформы 1861</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1.5">
                <div>• Лично свободны, но земля — за выкуп (25 лет, 6%)</div>
                <div>• Отрезки: крестьяне потеряли ~20% наделов</div>
                <div>• Временнообязанное состояние до выкупа</div>
                <div>• Община — круговая порука и переделы</div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* TOPIC 4: КВИЗ */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <BookOpen className="text-brand-yellow" /> 4. Проверь себя
          </h2>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs text-zinc-500">
                  Вопрос {quizIdx + 1} из {HISTORY_QUIZ.length}
                </span>
                <span className="text-xs font-bold text-brand-yellow">Счёт: {score}</span>
              </div>
              <div className="text-lg font-bold text-white mb-6">{current.q}</div>
              <div className="space-y-2 mb-4">
                {current.options.map((opt, i) => (
                  <button
                    key={opt}
                    onClick={() => {
                      if (picked !== null) return;
                      setPicked(i);
                      if (i === current.correct) setScore((s) => s + 1);
                    }}
                    className={cn(
                      "w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all",
                      picked === null
                        ? "bg-zinc-800/50 border-zinc-700 hover:border-brand-yellow/50 hover:bg-zinc-800"
                        : i === current.correct
                          ? "border-green-500 text-green-400 bg-green-500/5"
                          : i === picked
                            ? "border-red-500 text-red-400 bg-red-500/5"
                            : "bg-zinc-800/30 border-zinc-800 text-zinc-500",
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {picked !== null && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-zinc-400 mb-4">
                  {picked === current.correct ? "✓ Верно! " : "✗ "}
                  {current.hint}
                </motion.div>
              )}
              <Button
                onClick={() => {
                  setQuizIdx((i) => Math.min(i + 1, HISTORY_QUIZ.length - 1));
                  setPicked(null);
                }}
                disabled={picked === null || quizIdx === HISTORY_QUIZ.length - 1}
                size="sm"
                className="bg-brand-yellow text-black font-bold"
              >
                Далее →
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* CTA */}
        <div className="bg-white text-black p-8 rounded-none mb-20 flex flex-col md:flex-row items-center gap-8 shadow-[10px_10px_0_rgba(234,179,8,1)]">
          <div className="w-20 h-20 bg-brand-yellow flex items-center justify-center rounded-full shrink-0">
            <Code className="w-10 h-10 text-black" />
          </div>
          <div>
            <h3 className="text-2xl font-black uppercase mb-2">Как создана эта страница?</h3>
            <p className="text-zinc-700 text-sm leading-relaxed mb-6">
              Эта «шпаргалка» была полностью написана искусственным интеллектом в нашей <b>SuperVibe Studio</b>.
              История учит видеть причинно-следственные связи — тот же скилл, что нужен аналитику данных и разработчику.
            </p>
            <div className="flex gap-4">
              <Link href="/repo-xml">
                <Button className="bg-black text-white hover:bg-zinc-800 font-bold px-6 py-4 rounded-none uppercase text-xs tracking-widest">
                  Попробовать Вайб-Кодинг
                </Button>
              </Link>
              <Link href="/vpr-tests">
                <Button variant="outline" className="border-black text-black font-bold px-6 py-4 rounded-none uppercase text-xs tracking-widest">
                  Все ВПР-тесты
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <footer className="text-center pb-20 text-zinc-700 text-[10px] font-mono uppercase tracking-widest">
          Generated with AI in CyberVibe Studio // 8th Grade History: XIX century // No copyright, just Vibe.
        </footer>
      </div>
    </div>
  );
}
