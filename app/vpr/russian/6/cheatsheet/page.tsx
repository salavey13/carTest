"use client";

import React, { useState } from "react";
import { ReadProgress } from "@/components/vpr/ReadProgress";
import { VprCtaTest } from "@/components/vpr/VprCtaTest";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Lightbulb, Brain, Sparkles, CheckCircle2, XCircle,
  PenLine, Shuffle, Split, Type,
} from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * task220: Русский язык — 6 класс. Формат ВПР-6 (демоверсия 2026): 5 заданий
 * без аудирования — орфография (о/ё после шипящих в корне, ПРЕ/ПРИ),
 * морфология (части речи в предложении), синтаксический разбор и работа
 * с текстом. Плюс классические 6-классные ловушки: ТОЖЕ/ТО ЖЕ, ЧТОБЫ/ЧТО БЫ,
 * дефис в наречиях. Основа — темы из реальных уроков/ВПР (Школа России,
 * Ладыженская/Баранов).
 */

// ============ ПРАВИЛО 1: Ё после шипящих в корне ============
const YO_RULES = [
  { word: "жёлтый", why: "корень — ё под ударением (проверка: жёлтенький)" },
  { word: "шёпот", why: "корень, шёпот → шептать (чередование е/ё)" },
  { word: "чёрный", why: "корень — всегда ё (чернеть)" },
  { word: "шов", why: "ИСКЛЮЧЕНИЕ — о под ударением (запомнить)" },
  { word: "шоколад", why: "о без ударения — словарное слово" },
  { word: "жокей", why: "ИСКЛЮЧЕНИЕ — о под ударением" },
];

// ============ ПРАВИЛО 2: ПРЕ- и ПРИ- (топ-тема 6 класса) ============
const PRE_PRI = [
  {
    prefix: "ПРИ-",
    color: "text-cyan-400",
    values: [
      { v: "приближение", ex: "приехал, приплыл" },
      { v: "присоединение", ex: "приклеил, прибил" },
      { v: "неполнота действия", ex: "приоткрыл, присел" },
      { v: "близость (пространство)", ex: "пришкольный, приморский" },
      { v: "доведение до конца", ex: "придумал" },
    ],
  },
  {
    prefix: "ПРЕ-",
    color: "text-violet-400",
    values: [
      { v: "= очень (высшая степень)", ex: "предобрый = очень добрый" },
      { v: "= пере- (по значению)", ex: "прервать = прервать" },
      { v: "различие смысла", ex: "пребывать в городе ≠ прибывать в город" },
    ],
  },
];

// ============ ПРАВИЛО 3: слитно/раздельно — ловушки ============
const TRAPS = [
  {
    pair: "ТОЖЕ / ТО ЖЕ",
    rule: "ТОЖЕ = союз «и тоже», можно заменить на «тоже самое слово»: Я тоже пошёл (= и я пошёл). ТО ЖЕ = местоимение + частица, к слову ЖЕ можно задать вопрос «что именно?»: Он сказал то же, что и вчера.",
  },
  {
    pair: "ЧТОБЫ / ЧТО БЫ",
    rule: "ЧТОБЫ = цель/желание (пришёл, чтобы помочь). ЧТО БЫ = местоимение + частица, БЫ можно переставить: Что бы мне почитать? (Что мне почитать бы?)",
  },
  {
    pair: "ТАКЖЕ / ТАК ЖЕ",
    rule: "ТАКЖЕ = «и, кроме того»: Он умный, а также сильный. ТАК ЖЕ = образ действия («как?»): Он оделся так же, как брат.",
  },
  {
    pair: "дефис в наречиях",
    rule: "по-другому, по-прежнему (по- + суффикс -ому/-ему/-и); где-то, куда-то, когда-то (-то); точь-в-точь. НО: поэтому, попросту — слитно!",
  },
];

// ============ ПРАВИЛО 4: морфология — части речи ============
const MORPHOLOGY = [
  { pos: "существительное", quest: "кто? что?", features: "род, число, падеж, склонение" },
  { pos: "прилагательное", quest: "какой? чей?", features: "род, число, падеж" },
  { pos: "глагол", quest: "что делать? что сделать?", features: "вид, спряжение, время, лицо" },
  { pos: "местоимение", quest: "кто? что? (не называет, указывает)", features: "лицо, число, падеж" },
  { pos: "числительное", quest: "сколько? который?", features: "количественные / порядковые" },
  { pos: "наречие", quest: "как? где? когда? куда?", features: "НЕ ИЗМЕНЯЕТСЯ" },
  { pos: "предлог", quest: "в, на, под, из-за", features: "служебная часть речи" },
  { pos: "союз", quest: "и, но, а, чтобы", features: "соединяет однородные/части сложного" },
  { pos: "частица", quest: "бы, же, не, ли", features: "вносит оттенок значения" },
];

