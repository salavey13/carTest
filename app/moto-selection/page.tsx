// /app/moto-selection/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// MOTO.SELECTION — standalone landing (2026-10-25, boss request).
//
// «lets copy it's landing page to our platform as a page like i did for myself
//  (/sly13 ...) - copy moto-selection.ru, keep image urls even:) Add one more
//  service section and improve hero section typography and hero image:)»
//
// Source of truth: https://moto-selection.ru (Tilda). ALL copy below is
// verbatim from the original site; ALL images keep their original tildacdn
// URLs (boss explicitly asked to keep them). The one ADDED service section —
// «Эвакуация и перевозка мототехники» — takes its facts from the crew's real
// platform catalog (public.cars, crew_id ddc2eae6-…: «Перевозим на своей
// оборудованной технике / Сопровождение в сервис, ГИБДД / при покупке /
// Работаем 24/7», от 3 500 ₽), no invented promises.
//
// Chrome: this route is registered in ClientLayout THEME_CONFIG
// (motoSelection → Header/Footer/BottomNav null) — the page renders its own
// black/orange nav + footer, svarprofi/nnvolt pattern. Brand orange #ff7522
// sampled from the original Tilda markup (29 color / 25 bg occurrences).
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronRight,
  Instagram,
  Mail,
  MessageCircle,
  Phone,
  Send,
  Truck,
  Youtube,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Moto.selection — высокое искусство мотосервиса | Нижний Новгород",
  description:
    "Обучение вождению, подбор и покупка мотоцикла, экипировка, ТО и ремонт, зимнее хранение, детейлинг, эвакуация и аренда мототехники. Нижний Новгород и ещё 5 городов. Работаем 24/7.",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Moto.selection",
    title: "Moto.selection — высокое искусство мотосервиса",
    description:
      "Обучение, подбор, обслуживание, хранение и детейлинг мотоциклов. Нижний Новгород, Санкт-Петербург, Владимир, Иваново, Краснодар, Севастополь.",
  },
};

// ── Original tildacdn asset URLs (kept verbatim per boss request) ────────────
const T = "https://static.tildacdn.com";
// Эвакуация: сгенерированная обложка из каталога экипажа (task 135 присвоил
// картинки всем 8 услугам moto-selection в public.cars) — на оригинале у
// эвакуации фото нет, а у нас уже есть.
const IMG_EVAC_CATALOG =
  "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/moto-selection-svc-03/image_1.jpg";
const IMG = {
  // 2026-10-25 (owner request): hero bg swap — the golden-hour harley ride
  // made way for the stunt rider in blue smoke (moto-selection-svc-01, the
  // crew's own platform catalog cover). Dark, dramatic, and the brand orange
  // pops against the blue smoke. Kept on the platform's Supabase storage.
  hero: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/moto-selection-svc-01/image_1.jpg",
  training: `${T}/tild3634-3538-4336-b032-613630643439/xmoto-182-1-scaled-1.jpg`,
  pickUp: `${T}/tild6632-3031-4331-b566-363037363236/noroot.png`,
  gear: `${T}/tild3436-3834-4462-a663-323333316239/9-Dainese-.jpg`,
  service: `${T}/tild6333-3465-4166-b631-343964626165/6896136953128360_e1f.jpg`,
  storage: `${T}/tild3231-6330-4761-a364-613338663132/8920463051_d0244dce5.jpg`,
  detailing: `${T}/tild3662-6533-4431-a132-646161323463/4362862179014284_4d4.jpg`,
  academyLogo: `${T}/tild3237-3337-4732-a131-616361336230/VboLB5caDbrEwJdRviGc.png`,
  owner: `${T}/tild3830-6138-4362-b062-633738323463/IMG_54971.jpg`,
  partnerBikeland: `${T}/tild6332-3437-4639-b864-626262356466/a85d6fbe3e31832458bb.jpg`,
} as const;

const BRAND = "#ff7522";

// 7 городов — сверено с героем оригинала (ms.html, бегущая строка):
// Москва присутствовала на оригинале, в витрине 134 её не было — добавлена.
const CITIES = [
  "Нижний Новгород",
  "Москва",
  "Санкт-Петербург",
  "Владимир",
  "Иваново",
  "Краснодар",
  "Севастополь",
];

// Служебные ссылки — телефон/email из шапки и подвала оригинала, Telegram —
// из metadata.franchize.contacts экипажа moto-selection (@romani14).
const PHONE_HREF = "tel:+79875570444";
const PHONE_TEXT = "+7 (987) 557-04-44";
const WHATSAPP_HREF = "https://wa.me/79875570444";
const TELEGRAM_HREF = "https://t.me/romani14";
const EMAIL = "moto-selection@yandex.ru";
const SOURCE_SITE = "https://moto-selection.ru";
// Гранд-труф с оригинала (ms.html / ms-history.html, 2026-10-25):
const SOCIAL_INSTAGRAM = "https://instagram.com/moto.selection";
const SOCIAL_YOUTUBE = "https://www.youtube.com/channel/UCS6_8H7BjW3AC-VHfUV0sYw";
const SOCIAL_VK = "https://vk.com/id174435641";
// отзывы оригинал ведёт в группу VK vip_bike (кнопка «ПОДРОБНЕЕ» в отзывах)
const REVIEWS_VK_HREF = "https://vk.com/vip_bike";
// партнёры: ссылки прямо с оригинала (кнопка АКАДЕМИЯ в шапке и блок партнёров)
const ACADEMY_HREF = "https://school.academy.cr/vzroslye/#b890948";
const ACADEMY_SITE = "https://academy.cr/";
const BIKELAND_HREF = "https://bikeland.ru/";
const HISTORY_HREF = "/moto-selection/history";

