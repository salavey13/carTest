"use client";

import React, { useState } from "react";
import { ReadProgress } from "@/components/vpr/ReadProgress";
import { VprCtaTest } from "@/components/vpr/VprCtaTest";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  BookOpen, Lightbulb, Brain, Sparkles, Flame, Zap, Eye, Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * task220b: Физика — 8 класс. ВПР-8: 11 заданий (9 кратких + 2
 * развёрнутых) — объяснение явлений, графики/таблицы, расчётные задачи.
 * Ядро курса: тепловые явления (Q=cmΔt, агрегатные состояния),агрегатные
 * электричество (закон Ома, цепи, мощность), оптика (отражение/преломление,
 * линзы). Формулы — с единицами и условиями применения.
 */

// ============ ФОРМУЛЫ: ТЕПЛОВЫЕ ЯВЛЕНИЯ ============
const HEAT_FORMULAS = [
  { f: "Q = c·m·Δt", what: "нагревание/охлаждение", units: "Q [Дж], c [Дж/(кг·°C)], m [кг], Δt [°C]", note: "c — удельная теплоёмкость: сколько Дж нужно на 1 кг при 1°C" },
  { f: "Q = λ·m", what: "плавление / кристаллизация", units: "λ [Дж/кг]", note: "температура НЕ меняется, пока идёт процесс" },
  { f: "Q = L·m (r·m)", what: "кипение / конденсация", units: "L [Дж/кг]", note: "кипение — при температуре кипения, по всему объёму" },
  { f: "Q = q·m", what: "сгорание топлива", units: "q [Дж/кг]", note: "q — удельная теплота сгорания" },
  { f: "η = A_п/A_з · 100%", what: "КПД теплового двигателя", units: "%", note: "всегда < 100%" },
];

const PHASES = [
  { proc: "плавление", dir: "твёрдое → жидкое", absorb: true, key: "поглощает Q (λ·m)" },
  { proc: "кристаллизация", dir: "жидкое → твёрдое", absorb: false, key: "выделяет Q (λ·m)" },
  { proc: "парообразование", dir: "жидкое → газ", absorb: true, key: "поглощает Q (L·m)" },
  { proc: "конденсация", dir: "газ → жидкое", absorb: false, key: "выделяет Q (L·m)" },
];

// ============ ФОРМУЛЫ: ЭЛЕКТРИЧЕСТВО ============
const ELEC_FORMULAS = [
  { f: "I = q / t", what: "сила тока", units: "I [А], q [Кл], t [с]" },
  { f: "I = U / R", what: "закон Ома для участка", units: "U [В], R [Ом]" },
  { f: "R = ρ·l / S", what: "сопротивление проводника", units: "ρ [Ом·мм²/м], l [м], S [мм²]" },
  { f: "P = U·I", what: "мощность тока", units: "P [Вт]" },
  { f: "A = U·I·t = P·t", what: "работа тока", units: "A [Дж]; кВт·ч = 3,6 МДж" },
  { f: "Q_п = I²·R·t", what: "закон Джоуля-Ленца", units: "нагрев проводника током" },
];

const CIRCUITS = [
  { type: "последовательное", what: "I одинаков везде; R = R₁+R₂; U = U₁+U₂", ex: "гирлянда: перегорела одна — не работают все" },
  { type: "параллельное", what: "U одинаково; 1/R = 1/R₁+1/R₂; I = I₁+I₂", ex: "квартира: приборы включены независимо" },
];

// ============ ОПТИКА ============
const OPTICS = [
  { law: "отражение", rule: "угол падения = углу отражения (α = β), оба от перпендикуляра", ex: "зеркало" },
  { law: "преломление", rule: "при переходе в более плотную среду луч прижимается к перпендикуляру (и наоборот)", ex: "ложка «ломается» в стакане" },
  { law: "собирающая линза", rule: "F > 0; если d > 2F — уменьшенное перевёрнутое; F < d < 2F — увеличенное перевёрнутое; d < F — мнимое прямое увеличенное", ex: "фотоаппарат / проектор / лупа" },
  { law: "рассеивающая линза", rule: "F < 0; ВСЕГДА мнимое, прямое, уменьшенное", ex: "очки при близорукости" },
  { law: "оптическая сила", rule: "D = 1/F, [диоптрии дптр]", ex: "F = 0,5 м → D = 2 дптр" },
];

