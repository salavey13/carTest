// /app/mototehnn/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// МОТОТЕХ НН — standalone landing (task 148, 2026-10-27, boss request):
// «create mototeh landing with quality bar on par with other landings
//  (/vipbikerental, /moto-selection, /sly13, /leorus, /georg-electro)».
//
// Source of truth (dug from mototehnn.ru 2026-10-27):
//   · мотосалон полного цикла: техника + запчасти + мотосервис;
//   · официальный дилер BENDA; бренды: Vento (VMC), KOVE, LIFAN, RACER,
//     Regulmoto, MOTAX, IRBIS, Apollo, Motoland…
//   · «Более 100 единиц мототехники и 10 000 запчастей — всё в наличии»;
//   · оплата: наличные, карта, QR, кредит, рассрочка, по счёту с НДС, лизинг;
//   · сервис: ТО, гарантийный ремонт, замена масла/цепи/клапанов,
//     сезонное хранение, эвакуация (город 30–60 мин / область / межгород);
//   · 13 типов техники: скутеры, мопеды, питбайки, кросс, эндуро, турэндуро,
//     дорожные, квадроциклы ПТС/ПСМ, снегоходы, мотобуксировщики, трициклы;
//   · контакты: Н. Новгород, ул. Артельная, 15б · +7 (831) 242-90-00 ·
//     mototeh_nn@mail.ru · Пн–Сб 10:00–19:00, Вс 10:00–16:00 ·
//     t.me/mototehnn · vk.com/mototehnn · mototehnn.ru.
//
// Crew: nn-mototeh-nn (crews row 9d274a68, motoSpot kind "shop") — палитра
// экипажа (тёмный navy #0a0f1a + синий #3b82f6) тянется из БД с фолбэком
// (sly13-паттерн устойчивости к недоступности Supabase). Лид-форма POST-ит в
// существующий /api/franchize/callback-lead со slug «nn-mototeh-nn» —
// получателей резолвит resolveLeadNotifyRecipients (owner + ростер +
// ADMIN_CHAT_ID salavey13). Ноль нового серверного кода.
//
// Images: сгенерированы для лендинга (scripts/gen-mototehnn-landing-images.sh,
// тексто-враждебные промпты в рецепте sly13) — public/images/mototehnn/*.
//
// DNA: georg-electro/moto-selection паттерн — RSC, собственные nav+footer,
// ken-burns hero, тикер, ms-glass карточки услуг, RestBreak, GhostWordmark,
// сквозной PartnerLogoGrid (только логотипы → hover/долгий тап). Хром
// платформы подавлен в ClientLayout THEME_CONFIG.mototehnn.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  Bike,
  Clock,
  CreditCard,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getCrewPaletteBySlug } from "@/app/franchize/actions";
import FeedbackModal from "../moto-selection/FeedbackModal";
import PartnerLogoGrid from "@/components/landing/PartnerLogoGrid";
import { GlassServiceCard, GlassServiceCardStyle } from "@/components/landings/GlassServiceCard";
import { RestBreak } from "@/components/landings/RestBreak";
import { GhostWordmark } from "@/components/landings/GhostWordmark";

export const metadata: Metadata = {
  title: "МОТОТЕХ НН — мотосалон, мотозапчасти и мотосервис · Нижний Новгород",
  description:
    "Официальный дилер BENDA: 100+ единиц мототехники и 10 000+ запчастей в наличии. Мотосервис, сезонное хранение и эвакуация мото по городу за 30–60 минут. Кредит, рассрочка, лизинг. Нижний Новгород, ул. Артельная, 15б.",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "МОТОТЕХ НН",
    title: "МОТОТЕХ НН — мотосалон полного цикла",
    description:
      "Техника, запчасти, сервис. Официальный дилер BENDA: 100+ единиц техники, 10 000+ запчастей в наличии, эвакуация 30–60 минут. Нижний Новгород, ул. Артельная, 15б.",
  },
};

// ── Палитра экипажа (crews.metadata.franchize.theme.palette, nn-mototeh-nn) ──
const P = {
  bgBase: "#0a0f1a",
  bgCard: "#111a2b",
  accent: "#3b82f6",
  accentHover: "#60a5fa",
  textPrimary: "#e8eef9",
  textSecondary: "#9db1cd",
  border: "#22334f",
} as const;

