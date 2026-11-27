"use client";

import React, { useState, useEffect } from "react";
import { ReadProgress } from "@/components/vpr/ReadProgress";
import { VprCtaTest } from "@/components/vpr/VprCtaTest";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe2, BookOpen, Lightbulb, Brain, Sparkles, CheckCircle2, XCircle,
  Crown, Factory, Scroll, Flag, Users, Scale, Church, Ship,
} from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * task219: ВСЕОБЩАЯ ИСТОРИЯ (Новое время, XVIII век) — 1-е полугодие 8 класса.
 * Основа — реальный перечень устных билетов всеобщей истории 8 кл (XVIII в.):
 * эпоха Просвещения, промышленный переворот в Англии, колонии и война за
 * независимость США, Великая французская революция, Восток в XVIII в.
 * (classic-licey-samara.ru, билеты сессии 8 класса) + формат заданий ВПР-8:
 * «Запишите термин, о котором идёт речь» (определения > дат) и задания на
 * соответствие «событие → участник/понятие». Поэтому здесь минимум дат и
 * максимум понятий: капитализм, мануфактура, луддиты, метрополия, буржуазия…
 */

// ============ ПОНЯТИЙНАЯ СЕТКА: определение → термин ============
// Как в задании 2 ВПР: «Запишите термин, о котором идёт речь».
const TERMS = [
  {
    def: "Общественный строй, основанный на частной собственности, стремлении к прибыли и свободном рыночном хозяйстве",
    term: "капитализм",
    tag: "экономика",
  },
  {
    def: "Предприятие, основанное на ручном труде работников, с разделением труда на отдельные операции",
    term: "мануфактура",
    tag: "экономика",
  },
  {
    def: "Переход от ручного труда к машинному, от мануфактуры к фабрике",
    term: "промышленный переворот",
    tag: "экономика",
  },
  {
    def: "Крупное капиталистическое предприятие, где труд рабочих-новаторов оплачивается почасово; продукция дешевле и качественнее",
    term: "фабрика",
    tag: "экономика",
  },
  {
    def: "Английские рабочие-разрушители машин (1811–1813), считавшие их причиной безработицы",
    term: "луддиты",
    tag: "экономика",
  },
  {
    def: "Территория, лишённая политической и экономической самостоятельности и управляемая из другого государства",
    term: "колония",
    tag: "политика",
  },
  {
    def: "Государство, владеющее колониями и управляющее ими в своих интересах",
    term: "метрополия",
    tag: "политика",
  },
  {
    def: "Форма правления, при которой вся полнота власти (законодательной, исполнительной, судебной) принадлежит монарху",
    term: "абсолютизм",
    tag: "политика",
  },
  {
    def: "Политика XVIII века: монарх правит «по закону разума», реформы сверху при сохранении абсолютной власти",
    term: "просвещённый абсолютизм",
    tag: "политика",
  },
  {
    def: "Форма правления, где высшая власть принадлежит выборным органам, а не монарху",
    term: "республика",
    tag: "политика",
  },
  {
    def: "Сословие и класс: владельцы капитала, предприятий, торговцы — «третье сословие» во Франции, движущая сила революций",
    term: "буржуазия",
    tag: "общество",
  },
  {
    def: "Класс наёмных рабочих, не имеющих средств производства и продающих свой труд",
    term: "пролетариат",
    tag: "общество",
  },
  {
    def: "Общественно-политическое течение XVIII века: разум, знания и наука — путь к справедливому обществу",
    term: "Просвещение",
    tag: "идеи",
  },
  {
    def: "Объединение штатов, при котором центральная власть слаба, а штаты сохраняют суверенитет (США по статьям конфедерации 1781)",
    term: "конфедерация",
    tag: "политика",
  },
  {
    def: "Свод основополагающих законов государства, ограничивающий власть правителя",
    term: "конституция",
    tag: "политика",
  },
  {
    def: "Политика защиты внутреннего рынка высокими пошлинами на импорт",
    term: "протекционизм",
    tag: "экономика",
  },
];

