"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  BarChart3, Lightbulb, Brain, Code, Sparkles, Dices,
  CheckCircle2, XCircle, TrendingUp, Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- ИГРА: НАЙДИ ОШИБКУ В РАССУЖДЕНИИ ---
const MYTH_BUSTERS = [
  {
    claim: "Если монета 5 раз выпала орлом, решка теперь «обязана» выпасть — вероятнее",
    isMyth: true,
    explain: "Ошибка игрока: у монеты нет памяти. Вероятность решки по-прежнему ½. Каждый бросок независим",
  },
  {
    claim: "Вероятность достоверного события равна 1",
    isMyth: false,
    explain: "Верно: то, что произойдёт наверняка (после зимы наступит весна), имеет вероятность 1",
  },
  {
    claim: "Если событие возможно, его вероятность минимум 0,1",
    isMyth: true,
    explain: "Неверно: возможность ≠ высокая вероятность. Возможное событие может иметь вероятность 0,001",
  },
  {
    claim: "Среднее арифметическое устойчиво к выбросам",
    isMyth: true,
    explain: "Наоборот: один выброс (зарплата директора в списке зарплат отдела) сильно сдвигает СРЕДНЕЕ. Устойчива МЕДИАНА",
  },
  {
    claim: "Медиана — это значение посередине упорядоченного ряда",
    isMyth: false,
    explain: "Верно: выстроили ряд по возрастанию — медиана в центре (или среднее двух центральных при чётном количестве)",
  },
];

// --- ПОШАГОВЫЙ РАЗБОР: КЛАССИЧЕСКАЯ ВЕРОЯТНОСТЬ ---
const PROB_STEPS = [
  { id: 1, eq: "В коробке 4 красных и 6 синих шаров", action: "Всего исходов: 4 + 6 = 10" },
  { id: 2, eq: "P(красный) = ?", action: "Благоприятные исходы: 4 (красные шары)" },
  { id: 3, eq: "P = 4/10", action: "Формула: благоприятные делим на все" },
  { id: 4, eq: "P = 0,4 = 40%", action: "Ответ: вероятность вытащить красный шар — 0,4" },
];

