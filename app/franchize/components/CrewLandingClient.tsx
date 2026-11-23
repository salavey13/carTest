// /app/franchize/components/CrewLandingClient.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Общий лендинг экипажа на верхнем уровне (/renta-car, /motoprokat1,
// /snowmobile-nn, /snegoprokat-nn — task202, апгрейд task204, 2026-11-23).
//
// task204 (босс: «level up all 4 new landings to /moto-selection quality bar,
// add pictures to landings; disable default header/footer like it's disabled
// on moto-selection (investigate layout)»):
//  · Chrome: THEME_CONFIG.crewLandings существовал с task202, но резолвер
//    getThemeForPath про него не знал — монтировались дефолтные BikeHeader/
//    BikeFooter поверх собственных nav/footer лендингов. Исправлено в
//    ClientLayout (проверка crewLandings.paths перед /gift/roman).
//  · Уровень /moto-selection: сплошная акцентная nav, full-screen hero с
//    ken-burns-фото и тройным скримом (гост-типографика поверх резкого фото —
//    рецепт moto-selection:412-448), гост-слова/нумералы за секциями,
//    фото-лента маркизом (все обложки каталога — «add pictures to landings»),
//    GhostWordmark на всю ширину в подвале (тот же компонент, что у
//    moto-selection — гарантированный фит SVG textLength).
//
// Контент data-driven: crews.metadata (branding/palette/contacts/cta/
// contentBlocks) + каталог public.cars через getFranchizeBySlug (memoized,
// emptyCrew при сбое БД — лендинг деградирует в фолбэк, не 500). Серверный
// компонент без "use client": анимации — чистый CSS (<style> + keyframes,
// prefers-reduced-motion гейт), ноль клиентского JS, быстрый LCP.
//
// task206 (босс: «continue polishing landings, adaptivity, content — take a
// look at different subpage franchize links for main menu, header menu,
// footer set of social links — insert subpages applicable; investigate gap vs
// gold standard /moto-selection, apply corrections»):
//  · Nav 6 пунктов как у эталона (moto-selection NAV_LINKS): +Партнёры,
//    +Хранение (подстраница /franchize/{slug}/storage — мото/снегоходным
//    экипажам; у автопроката хранение не услуга).
//  · Mobile nav: якоря горизонтальным скроллом под шапкой (lg:hidden) —
//    бургер не нужен, одностраничник.
//  · Header: Telegram-иконка (бот экипажа) рядом с телефоном — ДНК
//    moto-selection t228 rightside.
//  · Footer 4 колонки: бренд / контакты+соцряд (Telegram-бот, WhatsApp по
//    primary_phone — механика moto-selection WHATSAPP_HREF, менеджер
//    @salavey13) / Разделы (подстраницы витрины: каталог, контакты, стена
//    хранения) / платформа+копирайт. Только реальные каналы — не выдумываем
//    VK/Instagram у экипажей, у которых их нет.
//  · Секция «Сезонное хранение техники» + бренд-тикер (ДНК MsBrandTicker)
//    перед партнёрами.
//
// task205 (босс: «polish landings once more, make working CTAs like
// moto-selection form, make sure everything is properly interlinked via
// "partners" sections on landings; more compressed pictures»):
//  · Working CTA: CrewLeadModal (1:1 механика moto-selection FeedbackModal)
//    → POST /api/franchize/callback-lead: lead в franchize_intents + ботом
//    владельцу экипажа и админу. Триггер — клик-делегация
//    [data-lead-modal-open]: nav «Забронировать», hero «Оставить заявку»,
//    финальный CTA.
//  · Partners-секция: сквозной PartnerLogoGrid (тот же, что на 7 лендингах
//    платформы) — все витрины экосистемы ссылаются друг на друга; карточки
//    зелёных экипажей добавлены в сетки salavey13/moto-selection/mototehnn/
//    georg-electro/leorus (двусторонний линкинг).
//  · Фото перерезаны из raw task203: 1024px/q62 (было 1280/q80), −49%
//    суммарно; лого PNG quantize. Те же пути Storage — URL в БД не менялись.
//
// Контент data-driven: crews.metadata (branding/palette/contacts/cta/
// contentBlocks) + каталог public.cars через getFranchizeBySlug (memoized,
// emptyCrew при сбое БД — лендинг деградирует в фолбэк, не 500). Серверный
// компонент: анимации — чистый CSS (<style> + keyframes,
// prefers-reduced-motion гейт); единственный клиентский кусок — CrewLeadModal.
//
// CTA-тройка в каждом блоке:
//  · «Оставить заявку» → CrewLeadModal → CRM экипажа (working CTA);
//  · «Открыть каталог» → /franchize/<slug> — веб-витрина с корзиной;
//  · «Забронировать в Telegram» → t.me/<bot>/app?startapp=crew_<slug> —
//    fast path crew_<slug> до auth-гейта (use-start-param-target.ts:321).
// ─────────────────────────────────────────────────────────────────────────────

