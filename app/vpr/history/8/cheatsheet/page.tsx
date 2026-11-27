"use client";

import React, { useState } from "react";
import { ReadProgress } from "@/components/vpr/ReadProgress";
import { VprCtaTest } from "@/components/vpr/VprCtaTest";
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
// Семестр I (1-е полугодие 8 класса): Александр I → декабристы → Николай I → Крымская война
// Семестр II: великие реформы Александра II и далее
const TIMELINE = [
  { year: "1801", event: "Взойдение Александра I на престол", detail: "После убийства Павла I. «Негласный комитет» и либеральные начинания", semester: 1 },
  { year: "1812", event: "Отечественная война", detail: "Бородино (сентябрь), совет в Филях, пожар Москвы, гибель армии Наполеона", semester: 1 },
  { year: "1825", event: "Восстание декабристов", detail: "14 декабря, Сенатская площадь. Программы: «Конституция» Муравьёва и «Русская правда» Пестеля", semester: 1 },
  { year: "1837", event: "Первая железная дорога", detail: "Петербург — Царское Село. Кодификация Сперанского, теория «официальной народности» Уварова", semester: 1 },
  { year: "1853–56", event: "Крымская война", detail: "Синоп, оборона Севастополя (349 дней), Парижский мир. Поражение = толчок к реформам", semester: 1 },
  { year: "1861", event: "Отмена крепостного права", detail: "Манифест 19 февраля. Александр II — «Царь-Освободитель». Временнообязанные и выкупные платежи", semester: 2 },
  { year: "1864", event: "Земская и судебная реформы", detail: "Выборные земства, гласный состязательный суд, присяжные заседатели", semester: 2 },
  { year: "1881", event: "Убийство Александра II", detail: "1 марта, народовольцы. Конец реформ, контрреформы Александра III", semester: 2 },
];

