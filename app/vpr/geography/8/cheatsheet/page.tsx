"use client";

import React, { useState } from "react";
import { ReadProgress } from "@/components/vpr/ReadProgress";
import { VprCtaTest } from "@/components/vpr/VprCtaTest";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  BookOpen, Lightbulb, Brain, Sparkles, Map, Mountain, Users, Factory,
} from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * task220b: География — 8 класс. Курс «География России» (природа и
 * население). ВПР-8: анализ карт, определение по описанию, работа со
 * статистикой/климатограммами. Топ-темы: географическое положение, рельеф
 * и полезные ископаемые, климат (типы воздушных масс, Атлантика), моря и
 * реки, природные зоны, население России.
 */

// ============ ГЕОГРАФИЧЕСКОЕ ПОЛОЖЕНИЕ ============
const GPO = [
  { fact: "площадь", val: "17,1 млн км² — 1-е место в мире" },
  { fact: "северная точка", val: "м. Флигели (Земля Франца-Иосифа); материковая — м. Челюскин" },
  { fact: "южная точка", val: "г. Базардюзю (Дагестан, Кавказ)" },
  { fact: "протяжённость", val: "с запада на восток ~9000 км (11 часовых поясов!), с севера на юг ~4000 км" },
  { fact: "границы", val: "16 сухопутных соседей; морские — 3 океана (Сев. Ледовитый, Тихий, Атлантический)" },
];

// ============ РЕЛЬЕФ: тектоника → горы/равнины ============
const RELIEF = [
  { form: "Восточно-Европейская равнина", base: "Русская платформа", what: "низменности и возвышенности, высоты < 400 м" },
  { form: "Западно-Сибирская равнина", base: "молодая плита", what: "плоская, низменная, сильно заболочена" },
  { form: "Среднесибирское плоскогорье", base: "древняя платформа", what: "ступенчатые плато, 500–700 м, реки в каньонах" },
  { form: "Уральские горы", base: "область герцинской складчатости", what: "старые, разрушенные, высшая точка — г. Народная 1895 м" },
  { form: "Кавказ", base: "область альпийской складчатости", what: "молодые, высокие: Эльбрус 5642 м — высшая точка РФ" },
  { form: "Алтай, Саяны", base: "области каледонской/герцинской складчатости", what: "юг Сибири, Белуха 4506 м" },
];

// ============ КЛИМАТ ============
const CLIMATE = [
  { factor: "широтное положение", effect: "уменьшение угла падения солнечных лучей → от арктического до субтропического климата" },
  { factor: "Атлантический океан", effect: "западный перенос: циклоны несут тепло и влагу на запад ЕЧР (морской климат запада)" },
  { factor: "Северный Ледовитый океан", effect: "арктические воздушные массы: холод и сухость севера" },
  { factor: "континентальность", effect: "нарастает с запада на восток: амплитуда температур растёт, осадков меньше" },
  { factor: "Азиатский максимум (зима)", effect: "область высокого давления в Сибири → ясые морозные зимы, мало снега" },
  { factor: "рельеф", effect: "Кавказ и горы юга Сибири — барьер: на наветренных склонах осадков много, за горами — мало" },
];

// ============ ВОДЫ ============
const WATERS = [
  { type: "реки питания", val: "снеговое (большинство), дождевое (юг Дальнего Востока), ледниковое (Кавказ), грунтовое" },
  { type: "режимы", val: "равнинные: весеннее половодье (снег); горные: летнее половодье (ледники и дожди)" },
  { type: "крупнейшие бассейны", val: "Обь, Енисей, Лена (Сев. Ледовитый); Волга (Каспий); Амур (Тихий)" },
  { type: "самое глубокое озеро", val: "Байкал — 1642 м, 20% мировых пресных вод" },
  { type: "Каспийское море", val: "крупнейшее бессточное озеро мира (уровень ниже океана)" },
];

// ============ НАСЕЛЕНИЕ ============
const POPULATION = [
  { idx: "численность", val: "~146 млн (9-е место в мире)" },
  { idx: "плотность", val: "~8,5 чел/км²; европейская часть — в разы плотнее азиатской" },
  { idx: "урбанизация", val: "~75% горожан; города-миллионеры: Москва, СПб, Новосибирск и др." },
  { idx: "размещение", val: "главная полоса расселения — юг: комфортный климат + транспорт (Транссиб)" },
  { idx: "миграции", val: "запад «втягивает» (Москва, СПб), Дальний Восток и север теряют население" },
  { idx: "народы", val: "193 народа; славяне ~80%; татары — крупнейший после русских этнос" },
]

