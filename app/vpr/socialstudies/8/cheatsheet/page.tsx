"use client";

import React, { useState } from "react";
import { ReadProgress } from "@/components/vpr/ReadProgress";
import { VprCtaTest } from "@/components/vpr/VprCtaTest";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Users, BookOpen, Lightbulb, Brain, Sparkles, TrendingUp, Scale, Landmark, User,
} from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * task220b: Обществознание — 8 класс. Курс: личность и общество, сфера
 * духовной культуры, ЭКОНОМИКА (главный блок 8 класса!). ВПР-8: 8 заданий,
 * 45 минут — выбор суждений, термин по определению, анализ ситуаций.
 * Ядро: спрос/предложение, типы экономических систем, производство,
 * бизнес, роль государства в экономике, банк/налоги.
 */

// ============ ПОНЯТИЯ ============
const TERMS = [
  { def: "Устойчивая система потребностей, способностей и качеств человека, сформированная в обществе", term: "личность", tag: "личность" },
  { def: "Процесс, при котором человек усваивает нормы и ценности общества (становится личностью)", term: "социализация", tag: "личность" },
  { def: "Хозяйственная деятельность людей: производство, распределение, обмен, потребление", term: "экономика", tag: "экономика" },
  { def: "Желание и возможность покупателя приобрести товар по данной цене", term: "спрос", tag: "рынок" },
  { def: "Количество товара, которое продавец готов предложить по данной цене", term: "предложение", tag: "рынок" },
  { def: "Цена, при которой объём спроса равен объёму предложения", term: "равновесная цена", tag: "рынок" },
  { def: "Обязательный платёж государству с граждан и фирм", term: "налог", tag: "государство" },
  { def: "Деятельность по производству товаров и услуг с целью получения прибыли", term: "бизнес (предпринимательство)", tag: "экономика" },
  { def: "Финансовое учреждение: хранит вклады, выдаёт кредиты, проводит платежи", term: "банк", tag: "экономика" },
  { def: "Обесценивание денег, рост цен", term: "инфляция", tag: "экономика" },
  { def: "Возможность получения дохода, связанная с опасностью потери вложений", term: "экономический риск", tag: "экономика" },
  { def: "Ценные бумаги, дающие право на долю собственности компании", term: "акции", tag: "экономика" },
];

// ============ ЭКОНОМИЧЕСКИЕ СИСТЕМЫ ============
const SYSTEMS = [
  { n: "традиционная", what: "обычаи и традиции решают ЧТО/КАК/ДЛЯ КОГО", ex: "натуральное хозяйство древних племён" },
  { n: "командная (плановая)", what: "государство планирует всё централизованно", ex: "СССР: Госплан, дефицит" },
  { n: "рыночная", what: "решают спрос, предложение, конкуренция", ex: "цены ставит рынок" },
  { n: "смешанная", what: "рынок + госрегулирование", ex: "экономика РФ и большинства стран" },
];

// ============ СПРОС/ПРЕДЛОЖЕНИЕ ============
const SUPPLY_DEMAND = [
  { law: "закон спроса", rule: "цена растёт → спрос падает (и наоборот)", note: "обратная зависимость" },
  { law: "закон предложения", rule: "цена растёт → предложение растёт", note: "прямая зависимость" },
  { law: "равновесие", rule: "точка пересечения кривых: куплено = продано", note: "нет ни дефицита, ни излишка" },
  { law: "конкуренция", rule: "соперничество продавцов и покупателей за лучшие условия", note: "качество ↑, цены ↓" },
  { law: "неценовые факторы спроса", rule: "мода, доходы, цены заменителей, ожидания", note: "сдвигают ВСЮ кривую" },
];

// ============ ФАКТОРЫ ПРОИЗВОДСТВА ============
const FACTORS = [
  { f: "труд", what: "работники, их знания и умения", income: "зарплата" },
  { f: "земля", what: "природные ресурсы: земля, вода, полезные ископаемые", income: "рента" },
  { f: "капитал", what: "станки, здания, деньги (инвестиции)", income: "процент" },
  { f: "предпринимательство", what: "организация дела, риск, инновации", income: "прибыль" },
];