const IMG = {
  hero: "/images/mototehnn/hero.jpg",
  salon: "/images/mototehnn/salon.jpg",
  parts: "/images/mototehnn/parts.jpg",
  serviceTo: "/images/mototehnn/service-to.jpg",
  serviceStorage: "/images/mototehnn/service-storage.jpg",
  serviceEvac: "/images/mototehnn/service-evac.jpg",
  dealer: "/images/mototehnn/dealer.jpg",
} as const;

// Услуги мотосервиса — дословно из раздела «Мотосервис» mototehnn.ru.
const SERVICES = [
  {
    id: "mt-to",
    img: IMG.serviceTo,
    title: "ТО и ремонт мототехники",
    text: "Замена масла в ДВС и фильтров, обслуживание и регулировка цепи, смазка подшипников, регулировка зазоров клапанов. Гарантийный ремонт — по гарантии салона.",
    price: "цена по запросу",
  },
  {
    id: "mt-storage",
    img: IMG.serviceStorage,
    title: "Сезонное хранение",
    text: "Тёплое хранение мототехники на время межсезонья: техника пережидает зиму в сухом помещении, весной вы катитесь с выезда — без холодных запусков и севших АКБ.",
    price: "тёплый склад",
  },
  {
    id: "mt-evac",
    img: IMG.serviceEvac,
    title: "Эвакуация мототехники",
    text: "Мотоэвакуатор по городу — подача от 30 до 60 минут. Возим по Нижнему Новгороду и области, работает межгород. Сломались — один звонок, и техника забрана бережно.",
    price: "город 30–60 мин",
  },
  {
    id: "mt-podbor",
    img: IMG.dealer,
    title: "Подбор и предпродажная диагностика",
    text: "Эксперты подберут мототехнику и запчасти под ваши задачи. Перед продажей — комплексная диагностика в салоне: уезжаете на проверенном мотоцикле, а не на коте в мешке.",
    price: "диагностика в салоне",
  },
] as const;

// Типы техники — 13 категорий каталога mototehnn.ru, не выдумываем.
const TECH_TYPES = [
  "Скутеры",
  "Мопеды",
  "Питбайки",
  "Кроссовые мотоциклы",
  "Эндуро",
  "Турэндуро",
  "Дорожные мотоциклы",
  "Квадроциклы с ПТС/ПСМ",
  "Комплекты для сборки квадроциклов",
  "Снегоходы",
  "Мотобуксировщики",
  "Трициклы",
  "Внедорожные мотоциклы",
] as const;

// Категории запчастей — top-level каталога mototehnn.ru.
const PARTS_CATS = [
  "Двигатели и комплектующие",
  "Тормозная система",
  "Пластик и облицовки",
  "Электрика и свет",
  "Выхлопная система",
  "Приводная система",
  "Колёса и резина",
  "Подвеска",
  "Топливная система",
  "Масла и химия",
  "Кофры и багажные системы",
  "Экипировка",
] as const;

// Бренды салона (витрина mototehnn.ru → «Бренды»).
const BRANDS = [
  "BENDA",
  "Vento (VMC)",
  "KOVE",
  "LIFAN",
  "RACER",
  "Regulmoto",
  "MOTAX",
  "Motoland",
  "IRBIS",
  "Apollo",
] as const;

const NAV_LINKS = [
  { href: "#salon", label: "Салон" },
  { href: "#technics", label: "Техника" },
  { href: "#parts", label: "Запчасти" },
  { href: "#services", label: "Сервис" },
  { href: "#partners", label: "Партнёры" },
  { href: "#contact", label: "Контакты" },
];

const PHONE_HREF = "tel:+78312429000";
const PHONE_LABEL = "+7 (831) 242-90-00";
const TG_CHANNEL = "https://t.me/mototehnn";
const VK_GROUP = "https://vk.com/mototehnn";
const SHOP_SITE = "https://mototehnn.ru";

function BlueTicker() {
  const seq = [
    "Скутеры",
    "Питбайки",
    "Кросс",
    "Эндуро",
    "Турэндуро",
    "Квадроциклы",
    "Снегоходы",
    "Трициклы",
    "Мопеды",
    "Запчасти",
  ];
  const row = [...seq, ...seq];
  return (
    <div aria-hidden className="overflow-hidden py-3" style={{ background: P.accent }}>
      <div className="mt-ticker-track flex w-max items-center gap-10 whitespace-nowrap pr-10">
        {[...row, ...row].map((t, i) => (
          <span
            key={i}
            className="flex items-center gap-10 text-sm font-black uppercase tracking-[0.2em]"
            style={{ color: P.bgBase }}
          >
            {t}
            <Bike className="h-3.5 w-3.5" aria-hidden />
          </span>
        ))}
      </div>
    </div>
  );
}