// ============ КВИЗ ============
const QUIZ = [
  {
    q: "Высшая точка России:",
    options: ["г. Народная", "Эльбрус", "Белуха", "пик Победы"],
    correct: 1,
    hint: "Эльбрус 5642 м (Кавказ, альпийская складчатость). Народная — Урал (1895 м), Белуха — Алтай.",
  },
  {
    q: "Какая равнина сильно заболочена и имеет плоский рельеф?",
    options: ["Восточно-Европейская", "Западно-Сибирская", "Среднесибирское плоскогорье", "Прикаспийская"],
    correct: 1,
    hint: "Западно-Сибирская — молодая плита, плоская, плохо дренируется → болота (Васюганье).",
  },
  {
    q: "Почему в Сибири зимы морозные и малоснежные?",
    options: [
      "влияние Атлантики",
      "Азиатский максимум — область высокого давления",
      "холодное течение",
      "близость океана",
    ],
    correct: 1,
    hint: "Зимой над Сибирью — антициклон: ясное небо, сильное выхолаживание, осадков мало.",
  },
  {
    q: "20% мировых запасов пресной воды — это:",
    options: ["Ладожское озеро", "Каспийское море", "Байкал", "Аральское море"],
    correct: 2,
    hint: "Байкал — глубочайшее озеро мира (1642 м), древняя котловина рифта.",
  },
  {
    q: "Река Амур впадает в:",
    options: ["Северный Ледовитый океан", "Тихий океан", "Каспийское море", "Атлантический океан"],
    correct: 1,
    hint: "Амур — единственная великая река бассейна Тихого океана (граница с Китаем).",
  },
  {
    q: "Главная полоса расселения России проходит по югу страны из-за:",
    options: [
      "только климата",
      "климата + транспортных путей (Транссиб) + истории освоения",
      "месторождений нефти",
      "соседей",
    ],
    correct: 1,
    hint: "Комплекс факторов: комфортнее климат, историческое освоение, магистрали. Север — районы Крайнего Севера с очаговым заселением.",
  },
  {
    q: "Континентальность климата в России растёт:",
    options: ["с юга на север", "с запада на восток", "с востока на запад", "не меняется"],
    correct: 1,
    hint: "Чем дальше от Атлантики, тем меньше её смягчающее влияние: амплитуда температур растёт, зимы холоднее, осадков меньше.",
  },
  {
    q: "Реки Кавказа имеют питание:",
    options: ["снеговое", "ледниковое + дождевое (летнее половодье)", "грунтовое", "испарение"],
    correct: 1,
    hint: "Горные реки: таяние ледников и дожди летом → половодье летом (в отличие от равнинных с весенним).",
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
            <Brain className="w-5 h-5 text-teal-400" /> Вопрос {Math.min(idx + 1, order.length)}/{order.length}
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
                      picked === null && "border-zinc-700 hover:border-teal-500/50"
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
                  className="bg-teal-500 hover:bg-teal-400 text-black font-bold"
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
                ? "Географическая сетка загружена."
                : "Перечитай блоки выше и вернись: feed → fight → fail → repeat."}
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

export default function GeographyCheatsheet8() {
  return (
    <div className="min-h-screen bg-[#030712] text-zinc-200 relative">
      <ReadProgress />
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

        {/* ============ HEADER + HERO ============ */}
        <motion.header initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-14">
          <div className="flex items-center gap-2 mb-4">
            <Link href="/vpr-tests" className="text-xs font-mono text-zinc-500 hover:text-teal-400 transition-colors uppercase tracking-widest">
              ← VPR_tests
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="text-xs font-mono text-teal-400 uppercase tracking-widest">география // 8 класс</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight mb-4">
            География <span className="text-teal-400">8 класса</span>
            <span className="block text-xl sm:text-2xl text-zinc-400 font-bold mt-2">Природа России · Население</span>
          </h1>
          {/* HERO-иллюстрация (task220) */}
          <div className="relative mb-6 overflow-hidden rounded-none border border-teal-500/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/geography-8.jpg"
              alt="География 8 класс — неоновая иллюстрация"
              className="w-full h-auto opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent" />
          </div>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-2xl">
            География 8 класса — вся Россия: от ГПО и рельефа до населения.
            ВПР любит задания «определи по описанию» и анализ климатограмм.
            Ключ — связывать форму рельефа с тектоникой, а климат — с факторами.
          </p>
          <div className="flex flex-wrap gap-2 mt-6">
            {["5 фактов ГПО", "6 форм рельефа", "6 факторов климата", "население ×6", "квиз 8"].map((t) => (
              <span key={t} className="px-3 py-1 rounded-full border border-teal-500/20 bg-teal-500/5 text-[10px] font-mono text-teal-300/80 uppercase tracking-wider">
                {t}
              </span>
            ))}
          </div>
        </motion.header>

        {/* ============ TOPIC 1: ГПО ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Map className="text-teal-400" /> 1. Географическое положение: крайние факты
          </h2>
          <div className="space-y-2">
            {GPO.map((g) => (
              <div key={g.fact} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                <span className="text-teal-400 font-semibold text-[13px] min-w-[160px]">{g.fact}</span>
                <span className="text-zinc-300 text-[13px]">{g.val}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ============ TOPIC 2: РЕЛЬЕФ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Mountain className="text-amber-400" /> 2. Рельеф: тектоника решает
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-zinc-800 text-left">
                  <th className="py-2 pr-4 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Форма</th>
                  <th className="py-2 pr-4 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Строение</th>
                  <th className="py-2 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Черты</th>
                </tr>
              </thead>
              <tbody>
                {RELIEF.map((r) => (
                  <tr key={r.form} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                    <td className="py-2.5 pr-4 text-amber-400 font-semibold">{r.form}</td>
                    <td className="py-2.5 pr-4 text-zinc-400">{r.base}</td>
                    <td className="py-2.5 text-zinc-500">{r.what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Card className="bg-amber-950/10 border-amber-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-amber-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: платформа → равнина, складчатость → горы</p>
                <p>Главное правило заданий «объясни рельеф»: устойчивая платформа (щит/плита) = равнина; область складчатости (герцинская = старые низкие горы, альпийская = молодые высокие). Урал низкий, потому что он герцинский и разрушен.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 3: КЛИМАТ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Mountain className="text-cyan-400" /> 3. Климат: 6 факторов
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CLIMATE.map((c, i) => (
              <motion.div
                key={c.factor}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 4) * 0.05 }}
                className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl"
              >
                <div className="text-cyan-400 font-bold text-[13px] mb-1">{c.factor}</div>
                <div className="text-zinc-400 text-[12px] leading-relaxed">{c.effect}</div>
              </motion.div>
            ))}
          </div>
          <Card className="bg-cyan-950/10 border-cyan-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-cyan-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: читаем климатограмму</p>
                <p>Амплитуда (max − min) маленькая → морской климат, большая → континентальный. Осадки летом и ровные температуры — западе ЕЧР (Атлантика); годовой максимум осадков летом в континентальном — муссон Дальнего Востока.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 4: ВОДЫ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <BookOpen className="text-blue-400" /> 4. Внутренние воды
          </h2>
          <div className="space-y-2">
            {WATERS.map((w) => (
              <div key={w.type} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                <span className="text-blue-400 font-semibold text-[13px] min-w-[180px]">{w.type}</span>
                <span className="text-zinc-300 text-[13px]">{w.val}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ============ TOPIC 5: НАСЕЛЕНИЕ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Users className="text-rose-400" /> 5. Население России
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {POPULATION.map((p, i) => (
              <div key={p.idx} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
                <div className="text-rose-400 font-bold text-[13px] mb-1">{p.idx}</div>
                <div className="text-zinc-400 text-[12px]">{p.val}</div>
              </div>
            ))}
          </div>
          <Card className="bg-rose-950/10 border-rose-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Factory className="text-rose-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: «объясни размещение населения»</p>
                <p>Формула ответа ВПР: климат (юг комфортнее) + история (освоение шло с запада) + транспорт (Транссиб, реки) + работа (промышленность юга Сибири). Не один фактор — комбинация!</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 6: КВИЗ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Brain className="text-teal-400" /> 6. Квиз: формат ВПР
          </h2>
          <VprQuizInline quiz={QUIZ} />
        </section>

        {/* CTA */}
        <VprCtaTest
          slug="geography-8"
          subjectTitle="География"
          nextHref="/vpr/english/8/cheatsheet"
          nextTitle="Английский язык"
          accentShadow="rgba(20,184,166,1)"
        />
      </div>
    </div>
  );
}
