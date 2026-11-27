"use client";

import React, { useState } from "react";
import { ReadProgress } from "@/components/vpr/ReadProgress";
import { VprCtaTest } from "@/components/vpr/VprCtaTest";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Users, BookOpen, Lightbulb, Brain, Sparkles, Coins, Briefcase,
  Scale, FileText, User,
} from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * task220: Обществознание — 7 класс. Формат ВПР-7 (9 заданий, 45 минут):
 * выбор верных суждений, работа с таблицей/соответствие, анализ
 * конституционных норм (классика: ст. 37 «Труд свободен»), задания на
 * термины и ситуации из жизни подростка. Содержательное ядро 7 класса:
 * подросток и его мир, экономика (собственность, труд, деньги),
 * право и Конституция РФ. Упор на определения.
 */

// ============ ПОНЯТИЯ ЭКОНОМИКИ (топ-жанр заданий ВПР-7) ============
const TERMS = [
  { def: "Хозяйственная система общества: производство, распределение, обмен и потребление товаров и услуг", term: "экономика", tag: "экономика" },
  { def: "Всё, что удовлетворяет потребности людей: товары (материальные) и услуги (нематериальные)", term: "благо", tag: "экономика" },
  { def: "Товары и услуги, созданные для продажи", term: "продукция", tag: "экономика" },
  { def: "Принадлежность вещей, материальных и духовных ценностей их владельцам; право владеть, пользоваться и распоряжаться", term: "собственность", tag: "экономика" },
  { def: "Ценные бумаги, закрепляющие право их владельца на долю в имуществе компании", term: "акции", tag: "экономика" },
  { def: "Общепризнанный посредник обмена — товар, который принимается в оплату любых товаров и услуг", term: "деньги", tag: "экономика" },
  { def: "Занятость человека деятельностью, приносящей ему доход (заработок)", term: "труд", tag: "труд" },
  { def: "Деятельность человека, направленная на достижение определённых результатов в труде, общественной жизни", term: "карьера", tag: "труд" },
  { def: "Совокупность правил поведения, установленных и охраняемых государством", term: "право", tag: "право" },
  { def: "Основной закон государства, обладающий высшей юридической силой", term: "Конституция", tag: "право" },
  { def: "Официальный документ, удостоверяющий личность и гражданство человека", term: "паспорт", tag: "право" },
  { def: "Особая форма поведения человека, определяемая его положением в обществе (права + обязанности)", term: "социальная роль", tag: "общество" },
];

// ============ ФУНКЦИИ ДЕНЕГ ============
const MONEY_FUNCS = [
  { n: "мера стоимости", ex: "ценник: хлеб = 50 ₽" },
  { n: "средство обмена", ex: "платишь в магазине вместо бартера" },
  { n: "средство накопления", ex: "копишь на велосипед" },
  { n: "мировые деньги", ex: "расчёты между странами" },
];

// ============ СОБСТВЕННОСТЬ: формы (ст. 8 Конституции) ============
const PROPERTY = [
  { form: "частная", whose: "граждан и организаций", ex: "твой велосипед, магазин ИП" },
  { form: "государственная", whose: "государства (РФ, субъектов)", ex: "школьное здание, военная техника" },
  { form: "муниципальная", whose: "городов и сёл (местное самоуправление)", ex: "парк, библиотека, троллейбус" },
];

// ============ ПРАВА ПОДРОСТКА: документы ============
const DOCS = [
  { age: "с рождения", doc: "свидетельство о рождении", what: "имя, гражданство, родители" },
  { age: "14 лет", doc: "паспорт РФ", what: "главный документ личности" },
  { age: "с 14 лет", doc: "трудовой договор (с согласия родителей)", what: "лёгкий труд в свободное от учёбы время" },
  { age: "с 15 лет", doc: "самостоятельное распоряжение заработком", what: "вклад в банке" },
];

