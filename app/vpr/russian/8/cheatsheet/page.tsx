"use client";

import React, { useState } from "react";
import { ReadProgress } from "@/components/vpr/ReadProgress";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  PenTool, SpellCheck, BookOpen, Lightbulb, Brain, Code,
  Sparkles, CheckCircle2, XCircle, AlertTriangle, Languages, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- ДИКТАНТ-ТРЕНАЖЁР: Н/НН, СЛИТНО/РАЗДЕЛЬНО, НЕ ---
interface Gap {
  id: number;
  before: string;
  after: string;
  options: string[];
  correct: number;
  rule: string;
}
const GAPS: Gap[] = [
  { id: 1, before: "Кова..ый сундук", after: "стоял на чердаке", options: ["нн", "н"], correct: 1, rule: "Кова́ный (образовано от глагола несов. вида «ковать», нет приставки и зависимого слова) — одна Н" },
  { id: 2, before: "Свя..ая реликвия", after: "хранилась в семье", options: ["нн", "н"], correct: 0, rule: "Связанная — причастие сов. вида «связать» + зависимое слово… нет, здесь прилагательное от «связать» (сов. вид) — НН" },
  { id: 3, before: "Он действовал ..решительно", after: "и медлил", options: ["не", "ни"], correct: 0, rule: "НЕ: краткое прилагательное с зависимостью «действовал неуверенно» — слитно, можно заменить синонимом «вяло»" },
  { id: 4, before: "Это была .. история, а выдумка", after: "", options: ["не", "ни"], correct: 0, rule: "Противопоставление с союзом А — НЕ пишется отдельно: не история, а выдумка" },
  { id: 5, before: "Стекл..ый шкаф", after: "блестел на солнце", options: ["янн", "ян"], correct: 0, rule: "Стеклянный — исключение: стекло + янн (запомни: оловянный, деревянный, стеклянный)" },
];

// --- МИНИ-ИГРА: ВИДЫ СВЯЗИ В СЛОВОСОЧЕТАНИЯХ ---
const BOND_GAME = [
  { phrase: "читать книгу", answer: "управление", hint: "От глагола зависит вопрос «что?» — винительный падеж" },
  { phrase: "внимательно читать", answer: "примыкание", hint: "Наречие просто примыкает к глаголу — неизменяемое слово" },
  { phrase: "интересная книга", answer: "согласование", hint: "Прилагательное согласуется в роде, числе, падеже" },
];

// --- ИГРА: ВИДЫ ОДНОСОСТАВНЫХ ПРЕДЛОЖЕНИЙ (1-е полугодие) ---
const ONESUBJ_GAME = [
  { phrase: "Светает.", answer: "безличное", hint: "Нет и не может быть подлежащего: действие само по себе, без деятеля" },
  { phrase: "Люблю грозу в начале мая.", answer: "определённо-личное", hint: "Глагол 1-го/2-го лица: люблю, любишь, любим — деятеля легко подставить (я)" },
  { phrase: "По лесу стреляют.", answer: "неопределённо-личное", hint: "Глагол 3-го лица мн. ч. — важен факт, а не кто именно" },
  { phrase: "Тишина.", answer: "назывное", hint: "Только подлежащее, сказуемого нет — «называет» сцену" },
  { phrase: "Ветра нет, и небо чистое.", answer: "двусоставное", hint: "Есть и подлежащее «ветер», и сказуемое «нет» (категория состояния)" },
];

// --- ПАМЯТКА: ТИПЫ ОДНОСОСТАВНЫХ ---
const ONESUBJ_TYPES = [
  { name: "Назывное", formula: "Кто? Что?", example: "Ночь. Улица. Фонарь. Аптека.", color: "text-violet-300" },
  { name: "Определённо-личное", formula: "Я/ты/мы/вы + глагол", example: "Иду по знакомой улице.", color: "text-blue-300" },
  { name: "Неопределённо-личное", formula: "Они (кто-то) + глагол 3 л. мн.ч.", example: "В деревне говорят о дожде.", color: "text-green-300" },
  { name: "Безличное", formula: "Действия без деятеля", example: "Мне нездоровится. Смеркается.", color: "text-orange-300" },
];

