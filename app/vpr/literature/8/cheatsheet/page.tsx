"use client";

import React, { useState } from "react";
import { ReadProgress } from "@/components/vpr/ReadProgress";
import { VprCtaTest } from "@/components/vpr/VprCtaTest";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  BookOpen, Lightbulb, Brain, Code, Sparkles, PenTool,
  CheckCircle2, XCircle, Feather, Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- ИГРА: СРЕДСТВА ВЫРАЗИТЕЛЬНОСТИ ---
const DEVICES_GAME = [
  { phrase: "«Ветер по морю гуляет и кораблик подгоняет»", answer: "олицетворение", hint: "Ветер наделён действиями живого существа — гуляет, подгоняет" },
  { phrase: "«Слово — полководец человечьей силы» (Маяковский)", answer: "метафора", hint: "Скрытое сравнение: слово названо полководцем — без «как»" },
  { phrase: "«Анчар, как грозный часовой, стоит один во всей вселенной»", answer: "сравнение", hint: "Есть союз «как» — явное сравнение" },
  { phrase: "«Горькая радость», «живой труп»", answer: "оксюморон", hint: "Соединение несоединимого: горькая + радость" },
  { phrase: "«Не ветер бушует над бором, не с гор побежали ручьи…»", answer: "анафора", hint: "Повтор «не… не…» в начале строк — единоначатие" },
];

// --- КОМПОЗИЦИЯ РАЗВЁРНУТОГО ОТВЕТА ---
const ANSWER_STEPS = [
  { id: 1, title: "Тезис", example: "«Главная тема фрагмента — одиночество героя в большом городе»", note: "1–2 предложения: О ЧЁМ фрагмент и в чём его суть" },
  { id: 2, title: "Пример-аргумент", example: "«Автор пишет: <цитата>. Это показывает, что…»", note: "Приведи конкретное место из текста — короткую цитату" },
  { id: 3, title: "Анализ средства", example: "«Эпитет „каменный“ усиливает ощущение холодности»", note: "Назови приём и объясни, ЗАЧЕМ он автору" },
  { id: 4, title: "Вывод", example: "«Таким образом, фрагмент раскрывает…»", note: "Вернись к тезису другими словами — и всё, точка" },
];

// --- ПРОИЗВЕДЕНИЯ 8 КЛАССА (по программе года) ---
// Семестр I: древнерусская литература, Державин, «Недоросль», Крылов
// Семестр II: «Капитанская дочка», «Мцыри», «Ревизор», «Обломов»
const WORKS = [
  { title: "«Слово о полку Игореве» (XII век)", theme: "Призыв к единству Руси: поход Игоря против половцев завершается поражением, но путь автор видит в объединении князей. Плач Ярославны — вершина лирики", quote: "«Тяжко голове без плеч, беда телу без головы» — метафора единства князя и дружины", semester: 1 },
  { title: "«Недоросль» Д. И. Фонвизин (1782)", theme: "Первая русская социально-политическая комедия. Митрофанушка — невежда; «недоросль» — дворянин, не поступивший на службу. Простакова — грубая власть помещицы", quote: "«Вот злонравия достойные плоды!» — Стародум в финале", semester: 1 },
  { title: "Оды Г. Р. Державина", theme: "«Фелица» — ироничный портрет Екатерины II; «Памятник» — поэт выше царей. Смешение высокого и низкого стилей — новаторство", quote: "«Я царь — я раб — я червь — я Бог» («Бог») — антитеза человеческой природы", semester: 1 },
  { title: "Басни И. А. Крылова", theme: "Мораль в лицах: «Обоз» — о осторожности в переменах (отголосок 1812 года), «Лягушки, просящие царя» — о цене свободы", quote: "«А вы, друзья, как ни садитесь, всё в музыканты не годитесь» («Квартет»)", semester: 1 },
  { title: "«Капитанская дочка» А. С. Пушкин", theme: "Честь и долг: Гринёв не клянётся Пугачёву, рискуя жизнью. Пугачёв — бунт, «бессмысленный и беспощадный»", quote: "«Береги честь смолоду» — эпиграф всего романа", semester: 2 },
  { title: "«Мцыри» М. Ю. Лермонтов", theme: "Свобода против неволи: три дня побега стоят целой жизни в монастыре. Исповедь-монолог", quote: "«Я мало жил, и жил в плену…» — тоска по родине и воле", semester: 2 },
  { title: "«Ревизор» Н. В. Гоголь", theme: "Страх и чинопочитание: город принимает Хлестакова за ревизора. Сатира на бюрократию", quote: "«Чему смеётесь? Над собою смеётесь!» — ремарка в конце", semester: 2 },
  { title: "«Обломов» И. А. Гончаров", theme: "Апатия против деятельности: диван Обломова vs энергия Штольца. «Обломовщина» как диагноз", quote: "«Лежанье у Ильи Ильича не было ни необходимостью… это было его нормальным состоянием»", semester: 2 },
];

