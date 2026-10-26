// /app/georg-electro/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// GEORG ELECTRO — standalone landing (2026-10-26, boss request).
//
// «look at newly created /moto-selection and /sly13 landings, create new one
//  for georgy electric oneman crew:) generate pictures for it:)»
//
// Source of truth: crews row georg-electro (c8e87d67-…) — name, description,
// services (metadata.services ge-*: verbatim), rating 5, working hours
// 10:00–20:00, palette from metadata.franchize.theme.palette (amber #f59e0b
// on dark brown #140f06). The one-man-crew positioning is the crew's OWN
// description («Пока команда из одного человека — Георгия»), told as a
// feature: no managers, no call center — you talk to the master directly.
//
// Images: generated for this landing (boss: «generate pictures for it») —
// public/images/georg/*.png, dark garage + amber lamp to match the palette.
//
// DNA: moto-selection/sly13 pattern — RSC page, own dark nav + footer,
// CSS-only ken-burns/marquee animations, lead modal reuses the shared
// FeedbackModal via [data-lead-modal-open] (posts to /api/franchize/
// callback-lead, slug georg-electro → owner + ADMIN_CHAT_ID). Chrome
// suppressed in ClientLayout THEME_CONFIG.georgElectro.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  BatteryCharging,
  ChevronRight,
  Clock,
  Cpu,
  Gauge,
  Lightbulb,
  MapPin,
  MessageSquare,
  Send,
  Star,
  User,
  Wrench,
  Zap,
} from "lucide-react";
import FeedbackModal from "../moto-selection/FeedbackModal";
import { PartnerRevealCard } from "@/components/partners/PartnerRevealCard";

// task 144: фирменный дым moto-selection.ru (прозрачный PNG, alpha 0…176,
// 1680×625) — на тёмных секциях нашей витрины тоже («use everywhere
// applicable, looks awesome!!»)
const SMOKE_TEXTURE =
  "https://static.tildacdn.com/tild6131-6233-4862-b732-323433396136/1-20220209_004453.png";

export const metadata: Metadata = {
  title: "GEORG ELECTRO — электрик электробайков · Нижний Новгород",
  description:
    "Диагностика и ремонт электросистем, перепрошивка контроллеров, установка доп. оборудования на любой электромот. Один мастер — Георгий, без менеджеров и колл-центра. Рядом с VIP BIKE, Нижний Новгород.",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "GEORG ELECTRO",
    title: "GEORG ELECTRO — электрик электробайков",
    description:
      "Один мастер. Любой электромот. Диагностика, контроллеры, проводка, свет и доп. оборудование. Нижний Новгород, рядом с VIP BIKE.",
  },
};

// ── Палитра экипажа (crews.metadata.franchize.theme.palette, georg-electro) ──
const P = {
  bgBase: "#140f06",
  bgCard: "#1e160a",
  accent: "#f59e0b",
  accentHover: "#fbbf24",
  textPrimary: "#f5efe2",
  textSecondary: "#b8a684",
  border: "#4a3a18",
} as const;

const IMG = {
  hero: "/images/georg/hero.png",
  diagnostics: "/images/georg/diagnostics.png",
  flash: "/images/georg/flash.png",
  equipment: "/images/georg/equipment.png",
  master: "/images/georg/master.png",
  workshop: "/images/georg/workshop.png",
} as const;

