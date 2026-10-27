"use client";

// /app/sly13/Sly13LandingClient.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Клиентская часть витрины SLY13 (task 136; 2026-10-25 — messaging overhaul).
// Палитра приходит с RSC-страницы (с фолбэком), всё остальное — здесь:
// собственные nav+footer (chrome подавлен через THEME_CONFIG.sly13),
// bento-сетки, framer-motion reveal-ы, счётчики, параллакс фонов,
// spotlight-карточки, marquee, зерно.
//
// 2026-10-25 (boss): «ditch 'stats of vip-bike' ... these numbers were not
// actually intended for publication ... generalize 'the message' — focus on
// variety of supported/tested features of my platform». Весь контент
// переведён на публичное промо платформы (Каталог → CRM, PDF босса):
//   · 6 контуров (витрина / лиды / аренда / деньги / команда / аналитика);
//   · онбординг в 4 шага, freemium FREE/PRO;
//   · двойная книга денег и зеркало выплат — без приватных цифр;
//   · «один движок — любой бизнес»: вертикали от байков до катеров,
//     moto-selection как живой пример услуг без аренды (+ deep links);
//   · AI-воркер в каждом экипаже (лендинги и настройки — фразой в чате,
//     «не бот для CRM — CRM для бота»).
// Приватные цифры сезона vip-bike со страницы сняты (полный список запрещённых
// строк пинит спека task138). «Crank it to 13» — тренды-2026 остаются:
// kinetic display type (solid/outline/gradient), bento, scroll-parallax
// picture backgrounds, spotlight hover, JetBrains Mono, grain, marquee,
// reduced-motion.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { MotionConfig, motion, useScroll, useTransform, useInView, animate } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";
import { FaTelegramPlane } from "react-icons/fa";
import FeedbackModal from "@/app/moto-selection/FeedbackModal";
import PartnerLogoGrid from "@/components/landing/PartnerLogoGrid";
import { GhostWordmark } from "@/components/landings/GhostWordmark";

type Palette = {
  bgBase: string;
  bgCard: string;
  accentMain: string;
  accentMainHover: string;
  textPrimary: string;
  textSecondary: string;
  borderSoft: string;
};

// ── Данные витрины (публичное промо платформы — «Каталог → CRM») ────────────
const SB = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix";
const IMG = {
  hero: `${SB}/46f34997-2589-4ae7-9082-a374f19419a6-c899f118-1692-45b9-b6ef-d1066a607426.jpg`,
  money: `${SB}/ducati-1199-panigale-2012/image_1.jpg`,
  ai: `${SB}/ural-bobber/image_1.jpg`,
  cta: `${SB}/suzuki-vzr1800-boulevard-2006/image_1.jpg`,
  motoHero: "https://static.tildacdn.com/tild3739-3737-4761-a335-353163363963/harley-davidson-ride.jpg",
  // full-screen «передышки» (boss 2026-10-27: «wall of text — we need full
  // screen rest picture sections») — та же студийная electro-серия с неоном,
  // что у актов 02/04: золото ведёт в «деньги», аэро с cyan-трубой — в AI.
  restGold: `${SB}/ducati-panigale-s-electro-gold/image_1.jpg`,
  restAero: `${SB}/ducati-panigale-s-electro-black-aero/image_1.jpg`,
};

// Telegram Mini App deep links (boss 2026-10-25): партнёрский блок ведёт в
// зимнее хранение и каталог услуг moto-selection через startapp-параметры.
// Роутер — hooks/use-start-param-target.ts (storage_<slug> / crew_<slug>),
// грамматика покрыта startapp-routing-regression.spec.ts.
const TG_APP_BASE = "https://t.me/oneBikePlsBot/app?startapp=";
const MS_TG_STORAGE = `${TG_APP_BASE}storage_moto-selection`;
const MS_TG_CATALOG = `${TG_APP_BASE}crew_moto-selection`;
const MS_WEB_CATALOG = "/franchize/moto-selection?mode=service";

// Шесть контуров платформы — «Всё, что нужно арендному бизнесу, в одном
// контуре» (промо PDF, раздел ПРОДУКТ · ОБЗОР).
const CONTOURS = [
  {
    id: "vitrina",
    title: "Витрина под своим именем",
    text: "/franchize/<slug>: каталог с тарифами от часа до месяца, корзина, промокоды, отзывы.",
  },
  {
    id: "lidy",
    title: "Лиды и Авито",
    text: "Заявки с сайта, коллбэк-форм и Авито — в одной очереди оператора, с источником и историей.",
  },
  {
    id: "arenda",
    title: "Аренда и документы",
    text: "Договоры, залоги (наличные или СТС), чек-листы выдачи и приёмки — жизненный цикл целиком.",
  },
  {
    id: "dengi",
    title: "Деньги",
    text: "Кошелёк владельца, двойная книга, автоматические зарплатные расчёты.",
  },
  {
    id: "komanda",
    title: "Команда и роли",
    text: "owner / admin / оператор: каждый видит только своё. Рейтинг, ачивки, лидерборд.",
  },
  {
    id: "analitika",
    title: "Аналитика",
    text: "Воронка лидов, скорость ответов, выгрузки CSV — цифры, а не ощущения.",
  },
];

// Онбординг: «четыре шага до первой сделки» (промо PDF, СТАРТ И РОСТ).
const ONBOARDING = [
  { n: 1, title: "Заведи экипаж", text: "slug и конфиг в UI: меню, палитра, контакты" },
  { n: 2, title: "Пригласи команду", text: "инвайты и роли: owner / admin / оператор" },
  { n: 3, title: "Залей каталог", text: "модели, фото и тарифы через админку или CSV" },
  { n: 4, title: "Открой витрину", text: "/franchize/<slug> принимает заявки и оплату" },
];