export default function Literature8Cheatsheet() {
  const [gameIdx, setGameIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [gameScore, setGameScore] = useState(0);
  const [workIdx, setWorkIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [semester, setSemester] = useState(1);

  const current = DEVICES_GAME[gameIdx];
  const options = ["олицетворение", "метафора", "сравнение", "оксюморон", "анафора"];
  const work = WORKS[workIdx];
  const step = ANSWER_STEPS[stepIdx];

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-300 font-sans p-4 md:p-8 selection:bg-rose-500/30 relative overflow-hidden">
      <ReadProgress />
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "30px 30px" }}
      />

      <div className="max-w-4xl mx-auto relative z-10">
        {/* HERO BAND */}
        <div className="relative mb-10 rounded-2xl overflow-hidden border border-rose-500/20 h-48 md:h-64 shadow-[0_0_40px_rgba(244,63,94,0.08)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task212/literature-hero.jpg"
            alt="Неоновая книга с частицами света"
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-[#030303]/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-rose-400 mb-1">Lit Compass // 8 класс</div>
            <div className="text-white font-black text-2xl md:text-4xl drop-shadow-lg">Смыслы между строк</div>
          </div>
        </div>

        {/* HEADER */}
        <header className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-1.5 rounded-full text-xs font-medium mb-6"
          >
            <Sparkles className="w-4 h-4 text-rose-400" />
            <span>Помощник по Литературе • 8 класс • Все темы</span>
          </motion.div>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
            Lit <span className="text-rose-400">Compass</span>
          </h1>
          {/* HERO-иллюстрация (task220) */}
          <div className="relative mb-6 overflow-hidden rounded-none border" style={{ borderColor: "#f43f5e33" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/literature-8.jpg"
              alt="Литература 8 класс — неоновая иллюстрация"
              className="w-full h-auto opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent" />
          </div>
          <p className="text-zinc-500 text-lg">Средства выразительности, план развёрнутого ответа и произведения года — в одном месте.</p>
        </header>

        {/* TOPIC 0: СРЕДСТВА ВЫРАЗИТЕЛЬНОСТИ (ИГРА) */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Feather className="text-rose-400" /> 0. Определи приём
          </h2>
          <Card className="bg-zinc-900 border-rose-500/30 shadow-xl">
            <CardHeader className="bg-rose-500/5 border-b border-rose-500/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="w-5 h-5" /> Приём {gameIdx + 1} из {DEVICES_GAME.length}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-lg text-white text-center italic mb-6">{current.phrase}</div>
              <div className="flex flex-wrap gap-2 justify-center">
                {options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      if (picked) return;
                      setPicked(opt);
                      if (opt === current.answer) setGameScore((s) => s + 1);
                    }}
                    className={cn(
                      "px-4 py-2 rounded-lg border text-sm font-bold transition-all",
                      picked === null
                        ? "bg-zinc-800 border-zinc-700 hover:border-rose-400 hover:text-white"
                        : opt === current.answer
                          ? "border-green-500 text-green-400 bg-green-500/5"
                          : opt === picked
                            ? "border-red-500 text-red-400 bg-red-500/5"
                            : "bg-zinc-800/30 border-zinc-800 text-zinc-500",
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {picked && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 text-center">
                  <div className={cn("inline-flex items-center gap-2 text-sm mb-2", picked === current.answer ? "text-green-400" : "text-red-400")}>
                    {picked === current.answer ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {picked === current.answer ? "Верно!" : `Это ${current.answer}`}
                  </div>
                  <div className="text-sm text-zinc-400 max-w-lg mx-auto">{current.hint}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 border-rose-500/30 text-rose-400"
                    onClick={() => {
                      setGameIdx((i) => (i + 1) % DEVICES_GAME.length);
                      setPicked(null);
                    }}
                  >
                    Следующий приём →
                  </Button>
                </motion.div>
              )}
              <div className="text-center mt-4 text-xs text-zinc-500">Счёт: {gameScore}</div>
            </CardContent>
          </Card>
        </section>

        {/* TOPIC 1: ПЛАН РАЗВЁРНУТОГО ОТВЕТА */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <PenTool className="text-blue-400" /> 1. Как писать развёрнутый ответ
          </h2>
          <Card className="bg-zinc-900/50 border-blue-500/30 mb-4">
            <CardContent className="p-6">
              <div className="mb-6 p-4 bg-black border border-blue-500/20 rounded-xl">
                <div className="text-center mb-2">
                  <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full">
                    Шаг {stepIdx + 1} из {ANSWER_STEPS.length} · {step.title}
                  </span>
                </div>
                <div className="text-base font-bold text-center text-white mb-2">{step.example}</div>
                <div className="text-sm text-center text-zinc-400">{step.note}</div>
              </div>
              <div className="flex justify-between items-center">
                <Button onClick={() => setStepIdx((p) => Math.max(p - 1, 0))} disabled={stepIdx === 0} variant="outline" size="sm" className="border-blue-500/30 text-blue-400">
                  ← Назад
                </Button>
                <div className="flex gap-2">
                  {ANSWER_STEPS.map((_, idx) => (
                    <div key={idx} className={cn("w-2 h-2 rounded-full transition-all", idx === stepIdx ? "bg-blue-400" : "bg-zinc-700")} />
                  ))}
                </div>
                <Button onClick={() => setStepIdx((p) => Math.min(p + 1, ANSWER_STEPS.length - 1))} disabled={stepIdx === ANSWER_STEPS.length - 1} variant="outline" size="sm" className="border-blue-500/30 text-blue-400">
                  Дальше →
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="p-4 bg-yellow-900/10 border border-brand-yellow/20 rounded-xl flex items-start gap-3">
            <Lightbulb className="text-brand-yellow w-8 h-8 shrink-0" />
            <div className="text-sm">
              <p className="font-bold text-white mb-1">Формула честного объёма</p>
              <p>Развёрнутый ответ на ВПР = 4–6 предложений. Тезис → цитата → анализ → вывод. Не пересказывай сюжет: проверяют умение АНАЛИЗИРОВАТЬ, а не запоминать.</p>
            </div>
          </div>
        </section>

        {/* TOPIC 2: ПРОИЗВЕДЕНИЯ 8 КЛАССА */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <BookOpen className="text-green-400" /> 2. Произведения года
          </h2>
          {/* Семестровый переключатель */}
          <div className="flex gap-2 mb-5 p-1 bg-zinc-900/60 border border-zinc-800 rounded-xl w-fit mx-auto md:mx-0">
            {[
              { v: 1, label: "I полугодие", hint: "«Слово», Державин, «Недоросль», Крылов" },
              { v: 2, label: "II полугодие", hint: "Пушкин, Лермонтов, Гоголь, Гончаров" },
            ].map((t) => (
              <button
                key={t.v}
                onClick={() => { setSemester(t.v); setWorkIdx(0); }}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                  semester === t.v ? "bg-green-500/15 text-green-400 border border-green-500/30" : "text-zinc-500 hover:text-zinc-300 border border-transparent",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {WORKS.filter((w) => w.semester === semester).map((w) => {
              const i = WORKS.indexOf(w);
              return (
                <button
                  key={w.title}
                  onClick={() => setWorkIdx(i)}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border transition-all",
                    workIdx === i ? "bg-zinc-900 border-green-500/40" : "bg-zinc-900/40 border-zinc-800 hover:border-zinc-600",
                  )}
                >
                  <div className="font-bold text-white text-sm flex items-center justify-between gap-2">
                    <span>{w.title}</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 border border-zinc-800 px-1.5 py-0.5 rounded-full shrink-0">
                      {w.semester === 1 ? "I сем" : "II сем"}
                    </span>
                  </div>
                  {workIdx === i && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 space-y-2 overflow-hidden">
                      <div className="text-sm text-zinc-400">{w.theme}</div>
                      <div className="text-xs text-green-400/80 flex items-start gap-2">
                        <Quote className="w-3 h-3 mt-0.5 shrink-0" /> {w.quote}
                      </div>
                    </motion.div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="text-xs text-zinc-600 text-center mt-3">Тапни по названию — раскроется тема и цитата</div>
        </section>

        {/* TOPIC 3: ТЕРМИНЫ-МИНИМУМ */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Quote className="text-violet-400" /> 3. Термины без паники
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              ["Композиция", "строение произведения: завязка → кульминация → развязка"],
              ["Антитеза", "резкий контраст: «богатые и бедные, умные и глупые»"],
              ["Ирония", "скрытая насмешка: похвала, звучащая как упрёк"],
              ["Гипербола", "преувеличение: «сто лет не виделись»"],
              ["Литота", "преуменьшение: «мужичок с ноготок»"],
              ["Эпитет", "художественное определение: «золотая осень»"],
            ].map(([term, def]) => (
              <div key={term} className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                <div className="font-bold text-violet-300 text-sm">{term}</div>
                <div className="text-xs text-zinc-500 mt-1">{def}</div>
              </div>
            ))}
          </div>
        </section>

        {/* TOPIC 3.5: РОДЫ И ЖАНРЫ (task215) */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <BookOpen className="text-emerald-400" /> 3.5. Роды литературы и жанры
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
              <div className="font-bold text-emerald-400 text-sm mb-2">Эпос (рассказывают)</div>
              <div className="text-xs text-zinc-400 leading-relaxed space-y-1">
                <div>• Есть рассказчик и сюжет</div>
                <div>• Жанры: роман, повесть, рассказ, басня</div>
                <div className="text-zinc-600">Пример: «Капитанская дочка»</div>
              </div>
            </div>
            <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
              <div className="font-bold text-emerald-400 text-sm mb-2">Лирика (переживают)</div>
              <div className="text-xs text-zinc-400 leading-relaxed space-y-1">
                <div>• Субъективные чувства, лирический герой</div>
                <div>• Жанры: стихотворение, ода, элегия</div>
                <div className="text-zinc-600">Пример: оды Державина</div>
              </div>
            </div>
            <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
              <div className="font-bold text-emerald-400 text-sm mb-2">Драма (показывают)</div>
              <div className="text-xs text-zinc-400 leading-relaxed space-y-1">
                <div>• Диалоги и ремарки, для сцены</div>
                <div>• Жанры: комедия, трагедия, драма</div>
                <div className="text-zinc-600">Пример: «Недоросль» Фонвизина</div>
              </div>
            </div>
          </div>
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-400">
            <p className="mb-2 text-zinc-200">// Как отличить на ВПР за 5 секунд:</p>
            <p>Видишь <b>строфы и переживания</b> → лирика. <b>Повествование от лица автора/рассказчика</b> → эпос. <b>Имена героев + слова в скобках (ремарки) и тире-реплики</b> → драма.</p>
          </div>
        </section>

        {/* TOPIC 3.6: АНАЛИЗ СТИХА (task215b) */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Feather className="text-sky-400" /> 3.6. Анализ стихотворения: размер и рифма
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
            {[
              { name: "Ямб", scheme: "та-ТА", ex: "«Мой дя́-дя са́-мых че́ст-ных…» (Пушкин)" },
              { name: "Хорей", scheme: "ТА-та", ex: "«Бу́-ря мгло́-ю не́-бо кро́-ет…» (Пушкин)" },
              { name: "Дактиль", scheme: "ТА-та-та", ex: "у́дар на 1-м слоге из трёх" },
              { name: "Анапест", scheme: "та-та-ТА", ex: "у́дар на 3-м слоге из трёх" },
            ].map((m) => (
              <div key={m.name} className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-center">
                <div className="font-bold text-sky-400 text-sm">{m.name}</div>
                <div className="font-mono text-xs text-white mt-1">{m.scheme}</div>
                <div className="text-[10px] text-zinc-600 mt-1">{m.ex}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader><CardTitle className="text-sm text-sky-400">Виды рифмы (по положению)</CardTitle></CardHeader>
              <CardContent className="text-sm leading-relaxed space-y-1 font-mono">
                <div>· смежная AABB: месяц/рассвет</div>
                <div>· перекрёстная ABAB: самая частая</div>
                <div>· опоясывающая ABBA</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader><CardTitle className="text-sm text-sky-400">Скелет анализа лирики</CardTitle></CardHeader>
              <CardContent className="text-sm leading-relaxed space-y-1">
                <div>1. Тема и настроение (радость/тоска…)</div>
                <div>2. Образ лирического героя</div>
                <div>3. Средства: эпитеты, метафоры, размер</div>
                <div>4. Идея: что поэт хотел сказать</div>
              </CardContent>
            </Card>
          </div>
          <Card className="bg-sky-900/10 border-sky-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-sky-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: определить размер за 10 секунд</p>
                <p>Поставь ударения и расставь паузы слогами: ударение на <b>чётном</b> слоге — ямб, на <b>нечётном</b> — хорей. «У-ДАР на второй» = ямб (та-ТА). «УДАР на первой» = хорей (ТА-та).</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* CTA: тест-бой предмета + межлинковка (task217, legacy-промо убрано) */}
        <VprCtaTest
          slug="literature-8"
          subjectTitle="Литература"
          nextHref="/vpr/chemistry/8/cheatsheet"
          nextTitle="Химия"
          accentShadow="rgba(244,63,94,1)"
        />
        <footer className="text-center pb-20 text-zinc-700 text-[10px] font-mono uppercase tracking-widest">
          Generated with AI in CyberVibe Studio // 8th Grade Literature // No copyright, just Vibe.
        </footer>
      </div>
    </div>
  );
}