// ============ СООТВЕТСТВИЯ: событие → человек (формат задания 1 ВПР) ============
const MATCHING = [
  { event: "Начало Реформации в Германии", person: "Мартин Лютер" },
  { event: "Идея разделения властей, «О духе законов»", person: "Шарль Монтескьё" },
  { event: "«Об общественном договоре»: власть от народа", person: "Жан-Жак Руссо" },
  { event: "Редактор «Энциклопедии» — свода знаний эпохи", person: "Дени Дидро" },
  { event: "Борец с церковью и фанатизмом, «écrasez l'infâme»", person: "Вольтер" },
  { event: "Автор Декларации независимости США", person: "Томас Джефферсон" },
  { event: "Первый президент США", person: "Джордж Вашингтон" },
  { event: "Король Франции, казнённый в 1793 году", person: "Людовик XVI" },
];

// ============ КОНЦЕПТУАЛЬНЫЕ СХЕМЫ (билеты 1–3, 10–13) ============
const CONCEPTS = [
  {
    icon: Crown,
    title: "Абсолютизм → Просвещённый абсолютизм",
    body: "В XVIII в. король «по-прежнему всё», но философы объяснили: власть от Бога — миф, власть — общественный договор. Монархи (Фридрих II, Екатерина II, Иосиф II) взяли модную упаковку — реформы «по разуму»: школы, веротерпимость, отмена пыток. Суть не изменилась: власть осталась абсолютной. Хак для ВПР: просвещённый абсолютизм = реформы СВЕРХУ + сохранение самодержавия.",
    color: "text-amber-400",
  },
  {
    icon: Factory,
    title: "Мануфактура → фабрика (промышленный переворот)",
    body: "Мануфактура: ручной труд + разделение операций (каждый делает свою часть). Фабрика: машины + паровой двигатель (Джеймс Уатт!). Итог в Англии: продукции больше, цены ниже, деревня пустеет — рабочие идут в города (урбанизация). Появляются два новых класса: буржуазия (владельцы) и пролетариат (наёмный труд). Хак: переворот = переход «руки → машина».",
    color: "text-cyan-400",
  },
  {
    icon: Flag,
    title: "Колония → независимость (США)",
    body: "Британские колонии в Северной Америке: платить налоги (чай, гербовый сбор) — представительства в парламенте нет. «Нет налогов без представительства!» Бостонское чаепитие (1773) → война за независимость (1775–1783) → Декларация (4 июля 1776, Джефферсон): «все люди созданы равными». Хак: конфликт колонии и метрополии = налоги без прав.",
    color: "text-emerald-400",
  },
  {
    icon: Users,
    title: "Великая французская революция: три сословия",
    body: "Франция: духовенство + дворянство (привилегии, налогов почти нет) и все остальные — третье сословие (99% налогов, 0% прав). 1789: созыв Генеральных штатов → Национальное собрание → штурм Бастилии (14 июля) → Декларация прав человека и гражданина. Конец абсолютизма. Хак: формула революции — «буржуазия хочет прав, народ хочет хлеба, король не хочет ничего менять».",
    color: "text-rose-400",
  },
  {
    icon: Church,
    title: "Просвещение: идеи, которые сдаётся в каждом билете",
    body: "Гоббс и Локк (Англия): общественный договор, естественные права — жизнь, свобода, собственность. Монтескьё (Франция): разделение властей на законодательную, исполнительную и судебную. Руссо: суверенитет у народа. Вольтер: свобода слова, против церкви. Дидро: «Энциклопедия». Хак: Просвещение = «разум вместо традиции».",
    color: "text-violet-400",
  },
  {
    icon: Ship,
    title: "Восток в XVIII в.: традиционные общества",
    body: "Османская империя (султан, янычары), Индия (сипаи — наёмные индийские солдаты в британских войсках, колонизация), Китай (богдыхан, конфуцианство, закрытость), Япония (император-символ, реальная власть у сёгуна, самураи). Хак для ВПР: Восток = «традиция против прогресса», Запад = «разум и рынок».",
    color: "text-orange-400",
  },
];

