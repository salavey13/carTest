"use client";

import React, { useState } from "react";
import { ReadProgress } from "@/components/vpr/ReadProgress";
import { VprCtaTest } from "@/components/vpr/VprCtaTest";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Triangle, Ruler, Zap, BookOpen, RotateCcw, CheckCircle2,
  AlertTriangle, Lightbulb, Brain, Code, Sparkles, Shapes, Square, Grid3X3,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- МИНИ-ИГРА: СБОР ФОРМУЛЫ ПЛОЩАДИ ТРАПЕЦИИ ---
const TRAP_FRAGMENTS = [
  { id: 1, text: "S =", type: "start" },
  { id: 2, text: "(", type: "op" },
  { id: 3, text: "a", type: "val" },
  { id: 4, text: "+", type: "op" },
  { id: 5, text: "b", type: "val" },
  { id: 6, text: ")", type: "op" },
  { id: 7, text: "·", type: "op" },
  { id: 8, text: "h", type: "val" },
  { id: 9, text: "2", type: "num" },
];
const TRAP_CORRECT = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// --- ТЕОРЕМА ПИФАГОРА: ПОШАГОВЫЙ РАЗБОР ---
const PYTHAGORAS_STEPS = [
  { id: 1, eq: "a = 3, b = 4, c = ?", action: "Дан прямоугольный треугольник, катеты 3 и 4" },
  { id: 2, eq: "c² = a² + b²", action: "Теорема Пифагора: квадрат гипотенузы = сумма квадратов катетов" },
  { id: 3, eq: "c² = 3² + 4²", action: "Подставляем известные катеты" },
  { id: 4, eq: "c² = 9 + 16 = 25", action: "Возводим в квадрат и складываем" },
  { id: 5, eq: "c = √25 = 5", action: "Извлекаем корень — ответ: гипотенуза равна 5" },
];

// --- КВИЗ: ВЕРНО/НЕВЕРНО ---
const QUIZ_ITEMS = [
  { q: "Сумма углов любого четырёхугольника равна 360°", a: true, hint: "Разбей четырёхугольник диагональю на 2 треугольника: 180° + 180°" },
  { q: "Диагонали ромба равны между собой", a: false, hint: "Равны диагонали прямоугольника. У ромба они перпендикулярны и делятся пополам" },
  { q: "Площадь параллелограмма = основание × высота", a: true, hint: "S = a·h, где h — высота К основанию a" },
  { q: "Средняя линия треугольника параллельна стороне и равна её половине", a: true, hint: "Теорема о средней линии — любимая тема ВПР" },
  { q: "Трапеция всегда имеет два равных угла при основании", a: false, hint: "Это верно только для равнобедренной трапеции" },
];