// Услуги — дословно из metadata.services экипажа (ge-diagnostics / ge-flash /
// ge-equipment). Цены в каталоге не указаны («по запросу») — честно так и
// показываем: мастер считает работу после диагностики.
const SERVICES = [
  {
    id: "ge-diagnostics",
    icon: Wrench,
    img: IMG.diagnostics,
    title: "Диагностика и ремонт электросистем",
    text: "Поиск неисправностей и ремонт электро: проводка, контроллеры, BMS, дроссели, свет, приборка. Электрик электробайков — починим любой электромот.",
  },
  {
    id: "ge-flash",
    icon: Cpu,
    img: IMG.flash,
    title: "Перепрошивка и настройка контроллеров",
    text: "Прошивка и тюнинг контроллеров любых типов: кривые тока, разгонные режимы, круиз-контроль, кастомные пресеты под батарею и мотор.",
  },
  {
    id: "ge-equipment",
    icon: Lightbulb,
    img: IMG.equipment,
    title: "Установка дополнительного оборудования",
    text: "Свет, сигнализация, зарядки и USB, кофры, ветровики, камеры, подогрев ручек — установим и подключим аккуратно, с гарантией на монтаж.",
  },
] as const;

// «Что чиним» — чипы собираются из текстов услуг (не выдумываем: только то,
// что реально названо в каталоге экипажа).
const FIXES = [
  "проводка",
  "контроллеры",
  "BMS",
  "дроссели",
  "свет",
  "приборка",
  "кривые тока",
  "разгонные режимы",
  "круиз-контроль",
  "пресеты под батарею",
  "зарядки и USB",
  "сигнализация",
  "камеры",
  "кофры",
  "ветровики",
  "подогрев ручек",
];

const NAV_LINKS = [
  { href: "#master", label: "Мастер" },
  { href: "#services", label: "Услуги" },
  { href: "#process", label: "Как работаем" },
  { href: "#partners", label: "Партнёры" },
  { href: "#contact", label: "Контакты" },
];

// ── Telegram Mini App deep links (moto-selection grammar, startappparamrouter)
const TG_BOT = "oneBikePlsBot";
const TG_APP_BASE = `https://t.me/${TG_BOT}/app?startapp=`;
const TG_CATALOG_DEEPLINK = `${TG_APP_BASE}crew_georg-electro`;
// Web-фолбэк того же каталога (браузер вне Telegram).
const WEB_CATALOG_HREF = "/franchize/georg-electro?mode=service";

function AmberTicker() {
  const seq = [
    "Диагностика",
    "Контроллеры",
    "BMS",
    "Проводка",
    "Перепрошивка",
    "Свет",
    "Дроссели",
    "Приборка",
    "Доп. оборудование",
  ];
  const row = [...seq, ...seq];
  return (
    <div aria-hidden className="overflow-hidden py-3" style={{ background: P.accent }}>
      <div
        className="ge-ticker-track flex w-max items-center gap-10 whitespace-nowrap pr-10"
      >
        {[...row, ...row].map((t, i) => (
          <span
            key={i}
            className="flex items-center gap-10 text-sm font-black uppercase tracking-[0.2em]"
            style={{ color: P.bgBase }}
          >
            {t}
            <Zap className="h-3.5 w-3.5" aria-hidden />
          </span>
        ))}
      </div>
    </div>
  );
}