// ============ КВИЗ (формат ВПР: термин по определению, минимум дат) ============
const QUIZ = [
  {
    q: "Запишите термин: «Предприятие, основанное на ручном труде работников, на котором существует разделение труда на отдельные производственные операции»",
    options: ["фабрика", "мануфактура", "гильдия", "цех"],
    correct: 1,
    hint: "Ключевые маркеры: РУЧНОЙ труд + РАЗДЕЛЕНИЕ операций. Машины — это уже фабрика.",
  },
  {
    q: "Запишите термин: «Территория, лишённая политической и экономической самостоятельности, управляемая из другого государства»",
    options: ["метрополия", "протекторат", "колония", "доминион"],
    correct: 2,
    hint: "Управляемая ИЗ ДРУГОГО государства. Само управляющее государство — метрополия.",
  },
  {
    q: "Запишите термин: «Английские рабочие, разрушавшие машины, считая их причиной безработицы»",
    options: ["чартисты", "луддиты", "якобинцы", "сипаи"],
    correct: 1,
    hint: "Имя легендарного «генерала Неда Лудда» — 1811–1813, Ноттингем.",
  },
  {
    q: "Запишите термин: «Политика монархов XVIII века: реформы сверху в духе идей Просвещения при сохранении абсолютной власти»",
    options: ["абсолютизм", "меркантилизм", "просвещённый абсолютизм", "протекционизм"],
    correct: 2,
    hint: "Фридрих II, Иосиф II, Екатерина II — «мы правим для народа, но без народа».",
  },
  {
    q: "Кто автор идеи разделения властей на три ветви («О духе законов»)?",
    options: ["Руссо", "Вольтер", "Монтескьё", "Дидро"],
    correct: 2,
    hint: "Француз; законодательная + исполнительная + судебная, чтобы власть не выродилась в тиранию.",
  },
  {
    q: "«Нет налогов без представительства» — лозунг борьбы:",
    options: [
      "британских колоний в Северной Америке с метрополией",
      "французского третьего сословия с королём",
      "луддитов с фабрикантами",
      "Пруссии с Австрией",
    ],
    correct: 0,
    hint: "Гербовый сбор, налог на чай, Бостонское чаепитие — и далее Декларация 1776 года.",
  },
  {
    q: "Штурм Бастилии 14 июля 1789 года — начало:",
    options: [
      "промышленного переворота во Франции",
      "Великой французской революции",
      "войны за независимость США",
      "Реформации в Германии",
    ],
    correct: 1,
    hint: "Королевская тюрьма-крепость = символ абсолютизма; национальный праздник Франции.",
  },
  {
    q: "Запишите термин: «Наёмные индийские солдаты на службе британской Ост-Индской компании»",
    options: ["самураи", "янычары", "сипаи", "луддиты"],
    correct: 2,
    hint: "Индия XVIII в., колонизация; восстание сипаев будет позже — в 1857.",
  },
];