// ============ КВИЗ (формат ВПР: найди ошибку / вставь букву) ============
const QUIZ = [
  {
    q: "В каком слове пишется Ё?",
    options: ["ш...лковый (шёлковый)", "ш...рох (шорох)", "ж...лудь (жолудь)", "капюш...н (капюшон)"],
    correct: 0,
    hint: "Ё после шипящих под ударением в корне, если есть чередование с Е (шелк → шёлковый). Шорох, крыжовник, капюшон — О (исключения/суффикс).",
  },
  {
    q: "ПР..открыть окно — какая буква и почему?",
    options: ["И: неполнота действия", "Е: = очень", "И: приближение", "Е: = пере-"],
    correct: 0,
    hint: "Приоткрыл = открыл НЕМНОГО/ЧУТЬ-ЧУТЬ — неполнота действия → ПРИ-.",
  },
  {
    q: "Где написано правильно?",
    options: [
      "Он то же прочитал эту книгу. (в значении «тоже»)",
      "Он тоже прочитал эту книгу.",
      "Он прочитал то-же книгу.",
      "Он так же прочитал эту книгу. (в значении «тоже»)",
    ],
    correct: 1,
    hint: "«И я/он тоже» — союз, слитно. Проверка: можно заменить синонимом «тоже» на «и» + повтор.",
  },
  {
    q: "«Пришёл, (что бы/чтобы) помочь» — как писать?",
    options: ["что бы", "чтобы", "оба варианта", "что-бы"],
    correct: 1,
    hint: "Цель действия → союз ЧТОБЫ слитно. Проверка: БЫ нельзя отбросить/переставить без потери смысла.",
  },
  {
    q: "Какая часть речи НЕ изменяется?",
    options: ["глагол", "прилагательное", "наречие", "существительное"],
    correct: 2,
    hint: "Наречие — неизменяемая часть речи: ни рода, ни числа, ни падежа. Вопросы: как? где? когда?",
  },
  {
    q: "По-моему, по-прежнему — почему через дефис?",
    options: [
      "по- + -ому/-ему",
      "всегда через дефис",
      "это два слова",
      "по- + -ый",
    ],
    correct: 0,
    hint: "Наречия с приставкой ПО- и суффиксами -ОМУ/-ЕМУ/-И пишутся через дефис: по-моему, по-заячьи.",
  },
  {
    q: "«пр..бывать в городе» и «пр..бывать в город» — значение приставок:",
    options: [
      "обе ПРЕ- (быть где-то)",
      "обе ПРИ- (движение)",
      "ПРЕ- (находиться) / ПРИ- (приезжать)",
      "ПРИ- (находиться) / ПРЕ- (приезжать)",
    ],
    correct: 2,
    hint: "Классика ВПР-6: прЕбывать = НАХОДИТЬСЯ где-то (ПРЕ-), прИбывать = ПРИЕЗЖАТЬ куда-то (ПРИ-, приближение).",
  },
  {
    q: "Сколько служебных частей речи в списке: «в, но, же, однако, бы»?",
    options: ["2", "3", "4", "5"],
    correct: 3,
    hint: "Предлоги (в), союзы (но, однако), частицы (же, бы) — все служебные. Самостоятельных среди них нет.",
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
            <Brain className="w-5 h-5 text-violet-400" /> Вопрос {Math.min(idx + 1, order.length)}/{order.length}
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
                      picked === null && "border-zinc-700 hover:border-violet-500/50"
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
                  className="bg-violet-500 hover:bg-violet-400 text-white font-bold"
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
                ? "Орфографический протокол загружен."
                : "Перечитай правила выше и вернись: feed → fight → fail → repeat."}
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

export default function RussianCheatsheet6() {
  return (
    <div className="min-h-screen bg-[#030712] text-zinc-200 relative">
      <ReadProgress />
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

        {/* ============ HEADER + HERO ============ */}
        <motion.header initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-14">
          <div className="flex items-center gap-2 mb-4">
            <Link href="/vpr-tests" className="text-xs font-mono text-zinc-500 hover:text-violet-400 transition-colors uppercase tracking-widest">
              ← VPR_tests
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="text-xs font-mono text-violet-400 uppercase tracking-widest">русский язык // 6 класс</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight mb-4">
            Русский язык <span className="text-violet-400">6 класса</span>
            <span className="block text-xl sm:text-2xl text-zinc-400 font-bold mt-2">Орфография · Морфология · Ловушки</span>
          </h1>
          {/* HERO-иллюстрация (task220) */}
          <div className="relative mb-6 overflow-hidden rounded-none border border-violet-500/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/russian-6.jpg"
              alt="Русский язык 6 класс — неоновая иллюстрация"
              className="w-full h-auto opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent" />
          </div>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-2xl">
            ВПР 6 класса по русскому — это 5 заданий: орфография (Ё после шипящих, ПРЕ/ПРИ),
            морфология (определи часть речи), синтаксический разбор и работа с текстом.
            Шпаргалка закрывает все зоны + классические ловушки «то же/тоже».
          </p>
          <div className="flex flex-wrap gap-2 mt-6">
            {["6 правил", "9 частей речи", "4 ловушки", "квиз 8 вопросов"].map((t) => (
              <span key={t} className="px-3 py-1 rounded-full border border-violet-500/20 bg-violet-500/5 text-[10px] font-mono text-violet-300/80 uppercase tracking-wider">
                {t}
              </span>
            ))}
          </div>
        </motion.header>

        {/* ============ TOPIC 1: Ё после шипящих ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Type className="text-cyan-400" /> 1. Ё или О после шипящих
          </h2>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-5">
              <p className="text-sm text-zinc-300 mb-4 leading-relaxed">
                В корне под ударением после шипящих пиши <b className="text-cyan-400">Ё</b>, если к слову
                подбирается однокоренное с <b className="text-cyan-400">Е</b> (чередование е/ё):
                жёлтый → желтеть, шёпот → шептать. Если проверки нет — ищи слово в словаре исключений.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {YO_RULES.map((r, i) => (
                  <div key={i} className="flex flex-col p-3 bg-black/30 rounded-lg border border-zinc-800">
                    <span className="text-white font-mono font-bold">{r.word}</span>
                    <span className="text-[11px] text-zinc-500 mt-1">{r.why}</span>
                  </div>
                ))}
              </div>
              <Card className="bg-violet-950/10 border-violet-500/20 mt-4">
                <CardContent className="p-4 flex items-start gap-3">
                  <Lightbulb className="text-violet-400 w-10 h-10 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-bold text-white mb-1">Хак: три железных исключения</p>
                    <p>крыж<b>о</b>вник, ш<b>о</b>рох, ш<b>о</b>в + производные (шорох → шорохнуть). Встретил их под ударением в корне — пиши О без раздумий.</p>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 2: ПРЕ- и ПРИ- ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Split className="text-violet-400" /> 2. Приставки ПРЕ- и ПРИ-
          </h2>
          <p className="text-xs text-zinc-500 mb-5 font-mono">// топ-тема 6 класса, обожаемая составителями ВПР</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PRE_PRI.map((p) => (
              <Card key={p.prefix} className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className={cn("font-mono text-lg", p.color)}>{p.prefix}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {p.values.map((v) => (
                    <div key={v.v} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                      <span className="text-[13px] text-zinc-300 font-semibold min-w-[140px]">{v.v}</span>
                      <span className="text-[12px] text-zinc-500 font-mono">{v.ex}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="bg-violet-950/10 border-violet-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-violet-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак: подставь синоним</p>
                <p>ПРЕ- = «очень» или «пере-»: предобрый (очень), прервать (перервать). Не подходит — значит ПРИ-. А пара <b>прЕбывать в городе (находиться) / прИбывать в город (приезжать)</b> — классика заданий на различение смысла.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 3: Слитно/раздельно ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Shuffle className="text-rose-400" /> 3. Ловушки: слитно или раздельно
          </h2>
          <div className="space-y-3">
            {TRAPS.map((t) => (
              <Card key={t.pair} className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-5">
                  <h3 className="text-base font-bold text-rose-400 font-mono mb-2">{t.pair}</h3>
                  <p className="text-[13px] text-zinc-400 leading-relaxed">{t.rule}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ============ TOPIC 4: Морфология ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <BookOpen className="text-emerald-400" /> 4. Части речи: определялка
          </h2>
          <p className="text-xs text-zinc-500 mb-5 font-mono">// задание ВПР: «укажи часть речи слова N в предложении»</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-zinc-800 text-left">
                  <th className="py-2 pr-4 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Часть речи</th>
                  <th className="py-2 pr-4 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Вопрос</th>
                  <th className="py-2 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Что помнить</th>
                </tr>
              </thead>
              <tbody>
                {MORPHOLOGY.map((m) => (
                  <tr key={m.pos} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                    <td className="py-2.5 pr-4 text-emerald-400 font-semibold">{m.pos}</td>
                    <td className="py-2.5 pr-4 text-zinc-300">{m.quest}</td>
                    <td className="py-2.5 text-zinc-500">{m.features}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Card className="bg-emerald-950/10 border-emerald-500/20 mt-4">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="text-emerald-400 w-10 h-10 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-white mb-1">Хак «-ся/-ть»</p>
                <p>Видишь на конце -ТЬ или -ЧЬ (читать, беречь) — перед тобой глагол в неопределённой форме, 100%. А слово, которое отвечает на «как?» и не изменяется — наречие.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============ TOPIC 5: КВИЗ ============ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Brain className="text-violet-400" /> 5. Квиз: формат ВПР
          </h2>
          <VprQuizInline quiz={QUIZ} />
        </section>

        {/* CTA */}
        <VprCtaTest
          slug="russian-6"
          subjectTitle="Русский язык"
          nextHref="/vpr/socialstudies/6/cheatsheet"
          nextTitle="Обществознание"
          accentShadow="rgba(168,85,247,1)"
        />
      </div>
    </div>
  );
}