// «Один движок — любой бизнес» (промо PDF, ТЕХНОЛОГИИ): вертикали мультиарендности.
const VERTICALS = [
  "Байки и мото",
  "Авто",
  "Квадроциклы",
  "Велосипеды",
  "Снаряжение",
  "Инструмент",
  "Катера и water-техника",
  "Сервисы и работы",
];

// AI-воркер: демо-команды боту (промо PDF, ГЛАВНОЕ · АРХИТЕКТУРА).
const AI_DEMOS = [
  { cmd: "добавь в каталог U7 Pro — 249 000 ₽, три штуки", ack: "+ модель в каталоге · 3 ед." },
  { cmd: "сдай Skyline Пете с пятницы по воскресенье", ack: "аренда #482 создана" },
  { cmd: "подними цену на Kugoo до 900 ₽ в сутки", ack: "тариф обновлён" },
  { cmd: "добавь в карточку клиента поле «залог»", ack: "витрина расширена · без кода" },
];

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

// task 141: href — куда ведёт карточка (лендинг, если он есть, иначе
// каталог экипажа /franchize/{slug}; djorudjov теперь настоящий экипаж
// в БД — мёртвой ссылки больше нет). Используется в компактном списке
// «Экипажи на подходе» секции «Сценарии» (ниже по странице); лого-витрина
// партнёров рендерится из PARTNER_LOGOS выше.
const PIPELINE_CREWS = [
  { slug: "georg-electro", href: "/georg-electro", label: "georg-electro", note: "электрик электробайков — диагностика, контроллеры, свет" },
  { slug: "nn-mototeh-nn", href: "/mototehnn", label: "nn-mototeh-nn · МотоТех НН", note: "мотосалон — техника, запчасти, мотосервис, хранение, эвакуация" },
  { slug: "djorudjov", href: "/leorus", label: "djorudjov · LEORUS", note: "ивент-агентство — фестивали, DJ и шоу, видео, корпоративы" },
  { slug: "vip-bike", href: "/vipbikerental", label: "VIP BIKE Rental", note: "аренда электромото — флагман платформы" },
];

// task 141→144: витрина пайплайна рендерится сквозным компонентом
// PartnerLogoGrid (босс 2026-10-27: только логотипы, название на
// hover/долгом тапе). djorudjov — реальный экипаж в БД, его витрина —
// лендинг /leorus.
// Task 148: у nn-mototeh-nn появилась собственная витрина /mototehnn —
// экипаж переехал из «пайплайна без лого» в лого-сетку (5/5: каждая
// витрина ссылается на каждую).
const PARTNER_LOGOS = [
  {
    href: "/moto-selection",
    title: "Moto.Selection",
    tagline: "мотосервис — обучение, подбор мото, ТО, детейлинг, хранение 24/7",
    logoSrc: "https://static.tildacdn.com/tild6335-3266-4164-b461-363834666561/__.png",
    logoAlt: "Moto.Selection",
    backing: "#f2efea",
    lightBacking: true,
  },
  {
    href: "/georg-electro",
    title: "georg-electro",
    tagline: "электрик электробайков — диагностика, контроллеры, свет",
    logoSrc: "/logos/georg-electro-logo.png",
    logoAlt: "Georg.Electro",
    backing: "#140f06",
  },
  {
    href: "/leorus",
    title: "LEORUS · djorudjov",
    tagline: "ивент-агентство — фестивали, DJ и шоу, видео, корпоративы",
    logoSrc: "/logos/leorus-logo.png",
    logoAlt: "LEORUS",
    backing: "#0A0612",
  },
  {
    href: "/vipbikerental",
    title: "VIP BIKE Rental",
    tagline: "аренда электромото — флагман платформы",
    logoSrc: "/leorus/partner-vipbike.png",
    logoAlt: "VIP BIKE ELECTRO",
    backing: "#050508",
  },
  {
    href: "/mototehnn",
    title: "МотоТех НН",
    tagline: "мотосалон — техника, 10 000+ запчастей, мотосервис, хранение и эвакуация",
    logoSrc: "/logos/mototehnn-logo.png",
    logoAlt: "МотоТех НН",
    backing: "#e8edf6",
    lightBacking: true,
  },
];

const TICKER = [
  "залил каталог — получил CRM",
  "витрина под своим именем",
  "лиды и авито в одной очереди",
  "договоры docx + ocr",
  "двойная книга денег",
  "ai-ответы за секунды",
  "вечерние сводки в 21:00",
  "смены и зарплаты",
  "мотопарк с историей",
  "telegram mini app",
];

const NAV_LINKS = [
  { href: "#platform", label: "Платформа" },
  { href: "#money", label: "Деньги" },
  { href: "#any", label: "Сценарии" },
  { href: "#ai", label: "AI" },
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
  ...rest
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`sly-spot relative ${className}`}
      style={style}
      {...rest}
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

/** Фоновая картинка секции с мягким параллаксом (scroll-linked).
 *  imageClassName: класс поверх object-cover (по умолчанию приглушённые
 *  opacity-45 под текстовые акты; полноэкранные передышки зовут с более
 *  сильной прозрачностью — картинка там сама контент). */