// ── Telegram Mini App deep links (boss 2026-10-25) ───────────────────────────
// startapp-параметры маршрутизирует hooks/use-start-param-target.ts:
//   storage_<slug> → /franchize/<slug>/storage (стена зимнего хранения),
//   crew_<slug>    → /franchize/<slug> (каталог экипажа).
// Грамматика покрыта регресс-спекой startapp-routing-regression.spec.ts —
// crew extraction from the startapp parameter works (boss: «make sure»).
const TG_BOT = "oneBikePlsBot";
const TG_APP_BASE = `https://t.me/${TG_BOT}/app?startapp=`;
const TG_STORAGE_DEEPLINK = `${TG_APP_BASE}storage_moto-selection`;
const TG_CATALOG_DEEPLINK = `${TG_APP_BASE}crew_moto-selection`;
// Web-фолбэки тех же разделов (браузер вне Telegram).
const WEB_STORAGE_HREF = "/franchize/moto-selection/storage";
const WEB_CATALOG_HREF = "/franchize/moto-selection?mode=service";
// Логотип партнёра SLY13 (carpix/sly13_logo.jpg) — карточка в «партнёрах»
// теперь визуально выровнена с Байкленд/Академия (boss 2026-10-25).
const SLY13_LOGO =
  "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/sly13_logo.jpg";

// «наши услуги» — 6 карточек оригинала + ДОБАВЛЕННАЯ эвакуация (данные из
// каталога экипажа на платформе). Обложка эвакуации — из каталога (task 135).
// Storage pic on the platform storage tab comes from metadata.franchize.storage
// (PATCHed 2026-10-25) — the same tildacdn photo as here (IMG.storage).
const SERVICES: {
  id: string;
  title: string;
  img?: string;
  price?: string;
  text: string;
  anchor: string;
}[] = [
  {
    id: "training",
    title: "Обучение вождению с нуля",
    img: IMG.training,
    text: "Мото-академия: от первых занятий до контраварийной и спортивной подготовки у наших партнёров.",
    anchor: "#academy",
  },
  {
    id: "pickup",
    title: "Подбор мотоцикла, покупка, помощь при постановке на учёт",
    img: IMG.pickUp,
    price: "от 25 000 ₽",
    text: "Юридическая проверка, мониторинг предложений, осмотр и полное сопровождение сделки.",
    anchor: "#prices",
  },
  {
    id: "gear",
    title: "Помощь в выборе и покупке экипировки",
    img: IMG.gear,
    text: "Шлемы, куртки, перчатки и защита — подберём экипировку, которая действительно подходит под ваш стиль езды.",
    anchor: "#contact",
  },
  {
    id: "service",
    title: "Техническое обслуживание и ремонт",
    img: IMG.service,
    text: "Регламентные работы, расходники, электрика, ходовая. Готовим байк к сезону и закрываем внезапные поломки.",
    anchor: "#contact",
  },
  {
    id: "storage",
    title: "Зимнее хранение мототехники",
    img: IMG.storage,
    price: "от 2 000 ₽",
    text: "Тёплое хранение по всем байкерским канонам: консервация, контроль состояния, подготовка к сезону.",
    anchor: "#storage",
  },
  {
    id: "detailing",
    title: "Детейлинг и кастомизация",
    img: IMG.detailing,
    price: "от 5 000 ₽",
    text: "Мойка, полировка, оклейка плёнкой зон риска и защитные составы — байк возвращается как из салона.",
    anchor: "#detailing",
  },
  // ── ДОБАВЛЕННАЯ УСЛУГА (запрос босса «Add one more service section») ──
  // Теперь и на оригинале есть эвакуация (блок в секции 02 с ценой от 3 500 ₽)
  // — копия сходится. Картинка — обложка из каталога экипажа (task 135).
  {
    id: "evac",
    title: "Эвакуация и перевозка мототехники",
    img: IMG_EVAC_CATALOG,
    price: "от 3 500 ₽",
    text: "Перевозим на своей оборудованной технике, сопровождаем в сервис или ГИБДД. Работаем 24/7.",
    anchor: "#evac",
  },
];

const ACADEMY_TRACKS = [
  "Индивидуальные занятия",
  "Базовый курс",
  "Контраварийный курс",
  "Эндуро курс",
  "Спортивный курс",
  "Стантрадинг",
];