// ============ КОНСТИТУЦИОННЫЕ НОРМЫ (классика заданий) ============
const CONSTITUTION = [
  { article: "ст. 34", text: "Каждый имеет право на свободное использование своих способностей и имущества для предпринимательской деятельности" },
  { article: "ст. 37", text: "Труд свободен. Каждый имеет право свободно распоряжаться своими способностями к труду, выбирать род деятельности и профессию" },
  { article: "ст. 43", text: "Каждый имеет право на образование. Основное общее образование обязательно" },
  { article: "ст. 44", text: "Каждому гарантируется свобода литературного, художественного, научного, технического и других видов творчества" },
];

// ============ КВИЗ ============
const QUIZ = [
  {
    q: "Запишите термин: «Общепризнанный посредник обмена — товар, который принимается в оплату любых других товаров и услуг»",
    options: ["акция", "деньги", "благо", "кредит"],
    correct: 1,
    hint: "Четыре функции: мера стоимости, средство обмена, накопления, мировые деньги.",
  },
  {
    q: "Школьное здание находится в собственности государства. Это форма собственности:",
    options: ["частная", "муниципальная", "государственная", "смешанная"],
    correct: 2,
    hint: "Учреждение федеральное/субъектовое → государственная. Парк города — муниципальная; магазин ИП — частная.",
  },
  {
    q: "Ст. 37 Конституции РФ: «Труд свободен» — это значит, что человек вправе:",
    options: [
      "не работать вообще и получать пособие",
      "свободно выбирать род деятельности и профессию",
      "работать без трудового договора",
      "не подчиняться трудовому распорядку",
    ],
    correct: 1,
    hint: "Свобода труда = право выбора деятельности и профессии. Никто не обязан работать, но и гарантий дохода без работы нет.",
  },
  {
    q: "Паспорт гражданина РФ впервые получают в возрасте:",
    options: ["10 лет", "14 лет", "16 лет", "18 лет"],
    correct: 1,
    hint: "14 лет — паспорт; 10 лет — только свидетельство о рождении действует.",
  },
  {
    q: "Что из перечисленного — услуга, а не товар?",
    options: ["хлеб", "стрижка в парикмахерской", "велосипед", "учебник"],
    correct: 1,
    hint: "Услуга — нематериальное благо: её нельзя потрогать/сохранить, она потребляется в момент оказания.",
  },
  {
    q: "Запишите термин: «Совокупность правил поведения, установленных и охраняемых государством»",
    options: ["мораль", "право", "традиция", "этикет"],
    correct: 1,
    hint: "Отличие права от морали: за нарушение — государственное принуждение (ответственность).",
  },
  {
    q: "Основной закон РФ, обладающий высшей юридической силой, — это:",
    options: ["Указ Президента", "Гражданский кодекс", "Конституция", "Декларация прав"],
    correct: 2,
    hint: "Все закны и указы не могут противоречить Конституции; она принята в 1993 году.",
  },
  {
    q: "Подросток 14 лет хочет подработать летом. Что позволяет закон?",
    options: [
      "любую работу полный день",
      "лёгкий труд в свободное от учёбы время (с согласия родителей)",
      "только работу в казино",
      "работу запрещают до 18 лет",
    ],
    correct: 1,
    hint: "ТК РФ: с 14 лет — лёгкий труд, не мешающий учёбе, с согласия одного родителя.",
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
                ? "Экономико-правовой протокол загружен."
                : "Перечитай понятия выше и вернись: feed → fight → fail → repeat."}
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

export default function SocialStudiesCheatsheet7() {
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
            <span className="text-xs font-mono text-blue-400 uppercase tracking-widest">обществознание // 7 класс</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight mb-4">
            Обществознание <span className="text-blue-400">7 класса</span>
            <span className="block text-xl sm:text-2xl text-zinc-400 font-bold mt-2">Экономика · Труд · Право</span>
          </h1>
          {/* HERO-иллюстрация (task220) */}
          <div className="relative mb-6 overflow-hidden rounded-none border border-blue-500/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/socialstudies-7.jpg"
              alt="Обществознание 7 класс — неоновая иллюстрация"
              className="w-full h-auto opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent" />
          </div>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-2xl">
            ВПР-7 по обществознанию — 9 заданий за 45 минут. Фирменная фишка вариантов:
            цитаты из Конституции РФ (ст. 34, 37, 43) с вопросом «о каком праве идёт речь?».
            Ядро курса: экономика и собственность, труд и карьера, права подростка.
          </p>
          <div className="flex flex-wrap gap-2 mt-6">
            {["12 понятий", "4 функции денег", "статьи Конституции", "права по возрасту", "квиз 8"].map((t) => (
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

        {/* ============ TOPIC 2: ДЕНЬГИ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Coins className="text-amber-400" /> 2. Деньги и их функции
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {MONEY_FUNCS.map((f, i) => (
              <motion.div
                key={f.n}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl"
              >
                <Coins className="w-5 h-5 text-amber-400 mb-2" />
                <div className="text-white font-bold text-[13px] mb-1">{f.n}</div>
                <div className="text-[11px] text-zinc-500">{f.ex}</div>
              </motion.div>
            ))}
          </div>
          <Card className="bg-amber-950/10 border-amber-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-amber-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: «чем деньги НЕ являются»</p>
                <p>В заданиях любят путать: деньги — не благо сами по себе (ценна покупка на них), не капитал автоматически, не мера труда (это мера стоимости!).</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 3: СОБСТВЕННОСТЬ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Briefcase className="text-emerald-400" /> 3. Формы собственности (ст. 8 Конституции)
          </h2>
          <div className="space-y-2">
            {PROPERTY.map((p) => (
              <div key={p.form} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                <span className="text-emerald-400 font-bold text-sm min-w-[150px]">{p.form}</span>
                <span className="text-[13px] text-zinc-400 flex-1">{p.whose}</span>
                <span className="text-[12px] text-zinc-600 font-mono">{p.ex}</span>
              </div>
            ))}
          </div>
          <Card className="bg-emerald-950/10 border-emerald-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-emerald-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: задай вопрос «кто хозяин?»</p>
                <p>Человек/фирма → частная. Регион или федерация (школа, армия, вуз) → государственная. Город/село (парк, автобус, библиотека) → муниципальная.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 4: КОНСТИТУЦИЯ + ПРАВА ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Scale className="text-rose-400" /> 4. Конституция в заданиях ВПР
          </h2>
          <div className="space-y-2 mb-4">
            {CONSTITUTION.map((c) => (
              <div key={c.article} className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                <span className="text-rose-400 font-mono font-bold text-sm">{c.article}</span>
                <span className="text-zinc-400 text-[13px]"> — «{c.text}»</span>
              </div>
            ))}
          </div>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle className="font-mono text-sm text-white flex items-center gap-2"><FileText className="w-4 h-4 text-cyan-400" /> Документы подростка: по возрасту</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {DOCS.map((d) => (
                  <div key={d.doc} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                    <span className="text-cyan-400 font-semibold text-[13px] min-w-[110px]">{d.age}</span>
                    <span className="text-zinc-300 text-[13px] min-w-[240px]">{d.doc}</span>
                    <span className="text-zinc-600 text-[12px]">{d.what}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-rose-950/10 border-rose-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <User className="text-rose-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: алгоритм задания «о каком праве речь?»</p>
                <p>Читаешь цитату → выделяешь ключевое слово (труд / образование / творчество / собственность) → вспоминаешь статью → формулируешь право. Цитаты в ВПР всегда из 4–5 «любимых» статей.</p>
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
          slug="socialstudies-7"
          subjectTitle="Обществознание"
          nextHref="/vpr/russian/7/cheatsheet"
          nextTitle="Русский язык"
          accentShadow="rgba(59,130,246,1)"
        />
      </div>
    </div>
  );
}