export default function GeorgElectroLanding() {
  return (
    <div
      className="ge-root min-h-screen"
      style={{
        background: P.bgBase,
        color: P.textPrimary,
        ["--accent-clip-from" as string]: P.accentHover,
        ["--accent-clip-to" as string]: P.accent,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap');
        html { scroll-behavior: smooth; }
        .ge-root { font-family: 'Montserrat', 'Segoe UI', sans-serif; }
        .ge-root h1, .ge-root h2, .ge-root h3, .ge-root h4, .ge-root h5, .ge-root h6 {
          font-family: 'Montserrat', sans-serif;
          /* globals.css вешает на h1-h6 @apply text-foreground (тёмный цвет
             дефолт-темы) — возвращает управление палитре экипажа. */
          color: inherit;
        }
        @keyframes ge-kenburns { 0% { transform: scale(1) translateY(0); } 100% { transform: scale(1.12) translateY(-1.5%); } }
        @keyframes ge-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .ge-ticker-track { animation: ge-marquee 26s linear infinite; }
        @keyframes ge-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .ge-pulse { animation: ge-pulse 2.4s ease-in-out infinite; }
        /* task 144: партнёрские ревил-карточки («PICTURE LOGOS AND TITLES BE
           REVEALED ON TAP/HOVER») — дефолт: приглушённое фото-лого; ховер/тап:
           цвет + титул/нота/CTA выезжают снизу. Тач-гейт (первый тап reveal,
           второй — переход) в PartnerRevealCard (data-reveal-active). */
        .ge-pcard {
          position: relative;
          display: flex;
          min-height: 210px;
          overflow: hidden;
          border-radius: 1rem;
          border: 1px solid transparent;
          background: transparent;
          transition: border-color 0.3s ease, transform 0.3s ease;
        }
        .ge-pcard:hover, .ge-pcard[data-reveal-active="true"] { border-color: rgba(245,158,11,0.55); transform: translateY(-2px); }
        .ge-pcard__img {
          position: absolute; inset: 0;
          filter: grayscale(0.5) brightness(0.66);
          transition: filter 0.45s ease, transform 0.45s ease;
        }
        .ge-pcard:hover .ge-pcard__img,
        .ge-pcard[data-reveal-active="true"] .ge-pcard__img { filter: none; transform: scale(1.04); }
        .ge-pcard__scrim {
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(20,15,6,0.92) 0%, rgba(20,15,6,0.30) 48%, rgba(20,15,6,0.05) 74%);
        }
        .ge-pcard__body {
          position: absolute; left: 0; right: 0; bottom: 0;
          display: flex; flex-direction: column; gap: 4px;
          padding: 16px;
          opacity: 0; transform: translateY(10px);
          transition: opacity 0.35s ease, transform 0.35s ease;
        }
        .ge-pcard:hover .ge-pcard__body,
        .ge-pcard[data-reveal-active="true"] .ge-pcard__body { opacity: 1; transform: none; }
        /* фирменный дым moto-selection.ru на тёмной CTA-секции (task 144,
           «use everywhere applicable») — прозрачный PNG, под контентом */
        .ge-smoke {
          position: absolute; left: 0; right: 0; bottom: 0;
          height: 240px; pointer-events: none;
        }
        .ge-smoke img { object-fit: cover; object-position: bottom; width: 100%; height: 100%; }
        @media (prefers-reduced-motion: reduce) {
          .ge-ticker-track, .ge-pulse { animation: none !important; }
          .ge-kenburns { animation: none !important; }
        }
      `}</style>

      {/* ── NAV — тёмное стекло с янтарным акцентом ─────────────────────── */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur"
        style={{ background: "rgba(20,15,6,0.88)", borderColor: P.border }}
      >
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/georg-electro"
            className="flex items-center gap-2 whitespace-nowrap text-sm font-black uppercase tracking-[0.18em]"
            style={{ color: P.textPrimary }}
          >
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: P.accent, color: P.bgBase }}
              aria-hidden
            >
              <Zap className="h-4.5 w-4.5" />
            </span>
            Georg<span style={{ color: P.accent }}>.</span>Electro
          </Link>
          <nav aria-label="Основная навигация" className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-xs font-semibold uppercase tracking-[0.14em] transition hover:text-white"
                style={{ color: P.textSecondary }}
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <a
              href={TG_CATALOG_DEEPLINK}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Каталог экипажа в Telegram"
              className="hidden text-sm transition md:inline-flex"
              style={{ color: P.textSecondary }}
            >
              <Send className="h-4 w-4" aria-hidden />
            </a>
            <span
              className="hidden items-center gap-1.5 text-xs font-semibold sm:inline-flex"
              style={{ color: P.textSecondary }}
            >
              <Clock className="h-3.5 w-3.5" aria-hidden />
              10:00–20:00
            </span>
            <button
              type="button"
              data-lead-modal-open
              className="inline-flex h-10 items-center rounded-full px-4 text-xs font-black uppercase tracking-[0.1em] transition hover:brightness-110 active:scale-95"
              style={{ background: P.accent, color: P.bgBase }}
            >
              Заявка
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-[92svh] items-end overflow-hidden sm:items-center">
        <div className="absolute inset-0" aria-hidden>
          <div
            className="ge-kenburns absolute inset-0 will-change-transform"
            style={{ animation: "ge-kenburns 26s ease-in-out infinite alternate" }}
          >
            <Image
              src={IMG.hero}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />
          </div>
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(100deg, rgba(20,15,6,0.94) 0%, rgba(20,15,6,0.8) 34%, rgba(20,15,6,0.3) 62%, rgba(20,15,6,0.55) 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(58% 68% at 78% 30%, rgba(245,158,11,0.22) 0%, rgba(245,158,11,0) 70%)",
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent" style={{ backgroundImage: `linear-gradient(to bottom, transparent, ${P.bgBase})` }} />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-24 pt-28 sm:px-6 sm:pb-28">
          <p
            className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] backdrop-blur"
            style={{ borderColor: P.border, color: P.textSecondary, background: "rgba(30,22,10,0.5)" }}
          >
            <span
              className="ge-pulse inline-block h-2 w-2 rounded-full"
              style={{ background: P.accent }}
              aria-hidden
            />
            Georg Electro · Нижний Новгород
          </p>

          {/* Трёхслойный display героя — moto-selection ДНК. */}
          <h1 className="select-none text-[11vw] font-black uppercase leading-[0.92] tracking-tight sm:text-7xl lg:text-8xl">
            <span className="block" style={{ color: P.textPrimary }}>
              Один мастер
            </span>
            <span
              className="block"
              style={{
                color: "rgba(245,239,226,0.06)",
                WebkitTextStroke: `2px ${P.accent}`,
              }}
            >
              любой
            </span>
            <span
              className="landing-accent-clip block"
              style={{
                color: P.accent,
              }}
            >
              электромот
            </span>
          </h1>

          <p
            className="mt-6 max-w-xl text-base leading-relaxed sm:text-lg"
            style={{ color: P.textSecondary }}
          >
            Электрик электробайков: диагностика, ремонт и прокачка любого электромота —
            проводка, контроллеры, BMS, свет, доп. оборудование. Экипаж из одного человека —
            Георгия: без менеджеров и колл-центра, вы говорите напрямую с мастером.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              data-lead-modal-open
              className="inline-flex h-13 items-center gap-2 rounded-full px-7 py-3.5 text-sm font-black uppercase tracking-[0.1em] transition hover:brightness-110 active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${P.accentHover} 0%, ${P.accent} 65%)`, color: P.bgBase }}
            >
              <MessageSquare className="h-4 w-4" aria-hidden />
              Оставить заявку
            </button>
            <a
              href="#services"
              className="inline-flex h-13 items-center gap-2 rounded-full border px-7 py-3.5 text-sm font-bold uppercase tracking-[0.1em] transition hover:bg-white/5 active:scale-[0.98]"
              style={{ borderColor: P.border, color: P.textPrimary }}
            >
              Что делаю
            </a>
          </div>

          <ul className="mt-10 flex flex-wrap gap-x-10 gap-y-4" aria-label="Ключевые факты">
            <li>
              <span className="flex items-center gap-1.5 text-2xl font-black" style={{ color: P.accent }}>
                5.0 <Star className="h-5 w-5 fill-current" aria-hidden />
              </span>
              <span className="text-xs uppercase tracking-[0.14em]" style={{ color: P.textSecondary }}>
                рейтинг экипажа
              </span>
            </li>
            <li>
              <span className="text-2xl font-black" style={{ color: P.textPrimary }}>
                10:00–20:00
              </span>
              <span className="text-xs uppercase tracking-[0.14em]" style={{ color: P.textSecondary }}>
                часы работы
              </span>
            </li>
            <li>
              <span className="text-2xl font-black" style={{ color: P.textPrimary }}>
                10 метров
              </span>
              <span className="text-xs uppercase tracking-[0.14em]" style={{ color: P.textSecondary }}>
                от VIP BIKE — налево
              </span>
            </li>
          </ul>
        </div>
      </section>

      <AmberTicker />

      {/* ── МАСТЕР / ONE-MAN CREW ─────────────────────────────────────────── */}
      <section id="master" className="scroll-mt-20" style={{ background: P.bgBase }}>
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-28">
          {/* Коллаж: портрет + мастерская */}
          <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
            <div
              className="relative aspect-[4/5] overflow-hidden rounded-3xl border"
              style={{ borderColor: P.border }}
            >
              <Image
                src={IMG.master}
                alt="Георгий — мастер GEORG ELECTRO, у мотоцикла с мультиметром"
                fill
                sizes="(min-width: 1024px) 50vw, 90vw"
                className="object-cover"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, transparent 55%, rgba(20,15,6,0.75) 100%)",
                }}
              />
              <div
                className="absolute bottom-4 left-4 right-4 rounded-2xl border px-4 py-3 backdrop-blur"
                style={{ background: "rgba(30,22,10,0.72)", borderColor: P.border }}
              >
                <p className="text-sm font-black uppercase tracking-[0.08em]">Георгий</p>
                <p className="text-xs" style={{ color: P.textSecondary }}>
                  электрик электробайков · экипаж GEORG ELECTRO
                </p>
              </div>
            </div>
            <div
              className="absolute -bottom-8 -right-3 hidden w-52 overflow-hidden rounded-2xl border shadow-2xl sm:block lg:-right-8"
              style={{ borderColor: P.border }}
            >
              <div className="relative aspect-[4/3]">
                <Image
                  src={IMG.workshop}
                  alt="Мастерская GEORG ELECTRO: электробайк на ремонтной стойке"
                  fill
                  sizes="220px"
                  className="object-cover"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.24em]"
              style={{ color: P.accent }}
            >
              01 / Мастер
            </p>
            <h2 className="mt-3 text-3xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
              Один человек.
              <span className="block" style={{ color: P.accent }}>
                И этого хватает.
              </span>
            </h2>
            <p className="mt-5 leading-relaxed" style={{ color: P.textSecondary }}>
              GEORG ELECTRO — экипаж из одного человека. Это не минус, а формат: нет
              менеджеров, нет колл-центра, нет «передаю вашему вопросу коллеге» — вы
              всегда говорите напрямую с мастером, который сам вскрывает ваш электромот,
              сам его и собирает. За качество работы отвечает тот, кто её сделал.
            </p>
            <p className="mt-4 leading-relaxed" style={{ color: P.textSecondary }}>
              Мастерская стоит рядом с VIP BIKE — буквально 10 метров налево: заехал
              «по электрике», пока байк ждёт своей очереди в соседнем прокате. Дальше
              экипаж будет расти — младшие сотрудники, смены, зарплаты, — но приём,
              диагностика и финальная сборка по-прежнему остаются за Георгием.
            </p>

            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: User,
                  t: "Без менеджеров",
                  d: "Заявка сразу попадает мастеру — отвечает сам, обычно в тот же день.",
                },
                {
                  icon: BadgeCheck,
                  t: "Гарантия на монтаж",
                  d: "Подключаем аккуратно и отвечаем за установку после выезда.",
                },
                {
                  icon: MapPin,
                  t: "Рядом с VIP BIKE",
                  d: "Нижний Новгород, 10 метров налево от VIP BIKE — удобно заезжать.",
                },
                {
                  icon: Gauge,
                  t: "Любой электромот",
                  d: "Электровелосипеды, скутеры, электромотоциклы — электрика есть везде.",
                },
              ].map((f) => (
                <li
                  key={f.t}
                  className="flex gap-3 rounded-2xl border p-4"
                  style={{ background: P.bgCard, borderColor: P.border }}
                >
                  <span
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "rgba(245,158,11,0.12)", color: P.accent }}
                  >
                    <f.icon className="h-4.5 w-4.5" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{f.t}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed" style={{ color: P.textSecondary }}>
                      {f.d}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── УСЛУГИ ───────────────────────────────────────────────────────── */}
      <section id="services" className="scroll-mt-20 border-t" style={{ borderColor: P.border, background: P.bgBase }}>
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.24em]"
            style={{ color: P.accent }}
          >
            02 / Услуги
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <h2 className="max-w-xl text-3xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
              Что делает электрик электробайков
            </h2>
            <p className="max-w-sm text-sm leading-relaxed" style={{ color: P.textSecondary }}>
              Стоимость называем после диагностики — по факту видно, что менять, а что
              живое. Услуги из каталога экипажа, без звёздочек.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {SERVICES.map((s) => (
              <article
                key={s.id}
                className="group flex flex-col overflow-hidden rounded-3xl border transition-transform hover:-translate-y-1"
                style={{ background: P.bgCard, borderColor: P.border }}
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={s.img}
                    alt={s.title}
                    fill
                    sizes="(min-width: 768px) 33vw, 90vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(180deg, transparent 45%, rgba(20,15,6,0.65) 100%)",
                    }}
                  />
                  <span
                    className="absolute left-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-xl backdrop-blur"
                    style={{ background: "rgba(20,15,6,0.6)", color: P.accent }}
                  >
                    <s.icon className="h-4.5 w-4.5" aria-hidden />
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="text-lg font-black uppercase leading-snug tracking-tight">
                    {s.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed" style={{ color: P.textSecondary }}>
                    {s.text}
                  </p>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <span
                      className="text-xs font-bold uppercase tracking-[0.14em]"
                      style={{ color: P.accent }}
                    >
                      цена по запросу
                    </span>
                    <button
                      type="button"
                      data-lead-modal-open
                      className="inline-flex h-10 items-center rounded-full border px-4 text-xs font-black uppercase tracking-[0.1em] transition hover:brightness-110 active:scale-95"
                      style={{ borderColor: P.border, color: P.textPrimary }}
                    >
                      Заявка
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Чипы «что чиним» — всё из текстов услуг */}
          <div className="mt-12 flex flex-wrap gap-2.5">
            {FIXES.map((f) => (
              <span
                key={f}
                className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold"
                style={{ borderColor: P.border, color: P.textSecondary }}
              >
                <Zap className="h-3 w-3" style={{ color: P.accent }} aria-hidden />
                {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── КАК РАБОТАЕМ ─────────────────────────────────────────────────── */}
      <section id="process" className="scroll-mt-20 border-t" style={{ borderColor: P.border, background: P.bgCard }}>
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.24em]"
            style={{ color: P.accent }}
          >
            03 / Как работаем
          </p>
          <h2 className="mt-3 text-3xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
            От заявки до выезда
          </h2>

          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                n: "01",
                icon: MessageSquare,
                t: "Заявка",
                d: "Оставляете заявку на лендинге или пишете в каталог экипажа — она падает напрямую мастеру.",
              },
              {
                n: "02",
                icon: BatteryCharging,
                t: "Диагностика",
                d: "Смотрим электромот: проводка, контроллер, BMS, дроссель, свет. Находим настоящую причину, а не симптом.",
              },
              {
                n: "03",
                icon: Cpu,
                t: "Ремонт и настройка",
                d: "Чиним, перепрошиваем, подключаем. Считаем работу по факту диагностики — без сюрпризов.",
              },
              {
                n: "04",
                icon: Zap,
                t: "Проверка в деле",
                d: "Собираем, тестируем под нагрузкой и отдаём. Гарантия на монтаж — в комплекте.",
              },
            ].map((st) => (
              <li
                key={st.n}
                className="relative overflow-hidden rounded-3xl border p-6"
                style={{ background: P.bgBase, borderColor: P.border }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-2 -top-5 select-none text-7xl font-black"
                  style={{ color: "rgba(245,158,11,0.09)" }}
                >
                  {st.n}
                </span>
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: "rgba(245,158,11,0.12)", color: P.accent }}
                >
                  <st.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-base font-black uppercase tracking-tight">
                  {st.t}
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: P.textSecondary }}>
                  {st.d}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── ПАРТНЁРЫ — витрина платформы (task 141: interlink all-to-all).
          Все экипажи/лендинги на одном софте: аренда, мотосервис, платформа
          франшиз и ивент-агентство. Карточки в стилистике страницы (тёмный
          фон, янтарный ховер), как партнёрская витрина на /moto-selection. */}
      <section
        id="partners"
        className="scroll-mt-20 border-t"
        style={{ borderColor: P.border, background: P.bgBase }}
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <p
            className="text-center text-[11px] font-bold uppercase tracking-[0.24em]"
            style={{ color: P.accent }}
          >
            05 / Партнёры
          </p>
          <h2 className="mx-auto mt-3 max-w-2xl text-center text-3xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
            Экипажи на{" "}
            <span style={{ color: P.accent }}>одном софте</span>
          </h2>
          <p
            className="mx-auto mt-4 max-w-xl text-center leading-relaxed"
            style={{ color: P.textSecondary }}
          >
            Витрины, которые уже живут на платформе SLY13. Каждый — со своим
            брендом и каталогом, но цифры, договоры и лиды — общие.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {/* task 144: партнёры → ревил-карточки с НАСТОЯЩИМИ картинками-лого
                (vip-bike — неоновый лого, moto-selection — фирменный оранжевый
                лого с tildacdn, sly13 — carpix-лого, leorus — кейс-фото):
                дефолт приглушён, на ховере/тапе цвет + титул/нота/CTA. */}
            {[
              {
                href: "/vipbikerental",
                img: "/leorus/partner-vipbike.png",
                imgFit: "contain",
                eyebrow: "аренда электромото",
                title: "VIP BIKE Rental",
                text: "Площадка-партнёр и флагман платформы: аренда электромото в Нижнем Новгороде, экипировка, карта райдеров, зимнее хранение.",
              },
              {
                href: "/moto-selection",
                img: "https://static.tildacdn.com/tild3664-3162-4266-b638-633466343365/1____6666.jpg",
                imgFit: "cover",
                eyebrow: "мотосервис",
                title: "Moto.Selection",
                text: "Обучение, подбор мото, ТО, детейлинг, хранение и эвакуация 24/7. Сосед по цеху — заедьте на ТО, пока Георгий чинит проводку.",
              },
              {
                href: "/sly13",
                img: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/sly13_logo.jpg",
                imgFit: "cover",
                eyebrow: "платформа",
                title: "SLY13",
                text: "Платформа франшиз проката: каталог, CRM, договоры, лиды и витрина каждого экипажа на одном софте.",
              },
              {
                href: "/leorus",
                img: "/leorus/case-liveshows.jpg",
                imgFit: "cover",
                eyebrow: "ивент-агентство",
                title: "LEORUS",
                text: "Фестивали под ключ, DJ и шоу-программы, видео-продакшн, корпоративы. Рустам Оруджов × Влад Иващенко — громко делаем события.",
              },
            ].map((c) => (
              <PartnerRevealCard
                key={c.href}
                href={c.href}
                className="ge-pcard"
                ariaLabel={`${c.title} — открыть витрину партнёра`}
              >
                <Image
                  src={c.img}
                  alt=""
                  aria-hidden
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className={`ge-pcard__img ${c.imgFit === "contain" ? "object-contain p-10" : "object-cover"}`}
                />
                <span className="ge-pcard__scrim" aria-hidden />
                <span className="ge-pcard__body">
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.2em]"
                    style={{ color: P.accent }}
                  >
                    {c.eyebrow}
                  </span>
                  <span className="text-lg font-black uppercase tracking-tight" style={{ color: P.textPrimary }}>
                    {c.title}
                  </span>
                  <span className="text-sm leading-relaxed" style={{ color: P.textSecondary }}>
                    {c.text}
                  </span>
                  <span
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: P.accent }}
                  >
                    Открыть витрину
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </span>
              </PartnerRevealCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA + КОНТАКТЫ ───────────────────────────────────────────────── */}
      <section
        id="contact"
        className="relative scroll-mt-20 overflow-hidden border-t"
        style={{ borderColor: P.border, background: P.bgBase }}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 80% at 50% 0%, rgba(245,158,11,0.14) 0%, rgba(245,158,11,0) 70%)",
          }}
        />
        {/* task 144: фирменный дым moto-selection.ru на тёмной CTA-секции —
            прозрачный PNG лежит на градиенте, под контентом (z-10). */}
        <div className="ge-smoke z-0" aria-hidden>
          <Image src={SMOKE_TEXTURE} alt="" fill sizes="100vw" />
        </div>
        <div className="relative mx-auto w-full max-w-7xl px-4 py-20 text-center sm:px-6 lg:py-28">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.24em]"
            style={{ color: P.accent }}
          >
            06 / Контакты
          </p>
          <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
            Электромот ведёт себя странно?
            <span className="block" style={{ color: P.accent }}>
              Не тяните до полной тишины.
            </span>
          </h2>
          <p
            className="mx-auto mt-5 max-w-xl leading-relaxed"
            style={{ color: P.textSecondary }}
          >
            Оставьте заявку — она приходит прямо Георгию. Или зайдите в мастерскую:
            Нижний Новгород, рядом с VIP BIKE (10 метров налево), ежедневно 10:00–20:00.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              data-lead-modal-open
              className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm font-black uppercase tracking-[0.1em] transition hover:brightness-110 active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${P.accentHover} 0%, ${P.accent} 65%)`, color: P.bgBase }}
            >
              <MessageSquare className="h-4 w-4" aria-hidden />
              Оставить заявку
            </button>
            <a
              href={TG_CATALOG_DEEPLINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border px-8 py-4 text-sm font-bold uppercase tracking-[0.1em] transition hover:bg-white/5 active:scale-[0.98]"
              style={{ borderColor: P.border, color: P.textPrimary }}
            >
              <Send className="h-4 w-4" aria-hidden />
              Каталог экипажа
            </a>
          </div>
          <p className="mt-5 text-xs" style={{ color: P.textSecondary }}>
            Каталог открывается и в браузере:{" "}
            <Link href={WEB_CATALOG_HREF} className="underline" style={{ color: P.accent }}>
              /franchize/georg-electro
            </Link>
          </p>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="border-t" style={{ borderColor: P.border, background: P.bgCard }}>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: P.accent, color: P.bgBase }}
              aria-hidden
            >
              <Zap className="h-4 w-4" />
            </span>
            <span className="text-sm font-black uppercase tracking-[0.18em]">
              Georg<span style={{ color: P.accent }}>.</span>Electro
            </span>
            <span className="ml-2 text-xs" style={{ color: P.textSecondary }}>
              · Нижний Новгород
            </span>
          </div>
          <nav aria-label="Навигация в подвале" className="flex flex-wrap gap-x-6 gap-y-2">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-xs font-semibold uppercase tracking-[0.14em] transition hover:text-white"
                style={{ color: P.textSecondary }}
              >
                {l.label}
              </a>
            ))}
          </nav>
          <p className="text-xs" style={{ color: P.textSecondary }}>
            © 2026 GEORG ELECTRO · экипаж платформы{" "}
            <a
              href="https://vip-bike.ru"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: P.textPrimary }}
            >
              VIP BIKE
            </a>
          </p>
        </div>
      </footer>

      {/* Лид-модалка: общий механизм платформы (owner экипажа + salavey13) */}
      <FeedbackModal
        slug="georg-electro"
        accent={{ brand: P.accent, brandSoft: P.accentHover }}
        formSource="georg-electro-landing"
        landingPath="/georg-electro"
      />
    </div>
  );
}

