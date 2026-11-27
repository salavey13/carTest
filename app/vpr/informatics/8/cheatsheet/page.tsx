"use client";

import React, { useState } from "react";
import { ReadProgress } from "@/components/vpr/ReadProgress";
import { VprCtaTest } from "@/components/vpr/VprCtaTest";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  BookOpen, Lightbulb, Brain, Sparkles, Binary, Repeat, Table, Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * task220b: Информатика — 8 класс. По КИМ ВПР-8: системы счисления
 * (перевод, двоичная арифметика), алгоритмы и исполнители (Робот, циклы),
 * элементы теории алгоритмов (блок-схемы), электронные таблицы (формулы,
 * диапазоны), логические выражения. Два урока, 12 заданий, две части.
 */

// ============ СИСТЕМЫ СЧИСЛЕНИЯ ============
const NUM_SYSTEMS = [
  { base: "2 (двоичная)", digits: "0, 1", use: "язык процессора", ex: "1011₂ = 11₁₀" },
  { base: "8 (восьмеричная)", digits: "0–7", use: "компактная запись групп по 3 бита", ex: "13₈ = 11₁₀" },
  { base: "16 (шестнадцатеричная)", digits: "0–9, A–F", use: "цвета в вебе, адреса памяти", ex: "B₁₆ = 11₁₀" },
  { base: "10 (десятичная)", digits: "0–9", use: "повседневная", ex: "11₁₀" },
];

const CONVERT_STEPS = [
  { n: 1, how: "10 → 2: делим на 2 с остатками, читаем остатки СНИЗУ ВВЕРХ", ex: "11 → 11:2=5(1), 5:2=2(1), 2:2=1(0), 1:2=0(1) → 1011" },
  { n: 2, how: "2 → 10: разряды-степени двойки справа налево (1,2,4,8…), складываем веса единиц", ex: "1011 = 8+0+2+1 = 11" },
  { n: 3, how: "2 → 8: группы по 3 бита справа", ex: "1 011 → 1|011 → 13₈" },
  { n: 4, how: "2 → 16: группы по 4 бита справа", ex: "1011 → B₁₆" },
];

// ============ АЛГОРИТМЫ ============
const ALGO_CONSTRUCTS = [
  { c: "линейный", what: "действия подряд, одно за другим", ex: "ввод → вычисление → вывод" },
  { c: "ветвление (если)", what: "выбор одной из двух ветвей по условию", ex: "если x > 0 → «положительное», иначе → «нет»" },
  { c: "цикл «для» (со счётчиком)", what: "повторить N раз", ex: "для i от 1 до 10: S := S + i" },
  { c: "цикл «пока» (с условием)", what: "повторять, пока условие истинно", ex: "пока n > 1: n := n div 2; k := k + 1" },
];

const ROBOT = [
  { cmd: "вправо / влево / вверх / вниз", what: "сдвиг на одну клетку" },
  { cmd: "закрасить", what: "закрасить текущую клетку" },
  { cmd: "нц N раз … кц", what: "цикл: тело повторяется N раз" },
  { cmd: "если справа стена …", what: "проверка условия (стена/свободно)" },
];

// ============ ЭЛЕКТРОННЫЕ ТАБЛИЦЫ ============
const SPREADSHEET = [
  { n: "адрес клетки", what: "столбец-буква + строка-число: B3", note: "A1 — левый верхний угол" },
  { n: "диапазон", what: "A1:C5 — прямоугольник клеток", note: "двоеточие = «от…до»" },
  { n: "формула", what: "начинается со знака = ; =A1+B2*2", note: "порядок действий как в математике" },
  { n: "функции", what: "=СУММ(A1:A10), =МАКС, =МИН, =СРЗНАЧ", note: "в англ.: SUM, MAX, MIN, AVERAGE" },
  { n: "копирование формул", what: "адреса СДВИГАЮТСЯ на столько клеток, на сколько скопировали (относительная ссылка)", note: "=A1 из B1 в C1 → =B1" },
  { n: "абсолютная ссылка", what: "$A$1 — при копировании НЕ меняется", note: "для констант (курс, %)" },
];

// ============ ЛОГИКА ============
const LOGIC = [
  { op: "И (конъюнкция, ∧)", res: "истина, только если ОБА истинны", ex: "1 ∧ 0 = 0" },
  { op: "ИЛИ (дизъюнкция, ∨)", res: "истина, если ХОТЯ БЫ ОДИН истинен", ex: "1 ∨ 0 = 1" },
  { op: "НЕ (инверсия, ¬)", res: "меняет значение на противоположное", ex: "¬1 = 0" },
];