import type { FranchizeBySlugResult } from "@/app/franchize/actions-runtime";
import type { CatalogItemVM } from "@/app/franchize/actions-runtime";
import { withAlpha } from "@/app/franchize/lib/theme";
import { GhostWordmark } from "@/components/landings/GhostWordmark";
import PartnerLogoGrid, {
  type PartnerLogoItem,
} from "@/components/landing/PartnerLogoGrid";
import CrewLeadModal from "./CrewLeadModal";
import { ArrowRight, Check, Clock3, MapPin, MessageCircle, Phone, Send } from "lucide-react";

const FALLBACK_PALETTE = {
  bgBase: "#0B1220",
  bgCard: "#121A2A",
  accentMain: "#2F6FED",
  accentMainHover: "#4C82F2",
  textPrimary: "#E7ECF5",
  textSecondary: "#93A1B8",
  borderSoft: "#22304A",
};

const DEFAULT_BOT = "oneBikePlsBot";

// Сквозной реестр витрин платформы для partners-секций (task205; босс:
// «properly interlinked via partners sections»). Лого — как в сетках
// salavey13/moto-selection: зелёные — about/{slug}-logo.png (Storage),
// moto-selection — tildacdn, sly13 — carpix/sly13_logo.jpg, остальные —
// /logos/*.png из public. Тэглайны — формулировки из существующих сеток.
const CREW_PARTNERS: PartnerLogoItem[] = [
  {
    href: "/salavey13",
    title: "SLY13",
    tagline: "платформа франшиз проката — витрина партнёров на одном софте",
    logoSrc:
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/sly13_logo.jpg",
  },
  {
    href: "/moto-selection",
    title: "Moto.Selection",
    tagline: "мотосервис — обучение, подбор мото, ТО, детейлинг, хранение 24/7",
    logoSrc:
      "https://static.tildacdn.com/tild6335-3266-4164-b461-363834666561/__.png",
  },
  {
    href: "/renta-car",
    title: "Рента-Кар НН",
    tagline: "автопрокат в Нижнем — подача бесплатно, круглосуточно",
    logoSrc:
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/renta-car-logo.png",
    // Лого зелёных — тёмный арт на прозрачном PNG: на светлой подложке
    // (паттерн moto-selection/mototehnn карточек) читаются, на тёмной гаснут.
    backing: "#eef1f6",
    lightBacking: true,
  },
  {
    href: "/motoprokat1",
    title: "МотоПрокат1",
    tagline: "мотопрокат — от BMW до Ducati, бронь в Telegram",
    logoSrc:
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/motoprokat1-logo.png",
    backing: "#eef1f6",
    lightBacking: true,
  },
  {
    href: "/snowmobile-nn",
    title: "Snowmobile NN",
    tagline: "снегоходы — катания и обучение, бронь в Telegram",
    logoSrc:
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/snowmobile-nn-logo.png",
    backing: "#eef1f6",
    lightBacking: true,
  },
  {
    href: "/snegoprokat-nn",
    title: "СнегоПрокат НН",
    tagline: "снегоходы — одиночные и тандемные катания",
    logoSrc:
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/snegoprokat-nn-logo.png",
    backing: "#eef1f6",
    lightBacking: true,
  },
  {
    href: "/mototehnn",
    title: "МотоТех НН",
    tagline: "мотосалон — техника, 10 000+ запчастей, мотосервис, хранение и эвакуация",
    logoSrc: "/logos/mototehnn-logo.png",
  },
  {
    href: "/georg-electro",
    title: "georg-electro",
    tagline: "электрик электробайков — диагностика, контроллеры, проводка, свет",
    logoSrc: "/logos/georg-electro-logo.png",
  },
  {
    href: "/leorus",
    title: "LEORUS · djorudjov",
    tagline: "ивент-агентство — фестивали под ключ, DJ и шоу-программы, видео",
    logoSrc: "/logos/leorus-logo.png",
  },
  {
    href: "/vipbikerental",
    title: "VIP BIKE Rental",
    tagline: "аренда электромото в Нижнем Новгороде — флагман платформы",
    logoSrc: "/leorus/partner-vipbike.png",
  },
  // task207: демо-вертикаль «аренда квартир» — та же цепочка
  // каталог→бронь→договор работает за пределами техники.
  {
    href: "/renta-flat",
    title: "Рента-Флэт НН",
    tagline: "аренда квартир посуточно — демо-вертикаль за пределы техники",
    logoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/renta-flat-logo.png",
  },
];

/** Подписной контент экипажа, который нельзя вытащить из crews.metadata. */
export interface CrewLandingCopy {
  /** Строка-надстройка над теглайном (позиционирование платформы). */
  hookLine: string;
  /** Платформенные пункты «что добавляет платформа» (без приватных цифр). */
  features: string[];
  /** id позиции для hero-фона («лицо витрины»). Не задан — первый с фото. */
  heroItemId?: string;
}

export interface CrewLandingFallback {
  slug: string;
  name: string;
  city: string;
  phone: string;
  tagline: string;
}