// ============ ГОСУДАРСТВО В ЭКОНОМИКЕ ============
const STATE = [
  { role: "сбор налогов", ex: "финансирует бюджет (школы, армию, дороги)" },
  { role: "перераспределение", ex: "пенсии, пособия, поддержка слабых" },
  { role: "защита конкуренции", ex: "антимонопольная служба" },
  { role: "общественные блага", ex: "освещение, оборона, маяк — рынок их не производит" },
  { role: "стабилизация", ex: "борьба с инфляцией и безработицей" },
];

// ============ КВИЗ ============
const QUIZ = [
  {
    q: "Запишите термин: «Обязательный платёж, взимаемый государством с граждан и организаций»",
    options: ["кредит", "налог", "рента", "пошлина-сбор"],
    correct: 1,
    hint: "Налоги — главный источник доходов бюджета. Пошлина — частный случай сбора за услугу.",
  },
  {
    q: "Цена на шоколад выросла в 2 раза. Объём спроса…",
    options: ["вырастет", "упадёт", "не изменится", "станет равен предложению"],
    correct: 1,
    hint: "Закон спроса: обратная зависимость. Дороже → покупают меньше (или переходят на заменители).",
  },
  {
    q: "Какой фактор производства приносит доход «прибыль»?",
    options: ["труд", "земля", "капитал", "предпринимательство"],
    correct: 3,
    hint: "Труд → зарплата, земля → рента, капитал → процент, предпринимательство (риск!) → прибыль.",
  },
  {
    q: "Экономика СССР — пример системы:",
    options: ["традиционной", "командной", "рыночной", "смешанной"],
    correct: 1,
    hint: "Централизованное планирование (Госплан решает ЧТО/КАК/ДЛЯ КОГО) — командная система.",
  },
  {
    q: "Равновесная цена — это цена, при которой:",
    options: [
      "спрос больше предложения",
      "предложение больше спроса",
      "объём спроса равен объёму предложения",
      "товар никто не покупает",
    ],
    correct: 2,
    hint: "Точка пересечения кривых: всё произведённое куплено, нет очередей и складов.",
  },
  {
    q: "Обесценивание денег и рост общего уровня цен — это:",
    options: ["дефляция", "инфляция", "девальвация доверия", "стагнация"],
    correct: 1,
    hint: "Инфляция: на те же деньги покупаешь меньше. Одна из задач государства — её сдерживать.",
  },
  {
    q: "Что из перечисленного рынок производить НЕ готов — это берёт на себя государство?",
    options: ["хлеб", "автомобили", "национальная оборона", "одежда"],
    correct: 2,
    hint: "Общественные блага (оборона, уличное освещение): нельзя продать только одному — пользуются все, платить добровольно никто не будет.",
  },
  {
    q: "Процесс усвоения человеком норм и ценностей общества называется:",
    options: ["адаптация", "социализация", "инкультурация-развитие", "образование"],
    correct: 1,
    hint: "Социализация: семья, школа, друзья превращают биологического индивида в личность.",
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
                ? "Экономический протокол загружен."
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

export default function SocialStudiesCheatsheet8() {
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
            <span className="text-xs font-mono text-blue-400 uppercase tracking-widest">обществознание // 8 класс</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight mb-4">
            Обществознание <span className="text-blue-400">8 класса</span>
            <span className="block text-xl sm:text-2xl text-zinc-400 font-bold mt-2">Личность · Рынок · Государство</span>
          </h1>
          {/* HERO-иллюстрация (task220) */}
          <div className="relative mb-6 overflow-hidden rounded-none border border-blue-500/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/socialstudies-8.jpg"
              alt="Обществознание 8 класс — неоновая иллюстрация"
              className="w-full h-auto opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent" />
          </div>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-2xl">
            Главная тема 8 класса — ЭКОНОМИКА: как устроен рынок, откуда берутся цены,
            зачем государству налоги и что такое конкуренция. ВПР-8: 8 заданий за 45 минут,
            с терминами по определениям и анализом ситуаций.
          </p>
          <div className="flex flex-wrap gap-2 mt-6">
            {["12 понятий", "4 экосистемы", "законы рынка", "4 фактора производства", "квиз 8"].map((t) => (
              <span key={t} className="px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 text-[10px] font-mono text-blue-300/80 uppercase tracking-wider">
                {t}
              </span>
            ))}
          </div>
        </motion.header>

        {/* ============ TOPIC 1: ПОНЯТИЯ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <BookOpen className="text-blue-400" /> 1. Понятия: термин по определению
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
        </section>

        {/* ============ TOPIC 2: ЭКОСИСТЕМЫ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Landmark className="text-amber-400" /> 2. Экономические системы: кто отвечает на 3 вопроса
          </h2>
          <p className="text-xs text-zinc-500 mb-4 font-mono">// три вопроса: ЧТО производить? КАК? ДЛЯ КОГО?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SYSTEMS.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 4) * 0.05 }}
                className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl"
              >
                <div className="text-amber-400 font-bold text-sm mb-1">{s.n}</div>
                <div className="text-zinc-400 text-[12px] mb-2">{s.what}</div>
                <div className="text-zinc-600 text-[11px] font-mono">пример: {s.ex}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ============ TOPIC 3: ЗАКОНЫ РЫНКА ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <TrendingUp className="text-emerald-400" /> 3. Механизм рынка
          </h2>
          <div className="space-y-2">
            {SUPPLY_DEMAND.map((s) => (
              <div key={s.law} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                <span className="text-emerald-400 font-semibold text-[13px] min-w-[210px]">{s.law}</span>
                <span className="text-zinc-300 text-[13px] flex-1">{s.rule}</span>
                <span className="text-zinc-600 text-[11px]">{s.note}</span>
              </div>
            ))}
          </div>
          <Card className="bg-emerald-950/10 border-emerald-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-emerald-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: «объясни рост цены»</p>
                <p>Формула ВПР-ответа: либо спрос вырос (модно, доходы ↑, заменители дороже) при том же предложении, либо предложение упало (неурожай, издержки ↑). Дефицит → цена вверх. Излишек → вниз.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 4: ФАКТОРЫ + ГОСУДАРСТВО ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Scale className="text-rose-400" /> 4. Факторы производства и роль государства
          </h2>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-zinc-800 text-left">
                  <th className="py-2 pr-4 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Фактор</th>
                  <th className="py-2 pr-4 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Что это</th>
                  <th className="py-2 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Доход</th>
                </tr>
              </thead>
              <tbody>
                {FACTORS.map((f) => (
                  <tr key={f.f} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                    <td className="py-2.5 pr-4 text-rose-400 font-semibold">{f.f}</td>
                    <td className="py-2.5 pr-4 text-zinc-400">{f.what}</td>
                    <td className="py-2.5 text-zinc-300 font-mono">{f.income}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2">
            {STATE.map((s) => (
              <div key={s.role} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                <span className="text-blue-400 font-semibold text-[13px] min-w-[200px]">{s.role}</span>
                <span className="text-zinc-400 text-[13px]">{s.ex}</span>
              </div>
            ))}
          </div>
          <Card className="bg-rose-950/10 border-rose-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <User className="text-rose-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: «почему государство, а не рынок?»</p>
                <p>Если благо общее и неделимое (оборона, маяк, чистый воздух) или деятель — естественная монополия (трубы, сети) — рынок «проваливается». В ответе ВПР назови конкретное свойство: неделимость пользы / отсутствие конкуренции.</p>
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
          slug="socialstudies-8"
          subjectTitle="Обществознание"
          nextHref="/vpr/informatics/8/cheatsheet"
          nextTitle="Информатика"
          accentShadow="rgba(59,130,246,1)"
        />
      </div>
    </div>
  );
}
