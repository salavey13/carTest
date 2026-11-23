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
// CTA-пара в каждом блоке:
//  · «Открыть каталог» → /franchize/<slug> — веб-витрина с корзиной;
//  · «Забронировать в Telegram» → t.me/<bot>/app?startapp=crew_<slug> —
//    fast path crew_<slug> до auth-гейта (use-start-param-target.ts:321).
// ─────────────────────────────────────────────────────────────────────────────

import type { FranchizeBySlugResult } from "@/app/franchize/actions-runtime";
import type { CatalogItemVM } from "@/app/franchize/actions-runtime";
import { withAlpha } from "@/app/franchize/lib/theme";
import { GhostWordmark } from "@/components/landings/GhostWordmark";
import { ArrowRight, Check, Clock3, MapPin, Phone, Send } from "lucide-react";

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

/** Подписной контент экипажа, который нельзя вытащить из crews.metadata. */
export interface CrewLandingCopy {
  /** Строка-надстройка над теглайном (позиционирование платформы). */
  hookLine: string;
  /** Платформенные пункты «что добавляет платформа» (без приватных цифр). */
  features: string[];
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

  const catalog = (items ?? []).filter((i) => i.title);
  const showcase = catalog.slice(0, 12);
  // Hero — флагман каталога: фото самой дорогой позиции. У зелёных экипажей
  // daily_price NULL (цены текстом в specs.rent_price_label, task200), поэтому
  // парсим первое число из лейбла; нечисловая цена = 0. Первый по списку был
  // задком дешёвой Гранты — не лицо витрины.
  const heroPrice = (i: CatalogItemVM) => {
    if (i.pricePerDay > 0) return i.pricePerDay;
    const m = (i.rentPriceLabel || "").match(/\d[\d\s\xA0]{2,}/);
    return m ? parseInt(m[0].replace(/[\s\xA0]/g, ""), 10) || 0 : 0;
  };
  const heroItem =
    [...catalog]
      .filter((i) => i.imageUrl)
      .sort((a, b) => heroPrice(b) - heroPrice(a))[0] ||
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

  const navLinks = [
    { href: "#catalog", label: "Каталог" },
    { href: "#how", label: "Как проходит аренда" },
    { href: "#platform", label: "Платформа" },
    { href: "#contacts", label: "Контакты" },
  ];

  const primaryBtn = (label: string) => (
    <a
      href={vitrineHref}
      className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
      style={{ backgroundColor: pal.accentMain, color: pal.bgBase }}
    >
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden />
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
            <a
              href={`tel:${phone.replace(/[^+\d]/g, "")}`}
              className="hidden items-center gap-1.5 text-sm font-bold text-white transition hover:opacity-90 sm:inline-flex"
            >
              <Phone className="h-4 w-4 text-black/60" aria-hidden />
              {phone}
            </a>
            <a
              href={deeplink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center rounded-full bg-white px-4 text-xs font-black uppercase tracking-[0.1em] transition hover:brightness-95 active:scale-95"
              style={{ color: pal.bgBase }}
            >
              Забронировать
            </a>
          </div>
        </div>
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
          {/* скрим 1: подушка под типографику */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(100deg, ${withAlpha(pal.bgBase, 0.94)} 0%, ${withAlpha(pal.bgBase, 0.82)} 34%, ${withAlpha(pal.bgBase, 0.28)} 62%, ${withAlpha(pal.bgBase, 0.5)} 100%)`,
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
          <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl md:text-7xl">
            {name}
          </h1>
          <p className="mt-5 max-w-2xl text-xl font-medium leading-relaxed text-white/90 md:text-2xl">
            {tagline}
          </p>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/70">
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
            {primaryBtn("Открыть каталог")}
            {tgBtn("Забронировать в Telegram")}
          </div>

          {/* stats-полоса */}
          <dl className="mt-12 grid max-w-3xl grid-cols-3 gap-4 border-t pt-6" style={{ borderColor: withAlpha(pal.textPrimary, 0.16) }}>
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="text-2xl font-black tracking-tight md:text-3xl">{s.value}</dt>
                <dd className="mt-1 text-xs leading-snug text-white/60 md:text-sm">{s.label}</dd>
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
            {primaryBtn(cta?.buttonLabel || "Открыть каталог")}
            {tgBtn("Забронировать в Telegram", true)}
          </div>
        </div>
      </section>

      {/* ── FOOTER + GhostWordmark ── бренд-вордмарк на всю ширину (тот же
          компонент, что у moto-selection — SVG textLength гарантирует фит). */}
      <footer id="contacts" className="border-t" style={{ borderColor: pal.borderSoft }}>
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
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
              <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="font-semibold hover:underline" style={{ color: pal.textPrimary }}>
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
            <p className="inline-flex items-center gap-2">
              <Send className="h-4 w-4" aria-hidden />
              <a href={deeplink} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: pal.textPrimary }}>
                Telegram-бот экипажа
              </a>
            </p>
          </div>
          <div className="text-sm md:text-right" style={{ color: pal.textSecondary }}>
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
    </main>
  );
}