interface CrewLandingClientProps {
  crew: FranchizeBySlugResult["crew"] | null;
  items: CatalogItemVM[];
  copy: CrewLandingCopy;
  fallback: CrewLandingFallback;
}

const fmtRub = (value: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);

/** Русское склонение: pluralRu(3, ["позиция", "позиции", "позиций"]) → «позиции». */
const pluralRu = (n: number, forms: [string, string, string]) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
};

const priceLabel = (item: CatalogItemVM) => {
  const label = (item.rentPriceLabel || "").trim();
  // Позиции без верифицированной цены рантайм метит «0 ₽ / день» (daily_price
  // NULL). На лендинге показываем честную фразу из пича — не «0 ₽».
  const zeroish = item.pricePerDay <= 0 && /^0[\s\xA0]?₽/.test(label);
  if (label && !zeroish) return label;
  if (item.pricePerDay > 0) return label || `от ${fmtRub(item.pricePerDay)} ₽/сут`;
  return "Цена по тарифной сетке";
};

/** Гост-слово за контентом — ДНК moto-selection (rec499421781): 250px-текст
    в цвет карточки, контент читается поверх, секция overflow-hidden. */
const GhostWord = ({
  word,
  pal,
  className = "",
}: {
  word: string;
  pal: typeof FALLBACK_PALETTE;
  className?: string;
}) => (
  <span
    aria-hidden
    className={`pointer-events-none absolute -top-2 left-0 select-none whitespace-nowrap font-black uppercase leading-none tracking-tight ${className}`}
    style={{
      fontSize: "clamp(96px, 17vw, 230px)",
      color: withAlpha(pal.textPrimary, 0.045),
    }}
  >
    {word}
  </span>
);

