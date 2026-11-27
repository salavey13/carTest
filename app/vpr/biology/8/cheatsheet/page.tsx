"use client";

import React, { useState } from "react";
import { ReadProgress } from "@/components/vpr/ReadProgress";
import { VprCtaTest } from "@/components/vpr/VprCtaTest";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  BookOpen, Lightbulb, Brain, Sparkles, Activity, User, Utensils, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * task220b: Биология — 8 класс. Курс «Человек» (Сонин/Колесов). ВПР-8:
 * анализ процессов жизнедеятельности, работа с текстом/схемами. Топ-темы:
 * нервная система (соматическая/вегетативная, рефлекс-дуга), железы
 * внутренней секреции и гормоны, обмен веществ (пластический/энергетический),
 * анализаторы, состав крови. Формат «запиши термин» — как любит ВПР.
 */

// ============ НЕРВНАЯ СИСТЕМА ============
const NERVOUS = [
  { part: "центральная (ЦНС)", comp: "спинной мозг + головной мозг", what: "обработка информации, принятие решений" },
  { part: "периферическая", comp: "нервы и нервные узлы", what: "связь ЦНС с органами" },
  { part: "соматическая", comp: "управляет скелетными мышцами", what: "ПОДЧИНЯЕТСЯ воле (двигаем рукой)" },
  { part: "вегетативная (автономная)", comp: "симпатическая + парасимпатическая", what: "НЕ подчиняется воле (сердце, кишечник)" },
];

const REFLEX_ARC = [
  { n: 1, name: "рецептор", desc: "принимает раздражение (кожа, глаз)" },
  { n: 2, name: "чувствительный нейрон", desc: "несёт сигнал В ЦНС" },
  { n: 3, name: "вставочный нейрон", desc: "в спинном/головном мозге — переключает" },
  { n: 4, name: "двигательный нейрон", desc: "несёт сигнал ОТ ЦНС к органу" },
  { n: 5, name: "рабочий орган", desc: "мышца или железа — отвечает действием" },
];

// ============ ЖЕЛЕЗЫ И ГОРМОНЫ (классика заданий «установи соответствие») ============
const GLANDS = [
  { gland: "гипофиз", place: "мозг", hormone: "гормон роста", effect: "рост костей; недостаток — карликовость, избыток — гигантизм" },
  { gland: "щитовидная", place: "шея", hormone: "тироксин (йодосодержащий)", effect: "обмен веществ; недостаток йода — зоб, у детей — кретинизм" },
  { gland: "надпочечники", place: "над почками", hormone: "адреналин", effect: "«гормон страха»: учащает сердце, мобилизует глюкозу" },
  { gland: "поджелудочная", place: "желудок", hormone: "инсулин", effect: "снижает сахар крови; недостаток — диабет" },
];

// ============ ОБМЕН ВЕЩЕСТВ ============
const METABOLISM = [
  { type: "пластический (ассимиляция)", what: "построение собственных белков, жиров, углеводов из пищи", energy: "поглощает энергию", when: "преобладает у детей (рост!)" },
  { type: "энергетический (диссимиляция)", what: "расщепление веществ с освобождением энергии", energy: "выделяет энергию (тепло + АТФ)", when: "усиливается при нагрузке, холоде" },
];

const VITAMINS = [
  { v: "A", src: "морковь, печень", lack: "куриная слепота" },
  { v: "B₁", src: "крупы, хлеб", lack: "болезнь бери-бери (нервы)" },
  { v: "C", src: "цитрусы, шиповник", lack: "цинга (дёсны, сосуды)" },
  { v: "D", src: "рыбий жир, солнце", lack: "рахит (кости)" },
];

// ============ КРОВЬ ============
const BLOOD = [
  { cell: "эритроциты", color: "text-rose-400", what: "красные, без ядра, гемоглобин → перенос O₂ и CO₂", num: "4,5–5 млн в 1 мм³" },
  { cell: "лейкоциты", color: "text-emerald-400", what: "белые, с ядром, амёбовидные → иммунитет, фагоцитоз", num: "6–8 тыс. в 1 мм³" },
  { cell: "тромбоциты", color: "text-amber-400", what: "кровяные пластинки → свёртывание крови", num: "250–400 тыс. в 1 мм³" },
  { cell: "плазма", color: "text-cyan-400", what: "жидкая часть (90% вода, белки) → перенос веществ", num: "~55% объёма" },
];