// ============ КВИЗ ============
const QUIZ = [
  {
    q: "Воду массой 2 кг нагрели на 30 °C. Сколько теплоты потребовалось? c(воды) = 4200 Дж/(кг·°C).",
    options: ["126 кДж", "252 кДж", "12,6 кДж", "4200 Дж"],
    correct: 1,
    hint: "Q = c·m·Δt = 4200 · 2 · 30 = 252 000 Дж = 252 кДж.",
  },
  {
    q: "Во время плавления льда температура…",
    options: ["растёт", "не меняется", "падает", "скачет"],
    correct: 1,
    hint: "Вся подводимая теплота идёт на разрушение кристаллической решётки (Q = λ·m), температура постоянна — участок «плато» на графике.",
  },
  {
    q: "Сопротивление проводника НЕ зависит от:",
    options: ["длины", "площади сечения", "материала", "силы тока"],
    correct: 3,
    hint: "R = ρ·l/S — только вещество, длина, сечение. Ток меняет U, но не R.",
  },
  {
    q: "Два резистора 6 Ом и 3 Ом соединены ПАРАЛЛЕЛЬНО. Общее сопротивление:",
    options: ["9 Ом", "2 Ом", "4,5 Ом", "18 Ом"],
    correct: 1,
    hint: "1/R = 1/6 + 1/3 = 1/2 → R = 2 Ом. При параллельном общее R меньше меньшего!",
  },
  {
    q: "Лампа 60 Вт работала 5 часов. Расход энергии:",
    options: ["300 Вт·ч", "0,3 кВт·ч", "12 кВт·ч", "65 Дж"],
    correct: 1,
    hint: "A = P·t = 60 Вт · 5 ч = 300 Вт·ч = 0,3 кВт·ч.",
  },
  {
    q: "Луч переходит из воздуха в воду. Что происходит?",
    options: [
      "не преломляется",
      "прижимается к перпендикуляру",
      "удаляется от перпендикуляра",
      "отражается полностью",
    ],
    correct: 1,
    hint: "Вода оптически плотнее воздуха → скорость света меньше → луч прижимается к перпендикуляру.",
  },
  {
    q: "Предмет находится между линзой и фокусом (d < F) собирающей линзы. Изображение:",
    options: [
      "действительное, перевёрнутое",
      "мнимое, прямое, увеличенное",
      "действительное, уменьшенное",
      "изображения нет",
    ],
    correct: 1,
    hint: "d < F — режим лупы: мнимое, прямое, увеличенное. Фотоаппарат — d > 2F, проектор — F < d < 2F.",
  },
  {
    q: "Какое явление объясняет радугу?",
    options: ["отражение", "дифракция", "дисперсия света", "поглощение"],
    correct: 2,
    hint: "Дисперсия — разложение белого света призмой/каплями на спектр: показатель преломления зависит от цвета.",
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
            <Brain className="w-5 h-5 text-orange-400" /> Вопрос {Math.min(idx + 1, order.length)}/{order.length}
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
                      picked === null && "border-zinc-700 hover:border-orange-500/50"
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
                  className="bg-orange-500 hover:bg-orange-400 text-black font-bold"
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
                ? "Физический движок загружен."
                : "Перечитай формулы выше и вернись: feed → fight → fail → repeat."}
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

export default function PhysicsCheatsheet8() {
  return (
    <div className="min-h-screen bg-[#030712] text-zinc-200 relative">
      <ReadProgress />
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

        {/* ============ HEADER + HERO ============ */}
        <motion.header initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-14">
          <div className="flex items-center gap-2 mb-4">
            <Link href="/vpr-tests" className="text-xs font-mono text-zinc-500 hover:text-orange-400 transition-colors uppercase tracking-widest">
              ← VPR_tests
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="text-xs font-mono text-orange-400 uppercase tracking-widest">физика // 8 класс</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight mb-4">
            Физика <span className="text-orange-400">8 класса</span>
            <span className="block text-xl sm:text-2xl text-zinc-400 font-bold mt-2">Тепло · Электричество · Оптика</span>
          </h1>
          {/* HERO-иллюстрация (task220) */}
          <div className="relative mb-6 overflow-hidden rounded-none border border-orange-500/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/physics-8.jpg"
              alt="Физика 8 класс — неоновая иллюстрация"
              className="w-full h-auto opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent" />
          </div>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-2xl">
            ВПР по физике в 8 классе — 11 заданий: объяснить явление, прочитать график,
            решить задачу в одно-два действия. Три кита курса: тепловые явления,
            электрические цепи и оптика. Все формулы — с единицами и подвохами.
          </p>
          <div className="flex flex-wrap gap-2 mt-6">
            {["5+6 формул", "4 фазовых перехода", "2 типа соединений", "квиз 8"].map((t) => (
              <span key={t} className="px-3 py-1 rounded-full border border-orange-500/20 bg-orange-500/5 text-[10px] font-mono text-orange-300/80 uppercase tracking-wider">
                {t}
              </span>
            ))}
          </div>
        </motion.header>

        {/* ============ TOPIC 1: ТЕПЛОВЫЕ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Flame className="text-orange-400" /> 1. Тепловые явления
          </h2>
          <div className="space-y-2 mb-4">
            {HEAT_FORMULAS.map((h) => (
              <div key={h.f} className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 mb-1">
                  <span className="text-orange-400 font-mono font-bold text-base min-w-[140px]">{h.f}</span>
                  <span className="text-white text-[13px] font-semibold">{h.what}</span>
                </div>
                <div className="text-[12px] text-zinc-500 font-mono">{h.units}</div>
                <div className="text-[12px] text-zinc-600 mt-1">{h.note}</div>
              </div>
            ))}
          </div>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle className="font-mono text-sm text-white">Фазовые переходы: что с чем происходит</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PHASES.map((p) => (
                  <div key={p.proc} className="flex items-center justify-between p-3 bg-black/30 rounded border border-zinc-800">
                    <div>
                      <div className="text-white text-[13px] font-semibold">{p.proc}</div>
                      <div className="text-zinc-600 text-[11px] font-mono">{p.dir}</div>
                    </div>
                    <div className={cn("text-[11px] font-mono", p.absorb ? "text-orange-400" : "text-cyan-400")}>
                      {p.key}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-orange-950/10 border-orange-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-orange-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: «плато» на графике</p>
                <p>Увидел на графике плавления горизонтальный участок — это и есть плавление/кипение: t° постоянна, Q = λ·m (или L·m). Пока плато не кончится, формула c·m·Δt неприменима — Δt = 0!</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 2: ЭЛЕКТРИЧЕСТВО ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Zap className="text-yellow-400" /> 2. Электрические явления
          </h2>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-zinc-800 text-left">
                  <th className="py-2 pr-4 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Формула</th>
                  <th className="py-2 pr-4 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Что считает</th>
                  <th className="py-2 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Единицы</th>
                </tr>
              </thead>
              <tbody>
                {ELEC_FORMULAS.map((e) => (
                  <tr key={e.f} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                    <td className="py-2.5 pr-4 text-yellow-400 font-mono font-bold whitespace-nowrap">{e.f}</td>
                    <td className="py-2.5 pr-4 text-zinc-300">{e.what}</td>
                    <td className="py-2.5 text-zinc-500 font-mono text-[12px]">{e.units}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CIRCUITS.map((c) => (
              <Card key={c.type} className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4">
                  <div className="text-white font-bold text-sm mb-1">{c.type}</div>
                  <div className="text-[12px] text-zinc-400 font-mono mb-2">{c.what}</div>
                  <div className="text-[11px] text-zinc-600">{c.ex}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="bg-yellow-950/10 border-yellow-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Calculator className="text-yellow-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: параллельное R всегда меньше меньшего</p>
                <p>6 Ом ∥ 3 Ом = 2 Ом (не 4,5!). Проверяй ответ: если при параллельном соединении вышло R больше одного из резисторов — ищи ошибку в дроби 1/R.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 3: ОПТИКА ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Eye className="text-cyan-400" /> 3. Оптика
          </h2>
          <div className="space-y-2">
            {OPTICS.map((o) => (
              <div key={o.law} className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 mb-1">
                  <span className="text-cyan-400 font-bold text-[13px] min-w-[170px]">{o.law}</span>
                  <span className="text-zinc-300 text-[13px] flex-1">{o.rule}</span>
                </div>
                <div className="text-[11px] text-zinc-600 font-mono">→ {o.ex}</div>
              </div>
            ))}
          </div>
          <Card className="bg-cyan-950/10 border-cyan-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-cyan-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: три режима собирающей линзы</p>
                <p>Запомни примеры: фотоаппарат (далеко → уменьшенное перевёрнутое), проектор (между F и 2F → увеличенное перевёрнутое), лупа (ближе F → мнимое прямое). В задании ВПР достаточно вспомнить пример!</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 4: КВИЗ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Brain className="text-orange-400" /> 4. Квиз: формат ВПР
          </h2>
          <VprQuizInline quiz={QUIZ} />
        </section>

        {/* CTA */}
        <VprCtaTest
          slug="physics-8"
          subjectTitle="Физика"
          nextHref="/vpr/biology/8/cheatsheet"
          nextTitle="Биология"
          accentShadow="rgba(249,115,22,1)"
        />
      </div>
    </div>
  );
}