const PRICES = [
  {
    tag: "комплексный подбор",
    price: "от 25 000 ₽",
    title: "Подбор мотоцикла и покупка под ключ",
    bullets: [
      "Проверка юридической чистоты VIN номера или Гос. регистрационного знака",
      "Исследование и мониторинг предложений Нижнего Новгорода и Нижегородской области интересующей модели",
      "Осмотр неограниченного количества мотоциклов",
      "Полное сопровождение сделки и заключение договора Купли-Продажи",
    ],
  },
  // Эвакуация — карточка цен с оригинала (ms.html, секция 02): verbatim.
  {
    tag: "эвакуация и перевозка",
    price: "от 3 500 ₽",
    title: "Эвакуация и перевозка",
    bullets: [
      "Перевозим на своей оборудованной технике",
      "Сопровождение в Сервис / ГИБДД / При покупке",
      "Работаем 24/7",
    ],
  },
  {
    tag: "выездной осмотр",
    price: "от 3 500 ₽",
    title: "Выездной осмотр перед покупкой",
    bullets: [
      "Проверяем визуальную и техническую составляющую мотоцикла",
      "Проверка документов и юридической чистоты",
      "Рекомендации по техническому обслуживанию",
      "Сопровождение в сервис / ГИБДД / при покупке",
    ],
  },
  {
    tag: "аренда",
    price: "от 4 000 ₽",
    title: "Аренда мототехники",
    bullets: [
      "Большой выбор различной мототехники от 80 до 1000 сс",
      "Залог от 5000 рублей",
      "Можно арендовать экипировку",
      "Возможность долгосрочной аренды",
      "У нас есть кожаный мопед :)",
    ],
  },
];

const DETAILING_STEPS = [
  "Предварительная мойка мотоцикла",
  "Очистка поверхностей от сложных загрязнений: битум, колодочная пыль, следы смазки цепи и др.",
  "Полировка",
  "Оклейка пленкой зон подверженных физическому воздействию",
  "Покрытие мотоцикла защитными составами",
];

const NAV_LINKS = [
  { href: "#about", label: "О нас" },
  { href: "#services", label: "Услуги" },
  { href: "#prices", label: "Цены" },
  { href: "#reviews", label: "Отзывы" },
  { href: "#partners", label: "Партнёры" },
  { href: "#contact", label: "Контакты" },
];