// ============ КВИЗ ============
const QUIZ = [
  {
    q: "Запишите термин: «Клетки крови, способные к фагоцитозу — захвату и перевариванию чужеродных частиц»",
    options: ["эритроциты", "лейкоциты", "тромбоциты", "лимфоциты плазмы"],
    correct: 1,
    hint: "Лейкоциты — белые кровяные клетки иммунитета. Эритроциты — газы, тромбоциты — свёртывание.",
  },
  {
    q: "Какой отдел нервной системы НЕ подчиняется воле человека?",
    options: ["соматический", "вегетативный", "спинной мозг", "кора больших полушарий"],
    correct: 1,
    hint: "Вегетативная (автономная) управляет внутренними органами: сердцем, кишечником, желёзами.",
  },
  {
    q: "Правильная последовательность рефлекторной дуги:",
    options: [
      "рецептор → чувствительный нейрон → вставочный → двигательный → рабочий орган",
      "рабочий орган → двигательный нейрон → рецептор",
      "вставочный нейрон → рецептор → чувствительный → орган",
      "двигательный → вставочный → рецептор",
    ],
    correct: 0,
    hint: "Путь сигнала: приняли → донесли В ЦНС → переключили → донесли ИЗ ЦНС → действие.",
  },
  {
    q: "Гормон роста вырабатывает:",
    options: ["щитовидная железа", "гипофиз", "надпочечники", "поджелудочная железа"],
    correct: 1,
    hint: "Гипофиз — «дирижёр» желез (нижний мозговой придаток). Щитовидная — тироксин, надпочечники — адреналин.",
  },
  {
    q: "Недостаток инсулина приводит к:",
    options: ["диабету", "зобу", "рахиту", "карликовости"],
    correct: 0,
    hint: "Инсулин (поджелудочная) снижает сахар крови. Нет инсулина → сахар в крови и моче → диабет.",
  },
  {
    q: "Рост организма ребёнка обеспечивается преимущественно обменом:",
    options: ["энергетическим", "пластическим", "водным", "газовым"],
    correct: 1,
    hint: "Пластический = построение тканей (ассимиляция преобладает у растущих организмов).",
  },
  {
    q: "При недостатке витамина C развивается:",
    options: ["цинга", "рахит", "куриная слепота", "бери-бери"],
    correct: 0,
    hint: "C (цитрусы, шиповник) → дёсны и сосуды: цинга. D → рахит, A → слепота, B₁ → бери-бери.",
  },
  {
    q: "Гемоглобин содержится в:",
    options: ["плазме", "тромбоцитах", "эритроцитах", "лейкоцитах"],
    correct: 2,
    hint: "Гемоглобин — белок эритроцитов с железом: присоединяет O₂ (артериальная кровь алая) и CO₂.",
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
            <Brain className="w-5 h-5 text-emerald-400" /> Вопрос {Math.min(idx + 1, order.length)}/{order.length}
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
                      picked === null && "border-zinc-700 hover:border-emerald-500/50"
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
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
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
                ? "Биологический сканер загружен."
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

export default function BiologyCheatsheet8() {
  return (
    <div className="min-h-screen bg-[#030712] text-zinc-200 relative">
      <ReadProgress />
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

        {/* ============ HEADER + HERO ============ */}
        <motion.header initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-14">
          <div className="flex items-center gap-2 mb-4">
            <Link href="/vpr-tests" className="text-xs font-mono text-zinc-500 hover:text-emerald-400 transition-colors uppercase tracking-widest">
              ← VPR_tests
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest">биология // 8 класс</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight mb-4">
            Биология <span className="text-emerald-400">8 класса</span>
            <span className="block text-xl sm:text-2xl text-zinc-400 font-bold mt-2">Человек: НС · Гормоны · Обмен веществ</span>
          </h1>
          {/* HERO-иллюстрация (task220) */}
          <div className="relative mb-6 overflow-hidden rounded-none border border-emerald-500/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/biology-8.jpg"
              alt="Биология 8 класс — неоновая иллюстрация"
              className="w-full h-auto opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent" />
          </div>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-2xl">
            Биология 8 класса — анатомия человека. ВПР любит: термин по определению,
            последовательность рефлекторной дуги, соответствие «железа → гормон → эффект»
            и анализ процессов обмена веществ. Всё это — здесь.
          </p>
          <div className="flex flex-wrap gap-2 mt-6">
            {["4 отдела НС", "рефлекторная дуга", "4 железы", "кровь ×4", "квиз 8"].map((t) => (
              <span key={t} className="px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-[10px] font-mono text-emerald-300/80 uppercase tracking-wider">
                {t}
              </span>
            ))}
          </div>
        </motion.header>

        {/* ============ TOPIC 1: НЕРВНАЯ СИСТЕМА ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Activity className="text-emerald-400" /> 1. Нервная система: карта отделов
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {NERVOUS.map((n) => (
              <div key={n.part} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
                <div className="text-emerald-400 font-bold text-[13px] mb-1">{n.part}</div>
                <div className="text-zinc-400 text-[12px] mb-1">{n.comp}</div>
                <div className="text-zinc-600 text-[11px]">{n.what}</div>
              </div>
            ))}
          </div>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle className="font-mono text-sm text-white">Рефлекторная дуга: 5 звеньев</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {REFLEX_ARC.map((r, i) => (
                  <motion.div
                    key={r.n}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.07 }}
                    className="p-3 bg-black/30 rounded-lg border border-zinc-800 text-center"
                  >
                    <div className="w-6 h-6 mx-auto mb-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-bold text-[11px]">
                      {r.n}
                    </div>
                    <div className="text-white font-semibold text-[12px] mb-0.5">{r.name}</div>
                    <div className="text-zinc-600 text-[10px] leading-snug">{r.desc}</div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-emerald-950/10 border-emerald-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-emerald-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: соматическая vs вегетативная</p>
                <p>Можешь по желанию пошевелить рукой — соматическая. Сердце «приказать биться медленнее» не можешь — вегетативная. Симпатический отдел («газ»: стресс, адреналин), парасимпатический («тормоз»: покой, пищеварение).</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 2: ЖЕЛЕЗЫ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <ShieldCheck className="text-rose-400" /> 2. Железы внутренней секреции
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-zinc-800 text-left">
                  <th className="py-2 pr-4 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Железа</th>
                  <th className="py-2 pr-4 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Где</th>
                  <th className="py-2 pr-4 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Гормон</th>
                  <th className="py-2 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Эффект / болезнь</th>
                </tr>
              </thead>
              <tbody>
                {GLANDS.map((g) => (
                  <tr key={g.gland} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                    <td className="py-2.5 pr-4 text-rose-400 font-semibold">{g.gland}</td>
                    <td className="py-2.5 pr-4 text-zinc-400">{g.place}</td>
                    <td className="py-2.5 pr-4 text-white font-medium">{g.hormone}</td>
                    <td className="py-2.5 text-zinc-500">{g.effect}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Card className="bg-rose-950/10 border-rose-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-rose-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: железы vs железы внешней секреции</p>
                <p>Внутренней секреции (эндокринные) выливают гормоны В КРОВЬ (без протоков). Слюнные, потовые — внешней: у них есть протоки и «продукт» наружу. В задании смотри: гормон в кровь — эндокринная.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 3: ОБМЕН ВЕЩЕСТВ + ВИТАМИНЫ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Utensils className="text-amber-400" /> 3. Обмен веществ и витамины
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {METABOLISM.map((m) => (
              <Card key={m.type} className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4">
                  <div className="text-amber-400 font-bold text-[13px] mb-1">{m.type}</div>
                  <div className="text-zinc-400 text-[12px] mb-1">{m.what}</div>
                  <div className="text-[11px] font-mono text-emerald-400 mb-1">{m.energy}</div>
                  <div className="text-zinc-600 text-[11px]">{m.when}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle className="font-mono text-sm text-white">Витамины: недостаток → болезнь</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {VITAMINS.map((v) => (
                  <div key={v.v} className="p-3 bg-black/30 rounded-lg border border-zinc-800 text-center">
                    <div className="text-amber-400 font-mono font-bold text-sm mb-1">вит. {v.v}</div>
                    <div className="text-zinc-500 text-[10px] mb-1">{v.src}</div>
                    <div className="text-rose-300/80 text-[10px] font-medium">нет → {v.lack}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 4: КРОВЬ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <User className="text-rose-400" /> 4. Состав крови
          </h2>
          <div className="space-y-2">
            {BLOOD.map((b) => (
              <div key={b.cell} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                <span className={cn("font-mono font-bold text-sm min-w-[120px]", b.color)}>{b.cell}</span>
                <span className="text-zinc-300 text-[13px] flex-1">{b.what}</span>
                <span className="text-zinc-600 text-[11px] font-mono">{b.num}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ============ TOPIC 5: КВИЗ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Brain className="text-emerald-400" /> 5. Квиз: формат ВПР
          </h2>
          <VprQuizInline quiz={QUIZ} />
        </section>

        {/* CTA */}
        <VprCtaTest
          slug="biology-8"
          subjectTitle="Биология"
          nextHref="/vpr/geography/8/cheatsheet"
          nextTitle="География"
          accentShadow="rgba(16,185,129,1)"
        />
      </div>
    </div>
  );
}