function ParallaxBg({
  targetRef,
  src,
  scrim,
  glow,
  imageClassName = "opacity-45",
}: {
  targetRef: React.RefObject<HTMLElement | null>;
  src: string;
  scrim: string;
  glow?: string;
  imageClassName?: string;
}) {
  const { scrollYProgress } = useScroll({ target: targetRef, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-9%", "9%"]);
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <motion.div style={{ y }} className="absolute -inset-y-[10%] inset-x-0">
        <Image src={src} alt="" fill sizes="100vw" className={`object-cover ${imageClassName}`} />
      </motion.div>
      <div className="absolute inset-0" style={{ background: scrim }} />
      {glow && <div className="absolute inset-0" style={{ background: glow }} />}
    </div>
  );
}

// ── Основной компонент ──────────────────────────────────────────────────────
/**
 * Гост-водяной знак секции — ДНК moto-selection.ru (тон Word/нумерал
 * 175–250px ЗА контентом; на тёмных артбордах оригинал добавляет blur 2px),
 * перекрашен в cyan-on-graphite SLY13 (6% акцента). На обычных секциях
 * -z-10 внутри isolate-секции (ниже статического контента); на
 * параллакс-актах above=true → z-[1]: ВЫШЕ фото-скрима, НИЖЕ контента (z-10).
 */
function SlyGhostWord({ word, above = false }: { word: string; above?: boolean }) {
  return (
    <span
      aria-hidden
      className={`font-jb pointer-events-none absolute -top-2 left-0 select-none whitespace-nowrap text-[13vw] font-extrabold uppercase leading-none tracking-tight sm:text-[8vw] ${above ? "z-[1]" : "-z-10"}`}
      style={{ color: "color-mix(in srgb, var(--sly-accent) 6%, transparent)", filter: "blur(2px)" }}
    >
      {word}
    </span>
  );
}

/**
 * Акцентная лента-бегущая строка между актами — ДНК t1003
 * moto-selection.ru (50px, сплошной акцент, вордмарк-повторы), палитра
 * SLY13: фон = акцент, текст = bgBase, шрифт JetBrains Mono. Две ленты на
 * странице идут ВСТРЕЧНО (reverse у второй, как data-marquee-direction=
 * "opposite" у оригинала). CSS-only, aria-hidden; reduced-motion гасит
 * общий .sly-marquee-track.
 */
function SlyBrandTicker({ p, reverse = false }: { p: { accentMain: string; bgBase: string }; reverse?: boolean }) {
  const items = [
    "залил каталог — получил CRM",
    "двойная книга денег",
    "ai-воркер в команде",
    "telegram mini app",
    "SLY13",
  ];
  return (
    <div aria-hidden className="overflow-hidden py-3.5" style={{ background: p.accentMain }}>
      <div
        className="sly-marquee-track font-jb flex w-max items-center gap-10 whitespace-nowrap pr-10 text-[13px] font-bold uppercase tracking-[0.2em]"
        style={{ animation: `sly-marquee 20s linear infinite${reverse ? " reverse" : ""}`, color: p.bgBase }}
      >
        {[...items, ...items].map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
    </div>
  );
}

export default function Sly13LandingClient({ palette: p }: { palette: Palette }) {
  const auditRef = useRef<HTMLElement>(null);
  const aiRef = useRef<HTMLElement>(null);
  const ctaRef = useRef<HTMLElement>(null);
  // полноэкранные передышки (rest-акты) — параллаксу нужны свои таргеты
  const restGoldRef = useRef<HTMLElement>(null);
  const restAeroRef = useRef<HTMLElement>(null);

  // task 145-б: карточки услуг получили то же обращение, что georg services
  // и leorus directions (стекло — ДНК /moto-selection): ховер ПК снимает
  // графит-стекло ЦЕЛИКОМ (тинт и blur уходят вместе), фото наводится на
  // резкость. У тача ховера нет — ПЕРВЫЙ тап открывает карточку, ВТОРОЙ
  // ведёт в каталог; грамматика PartnerRevealCard / MsServicesGrid /
  // GlassServiceCard. Клавиатуре — :focus-within.
  const [revealedSvcs, setRevealedSvcs] = useState<Record<string, boolean>>({});
  const lastPointerWasTouch = useRef(false);
  const svcGate = (key: string) => ({
    "data-reveal-active": revealedSvcs[key] ? "true" : undefined,
    onPointerDown: (e: React.PointerEvent) => {
      lastPointerWasTouch.current = e.pointerType === "touch";
    },
    onClick: (e: React.MouseEvent) => {
      if (lastPointerWasTouch.current && !revealedSvcs[key]) {
        e.preventDefault();
        e.stopPropagation();
        setRevealedSvcs((prev) => ({ ...prev, [key]: true }));
      }
    },
  });

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="sly-root min-h-screen overflow-x-clip"
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
          /* TV/клавиатурный паритет мыши-спотлайта: outline с offset,
             НИКОГДА box-shadow внутри overflow-hidden (урок task139-iter2) */
          .sly-root a:focus-visible, .sly-root button:focus-visible {
            outline: 2px solid var(--sly-accent);
            outline-offset: 2px;
          }
          /* карточный лифт: transform не двигает layout (без CLS на ТВ);
             !important перекрывает inline borderColor карточек */
          .sly-lift { transition: transform .3s ease, border-color .3s ease; }
          .sly-lift:hover {
            transform: translateY(-4px);
            border-color: color-mix(in srgb, var(--sly-accent) 45%, var(--sly-border)) !important;
          }
          /* ── карточки услуг: стекло растворяется (ДНК /moto-selection) ── */
          .sly-glass {
            background: rgba(15, 20, 25, 0.72);
            -webkit-backdrop-filter: blur(5px);
            backdrop-filter: blur(5px);
            transition: opacity 0.5s ease;
          }
          .sly-svc img { transition: transform 0.5s ease; }
          @media (hover: hover) and (pointer: fine) {
            .sly-svc:hover .sly-glass { opacity: 0; }
            .sly-svc:hover img { transform: scale(1.05); }
          }
          .sly-svc[data-reveal-active="true"] .sly-glass,
          .sly-svc:focus-within .sly-glass { opacity: 0; }
          .sly-svc[data-reveal-active="true"] img { transform: scale(1.05); }
          /* текст поверх резкого фото после растворения — лёгкая тень */
          .sly-svc h3, .sly-svc p { text-shadow: 0 1px 12px rgba(15, 20, 25, 0.8); }
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
                личная витрина salavey13 · платформа франшиз
              </p>
            </Reveal>

            {/* kinetic display: solid / outline / gradient — трёхслойный заголовок,
                соизмеримый с moto-selection. 2026-10-25: сообщение обобщено —
                платформа не только для байков (boss: «not only bike rentals,
                but any rental, sale, service»). */}
            <h1 className="select-none font-black uppercase leading-[0.92] tracking-tight">
              <Reveal delay={0.05}>
                <span className="block text-[17vw] text-white sm:text-8xl lg:text-9xl">SLY13</span>
              </Reveal>
              <Reveal delay={0.15}>
                <span
                  className="block text-[9.4vw] sm:text-6xl lg:text-7xl"
                  style={{
                    color: "color-mix(in srgb, var(--sly-text) 12%, transparent)",
                    WebkitTextStroke: `1.5px ${p.textPrimary}99`,
                  }}
                >
                  платформа
                </span>
              </Reveal>
              <Reveal delay={0.25}>
                {/* TV-safe gradient: class .landing-accent-clip из globals.css —
                    сплошной акцент по умолчанию, градиент только внутри
                    @supports (boss 2026-10-25: на ТВ акцентное слово красилось
                    цветным квадратом — тот же класс бага, что на /vipbikerental). */}
                <span
                  className="landing-accent-clip block text-[9.4vw] sm:text-6xl lg:text-7xl"
                  style={{
                    ["--accent-clip-from" as string]: p.accentMain,
                    ["--accent-clip-to" as string]: p.accentMainHover,
                  }}
                >
                  проката и сервисов
                </span>
              </Reveal>
            </h1>

            <Reveal delay={0.35}>
              <p className="mx-auto mt-7 max-w-2xl text-balance text-base leading-relaxed sm:text-lg" style={{ color: p.textPrimary }}>
                Залил каталог — остальное достроит сама: витрина с корзиной и оплатой,
                заявки из Авито и сайта, аренда с договорами и залогами, двойная книга
                денег, смены и зарплаты команды. Тот самый «свой CRM», который обычно
                заказывают у агентств за сотни тысяч. Обкатан на живом прокате{" "}
                <Link
                  href="/franchize/vip-bike"
                  className="underline decoration-dotted underline-offset-4"
                  style={{ color: p.accentMain }}
                >
                  VIP BIKE
                </Link>{" "}
                — и работает для любого экипажа.
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
                  "6 контуров — одна система",
                  "45+ серверных модулей",
                  "старт за 1 день",
                  "ai-воркер в команде",
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
            href="#platform"
            aria-label="Листать к платформе"
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

        {/* лента №1 (ДНК t1003): между героем и актами */}
        <SlyBrandTicker p={p} />

        <main className="mx-auto w-full max-w-7xl space-y-24 px-4 pb-24 sm:px-6">
          {/* ── 01 · ПЛАТФОРМА (6 контуров + онбординг; промо PDF) ────────── */}
          <section id="platform" className="relative isolate scroll-mt-20 overflow-hidden pt-8">
            <SlyGhostWord word="платформа" />
            <Reveal>
              <p className="font-jb text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: p.accentMain }}>
                01 · что такое платформа
              </p>
              <h2 className="mt-3 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                Залил каталог — <span style={{ color: p.accentMain }}>это всё</span>
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-relaxed md:text-lg" style={{ color: p.textSecondary }}>
                Остальное платформа достраивает сама: витрина с корзиной и оплатой, заявки
                из Авито и сайта, аренда с договорами и залогами, двойная книга денег,
                зарплаты команды и аналитика. Проблемы, которые она закрывает, знакомы
                каждому, кто вёл прокат в переписках: заявки тонут в пяти мессенджерах,
                брони и залоги живут в таблицах, которые врут после первой же смены,
                зарплаты считаются «на словах», а касса не отделена от личной.
              </p>
            </Reveal>

            {/* онбординг: четыре шага до первой сделки */}
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ONBOARDING.map(({ n, title, text }, i) => (
                <Reveal key={n} delay={0.05 + i * 0.06}>
                  <SpotlightCard
                    className="h-full rounded-2xl border p-5"
                    style={{ background: p.bgCard, borderColor: p.borderSoft }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="font-jb inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold"
                        style={{ background: `${p.accentMain}1F`, color: p.accentMain }}
                      >
                        {n}
                      </span>
                      <h3 className="text-sm font-bold leading-snug" style={{ color: p.textPrimary }}>
                        {title}
                      </h3>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed" style={{ color: p.textSecondary }}>
                      {text}
                    </p>
                  </SpotlightCard>
                </Reveal>
              ))}
            </div>

            {/* шесть контуров — одна система */}
            <h3 className="mt-14 text-xl font-black tracking-tight sm:text-2xl" style={{ color: p.textPrimary }}>
              Шесть контуров — <span style={{ color: p.accentMain }}>одна система</span>
            </h3>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CONTOURS.map((c, i) => (
                <Reveal key={c.id} delay={0.04 + (i % 3) * 0.06}>
                  <SpotlightCard
                    className="sly-lift h-full rounded-2xl border p-6"
                    style={{ background: p.bgCard, borderColor: p.borderSoft }}
                  >
                    <div className="font-jb text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: p.accentMain }}>
                      контур {String(i + 1).padStart(2, "0")}
                    </div>
                    <h4 className="mt-2 text-base font-bold" style={{ color: p.textPrimary }}>
                      {c.title}
                    </h4>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: p.textSecondary }}>
                      {c.text}
                    </p>
                  </SpotlightCard>
                </Reveal>
              ))}
            </div>

            {/* продуктовые факты (публичные — из промо PDF, не приватные цифры);
                count-up оставлен ради живости — считаются продуктовые пороги,
                а не чья-то выручка */}
            <Reveal delay={0.1}>
              <div className="font-jb mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { prefix: "≤", to: 15, suffix: "", u: "мин", t: "целевой первый ответ клиенту" },
                  { prefix: "", to: 2, suffix: "+", u: "аккаунта", t: "Авито в одном окне оператора" },
                  { prefix: "", to: 100, suffix: "%", u: "событий", t: "мотопарка — с датой, автором и фото" },
                  { prefix: "", to: 45, suffix: "+", u: "модулей", t: "серверной логики обкатаны живым бизнесом" },
                ].map(({ prefix, to, suffix, u, t }) => (
                  <div
                    key={t}
                    className="rounded-2xl border p-4"
                    style={{ borderColor: p.borderSoft, background: `${p.bgCard}80` }}
                  >
                    <div className="text-2xl font-extrabold leading-none" style={{ color: p.accentMain }}>
                      <CountUp to={to} prefix={prefix} suffix={suffix} duration={1.4} />{" "}
                      <span className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: p.textSecondary }}>{u}</span>
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed" style={{ color: p.textSecondary }}>
                      {t}
                    </p>
                  </div>
                ))}
              </div>
            </Reveal>
          </section>

          {/* ── ПЕРЕДЫШКА · ЗОЛОТО ── full-screen picture break (boss 2026-10-27:
              лендинг «wall of text» — между текстовыми секциями нужны
              полноэкранные картинки-передышки). Ноль карточек, одна mono-строка;
              фото электросерии — то же неоновое семейство, что у актов 02/04.
              Золотая трубка и золотые диски ведут в следующий акт — «деньги».
              mx-calc(50%-50vw) = истинный full-bleed на любую ширину (внутри
              max-w-7xl-колонки), горизонтальный перелив от скроллбара гасит
              overflow-x-clip на .sly-root (clip НЕ создаёт scroll-контейнер —
              sticky-навигация продолжает липнуть к вьюпорту). */}
          <section
            ref={restGoldRef}
            className="relative isolate mx-[calc(50%-50vw)] flex h-[100svh] min-h-[560px] items-end overflow-hidden"
          >
            <ParallaxBg
              targetRef={restGoldRef}
              src={IMG.restGold}
              imageClassName="opacity-90"
              scrim={`linear-gradient(to bottom, ${p.bgBase} 0%, ${p.bgBase}14 20%, ${p.bgBase}14 70%, ${p.bgBase} 100%)`}
              glow={`radial-gradient(46% 52% at 18% 42%, ${p.accentMain}12 0%, transparent 70%)`}
            />
            <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6 sm:pb-20">
              <p className="font-jb text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: p.accentMain }}>
                sly13 · передышка
              </p>
              <p className="font-jb mt-2 text-2xl font-extrabold uppercase leading-tight tracking-tight sm:text-4xl" style={{ color: p.textPrimary }}>
                Прокат как <span style={{ color: p.accentMain }}>система</span>
              </p>
              <p
                className="font-jb mt-3 text-[10px] uppercase leading-relaxed tracking-[0.22em] sm:text-[11px]"
                style={{ color: p.textSecondary }}
              >
                витрина · лиды · аренда · деньги · команда · аналитика
              </p>
            </div>
          </section>

          {/* ── 02 · ДЕНЬГИ (picture background + параллакс) ──────────────── */}
          <section
            id="money"
            ref={auditRef}
            className="relative isolate -mx-4 scroll-mt-20 overflow-hidden border-y px-4 py-20 sm:-mx-6 sm:px-6 sm:py-28"
            style={{ borderColor: p.borderSoft }}
          >
            {/* гост-нумерал акта — ДНК «02» (250px/700) оригинала; above:
                ВЫШЕ параллакс-фото, НИЖЕ контента */}
            <SlyGhostWord word="02" above />
            <ParallaxBg
              targetRef={auditRef}
              src={IMG.money}
              scrim={`linear-gradient(100deg, ${p.bgBase}F2 0%, ${p.bgBase}CC 45%, ${p.bgBase}59 100%)`}
              glow={`radial-gradient(52% 60% at 78% 40%, ${p.accentMain}1A 0%, transparent 70%)`}
            />
            <div className="relative z-10">
              <Reveal>
                <p className="font-jb text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: p.accentMain }}>
                  02 · деньги
                </p>
                <h2 className="mt-3 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                  Каждый рубль виден <span style={{ color: p.accentMain }}>дважды</span>
                </h2>
                <p className="mt-4 max-w-3xl text-base leading-relaxed md:text-lg" style={{ color: p.textSecondary }}>
                  Двойная книга денег: живая касса владельца и формальный леджер зарплат —
                  две независимые записи одних и тех же операций. Зеркало выплат связывает
                  их архитектурно: зарплата, выданная со страницы расчётов, появляется в
                  обеих книгах автоматически. Двойных выплат и споров «сколько же мы
                  насчитали?» больше нет — этот класс ошибок закрыт конструкцией, а не
                  внимательностью.
                </p>
              </Reveal>
              <div className="mt-9 grid gap-4 sm:grid-cols-3">
                {[
                  {
                    h: "Кошелёк владельца",
                    t: "Живая касса: доходы, расходы, снятия. Каждая запись — источник, человек, дата (MSK). Виден только владельцу.",
                  },
                  {
                    h: "Леджер зарплат",
                    t: "Расчёт по каждому оператору: доход, коэффициенты, баланс. Отметки «уже выплачено» с историей.",
                  },
                  {
                    h: "Зеркало выплат",
                    t: "Выплата со страницы расчётов автоматически отражается в обеих книгах — сверка в один тап.",
                  },
                ].map(({ h, t }, i) => (
                  <Reveal key={h} delay={0.1 + i * 0.08}>
                    <SpotlightCard
                      className="h-full rounded-2xl border p-6 backdrop-blur-sm"
                      style={{ background: `${p.bgCard}D9`, borderColor: p.borderSoft }}
                    >
                      <div className="font-jb text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: p.accentMain }}>
                        книга {String(i + 1).padStart(2, "0")}
                      </div>
                      <h3 className="mt-2 text-base font-bold" style={{ color: p.textPrimary }}>
                        {h}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed" style={{ color: p.textSecondary }}>
                        {t}
                      </p>
                    </SpotlightCard>
                  </Reveal>
                ))}
              </div>
              <Reveal delay={0.2}>
                <p className="mt-7 max-w-3xl text-sm leading-relaxed" style={{ color: p.textSecondary }}>
                  Под капотом: комиссия по правилам экипажа (процент или фикс, по типу
                  операции — почасовая аренда, посуточная, продажи, оборудование), планы
                  зарплат, кассовая книга с проводками и payout-хаб. То, что для обычного
                  проката — «тетрадка и калькулятор», здесь — код.
                </p>
              </Reveal>
            </div>
          </section>

          {/* ── 03 · ОДИН ДВИЖОК — ЛЮБОЙ БИЗНЕС ───────────────────────────── */}
          <section id="any" className="relative isolate scroll-mt-20 overflow-hidden">
            <SlyGhostWord word="сценарии" />
            <Reveal>
              <p className="font-jb text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: p.accentMain }}>
                03 · сценарии
              </p>
              <h2 className="mt-3 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                Один движок — <span style={{ color: p.accentMain }}>любой бизнес</span>
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-relaxed md:text-lg" style={{ color: p.textSecondary }}>
                Байки и мото — только первый сценарий. Каждый экипаж — это slug с полной
                изоляцией данных: своя витрина, свои лиды, свои деньги, своя команда.
                Каталог + заявки + аренда + деньги = контур проката, продажи или сервиса
                чего угодно: движку всё равно, что стоит в карточке товара. Конфигуратор
                витрины меняет меню, палитру и контакты без кода; роли owner / admin /
                оператор решают, кто что видит.
              </p>
            </Reveal>

            {/* вертикали мультиарендности */}
            <Reveal delay={0.08}>
              <ul className="mt-6 flex flex-wrap gap-2">
                {VERTICALS.map((v) => (
                  <li
                    key={v}
                    className="font-jb rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.1em]"
                    style={{ borderColor: p.borderSoft, background: `${p.bgCard}80`, color: p.textSecondary }}
                  >
                    {v}
                  </li>
                ))}
              </ul>
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
                        href={c.href || `/franchize/${c.slug}`}
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
                    Не только прокат
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed" style={{ color: p.textSecondary }}>
                    Живой пример — партнёрский{" "}
                    <Link href="/moto-selection" className="underline decoration-dotted underline-offset-4" style={{ color: p.accentMain }}>
                      Moto.selection
                    </Link>
                    : в экипаже нет ни одной аренды, но платформа закрывает весь мотосервис —
                    подбор и покупка, ТО и ремонт, детейлинг, эвакуация 24/7 и зимнее
                    хранение с договором ответственного хранения, фотофиксацией и ПЭП
                    прямо в Telegram. Смены, зарплаты и комиссии работают так же, как в
                    прокате, — меняется каталог, а не логика.
                  </p>
                  <ul className="mt-4 space-y-3.5 text-sm leading-relaxed" style={{ color: p.textSecondary }}>
                    <li>
                      <span style={{ color: p.textPrimary }}>Сервисы и работы</span> — услуги
                      с записью, прайсом и корзиной; эвакуация и выездные осмотры.
                    </li>
                    <li>
                      <span style={{ color: p.textPrimary }}>Хранение</span> — сезонные
                      договоры, статусы, фотоотчёты и оплаты на стене экипажа.
                    </li>
                    <li>
                      <span style={{ color: p.textPrimary }}>Продажи</span> — витрина, воронка
                      и договоры купли-продажи рядом с арендой.
                    </li>
                  </ul>
                </SpotlightCard>
              </Reveal>
            </div>
          </section>

          {/* ── ПЕРЕДЫШКА · CYAN ── вторая передышка (boss 2026-10-27): аэро
              Panigale с cyan-трубой и дымом — чистый вход в мир AI-акта.
              Строка-тизер следующей секции, без карточек и списков. */}
          <section
            ref={restAeroRef}
            className="relative isolate mx-[calc(50%-50vw)] flex h-[100svh] min-h-[560px] items-end overflow-hidden"
          >
            <ParallaxBg
              targetRef={restAeroRef}
              src={IMG.restAero}
              imageClassName="opacity-90"
              scrim={`linear-gradient(to bottom, ${p.bgBase} 0%, ${p.bgBase}14 20%, ${p.bgBase}14 70%, ${p.bgBase} 100%)`}
              glow={`radial-gradient(46% 52% at 12% 40%, ${p.accentMain}1A 0%, transparent 70%)`}
            />
            <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6 sm:pb-20">
              <p className="font-jb text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: p.accentMain }}>
                sly13 · передышка
              </p>
              <p className="font-jb mt-2 text-2xl font-extrabold uppercase leading-tight tracking-tight sm:text-4xl" style={{ color: p.textPrimary }}>
                Бот <span style={{ color: p.accentMain }}>не спит</span>
              </p>
              <p
                className="font-jb mt-3 text-[10px] uppercase leading-relaxed tracking-[0.22em] sm:text-[11px]"
                style={{ color: p.textSecondary }}
              >
                команды голосом и текстом · сводка за день в 21:00
              </p>
            </div>
          </section>

          {/* ── 04 · AI-ВОРКЕР В КАЖДОМ ЭКИПАЖЕ ───────────────────────────── */}
          <section
            id="ai"
            ref={aiRef}
            className="relative isolate -mx-4 scroll-mt-20 overflow-hidden border-y px-4 py-20 sm:-mx-6 sm:px-6 sm:py-28"
            style={{ borderColor: p.borderSoft }}
          >
            <SlyGhostWord word="04" above />
            <ParallaxBg
              targetRef={aiRef}
              src={IMG.ai}
              scrim={`linear-gradient(to bottom, ${p.bgBase}E6, ${p.bgBase}B3 45%, ${p.bgBase}F2)`}
              glow={`radial-gradient(50% 55% at 50% 45%, ${p.accentMain}1C 0%, transparent 70%)`}
            />
            <div className="relative z-10">
              <Reveal>
                <p className="font-jb text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: p.accentMain }}>
                  04 · ai-воркер
                </p>
                <h2 className="mt-3 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                  Не бот для CRM — <span style={{ color: p.accentMain }}>CRM для бота</span>
                </h2>
                <p className="mt-4 max-w-3xl text-base leading-relaxed md:text-lg" style={{ color: p.textSecondary }}>
                  Ассистент-бот подключён к тем же серверным модулям, что и веб-приложение,
                  — весь интерфейс доступен ему напрямую, без кликов и форм. Днём он
                  принимает команды текстом и голосом, вечером сам присылает сводку по
                  дню в 21:00. Новый сценарий экипажа — это фраза в чате, а не тикет
                  разработчику.
                </p>
              </Reveal>

              {/* демо: команды человеческим языком → подтверждения бота */}
              <div className="mt-9 grid gap-3 md:grid-cols-2">
                {AI_DEMOS.map(({ cmd, ack }, i) => (
                  <Reveal key={cmd} delay={0.05 + i * 0.06}>
                    <div
                      className="rounded-2xl border p-4 backdrop-blur-sm"
                      style={{ borderColor: p.borderSoft, background: `${p.bgCard}D9` }}
                    >
                      <p className="font-jb text-sm" style={{ color: p.textPrimary }}>
                        <span style={{ color: p.accentMain }}>›</span> {cmd}
                      </p>
                      <p className="font-jb mt-2 flex items-center gap-2 text-xs" style={{ color: p.accentMain }}>
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ background: p.accentMain }}
                          aria-hidden
                        />
                        {ack}
                      </p>
                    </div>
                  </Reveal>
                ))}
              </div>

              <Reveal delay={0.15}>
                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  <SpotlightCard
                    className="sly-lift h-full rounded-2xl border p-6 backdrop-blur-sm"
                    style={{ background: `${p.bgCard}D9`, borderColor: p.borderSoft }}
                  >
                    <h3 className="text-base font-bold" style={{ color: p.textPrimary }}>
                      Оператору — готовый ответ за секунды
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: p.textSecondary }}>
                      AI читает вопрос клиента, определяет интент — цена, наличие, залог,
                      документы, доставка — и собирает ответ из библиотеки скриптов
                      экипажа. Оператор правит пару слов и отправляет; источник ответа
                      честно помечен бейджем ai / hybrid / rules.
                    </p>
                  </SpotlightCard>
                  <SpotlightCard
                    className="sly-lift h-full rounded-2xl border p-6 backdrop-blur-sm"
                    style={{ background: `${p.bgCard}D9`, borderColor: p.borderSoft }}
                  >
                    <h3 className="text-base font-bold" style={{ color: p.textPrimary }}>
                      Часть каждого экипажа
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: p.textSecondary }}>
                      AI-воркер на платформе — не плагин, а член команды: у него доступ к
                      каталогу, витринам и настройкам экипажа. Лендинг партнёра
                      Moto.selection, витрины экипажей и их каталоги собирались и
                      правились в диалоге — так же он поможет и вашему экипажу: от
                      структуры каталога до обучения команды работе с ботом.
                    </p>
                  </SpotlightCard>
                </div>
              </Reveal>
            </div>
          </section>

          {/* лента №2 — встречное направление (ДНК «opposite» оригинала) */}
          <SlyBrandTicker p={p} reverse />

          {/* ── 05 · УСЛУГИ (обложки из каталога экипажа) ─────────────── */}
          <section id="services" className="relative isolate scroll-mt-20 overflow-hidden">
            <SlyGhostWord word="услуги" />
            <Reveal>
              <p className="font-jb text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: p.accentMain }}>
                05 · услуги
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
            <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {SERVICES.map((s, i) => (
                <Reveal key={s.id} delay={0.05 + (i % 3) * 0.07}>
                  <SpotlightCard
                    className="sly-svc group relative h-full min-h-[340px] overflow-hidden rounded-2xl border transition-transform duration-300 hover:-translate-y-1"
                    style={{ background: p.bgCard, borderColor: p.borderSoft }}
                    {...svcGate(s.id)}
                  >
                    <Image
                      src={`${SB}/${s.id}/image_1_4x3.jpg`}
                      alt=""
                      aria-hidden
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                    {/* графит-стекло: ДНК карточек moto-selection.ru
                        (чёрный 60% + backdrop-blur 5px) в палитре SLY13.
                        Ховер/первый тап снимает его ЦЕЛИКОМ (opacity 1→0,
                        тинт И blur вместе — ground truth оригинала), фото
                        наводится на резкость; без blur-поддержки остаётся
                        graphite 72% — читается */}
                    <div className="sly-glass absolute inset-0" aria-hidden />
                    <span
                      className="font-jb absolute right-3 top-3 z-10 rounded-full px-2.5 py-1 text-[11px] font-bold"
                      style={{ background: p.accentMain, color: p.bgBase }}
                    >
                      {s.price}
                    </span>
                    <div className="relative z-10 flex h-full flex-col items-center p-6 text-center">
                      {/* гост-нумерал из-под верхнего края — как на карточках
                          услуг moto-selection (цифры до 250px), cyan */}
                      <span
                        aria-hidden
                        className="font-jb pointer-events-none -mt-10 select-none text-[72px] font-extrabold leading-none"
                        style={{ color: `${p.accentMain}B3` }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h3 className="mt-2 text-base font-bold uppercase leading-snug">{s.title}</h3>
                      <p className="mt-2 text-xs leading-relaxed" style={{ color: p.textSecondary }}>
                        {s.text}
                      </p>
                      <p className="font-jb mt-2 text-[11px] uppercase tracking-[0.18em]" style={{ color: p.accentMain }}>
                        {s.tag}
                      </p>
                      <Link
                        href="/franchize/sly13"
                        className="mt-auto inline-flex h-11 w-[200px] items-center justify-center self-center rounded-full text-[11px] font-bold uppercase tracking-[0.08em] transition hover:brightness-110"
                        style={{ background: p.accentMain, color: p.bgBase, marginTop: "auto" }}
                      >
                        Оформить в каталоге
                      </Link>
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

          {/* ── 06 · ПАРТНЁРЫ (cross-link с /moto-selection) ──────────────── */}
          <section id="partners" className="relative isolate scroll-mt-20 overflow-hidden">
            <SlyGhostWord word="партнёры" />
            <Reveal>
              <p className="font-jb text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: p.accentMain }}>
                06 · партнёры
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
                      href={MS_WEB_CATALOG}
                      className="inline-flex h-11 items-center justify-center rounded-full border px-6 text-xs font-bold uppercase tracking-[0.1em] transition active:scale-95"
                      style={{ borderColor: `${p.textPrimary}44`, color: p.textPrimary }}
                    >
                      Каталог экипажа
                    </Link>
                  </div>
                  {/* Deep links в разделы экипажа (boss 2026-10-25: «add proper
                      links to moto-selection crew winter storage from landing,
                      and for services, maybe even using deep links via
                      startappparamrouter»). storage_moto-selection / crew_
                      moto-selection роутит сам Mini App (startapp-параметры). */}
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                    <a
                      href={MS_TG_STORAGE}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-jb inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition hover:opacity-100"
                      style={{ color: p.accentMain }}
                    >
                      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: p.accentMain }} aria-hidden />
                      зимнее хранение · mini app
                    </a>
                    <a
                      href={MS_TG_CATALOG}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-jb inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition hover:opacity-100"
                      style={{ color: p.accentMain }}
                    >
                      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: p.accentMain }} aria-hidden />
                      8 услуг · mini app
                    </a>
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

            {/* Остальные экипажи пайплайна (task 144, босс 2026-10-27: только
                логотипы, название на hover/долгом тапе — сквозной
                PartnerLogoGrid, как на всех лендингах) */}
            <Reveal delay={0.12}>
              <div className="mt-4">
                <PartnerLogoGrid
                  accent={p.accentMain}
                  columns={5}
                  ariaLabel="Витрины экипажей пайплайна"
                  partners={PARTNER_LOGOS}
                />
              </div>
            </Reveal>
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
                  Есть прокат, сервис или продажи — нужна <span style={{ color: p.accentMain }}>такая же витрина?</span>
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed md:text-base" style={{ color: p.textSecondary }}>
                  Напишите: покажу живой экипаж изнутри, посчитаем запуск под ваш каталог и город.
                </p>
              </Reveal>
              <Reveal delay={0.12}>
                <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                  {/* Форма заявки модалкой — та же механика, что на
                      /moto-selection: существующий callback-lead endpoint,
                      заявка летит в CRM + Telegram (ADMIN_CHAT_ID = salavey13;
                      когда у sly13 появится экипаж/владелец — уведомления
                      подхватятся автоматически из ростера экипажа). */}
                  <button
                    type="button"
                    data-lead-modal-open
                    className="inline-flex h-12 items-center justify-center rounded-full px-8 text-sm font-black uppercase tracking-[0.08em] text-black transition hover:brightness-110 active:scale-95"
                    style={{ background: `linear-gradient(135deg, ${p.accentMainHover} 0%, ${p.accentMain} 65%)` }}
                  >
                    Оставить заявку
                  </button>
                  <a
                    href="https://t.me/SALAVEY13"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full border px-8 text-sm font-bold uppercase tracking-[0.08em] transition hover:brightness-110 active:scale-95"
                    style={{ borderColor: `${p.accentMain}66`, color: p.accentMain }}
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

        {/* ── ГИГАНТСКИЙ ВОРДМАРК (task 145) — ДНК /moto-selection: гост-текст
            ровно на всю ширину экрана перед подвалом (SVG textLength).
            JetBrains Mono — фирменный шрифт витрины; «13» — акцентная. */}
        <div className="border-t py-5" style={{ borderColor: p.borderSoft }} aria-hidden>
          <GhostWordmark
            parts={[
              { text: "SLY", color: p.textPrimary, opacity: 0.05 },
              { text: "13", color: p.accentMain, opacity: 0.35 },
            ]}
            fontFamily="'JetBrains Mono', ui-monospace, monospace"
          />
        </div>

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
              © 2026 SLY13 · платформа франшиз: витрина, лиды, аренда, деньги, команда — на одном движке
            </p>
          </div>
        </footer>

        {/* Модальная форма заявки → /api/franchize/callback-lead (slug sly13):
            сегодня уведомление уходит на ADMIN_CHAT_ID (salavey13), завтра —
            владельцу экипажа из ростера, без изменений кода. */}
        <FeedbackModal
          slug="sly13"
          accent={{ brand: p.accentMain, brandSoft: p.accentMainHover }}
          formSource="sly13-feedback-modal"
          landingPath="/sly13"
        />
      </div>
    </MotionConfig>
  );
}