// ============ мини-игра «Понятийная сеть»: термин к определению ============
function TermMatchGame() {
  const [round, setRound] = useState(0);
  const [options, setOptions] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  // 6 раундов: случайно выбранные термины, дистракторы — из пула
  const [seed] = useState(() => Math.floor(Math.random() * 1000));
  const rounds = React.useMemo(() => {
    // детерминированный псевдо-выбор по seed
    const idx = Array.from({ length: TERMS.length }, (_, i) => i);
    let s = seed || 1;
    const rnd = () => {
      s = (s * 48271) % 2147483647;
      return s / 2147483647;
    };
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx.slice(0, 5);
  }, [seed]);

  useEffect(() => {
    // варианты: правильный + 3 случайных других
    const correct = rounds[round];
    const others = TERMS.map((_, i) => i).filter((i) => i !== correct);
    const shuffled = [...others].sort(() => Math.random() - 0.5).slice(0, 3);
    const all = [correct, ...shuffled].sort(() => Math.random() - 0.5);
    setOptions(all);
    setPicked(null);
  }, [round, rounds]);

  const current = TERMS[rounds[round]];

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Brain className="w-5 h-5 text-amber-400" />
          Понятийная сеть: {round + 1}/5
        </CardTitle>
      </CardHeader>
      <CardContent>
        <AnimatePresence mode="wait">
          <motion.div
            key={round}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-6"
          >
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2 font-mono">
              {current.tag}
            </div>
            <div className="text-base sm:text-lg font-bold text-white leading-relaxed">
              «{current.def}»
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {options.map((oi) => {
            const isRight = oi === rounds[round];
            const isPicked = picked === oi;
            return (
              <Button
                key={oi}
                variant="outline"
                disabled={picked !== null}
                onClick={() => setPicked(oi)}
                className={cn(
                  "justify-start font-mono normal-case text-sm",
                  picked !== null && isRight && "border-green-500 bg-green-950/40 text-green-300",
                  picked !== null && isPicked && !isRight && "border-red-500 bg-red-950/40 text-red-300",
                  picked === null && "border-zinc-700 hover:border-amber-500/50"
                )}
              >
                {picked !== null && isRight && <CheckCircle2 className="w-4 h-4 mr-2 shrink-0" />}
                {picked !== null && isPicked && !isRight && <XCircle className="w-4 h-4 mr-2 shrink-0" />}
                {TERMS[oi].term}
              </Button>
            );
          })}
        </div>
        {picked !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-5 flex flex-col sm:flex-row items-center gap-3">
            <p className="text-xs text-zinc-400 flex-1">
              {picked === rounds[round] ? "✓ " : `✗ Правильно: ${TERMS[rounds[round]].term}. `}
              {TERMS[rounds[round]].hint ?? ""}
            </p>
            {round < rounds.length - 1 ? (
              <Button onClick={() => setRound(round + 1)} className="bg-amber-500 hover:bg-amber-400 text-black font-bold">
                Дальше <Sparkles className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={() => { setRound(0); setSeed(Math.floor(Math.random() * 1000) + 1); }}
                variant="outline"
                className="border-zinc-600 text-zinc-300"
              >
                <Lightbulb className="w-4 h-4 mr-1" /> Ещё раз
              </Button>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

export default function WorldHistoryCheatsheet() {
  return (
    <div className="min-h-screen bg-[#030712] text-zinc-200 relative">
      <ReadProgress />
      {/* фоновая сетка */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

        {/* ============ HEADER ============ */}
        <motion.header initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-14">
          <div className="flex items-center gap-2 mb-4">
            <Link href="/vpr-tests" className="text-xs font-mono text-zinc-500 hover:text-amber-400 transition-colors uppercase tracking-widest">
              ← VPR_tests
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="text-xs font-mono text-amber-400 uppercase tracking-widest">world_history // lvl 5</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight mb-4">
            Всеобщая история <span className="text-amber-400">8 класса</span>
            <span className="block text-xl sm:text-2xl text-zinc-400 font-bold mt-2">Новое время. XVIII век</span>
          </h1>
          {/* HERO-иллюстрация (task220) */}
          <div className="relative mb-6 overflow-hidden rounded-none border" style={{ borderColor: "#f59e0b33" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/worldhistory-8.jpg"
              alt="Всеобщая история 8 класс — неоновая иллюстрация"
              className="w-full h-auto opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent" />
          </div>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-2xl">
            Первый семестр 8 класса — это зарубежная история: Просвещение, промышленный переворот,
            две революции (американская и французская) и традиционный Восток.
            Шпаргалка собрана под реальный формат ВПР: <b className="text-white">определения и понятия</b>,
            минимум дат. «История России» — отдельный уровень в конце дорожки (2-е полугодие).
          </p>
          <div className="flex flex-wrap gap-2 mt-6">
            {["16 терминов", "8 соответствий", "6 схем", "квиз 8 вопросов", "понятийная игра"].map((t) => (
              <span key={t} className="px-3 py-1 rounded-full border border-amber-500/20 bg-amber-500/5 text-[10px] font-mono text-amber-300/80 uppercase tracking-wider">
                {t}
              </span>
            ))}
          </div>
        </motion.header>

        {/* ============ TOPIC 0: ПОНЯТИЯ (задание 2 ВПР — «запишите термин») ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Scroll className="text-amber-400" /> 1. Понятия: термин по определению
          </h2>
          <p className="text-xs text-zinc-500 mb-5 font-mono">
            // формат задания 2 ВПР: «Запишите термин, о котором идёт речь» — здесь термины сгруппированы по темам билетов
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TERMS.map((t, i) => (
              <motion.div
                key={t.term}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 4) * 0.05 }}
                className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-amber-500/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-amber-400 font-bold font-mono text-sm">{t.term}</span>
                  <span className="text-[9px] uppercase tracking-wider text-zinc-600 font-mono">{t.tag}</span>
                </div>
                <p className="text-[13px] text-zinc-400 leading-relaxed">{t.def}</p>
              </motion.div>
            ))}
          </div>
          <Card className="bg-amber-950/10 border-amber-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-amber-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: опорные слова в определении</p>
                <p>
                  «Ручной труд + разделение операций» → <b>мануфактура</b>. «Машины + пар» → <b>фабрика</b>.
                  «Реформы сверху + абсолютная власть» → <b>просвещённый абсолютизм</b>.
                  «Управляется из другого государства» → <b>колония</b>. Учись ловить 2–3 ключевых слова — ВПР всегда даёт подсказку внутри определения.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 1: СООТВЕТСТВИЯ (задание 1 ВПР) ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Scale className="text-cyan-400" /> 2. Событие → личность
          </h2>
          <p className="text-xs text-zinc-500 mb-5 font-mono">
            // формат задания 1 ВПР: соответствие «событие (процесс) → участник»
          </p>
          <div className="space-y-2">
            {MATCHING.map((m, i) => (
              <motion.div
                key={m.event}
                initial={{ opacity: 0, x: -15 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 bg-zinc-900 border border-zinc-800 rounded-lg"
              >
                <span className="text-[13px] text-zinc-300 flex-1">{m.event}</span>
                <span className="text-zinc-600 hidden sm:block">→</span>
                <span className="text-[13px] text-cyan-400 font-bold font-mono sm:text-right">{m.person}</span>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ============ TOPIC 2: КОНЦЕПТУАЛЬНЫЕ СХЕМЫ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Globe2 className="text-violet-400" /> 3. Шесть схем: как всё связано
          </h2>
          <div className="space-y-4">
            {CONCEPTS.map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
              >
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <c.icon className={cn("w-6 h-6", c.color)} />
                      <h3 className="text-base sm:text-lg font-bold text-white">{c.title}</h3>
                    </div>
                    <p className="text-[13px] sm:text-sm text-zinc-400 leading-relaxed">{c.body}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ============ TOPIC 3: МИНИ-ИГРА ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Brain className="text-green-400" /> 4. Тренажёр: понятийная сеть
          </h2>
          <TermMatchGame />
        </section>

        {/* ============ TOPIC 4: КВИЗ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <BookOpen className="text-rose-400" /> 5. Квиз: формат ВПР
          </h2>
          <VprQuizInline quiz={QUIZ} />
        </section>

        {/* CTA: тест-бой предмета + межлинковка (task217, legacy-промо убрано) */}
        <VprCtaTest
          slug="worldhistory-8"
          subjectTitle="Всеобщая история"
          nextHref="/vpr/literature/8/cheatsheet"
          nextTitle="Литература"
          accentShadow="rgba(245,158,11,1)"
        />
      </div>
    </div>
  );
}

// ============ инлайн-квиз (без визуальных данных, только текст) ============
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
            <Brain className="w-5 h-5 text-rose-400" /> Вопрос {Math.min(idx + 1, order.length)}/{order.length}
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
                      picked === null && "border-zinc-700 hover:border-rose-500/50"
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
                  className="bg-rose-500 hover:bg-rose-400 text-white font-bold"
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
              {score === order.length
                ? "Понятийная сеть загружена идеально."
                : score >= order.length * 0.7
                  ? "Уровень освоен. Слабые места — в разделах выше."
                  : "Перечитай раздел «Понятия» и вернись: feed → fight → fail → repeat."}
            </p>
            <Button
              variant="outline"
              onClick={() => { setIdx(0); setPicked(null); setScore(0); setOrder(quiz.map((_, i) => i).sort(() => Math.random() - 0.5)); }}
              className="border-zinc-600 text-zinc-300"
            >
              <RotateCcwIcon className="w-4 h-4 mr-1" /> Пройти снова
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RotateCcwIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
