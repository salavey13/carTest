"use client";

// /app/sly13/Sly13LandingClient.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Клиентская часть витрины SLY13 (task 136). Палитра приходит с RSC-страницы
// (с фолбэком), всё остальное — здесь: собственные nav+footer (chrome подавлен
// через THEME_CONFIG.sly13), bento-сетки, framer-motion reveal-ы, счётчики,
// параллакс фонов, spotlight-карточки, marquee, зерно.
//
// «Crank it to 13» — набор трендов-2026: kinetic display type (solid/outline/
// gradient), bento stats с count-up, scroll-parallax picture backgrounds,
// spotlight hover, моно-акценты (JetBrains Mono), grain, marquee ticker,
// reduced-motion уважается (MotionConfig + CSS media query).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { MotionConfig, motion, useScroll, useTransform, useInView, animate } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";
import { FaTelegramPlane } from "react-icons/fa";

type Palette = {
  bgBase: string;
  bgCard: string;
  accentMain: string;
  accentMainHover: string;
  textPrimary: string;
  textSecondary: string;
  borderSoft: string;
};

// ── Данные витрины (те же проверенные цифры, что были в RSC в task 134) ─────
const SB = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix";
const IMG = {
  hero: `${SB}/46f34997-2589-4ae7-9082-a374f19419a6-c899f118-1692-45b9-b6ef-d1066a607426.jpg`,
  audit: `${SB}/ducati-1199-panigale-2012/image_1.jpg`,
  cta: `${SB}/suzuki-vzr1800-boulevard-2006/image_1.jpg`,
  motoHero: "https://static.tildacdn.com/tild3739-3737-4761-a335-353163363963/harley-davidson-ride.jpg",
};

const SEASON_MONTHS = [
  { m: "Май", n: 10 },
  { m: "Июн", n: 9 },
  { m: "Июл", n: 49 },
  { m: "Авг", n: 83 },
  { m: "Сен", n: 109 },
  { m: "Окт", n: 31 },
];
const SEASON_MAX = Math.max(...SEASON_MONTHS.map((x) => x.n));

// Услуги sly13 — обложки из каталога экипажа (public.cars type=service,
// task 135 присвоил image_1_4x3.jpg каждому). Цены/тексты — из сид-дока.
const SERVICES = [
  {
    id: "sly13-setup-001",
    title: "Запуск экипажа «Базовый»",
    price: "25 000 ₽",
    text: "Полный запуск витрины: брендинг, каталог, корзина, админка, Telegram-бот. Два дня работы.",
    tag: "установка",
  },
  {
    id: "sly13-setup-002",
    title: "Запуск экипажа «Под ключ»",
    price: "60 000 ₽",
    text: "Всё из «Базового» + аналитика, документооборот, обучение двух админов, неделя сопровождения.",
    tag: "установка",
  },
  {
    id: "sly13-vibe-001",
    title: "Vibe-сессия «Аудит»",
    price: "5 000 ₽",
    text: "Разбор текущих процессов бизнеса. Онлайн 1,5 часа: план цифровизации и первые шаги, готовый roadmap.",
    tag: "консультация",
  },
  {
    id: "sly13-vibe-002",
    title: "Vibe-сессия «Проектирование»",
    price: "7 000 ₽",
    text: "Проектируем структуру экипажа: каталог, роли, процессы, документы. Онлайн 2 часа.",
    tag: "консультация",
  },
  {
    id: "sly13-edu-001",
    title: "Обучение админа (1 час)",
    price: "3 000 ₽",
    text: "Индивидуально: товары, заказы, аналитика, пользователи — под ваш экипаж.",
    tag: "обучение",
  },
  {
    id: "sly13-edu-002",
    title: "Обучение админа (5 часов)",
    price: "12 000 ₽",
    text: "Полный курс админа экипажа пакетом — от каталога до кассовой книги и сверки.",
    tag: "обучение",
  },
  {
    id: "sly13-mnt-001",
    title: "Сопровождение (месяц)",
    price: "15 000 ₽",
    text: "Апдейты, новые фичи, помощь админу, Telegram-саппорт в рабочее время.",
    tag: "поддержка",
  },
];

const PIPELINE_CREWS = [
  { slug: "georg-electro", label: "georg-electro", note: "диагностика электро-систем" },
  { slug: "nn-mototeh-nn", label: "nn-mototeh-nn", note: "мототехника NN, колесо фортуны e2e" },
  { slug: "djorudjov", label: "djorudjov", note: "контент и рассылки экипажа" },
];

const TICKER = [
  "запуск экипажей",
  "telegram mini app",
  "сверка и комиссии",
  "договоры docx + ocr",
  "касса и депозиты",
  "аналитика сезона",
  "white-label витрины",
  "брендинг и каталог",
];

const NAV_LINKS = [
  { href: "#proof", label: "Цифры" },
  { href: "#audit", label: "Сверка" },
  { href: "#vision", label: "Экономика" },
  { href: "#services", label: "Услуги" },
  { href: "#partners", label: "Партнёры" },
];

const EASE = [0.22, 1, 0.36, 1] as const;