export default function Geometry8Cheatsheet() {
  const [seq, setSeq] = useState<number[]>([]);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [stepIndex, setStepIndex] = useState(0);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState<boolean | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [showHint, setShowHint] = useState(false);

  const handleFragClick = (id: number) => {
    if (status === "success") return;
    setSeq((prev) => [...prev, id]);
    setStatus("idle");
  };

  const checkResult = () => {
    setStatus(seq.join(",") === TRAP_CORRECT.join(",") ? "success" : "error");
  };

  const answerQuiz = (value: boolean) => {
    if (quizAnswer !== null) return;
    setQuizAnswer(value);
    if (value === QUIZ_ITEMS[quizIdx].a) setQuizScore((s) => s + 1);
  };

  const nextQuiz = () => {
    setQuizIdx((i) => Math.min(i + 1, QUIZ_ITEMS.length - 1));
    setQuizAnswer(null);
    setShowHint(false);
  };

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-300 font-sans p-4 md:p-8 selection:bg-brand-cyan/30 relative overflow-hidden">
      <ReadProgress />
      {/* Background Decor */}
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "30px 30px" }}
      />

      <div className="max-w-4xl mx-auto relative z-10">
        {/* HERO BAND */}
        <div className="relative mb-10 rounded-2xl overflow-hidden border border-cyan-500/20 h-48 md:h-64 shadow-[0_0_40px_rgba(11,242,246,0.08)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task212/geometry-hero.jpg"
            alt="Неоновая геометрия: треугольник, сетка, четырёхугольники"
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-[#030303]/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-cyan-400 mb-1">Geometry Master // 8 класс</div>
            <div className="text-white font-black text-2xl md:text-4xl drop-shadow-lg">От треугольника — к площадям</div>
          </div>
        </div>

        {/* HEADER */}
        <header className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-1.5 rounded-full text-xs font-medium mb-6"
          >
            <Sparkles className="w-4 h-4 text-brand-cyan" />
            <span>Помощник по Геометрии • 8 класс • Все темы</span>
          </motion.div>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
            Geometry <span className="text-brand-cyan">Master</span>
          </h1>
          {/* HERO-иллюстрация (task220) */}
          <div className="relative mb-6 overflow-hidden rounded-none border" style={{ borderColor: "#0bf2f633" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/geometry-8.jpg"
              alt="Геометрия 8 класс — неоновая иллюстрация"
              className="w-full h-auto opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent" />
          </div>
          <p className="text-zinc-500 text-lg">Четырёхугольники, площади и теорема Пифагора — всё, что нужно для ВПР.</p>
        </header>

        {/* TOPIC 0: ЧЕТЫРЁХУГОЛЬНИКИ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Square className="text-blue-400" /> 0. Четырёхугольники: кто есть кто
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-blue-400">Параллелограмм</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1.5">
                <div>• Противоположные стороны равны и параллельны</div>
                <div>• Диагонали делятся пополам точкой пересечения</div>
                <div className="text-zinc-500 text-xs">Сумма углов = 360°</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-blue-400">Прямоугольник / ромб</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1.5">
                <div>• Прямоугольник: все углы 90°, диагонали равны</div>
                <div>• Ромб: все стороны равны, диагонали ⊥ и делят углы пополам</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-blue-400">Квадрат</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1.5">
                <div>• Всё сразу: углы 90°, стороны равны</div>
                <div>• Диагонали равны, перпендикулярны, делятся пополам</div>
                <div className="text-zinc-500 text-xs">S = a², диагональ = a√2</div>
              </CardContent>
            </Card>
          </div>

          {/* ТАБЛИЦА ПЛОЩАДЕЙ */}
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
            <h4 className="font-bold text-white mb-3 text-sm flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-400" /> Площади — выучи наизусть
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-mono">
              <div className="space-y-2">
                <div className="text-zinc-500">Треугольник:</div>
                <div className="text-white">S = ½ · a · h</div>
                <div className="text-zinc-500">Прямоугольный (по Пифагору):</div>
                <div className="text-white">S = ½ · a · b</div>
              </div>
              <div className="space-y-2">
                <div className="text-zinc-500">Параллелограмм:</div>
                <div className="text-white">S = a · h</div>
                <div className="text-zinc-500">Трапеция:</div>
                <div className="text-white">S = ½ · (a + b) · h</div>
              </div>
            </div>
          </div>
        </section>

        {/* TOPIC 1: ТЕОРЕМА ПИФАГОРА */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Triangle className="text-brand-yellow" /> 1. Теорема Пифагора
          </h2>
          <Card className="bg-zinc-900/50 border-brand-yellow/30 mb-6">
            <CardHeader className="border-b border-brand-yellow/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <Ruler className="w-5 h-5 text-brand-yellow" /> Пошаговый разбор
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="mb-6 p-4 bg-black border border-brand-yellow/20 rounded-xl">
                <div className="text-center mb-2">
                  <span className="text-xs text-brand-yellow bg-brand-yellow/10 px-2 py-1 rounded-full">
                    Шаг {stepIndex + 1} из {PYTHAGORAS_STEPS.length}
                  </span>
                </div>
                <div className="text-2xl font-bold text-center font-mono text-white mb-2">
                  {PYTHAGORAS_STEPS[stepIndex].eq}
                </div>
                <div className="text-sm text-center text-zinc-400">{PYTHAGORAS_STEPS[stepIndex].action}</div>
              </div>
              <div className="flex justify-between items-center">
                <Button onClick={() => setStepIndex((p) => Math.max(p - 1, 0))} disabled={stepIndex === 0} variant="outline" size="sm" className="border-brand-yellow/30 text-brand-yellow">
                  ← Назад
                </Button>
                <div className="flex gap-2">
                  {PYTHAGORAS_STEPS.map((_, idx) => (
                    <div key={idx} className={cn("w-2 h-2 rounded-full transition-all", idx === stepIndex ? "bg-brand-yellow" : "bg-zinc-700")} />
                  ))}
                </div>
                <Button onClick={() => setStepIndex((p) => Math.min(p + 1, PYTHAGORAS_STEPS.length - 1))} disabled={stepIndex === PYTHAGORAS_STEPS.length - 1} variant="outline" size="sm" className="border-brand-yellow/30 text-brand-yellow">
                  Дальше →
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
              <div className="text-xs text-zinc-500 mb-1">Сама теорема</div>
              <div className="text-xl font-bold text-white">c² = a² + b²</div>
            </div>
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
              <div className="text-xs text-zinc-500 mb-1">Катет через гипотенузу</div>
              <div className="text-xl font-bold text-white">a² = c² − b²</div>
            </div>
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
              <div className="text-xs text-zinc-500 mb-1">Пифагорова тройка</div>
              <div className="text-xl font-bold text-white">3, 4, 5</div>
            </div>
          </div>
        </section>

        {/* TOPIC 2: ТРАПЕЦИЯ (ИГРА) */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Shapes className="text-brand-pink" /> 2. Трапеция: собери формулу
          </h2>
          <Card className="bg-zinc-900 border-brand-pink/30 shadow-xl mb-6 overflow-hidden">
            <CardHeader className="bg-brand-pink/5 border-b border-brand-pink/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="w-5 h-5" /> Конструктор Формулы
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-sm text-zinc-400 mb-6">
                Собери формулу площади трапеции (a и b — основания, h — высота). Порядок важен!
              </p>
              <div
                className={cn(
                  "flex items-center justify-center h-20 border-2 rounded-xl mb-6 font-mono text-3xl transition-all",
                  status === "success"
                    ? "border-green-500 text-green-400 bg-green-500/5"
                    : status === "error"
                      ? "border-red-500 text-red-500 bg-red-500/5"
                      : "border-zinc-800 bg-black text-zinc-600",
                )}
              >
                {seq.map((id) => TRAP_FRAGMENTS.find((f) => f.id === id)?.text).join(" ") || "???"}
              </div>
              <div className="flex flex-wrap gap-2 justify-center mb-8">
                {TRAP_FRAGMENTS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleFragClick(f.id)}
                    disabled={seq.includes(f.id) || status === "success"}
                    className={cn(
                      "px-5 py-2 rounded-lg border font-bold transition-all",
                      seq.includes(f.id) ? "opacity-20" : "bg-zinc-800 border-zinc-700 hover:border-brand-pink hover:text-white",
                    )}
                  >
                    {f.text}
                  </button>
                ))}
              </div>
              <div className="flex justify-center gap-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSeq([]);
                    setStatus("idle");
                  }}
                  size="sm"
                >
                  Сброс
                </Button>
                <Button onClick={checkResult} disabled={seq.length === 0 || status === "success"} className="bg-brand-pink text-white font-bold">
                  Проверить
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* TOPIC 3: ПОДОБИЕ И СРЕДНЯЯ ЛИНИЯ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Zap className="text-green-400" /> 3. Подобие и средняя линия
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-green-400">Средняя линия треугольника</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed">
                Отрезок, соединяющий середины двух сторон. Параллельна третьей стороне и равна её{" "}
                <b className="text-white">половине</b>: <code className="text-green-300">MK = AC / 2</code>.
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-green-400">Подобные треугольники</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed">
                Равные углы + пропорциональные стороны = подобие (k — коэффициент). Отношение{" "}
                <b className="text-white">площадей = k²</b>, а не k! Это ловушка №1 на ВПР.
              </CardContent>
            </Card>
          </div>
        </section>

        {/* TOPIC 3.5: ОКРУЖНОСТЬ (task215) */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Ruler className="text-indigo-400" /> 3.5. Окружность и касательная
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
              <div className="text-xs text-zinc-500 mb-1">Касательная</div>
              <div className="text-lg font-bold text-white font-mono">r ⊥ касательной</div>
              <div className="text-[11px] text-zinc-600 mt-1">в точке касания всегда 90°</div>
            </div>
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
              <div className="text-xs text-zinc-500 mb-1">Вписанный угол</div>
              <div className="text-lg font-bold text-white font-mono">∠ = ½ ∪</div>
              <div className="text-[11px] text-zinc-600 mt-1">равен половине дуги, на которую опирается</div>
            </div>
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
              <div className="text-xs text-zinc-500 mb-1">Длина и площадь</div>
              <div className="text-lg font-bold text-white font-mono">C = 2πr, S = πr²</div>
              <div className="text-[11px] text-zinc-600 mt-1">d = 2r</div>
            </div>
          </div>
          <Card className="bg-indigo-900/10 border-indigo-500/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-indigo-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: угол на диаметр</p>
                <p>Вписанный угол, опирающийся на диаметр, всегда <b>90°</b>. Это прямой угол «бесплатно» — без вычислений. Любая задача с треугольником в окружности — проверь сначала его.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* TOPIC 3.6: SIN/COS/TG (task215b) */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Triangle className="text-brand-pink" /> 3.6. Прямоугольный треугольник: sin, cos, tg
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
              <div className="text-xs text-zinc-500 mb-1">Синус</div>
              <div className="text-lg font-bold text-white font-mono">sin = против/гип</div>
            </div>
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
              <div className="text-xs text-zinc-500 mb-1">Косинус</div>
              <div className="text-lg font-bold text-white font-mono">cos = приле/гип</div>
            </div>
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
              <div className="text-xs text-zinc-500 mb-1">Тангенс</div>
              <div className="text-lg font-bold text-white font-mono">tg = против/приле</div>
            </div>
          </div>
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-sm font-mono text-zinc-400 mb-4">
            <p className="mb-2 text-zinc-200">// Таблица 30° / 45° / 60° (только эти спрашивают):</p>
            <p>sin: 1/2 · √2/2 · √3/2 — cos те же в обратном порядке — tg: √3/3 · 1 · √3</p>
          </div>
          <Card className="bg-brand-pink/5 border-brand-pink/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-brand-pink w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: как не перепутать</p>
                <p><b>sin</b> — «против» и «sin» оба короткие (противолежащий). cos — прилежащий. И помни: sin² + cos² = 1 — проверка любого значения.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* TOPIC 4: КВИЗ */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <BookOpen className="text-brand-cyan" /> 4. Проверь себя: верно / неверно
          </h2>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs text-zinc-500">
                  Вопрос {quizIdx + 1} из {QUIZ_ITEMS.length}
                </span>
                <span className="text-xs font-bold text-brand-cyan">Счёт: {quizScore}</span>
              </div>
              <div className="text-lg font-bold text-white mb-6">{QUIZ_ITEMS[quizIdx].q}</div>

              {quizAnswer !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "mb-4 p-3 rounded-lg border text-sm",
                    quizAnswer === QUIZ_ITEMS[quizIdx].a
                      ? "border-green-500/30 bg-green-500/5 text-green-400"
                      : "border-red-500/30 bg-red-500/5 text-red-400",
                  )}
                >
                  {quizAnswer === QUIZ_ITEMS[quizIdx].a ? (
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Верно!
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Неверно — правильный ответ: {QUIZ_ITEMS[quizIdx].a ? "ДА" : "НЕТ"}
                    </span>
                  )}
                </motion.div>
              )}

              {showHint && (
                <div className="mb-4 p-3 rounded-lg bg-zinc-800/50 text-sm text-zinc-400">{QUIZ_ITEMS[quizIdx].hint}</div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => answerQuiz(true)} disabled={quizAnswer !== null} className="border-green-500/30 text-green-400">
                  Верно
                </Button>
                <Button variant="outline" onClick={() => answerQuiz(false)} disabled={quizAnswer !== null} className="border-red-500/30 text-red-400">
                  Неверно
                </Button>
                <Button variant="ghost" onClick={() => setShowHint(true)} disabled={quizAnswer !== null} size="sm">
                  Подсказка
                </Button>
                <Button onClick={nextQuiz} disabled={quizAnswer === null || quizIdx === QUIZ_ITEMS.length - 1} size="sm" className="bg-brand-cyan text-black font-bold ml-auto">
                  Далее →
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* TOPIC 5: ПЛОЩАДИ ВСЕХ ФИГУР (task218) */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Grid3X3 className="text-cyan-400" /> 5. Площади: вся таблица
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { f: "Треугольник", formula: "S = ½ a·h", note: "h — высота К стороне a" },
              { f: "Прямоугольный", formula: "S = ½ a·b", note: "a, b — катеты" },
              { f: "Трапеция", formula: "S = ½(a+b)·h", note: "a, b — основания" },
              { f: "Ромб", formula: "S = ½ d₁·d₂", note: "диагонали" },
              { f: "Прямоугольник", formula: "S = a·b", note: "и параллелограмм: a·h" },
              { f: "Квадрат", formula: "S = a²", note: "или d²/2" },
              { f: "По Герону", formula: "S = √(p(p−a)(p−b)(p−c))", note: "p = полупериметр" },
              { f: "Через sin", formula: "S = ½ a·b·sin γ", note: "две стороны и угол между" },
            ].map((r) => (
              <div key={r.f} className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
                <div className="text-[11px] text-zinc-500 mb-1">{r.f}</div>
                <div className="text-sm font-bold text-white font-mono">{r.formula}</div>
                <div className="text-[9px] text-cyan-400/60 mt-1">{r.note}</div>
              </div>
            ))}
          </div>
          <Card className="bg-yellow-900/10 border-brand-yellow/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-brand-yellow w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: «половинка»</p>
                <p>Почти все площади треугольных семейств — это <b>половина</b> чего-то: ½a·h, ½d₁d₂, ½a·b·sin γ. Только прямоугольник/квадрат/параллелограмм — «полные». Забыл формулу на ВПР — дострой фигуру до прямоугольника и вычти лишнее.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* CTA: тест-бой предмета + межлинковка (task217, legacy-промо убрано) */}
        <VprCtaTest
          slug="geometry-8"
          subjectTitle="Геометрия"
          nextHref="/vpr/probability/8/cheatsheet"
          nextTitle="Вероятность"
          accentShadow="rgba(0,194,255,1)"
        />
        {/* FOOTER */}
        <footer className="text-center pb-20 text-zinc-700 text-[10px] font-mono uppercase tracking-widest">
          Generated with AI in CyberVibe Studio // 8th Grade Geometry // No copyright, just Vibe.
        </footer>
      </div>
    </div>
  );
}