// --- КВИЗ: ЛИЧНОСТИ И СОБЫТИЯ (фокус 1-го полугодия) ---
const HISTORY_QUIZ = [
  {
    q: "Кто возглавлял Южное общество декабристов и разработал «Русскую правду»?",
    options: ["Пестель", "Муравьёв", "Рылеев", "Пушкин"],
    correct: 0,
    hint: "Автор радикальной программы — республика, ликвидация самодержавия и крепостничества",
  },
  {
    q: "«Теория официальной народности» Уварова — это формула:",
    options: ["Православие, самодержавие, народность", "Свобода, равенство, братство", "Москва — третий Рим", "Бог, царь и Отечество в законе"],
    correct: 0,
    hint: "Идеология эпохи Николая I (1830-е): религия + власть + народ как три опоры государства",
  },
  {
    q: "Кто руководил кодификацией законов при Николае I?",
    options: ["М. М. Сперанский", "А. А. Аракчеев", "С. С. Уваров", "П. Д. Киселёв"],
    correct: 0,
    hint: "Полное собрание законов (1830) и Свод законов (1832) — итог его работы",
  },
  {
    q: "Оборона Севастополя в Крымской войне длилась:",
    options: ["349 дней", "100 дней", "2 месяца", "3 года"],
    correct: 0,
    hint: "Сентябрь 1854 — август 1855. Позиции на Малаховом кургане, адмиралы Нахимов, Корнилов, Истомин",
  },
  {
    q: "Что стало главным итогом Крымской войны для России?",
    options: ["Поражение и толчок к великим реформам Александра II", "Победа и присоединение Крыма", "Присоединение Прибалтики", "Отмена крепостного права в 1856"],
    correct: 0,
    hint: "Парижский мир 1856 г. лишил России флота на Чном море; военная отсталость заставила модернизироваться",
  },
  {
    q: "Синопское сражение (1853) — чем знаменито?",
    options: ["Последней крупной победой парусного флота (Нахимов)", "Первым применением танков", "Гибелью Нельсона", "Высадкой в Крыму"],
    correct: 0,
    hint: "Нахимов разгромил турецкую эскадру в Синопской бухте; Англия и Франция тут же вступили в войну",
  },
  {
    q: "Идейное течение 1830–40-х: «самобытный путь» России vs «учись у Европы»?",
    options: ["Славянофилы vs западники", "Декабристы vs масоны", "Народники vs марксисты", "Консерваторы vs либералы"],
    correct: 0,
    hint: "Спор о путях развития: славянофилы (Хомяков, Аксаков) — община и вера; западники (Грановский, Герцен) — европейский путь",
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
      <ReadProgress />
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "30px 30px" }}
      />

      <div className="max-w-4xl mx-auto relative z-10">
        {/* HERO BAND */}
        <div className="relative mb-10 rounded-2xl overflow-hidden border border-yellow-500/20 h-48 md:h-64 shadow-[0_0_40px_rgba(234,179,8,0.08)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task212/history-hero.jpg"
            alt="Неоновый XIX век: бронзовые всадники"
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-[#030303]/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-brand-yellow mb-1">Chrono Archive // 8 класс</div>
            <div className="text-white font-black text-2xl md:text-4xl drop-shadow-lg">XIX век: от Бородино до реформ</div>
          </div>
        </div>

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
          {/* HERO-иллюстрация (task220) */}
          <div className="relative mb-6 overflow-hidden rounded-none border" style={{ borderColor: "#eab30833" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/history-8.jpg"
              alt="История России 8 класс — неоновая иллюстрация"
              className="w-full h-auto opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent" />
          </div>
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
                <div className="text-center mb-2 flex items-center justify-center gap-3">
                  <span className="text-3xl font-black text-brand-yellow font-mono">{ev.year}</span>
                  <span className={cn(
                    "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border",
                    ev.semester === 1 ? "text-orange-400 border-orange-500/30 bg-orange-950/40" : "text-zinc-400 border-zinc-700 bg-zinc-900",
                  )}>
                    {ev.semester === 1 ? "I полугодие" : "II полугодие"}
                  </span>
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
            <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-full">1-е полугодие</span>
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

        {/* TOPIC 2.5: НИКОЛАЙ I И КРЫМСКАЯ (ядро 1-го полугодия) */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Train className="text-orange-400" /> 2.5. Николай I и Крымская война
            <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-orange-400/80 bg-orange-950/40 border border-orange-500/20 px-2 py-1 rounded-full">1-е полугодие</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-orange-400">Эпоха Николая I (1825–1855)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1.5">
                <div>• Кодификация законов — Сперанский (Свод, 1832)</div>
                <div>• III Отделение — политическая полиция Бенкендорфа</div>
                <div>• Теория официальной народности Уварова: православие, самодержавие, народность</div>
                <div>• Реформа гос. крестьян Киселёва, цензурный устав «чугунный»</div>
                <div>• Славянофилы vs западники — спор о пути России</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-orange-400">Крымская война (1853–1856)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1.5">
                <div>• Причина: спор о «палестинских святынях» и проливах</div>
                <div>• Синоп (ноябрь 1853) — последняя победа парусного флота, Нахимов</div>
                <div>• Оборона Севастополя — 349 дней, Малахов курган</div>
                <div>• Герои: Нахимов, Корнилов, Истомин, матрос Пётр Кошка, Дарья Севастопольская, хирург Пирогов</div>
                <div>• Парижский мир 1856: нейтрализация Чёрного моря, поражение</div>
              </CardContent>
            </Card>
          </div>
          <div className="p-4 bg-yellow-900/10 border border-brand-yellow/20 rounded-xl flex items-start gap-3">
            <Lightbulb className="text-brand-yellow w-8 h-8 shrink-0" />
            <div className="text-sm">
              <p className="font-bold text-white mb-1">Связь эпох — вопрос ВПР №1</p>
              <p>Крымская война вскрыла отсталость (кремнёвые ружья против нарезных, парусный флот против парового). Итог: поражение → необходимость реформ → Александр II и Манифест 1861. Запомни эту причинно-следственную цепочку — она отвечает сразу на несколько вопросов ВПР.</p>
            </div>
          </div>
        </section>

        {/* TOPIC 3: РЕФОРМЫ АЛЕКСАНДРА II */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Factory className="text-green-400" /> 3. Великие реформы 1860–70-х
            <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-full">2-е полугодие</span>
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

        {/* TOPIC 3.5: ВНЕШНЯЯ ПОЛИТИКА (task215b) */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Scroll className="text-cyan-400" /> 3.5. Внешняя политика: войны XIX века
          </h2>
          <div className="space-y-3">
            {[
              { name: "Русско-турецкая война 1877–78", res: "Победа! Сан-Стефано: независимость Сербии, Румынии, Черногории; Болгария — автономия" },
              { name: "Присоединение Средней Азии (1860–80-е)", res: "Туркестан: Коканд, Бухара, Хива — вассалы/протектораты" },
              { name: "Продажа Аляски (1867)", res: "США за $7,2 млн — содержание неосвоенной территории дороже выгод" },
            ].map((war, i) => (
              <motion.div
                key={war.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl"
              >
                <div className="font-bold text-white text-sm mb-1">{war.name}</div>
                <div className="text-xs text-zinc-400"><span className="text-cyan-400">Итог:</span> {war.res}</div>
              </motion.div>
            ))}
          </div>
          <Card className="bg-cyan-900/10 border-cyan-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-cyan-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: почему Крымская ≠ Русско-турецкая</p>
                <p>Крымская (1853–56) — <b>поражение</b>, потеря выхода к Чёрному морю, толчок реформам. Русско-турецкая (1877–78) — <b>победа</b>, освобождение балканских славян. На ВПР их путают постоянно: помни порядок «поражение → реформы → победа».</p>
              </div>
            </CardContent>
          </Card>
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

        {/* CTA: тест-бой предмета + межлинковка (task217, legacy-промо убрано) */}
        <VprCtaTest
          slug="history-8"
          subjectTitle="История России"
          nextHref="/vpr/chemistry/8/cheatsheet"
          nextTitle="Химия"
          accentShadow="rgba(234,179,8,1)"
        />
        <footer className="text-center pb-20 text-zinc-700 text-[10px] font-mono uppercase tracking-widest">
          Generated with AI in CyberVibe Studio // 8th Grade History: XIX century // No copyright, just Vibe.
        </footer>
      </div>
    </div>
  );
}