// ── Хелперы анимации ────────────────────────────────────────────────────────
function Reveal({
  children,
  delay = 0,
  y = 26,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.65, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Счётчик с запуском при появлении в вьюпорте; формат ru-RU. */
function CountUp({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1.7,
}: {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  useEffect(() => {
    if (!inView || !ref.current) return;
    const controls = animate(0, to, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => {
        if (ref.current) {
          ref.current.textContent =
            prefix + v.toLocaleString("ru-RU", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
        }
      },
    });
    return () => controls.stop();
  }, [inView, to, decimals, prefix, suffix, duration]);
  return (
    <span ref={ref}>
      {prefix}0{suffix}
    </span>
  );
}

/** Карточка со spotlight-подсветкой, следующей за курсором (CSS-переменные). */
function SpotlightCard({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`sly-spot relative ${className}`}
      style={style}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
    >
      {children}
    </div>
  );
}

/** Фоновая картинка секции с мягким параллаксом (scroll-linked). */
function ParallaxBg({
  targetRef,
  src,
  scrim,
  glow,
}: {
  targetRef: React.RefObject<HTMLElement | null>;
  src: string;
  scrim: string;
  glow?: string;
}) {
  const { scrollYProgress } = useScroll({ target: targetRef, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-9%", "9%"]);
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <motion.div style={{ y }} className="absolute -inset-y-[10%] inset-x-0">
        <Image src={src} alt="" fill sizes="100vw" className="object-cover opacity-45" />
      </motion.div>
      <div className="absolute inset-0" style={{ background: scrim }} />
      {glow && <div className="absolute inset-0" style={{ background: glow }} />}
    </div>
  );
}

// ── Основной компонент ──────────────────────────────────────────────────────
export default function Sly13LandingClient({ palette: p }: { palette: Palette }) {
  const auditRef = useRef<HTMLElement>(null);
  const ctaRef = useRef<HTMLElement>(null);

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="sly-root min-h-screen"
        style={{
          ["--sly-bg" as string]: p.bgBase,
          ["--sly-card" as string]: p.bgCard,
          ["--sly-accent" as string]: p.accentMain,
          ["--sly-accent2" as string]: p.accentMainHover,
          ["--sly-text" as string]: p.textPrimary,
          ["--sly-text2" as string]: p.textSecondary,
          ["--sly-border" as string]: p.borderSoft,
          background: p.bgBase,
          color: p.textPrimary,
        }}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;800&display=swap');
          /* Явный цвет заголовков: globals.css даёт h1-h6 Archivo Black +
             text-foreground — на всегда тёмной витрине в light-схеме это
             «тёмное на тёмном» (bug пойман в task 134). */
          .sly-root h1, .sly-root h2, .sly-root h3, .sly-root h4 {
            font-family: 'Inter', system-ui, sans-serif;
            color: var(--sly-text);
          }
          .font-jb { font-family: 'JetBrains Mono', ui-monospace, monospace; }
          @keyframes sly-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
          @keyframes sly-kenburns { 0% { transform: scale(1) translateY(0); } 100% { transform: scale(1.14) translateY(-2%); } }
          @keyframes sly-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(8px); } }
          /* spotlight-подсветка карточки за курсором */
          .sly-spot::before {
            content: ''; position: absolute; inset: 0; border-radius: inherit;
            opacity: 0; transition: opacity .35s ease; pointer-events: none;
            background: radial-gradient(240px circle at var(--mx,50%) var(--my,50%),
              color-mix(in srgb, var(--sly-accent) 13%, transparent), transparent 68%);
          }
          .sly-spot:hover::before { opacity: 1; }
          /* плёночное зерно поверх всего лендинга */
          .sly-grain {
            position: fixed; inset: 0; z-index: 60; pointer-events: none; opacity: .05;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E");
          }
          @media (prefers-reduced-motion: reduce) {
            .sly-marquee-track, .sly-kenburns, .sly-float { animation: none !important; }
          }
        `}</style>

        <div className="sly-grain" aria-hidden />

        {/* ── NAV ─────────────────────────────────────────────────────────── */}
        <header
          className="sticky top-0 z-50 border-b backdrop-blur-xl"
          style={{ borderColor: p.borderSoft, background: `${p.bgBase}CC` }}
        >
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
            <Link href="/sly13" className="flex items-center gap-2 whitespace-nowrap">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: p.accentMain, boxShadow: `0 0 10px ${p.accentMain}` }}
                aria-hidden
              />
              <span className="text-sm font-black uppercase tracking-[0.22em]" style={{ color: p.textPrimary }}>
                SLY<span style={{ color: p.accentMain }}>13</span>
              </span>
            </Link>
            <nav aria-label="Основная навигация" className="hidden items-center gap-6 md:flex">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="font-jb text-[11px] font-semibold uppercase tracking-[0.16em] transition hover:opacity-100"
                  style={{ color: p.textSecondary }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = p.accentMain)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "")}
                >
                  {l.label}
                </a>
              ))}
            </nav>
            <a
              href="https://t.me/SALAVEY13"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-full px-4 text-xs font-bold uppercase tracking-[0.1em] transition hover:brightness-110 active:scale-95"
              style={{ background: p.accentMain, color: p.bgBase }}
            >
              <FaTelegramPlane className="h-3.5 w-3.5" aria-hidden />
              @SALAVEY13
            </a>
          </div>
        </header>

        {/* ── HERO ────────────────────────────────────────────────────────── */}
        <section className="relative flex min-h-[100svh] items-center overflow-hidden">
          <div className="absolute inset-0" aria-hidden>
            <div
              className="sly-kenburns absolute inset-0 will-change-transform"
              style={{ animation: "sly-kenburns 28s ease-in-out infinite alternate" }}
            >
              <Image src={IMG.hero} alt="" fill priority sizes="100vw" className="object-cover opacity-45" />
            </div>
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(to bottom, ${p.bgBase}D9 0%, ${p.bgBase}80 45%, ${p.bgBase} 96%)` }}
            />
            {/* кибер-сетка поверх фото — тонкие линии, растворяются к краям */}
            <div
              className="absolute inset-0 opacity-[0.13]"
              style={{
                backgroundImage: `linear-gradient(${p.accentMain} 1px, transparent 1px), linear-gradient(90deg, ${p.accentMain} 1px, transparent 1px)`,
                backgroundSize: "72px 72px",
                maskImage: "radial-gradient(75% 60% at 50% 42%, black 0%, transparent 100%)",
                WebkitMaskImage: "radial-gradient(75% 60% at 50% 42%, black 0%, transparent 100%)",
              }}
            />
            <div
              className="absolute inset-0"
              style={{ background: `radial-gradient(56% 52% at 50% 36%, ${p.accentMain}21 0%, transparent 70%)` }}
            />
          </div>

          <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-28 pt-32 text-center sm:px-6">
            <Reveal>
              <p
                className="font-jb mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] uppercase tracking-[0.2em] backdrop-blur"
                style={{ borderColor: p.borderSoft, background: `${p.bgCard}B3`, color: p.textSecondary }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: p.accentMain, boxShadow: `0 0 8px ${p.accentMain}` }}
                  aria-hidden
                />
                личная витрина salavey13 · франшизы проката
              </p>
            </Reveal>

            {/* kinetic display: solid / outline / gradient — трёхслойный заголовок,
                соизмеримый с moto-selection, но в фирменном циане на графите */}
            <h1 className="select-none font-black uppercase leading-[0.92] tracking-tight">
              <Reveal delay={0.05}>
                <span className="block text-[17vw] text-white sm:text-8xl lg:text-9xl">SLY13</span>
              </Reveal>
              <Reveal delay={0.15}>
                <span
                  className="block text-[9.4vw] sm:text-6xl lg:text-7xl"
                  style={{ color: "transparent", WebkitTextStroke: `1.5px ${p.textPrimary}99` }}
                >
                  платформа
                </span>
              </Reveal>
              <Reveal delay={0.25}>
                <span
                  className="block bg-clip-text text-transparent text-[9.4vw] sm:text-6xl lg:text-7xl"
                  style={{ backgroundImage: `linear-gradient(94deg, ${p.accentMain} 12%, ${p.accentMainHover} 88%)` }}
                >
                  франшиз проката
                </span>
              </Reveal>
            </h1>

            <Reveal delay={0.35}>
              <p className="mx-auto mt-7 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: p.textPrimary }}>
                Выросла из боевого экипажа{" "}
                <Link
                  href="/franchize/vip-bike"
                  className="underline decoration-dotted underline-offset-4"
                  style={{ color: p.accentMain }}
                >
                  VIP BIKE
                </Link>{" "}
                — не демо в вакууме, а софт, который каждый день работает на живом прокате
                электробайков в Нижнем Новгороде.
              </p>
            </Reveal>

            <Reveal delay={0.45}>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/franchize/sly13"
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-full px-8 text-sm font-bold uppercase tracking-[0.08em] transition hover:brightness-110 active:scale-95"
                  style={{
                    background: p.accentMain,
                    color: p.bgBase,
                    boxShadow: `0 0 24px ${p.accentMain}55, 0 0 64px ${p.accentMain}22`,
                  }}
                >
                  Каталог услуг и запусков
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
                <a
                  href="https://t.me/SALAVEY13"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border px-8 text-sm font-bold uppercase tracking-[0.08em] backdrop-blur transition active:scale-95"
                  style={{ borderColor: `${p.textPrimary}44`, color: p.textPrimary }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = p.accentMain;
                    e.currentTarget.style.color = p.accentMain;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = `${p.textPrimary}44`;
                    e.currentTarget.style.color = "";
                  }}
                >
                  <FaTelegramPlane className="h-4 w-4" aria-hidden />
                  Написать в Telegram
                </a>
              </div>
            </Reveal>

            <Reveal delay={0.55}>
              <div className="font-jb mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-2 text-[11px] uppercase tracking-[0.14em]">
                {[
                  "308 аренд",
                  "≈ 2,0 млн ₽",
                  "31 дкп",
                  "6 экипажей в пайплайне",
                ].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border px-3.5 py-1.5 backdrop-blur"
                    style={{ borderColor: p.borderSoft, background: `${p.bgCard}80`, color: p.textSecondary }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>

          {/* scroll cue */}
          <a
            href="#proof"
            aria-label="Листать к цифрам сезона"
            className="sly-float absolute bottom-16 left-1/2 z-10 -translate-x-1/2"
            style={{ animation: "sly-float 2.4s ease-in-out infinite" }}
          >
            <ChevronDown className="h-6 w-6" style={{ color: p.textSecondary }} aria-hidden />
          </a>

          {/* ticker-строка фич платформы */}
          <div
            className="absolute inset-x-0 bottom-0 z-10 overflow-hidden border-t py-3"
            style={{ borderColor: p.borderSoft, background: `${p.bgBase}66`, backdropFilter: "blur(8px)" }}
          >
            <div
              className="sly-marquee-track font-jb flex w-max items-center gap-8 whitespace-nowrap pr-8 text-[11px] uppercase tracking-[0.24em]"
              style={{ animation: "sly-marquee 32s linear infinite", color: p.textSecondary }}
            >
              {[...TICKER, ...TICKER].map((t, i) => (
                <span key={`${t}-${i}`} className="flex items-center gap-8">
                  {t}
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: p.accentMain }} aria-hidden />
                </span>
              ))}
            </div>
          </div>
        </section>

        <main className="mx-auto w-full max-w-7xl space-y-24 px-4 pb-24 sm:px-6">
          {/* ── 01 · ЦИФРЫ СЕЗОНА (bento + count-up) ─────────────────────── */}
          <section id="proof" className="scroll-mt-20 pt-8">
            <Reveal>
              <p className="font-jb text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: p.accentMain }}>
                01 · сезон-2026 в цифрах
              </p>
              <h2 className="mt-3 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                Первый клиент — <span style={{ color: p.accentMain }}>боевой</span>, не синтетика
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-relaxed md:text-lg" style={{ color: p.textSecondary }}>
                VIP BIKE — тестовый экипаж в самом честном смысле: сначала платформа в бою, потом
                продукт. Весь сезон 2026 идёт через неё: заказы из Telegram Mini App, договоры DOCX
                с OCR паспорта и ВУ, депозиты, касса, смены и зарплаты операторов. Ни одна цифра
                ниже не нарисована — всё считается из Supabase на странице{" "}
                <Link
                  href="/franchize/vip-bike"
                  className="underline decoration-dotted underline-offset-4"
                  style={{ color: p.accentMain }}
                >
                  «Сезон-2026» экипажа
                </Link>
                .
              </p>
            </Reveal>

            <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {/* Большая плитка: 308 аренд + график по месяцам */}
              <Reveal className="col-span-2 row-span-2" delay={0.05}>
                <SpotlightCard
                  className="flex h-full flex-col justify-between overflow-hidden rounded-2xl border p-6"
                  style={{ background: p.bgCard, borderColor: p.borderSoft }}
                >
                  <div>
                    <div className="font-jb text-6xl font-extrabold leading-none sm:text-7xl" style={{ color: p.accentMain }}>
                      <CountUp to={308} duration={2} />
                    </div>
                    <div className="mt-2 text-sm font-semibold" style={{ color: p.textPrimary }}>
                      аренд за сезон 2026
                    </div>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: p.textSecondary }}>
                      май → октябрь, включая ретро-импорт архива из 145 бумажных договоров
                    </p>
                  </div>
                  <div className="mt-6 flex items-end gap-2.5" style={{ height: 110 }}>
                    {SEASON_MONTHS.map(({ m, n }, i) => (
                      <div key={m} className="flex flex-1 flex-col items-center justify-end gap-2">
                        <span className="font-jb text-[10px] font-semibold" style={{ color: p.textPrimary }}>
                          {n}
                        </span>
                        <motion.div
                          className="w-full rounded-t-md"
                          initial={{ height: 0 }}
                          whileInView={{ height: `${Math.max(6, Math.round((n / SEASON_MAX) * 100))}%` }}
                          viewport={{ once: true, margin: "-60px" }}
                          transition={{ duration: 0.9, delay: 0.15 + i * 0.08, ease: EASE }}
                          style={{
                            background: n === SEASON_MAX ? p.accentMain : `${p.accentMain}66`,
                            minHeight: 6,
                          }}
                        />
                        <span className="font-jb text-[10px]" style={{ color: p.textSecondary }}>
                          {m}
                        </span>
                      </div>
                    ))}
                  </div>
                </SpotlightCard>
              </Reveal>

              <Reveal delay={0.12}>
                <SpotlightCard
                  className="h-full rounded-2xl border p-5"
                  style={{ background: p.bgCard, borderColor: p.borderSoft }}
                >
                  <div className="font-jb text-3xl font-extrabold" style={{ color: p.textPrimary }}>
                    <CountUp to={2} decimals={1} prefix="≈ " suffix=" млн ₽" />
                  </div>
                  <div className="mt-1 text-sm font-medium" style={{ color: p.accentMain }}>
                    выручка по аренде
                  </div>
                  <p className="mt-2 text-xs" style={{ color: p.textSecondary }}>
                    пик сезона: 109 аренд в сентябре
                  </p>
                </SpotlightCard>
              </Reveal>

              <Reveal delay={0.18}>
                <SpotlightCard
                  className="h-full rounded-2xl border p-5"
                  style={{ background: p.bgCard, borderColor: p.borderSoft }}
                >
                  <div className="font-jb text-3xl font-extrabold" style={{ color: p.textPrimary }}>
                    <CountUp to={31} />
                  </div>
                  <div className="mt-1 text-sm font-medium" style={{ color: p.accentMain }}>
                    продажи байков
                  </div>
                  <p className="mt-2 text-xs" style={{ color: p.textSecondary }}>
                    ≈ 13,0 млн ₽ по договорам купли-продажи
                  </p>
                </SpotlightCard>
              </Reveal>

              <Reveal delay={0.24}>
                <SpotlightCard
                  className="h-full rounded-2xl border p-5"
                  style={{ background: p.bgCard, borderColor: p.borderSoft }}
                >
                  <div className="font-jb text-3xl font-extrabold" style={{ color: p.textPrimary }}>
                    <CountUp to={16.5} decimals={1} prefix="≈ " suffix=" млн ₽" />
                  </div>
                  <div className="mt-1 text-sm font-medium" style={{ color: p.accentMain }}>
                    оборот кассы
                  </div>
                  <p className="mt-2 text-xs" style={{ color: p.textSecondary }}>
                    приход/расход со сдвигами и зарплатами
                  </p>
                </SpotlightCard>
              </Reveal>

              {/* Акцентная плитка: ретро-импорт */}
              <Reveal delay={0.3}>
                <SpotlightCard
                  className="h-full rounded-2xl border p-5"
                  style={{
                    background: `linear-gradient(135deg, ${p.accentMain}1F, ${p.bgCard} 55%)`,
                    borderColor: `${p.accentMain}55`,
                  }}
                >
                  <div className="font-jb text-3xl font-extrabold" style={{ color: p.accentMain }}>
                    +<CountUp to={188} suffix=" 000 ₽" />
                  </div>
                  <div className="mt-1 text-sm font-medium" style={{ color: p.textPrimary }}>
                    вернул ретро-импорт
                  </div>
                  <p className="mt-2 text-xs" style={{ color: p.textSecondary }}>
                    оцифровка архива закрыла «слепое пятно» весны
                  </p>
                </SpotlightCard>
              </Reveal>
            </div>
          </section>

          {/* ── 02 · СВЕРКА (picture background + параллакс) ──────────────── */}
          <section
            id="audit"
            ref={auditRef}
            className="relative -mx-4 overflow-hidden border-y px-4 py-20 sm:-mx-6 sm:px-6 sm:py-28"
            style={{ borderColor: p.borderSoft }}
          >
            <ParallaxBg
              targetRef={auditRef}
              src={IMG.audit}
              scrim={`linear-gradient(100deg, ${p.bgBase}F2 0%, ${p.bgBase}CC 45%, ${p.bgBase}59 100%)`}
              glow={`radial-gradient(52% 60% at 78% 40%, ${p.accentMain}1A 0%, transparent 70%)`}
            />
            <div className="relative z-10">
              <Reveal>
                <p className="font-jb text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: p.accentMain }}>
                  02 · сверка
                </p>
                <h2 className="mt-3 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                  Считаем каждую копейку — <span style={{ color: p.accentMain }}>прямо сейчас</span>
                </h2>
                <p className="mt-4 max-w-3xl text-base leading-relaxed md:text-lg" style={{ color: p.textSecondary }}>
                  Все данные сезона сохранены, и текущая задача — финальная сверка: считаем комиссии
                  операторов по типам операций (аренда почасовая/посуточная, продажи, оборудование),
                  депозиты и возвраты. Жёлтый октябрь-разбор показал, зачем это нужно: автоматический
                  аудит нашёл расхождения «бумажный договор против книг» — и вернул потерянные деньги
                  в учёт.
                </p>
              </Reveal>
              <div className="mt-9 grid gap-4 sm:grid-cols-3">
                {[
                  { n: 154, t: "аренды октября разобраны автоматическим аудитом" },
                  { n: 32, t: "находки «sus»: бумага против книг — от депозита до итога" },
                  { n: 18, t: "утерянных депозитов из старых договоров восстановлено в книгах" },
                ].map(({ n, t }, i) => (
                  <Reveal key={n} delay={0.1 + i * 0.08}>
                    <SpotlightCard
                      className="h-full rounded-2xl border p-6 backdrop-blur-sm"
                      style={{ background: `${p.bgCard}D9`, borderColor: p.borderSoft }}
                    >
                      <div className="font-jb text-4xl font-extrabold" style={{ color: p.accentMain }}>
                        <CountUp to={n} duration={1.5} />
                      </div>
                      <p className="mt-2 text-sm leading-relaxed" style={{ color: p.textSecondary }}>
                        {t}
                      </p>
                    </SpotlightCard>
                  </Reveal>
                ))}
              </div>
              <Reveal delay={0.2}>
                <p className="mt-7 max-w-3xl text-sm leading-relaxed" style={{ color: p.textSecondary }}>
                  Под капотом: комиссия по правилам экипажа (процент или фикс, по типу операции),
                  планы зарплат и кассовая книга с проводками, сверка расчёта с оператором в один тап
                  и payout-хаб. То, что для обычного проката — «тетрадка и калькулятор», здесь — код.
                </p>
              </Reveal>
            </div>
          </section>

          {/* ── 03 · ЭКОНОМИКА ФРАНШИЗЫ ───────────────────────────────────── */}
          <section id="vision" className="scroll-mt-20">
            <Reveal>
              <p className="font-jb text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: p.accentMain }}>
                03 · экономика франшизы
              </p>
              <h2 className="mt-3 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                Сначала заработать — <span style={{ color: p.accentMain }}>потом продавать</span>
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-relaxed md:text-lg" style={{ color: p.textSecondary }}>
                Если комиссии и деньги экипажа сходятся на платформе — это лучшее доказательство для
                продажи установок другим прокатам. Пайплайн уже собран: несколько экипажей
                подготовлены заранее, у каждого свой slug, каталог, брендинг и Telegram-бот.
              </p>
            </Reveal>
            <div className="mt-9 grid gap-4 md:grid-cols-2">
              <Reveal delay={0.08}>
                <SpotlightCard
                  className="h-full rounded-2xl border p-6"
                  style={{ background: p.bgCard, borderColor: p.borderSoft }}
                >
                  <h3 className="flex items-center gap-2 text-base font-bold">
                    <span className="font-jb" style={{ color: p.accentMain }}>
                      ⌁
                    </span>
                    Экипажи на подходе
                  </h3>
                  <div className="mt-4 space-y-3">
                    {PIPELINE_CREWS.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/franchize/${c.slug}`}
                        className="group flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition"
                        style={{ borderColor: p.borderSoft, background: `${p.bgBase}80` }}
                      >
                        <span>
                          <span className="font-jb block text-sm font-semibold" style={{ color: p.textPrimary }}>
                            {c.label}
                          </span>
                          <span className="text-xs" style={{ color: p.textSecondary }}>
                            {c.note}
                          </span>
                        </span>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1"
                          style={{ color: p.accentMain }}
                          aria-hidden
                        />
                      </Link>
                    ))}
                    <Link
                      href="/moto-selection"
                      className="group flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition"
                      style={{ borderColor: `${p.accentMain}55`, background: `${p.accentMain}0D` }}
                    >
                      <span>
                        <span className="font-jb block text-sm font-semibold" style={{ color: p.textPrimary }}>
                          moto-selection · лендинг
                        </span>
                        <span className="text-xs" style={{ color: p.textSecondary }}>
                          мотосервис, 8 услуг, первый экипаж на платформе
                        </span>
                      </span>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1"
                        style={{ color: p.accentMain }}
                        aria-hidden
                      />
                    </Link>
                  </div>
                </SpotlightCard>
              </Reveal>
              <Reveal delay={0.16}>
                <SpotlightCard
                  className="h-full rounded-2xl border p-6"
                  style={{ background: p.bgCard, borderColor: p.borderSoft }}
                >
                  <h3 className="flex items-center gap-2 text-base font-bold">
                    <span className="font-jb" style={{ color: p.accentMain }}>
                      ↑
                    </span>
                    Как продаётся установка
                  </h3>
                  <ul className="mt-4 space-y-3.5 text-sm leading-relaxed" style={{ color: p.textSecondary }}>
                    <li>
                      <span style={{ color: p.textPrimary }}>White-label за 1–2 недели</span> — бренд
                      клиента, свой каталог, витрина в Telegram Mini App (бот уже в проде).
                    </li>
                    <li>
                      <span style={{ color: p.textPrimary }}>Вертикаль из коробки</span>: договоры
                      DOCX, OCR паспорта/ВУ, QR-claim, касса, депозиты — то, что generic-CRM строят
                      месяцами.
                    </li>
                    <li>
                      <span style={{ color: p.textPrimary }}>Модель монетизации</span>: запуск под
                      ключ + подписка на сопровождение, платежи в Telegram (XTR), каркас Pro-пакетов
                      single-city / multi-city / enterprise уже спроектирован.
                    </li>
                  </ul>
                </SpotlightCard>
              </Reveal>
            </div>
          </section>

          {/* ── 04 · УСЛУГИ (обложки из каталога экипажа) ─────────────────── */}
          <section id="services" className="scroll-mt-20">
            <Reveal>
              <p className="font-jb text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: p.accentMain }}>
                04 · услуги
              </p>
              <h2 className="mt-3 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                Услуги и запуск экипажей
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-relaxed md:text-lg" style={{ color: p.textSecondary }}>
                Продуктизированный список: от разовой сессии до полного запуска витрины под ключ.
                Обложки — из живого каталога экипажа. Актуальные цены и оформление заказа — в
                каталоге.
              </p>
            </Reveal>
            <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SERVICES.map((s, i) => (
                <Reveal key={s.id} delay={0.05 + (i % 3) * 0.07}>
                  <SpotlightCard
                    className="group h-full overflow-hidden rounded-2xl border transition-transform duration-300 hover:-translate-y-1"
                    style={{ background: p.bgCard, borderColor: p.borderSoft }}
                  >
                    <div className="relative h-44 w-full overflow-hidden">
                      <Image
                        src={`${SB}/${s.id}/image_1_4x3.jpg`}
                        alt={s.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" aria-hidden />
                      <span
                        className="font-jb absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold"
                        style={{ background: p.accentMain, color: p.bgBase }}
                      >
                        {s.price}
                      </span>
                    </div>
                    <div className="p-5">
                      <h3 className="text-base font-bold leading-snug">{s.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed" style={{ color: p.textSecondary }}>
                        {s.text}
                      </p>
                      <p className="font-jb mt-3 text-[11px] uppercase tracking-[0.18em]" style={{ color: p.accentMain }}>
                        {s.tag}
                      </p>
                    </div>
                  </SpotlightCard>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.15}>
              <div className="mt-9 text-center">
                <Link
                  href="/franchize/sly13"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-8 text-sm font-bold uppercase tracking-[0.08em] transition hover:brightness-110 active:scale-95"
                  style={{
                    background: p.accentMain,
                    color: p.bgBase,
                    boxShadow: `0 0 24px ${p.accentMain}44`,
                  }}
                >
                  Открыть каталог
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </Reveal>
          </section>

          {/* ── 05 · ПАРТНЁРЫ (cross-link с /moto-selection) ──────────────── */}
          <section id="partners" className="scroll-mt-20">
            <Reveal>
              <p className="font-jb text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: p.accentMain }}>
                05 · партнёры
              </p>
              <h2 className="mt-3 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                Партнёры на <span style={{ color: p.accentMain }}>одном софте</span>
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-relaxed md:text-lg" style={{ color: p.textSecondary }}>
                Витрины, которые уже живут на платформе или готовятся к запуску. Каждый экипаж — со
                своим брендом, каталогом и бот, но цифры, договоры и сверка — общие.
              </p>
            </Reveal>

            {/* Флагманская карточка: moto-selection */}
            <Reveal delay={0.08}>
              <SpotlightCard
                className="mt-9 grid overflow-hidden rounded-2xl border lg:grid-cols-[1.15fr_1fr]"
                style={{ background: p.bgCard, borderColor: `${p.accentMain}44` }}
              >
                <div className="p-7 sm:p-9">
                  <p className="font-jb text-[11px] font-bold uppercase tracking-[0.24em]" style={{ color: p.accentMain }}>
                    флагман платформы · мотосервис
                  </p>
                  <h3 className="mt-3 text-2xl font-black uppercase tracking-tight sm:text-3xl">
                    Moto<span style={{ color: p.accentMain }}>.</span>selection
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed sm:text-base" style={{ color: p.textSecondary }}>
                    Мотосервис из Нижнего Новгорода: обучение, подбор, ТО, хранение, детейлинг и
                    эвакуация 24/7. Первый экипаж платформы со своим лендингом — копия
                    moto-selection.ru, синхронизированная с каталогом экипажа.
                  </p>
                  <div className="font-jb mt-5 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.12em]">
                    {["8 услуг", "7 городов", "24/7"].map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full border px-3 py-1"
                        style={{ borderColor: p.borderSoft, color: p.textSecondary }}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href="/moto-selection"
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-xs font-bold uppercase tracking-[0.1em] transition hover:brightness-110 active:scale-95"
                      style={{ background: p.accentMain, color: p.bgBase }}
                    >
                      Открыть лендинг
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                    <Link
                      href="/franchize/moto-selection?mode=service"
                      className="inline-flex h-11 items-center justify-center rounded-full border px-6 text-xs font-bold uppercase tracking-[0.1em] transition active:scale-95"
                      style={{ borderColor: `${p.textPrimary}44`, color: p.textPrimary }}
                    >
                      Каталог экипажа
                    </Link>
                  </div>
                </div>
                <div className="relative min-h-56 lg:min-h-full">
                  <Image
                    src={IMG.motoHero}
                    alt="Moto.selection — Harley на закате"
                    fill
                    sizes="(max-width: 1024px) 100vw, 45vw"
                    className="object-cover"
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(90deg, ${p.bgCard} 0%, transparent 40%)` }}
                    aria-hidden
                  />
                </div>
              </SpotlightCard>
            </Reveal>

            {/* Остальные экипажи пайплайна */}
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {PIPELINE_CREWS.map((c, i) => (
                <Reveal key={c.slug} delay={0.06 + i * 0.06}>
                  <Link href={`/franchize/${c.slug}`} className="block h-full">
                    <SpotlightCard
                      className="group h-full rounded-2xl border p-5 transition-transform duration-300 hover:-translate-y-1"
                      style={{ background: p.bgCard, borderColor: p.borderSoft }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-jb text-sm font-semibold" style={{ color: p.textPrimary }}>
                          {c.label}
                        </span>
                        <ChevronRight
                          className="h-4 w-4 transition-transform group-hover:translate-x-1"
                          style={{ color: p.accentMain }}
                          aria-hidden
                        />
                      </div>
                      <p className="mt-2 text-xs leading-relaxed" style={{ color: p.textSecondary }}>
                        {c.note}
                      </p>
                      <p className="font-jb mt-3 text-[10px] uppercase tracking-[0.18em]" style={{ color: p.accentMain }}>
                        в подготовке
                      </p>
                    </SpotlightCard>
                  </Link>
                </Reveal>
              ))}
            </div>
          </section>

          {/* ── ФИНАЛЬНЫЙ CTA (picture background) ────────────────────────── */}
          <section
            ref={ctaRef}
            className="relative -mx-4 overflow-hidden rounded-none border-y px-4 py-20 text-center sm:-mx-6 sm:px-6 sm:py-24"
            style={{ borderColor: p.borderSoft }}
          >
            <ParallaxBg
              targetRef={ctaRef}
              src={IMG.cta}
              scrim={`linear-gradient(to bottom, ${p.bgBase}E6, ${p.bgBase}B3 45%, ${p.bgBase}F2)`}
              glow={`radial-gradient(50% 55% at 50% 45%, ${p.accentMain}1C 0%, transparent 70%)`}
            />
            <div className="relative z-10 mx-auto max-w-2xl">
              <Reveal>
                <h2 className="text-2xl font-black tracking-tight sm:text-4xl">
                  Есть прокат — нужна <span style={{ color: p.accentMain }}>такая же витрина?</span>
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed md:text-base" style={{ color: p.textSecondary }}>
                  Напишите: покажу живой экипаж изнутри, посчитаем запуск под ваш каталог и город.
                </p>
              </Reveal>
              <Reveal delay={0.12}>
                <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                  <a
                    href="https://t.me/SALAVEY13"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-8 text-sm font-bold uppercase tracking-[0.08em] transition hover:brightness-110 active:scale-95"
                    style={{ background: p.accentMain, color: p.bgBase, boxShadow: `0 0 24px ${p.accentMain}44` }}
                  >
                    <FaTelegramPlane className="mr-1 inline" aria-hidden /> @SALAVEY13
                  </a>
                  <Link
                    href="/franchize/sly13/contacts"
                    className="inline-flex h-12 items-center justify-center rounded-full border px-8 text-sm font-bold uppercase tracking-[0.08em] transition active:scale-95"
                    style={{ borderColor: `${p.textPrimary}44`, color: p.textPrimary }}
                  >
                    Контакты
                  </Link>
                </div>
                <p className="mt-6 text-sm" style={{ color: p.textSecondary }}>
                  Или посмотрите витрину партнёра —{" "}
                  <Link href="/moto-selection" className="underline decoration-dotted underline-offset-4" style={{ color: p.accentMain }}>
                    мотосервис Moto.selection
                  </Link>
                </p>
              </Reveal>
            </div>
          </section>
        </main>

        {/* ── FOOTER (собственный) ─────────────────────────────────────────── */}
        <footer className="border-t" style={{ borderColor: p.borderSoft, background: `${p.bgBase}` }}>
          <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
            <div>
              <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.22em]" style={{ color: p.textPrimary }}>
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: p.accentMain, boxShadow: `0 0 10px ${p.accentMain}` }}
                  aria-hidden
                />
                SLY<span style={{ color: p.accentMain }}>13</span>
              </p>
              <p className="mt-3 text-xs leading-relaxed" style={{ color: p.textSecondary }}>
                Личная витрина salavey13. Платформа франшиз проката: витрины экипажей, каталоги,
                заказы, аналитика — Next.js + Supabase + Telegram Mini App.
              </p>
            </div>
            <div>
              <p className="font-jb text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: p.textSecondary }}>
                навигация
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {NAV_LINKS.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="transition hover:opacity-100" style={{ color: p.textSecondary }}>
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-jb text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: p.textSecondary }}>
                платформа и партнёры
              </p>
              <ul className="mt-3 space-y-2 text-sm" style={{ color: p.textSecondary }}>
                <li>
                  <Link href="/franchize/sly13" className="transition hover:text-[var(--sly-accent)]" style={{ color: p.textSecondary }}>
                    Витрина экипажа sly13
                  </Link>
                </li>
                <li>
                  <Link href="/franchize/vip-bike" className="transition hover:text-[var(--sly-accent)]" style={{ color: p.textSecondary }}>
                    Боевой экипаж VIP BIKE
                  </Link>
                </li>
                <li>
                  <Link href="/moto-selection" className="transition hover:text-[var(--sly-accent)]" style={{ color: p.textSecondary }}>
                    Партнёр · Moto.selection
                  </Link>
                </li>
                <li>
                  <a href="https://t.me/SALAVEY13" target="_blank" rel="noopener noreferrer" className="transition hover:text-[var(--sly-accent)]" style={{ color: p.textSecondary }}>
                    Telegram · @SALAVEY13
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t px-4 py-5 sm:px-6" style={{ borderColor: p.borderSoft }}>
            <p className="mx-auto max-w-7xl text-[11px]" style={{ color: p.textSecondary }}>
              © 2026 SLY13 · цифры сезона — из базы экипажа vip-bike (Supabase), срез октябрь 2026
            </p>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