export default function Russian8Cheatsheet() {
  const [gapAnswers, setGapAnswers] = useState<Record<number, number>>({});
  const [gapChecked, setGapChecked] = useState(false);
  const [bondIdx, setBondIdx] = useState(0);
  const [bondPicked, setBondPicked] = useState<string | null>(null);
  const [oneIdx, setOneIdx] = useState(0);
  const [onePicked, setOnePicked] = useState<string | null>(null);
  const [oneScore, setOneScore] = useState(0);

  const gapsCorrect = GAPS.filter((g) => gapAnswers[g.id] === g.correct).length;
  const allAnswered = GAPS.every((g) => gapAnswers[g.id] !== undefined);

  const current = BOND_GAME[bondIdx];

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-300 font-sans p-4 md:p-8 selection:bg-brand-cyan/30 relative overflow-hidden">
      <ReadProgress />
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "30px 30px" }}
      />

      <div className="max-w-4xl mx-auto relative z-10">
        {/* HERO BAND */}
        <div className="relative mb-10 rounded-2xl overflow-hidden border border-violet-500/20 h-48 md:h-64 shadow-[0_0_40px_rgba(168,85,247,0.08)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task212/russian-hero.jpg"
            alt="Неоновая каллиграфия русского языка"
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-[#030303]/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-violet-400 mb-1">Русский Мастер // 8 класс</div>
            <div className="text-white font-black text-2xl md:text-4xl drop-shadow-lg">Язык как код — дешифруй правила</div>
          </div>
        </div>

        {/* HEADER */}
        <header className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-1.5 rounded-full text-xs font-medium mb-6"
          >
            <Sparkles className="w-4 h-4 text-brand-pink" />
            <span>Помощник по Русскому языку • 8 класс • Все темы</span>
          </motion.div>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
            Русский <span className="text-brand-pink">Мастер</span>
          </h1>
          <p className="text-zinc-500 text-lg">Н/НН, НЕ с разными частями речи, словосочетания и обособления — без паники.</p>
        </header>

        {/* TOPIC 0: Н И НН В ПРИЧАСТИЯХ/ПРИЛАГАТЕЛЬНЫХ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <SpellCheck className="text-violet-400" /> 0. Одна Н или две НН?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-violet-400">Когда НН (две)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div>• От глагола сов. вида: связать → связа<strong className="text-white">нн</strong>ый</div>
                <div>• Есть приставка (кроме НЕ): покраше<strong className="text-white">нн</strong>ый</div>
                <div>• Есть зависимое слово: краше<strong className="text-white">нн</strong>ый мамой забор</div>
                <div>• На -ованный/-ёванный: организова<strong className="text-white">нн</strong>ый</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm text-violet-400">Когда Н (одна)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div>• От глагола несов. вида: ковать → кова<strong className="text-white">н</strong>ый</div>
                <div>• Нет приставки, нет зависимого слова: краше<strong className="text-white">н</strong>ый пол</div>
                <div>• Исключения: жёва<strong className="text-white">н</strong>ый, кова<strong className="text-white">н</strong>ый, раненый (без зависимых слов)</div>
                <div className="text-zinc-500 text-xs">РанеННый в бою — уже с зависимым словом = НН!</div>
              </CardContent>
            </Card>
          </div>
          <div className="p-4 bg-yellow-900/10 border border-brand-yellow/20 rounded-xl flex items-start gap-3">
            <Lightbulb className="text-brand-yellow w-8 h-8 shrink-0" />
            <div className="text-sm">
              <p className="font-bold text-white mb-1">Три исключения на -янный</p>
              <p>Стекл<strong>ЯНН</strong>ый, олов<strong>ЯНН</strong>ый, дерев<strong>ЯНН</strong>ый. Ветре<strong>Н</strong>ый (но: безветреННый!). Всё остальное на -ан/-ян — одна Н: кожаНый, песчаНый.</p>
            </div>
          </div>
        </section>

        {/* TOPIC 1: НЕ С РАЗНЫМИ ЧАСТЯМИ РЕЧИ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <AlertTriangle className="text-orange-400" /> 1. НЕ: слитно или раздельно?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-zinc-900 border-l-4 border-green-500 rounded-xl">
              <div className="font-bold text-white text-sm mb-2">Слитно</div>
              <div className="text-xs text-zinc-400 space-y-1">
                <div>• НЕговорю по-французски = вообще не умею</div>
                <div>• Заменяется синонимом: НЕправда = ложь</div>
                <div>• Без НЕ не употребляется: НЕнависть</div>
              </div>
            </div>
            <div className="p-4 bg-zinc-900 border-l-4 border-red-500 rounded-xl">
              <div className="font-bold text-white text-sm mb-2">Раздельно</div>
              <div className="text-xs text-zinc-400 space-y-1">
                <div>• Противопоставление с А: НЕ друг, а враг</div>
                <div>• Слова «далеко не, вовсе не, отнюдь не»</div>
                <div>• НЕ с глаголами и деепричастиями: НЕ хочу</div>
              </div>
            </div>
            <div className="p-4 bg-zinc-900 border-l-4 border-blue-500 rounded-xl">
              <div className="font-bold text-white text-sm mb-2">Ловушки</div>
              <div className="text-xs text-zinc-400 space-y-1">
                <div>• НЕ смотрел фильм — краткое причастие? Раздельно!</div>
                <div>• НЕНавидя — исключение, слитно</div>
              </div>
            </div>
          </div>
        </section>

        {/* TOPIC 1.5: ОДНОСОСТАВНЫЕ ПРЕДЛОЖЕНИЯ (1-е полугодие) */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <MessageSquare className="text-cyan-400" /> 1.5. Односоставные предложения
            <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-cyan-400/80 bg-cyan-950/40 border border-cyan-500/20 px-2 py-1 rounded-full">1-е полугодие</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {ONESUBJ_TYPES.map((t) => (
              <div key={t.name} className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                <div className={cn("font-bold text-sm", t.color)}>{t.name}</div>
                <div className="text-xs text-zinc-500 mt-1 font-mono">{t.formula}</div>
                <div className="text-sm text-zinc-300 mt-2 italic">«{t.example}»</div>
              </div>
            ))}
          </div>
          <Card className="bg-zinc-900 border-cyan-500/30 shadow-xl">
            <CardHeader className="bg-cyan-500/5 border-b border-cyan-500/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="w-5 h-5" /> Определитель: что за предложение?
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-center font-mono text-white mb-6 italic">«{ONESUBJ_GAME[oneIdx].phrase}»</div>
              <div className="flex flex-wrap gap-2 justify-center">
                {["назывное", "определённо-личное", "неопределённо-личное", "безличное", "двусоставное"].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      if (onePicked) return;
                      setOnePicked(opt);
                      if (opt === ONESUBJ_GAME[oneIdx].answer) setOneScore((s) => s + 1);
                    }}
                    className={cn(
                      "px-4 py-2 rounded-lg border text-sm font-bold transition-all",
                      onePicked === null
                        ? "bg-zinc-800 border-zinc-700 hover:border-cyan-400 hover:text-white"
                        : opt === ONESUBJ_GAME[oneIdx].answer
                          ? "border-green-500 text-green-400 bg-green-500/5"
                          : opt === onePicked
                            ? "border-red-500 text-red-400 bg-red-500/5"
                            : "bg-zinc-800/30 border-zinc-800 text-zinc-500",
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {onePicked && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 text-center">
                  <div className={cn("inline-flex items-center gap-2 text-sm mb-2", onePicked === ONESUBJ_GAME[oneIdx].answer ? "text-green-400" : "text-red-400")}>
                    {onePicked === ONESUBJ_GAME[oneIdx].answer ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {onePicked === ONESUBJ_GAME[oneIdx].answer ? "Верно!" : `Это ${ONESUBJ_GAME[oneIdx].answer}`}
                  </div>
                  <div className="text-sm text-zinc-400 max-w-lg mx-auto">{ONESUBJ_GAME[oneIdx].hint}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 border-cyan-500/30 text-cyan-400"
                    onClick={() => {
                      setOneIdx((i) => (i + 1) % ONESUBJ_GAME.length);
                      setOnePicked(null);
                    }}
                  >
                    Следующее предложение →
                  </Button>
                </motion.div>
              )}
              <div className="text-center mt-4 text-xs text-zinc-500">Счёт: {oneScore}</div>
            </CardContent>
          </Card>
        </section>

        {/* TOPIC 2: СЛОВОСОЧЕТАНИЯ (ИГРА) */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Languages className="text-brand-cyan" /> 2. Вид связи в словосочетании
          </h2>
          <Card className="bg-zinc-900 border-brand-cyan/30 shadow-xl">
            <CardHeader className="bg-brand-cyan/5 border-b border-brand-cyan/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="w-5 h-5" /> Определи вид связи
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-center font-mono text-white mb-6">{current.phrase}</div>
              <div className="flex flex-wrap gap-3 justify-center">
                {["согласование", "управление", "примыкание"].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setBondPicked(opt)}
                    className={cn(
                      "px-5 py-2 rounded-lg border font-bold transition-all",
                      bondPicked === opt
                        ? opt === current.answer
                          ? "border-green-500 text-green-400 bg-green-500/5"
                          : "border-red-500 text-red-500 bg-red-500/5"
                        : "bg-zinc-800 border-zinc-700 hover:border-brand-cyan hover:text-white",
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {bondPicked && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 text-center">
                  <div className={cn("inline-flex items-center gap-2 text-sm mb-3", bondPicked === current.answer ? "text-green-400" : "text-red-400")}>
                    {bondPicked === current.answer ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {bondPicked === current.answer ? "Верно!" : `Правильно: ${current.answer}`}
                  </div>
                  <div className="text-sm text-zinc-400 max-w-md mx-auto">{current.hint}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 border-brand-cyan/30 text-brand-cyan"
                    onClick={() => {
                      setBondIdx((i) => (i + 1) % BOND_GAME.length);
                      setBondPicked(null);
                    }}
                  >
                    Следующее словосочетание →
                  </Button>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* TOPIC 3: ОБОСОБЛЕНИЯ — ЗАПЯТЫЕ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <PenTool className="text-green-400" /> 3. Обособленные члены: где запятая
          </h2>
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-sm font-mono space-y-3">
            <div className="text-zinc-500">// Причастный оборот — после определяемого слова:</div>
            <div className="text-white pl-4">Мальчик, <span className="text-green-400">убежавший из дома</span>, вернулся через час.</div>
            <div className="text-zinc-500">// Деепричастный оборот — ВСЕГДА с двух сторон:</div>
            <div className="text-white pl-4"><span className="text-green-400">Улыбаясь широко</span>, он протянул мне руку.</div>
            <div className="text-zinc-500">// Уточнение (место, время):</div>
            <div className="text-white pl-4">Внизу, <span className="text-green-400">в тумане</span>, плескалась река.</div>
            <div className="text-zinc-500">// Обращение — выделяем всегда:</div>
            <div className="text-white pl-4">Слушай, <span className="text-green-400">брат</span>, пойдём домой.</div>
          </div>
        </section>

        {/* TOPIC 3.5: ЧЕРЕДОВАНИЯ И ПРИСТАВКИ (task215) */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <SpellCheck className="text-rose-400" /> 3.5. Чередования и словарные ловушки
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader><CardTitle className="text-sm text-rose-400">Корни с чередованием</CardTitle></CardHeader>
              <CardContent className="text-sm leading-relaxed space-y-1 font-mono">
                <div>· ГОР/ГАР: под ударением А, без — О</div>
                <div>· ЗАР/ЗОР: без ударения А (заря́)</div>
                <div>· РАСТ/РОС: перед СТ и Щ → А (расти, выращивать)</div>
                <div>· ЛАГ/ЛОЖ: перед Г → А, перед Ж → О</div>
                <div>· КАС/КОС: есть А → КАСАться</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader><CardTitle className="text-sm text-rose-400">Приставки ПРЕ/ПРИ</CardTitle></CardHeader>
              <CardContent className="text-sm leading-relaxed space-y-1">
                <div>• <b>ПРИ-</b>: приближение (приехал), близость (пришкольный), неполное действие (приоткрыл)</div>
                <div>• <b>ПРЕ-</b> = «очень» (прекрасный) или = «пере-» (прервать)</div>
                <div className="text-zinc-500 text-xs">Лайфхак: попробуй заменить словом «очень» или «пере».</div>
              </CardContent>
            </Card>
          </div>
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-sm font-mono text-zinc-400">
            <p className="mb-2 text-zinc-200">// Словарные ловушки ВПР (не подчиняются правилам — только память):</p>
            <p>стакан, сара<span className="text-rose-400">ф</span>ан, фут<span className="text-rose-400">б</span>ол, ко<span className="text-rose-400">мб</span>айн, акваланг, в<b>о</b>кзал.</p>
          </div>
        </section>

        {/* TOPIC 3.6: ОБОБЩАЮЩИЕ СЛОВА (task215b) */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <PenTool className="text-amber-400" /> 3.6. Обобщающие слова: двоеточие или тире
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader><CardTitle className="text-sm text-amber-400">Двоеточие «:»</CardTitle></CardHeader>
              <CardContent className="text-sm leading-relaxed space-y-1">
                <div>Обобщающее <b>перед</b> однородными → двоеточие</div>
                <div className="font-mono text-xs text-zinc-400 mt-1">В корзине лежали <b>грибы</b>: маслята, рыжики и волнушки.</div>
                <div className="text-zinc-500 text-xs">Схема: [обобщ.]: О, О и О.</div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader><CardTitle className="text-sm text-amber-400">Тире «—»</CardTitle></CardHeader>
              <CardContent className="text-sm leading-relaxed space-y-1">
                <div>Обобщающее <b>после</b> однородных → тире</div>
                <div className="font-mono text-xs text-zinc-400 mt-1">Маслята, рыжики и волнушки — <b>всё это</b> грибы.</div>
                <div className="text-zinc-500 text-xs">Схема: О, О и О — [обобщ.].</div>
              </CardContent>
            </Card>
          </div>
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-400">
            <p className="mb-2 text-zinc-200">// Ловушка: «всё это», «и такое», «никто» после ряда — всегда тире:</p>
            <p>Мальчики, девочки, родители — все замерли. Двоеточие тут <b className="text-rose-400">ошибка</b>.</p>
          </div>
        </section>

        {/* TOPIC 4: ДИКТАНТ-ТРЕНАЖЁР */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <BookOpen className="text-brand-yellow" /> 4. Мини-диктант: выбери вариант
          </h2>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-6 space-y-5">
              {GAPS.map((gap) => (
                <div key={gap.id} className="border-b border-zinc-800 pb-4 last:border-0 last:pb-0">
                  <div className="text-base text-white mb-3 font-mono">
                    … {gap.before.split("..")[0]}
                    <span className={cn("mx-1 px-2 py-0.5 rounded border font-bold", gapChecked ? (gapAnswers[gap.id] === gap.correct ? "border-green-500 text-green-400" : "border-red-500 text-red-400") : "border-zinc-700 text-zinc-500")}>
                      {gapChecked ? gap.options[gap.correct] : "…"}
                    </span>
                    {gap.before.split("..")[1]} {gap.after}…
                  </div>
                  <div className="flex gap-2 mb-2">
                    {gap.options.map((opt, i) => (
                      <button
                        key={opt}
                        onClick={() => setGapAnswers((prev) => ({ ...prev, [gap.id]: i }))}
                        className={cn(
                          "px-4 py-1.5 rounded-lg border text-sm font-bold transition-all",
                          gapAnswers[gap.id] === i ? "bg-zinc-700 border-brand-pink text-white" : "bg-zinc-800/50 border-zinc-700 hover:border-zinc-500",
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  {gapChecked && (
                    <div className={cn("text-xs", gapAnswers[gap.id] === gap.correct ? "text-green-400" : "text-red-400")}>
                      {gapAnswers[gap.id] === gap.correct ? "✓ " : "✗ "}
                      {gap.rule}
                    </div>
                  )}
                </div>
              ))}
              <div className="flex gap-3 items-center">
                <Button onClick={() => setGapChecked(true)} disabled={!allAnswered || gapChecked} className="bg-brand-pink text-white font-bold">
                  Проверить
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setGapChecked(false);
                    setGapAnswers({});
                  }}
                  size="sm"
                >
                  Сброс
                </Button>
                {gapChecked && (
                  <span className={cn("text-sm font-bold ml-auto", gapsCorrect === GAPS.length ? "text-green-400" : "text-zinc-400")}>
                    {gapsCorrect} / {GAPS.length}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* CTA */}
        <div className="bg-white text-black p-8 rounded-none mb-20 flex flex-col md:flex-row items-center gap-8 shadow-[10px_10px_0_rgba(168,85,247,1)]">
          <div className="w-20 h-20 bg-brand-pink flex items-center justify-center rounded-full shrink-0">
            <Code className="w-10 h-10 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-black uppercase mb-2">Как создана эта страница?</h3>
            <p className="text-zinc-700 text-sm leading-relaxed mb-6">
              Эта «шпаргалка» была полностью написана искусственным интеллектом в нашей <b>SuperVibe Studio</b>.
              Грамотная речь — это твой интерфейс к миру: тексты, код, промпты для ИИ. Прокачивай в SuperVibe.
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
          Generated with AI in CyberVibe Studio // 8th Grade Russian // No copyright, just Vibe.
        </footer>
      </div>
    </div>
  );
}
