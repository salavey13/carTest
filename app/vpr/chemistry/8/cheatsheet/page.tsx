"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Atom, BookOpen, CheckCircle, FlaskConical, Layers, Lightbulb, Scale, Sparkles, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReadProgress } from "@/components/vpr/ReadProgress";
import { VprCtaTest } from "@/components/vpr/VprCtaTest";

/* task217: шпаргалка Химия 8 класс — темы 1-го полугодия (Габриелян):
   вещества/явления, атомы-молекулы-ионы, знаки элементов, Ar/Mr,
   валентность (+конструктор формул), массовая доля, квиз. */

const shuffleArr = <T,>(a: T[]): T[] => {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// --- Знаки и относительные атомные массы (Ar, округлённые до целых) ---
const ELEMENTS: { s: string; n: string; ar: number }[] = [
  { s: "H", n: "Гидроген", ar: 1 }, { s: "He", n: "Гелий", ar: 4 },
  { s: "Li", n: "Литий", ar: 7 }, { s: "Be", n: "Бериллий", ar: 9 },
  { s: "B", n: "Бор", ar: 11 }, { s: "C", n: "Карбон", ar: 12 },
  { s: "N", n: "Нитроген", ar: 14 }, { s: "O", n: "Оксиген", ar: 16 },
  { s: "F", n: "Флуор", ar: 19 }, { s: "Ne", n: "Неон", ar: 20 },
  { s: "Na", n: "Натрий", ar: 23 }, { s: "Mg", n: "Магний", ar: 24 },
  { s: "Al", n: "Алюминий", ar: 27 }, { s: "Si", n: "Кремний", ar: 28 },
  { s: "P", n: "Фосфор", ar: 31 }, { s: "S", n: "Сера", ar: 32 },
  { s: "Cl", n: "Хлор", ar: 35.5 }, { s: "Ar", n: "Аргон", ar: 40 },
  { s: "K", n: "Калий", ar: 39 }, { s: "Ca", n: "Кальций", ar: 40 },
];
const MORE = [
  { s: "Fe", n: "Феррум", ar: 56 }, { s: "Cu", n: "Купрум", ar: 64 },
  { s: "Zn", n: "Цинк", ar: 65 }, { s: "Ag", n: "Аргентум", ar: 108 },
  { s: "I", n: "Иод", ar: 127 }, { s: "Ba", n: "Барий", ar: 137 },
  { s: "Au", n: "Аурум", ar: 197 }, { s: "Hg", n: "Меркурий", ar: 201 },
];

// --- Мини-игра: собери формулу по валентности ---
const FORMULA_ROUNDS = [
  { pair: "Na (I) и O (II)", options: ["NaO", "Na₂O", "NaO₂", "Na₂O₃"], correct: "Na₂O", why: "Индексы крест-накрест: Na(I) → индекс II = 2 у O... точнее: НОК 2, Na₂O." },
  { pair: "Al (III) и O (II)", options: ["AlO", "Al₂O₃", "Al₃O₂", "AlO₂"], correct: "Al₂O₃", why: "НОК(III, II) = 6: Al — 6/3 = 2, O — 6/2 = 3 → Al₂O₃." },
  { pair: "Ca (II) и Cl (I)", options: ["CaCl", "CaCl₂", "Ca₂Cl", "Ca₂Cl₂"], correct: "CaCl₂", why: "НОК(II, I) = 2: Ca — 2/2 = 1, Cl — 2/1 = 2 → CaCl₂." },
  { pair: "P (V) и O (II)", options: ["PO", "P₂O₅", "P₅O₂", "PO₃"], correct: "P₂O₅", why: "НОК(V, II) = 10: P — 10/5 = 2, O — 10/2 = 5 → P₂O₅." },
];

// --- Квиз: физ/хим явления и расчёты ---
const QUIZ = [
  { q: "Растворение сахара в воде — это…", options: ["физическое явление (сахар сохраняется)", "химическое явление (новое вещество)", "химическая реакция с разложением", "ионизация"], correct: 0, why: "Сахар можно выделить выпариванием — новых веществ не образовалось: явление физическое." },
  { q: "Относительная молекулярная масса воды H₂O:", options: ["18", "16", "20", "34"], correct: 0, why: "Mr = 2·Ar(H) + Ar(O) = 2·1 + 16 = 18." },
  { q: "Кислород O₂ — это…", options: ["простое вещество", "сложное вещество", "смесь двух элементов", "ион"], correct: 0, why: "Одна chemical «буква» в составе → простое вещество; два разных элемента давали бы сложное." },
  { q: "Массовая доля кислорода в H₂O:", options: ["≈89%", "≈11%", "50%", "16%"], correct: 0, why: "ω(O) = 16/18 × 100% ≈ 89%. Вода — почти весь кислород по массе." },
];

function shuffleIndexes(n: number) {
  return shuffleArr([...Array(n).keys()]);
}

export default function Chemistry8FriendlyCheatsheet() {
  // SSR-safe перемешивание (как в конструкторе дискриминанта)
  const [roundIdx, setRoundIdx] = useState(0);
  const [optOrder, setOptOrder] = useState<number[]>([0, 1, 2, 3]);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizOrder, setQuizOrder] = useState<number[]>([0, 1, 2, 3]);
  const [quizPicked, setQuizPicked] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);

  useEffect(() => {
    setOptOrder(shuffleIndexes(FORMULA_ROUNDS[0].options.length));
    setQuizOrder(shuffleIndexes(QUIZ[0].options.length));
  }, []);

  const round = FORMULA_ROUNDS[roundIdx];
  const quiz = QUIZ[quizIdx];

  const pickFormula = (opt: string) => {
    if (picked !== null) return;
    setPicked(opt);
    if (opt === round.correct) setScore((s) => s + 1);
  };
  const nextRound = () => {
    const next = roundIdx + 1;
    if (next < FORMULA_ROUNDS.length) {
      setRoundIdx(next);
      setPicked(null);
      setOptOrder(shuffleIndexes(FORMULA_ROUNDS[next].options.length));
    }
  };
  const pickQuiz = (opt: number) => {
    if (quizPicked !== null) return;
    setQuizPicked(opt);
    if (opt === quiz.correct) setQuizScore((s) => s + 1);
  };
  const nextQuiz = () => {
    const next = quizIdx + 1;
    if (next < QUIZ.length) {
      setQuizIdx(next);
      setQuizPicked(null);
      setQuizOrder(shuffleIndexes(QUIZ[next].options.length));
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-300 font-sans p-4 md:p-8 selection:bg-emerald-500/30 relative overflow-hidden">
      <ReadProgress />
      <div className="max-w-4xl mx-auto">
        {/* HERO */}
        <div className="pt-10 pb-8 mb-10 border-b border-zinc-800">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-3 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs font-mono uppercase tracking-wider">
              🧪 Химия • 8 класс • 1-е полугодие
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Шпаргалка по <span className="text-emerald-400">Химии</span>
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">
            Загрузка перед контрольной: вещества и явления, атомы и молекулы, знаки элементов,
            Ar/Mr, валентность с конструктором формул и массовая доля. 8 модулей + квиз.
          </p>
        </div>

        {/* TOPIC 0: ЧТО ИЗУЧАЕТ ХИМИЯ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <FlaskConical className="text-emerald-400" /> 0. Что изучает химия
          </h2>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-6 text-sm leading-relaxed">
              <p className="mb-3">
                <b className="text-white">Химия</b> — наука о веществах, их свойствах и превращениях одних веществ в другие.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-center">
                  <div className="text-emerald-400 font-bold text-sm mb-1">Вещество</div>
                  <div className="text-xs text-zinc-500">материя с постоянным составом: вода, соль, медь</div>
                </div>
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-center">
                  <div className="text-emerald-400 font-bold text-sm mb-1">Тело</div>
                  <div className="text-xs text-zinc-500">предмет из вещества: стакан, гвоздь, лампа</div>
                </div>
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-center">
                  <div className="text-emerald-400 font-bold text-sm mb-1">Правило ТБ</div>
                  <div className="text-xs text-zinc-500">не пробуй на вкус, не нюхай прямо, работай в очках</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* TOPIC 1: ВЕЩЕСТВА */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Layers className="text-emerald-400" /> 1. Чистые, смеси, простые, сложные
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader><CardTitle className="text-sm text-emerald-400">Чистое вещество vs смесь</CardTitle></CardHeader>
              <CardContent className="text-sm leading-relaxed space-y-1">
                <div><b>Чистое</b> — один состав: дистиллированная вода, сера</div>
                <div><b>Смесь</b> — несколько веществ физически: воздух, почва, молоко</div>
                <div className="text-zinc-500 text-xs mt-1">Смеси разделяют: фильтрование, выпаривание, дистилляция, магнит</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader><CardTitle className="text-sm text-emerald-400">Простое vs сложное</CardTitle></CardHeader>
              <CardContent className="text-sm leading-relaxed space-y-1">
                <div><b>Простое</b> — один элемент: O₂, H₂, Fe, S</div>
                <div><b>Сложное</b> — разные элементы: H₂O, CO₂, NaCl</div>
                <div className="text-zinc-500 text-xs mt-1">Ловушка: O₂ и O₃ — оба простые (один элемент, разные молекулы!)</div>
              </CardContent>
            </Card>
          </div>
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-sm font-mono text-zinc-400">
            <p className="mb-2 text-zinc-200">// Разбор 4 примеров:</p>
            <p>воздух — смесь · железо Fe — простое · вода H₂O — сложное · морская вода — смесь</p>
          </div>
        </section>

        {/* TOPIC 2: ЯВЛЕНИЯ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Sparkles className="text-emerald-400" /> 2. Физические и химические явления
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
              <div className="font-bold text-white text-sm mb-2">Физическое</div>
              <div className="text-xs text-zinc-400 leading-relaxed">Вещество <b>не превращается</b> в другое: плавление льда, кипение, измельчение, растворение сахара, магнит притянул железо</div>
            </div>
            <div className="p-4 bg-zinc-900 border border-emerald-500/30 rounded-xl">
              <div className="font-bold text-white text-sm mb-2">Химическое (реакция)</div>
              <div className="text-xs text-zinc-400 leading-relaxed">Получаются <b>новые вещества</b>: горение, ржавление, скисание молока, фотосинтез</div>
            </div>
          </div>
          <Card className="bg-emerald-900/10 border-emerald-500/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-emerald-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Признаки химической реакции (любят спрашивать!)</p>
                <p>Изменение цвета, появление/исчезновение запаха, газ выделение (пузырьки), осадок, тепло и свет. Видишь пузырьки или осадок — почти наверняка реакция.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* TOPIC 3: АТОМЫ / МОЛЕКУЛЫ / ИОНЫ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Atom className="text-emerald-400" /> 3. Атомы, молекулы, ионы
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
              <div className="text-lg font-bold text-white font-mono mb-1">Атом</div>
              <div className="text-xs text-zinc-500">мельчайшая частица элемента; электронейтрален; делим только в ядерных процессах</div>
            </div>
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
              <div className="text-lg font-bold text-white font-mono mb-1">Молекула</div>
              <div className="text-xs text-zinc-500">связанные атомы: H₂O — 2 атома H + 1 атом O; у металлов молекул нет</div>
            </div>
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
              <div className="text-lg font-bold text-white font-mono mb-1">Ион</div>
              <div className="text-xs text-zinc-500">заряженная частица: Na⁺ (+), Cl⁻ (−); соли в растворе — из ионов</div>
            </div>
          </div>
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-sm font-mono text-zinc-400">
            <p className="mb-2 text-zinc-200">// Индексы vs коэффициенты:</p>
            <p>2H₂O: коэффициент 2 = две молекулы; индекс 2 = два атома H в каждой. 2H₂O = всего 4 атома H и 2 атома O.</p>
          </div>
        </section>

        {/* TOPIC 4: ЗНАКИ ЭЛЕМЕНТОВ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <BookOpen className="text-emerald-400" /> 4. Знаки химических элементов и Ar
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
            {ELEMENTS.map((e) => (
              <div key={e.s} className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-center">
                <div className="text-base font-bold text-white font-mono">{e.s}</div>
                <div className="text-[10px] text-zinc-500 truncate">{e.n}</div>
                <div className="text-[10px] text-emerald-400 font-mono">Ar={e.ar}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {MORE.map((e) => (
              <div key={e.s} className="p-2 bg-zinc-900 border border-amber-500/30 rounded-lg text-center">
                <div className="text-base font-bold text-amber-300 font-mono">{e.s}</div>
                <div className="text-[10px] text-zinc-500 truncate">{e.n}</div>
                <div className="text-[10px] text-emerald-400 font-mono">Ar={e.ar}</div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-sm font-mono text-zinc-400 mb-4">
            <p className="mb-2 text-zinc-200">// Правила записи знака:</p>
            <p>Первая буква — ЗАГЛАВНАЯ: H, O, C. Вторая — строчная: Na, Mg, Fe. «Ar=35.5» у хлора — единственная половинка в таблице.</p>
          </div>
          <Card className="bg-emerald-900/10 border-emerald-500/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-emerald-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: не путай Ag и Au</p>
                <p><b>Ag</b> — аргентум, серебро (от лат. argentum). <b>Au</b> — аурум, золото. Подсказка: «Ag — silver», «Au — золотое Au-ро».</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* TOPIC 5: AR / MR */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Scale className="text-emerald-400" /> 5. Относительная молекулярная масса Mr
          </h2>
          <Card className="bg-zinc-900/50 border-zinc-800 mb-4">
            <CardHeader><CardTitle className="text-sm text-emerald-400">Формула</CardTitle></CardHeader>
            <CardContent className="text-sm leading-relaxed space-y-1 font-mono">
              <div>Mr = сумма (Ar × индекс) всех элементов</div>
              <div className="text-zinc-500 text-xs">Mr — безразмерная величина (во сколько раз молекула тяжелее 1/12 атома углерода)</div>
            </CardContent>
          </Card>
              <div className="space-y-2 text-sm font-mono">
            {[
              { f: "H₂O", calc: "1×2 + 16 = 18", res: "Mr = 18" },
              { f: "CO₂", calc: "12 + 16×2 = 12 + 32 = 44", res: "Mr = 44" },
              { f: "NaCl", calc: "23 + 35.5 = 58.5", res: "Mr = 58.5" },
              { f: "CaCO₃", calc: "40 + 12 + 16×3 = 100", res: "Mr = 100" },
              { f: "H₂SO₄", calc: "1×2 + 32 + 16×4 = 98", res: "Mr = 98" },
            ].map((r) => (
              <div key={r.f} className="flex flex-wrap items-center gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                <span className="text-white font-bold w-16">{r.f}</span>
                <span className="text-zinc-500 flex-1">{r.calc}</span>
                <span className="text-emerald-400 font-bold">{r.res}</span>
              </div>
            ))}
          </div>
        </section>

        {/* TOPIC 6: ВАЛЕНТНОСТЬ + ИГРА */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Atom className="text-emerald-400" /> 6. Валентность: крест-накрест
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {[
              { v: "I", els: "H, Na, K, Ag, Cl (с металлами)" },
              { v: "II", els: "O, Mg, Ca, Ba, Zn, Cu(II)" },
              { v: "III", els: "Al, Fe(III)" },
              { v: "IV", els: "C, Si" },
            ].map((g) => (
              <div key={g.v} className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-center">
                <div className="text-lg font-bold text-emerald-400 font-mono">{g.v}</div>
                <div className="text-[10px] text-zinc-500 leading-snug">{g.els}</div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-sm font-mono text-zinc-400 mb-4">
            <p className="mb-2 text-zinc-200">// Правило: индексы = валентности крест-накрест (через НОК):</p>
            <p>Al(III) O(II) → НОК 6 → Al₂O₃. O почти всегда II; у кислотных остатков смотри по H.</p>
          </div>
          {/* Мини-игра: собери формулу */}
          <Card className="bg-zinc-900 border-emerald-500/30 shadow-xl overflow-hidden">
            <CardHeader className="bg-emerald-500/5 border-b border-emerald-500/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <FlaskConical className="w-5 h-5" /> Конструктор формул · раунд {roundIdx + 1}/{FORMULA_ROUNDS.length} · счёт {score}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-sm text-zinc-400 mb-6">Пара: <b className="text-white">{round.pair}</b> — выбери правильную формулу:</p>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {optOrder.map((oi) => {
                  const opt = round.options[oi];
                  const isPicked = picked === opt;
                  const showRight = picked !== null && opt === round.correct;
                  const showWrong = isPicked && opt !== round.correct;
                  return (
                    <button
                      key={opt}
                      onClick={() => pickFormula(opt)}
                      disabled={picked !== null}
                      className={cn(
                        "px-5 py-3 rounded-lg border font-mono text-xl font-bold transition-all",
                        showRight ? "border-green-500 text-green-400 bg-green-500/10" :
                        showWrong ? "border-red-500 text-red-500 bg-red-500/10" :
                        "bg-zinc-800 border-zinc-700 hover:border-emerald-400 hover:text-white text-zinc-300"
                      )}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {picked !== null && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
                  {picked === round.correct
                    ? <CheckCircle className="text-green-400 w-6 h-6" />
                    : <XCircle className="text-red-500 w-6 h-6" />}
                  <p className="text-sm text-zinc-400 flex-1">{round.why}</p>
                </div>
              )}
              <div className="flex justify-center">
                {roundIdx < FORMULA_ROUNDS.length - 1 ? (
                  <Button onClick={nextRound} disabled={picked === null} className="bg-emerald-500 text-black font-bold">Следующий раунд →</Button>
                ) : (
                  <Button onClick={() => { setRoundIdx(0); setPicked(null); setScore(0); setOptOrder(shuffleIndexes(FORMULA_ROUNDS[0].options.length)); }} disabled={picked === null} className="bg-emerald-500 text-black font-bold">
                    Играть заново (счёт: {score}/{FORMULA_ROUNDS.length})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* TOPIC 7: МАССОВАЯ ДОЛЯ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Scale className="text-emerald-400" /> 7. Массовая доля элемента ω
          </h2>
          <Card className="bg-zinc-900/50 border-zinc-800 mb-4">
            <CardHeader><CardTitle className="text-sm text-emerald-400">Формула</CardTitle></CardHeader>
            <CardContent className="text-sm leading-relaxed space-y-1 font-mono">
              <div>ω(элемента) = n · Ar / Mr × 100%</div>
              <div className="text-zinc-500 text-xs">n — число атомов элемента в формуле (индекс)</div>
            </CardContent>
          </Card>
          <div className="space-y-2 text-sm font-mono mb-4">
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
              <span className="text-white font-bold">ω(O) в H₂O:</span> <span className="text-zinc-500">1 · 16 / 18 × 100% = 88.9%… а у H: 2 · 1 / 18 ≈ 11.1%</span>
            </div>
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
              <span className="text-white font-bold">ω(Ca) в CaCO₃:</span> <span className="text-zinc-500">40 / 100 × 100% = 40%</span>
            </div>
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
              <span className="text-white font-bold">Проверка:</span> <span className="text-zinc-500">сумма всех ω = 100% (40 + 12 + 48 = 100 ✓)</span>
            </div>
          </div>
          <Card className="bg-emerald-900/10 border-emerald-500/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-emerald-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: порядок действий</p>
                <p>Сначала <b>Mr всего вещества</b>, потом ω. Не считай ω до Mr — половина ошибок на контрольной именно от этого.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* TOPIC 8: КВИЗ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <CheckCircle className="text-emerald-400" /> 8. Квиз: проверь загрузку · {quizIdx + 1}/{QUIZ.length} · счёт {quizScore}
          </h2>
          <Card className="bg-zinc-900 border-zinc-700">
            <CardContent className="p-6">
              <p className="text-sm font-bold text-white mb-5">{quiz.q}</p>
              <div className="grid gap-3">
                {quizOrder.map((oi) => {
                  const isRight = oi === quiz.correct;
                  const isPicked = quizPicked === oi;
                  return (
                    <button
                      key={oi}
                      onClick={() => pickQuiz(oi)}
                      disabled={quizPicked !== null}
                      className={cn(
                        "text-left px-4 py-3 rounded-lg border text-sm transition-all",
                        quizPicked !== null && isRight ? "border-green-500 text-green-400 bg-green-500/10" :
                        isPicked ? "border-red-500 text-red-500 bg-red-500/10" :
                        "border-zinc-700 bg-zinc-900 hover:border-emerald-400 text-zinc-300"
                      )}
                    >
                      {quiz.options[oi]}
                    </button>
                  );
                })}
              </div>
              {quizPicked !== null && (
                <div className="mt-4 flex items-start gap-2">
                  {quizPicked === quiz.correct ? <CheckCircle className="text-green-400 w-5 h-5 mt-0.5" /> : <XCircle className="text-red-500 w-5 h-5 mt-0.5" />}
                  <p className="text-xs text-zinc-400">{quiz.why}</p>
                </div>
              )}
              <div className="flex justify-center mt-5">
                {quizIdx < QUIZ.length - 1 ? (
                  <Button onClick={nextQuiz} disabled={quizPicked === null} className="bg-emerald-500 text-black font-bold">Дальше →</Button>
                ) : (
                  <Button onClick={() => { setQuizIdx(0); setQuizPicked(null); setQuizScore(0); setQuizOrder(shuffleIndexes(QUIZ[0].options.length)); }} disabled={quizPicked === null} className="bg-emerald-500 text-black font-bold">
                    Заново (итог: {quizScore}/{QUIZ.length})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* CTA: тест-бой предмета + межлинковка (task217) */}
        <VprCtaTest
          slug="chemistry-8"
          subjectTitle="Химия"
          nextHref="/vpr/algebra/8/cheatsheet"
          nextTitle="Алгебра"
          accentShadow="rgba(16,185,129,1)"
        />

        <footer className="text-center pb-20 text-zinc-700 text-[10px] font-mono uppercase tracking-widest">
          Generated with AI in CyberVibe Studio // 8th Grade Chemistry // No copyright, just Vibe.
        </footer>
      </div>
    </div>
  );
}
