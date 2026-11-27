"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Brain, Swords, RotateCcw, TrendingUp, ArrowRight, Zap,
  Terminal, Lock, Unlock, Trophy, Sparkles, Radar,
} from "lucide-react";
import { SuperTestFlow } from "@/components/vpr/SuperTestFlow";
import { SUPER_SUBJECT_META } from "@/lib/vprSuperTest";
import { cn } from "@/lib/utils";

/* ================================================================
   /vpr-matrix — task212c
   Лендинг-«инициация» в игру подготовки к середине 8 класса.
   Вайб: матричная тренировочная программа. 21st century:
   не зубрёжка, а цикл feed → fight → fail → repeat → upgrade.
   ================================================================ */

const CDN = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task212";

// --- Цифровая матрица-дождь (лёгкий canvas, без зависимостей) ---
function MatrixRain() {
  const [ref, setRef] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref) return;
    const ctx = ref.getContext("2d");
    if (!ctx) return;
    const w = (ref.width = ref.offsetWidth);
    const h = (ref.height = ref.offsetHeight);
    const cols = Math.floor(w / 16);
    const drops = Array.from({ length: cols }, () => Math.floor(Math.random() * h));
    const glyphs = "01АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ√πΣ≥≤×";
    let raf = 0;
    const draw = () => {
      ctx.fillStyle = "rgba(3,7,18,0.08)";
      ctx.fillRect(0, 0, w, h);
      ctx.font = "14px monospace";
      for (let i = 0; i < cols; i++) {
        const ch = glyphs[Math.floor(Math.random() * glyphs.length)];
        ctx.fillStyle = Math.random() > 0.97 ? "#a5f3fc" : "#16a34a";
        ctx.fillText(ch, i * 16, drops[i] * 16);
        if (drops[i] * 16 > h && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [ref]);
  return <canvas ref={setRef} className="absolute inset-0 w-full h-full opacity-40" aria-hidden />;
}

// --- Этапы цикла ---
const LOOP_STEPS = [
  {
    key: "feed",
    img: `${CDN}/matrix-feed.jpg`,
    icon: Brain,
    color: "#22d3ee",
    title: "FEED // Проглоти знание",
    text: "Открываешь шпаргалку уровня: теорема Пифагора в пошаговом разборе, Николай I в таймлайне, эпитеты в игре-определителе. Это не учебник — это загрузка программы в Нео. 15 минут — и в голове структура, которой не было.",
    hint: "7 интерактивных шпаргалок: мини-игры, квизы, пошаговые разборы",
  },
  {
    key: "fight",
    img: `${CDN}/matrix-fight.jpg`,
    icon: Swords,
    color: "#f43f5e",
    title: "FIGHT // Сразись с тестом",
    text: "ВПР-вариант ждёт: 10 вопросов, 4 варианта ответа, таймер. Каждый вопрос — удар. Объяснение после ответа — разбор твоей техники в slow-motion. Здесь проверяется, что реально загрузилось.",
    hint: "Реальные вопросы из базы: алгебра, геометрия, русский, история, литература, вероятность",
  },
  {
    key: "fail",
    img: `${CDN}/matrix-fail.jpg`,
    icon: RotateCcw,
    color: "#eab308",
    title: "FAIL // Провались с достоинством",
    text: "Меньше 70%? Уровень не откроется. И это нормально: в Матрице не бывает неудач — бывают итерации. Красный экран показывает, какие именно вопросы тебя убили. Запомни их.",
    hint: "Порог разблокировки — не больше 30% ошибок",
  },
  {
    key: "repeat",
    img: `${CDN}/matrix-hero.jpg`,
    icon: Zap,
    color: "#a855f7",
    title: "REPEAT // Вернись сильнее",
    text: "Шпаргалка никуда не делась — она ждёт. Перечитай только слабые зоны, сыграй в мини-игру ещё раз, возьми другой вариант теста. Вторая попытка всегда точнее первой: ты уже знаешь карту.",
    hint: "Каждый предмет — несколько вариантов, счёт и рекорды сохраняются",
  },
  {
    key: "upgrade",
    img: `${CDN}/matrix-upgrade.jpg`,
    icon: TrendingUp,
    color: "#4ade80",
    title: "UPGRADE // Открой следующий уровень",
    text: "Сдал на ≥70% — щёлкнул замок: следующий предмет дорожки разблокирован. Алгебра → Геометрия → Вероятность → Русский → История → Литература. Семь уровней — и середина 8 класса в кармане.",
    hint: "Прогресс хранится в твоём профиле и на устройстве",
  },
];

// --- Дорожка уровней (визуальная мини-версия для лендинга) ---
const LEVELS = [
  { n: 1, label: "Алгебра", color: "#22d3ee" },
  { n: 2, label: "Геометрия", color: "#0bf2f6" },
  { n: 3, label: "Вероятность", color: "#4ade80" },
  { n: 4, label: "Русский", color: "#a855f7" },
  // task219: две истории — Всеобщая (1-е полугодие) раньше, России — финал
  { n: 5, label: "Всеобщая история", color: "#f59e0b" },
  { n: 6, label: "Литература", color: "#f43f5e" },
  { n: 7, label: "История России", color: "#eab308" },
];

export default function VprMatrixLanding() {
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 400], [0, 120]);
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0.3]);
  // task222: встроенный СУПЕРТЕСТ — диагностика прямо в Матрице (TG WebApp =
  // авторизованный контекст; прямая ссылка на /vpr-super остаётся гостевой)
  const [superOpen, setSuperOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#030712] text-zinc-300 font-sans overflow-x-hidden">
      {/* ============ HERO ============ */}
      <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden">
        <MatrixRain />
        {/* Hero-картинка */}
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${CDN}/matrix-hero.jpg`}
            alt="Ученик в матричном потоке знаний"
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#030712]/60 via-[#030712]/70 to-[#030712]" />
        </div>

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 text-center px-4 max-w-4xl mx-auto pt-20 pb-32">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 border border-green-500/30 bg-green-950/30 px-4 py-1.5 rounded-full text-xs font-mono text-green-400 mb-8"
          >
            <Terminal className="w-4 h-4" />
            <span>Wake up, восьмиклассник…</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="text-5xl md:text-7xl font-black text-white leading-[1.05] tracking-tight mb-6"
          >
            Матрица <span className="text-green-400">середины года</span>
            <br />
            <span className="text-2xl md:text-4xl text-zinc-400 font-bold">тренировочная программа 8 класса</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-zinc-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-10"
          >
            Контрольные за полугодия не сдаются зубрёжкой — они <b className="text-white">дешифруются</b>.
            Шесть уровней-предметов, шпаргалки как загрузка знаний, тесты как бои.
            Провалился — повторил — прокачался. Это не школа, это 21 век.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link href="/vpr-tests">
              <Button size="lg" className="bg-green-500 hover:bg-green-400 text-black font-black text-base px-8 py-6 rounded-xl shadow-[0_0_40px_rgba(34,197,94,0.35)]">
                Начать тренировку <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setSuperOpen(true)}
              className="border-cyan-500/50 text-cyan-300 font-bold text-base px-8 py-6 rounded-xl hover:bg-cyan-950/30"
            >
              <Radar className="mr-2 w-5 h-5" /> Супертест: найти дыры
            </Button>
            <Link href="#loop" className="hidden sm:block">
              <Button size="lg" variant="outline" className="border-zinc-700 text-zinc-300 font-bold text-base px-8 py-6 rounded-xl">
                Как это работает
              </Button>
            </Link>
          </motion.div>

          <div className="mt-10 text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-600">
            Free // Без регистрации // Первый уровень уже открыт
          </div>
          <div className="mt-3 text-[11px] text-zinc-500 font-mono">
            Лучше в Telegram: прогресс сохраняется, а бот присылает уведомления об открытых уровнях —{" "}
            <a
              href="https://t.me/oneBikePlsBot/vpr"
              className="text-green-400 hover:text-green-300 underline underline-offset-4"
              target="_blank"
              rel="noopener noreferrer"
            >
              t.me/oneBikePlsBot/vpr
            </a>
          </div>
        </motion.div>

        {/* Стрелка вниз */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-zinc-600"
        >
          <ArrowRight className="w-6 h-6 rotate-90" />
        </motion.div>
      </section>

      {/* ============ СУПЕРТЕСТ (task222) ============ */}
      <section id="super" className="relative max-w-5xl mx-auto px-4 py-20">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 border border-cyan-500/30 bg-cyan-950/30 px-4 py-1.5 rounded-full text-xs font-mono text-cyan-400 mb-6">
            <Radar className="w-4 h-4" />
            <span>diagnostic_protocol // 12 минут</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            Не знаешь, с чего начать? <span className="text-cyan-400">Супертест</span>
          </h2>
          <p className="text-zinc-500 max-w-xl mx-auto text-sm md:text-base leading-relaxed">
            Один прогон — все 7 предметов вперемешку. Система найдёт твои дыры и
            выстроит <b className="text-white">личную дорожку</b>: слабейшие предметы станут первыми уровнями.
            Без таймера, без наказаний — чистая диагностика.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {Object.values(SUPER_SUBJECT_META).map((m) => (
              <span
                key={m.short}
                className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border"
                style={{ color: m.color, borderColor: `${m.color}30`, backgroundColor: `${m.color}0d` }}
              >
                {m.short}
              </span>
            ))}
          </div>
        </div>

        {superOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-cyan-500/25 bg-zinc-950/80 overflow-hidden"
          >
            <SuperTestFlow embedded defaultMode="standard" onExit={() => setSuperOpen(false)} />
          </motion.div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => setSuperOpen(true)}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-black text-base px-8 py-6 rounded-xl shadow-[0_0_40px_rgba(34,211,238,0.3)]"
            >
              <Zap className="mr-2 w-5 h-5" /> Запустить диагностику
            </Button>
            <Link href="/vpr-super">
              <Button size="lg" variant="outline" className="border-zinc-700 text-zinc-300 font-bold text-base px-8 py-6 rounded-xl">
                Полный экран
              </Button>
            </Link>
          </div>
        )}
      </section>

      {/* ============ ДОРОЖКА УРОВНЕЙ ============ */}
      <section className="relative max-w-5xl mx-auto px-4 py-20">
        <h2 className="text-3xl md:text-4xl font-black text-white text-center mb-4">
          Семь уровней — <span className="text-green-400">одна дорожка</span>
        </h2>
        <p className="text-zinc-500 text-center max-w-xl mx-auto mb-14 text-sm md:text-base">
          Каждый следующий предмет закрыт замком. Ключ от замка — сданный тест предыдущего (минимум 70%).
        </p>

        <div className="relative">
          {/* Соединительная линия */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-500/50 via-green-500/50 to-rose-500/50 hidden md:block" />

          <div className="space-y-8">
            {LEVELS.map((lvl, i) => {
              const locked = i > 0;
              return (
                <motion.div
                  key={lvl.n}
                  initial={{ opacity: 0, x: i % 2 ? 40 : -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5 }}
                  className={cn(
                    "relative flex items-center gap-5 md:gap-8",
                    i % 2 ? "md:flex-row-reverse md:text-right" : ""
                  )}
                >
                  {/* Узел на линии */}
                  <div className="hidden md:block absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 z-10"
                       style={{ borderColor: lvl.color, backgroundColor: locked ? "#030712" : lvl.color }} />

                  <div className="w-1/2 hidden md:block" />

                  <div className={cn(
                    "flex-1 md:w-[calc(50%-2.5rem)] p-5 rounded-2xl border bg-zinc-950/70 backdrop-blur-sm",
                    locked ? "border-zinc-800/50" : "border-green-500/30"
                  )}>
                    <div className={cn("flex items-center gap-3", i % 2 ? "md:flex-row-reverse" : "")}>
                      {locked ? (
                        <div className="w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                          <Lock className="w-5 h-5 text-zinc-600" />
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border"
                             style={{ backgroundColor: `${lvl.color}12`, borderColor: `${lvl.color}30` }}>
                          <Unlock className="w-5 h-5" style={{ color: lvl.color }} />
                        </div>
                      )}
                      <div>
                        <div className="text-[9px] font-mono uppercase tracking-[0.25em] text-zinc-600">
                          Level {lvl.n} {locked ? "// locked" : "// открыт"}
                        </div>
                        <div className="text-lg font-black" style={{ color: locked ? "#71717a" : "#fff" }}>
                          {lvl.label}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ ЦИКЛ FEED→FIGHT→FAIL→REPEAT→UPGRADE ============ */}
      <section id="loop" className="relative py-20 bg-[#050a18]">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-black text-white text-center mb-4">
            Протокол <span className="text-green-400">прокачки</span>
          </h2>
          <p className="text-zinc-500 text-center max-w-xl mx-auto mb-16 text-sm md:text-base">
            Пять фаз цикла. В Матрице их проходят все — от Нео до топов вашего класса.
          </p>

          <div className="space-y-16 md:space-y-24">
            {LOOP_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.key}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.6 }}
                  className={cn(
                    "flex flex-col md:flex-row items-center gap-8 md:gap-12",
                    i % 2 ? "md:flex-row-reverse" : ""
                  )}
                >
                  {/* Картинка фазы */}
                  <div className="w-full md:w-1/2 relative group">
                    <div className="relative rounded-2xl overflow-hidden border aspect-[16/10]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={step.img}
                        alt={step.title}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#030712]/80 via-transparent to-transparent" />
                      <div className="absolute top-4 left-4 font-mono text-[10px] uppercase tracking-[0.3em] px-2.5 py-1 rounded-full border"
                           style={{ color: step.color, borderColor: `${step.color}50`, backgroundColor: `${step.color}10` }}>
                        phase_{String(i + 1).padStart(2, "0")}
                      </div>
                    </div>
                  </div>

                  {/* Текст фазы */}
                  <div className="w-full md:w-1/2">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center border shrink-0"
                           style={{ backgroundColor: `${step.color}12`, borderColor: `${step.color}30` }}>
                        <Icon className="w-6 h-6" style={{ color: step.color }} />
                      </div>
                      <h3 className="text-2xl font-black text-white tracking-tight">{step.title}</h3>
                    </div>
                    <p className="text-zinc-400 leading-relaxed mb-4">{step.text}</p>
                    <div className="inline-flex items-center gap-2 text-[11px] font-mono px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 text-zinc-400">
                      <Sparkles className="w-3.5 h-3.5" style={{ color: step.color }} />
                      {step.hint}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ ФИНАЛЬНЫЙ CTA ============ */}
      <section className="relative py-24 overflow-hidden">
        <MatrixRain />
        <div className="absolute inset-0 bg-gradient-to-b from-[#030712] via-transparent to-[#030712]" />
        <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
          <Trophy className="w-14 h-14 text-yellow-400 mx-auto mb-6" />
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
            Середина года — <span className="text-green-400">пройдена</span>
          </h2>
          <p className="text-zinc-400 leading-relaxed mb-10 max-w-xl mx-auto">
            Семь зелёных галочек на дорожке — и контрольные больше не монстр,
            а чекпоинт, который ты уже прошёл в тренажёре. Красная или синяя пилюля —
            то есть, найти свои дыры или открыть список уровней?
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => {
                setSuperOpen(true);
                document.getElementById("super")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="bg-green-500 hover:bg-green-400 text-black font-black text-base px-8 py-6 rounded-xl shadow-[0_0_40px_rgba(34,197,94,0.35)]"
            >
              <Radar className="mr-2 w-5 h-5" /> Пройти Супертест
            </Button>
            <Link href="/vpr-tests">
              <Button size="lg" variant="outline" className="border-green-500/40 text-green-400 font-bold text-base px-8 py-6 rounded-xl">
                Открыть дорожку
              </Button>
            </Link>
          </div>
          <div className="mt-12 text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-600">
            I know kung fu… and теорему Пифагора
          </div>
        </div>
      </section>
    </div>
  );
}