export default async function MotoTehNNLanding() {
  // Resilience: supabaseAdmin THROWS synchronously when Supabase is
  // unreachable/misconfigured — the landing must survive a DB hiccup
  // (sly13 pattern). Fallback = the crew's own palette from crews.metadata.
  let p: typeof P;
  try {
    const crewPalette = (await getCrewPaletteBySlug("nn-mototeh-nn")).palette;
    p = { ...P, ...crewPalette };
  } catch {
    p = P;
  }

  return (
    <div
      className="mt-root min-h-screen"
      style={{
        background: p.bgBase,
        color: p.textPrimary,
        ["--accent-clip-from" as string]: p.accentHover,
        ["--accent-clip-to" as string]: p.accent,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap');
        html { scroll-behavior: smooth; }
        .mt-root { font-family: 'Montserrat', 'Segoe UI', sans-serif; }
        .mt-root h1, .mt-root h2, .mt-root h3, .mt-root h4, .mt-root h5, .mt-root h6 {
          font-family: 'Montserrat', sans-serif;
          /* globals.css вешает на h1-h6 @apply text-foreground (тёмный цвет
             дефолт-темы) — возвращает управление палитре экипажа. */
          color: inherit;
        }
        @keyframes mt-kenburns { 0% { transform: scale(1) translateY(0); } 100% { transform: scale(1.12) translateY(-1.5%); } }
        @keyframes mt-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .mt-ticker-track { animation: mt-marquee 26s linear infinite; }
        @keyframes mt-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .mt-pulse { animation: mt-pulse 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .mt-ticker-track, .mt-pulse { animation: none !important; }
          .mt-kenburns { animation: none !important; }
        }
      `}</style>

      {/* ── NAV — тёмный navy со синим акцентом ─────────────────────────── */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur"
        style={{ background: "rgba(10,15,26,0.88)", borderColor: p.border }}
      >
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/mototehnn"
            className="flex items-center gap-2 whitespace-nowrap text-sm font-black uppercase tracking-[0.18em]"
            style={{ color: p.textPrimary }}
          >
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: p.accent, color: "#ffffff" }}
              aria-hidden
            >
              <Bike className="h-4.5 w-4.5" />
            </span>
            МотоТех<span style={{ color: p.accent }}>НН</span>
          </Link>
          <nav aria-label="Основная навигация" className="hidden items-center gap-6 lg:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-xs font-semibold uppercase tracking-[0.14em] transition hover:text-white"
                style={{ color: p.textSecondary }}
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <a
              href={PHONE_HREF}
              className="hidden items-center gap-1.5 text-xs font-bold tracking-wide transition hover:text-white md:inline-flex"
              style={{ color: p.textPrimary }}
            >
              <Phone className="h-3.5 w-3.5" style={{ color: p.accent }} aria-hidden />
              {PHONE_LABEL}
            </a>
            <button
              type="button"
              data-lead-modal-open
              className="inline-flex h-10 items-center rounded-full px-4 text-xs font-black uppercase tracking-[0.1em] transition hover:brightness-110 active:scale-95"
              style={{ background: p.accent, color: "#ffffff" }}
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
            className="mt-kenburns absolute inset-0 will-change-transform"
            style={{ animation: "mt-kenburns 26s ease-in-out infinite alternate" }}
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
                "linear-gradient(100deg, rgba(10,15,26,0.95) 0%, rgba(10,15,26,0.82) 34%, rgba(10,15,26,0.32) 62%, rgba(10,15,26,0.6) 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(58% 68% at 78% 30%, rgba(59,130,246,0.22) 0%, rgba(59,130,246,0) 70%)",
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent" style={{ backgroundImage: `linear-gradient(to bottom, transparent, ${p.bgBase})` }} />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-24 pt-28 sm:px-6 sm:pb-28">
          <p
            className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] backdrop-blur"
            style={{ borderColor: p.border, color: p.textSecondary, background: "rgba(17,26,43,0.55)" }}
          >
            <span
              className="mt-pulse inline-block h-2 w-2 rounded-full"
              style={{ background: p.accent }}
              aria-hidden
            />
            Официальный дилер BENDA · Нижний Новгород
          </p>

          {/* Трёхслойный display героя — moto-selection/georg ДНК. */}
          <h1 className="select-none text-[11vw] font-black uppercase leading-[0.92] tracking-tight sm:text-7xl lg:text-8xl">
            <span className="block" style={{ color: p.textPrimary }}>
              Техника.
            </span>
            <span
              className="block"
              style={{
                color: "rgba(232,238,249,0.06)",
                WebkitTextStroke: `2px ${p.accent}`,
              }}
            >
              Запчасти.
            </span>
            <span
              className="landing-accent-clip block"
              style={{ color: p.accent }}
            >
              Сервис.
            </span>
          </h1>

          <p
            className="mt-6 max-w-xl text-base leading-relaxed sm:text-lg"
            style={{ color: p.textSecondary }}
          >
            Мотосалон полного цикла: 100+ единиц техники и 10 000+ запчастей в
            наличии, мотосервис, сезонное хранение и эвакуация мото. Всё под
            одной крышей на Артельной, 15б — заехал за деталью, уехал на новом
            мотоцикле.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              data-lead-modal-open
              className="inline-flex h-13 items-center gap-2 rounded-full px-7 py-3.5 text-sm font-black uppercase tracking-[0.1em] transition hover:brightness-110 active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${p.accentHover} 0%, ${p.accent} 65%)`, color: "#ffffff" }}
            >
              <MessageSquare className="h-4 w-4" aria-hidden />
              Оставить заявку
            </button>
            <a
              href="#services"
              className="inline-flex h-13 items-center gap-2 rounded-full border px-7 py-3.5 text-sm font-bold uppercase tracking-[0.1em] transition hover:bg-white/5 active:scale-[0.98]"
              style={{ borderColor: p.border, color: p.textPrimary }}
            >
              Что умеем
            </a>
          </div>

          <ul className="mt-10 flex flex-wrap gap-x-10 gap-y-4" aria-label="Ключевые факты">
            <li>
              <span className="text-2xl font-black" style={{ color: p.textPrimary }}>
                100+
              </span>
              <span className="block text-xs uppercase tracking-[0.14em]" style={{ color: p.textSecondary }}>
                единиц техники в наличии
              </span>
            </li>
            <li>
              <span className="text-2xl font-black" style={{ color: p.textPrimary }}>
                10 000+
              </span>
              <span className="block text-xs uppercase tracking-[0.14em]" style={{ color: p.textSecondary }}>
                запчастей на полках
              </span>
            </li>
            <li>
              <span className="flex items-center gap-1.5 text-2xl font-black" style={{ color: p.accent }}>
                30–60 <Clock className="h-5 w-5" aria-hidden />
              </span>
              <span className="block text-xs uppercase tracking-[0.14em]" style={{ color: p.textSecondary }}>
                минут — подача мотоэвакуатора
              </span>
            </li>
          </ul>
        </div>
      </section>

      <BlueTicker />

      {/* ── 01 / САЛОН ───────────────────────────────────────────────────── */}
      <section id="salon" className="scroll-mt-20" style={{ background: p.bgBase }}>
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-28">
          {/* Коллаж: студийный кадр + зал салона */}
          <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
            <div
              className="relative aspect-[4/5] overflow-hidden rounded-3xl border"
              style={{ borderColor: p.border }}
            >
              <Image
                src={IMG.dealer}
                alt="Новый дорожный мотоцикл в шоу-зале МОТОТЕХ НН"
                fill
                sizes="(min-width: 1024px) 50vw, 90vw"
                className="object-cover"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, transparent 55%, rgba(10,15,26,0.78) 100%)",
                }}
              />
              <div
                className="absolute bottom-4 left-4 right-4 rounded-2xl border px-4 py-3 backdrop-blur"
                style={{ background: "rgba(17,26,43,0.72)", borderColor: p.border }}
              >
                <p className="text-sm font-black uppercase tracking-[0.08em]">BENDA · Vento · KOVE</p>
                <p className="text-xs" style={{ color: p.textSecondary }}>
                  официальная гарантия салона · документы в день покупки
                </p>
              </div>
            </div>
            <div
              className="absolute -bottom-8 -right-3 hidden w-52 overflow-hidden rounded-2xl border shadow-2xl sm:block lg:-right-8"
              style={{ borderColor: p.border }}
            >
              <div className="relative aspect-[4/3]">
                <Image
                  src={IMG.salon}
                  alt="Зал мотосалона МОТОТЕХ НН: ряды новой техники"
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
              style={{ color: p.accent }}
            >
              01 / Салон
            </p>
            <h2 className="mt-3 text-3xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
              Честный мотосалон
              <span className="block" style={{ color: p.accent }}>
                на Артельной, 15б
              </span>
            </h2>
            <p className="mt-5 leading-relaxed" style={{ color: p.textSecondary }}>
              МОТОТЕХ НН — мотосалон полного цикла: здесь можно выбрать и купить
              технику, подобрать запчасти и сразу поставить мото на обслуживание.
              Никаких «приезжайте на осмотр через неделю» — 100+ единиц техники
              и 10 000 позиций запчастей уже стоят на полках салона.
            </p>
            <p className="mt-4 leading-relaxed" style={{ color: p.textSecondary }}>
              Мы официальный дилер BENDA и работаем с проверенными брендами:
              Vento (VMC), KOVE, LIFAN, RACER, Regulmoto, MOTAX и другими.
              Перед продажей каждая единица проходит комплексную диагностику в
              салоне — уезжаете на проверенном мотоцикле с документами,
              гарантийной книжкой и полным сопровождением после покупки.
            </p>

            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: Package,
                  t: "Ассортимент",
                  d: "100+ единиц техники и 10 000+ запчастей — всё в наличии, не «под заказ через месяц».",
                },
                {
                  icon: Sparkles,
                  t: "Профессионализм",
                  d: "Эксперты подберут мототехнику и запчасти под ваши задачи — от первого скутера до турэндуро.",
                },
                {
                  icon: CreditCard,
                  t: "Удобная оплата",
                  d: "Наличные, карта, QR, кредит, рассрочка, по счёту с НДС, лизинг — как вам удобнее.",
                },
                {
                  icon: ShieldCheck,
                  t: "Сервис после покупки",
                  d: "Доставка, гарантия и сервис — полное сопровождение, а не «до кассы и до свидания».",
                },
              ].map((f) => (
                <li
                  key={f.t}
                  className="flex gap-3 rounded-2xl border p-4"
                  style={{ background: p.bgCard, borderColor: p.border }}
                >
                  <span
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "rgba(59,130,246,0.12)", color: p.accent }}
                  >
                    <f.icon className="h-4.5 w-4.5" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{f.t}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed" style={{ color: p.textSecondary }}>
                      {f.d}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap gap-2">
              {BRANDS.map((b) => (
                <span
                  key={b}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide"
                  style={{ borderColor: p.border, color: p.textSecondary }}
                >
                  <BadgeCheck className="h-3 w-3" style={{ color: p.accent }} aria-hidden />
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 02 / ТЕХНИКА ─────────────────────────────────────────────────── */}
      <section id="technics" className="scroll-mt-20 border-t" style={{ borderColor: p.border, background: p.bgCard }}>
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.24em]"
            style={{ color: p.accent }}
          >
            02 / Техника
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <h2 className="max-w-xl text-3xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
              13 типов техники — от мопеда до снегохода
            </h2>
            <p className="max-w-sm text-sm leading-relaxed" style={{ color: p.textSecondary }}>
              Скутеры до 50 кубов — с ДКП сразу из кассы; техника старше 50 кубов —
              с ЭПТС, актом приёма-передачи и ГТД: документы оформляем за вас.
            </p>
          </div>

          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TECH_TYPES.map((t, i) => (
              <li
                key={t}
                className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3.5 transition hover:border-[var(--mt-accent)]"
                style={{ background: p.bgBase, borderColor: p.border, ["--mt-accent" as string]: p.accent }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-1 top-1/2 -translate-y-1/2 select-none text-4xl font-black opacity-[0.07]"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "rgba(59,130,246,0.12)", color: p.accent }}
                >
                  <Bike className="h-4.5 w-4.5" aria-hidden />
                </span>
                <span className="text-sm font-bold">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 03 / ЗАПЧАСТИ ────────────────────────────────────────────────── */}
      <section id="parts" className="scroll-mt-20 border-t" style={{ borderColor: p.border, background: p.bgBase }}>
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:py-28">
          <div className="flex flex-col justify-center">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.24em]"
              style={{ color: p.accent }}
            >
              03 / Запчасти
            </p>
            <h2 className="mt-3 text-3xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
              10 000+ позиций
              <span className="block" style={{ color: p.accent }}>
                на полках и под заказ
              </span>
            </h2>
            <p className="mt-5 leading-relaxed" style={{ color: p.textSecondary }}>
              Двигатели и комплектующие, тормоза, пластик, электрика, выхлоп,
              приводная система, масла и химия, экипировка — каталог держит
              всё: от свечи зажигания до рамы. Нет на полке — привезём под
              заказ, в том числе позиции VMC.
            </p>
            <p className="mt-4 leading-relaxed" style={{ color: p.textSecondary }}>
              Можно приехать со своими запчастями — установим. Но при установке
              наших деталей действует полная гарантия: и на запчасть, и на
              работу. А если не знаете, что именно сгорело или стёрлось —
              эксперты салона подберут деталь по вашему мотоциклу.
            </p>

            <div className="mt-8 flex flex-wrap gap-2">
              {PARTS_CATS.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold"
                  style={{ borderColor: p.border, color: p.textSecondary }}
                >
                  <Package className="h-3 w-3" style={{ color: p.accent }} aria-hidden />
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
            <div
              className="relative aspect-[4/3] overflow-hidden rounded-3xl border lg:aspect-[5/4]"
              style={{ borderColor: p.border }}
            >
              <Image
                src={IMG.parts}
                alt="Стеллажи с мотозапчастями в МОТОТЕХ НН"
                fill
                sizes="(min-width: 1024px) 50vw, 90vw"
                className="object-cover"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, transparent 60%, rgba(10,15,26,0.72) 100%)",
                }}
              />
              <div
                className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 backdrop-blur"
                style={{ background: "rgba(17,26,43,0.72)", borderColor: p.border }}
              >
                <span className="text-sm font-black uppercase tracking-[0.08em]">
                  от свечи до рамы
                </span>
                <a
                  href={SHOP_SITE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.08em] transition hover:brightness-110"
                  style={{ background: p.accent, color: "#ffffff" }}
                >
                  Каталог
                  <Send className="h-3 w-3" aria-hidden />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 04 / СЕРВИС ──────────────────────────────────────────────────── */}
      <section id="services" className="scroll-mt-20 border-t" style={{ borderColor: p.border, background: p.bgBase }}>
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.24em]"
            style={{ color: p.accent }}
          >
            04 / Сервис
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <h2 className="max-w-xl text-3xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
              Мотосервис, хранение и эвакуация
            </h2>
            <p className="max-w-sm text-sm leading-relaxed" style={{ color: p.textSecondary }}>
              Техобслуживание, гарантийный ремонт, тёплое хранение на зиму и
              мотоэвакуатор с подачей от 30 минут — тот же салон, тот же
              телефон, те же люди.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {/* task 145 ДНК: услуги = ms-glass карточки — фото на всю карточку +
                фирменное стекло, ховер/первый тап растворяет стекло, второй
                тап/клик открывает заявку. Синий тинт под палитру экипажа. */}
            <GlassServiceCardStyle />
            {SERVICES.map((s, svcIdx) => (
              <GlassServiceCard
                key={s.id}
                img={s.img}
                num={String(svcIdx + 1).padStart(2, "0")}
                title={s.title}
                text={s.text}
                price={s.price}
                ctaLabel="Заявка"
                leadModal
                ariaLabel={`${s.title} — оставить заявку`}
                minH="360px"
                style={{
                  ["--gs-accent" as string]: p.accent,
                  ["--gs-glass-bg" as string]: "rgba(10, 15, 26, 0.66)",
                  background: p.bgCard,
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── ПЕРЕДЫШКА — sly13 rest act, pollinated: сезонное хранение с
          параллаксом; тизер ведёт в контакты. */}
      <RestBreak
        src={IMG.serviceStorage}
        kicker="мототех нн · передышка"
        title="Пока мото ждёт сезон —"
        accentWord="он спит в тепле"
        note="сезонное хранение · ТО · эвакуация · 10 000 запчастей в наличии"
        bg={p.bgBase}
        accent={p.accent}
        textPrimary={p.textPrimary}
        textSecondary={p.textSecondary}
      />

      {/* ── 05 / ПАРТНЁРЫ — витрина платформы (task 141: interlink all-to-all,
          task 148: mototehnn становится шестой витриной — все лендинги
          ссылаются друг на друга). Логотипы в покое, название на hover/долгом
          тапе — сквозной PartnerLogoGrid. */}
      <section
        id="partners"
        className="scroll-mt-20 border-t"
        style={{ borderColor: p.border, background: p.bgBase }}
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <p
            className="text-center text-[11px] font-bold uppercase tracking-[0.24em]"
            style={{ color: p.accent }}
          >
            05 / Партнёры
          </p>
          <h2 className="mx-auto mt-3 max-w-2xl text-center text-3xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
            Экипажи на{" "}
            <span style={{ color: p.accent }}>одном софте</span>
          </h2>
          <p
            className="mx-auto mt-4 max-w-xl text-center leading-relaxed"
            style={{ color: p.textSecondary }}
          >
            Витрины, которые уже живут на платформе SLY13. Каждый — со своим
            брендом и каталогом, но цифры, договоры и лиды — общие.
          </p>

          <div className="mt-10">
            <PartnerLogoGrid
              accent={p.accent}
              columns={5}
              ariaLabel="Экипажи на одном софте — витрины партнёров"
              partners={[
                {
                  href: "/vipbikerental",
                  title: "VIP BIKE Rental",
                  tagline: "аренда электромото в Нижнем Новгороде — экипировка, карта райдеров, зимнее хранение",
                  logoSrc: "/leorus/partner-vipbike.png",
                  logoAlt: "VIP BIKE ELECTRO",
                  backing: "#050508",
                },
                {
                  href: "/moto-selection",
                  title: "Moto.Selection",
                  tagline: "мотосервис — обучение, подбор мото, ТО, детейлинг, хранение и эвакуация 24/7",
                  logoSrc: "https://static.tildacdn.com/tild6335-3266-4164-b461-363834666561/__.png",
                  logoAlt: "Moto.Selection",
                  backing: "#f2efea",
                  lightBacking: true,
                },
                {
                  href: "/sly13",
                  title: "SLY13",
                  tagline: "платформа франшиз проката — каталог, CRM, договоры, лиды и витрина каждого экипажа",
                  logoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/sly13_logo.jpg",
                  logoAlt: "SLY13",
                  backing: "#030303",
                },
                {
                  href: "/leorus",
                  title: "LEORUS",
                  tagline: "ивент-агентство — фестивали под ключ, DJ и шоу-программы, видео-продакшн, корпоративы",
                  logoSrc: "/logos/leorus-logo.png",
                  logoAlt: "LEORUS",
                  backing: "#0A0612",
                },
                {
                  href: "/georg-electro",
                  title: "Georg.Electro",
                  tagline: "электрик электробайков — диагностика, контроллеры, проводка, свет; один мастер",
                  logoSrc: "/logos/georg-electro-logo.png",
                  logoAlt: "Georg.Electro",
                  backing: "#140f06",
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* ── 06 / КОНТАКТЫ ────────────────────────────────────────────────── */}
      <section
        id="contact"
        className="relative scroll-mt-20 overflow-hidden border-t"
        style={{ borderColor: p.border, background: p.bgBase }}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 80% at 50% 0%, rgba(59,130,246,0.14) 0%, rgba(59,130,246,0) 70%)",
          }}
        />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-20 text-center sm:px-6 lg:py-28">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.24em]"
            style={{ color: p.accent }}
          >
            06 / Контакты
          </p>
          <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
            Нужна деталь, техника или эвакуатор?
            <span className="block" style={{ color: p.accent }}>
              Один звонок решает.
            </span>
          </h2>
          <p
            className="mx-auto mt-5 max-w-xl leading-relaxed"
            style={{ color: p.textSecondary }}
          >
            Оставьте заявку — она приходит команде салона, и мы свяжемся с вами
            в течение рабочего дня. Или заезжайте: Нижний Новгород, ул.
            Артельная, 15б.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              data-lead-modal-open
              className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm font-black uppercase tracking-[0.1em] transition hover:brightness-110 active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${p.accentHover} 0%, ${p.accent} 65%)`, color: "#ffffff" }}
            >
              <MessageSquare className="h-4 w-4" aria-hidden />
              Оставить заявку
            </button>
            <a
              href={PHONE_HREF}
              className="inline-flex items-center gap-2 rounded-full border px-8 py-4 text-sm font-bold uppercase tracking-[0.1em] transition hover:bg-white/5 active:scale-[0.98]"
              style={{ borderColor: p.border, color: p.textPrimary }}
            >
              <Phone className="h-4 w-4" style={{ color: p.accent }} aria-hidden />
              {PHONE_LABEL}
            </a>
          </div>

          <ul className="mx-auto mt-12 grid max-w-3xl gap-4 text-left sm:grid-cols-2">
            {[
              {
                icon: MapPin,
                t: "Адрес",
                d: "Нижний Новгород, ул. Артельная, д. 15б",
                href: "https://yandex.ru/maps/?text=Нижний%20Новгород%20Артельная%2015б",
                external: true,
              },
              {
                icon: Clock,
                t: "Часы работы",
                d: "Пн–Сб: 10:00–19:00 · Вс: 10:00–16:00",
              },
              {
                icon: Send,
                t: "Telegram",
                d: "t.me/mototehnn — новости и поступления",
                href: TG_CHANNEL,
                external: true,
              },
              {
                icon: Mail,
                t: "Почта",
                d: "mototeh_nn@mail.ru",
                href: "mailto:mototeh_nn@mail.ru",
              },
            ].map((c) => (
              <li
                key={c.t}
                className="flex items-start gap-3 rounded-2xl border p-4"
                style={{ background: p.bgCard, borderColor: p.border }}
              >
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "rgba(59,130,246,0.12)", color: p.accent }}
                >
                  <c.icon className="h-4.5 w-4.5" aria-hidden />
                </span>
                <span>
                  <span className="block text-xs font-bold uppercase tracking-[0.14em]" style={{ color: p.textSecondary }}>
                    {c.t}
                  </span>
                  {c.href ? (
                    <a
                      href={c.href}
                      {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="mt-0.5 block text-sm font-semibold transition hover:underline"
                    >
                      {c.d}
                    </a>
                  ) : (
                    <span className="mt-0.5 block text-sm font-semibold">{c.d}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs" style={{ color: p.textSecondary }}>
            Сайт салона:{" "}
            <a href={SHOP_SITE} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: p.accent }}>
              mototehnn.ru
            </a>
            {" · "}VK:{" "}
            <a href={VK_GROUP} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: p.accent }}>
              vk.com/mototehnn
            </a>
          </p>
        </div>
      </section>

      {/* ── ГИГАНТСКИЙ ВОРДМАРК — ДНК /moto-selection: гост-текст ровно на
          всю ширину экрана перед подвалом (SVG textLength). */}
      <div className="border-t py-5" style={{ borderColor: p.border }} aria-hidden>
        <GhostWordmark
          parts={[
            { text: "МОТОТЕХ", color: p.textPrimary, opacity: 0.05 },
            { text: " ", color: p.textPrimary, opacity: 0.02 },
            { text: "НН", color: p.accent, opacity: 0.35 },
          ]}
        />
      </div>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="border-t" style={{ borderColor: p.border, background: p.bgCard }}>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: p.accent, color: "#ffffff" }}
              aria-hidden
            >
              <Bike className="h-4 w-4" />
            </span>
            <span className="text-sm font-black uppercase tracking-[0.18em]">
              МотоТех<span style={{ color: p.accent }}>НН</span>
            </span>
            <span className="ml-2 text-xs" style={{ color: p.textSecondary }}>
              · мотосалон · Артельная, 15б
            </span>
          </div>
          <nav aria-label="Навигация в подвале" className="flex flex-wrap gap-x-6 gap-y-2">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-xs font-semibold uppercase tracking-[0.14em] transition hover:text-white"
                style={{ color: p.textSecondary }}
              >
                {l.label}
              </a>
            ))}
          </nav>
          <p className="text-xs" style={{ color: p.textSecondary }}>
            © 2026 Мототех НН · экипаж платформы{" "}
            <Link href="/sly13" className="underline" style={{ color: p.textPrimary }}>
              SLY13
            </Link>
          </p>
        </div>
      </footer>

      {/* Лид-модалка: общий механизм платформы (owner экипажа + salavey13) */}
      <FeedbackModal
        slug="nn-mototeh-nn"
        accent={{ brand: p.accent, brandSoft: p.accentHover }}
        formSource="mototehnn-landing"
        landingPath="/mototehnn"
      />
    </div>
  );
}