export default function Probability8Cheatsheet() {
  const [stepIdx, setStepIdx] = useState(0);
  const [mythIdx, setMythIdx] = useState(0);
  const [picked, setPicked] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);

  const myth = MYTH_BUSTERS[mythIdx];

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-300 font-sans p-4 md:p-8 selection:bg-green-500/30 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "30px 30px" }}
      />

      <div className="max-w-4xl mx-auto relative z-10">
        {/* HERO BAND */}
        <div className="relative mb-10 rounded-2xl overflow-hidden border border-green-500/20 h-48 md:h-64 shadow-[0_0_40px_rgba(34,197,94,0.08)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task212/probability-hero.jpg"
            alt="Неоновые игральные кости над графиками"
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-[#030303]/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-green-400 mb-1">Chance Engine // 8 класс</div>
            <div className="text-white font-black text-2xl md:text-4xl drop-shadow-lg">Матемагия случая</div>
          </div>
        </div>

        {/* HEADER */}
        <header className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-1.5 rounded-full text-xs font-medium mb-6"
          >
            <Sparkles className="w-4 h-4 text-green-400" />
            <span>Вероятность и статистика • 8 класс</span>
          </motion.div>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
            Chance <span className="text-green-400">Engine</span>
          </h1>
          <p className="text-zinc-500 text-lg">Вероятности, средние, медиана и ловушки здравого смысла.</p>
        </header>

        {/* TOPIC 0: КЛАССИЧЕСКАЯ ВЕРОЯТНОСТЬ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Dices className="text-green-400" /> 0. Вероятность: формула и разбор
          </h2>
          <Card className="bg-zinc-900/50 border-green-500/30 mb-6">
            <CardHeader className="border-b border-green-500/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <Percent className="w-5 h-5 text-green-400" /> Пошаговый разбор
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="mb-6 p-4 bg-black border border-green-500/20 rounded-xl">
                <div className="text-center mb-2">
                  <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
                    Шаг {stepIdx + 1} из {PROB_STEPS.length}
                  </span>
                </div>
                <div className="text-xl font-bold text-center font-mono text-white mb-2">{PROB_STEPS[stepIdx].eq}</div>
                <div className="text-sm text-center text-zinc-400">{PROB_STEPS[stepIdx].action}</div>
              </div>
              <div className="flex justify-between items-center">
                <Button onClick={() => setStepIdx((p) => Math.max(p - 1, 0))} disabled={stepIdx === 0} variant="outline" size="sm" className="border-green-500/30 text-green-400">
                  ← Назад
                </Button>
                <div className="flex gap-2">
                  {PROB_STEPS.map((_, idx) => (
                    <div key={idx} className={cn("w-2 h-2 rounded-full transition-all", idx === stepIdx ? "bg-green-400" : "bg-zinc-700")} />
                  ))}
                </div>
                <Button onClick={() => setStepIdx((p) => Math.min(p + 1, PROB_STEPS.length - 1))} disabled={stepIdx === PROB_STEPS.length - 1} variant="outline" size="sm" className="border-green-500/30 text-green-400">
                  Дальше →
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
              <div className="text-xs text-zinc-500 mb-1">Вероятность события</div>
              <div className="text-lg font-bold text-white font-mono">P = m / n</div>
            </div>
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
              <div className="text-xs text-zinc-500 mb-1">Всегда</div>
              <div className="text-lg font-bold text-white font-mono">0 ≤ P ≤ 1</div>
            </div>
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
              <div className="text-xs text-zinc-500 mb-1">Противоположное</div>
              <div className="text-lg font-bold text-white font-mono">P(Ā) = 1 − P(A)</div>
            </div>
          </div>
        </section>

        {/* TOPIC 1: СТАТИСТИКА — СРЕДНЕЕ/МЕДИАНА/МОДА */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <BarChart3 className="text-blue-400" /> 1. Среднее, медиана, мода, размах
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-blue-400">Ряд: 2, 4, 4, 7, 13</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2 font-mono">
                <div>Среднее: (2+4+4+7+13)/5 = <span className="text-white">6</span></div>
                <div>Медиана (центр): <span className="text-white">4</span></div>
                <div>Мода (частое): <span className="text-white">4</span></div>
                <div>Размах (max−min): 13−2 = <span className="text-white">11</span></div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-blue-400">Чётный ряд: 1, 3, 5, 9</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2 font-mono">
                <div>Медиана = (3+5)/2 = <span className="text-white">4</span></div>
                <div className="text-zinc-400 text-xs">Среднее двух центральных!</div>
                <div>Среднее: 18/4 = <span className="text-white">4,5</span></div>
                <div className="text-zinc-400 text-xs">Моды нет — все по одному разу</div>
              </CardContent>
            </Card>
          </div>
          <div className="mt-4 p-4 bg-yellow-900/10 border border-brand-yellow/20 rounded-xl flex items-start gap-3">
            <Lightbulb className="text-brand-yellow w-8 h-8 shrink-0" />
            <div className="text-sm">
              <p className="font-bold text-white mb-1">Зарплатная ловушка (любимый вопрос ВПР)</p>
              <p>В отделе 5 человек получают по 40 тыс., директор — 400 тыс. Среднее = (5·40+400)/6 = 100 тыс. — «в среднем все богачи»? Нет! Медиана = 40 тыс. показывает реальную картину. Поэтому новости про «среднюю зарплату» иногда лгут.</p>
            </div>
          </div>
        </section>

        {/* TOPIC 2: МИФ-БАСТЕРЫ (ИГРА) */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <TrendingUp className="text-brand-pink" /> 2. Миф или правда?
          </h2>
          <Card className="bg-zinc-900 border-brand-pink/30 shadow-xl">
            <CardHeader className="bg-brand-pink/5 border-b border-brand-pink/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="w-5 h-5" /> Утверждение {mythIdx + 1} из {MYTH_BUSTERS.length}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-lg font-bold text-white text-center mb-6">{myth.claim}</div>
              {picked !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "mb-4 p-4 rounded-lg border text-sm",
                    picked === myth.isMyth ? "border-green-500/30 bg-green-500/5 text-green-400" : "border-red-500/30 bg-red-500/5 text-red-400",
                  )}
                >
                  <div className="flex items-center gap-2 mb-2 font-bold">
                    {picked === myth.isMyth ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {picked === myth.isMyth ? (myth.isMyth ? "Верно — это миф!" : "Верно — это правда!") : "Не угадал"}
                  </div>
                  <div className="text-zinc-300">{myth.explain}</div>
                </motion.div>
              )}
              <div className="flex flex-wrap gap-3 justify-center items-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (picked !== null) return;
                    setPicked(true);
                    if (myth.isMyth) setScore((s) => s + 1);
                  }}
                  disabled={picked !== null}
                  className="border-red-500/30 text-red-400"
                >
                  Это миф
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (picked !== null) return;
                    setPicked(false);
                    if (!myth.isMyth) setScore((s) => s + 1);
                  }}
                  disabled={picked !== null}
                  className="border-green-500/30 text-green-400"
                >
                  Это правда
                </Button>
                <Button
                  onClick={() => {
                    setMythIdx((i) => Math.min(i + 1, MYTH_BUSTERS.length - 1));
                    setPicked(null);
                  }}
                  disabled={picked === null || mythIdx === MYTH_BUSTERS.length - 1}
                  size="sm"
                  className="bg-brand-pink text-white font-bold"
                >
                  Далее →
                </Button>
                <span className="text-xs text-zinc-500">Счёт: {score}</span>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* TOPIC 2.5: ЧАСТОТА И ЭКСПЕРИМЕНТЫ (task215) */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Dices className="text-orange-400" /> 2.5. Частота vs вероятность
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader><CardTitle className="text-sm text-orange-400">Частота (из опыта)</CardTitle></CardHeader>
              <CardContent className="text-sm font-mono space-y-1">
                <div>f = m / n</div>
                <div className="text-zinc-500 text-xs">// сколько раз событие выпало, делённое на число опытов</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader><CardTitle className="text-sm text-orange-400">Вероятность (из теории)</CardTitle></CardHeader>
              <CardContent className="text-sm font-mono space-y-1">
                <div>P = m / n</div>
                <div className="text-zinc-500 text-xs">// сколько благоприятных исходов из всех возможных</div>
              </CardContent>
            </Card>
          </div>
          <Card className="bg-orange-900/10 border-orange-500/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-orange-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Закон больших чисел</p>
                <p>Чем больше экспериментов, тем ближе <b>частота</b> к <b>вероятности</b>. Подбрось монету 10 раз — может быть 7 орлов (частота 0.7). Подбрось 1000 раз — получится почти 0.5. Типичная задача ВПР: «сколько примерно раз выпадет X из N бросков» → N · P.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* TOPIC 3: ТАБЛИЦА И ДИАГРАММЫ */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <BarChart3 className="text-brand-cyan" /> 3. Чтение диаграмм: чек-лист
          </h2>
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-sm space-y-2">
            <div className="text-zinc-500">// Алгоритм ответа на вопрос по диаграмме:</div>
            <div className="text-white pl-4">1. Прочитай заголовок — что вообще измеряли</div>
            <div className="text-white pl-4">2. Ось Y — единицы (люди? проценты? тысячи?)</div>
            <div className="text-white pl-4">3. Сравни столбцы/сектора: какой больше и ВО СКОЛЬКО раз</div>
            <div className="text-white pl-4">4. Для секторной: весь круг = 100%, сектор X = X%</div>
            <div className="text-zinc-500 pl-4">// Ловушка: столбик начат не с нуля — разница обманчива</div>
          </div>
        </section>

        {/* CTA */}
        <div className="bg-white text-black p-8 rounded-none mb-20 flex flex-col md:flex-row items-center gap-8 shadow-[10px_10px_0_rgba(34,197,94,1)]">
          <div className="w-20 h-20 bg-green-500 flex items-center justify-center rounded-full shrink-0">
            <Code className="w-10 h-10 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-black uppercase mb-2">Как создана эта страница?</h3>
            <p className="text-zinc-700 text-sm leading-relaxed mb-6">
              Эта «шпаргалка» была полностью написана искусственным интеллектом в нашей <b>SuperVibe Studio</b>.
              Теория вероятностей — фундамент машинного обучения и ИИ. Хочешь понять, как «думают» нейросети? Начни здесь.
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
          Generated with AI in CyberVibe Studio // 8th Grade Probability & Statistics // No copyright, just Vibe.
        </footer>
      </div>
    </div>
  );
}