export default function CrewLandingClient({
  crew,
  items,
  copy,
  fallback,
}: CrewLandingClientProps) {
  const isLive = Boolean(crew?.id);
  // Брендинг из metadata.franchize.header (brandName/tagline) приоритетнее
  // «сырых» crews.name/description — там лежат фразы из hydration SQL.
  const name =
    (isLive && (crew!.header?.brandName || crew!.name)) || fallback.name;
  const slug = isLive ? crew!.slug || fallback.slug : fallback.slug;
  const tagline =
    (isLive && (crew!.header?.tagline || crew!.description?.trim())) ||
    fallback.tagline;
  const city =
    (isLive && (crew!.contacts?.address || crew!.hqLocation)) || fallback.city;
  const phone =
    (isLive && crew!.contacts?.phone) || fallback.phone;
  const workingHours =
    (isLive && crew!.contacts?.workingHours) || "";
  const botUsername =
    (isLive && crew!.contacts?.telegramBotUsername) || DEFAULT_BOT;
  const cta = isLive && crew!.cta?.buttonHref ? crew!.cta : null;
  const checklist = isLive
    ? (crew!.contentBlocks?.onboardingChecklist ?? []).slice(0, 4)
    : [];
  const logoUrl = isLive ? crew!.logoUrl || "" : "";

  const pal = (isLive && crew!.theme?.palette) || FALLBACK_PALETTE;
  const accentSoft = withAlpha(pal.accentMain, 0.14);
  const accentBorder = withAlpha(pal.accentMain, 0.38);

  const deeplink = `https://t.me/${botUsername}/app?startapp=crew_${slug}`;
  const vitrineHref = `/franchize/${slug}`;
  // task207: подстраницы витрины (босс: «add more links to crew main menus
  // for franchize subpages»). Все URL проверены 200 на проде 2026-11-23:
  // /{slug}, /about, /community, /configurator, /equipment, /wheel, /parts,
  // /contacts, /storage, /season-stats, /calc-explainer. В nav — суть
  // арендного бизнеса (каталог/хранение/платформа/партнёры/контакты),
  // в footer «Разделы» — расширенный набор. task206: /contacts, /storage
  // (стена хранения; deeplink storage_<slug> маршрутизируется
  // use-start-param-target.ts:321).
  const subpage = (p: string) => `/franchize/${slug}${p ? `/${p}` : ""}`;
  const contactsHref = subpage("contacts");
  const storageHref = subpage("storage");
  const storageDeep = `https://t.me/${botUsername}/app?startapp=storage_${slug}`;
  // Соцряд — только из реальных данных экипажа (WhatsApp механика по
  // primary_phone, как у moto-selection WHATSAPP_HREF = wa.me/<digits>).
  const phoneDigits = phone.replace(/\D/g, "");
  const whatsappHref = `https://wa.me/${phoneDigits}`;
  // Хранение — услуга мото/снегоходных экипажей (сезонная техника); у
  // автопроката не услуга, пункты nav/footer для него не рисуем.
  const storageEnabled = ["motoprokat1", "snowmobile-nn", "snegoprokat-nn"].includes(slug);

  const catalog = (items ?? []).filter((i) => i.title);
  const showcase = catalog.slice(0, 12);
  // Hero — «лицо витрины»: copy.heroItemId (явный выбор экипажа) или первая
  // позиция с фото. Числовой «флагман» не работает у зелёных экипажей: цены
  // в БД сознательно не выставлены (price_note «Цена по тарифной сетке»,
  // task200) — все daily_price NULL, лейблы «0 ₽ / день».
  const heroItem =
    (copy.heroItemId && catalog.find((i) => i.id === copy.heroItemId && i.imageUrl)) ||
    catalog.find((i) => i.imageUrl) ||
    catalog[0];
  const heroImage = heroItem?.imageUrl || "";
  // Лента — все обложки каталога (дублируем для бесшовного цикла).
  const stripPhotos = catalog
    .map((i) => ({ src: i.imageUrl, alt: i.title }))
    .filter((p) => p.src);

  const steps =
    checklist.length > 0
      ? checklist.map((b) => ({ title: b.title, text: b.text }))
      : [
          { title: "Выберите позицию", text: "Каталог с ценами и описанием — выбор без звонков." },
          { title: "Оставьте бронь", text: "Даты и детали собираются в Telegram-боте экипажа." },
          { title: "Документы за минуту", text: "Договор и залог генерируются автоматически, выдача по QR." },
        ];

  const stats: Array<{ value: string; label: string }> = [
    {
      value: `${catalog.length || "—"}`,
      label: `${pluralRu(catalog.length || 0, ["позиция", "позиции", "позиций"])} в каталоге`,
    },
    { value: "1 мин", label: "договор и залог — автогенерация docx" },
    {
      value: workingHours ? "24/7" : "онлайн",
      label: workingHours || "заявки с сайта и из Telegram — в один поток",
    },
  ];

  // Порядок и состав как у эталона (moto-selection NAV_LINKS: 6 пунктов).
  const navLinks = [
    { href: "#catalog", label: "Каталог" },
    { href: "#how", label: "Как проходит аренда" },
    ...(storageEnabled ? [{ href: subpage("storage"), label: "Хранение" }] : []),
    { href: "#platform", label: "Платформа" },
    { href: "#partners", label: "Партнёры" },
    { href: "#contacts", label: "Контакты" },
  ];

  // Working CTA (task205) — открывает CrewLeadModal → /api/franchize/
  // callback-lead → franchize_intents + ботом владельцу и админу.
  const leadBtn = (label: string) => (
    <button
      type="button"
      data-lead-modal-open
      className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
      style={{ backgroundColor: pal.accentMain, color: pal.bgBase }}
    >
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </button>
  );

  const vitrineBtn = (label: string) => (
    <a
      href={vitrineHref}
      className="inline-flex items-center gap-2 rounded-xl border px-6 py-3.5 text-sm font-bold backdrop-blur-sm transition-colors hover:bg-white/5"
      style={{
        borderColor: withAlpha(pal.textPrimary, 0.35),
        color: pal.textPrimary,
        backgroundColor: withAlpha(pal.bgBase, 0.35),
      }}
    >
      {label}
    </a>
  );

  const tgBtn = (label: string, strong = false) => (
    <a
      href={deeplink}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-xl border px-6 py-3.5 text-sm font-bold backdrop-blur-sm transition-colors hover:bg-white/5"
      style={{
        borderColor: strong ? accentBorder : withAlpha(pal.textPrimary, 0.35),
        color: pal.textPrimary,
        backgroundColor: strong ? "transparent" : withAlpha(pal.bgBase, 0.35),
      }}
    >
      <Send className="h-4 w-4" style={{ color: pal.accentMain }} aria-hidden />
      {label}
    </a>
  );

  return (
    <main
      className="min-h-screen overflow-x-clip"
      style={{ backgroundColor: pal.bgBase, color: pal.textPrimary }}
    >
      {/* Ken-burns + маркиз: чистый CSS, гейт reduced-motion — рецепт
          moto-selection (ms-kenburns 26s / ms-marquee-track). */}
      <style>{`
        @keyframes crewKenburns {
          0% { transform: scale(1) translateX(0); }
          100% { transform: scale(1.08) translateX(-1.5%); }
        }
        @keyframes crewMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .crew-kenburns, .crew-marquee-track { animation: none !important; }
        }
      `}</style>

      {/* ── NAV ── ДНК moto-selection:357: сплошная АКЦЕНТНАЯ полоса с
          логотипом экипажа (carpix/about, task203) и белыми ссылками. */}
      <header className="sticky top-0 z-40" style={{ backgroundColor: pal.accentMain }}>
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <a href="#top" className="flex min-w-0 items-center gap-2.5">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-9 w-9 shrink-0 rounded-lg bg-white/90 object-contain p-1"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-sm font-black text-white">
                {name.slice(0, 1)}
              </span>
            )}
            <span className="truncate text-sm font-black uppercase tracking-[0.12em] text-white">
              {name}
            </span>
          </a>
          <nav aria-label="Основная навигация" className="mx-auto hidden items-center gap-6 lg:flex">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-xs font-semibold uppercase tracking-[0.14em] text-white/85 transition hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 lg:ml-0">
            {/* соцряд в шапке — ДНК moto-selection (t228 rightside: Telegram +
                телефон): Telegram-бот экипажа иконкой, телефон текстом */}
            <a
              href={deeplink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram-бот экипажа"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/30 text-white transition hover:bg-white/15"
            >
              <Send className="h-4 w-4" aria-hidden />
            </a>
            <a
              href={`tel:${phoneDigits}`}
              className="hidden items-center gap-1.5 text-sm font-bold text-white transition hover:opacity-90 sm:inline-flex"
            >
              <Phone className="h-4 w-4 text-black/60" aria-hidden />
              {phone}
            </a>
            <button
              type="button"
              data-lead-modal-open
              className="inline-flex h-10 items-center rounded-full bg-white px-4 text-xs font-black uppercase tracking-[0.1em] transition hover:brightness-95 active:scale-95"
              style={{ color: pal.bgBase }}
            >
              Забронировать
            </button>
          </div>
        </div>
        {/* mobile nav (task206): якоря горизонтальным скроллом под шапкой —
            одностраничник, бургер не нужен; скрыт скроллбар, тап без зацепов */}
        <nav
          aria-label="Мобильная навигация"
          className="flex items-center gap-5 overflow-x-auto px-4 pb-2.5 pt-1.5 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ borderTop: "1px solid rgba(255,255,255,0.22)" }}
        >
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85 transition hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>
      </header>

      {/* ── HERO ── ДНК moto-selection:413: min-h-[92svh], ken-burns фото,
          три скрима (чёрная подушка под типографику слева, акцентный
          радиальный глушитель справа, нижний фейд в bgBase). */}
      <section id="top" className="relative flex min-h-[88svh] items-end overflow-hidden sm:items-center">
        <div className="absolute inset-0" aria-hidden>
          {heroImage ? (
            <div
              className="crew-kenburns absolute inset-0 will-change-transform"
              style={{ animation: "crewKenburns 26s ease-in-out infinite alternate" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImage}
                alt=""
                className="h-full w-full object-cover object-center"
              />
            </div>
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(80% 80% at 70% 20%, ${accentSoft} 0%, transparent 60%), ${pal.bgBase}`,
              }}
            />
          )}
          {/* скрим 1: подушка под типографику. task207: усилен контраст
              заголовка — на светлых фото (белые авто, светлые интерьеры
              квартир) старая кривая (0.82→0.28 на 34%→62%) оставляла
              правый край H1/подзаголовка на почти чистом фото. Теперь
              непрозрачность держится до 55% и гасится только к правому
              краю, поверх — читабельная тень для гарантированного
              separation от белых объектов. */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(100deg, ${withAlpha(pal.bgBase, 0.96)} 0%, ${withAlpha(pal.bgBase, 0.9)} 40%, ${withAlpha(pal.bgBase, 0.55)} 62%, ${withAlpha(pal.bgBase, 0.42)} 100%)`,
            }}
          />
          {/* скрим 2: акцентный радиальный глушитель */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(58% 68% at 78% 30%, ${withAlpha(pal.accentMain, 0.22)} 0%, transparent 70%)`,
            }}
          />
          {/* скрим 3: нижний фейд в фон */}
          <div
            className="absolute inset-x-0 bottom-0 h-48"
            style={{ background: `linear-gradient(to bottom, transparent, ${pal.bgBase})` }}
          />
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-24 sm:px-6 md:pb-24">
          <p
            className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.18em]"
            style={{ borderColor: accentBorder, color: pal.accentMain, backgroundColor: withAlpha(pal.bgBase, 0.55) }}
          >
            Витрина на платформе SLY13
          </p>
          {/* task207: текст-тень (0/60% blur 18) — гарантированный separation
              светлой типографики от белых объектов фото при любом паттерне
              скрима; дублирует подход эталона (moto-selection H1). */}
          <h1
            className="mt-5 max-w-4xl text-5xl font-black leading-[1.02] tracking-tight [text-shadow:0_2px_18px_rgba(0,0,0,0.6)] sm:text-6xl md:text-7xl"
          >
            {name}
          </h1>
          <p className="mt-5 max-w-2xl text-xl font-medium leading-relaxed text-white/95 [text-shadow:0_1px_12px_rgba(0,0,0,0.5)] md:text-2xl">
            {tagline}
          </p>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/80 [text-shadow:0_1px_8px_rgba(0,0,0,0.45)]">
            {copy.hookLine}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm backdrop-blur-sm"
              style={{ borderColor: withAlpha(pal.textPrimary, 0.28), color: pal.textSecondary, backgroundColor: withAlpha(pal.bgBase, 0.45) }}
            >
              <MapPin className="h-4 w-4" aria-hidden />
              {city}
            </span>
            {workingHours && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm backdrop-blur-sm"
                style={{ borderColor: withAlpha(pal.textPrimary, 0.28), color: pal.textSecondary, backgroundColor: withAlpha(pal.bgBase, 0.45) }}
              >
                <Clock3 className="h-4 w-4" aria-hidden />
                {workingHours}
              </span>
            )}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {leadBtn("Оставить заявку")}
            {vitrineBtn("Открыть каталог")}
            {tgBtn("Забронировать в Telegram")}
          </div>

          {/* stats-полоса */}
          <dl className="mt-12 grid max-w-3xl grid-cols-3 gap-4 border-t pt-6" style={{ borderColor: withAlpha(pal.textPrimary, 0.16) }}>
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="text-2xl font-black tracking-tight [text-shadow:0_1px_12px_rgba(0,0,0,0.55)] md:text-3xl">{s.value}</dt>
                <dd className="mt-1 text-xs leading-snug text-white/75 [text-shadow:0_1px_8px_rgba(0,0,0,0.5)] md:text-sm">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── КАТАЛОГ ── гост-слово «каталог» за гридом, все обложки (task203
          залил carpix-фото 29 позиций — карточки теперь с картинками). */}
      {isLive && showcase.length > 0 && (
        <section id="catalog" className="relative scroll-mt-20 overflow-hidden px-4 py-16 sm:px-6 sm:py-24">
          <GhostWord word="каталог" pal={pal} />
          <div className="relative mx-auto w-full max-w-7xl">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-3xl font-black tracking-tight md:text-5xl">Каталог</h2>
              <span className="text-sm font-medium" style={{ color: pal.textSecondary }}>
                {catalog.length} {pluralRu(catalog.length, ["позиция", "позиции", "позиций"])} · цены на витрине
              </span>
            </div>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {showcase.map((item) => (
                <a
                  key={item.id}
                  href={vitrineHref}
                  className="group overflow-hidden rounded-2xl border transition-transform hover:-translate-y-1"
                  style={{
                    backgroundColor: pal.bgCard,
                    borderColor: pal.borderSoft,
                  }}
                >
                  <div
                    className="relative aspect-[16/10] w-full overflow-hidden"
                    style={{ backgroundColor: accentSoft }}
                  >
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                      />
                    ) : (
                      <span
                        className="absolute inset-0 flex items-center justify-center text-6xl font-black"
                        style={{ color: withAlpha(pal.accentMain, 0.5) }}
                      >
                        {(item.category || item.title).slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    {item.category && (
                      <span
                        className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold backdrop-blur-sm"
                        style={{ backgroundColor: withAlpha(pal.bgBase, 0.72), color: pal.textPrimary }}
                      >
                        {item.category}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="truncate text-base font-bold">{item.title}</h3>
                      <span className="whitespace-nowrap text-sm font-black" style={{ color: pal.accentMain }}>
                        {priceLabel(item)}
                      </span>
                    </div>
                    {item.subtitle?.trim() && (
                      <p className="mt-1 truncate text-sm" style={{ color: pal.textSecondary }}>
                        {item.subtitle}
                      </p>
                    )}
                    <p
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold"
                      style={{
                        color:
                          item.availabilityStatus === "available"
                            ? pal.accentMain
                            : pal.textSecondary,
                      }}
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor:
                            item.availabilityStatus === "available"
                              ? pal.accentMain
                              : pal.textSecondary,
                        }}
                      />
                      {item.availabilityLabel || "Каталог экипажа"}
                    </p>
                  </div>
                </a>
              ))}
            </div>
            <div className="mt-8">
              <a
                href={vitrineHref}
                className="inline-flex items-center gap-2 text-sm font-bold hover:underline"
                style={{ color: pal.accentMain }}
              >
                Смотреть весь каталог на витрине
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ── ФОТО-ЛЕНТА ── «add pictures to landings»: маркиз всех обложек
          каталога, бесшовный цикл (дубль трека), декоративная. */}
      {stripPhotos.length > 1 && (
        <section
          className="overflow-hidden border-y py-6"
          aria-hidden
          style={{ borderColor: pal.borderSoft, backgroundColor: pal.bgCard }}
        >
          <div
            className="crew-marquee-track flex w-max gap-4 px-4"
            style={{ animation: "crewMarquee 46s linear infinite" }}
          >
            {[...stripPhotos, ...stripPhotos].map((p, idx) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${p.src}-${idx}`}
                src={p.src!}
                alt=""
                loading="lazy"
                className="h-40 w-72 shrink-0 rounded-xl object-cover md:h-48 md:w-80"
                style={{ border: `1px solid ${pal.borderSoft}` }}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── КАК ПРОХОДИТ АРЕНДА ── гост-слово «аренда», шаги из
          contentBlocks.onboardingChecklist (или дефолт). */}
      <section id="how" className="relative scroll-mt-20 overflow-hidden border-b px-4 py-16 sm:px-6 sm:py-24" style={{ borderColor: pal.borderSoft }}>
        <GhostWord word="аренда" pal={pal} />
        <div className="relative mx-auto w-full max-w-7xl">
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">Как проходит аренда</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {steps.map((step, idx) => (
              <div
                key={step.title}
                className="rounded-2xl border p-6"
                style={{ backgroundColor: pal.bgCard, borderColor: pal.borderSoft }}
              >
                <span className="text-sm font-black tracking-[0.2em]" style={{ color: pal.accentMain }}>
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-lg font-bold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: pal.textSecondary }}>
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ЧТО ДОБАВЛЯЕТ ПЛАТФОРМА ── гост-слово «платформа». */}
      <section id="platform" className="relative scroll-mt-20 overflow-hidden px-4 py-16 sm:px-6 sm:py-24">
        <GhostWord word="платформа" pal={pal} />
        <div className="relative mx-auto w-full max-w-7xl">
          <div
            className="rounded-3xl border p-6 md:p-10"
            style={{ backgroundColor: pal.bgCard, borderColor: accentBorder }}
          >
            <h2 className="max-w-2xl text-3xl font-black tracking-tight md:text-5xl">
              Что добавляет платформа SLY13
            </h2>
            <ul className="mt-8 grid gap-4 md:grid-cols-2">
              {copy.features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm leading-relaxed md:text-base">
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: accentSoft }}
                  >
                    <Check className="h-3.5 w-3.5" style={{ color: pal.accentMain }} aria-hidden />
                  </span>
                  <span style={{ color: pal.textSecondary }}>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div
          className="rounded-3xl border p-8 text-center md:p-14"
          style={{
            backgroundColor: accentSoft,
            borderColor: accentBorder,
          }}
        >
          <h2 className="mx-auto max-w-3xl text-3xl font-black tracking-tight md:text-5xl">
            {cta?.title || "Выбрать и забронировать"}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed md:text-lg" style={{ color: pal.textSecondary }}>
            {cta?.description ||
              "Откройте каталог, выберите позицию, даты и формат — бронь фиксируется в Telegram-боте экипажа."}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {leadBtn("Оставить заявку")}
            {vitrineBtn(cta?.buttonLabel || "Открыть каталог")}
            {tgBtn("Забронировать в Telegram", true)}
          </div>
        </div>
      </section>

      {/* ── ХРАНЕНИЕ ── подстраница витрины (task206): стена хранения
          /franchize/{slug}/storage + deeplink storage_<slug> (fast path до
          auth-гейта). Только мото/снегоходные экипажи — у автопроката
          хранение не услуга. */}
      {storageEnabled && (
        <section
          id="storage"
          className="relative scroll-mt-20 overflow-hidden border-t px-4 py-16 sm:px-6 sm:py-20"
          style={{ borderColor: pal.borderSoft }}
        >
          <GhostWord word="хранение" pal={pal} />
          <div className="relative mx-auto w-full max-w-7xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: pal.accentMain }}>
              Межсезонье
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight md:text-5xl">
              Сезонное хранение техники
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed md:text-base" style={{ color: pal.textSecondary }}>
              Каждая единица на хранении — юнит в витрине экипажа: статус, фото и история обслуживания. Запись на консервацию и выдачу — в один тап: на стене хранения или в Telegram-боте.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {vitrineBtn("Стена хранения")}
              <a
                href={storageDeep}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border px-6 py-3.5 text-sm font-bold backdrop-blur-sm transition-colors hover:bg-white/5"
                style={{
                  borderColor: accentBorder,
                  color: pal.textPrimary,
                }}
              >
                <Send className="h-4 w-4" style={{ color: pal.accentMain }} aria-hidden />
                Хранение в Telegram
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ── БРЕНД-ТИКЕР ── ДНК moto-selection (MsBrandTicker): акцентная
          бегущая строка перед партнёрами; CSS marquee уже заведён. */}
      <div
        aria-hidden
        className="overflow-hidden border-t py-3"
        style={{ backgroundColor: pal.accentMain, borderColor: pal.borderSoft }}
      >
        <div
          className="crew-marquee-track flex w-max items-center gap-10 whitespace-nowrap pr-10"
          style={{ animation: "crewMarquee 22s linear infinite" }}
        >
          {Array.from({ length: 16 }, (_, i) => (
            <span
              key={i}
              className="flex items-center gap-10 text-sm font-black uppercase tracking-[0.28em] text-white"
            >
              {name}
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/70" />
              SLY13 PLATFORM
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/70" />
            </span>
          ))}
        </div>
      </div>

      {/* ── ПАРТНЁРЫ ── сквозной PartnerLogoGrid (task205): все витрины
          экосистемы ссылаются друг на друга — лого в покое, название+
          тэглайн на hover/долгом тапе. Сам экипаж из сетки убран. */}
      <section id="partners" className="relative scroll-mt-20 border-t px-4 py-16 sm:px-6 sm:py-20" style={{ borderColor: pal.borderSoft }}>
        <div className="mx-auto w-full max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: pal.accentMain }}>
            Экосистема SLY13
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight md:text-5xl">
            Витрины партнёров платформы
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed md:text-base" style={{ color: pal.textSecondary }}>
            Разные ниши — один движок: прокат, мотосервис, салон, электрик, ивенты. Каждый экипаж получает собственный бренд, каталог и бота.
          </p>
          <div className="mt-8">
            <PartnerLogoGrid
              partners={CREW_PARTNERS.filter((p) => p.href !== `/${slug}`)}
              accent={pal.accentMain}
              columns={5}
              ariaLabel="Витрины партнёров платформы SLY13"
            />
          </div>
        </div>
      </section>

      {/* ── FOOTER + GhostWordmark ── бренд-вордмарк на всю ширину (тот же
          компонент, что у moto-selection — SVG textLength гарантирует фит). */}
      <footer id="contacts" className="border-t" style={{ borderColor: pal.borderSoft }}>
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="flex items-center gap-2.5 text-base font-black">
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg bg-white/90 object-contain p-0.5" />
              )}
              {name}
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed" style={{ color: pal.textSecondary }}>
              {tagline}
            </p>
          </div>
          <div className="space-y-2.5 text-sm" style={{ color: pal.textSecondary }}>
            <p className="inline-flex items-center gap-2">
              <Phone className="h-4 w-4" aria-hidden />
              <a href={`tel:${phoneDigits}`} className="font-semibold hover:underline" style={{ color: pal.textPrimary }}>
                {phone}
              </a>
            </p>
            <p className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4" aria-hidden />
              {city}
            </p>
            {workingHours && (
              <p className="inline-flex items-center gap-2">
                <Clock3 className="h-4 w-4" aria-hidden />
                {workingHours}
              </p>
            )}
            {/* соцряд (task206) — ДНК moto-selection footer: только реальные
                каналы экипажа — бот, WhatsApp по номеру, менеджер */}
            <div className="flex items-center gap-2.5 pt-1">
              <a
                href={deeplink}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram-бот экипажа"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border transition hover:bg-white/5"
                style={{ borderColor: pal.borderSoft, color: pal.accentMain }}
              >
                <Send className="h-4 w-4" aria-hidden />
              </a>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border transition hover:bg-white/5"
                style={{ borderColor: pal.borderSoft, color: pal.accentMain }}
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
              </a>
              <span className="text-xs" style={{ color: pal.textSecondary }}>
                менеджер · {isLive ? "@salavey13" : ""}
              </span>
            </div>
          </div>
          {/* Разделы (task207) — расширенный набор подстраниц витрины
              (все 200 на проде): каталог, запчасти, о экипаже, хранение,
              комьюнити, сезонная статистика, контакты, партнёры. */}
          <div className="text-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: pal.textSecondary }}>
              Разделы
            </p>
            <ul className="mt-3 space-y-2">
              <li>
                <a href={vitrineHref} className="font-semibold hover:underline" style={{ color: pal.textPrimary }}>
                  Каталог витрины
                </a>
              </li>
              {storageEnabled && (
                <li>
                  <a href={subpage("storage")} className="font-semibold hover:underline" style={{ color: pal.textPrimary }}>
                    Стена хранения
                  </a>
                </li>
              )}
              <li>
                <a href={subpage("parts")} className="font-semibold hover:underline" style={{ color: pal.textPrimary }}>
                  Запчасти и шины
                </a>
              </li>
              <li>
                <a href={subpage("about")} className="font-semibold hover:underline" style={{ color: pal.textPrimary }}>
                  Об экипаже
                </a>
              </li>
              <li>
                <a href={subpage("community")} className="font-semibold hover:underline" style={{ color: pal.textPrimary }}>
                  Комьюнити
                </a>
              </li>
              <li>
                <a href={subpage("season-stats")} className="font-semibold hover:underline" style={{ color: pal.textPrimary }}>
                  Сезонная статистика
                </a>
              </li>
              <li>
                <a href={contactsHref} className="font-semibold hover:underline" style={{ color: pal.textPrimary }}>
                  Контакты
                </a>
              </li>
              <li>
                <a href="#partners" className="font-semibold hover:underline" style={{ color: pal.textPrimary }}>
                  Партнёры платформы
                </a>
              </li>
            </ul>
          </div>
          <div className="text-sm lg:text-right" style={{ color: pal.textSecondary }}>
            <p>
              Работает на платформе{" "}
              <a
                href="https://t.me/oneSitePlsBot"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold hover:underline"
                style={{ color: pal.accentMain }}
              >
                SLY13
              </a>{" "}
              · @SALAVEY13
            </p>
            <p className="mt-2">© {new Date().getFullYear()} {name}</p>
          </div>
        </div>
        <div className="pb-6">
          <GhostWordmark
            parts={[
              { text: name.toUpperCase(), color: pal.textPrimary, opacity: 0.07 },
            ]}
            className="px-2"
          />
        </div>
      </footer>

      {/* Working CTA-форма (task205) — открытие по [data-lead-modal-open]. */}
      <CrewLeadModal
        slug={slug}
        name={name}
        accent={pal.accentMain}
        accentSoft={pal.accentMainHover}
      />
    </main>
  );
}