// ============ КВИЗ ============
const QUIZ = [
  {
    q: "Переведите 1011₂ в десятичную систему:",
    options: ["9", "11", "13", "1011"],
    correct: 1,
    hint: "Веса разрядов: 8 4 2 1 → 1·8 + 0·4 + 1·2 + 1·1 = 11.",
  },
  {
    q: "Переведите 25₁₀ в двоичную:",
    options: ["10011", "11001", "10101", "11010"],
    correct: 1,
    hint: "25:2=12(1), 12:2=6(0), 6:2=3(0), 3:2=1(1), 1:2=0(1). Остатки снизу вверх: 11001. Проверка: 16+8+1=25 ✓",
  },
  {
    q: "Сколько единиц в двоичной записи числа 12?",
    options: ["1", "2", "3", "4"],
    correct: 1,
    hint: "12 = 8 + 4 = 1100₂ → две единицы.",
  },
  {
    q: "Исполнитель Робот стоит в клетке. Команда «нц 3 раз вправо; закрасить кц» — что произойдёт?",
    options: [
      "закрасит 3 клетки, сместившись на 3 вправо",
      "закрасит 1 клетку",
      "закрасит текущую и уйдёт вправо",
      "сдвинется на 3 вправо без закраски",
    ],
    correct: 0,
    hint: "Тело цикла повторяется 3 раза: каждое повторение = сдвиг + закраска → 3 закрашенные клетки через одну позицию.",
  },
  {
    q: "В клетке C2 записано =A2+B2. Формулу скопировали в клетку D2. Что там окажется?",
    options: ["=A2+B2", "=B2+C2", "=A3+B3", "=C2+D2"],
    correct: 1,
    hint: "Копирование на 1 столбец вправо → буквы сдвигаются на 1: A→B, B→C. Числа не изменились (строка та же).",
  },
  {
    q: "Чему равно значение логического выражения: 1 ИЛИ 0 И НЕ 1?",
    options: ["0", "1", "2", "ошибка"],
    correct: 1,
    hint: "Порядок: НЕ → И → ИЛИ. НЕ 1 = 0; 0 И 0 = 0; 1 ИЛИ 0 = 1.",
  },
  {
    q: "Какая функция найдёт СРЕДНЕЕ значение диапазона A1:A10?",
    options: ["=СУММ(A1:A10)", "=МАКС(A1:A10)", "=СРЗНАЧ(A1:A10)", "=МИН(A1:A10)"],
    correct: 2,
    hint: "СРЗНАЧ (AVERAGE) — среднее арифметическое. СУММ — сумма, МАКС/МИН — крайние значения.",
  },
  {
    q: "Цикл «пока» отличается от цикла «для» тем, что…",
    options: [
      "число повторений заранее неизвестно",
      "он выполняется быстрее",
      "у него нет тела",
      "он всегда бесконечный",
    ],
    correct: 0,
    hint: "«Для» — счётчик (известно число шагов). «Пока» — условие: повторяется, пока истинно; заранее неизвестно, сколько итераций.",
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
            <Brain className="w-5 h-5 text-green-400" /> Вопрос {Math.min(idx + 1, order.length)}/{order.length}
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
                      picked === null && "border-zinc-700 hover:border-green-500/50"
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
                  className="bg-green-500 hover:bg-green-400 text-black font-bold"
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
                ? "Цифровой движок загружен."
                : "Перечитай схемы выше и вернись: feed → fight → fail → repeat."}
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

export default function InformaticsCheatsheet8() {
  return (
    <div className="min-h-screen bg-[#030712] text-zinc-200 relative">
      <ReadProgress />
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

        {/* ============ HEADER + HERO ============ */}
        <motion.header initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-14">
          <div className="flex items-center gap-2 mb-4">
            <Link href="/vpr-tests" className="text-xs font-mono text-zinc-500 hover:text-green-400 transition-colors uppercase tracking-widest">
              ← VPR_tests
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="text-xs font-mono text-green-400 uppercase tracking-widest">информатика // 8 класс</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight mb-4">
            Информатика <span className="text-green-400">8 класса</span>
            <span className="block text-xl sm:text-2xl text-zinc-400 font-bold mt-2">Системы счисления · Алгоритмы · Таблицы</span>
          </h1>
          {/* HERO-иллюстрация (task220) */}
          <div className="relative mb-6 overflow-hidden rounded-none border border-green-500/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/informatics-8.jpg"
              alt="Информатика 8 класс — неоновая иллюстрация"
              className="w-full h-auto opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent" />
          </div>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-2xl">
            ВПР по информатике в 8 классе — два урока и 12 заданий: переводы между
            системами счисления, программы для исполнителя Робот, анализ электронных
            таблиц и логические выражения. Всё, что решается алгоритмом — здесь.
          </p>
          <div className="flex flex-wrap gap-2 mt-6">
            {["4 системы счисления", "конвертация ×4", "Робот + циклы", "таблицы ×6", "квиз 8"].map((t) => (
              <span key={t} className="px-3 py-1 rounded-full border border-green-500/20 bg-green-500/5 text-[10px] font-mono text-green-300/80 uppercase tracking-wider">
                {t}
              </span>
            ))}
          </div>
        </motion.header>

        {/* ============ TOPIC 1: СИСТЕМЫ СЧИСЛЕНИЯ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Binary className="text-green-400" /> 1. Системы счисления
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {NUM_SYSTEMS.map((n, i) => (
              <motion.div
                key={n.base}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 4) * 0.05 }}
                className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl"
              >
                <div className="text-green-400 font-mono font-bold text-sm mb-1">{n.base}</div>
                <div className="text-zinc-400 text-[12px]">цифры: <span className="font-mono">{n.digits}</span></div>
                <div className="text-zinc-600 text-[11px] mb-1">{n.use}</div>
                <div className="text-zinc-500 text-[11px] font-mono">{n.ex}</div>
              </motion.div>
            ))}
          </div>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle className="font-mono text-sm text-white">Как переводить: 4 приёма</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {CONVERT_STEPS.map((s) => (
                <div key={s.n} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 p-3 bg-black/30 rounded border border-zinc-800">
                  <div className="w-6 h-6 shrink-0 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-400 font-mono font-bold text-[11px]">
                    {s.n}
                  </div>
                  <span className="text-zinc-300 text-[12px] flex-1">{s.how}</span>
                  <span className="text-zinc-600 text-[11px] font-mono">{s.ex}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="bg-green-950/10 border-green-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-green-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: степени двойки до 1024</p>
                <p>1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024 — выучи как таблицу умножения. Перевод 2→10 превращается в «сложи веса единиц», а 1011 сразу читается как 8+2+1 = 11.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 2: АЛГОРИТМЫ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Repeat className="text-cyan-400" /> 2. Алгоритмические конструкции и Робот
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {ALGO_CONSTRUCTS.map((a, i) => (
              <motion.div
                key={a.c}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 4) * 0.05 }}
                className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl"
              >
                <div className="text-cyan-400 font-bold text-[13px] mb-1">{a.c}</div>
                <div className="text-zinc-400 text-[12px] mb-2">{a.what}</div>
                <div className="text-zinc-600 text-[11px] font-mono">{a.ex}</div>
              </motion.div>
            ))}
          </div>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle className="font-mono text-sm text-white flex items-center gap-2"><Cpu className="w-4 h-4 text-green-400" /> Школьный исполнитель Робот</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {ROBOT.map((r) => (
                <div key={r.cmd} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                  <span className="text-green-400 font-mono text-[12px] min-w-[220px]">{r.cmd}</span>
                  <span className="text-zinc-400 text-[12px]">{r.what}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="bg-cyan-950/10 border-cyan-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-cyan-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: трассировка по клеткам</p>
                <p>Задание с Роботом решается рисованием: начерти поле, отмечай позицию после КАЖДОЙ итерации цикла. Ошибка «в уме на 3 хода вперёд» — главная причина потери балла.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 3: ЭЛЕКТРОННЫЕ ТАБЛИЦЫ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Table className="text-amber-400" /> 3. Электронные таблицы
          </h2>
          <div className="space-y-2">
            {SPREADSHEET.map((s) => (
              <div key={s.n} className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 mb-1">
                  <span className="text-amber-400 font-semibold text-[13px] min-w-[190px]">{s.n}</span>
                  <span className="text-zinc-300 text-[13px] flex-1">{s.what}</span>
                </div>
                <div className="text-zinc-600 text-[11px] font-mono">{s.note}</div>
              </div>
            ))}
          </div>
          <Card className="bg-amber-950/10 border-amber-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-amber-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: копия формулы = сдвиг адресов</p>
                <p>Формулу из C1 скопировали в D1 → все относительные адреса сдвинулись на 1 вправо (A→B). Знак $ «прибивает» адрес: $A$1 не сдвигается никогда. В заданиях ВПР просто мысленно сдвинь каждую букву и цифру.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 4: ЛОГИКА ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <BookOpen className="text-rose-400" /> 4. Логические выражения
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {LOGIC.map((l, i) => (
              <motion.div
                key={l.op}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center"
              >
                <div className="text-rose-400 font-mono font-bold text-sm mb-2">{l.op}</div>
                <div className="text-zinc-400 text-[12px] mb-2">{l.res}</div>
                <div className="text-zinc-500 text-[12px] font-mono">{l.ex}</div>
              </motion.div>
            ))}
          </div>
          <Card className="bg-rose-950/10 border-rose-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-rose-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: порядок НЕ → И → ИЛИ</p>
                <p>Как в математике «степень раньше умножения»: сначала НЕ, потом И, потом ИЛИ. Скобки нарушают порядок. Если сомневаешься — подставь 0 и 1 во все переменные и просчитай.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 5: КВИЗ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Brain className="text-green-400" /> 5. Квиз: формат ВПР
          </h2>
          <VprQuizInline quiz={QUIZ} />
        </section>

        {/* CTA */}
        <VprCtaTest
          slug="informatics-8"
          subjectTitle="Информатика"
          nextHref="/vpr/probability/8/cheatsheet"
          nextTitle="Вероятность и статистика"
          accentShadow="rgba(34,197,94,1)"
        />
      </div>
    </div>
  );
}