export default function MotoSelectionLanding() {
  return (
    <div className="ms-root min-h-screen bg-black text-white" style={{ ["--ms-accent" as string]: BRAND }}>
      {/* smooth scroll for anchor nav; ken-burns + marquee for hero */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap');
        html { scroll-behavior: smooth; }
        /* Шрифт оригинала — Montserrat 100..900 (ms.html head). Задан на корне
           витрины и явно на заголовках: globals.css вешает на h1-h6 Archivo
           Black, который шире и ломает выравнивание с оригиналом. */
        .ms-root { font-family: 'Montserrat', 'Segoe UI', sans-serif; }
        .ms-root h1, .ms-root h2, .ms-root h3, .ms-root h4, .ms-root h5, .ms-root h6 {
          font-family: 'Montserrat', sans-serif;
        }
        @keyframes ms-kenburns { 0% { transform: scale(1) translateY(0); } 100% { transform: scale(1.12) translateY(-1.5%); } }
        @keyframes ms-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) {
          .ms-kenburns, .ms-marquee-track { animation: none !important; }
        }
      `}</style>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/moto-selection" className="flex items-center gap-1.5 whitespace-nowrap text-sm font-black uppercase tracking-[0.18em] text-white">
            Moto<span className="text-[var(--ms-accent)]">.</span>selection
          </Link>
          <nav aria-label="Основная навигация" className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60 transition hover:text-[var(--ms-accent)]"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {/* соцсети в шапке — как на оригинале (t228 rightside: Telegram,
                Instagram + телефон); VK/YouTube живут в подвале */}
            <a
              href={TELEGRAM_HREF}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              className="hidden text-white/50 transition hover:text-[var(--ms-accent)] md:inline-flex"
            >
              <Send className="h-4 w-4" aria-hidden />
            </a>
            <a
              href={SOCIAL_INSTAGRAM}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="hidden text-white/50 transition hover:text-[var(--ms-accent)] md:inline-flex"
            >
              <Instagram className="h-4 w-4" aria-hidden />
            </a>
            <a
              href={PHONE_HREF}
              className="hidden text-sm font-bold text-white transition hover:text-[var(--ms-accent)] sm:inline-flex sm:items-center sm:gap-1.5"
            >
              <Phone className="h-4 w-4 text-[var(--ms-accent)]" aria-hidden />
              {PHONE_TEXT}
            </a>
            <a
              href="#contact"
              className="inline-flex h-10 items-center rounded-full bg-[var(--ms-accent)] px-4 text-xs font-bold uppercase tracking-[0.1em] text-black transition hover:brightness-110 active:scale-95"
            >
              Заявка
            </a>
          </div>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-[92svh] items-end overflow-hidden sm:items-center">
        {/* Hero image: moto-selection-svc-01 (stunt rider in blue smoke,
            owner-approved swap 2026-10-25), slow ken-burns.
            Улучшение картинки: три слоя скрима — чёрная подушка
            слева под типографику, тёплый радиальный глушитель оранжевого
            справа, нижний фейд в чёрный. Новый кадр темнее оригинала, поэтому
            скрима достаточно, а оранжевый акцент читается на синем дыме. */}
        <div className="absolute inset-0" aria-hidden>
          <div
            className="absolute inset-0 will-change-transform"
            style={{ animation: "ms-kenburns 26s ease-in-out infinite alternate" }}
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
                "linear-gradient(100deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.78) 34%, rgba(0,0,0,0.25) 62%, rgba(0,0,0,0.45) 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(58% 68% at 78% 30%, rgba(255,117,34,0.20) 0%, rgba(255,117,34,0) 70%)",
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-black" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-24 pt-28 sm:px-6 sm:pb-28">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-white/80 backdrop-blur">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--ms-accent)]" aria-hidden />
            Moto.selection · Нижний Новгород
          </p>

          {/* Улучшенная типографика героя (запрос босса): исходная одна строка
              «Высокое искусство мотосервиса» развёрнута в трёхслойный display:
              чёрная заливка / контурный штрих / оранжевый градиент.
              11vw на мобайле: globals.css вешает на h1 'Archivo Black' (широкая
              гарнитура) — при 13vw «МОТОСЕРВИСА» (11 глифов) резалась по правому
              краю экрана. */}
          <h1 className="select-none text-[11vw] font-black uppercase leading-[0.92] tracking-tight sm:text-7xl lg:text-8xl">
            <span className="block text-white">Высокое</span>
            <span
              className="block"
              style={{
                color: "transparent",
                WebkitTextStroke: "2px rgba(255,255,255,0.85)",
              }}
            >
              искусство
            </span>
            {/* TV-safe gradient (boss 2026-10-25): the previous inline
                clipped-gradient pair painted a solid orange square on TV
                WebKit (no background-clip:text support there). The class
                defaults to the solid brand orange and upgrades to the
                gradient only inside @supports — same cure as the root page
                (.vip-accent-clip) and /sly13 (.landing-accent-clip). */}
            <span
              className="landing-accent-clip block"
              style={{
                ["--accent-clip-from" as string]: BRAND,
                ["--accent-clip-to" as string]: "#ffa770",
              }}
            >
              мотосервиса
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
            Начни свой путь в мир мотоциклов вместе с нами!
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#about"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--ms-accent)] px-7 text-sm font-bold uppercase tracking-[0.08em] text-black transition hover:brightness-110 active:scale-95"
            >
              Подробнее о нас
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </a>
            <a
              href="#services"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-7 text-sm font-bold uppercase tracking-[0.08em] text-white backdrop-blur transition hover:border-[var(--ms-accent)] hover:text-[var(--ms-accent)] active:scale-95"
            >
              Наши услуги
            </a>
            <a
              href={WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 px-2 text-sm font-semibold text-white/70 transition hover:text-white sm:ml-2"
            >
              <Send className="h-4 w-4 text-[var(--ms-accent)]" aria-hidden />
              Оставить заявку
            </a>
          </div>
        </div>

        {/* города-маркеты из героя оригинала — бегущая строка по нижнему краю */}
        <div className="absolute inset-x-0 bottom-0 z-10 overflow-hidden border-t border-white/10 bg-black/40 py-3 backdrop-blur">
          <div
            className="ms-marquee-track flex w-max items-center gap-8 whitespace-nowrap pr-8"
            style={{ animation: "ms-marquee 30s linear infinite" }}
          >
            {[...CITIES, ...CITIES].map((c, i) => (
              <span key={`${c}-${i}`} className="flex items-center gap-8 text-[11px] font-bold uppercase tracking-[0.28em] text-white/50">
                {c}
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--ms-accent)]/70" aria-hidden />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── НАШИ УСЛУГИ ─────────────────────────────────────────────────── */}
      <section id="services" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--ms-accent)]">наши услуги</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-black uppercase leading-tight tracking-tight text-white sm:text-4xl">
          Всё для мотоцикла — в одном месте
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/60 sm:text-base">
          Семь направлений: от первого занятия и выбора байка до хранения зимой и детейлинга весной.
          Цены и оформление заказа — на карточках и в каталоге экипажа на платформе.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <a
              key={s.id}
              href={s.anchor}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition hover:border-[var(--ms-accent)]/60 hover:bg-white/[0.07]"
            >
              {s.img ? (
                <div className="relative h-44 w-full overflow-hidden">
                  <Image
                    src={s.img}
                    alt={s.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" aria-hidden />
                </div>
              ) : (
                // Эвакуация — единственная услуга без фото на оригинале:
                // фирменный оранжевый блок с иконкой вместо картинки.
                <div
                  className="relative flex h-44 w-full items-center justify-center overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #c24e0d 100%)` }}
                >
                  <Truck className="h-16 w-16 text-black/80" aria-hidden />
                  <span className="absolute right-4 top-4 rounded-full bg-black/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                    24/7
                  </span>
                </div>
              )}
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-bold leading-snug text-white">{s.title}</h3>
                  {s.price && (
                    <span className="shrink-0 rounded-full bg-[var(--ms-accent)] px-2.5 py-1 text-[11px] font-bold text-black">
                      {s.price}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{s.text}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--ms-accent)]">
                  Подробнее
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ── АКАДЕМИЯ ────────────────────────────────────────────────────── */}
      <section id="academy" className="border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--ms-accent)]">академия</p>
            <h2 className="mt-3 text-3xl font-black uppercase leading-tight tracking-tight text-white sm:text-4xl">
              Обучение вождению с нуля
            </h2>
            <div className="mt-5 space-y-4 text-sm leading-relaxed text-white/65 sm:text-base">
              <p>
                Мотоцикл считается средством повышенной опасности. Поэтому вождение мотоцикла требует
                от мотоциклиста максимального внимания и осторожности, а главное — знаний и практики.
              </p>
              <p>
                Опыт прохождения различных препятствий, отработка торможений, руления и других
                особенностей управления мотоциклом вы можете получить, обучаясь у наших партнеров.
              </p>
              <p>
                В центр автомотоспорта «Академия» вы можете пройти обучение в удобной для вас форме
                и по различным направлениям:
              </p>
            </div>
            <ul className="mt-6 flex flex-wrap gap-2">
              {ACADEMY_TRACKS.map((t) => (
                <li
                  key={t}
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white/80"
                >
                  {t}
                </li>
              ))}
            </ul>
            <a
              href={ACADEMY_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-[var(--ms-accent)] px-7 text-sm font-bold uppercase tracking-[0.08em] text-black transition hover:brightness-110 active:scale-95"
            >
              Узнать подробнее и записаться на первое занятие
            </a>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]">
            <Image
              src={IMG.academyLogo}
              alt="Автомотоспорт «Академия» — партнёр Moto.selection"
              width={885}
              height={792}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* ── ЦЕНЫ: подбор / осмотр / аренда ─────────────────────────────── */}
      <section id="prices" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--ms-accent)]">
          подбор мотоцикла, покупка, перевозка, аренда
        </p>
        <h2 className="mt-3 max-w-2xl text-3xl font-black uppercase leading-tight tracking-tight text-white sm:text-4xl">
          Прозрачные цены на главные услуги
        </h2>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {PRICES.map((p) => (
            <div
              key={p.tag}
              className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-[var(--ms-accent)]/60"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--ms-accent)]">{p.tag}</span>
                <span className="rounded-full bg-[var(--ms-accent)] px-3 py-1 text-xs font-bold text-black">{p.price}</span>
              </div>
              <h3 className="mt-4 text-lg font-bold leading-snug text-white">{p.title}</h3>
              <ul className="mt-4 flex-1 space-y-3">
                {p.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm leading-relaxed text-white/65">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ms-accent)]" aria-hidden />
                    {b}
                  </li>
                ))}
              </ul>
              <a
                href="#contact"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-full border border-white/20 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:border-[var(--ms-accent)] hover:text-[var(--ms-accent)] active:scale-95"
              >
                Оставить заявку
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ── ДОБАВЛЕННАЯ УСЛУГА: ЭВАКУАЦИЯ 24/7 ─────────────────────────── */}
      {/* Запрос босса «Add one more service section». Данные — из каталога
          экипажа moto-selection на платформе (service, от 3 500 ₽, 24/7). */}
      <section id="evac" className="relative overflow-hidden border-y border-white/10">
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(120deg, ${BRAND} 0%, #b34709 55%, #1a0d05 100%)` }}
          aria-hidden
        />
        <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-black/70">
              новая услуга на платформе
            </p>
            <h2 className="mt-3 text-3xl font-black uppercase leading-tight tracking-tight text-black sm:text-4xl">
              Эвакуация и перевозка мототехники
            </h2>
            <ul className="mt-6 space-y-3">
              {[
                "Перевозим на своей оборудованной технике",
                "Сопровождение в сервис / ГИБДД / при покупке",
                "Работаем 24/7 — город и область",
              ].map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm font-semibold leading-relaxed text-black/85 sm:text-base">
                  <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-black" aria-hidden />
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col items-stretch gap-4 sm:flex-row lg:flex-col">
            <div className="flex flex-col items-center justify-center rounded-2xl bg-black px-8 py-6 text-center">
              <Truck className="h-9 w-9 text-[var(--ms-accent)]" aria-hidden />
              <div className="mt-2 text-2xl font-black text-white">от 3 500 ₽</div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">по городу и области</div>
            </div>
            <a
              href={TELEGRAM_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-black px-8 text-sm font-bold uppercase tracking-[0.1em] text-white transition hover:bg-black/85 active:scale-95"
            >
              <Send className="h-4 w-4 text-[var(--ms-accent)]" aria-hidden />
              Вызвать эвакуатор
            </a>
          </div>
        </div>
      </section>

      {/* ── ЗИМНЕЕ ХРАНЕНИЕ ────────────────────────────────────────────── */}
      <section id="storage" className="relative overflow-hidden">
        <div className="absolute inset-0" aria-hidden>
          <Image
            src={IMG.storage}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/50" />
        </div>
        <div className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--ms-accent)]">
              зимнее хранение мототехники
            </p>
            <h2 className="mt-3 text-3xl font-black uppercase leading-tight tracking-tight text-white sm:text-4xl">
              Тёплое хранение мотоцикла зимой — лучшее, что может случиться с вашим байком
            </h2>
            <div className="mt-5 space-y-4 text-sm leading-relaxed text-white/70 sm:text-base">
              <p>
                <span className="font-bold text-white">Сезонное хранение мотоциклов</span> — это почти
                ритуал, который нужно провести по всем священным байкерским канонам. То, как ваш
                железный друг проводит зиму, очень сильно повлияет на то, как он будет ездить летом.
                Если не поменяете масло в моторе — он ответит вам недобрым покашливанием весной.
                Если пропустите окислившийся контакт в проводке — ждите искрящейся светомузыки по
                всему мотоциклу, который вряд ли захочет куда-то ехать в таком состоянии. А самая
                дорогая цена, которую вы заплатите — ваше испорченное настроение в самом начале
                сезона, когда увидите, что мотоцикл «уже не тот». Иными словами, важна каждая мелочь.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center rounded-full bg-[var(--ms-accent)] px-5 py-2.5 text-lg font-black text-black">
                от 2 000 ₽
              </span>
              <a
                href="#contact"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-7 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:border-[var(--ms-accent)] hover:text-[var(--ms-accent)] active:scale-95"
              >
                Оставить заявку
              </a>
            </div>

            {/* Платформа: онлайн-заявка на хранение — договор, акт и ПЭП
                прямо в Telegram Mini App (босс 2026-10-25: «add proper links
                to moto-selection crew winter storage from landing ... using
                deep links via startappparamrouter»). storage_<slug> роутится
                в /franchize/moto-selection/storage самим Mini App; веб-ссылка
                — фолбэк для браузера. */}
            <div className="mt-6 rounded-2xl border border-[var(--ms-accent)]/35 bg-black/60 p-5 backdrop-blur">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--ms-accent)]">
                платформа · зимнее хранение онлайн
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                Каталог экипажа принимает заявки на хранение круглый год: договор
                ответственного хранения, акт приёма-передачи с фотофиксацией и
                подпись простой электронной подписью — всё в Telegram.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <a
                  href={TG_STORAGE_DEEPLINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--ms-accent)] px-6 text-xs font-bold uppercase tracking-[0.1em] text-black transition hover:brightness-110 active:scale-95"
                >
                  <Send className="h-4 w-4" aria-hidden />
                  Хранение в Telegram
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </a>
                <a
                  href={WEB_STORAGE_HREF}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-6 text-xs font-bold uppercase tracking-[0.1em] text-white transition hover:border-[var(--ms-accent)] hover:text-[var(--ms-accent)] active:scale-95"
                >
                  Открыть в браузере
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ДЕТЕЙЛИНГ И КАСТОМИЗАЦИЯ ───────────────────────────────────── */}
      <section id="detailing" className="relative overflow-hidden border-y border-white/10">
        <div className="absolute inset-0" aria-hidden>
          <Image
            src={IMG.detailing}
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-right"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-black/30 via-black/85 to-black" />
        </div>
        <div className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="ml-auto max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--ms-accent)]">
              детейлинг и кастомизация
            </p>
            <h2 className="mt-3 text-3xl font-black uppercase leading-tight tracking-tight text-white sm:text-4xl">
              Детейлинг и кастомизация мотоциклов
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/70 sm:text-base">
              Услуга детейлинга мотоцикла включает в себя следующий комплекс процедур:
            </p>
            <ul className="mt-5 space-y-3">
              {DETAILING_STEPS.map((step, i) => (
                <li key={step} className="flex items-start gap-3 text-sm leading-relaxed text-white/75 sm:text-base">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--ms-accent)] text-xs font-black text-black">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center rounded-full bg-[var(--ms-accent)] px-5 py-2.5 text-lg font-black text-black">
                от 5 000 ₽
              </span>
              <a
                href="#contact"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-7 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:border-[var(--ms-accent)] hover:text-[var(--ms-accent)] active:scale-95"
              >
                Оставить заявку
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── О НАС ───────────────────────────────────────────────────────── */}
      <section id="about" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-16">
          <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 lg:w-96">
            <Image
              src={IMG.owner}
              alt="Роман Лосев — основатель Moto.selection"
              width={840}
              height={920}
              sizes="(max-width: 1024px) 100vw, 384px"
              className="h-auto w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-5 pb-4 pt-12">
              <p className="text-sm font-black uppercase tracking-[0.14em] text-white">Роман Лосев</p>
              <p className="text-xs text-white/60">основатель Moto.selection</p>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--ms-accent)]">о нас</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-black uppercase leading-tight tracking-tight text-white sm:text-4xl">
              Мы прошли все этапы этого увлекательного пути
            </h2>
            <div className="mt-5 space-y-4 text-sm leading-relaxed text-white/65 sm:text-base">
              <p>
                Мотоцикл — один из самых популярных транспортных средств во всем мире, и с каждым
                годом он набирает свою популярность. Но не каждый знает, сколько нюансов стоит за
                выбором и приобретением мотоцикла, в его обслуживании, хранении. Так же мотоцикл
                требует постоянного совершенствования навыков вождения, понимание физики движения
                и многое другое.
              </p>
              <p>
                Мы прошли все этапы этого увлекательного пути, совершая ошибки, постоянно пробуя
                что-то новое и совершенствуясь в своих навыках и знаниях. И теперь мы готовы
                поделиться своим многолетним опытом.
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {/* «ЧИТАТЬ НАШУ ИСТОРИЮ» на оригинале ведёт на подстраницу
                  /history — на платформе её зеркалит /moto-selection/history */}
              <Link
                href={HISTORY_HREF}
                className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--ms-accent)] px-7 text-sm font-bold uppercase tracking-[0.08em] text-black transition hover:brightness-110 active:scale-95"
              >
                Читать нашу историю
              </Link>
              <a
                href="#contact"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-7 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:border-[var(--ms-accent)] hover:text-[var(--ms-accent)] active:scale-95"
              >
                Связаться с нами
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── ОТЗЫВЫ ──────────────────────────────────────────────────────── */}
      <section id="reviews" className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--ms-accent)]">отзывы клиентов</p>
          <blockquote className="mx-auto mt-4 max-w-3xl text-xl font-bold leading-snug text-white/90 sm:text-2xl">
            «Мы уже помогли осуществить мечту людей по всей России»
          </blockquote>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/50">
            Оставить свой комментарий можно нажав по кнопке «Читать другие отзывы»
            и перейдя во ВКонтакте — как на оригинале.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={REVIEWS_VK_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-full border border-white/20 px-6 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:border-[var(--ms-accent)] hover:text-[var(--ms-accent)]"
            >
              Читать другие отзывы во ВКонтакте
            </a>
            <Link
              href={HISTORY_HREF}
              className="inline-flex h-11 items-center justify-center rounded-full border border-white/20 px-6 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:border-[var(--ms-accent)] hover:text-[var(--ms-accent)]"
            >
              История создания проекта
            </Link>
          </div>
        </div>
      </section>

      {/* ── ПАРТНЁРЫ ────────────────────────────────────────────────────── */}
      <section id="partners" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--ms-accent)]">
          наши партнеры
        </p>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <a
            href={BIKELAND_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black p-6 transition hover:border-[var(--ms-accent)]/60"
          >
            <Image
              src={IMG.partnerBikeland}
              alt="Байкленд — партнёр Moto.selection"
              width={300}
              height={300}
              sizes="(max-width: 640px) 100vw, 300px"
              className="h-auto w-48 object-contain transition group-hover:scale-105"
            />
          </a>
          <a
            href={ACADEMY_SITE}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 transition hover:border-[var(--ms-accent)]/60"
          >
            <Image
              src={IMG.academyLogo}
              alt="Академия — партнёр Moto.selection"
              width={300}
              height={268}
              sizes="(max-width: 640px) 100vw, 300px"
              className="h-auto w-48 object-contain transition group-hover:scale-105"
            />
          </a>
          {/* Партнёрская витрина платформы: cross-link к /sly13 (босс:
              «interlink us as partners in respective sections»).
              2026-10-25: карточка получила ЛОГОТИП sly13 (carpix/
              sly13_logo.jpg) и теперь визуально выровнена с Байкленд и
              Академия — те тоже картинки, а не текст. */}
          <Link
            href="/sly13"
            className="group flex flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-white/10 bg-black p-6 text-center transition hover:border-[var(--ms-accent)]/60"
          >
            <Image
              src={SLY13_LOGO}
              alt="SLY13 — платформа франшиз проката"
              width={300}
              height={300}
              sizes="(max-width: 640px) 100vw, 300px"
              className="h-auto w-48 rounded-xl object-contain transition group-hover:scale-105"
            />
            <span className="text-xs leading-relaxed text-white/50">
              платформа франшиз проката — витрина партнёров, работающих на одном софте
            </span>
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ms-accent)]">
              Открыть витрину
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        </div>
      </section>

      {/* ── КОНТАКТЫ / ЗАЯВКА ──────────────────────────────────────────── */}
      <section id="contact" className="border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--ms-accent)]">контакты</p>
            <h2 className="mt-3 text-3xl font-black uppercase leading-tight tracking-tight text-white sm:text-4xl">
              Оставьте заявку и мы перезвоним Вам
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/60 sm:text-base">
              Telegram, WhatsApp или звонок — ответим на вопросы по любой услуге, посчитаем
              хранение и подберём время. Работаем 24/7.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <a
                href={TELEGRAM_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-14 items-center justify-center gap-2 rounded-2xl bg-[var(--ms-accent)] text-sm font-bold uppercase tracking-[0.08em] text-black transition hover:brightness-110 active:scale-95"
              >
                <Send className="h-4 w-4" aria-hidden /> Telegram
              </a>
              <a
                href={WHATSAPP_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/20 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:border-[var(--ms-accent)] hover:text-[var(--ms-accent)] active:scale-95"
              >
                WhatsApp
              </a>
              <a
                href={PHONE_HREF}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/20 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:border-[var(--ms-accent)] hover:text-[var(--ms-accent)] active:scale-95"
              >
                <Phone className="h-4 w-4" aria-hidden /> {PHONE_TEXT}
              </a>
            </div>
            <p className="mt-6 text-sm text-white/50">
              почта: <a href={`mailto:${EMAIL}`} className="text-white/80 underline decoration-dotted underline-offset-4 hover:text-[var(--ms-accent)]">{EMAIL}</a>
            </p>
          </div>

          {/* Платформенная витрина: каталог экипажа + личная витрина salavey13 */}
          <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
            <Link
              href={WEB_CATALOG_HREF}
              className="group rounded-2xl border border-[var(--ms-accent)]/40 bg-black p-6 transition hover:border-[var(--ms-accent)]"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--ms-accent)]">платформа</p>
              <h3 className="mt-2 text-lg font-bold text-white">Каталог и заказ услуг онлайн</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                Все 8 услуг экипажа с ценами и корзиной — в Telegram Mini App платформы.
              </p>
              {/* startapp deep link (crew_moto-selection) роутится прямо в
                  каталог экипажа — boss: «maybe even using deep links via
                  startappparamrouter». Ссылка-дублер для браузера ниже. */}
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                <a
                  href={TG_CATALOG_DEEPLINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[var(--ms-accent)]"
                >
                  <Send className="h-3.5 w-3.5" aria-hidden />
                  Открыть в Telegram
                </a>
                <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--ms-accent)]">
                  Открыть в браузере
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </div>
            </Link>
            <Link
              href="/sly13"
              className="group rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-[var(--ms-accent)]/60"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">партнёры</p>
              <h3 className="mt-2 text-lg font-bold text-white">Витрина SLY13 — платформа франшиз</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                Мотосервис, прокат и витрины партнёров работают на одной платформе:
                каталог, заказы, аналитика, договоры.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--ms-accent)]">
                Посмотреть витрину
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 bg-black">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-white">
              Moto<span className="text-[var(--ms-accent)]">.</span>selection
            </p>
            <p className="mt-3 text-xs leading-relaxed text-white/40">
              © Moto.selection, 2022–2026. Копия официального сайта{" "}
              <a href={SOURCE_SITE} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-4 hover:text-white/70">
                moto-selection.ru
              </a>{" "}
              на платформе франшиз.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">контакты</p>
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              <li><a href={PHONE_HREF} className="transition hover:text-[var(--ms-accent)]">{PHONE_TEXT}</a></li>
              <li><a href={`mailto:${EMAIL}`} className="transition hover:text-[var(--ms-accent)]">{EMAIL}</a></li>
              <li><a href={SOURCE_SITE} target="_blank" rel="noopener noreferrer" className="transition hover:text-[var(--ms-accent)]">moto-selection.ru</a></li>
              <li><Link href={HISTORY_HREF} className="transition hover:text-[var(--ms-accent)]">История проекта</Link></li>
            </ul>
            {/* «мы в соцсетях» — блок оригинала: Telegram, Mail, Phone, WhatsApp
                + Instagram / YouTube / VK из иконок страницы */}
            <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">мы в соцсетях</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {[
                { href: TELEGRAM_HREF, label: "Telegram", Icon: Send },
                { href: SOCIAL_INSTAGRAM, label: "Instagram", Icon: Instagram },
                { href: SOCIAL_YOUTUBE, label: "YouTube", Icon: Youtube },
                { href: SOCIAL_VK, label: "VK", Icon: null },
                { href: WHATSAPP_HREF, label: "WhatsApp", Icon: MessageCircle },
                { href: `mailto:${EMAIL}`, label: "Mail", Icon: Mail },
              ].map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                  aria-label={label}
                  title={label}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:border-[var(--ms-accent)]/60 hover:text-[var(--ms-accent)]"
                >
                  {Icon ? <Icon className="h-4 w-4" aria-hidden /> : <span className="text-[11px] font-black">VK</span>}
                </a>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">города</p>
            <p className="mt-3 text-xs leading-relaxed text-white/50">{CITIES.join(" · ")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold text-white/60 transition hover:border-[var(--ms-accent)]/60 hover:text-white">
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
