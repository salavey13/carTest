// /app/franchize/components/CrewLandingClient.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Общий лендинг экипажа на верхнем уровне (/renta-car, /motoprokat1,
// /snowmobile-nn, /snegoprokat-nn — task202, 2026-11-23).
//
// Босс: «create landings for them … like v0-car-test.vercel.app/salavey13 or
// v0-car-test.vercel.app/renta-car». Паттерн svarprofi/sly13/leorus: тонкая
// RSC-страница на верхнем уровне + подавление хрома платформы в ClientLayout
// THEME_CONFIG. Отличие от /salavey13 и /leorus: здесь НЕ уникальная вёрстка
// на каждый экипаж, а один data-driven компонент — контент собирается из
// crews.metadata (branding/theme.palette/contacts/cta/contentBlocks) и
// каталога public.cars через getFranchizeBySlug (memoized, emptyCrew при
// сбое БД — лендинг деградирует в фолбэк-карточку с контактами, не 500).
//
// Почему серверный компонент без "use client": лендинг — статичная воронка
// (навигация = ссылки, FAQ = нативный <details>), ноль клиентского JS,
// быстрый LCP. Палитра фиксирована в dark (маркетинговая страница; mode
// "auto" из метаданных игнорируем осознанно — как salavey13/leorus).
//
// CTA-пара в каждом блоке:
//  · «Открыть каталог» → /franchize/<slug> — веб-витрина с корзиной;
//  · «Забронировать в Telegram» → t.me/<bot>/app?startapp=crew_<slug> —
//    fast path crew_<slug> до auth-гейта (use-start-param-target.ts:321).
// ─────────────────────────────────────────────────────────────────────────────

import type { FranchizeBySlugResult } from "@/app/franchize/actions-runtime";
import type { CatalogItemVM } from "@/app/franchize/actions-runtime";
import { withAlpha } from "@/app/franchize/lib/theme";
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
  /** Шаг «как проходит аренда» №4 — фиксация брони в боте (у всех одинаковый). */
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

  const pal = (isLive && crew!.theme?.palette) || FALLBACK_PALETTE;
  const accentSoft = withAlpha(pal.accentMain, 0.14);
  const accentBorder = withAlpha(pal.accentMain, 0.38);

  const deeplink = `https://t.me/${botUsername}/app?startapp=crew_${slug}`;
  const vitrineHref = `/franchize/${slug}`;

  const showcase = (items ?? []).filter((i) => i.imageUrl || i.title).slice(0, 6);

  const primaryBtn = (label: string) => (
    <a
      href={vitrineHref}
      className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5"
      style={{ backgroundColor: pal.accentMain, color: pal.bgBase }}
    >
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </a>
  );

  const tgBtn = (label: string) => (
    <a
      href={deeplink}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition-colors"
      style={{ borderColor: accentBorder, color: pal.textPrimary }}
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
      {/* ── nav ─────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-md"
        style={{
          borderColor: pal.borderSoft,
          backgroundColor: withAlpha(pal.bgBase, 0.82),
        }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          {isLive && crew!.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={crew!.logoUrl}
              alt={name}
              className="h-8 w-8 rounded-lg object-cover"
            />
          ) : (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold"
              style={{ backgroundColor: accentSoft, color: pal.accentMain }}
            >
              {name.slice(0, 1)}
            </span>
          )}
          <span className="truncate text-sm font-semibold">{name}</span>
          <span className="ml-auto hidden items-center gap-1.5 text-sm sm:flex" style={{ color: pal.textSecondary }}>
            <Phone className="h-4 w-4" aria-hidden />
            <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="hover:underline">
              {phone}
            </a>
          </span>
          <a
            href={deeplink}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold sm:ml-3"
            style={{ backgroundColor: pal.accentMain, color: pal.bgBase }}
          >
            Забронировать
          </a>
        </div>
      </header>

      {/* ── hero ────────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-12 pt-14 md:pt-20">
        <p
          className="text-xs font-semibold uppercase tracking-[0.18em]"
          style={{ color: pal.accentMain }}
        >
          Витрина на платформе SLY13
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-6xl">
          {name}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed" style={{ color: pal.textSecondary }}>
          {tagline}
        </p>
        <p className="mt-3 max-w-2xl text-base leading-relaxed" style={{ color: pal.textSecondary }}>
          {copy.hookLine}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm"
            style={{ borderColor: pal.borderSoft, color: pal.textSecondary }}
          >
            <MapPin className="h-4 w-4" aria-hidden />
            {city}
          </span>
          {workingHours && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm"
              style={{ borderColor: pal.borderSoft, color: pal.textSecondary }}
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
      </section>

      {/* ── каталог-превью ──────────────────────────────────────────────── */}
      {isLive && showcase.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 py-10" id="catalog">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Каталог</h2>
            <span className="text-sm" style={{ color: pal.textSecondary }}>
              {items.length} {pluralRu(items.length, ["позиция", "позиции", "позиций"])}
            </span>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {showcase.map((item) => (
              <a
                key={item.id}
                href={vitrineHref}
                className="group overflow-hidden rounded-2xl border transition-transform hover:-translate-y-0.5"
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
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span
                      className="absolute inset-0 flex items-center justify-center text-5xl font-bold"
                      style={{ color: withAlpha(pal.accentMain, 0.5) }}
                    >
                      {(item.category || item.title).slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  {item.category && (
                    <span
                      className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{ backgroundColor: withAlpha(pal.bgBase, 0.72), color: pal.textPrimary }}
                    >
                      {item.category}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="truncate text-base font-semibold">{item.title}</h3>
                    <span className="whitespace-nowrap text-sm font-bold" style={{ color: pal.accentMain }}>
                      {priceLabel(item)}
                    </span>
                  </div>
                  {item.subtitle?.trim() && (
                    <p className="mt-1 truncate text-sm" style={{ color: pal.textSecondary }}>
                      {item.subtitle}
                    </p>
                  )}
                  <p
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium"
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
          <div className="mt-6">
            <a
              href={vitrineHref}
              className="inline-flex items-center gap-2 text-sm font-semibold hover:underline"
              style={{ color: pal.accentMain }}
            >
              Смотреть весь каталог
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </section>
      )}

      {/* ── как проходит аренда ─────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
          Как проходит аренда
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {(checklist.length > 0
            ? checklist.map((b) => ({ title: b.title, text: b.text }))
            : [
                { title: "Выберите позицию", text: "Каталог с ценами и описанием — выбор без звонков." },
                { title: "Оставьте бронь", text: "Даты и детали собираются в Telegram-боте экипажа." },
                { title: "Документы за минуту", text: "Договор и залог генерируются автоматически, выдача по QR." },
              ]
          ).map((step, idx) => (
            <div
              key={step.title}
              className="rounded-2xl border p-5"
              style={{ backgroundColor: pal.bgCard, borderColor: pal.borderSoft }}
            >
              <span
                className="text-xs font-bold tracking-[0.18em]"
                style={{ color: pal.accentMain }}
              >
                {String(idx + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 text-base font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: pal.textSecondary }}>
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── что добавляет платформа ─────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div
          className="rounded-3xl border p-6 md:p-8"
          style={{ backgroundColor: pal.bgCard, borderColor: accentBorder }}
        >
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Что добавляет платформа
          </h2>
          <ul className="mt-5 grid gap-3 md:grid-cols-2">
            {copy.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm leading-relaxed">
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ color: pal.accentMain }}
                  aria-hidden
                />
                <span style={{ color: pal.textSecondary }}>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div
          className="rounded-3xl border p-6 text-center md:p-10"
          style={{
            backgroundColor: accentSoft,
            borderColor: accentBorder,
          }}
        >
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            {cta?.title || "Выбрать и забронировать"}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed" style={{ color: pal.textSecondary }}>
            {cta?.description ||
              "Откройте каталог, выберите позицию, даты и формат — бронь фиксируется в Telegram-боте экипажа."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {primaryBtn(cta?.buttonLabel || "Открыть каталог")}
            {tgBtn("Забронировать в Telegram")}
          </div>
        </div>
      </section>

      {/* ── footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t" style={{ borderColor: pal.borderSoft }}>
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 md:grid-cols-3">
          <div>
            <p className="text-sm font-semibold">{name}</p>
            <p className="mt-2 text-sm" style={{ color: pal.textSecondary }}>
              {tagline}
            </p>
          </div>
          <div className="space-y-2 text-sm" style={{ color: pal.textSecondary }}>
            <p className="inline-flex items-center gap-2">
              <Phone className="h-4 w-4" aria-hidden />
              <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="hover:underline">
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
          </div>
          <div className="text-sm md:text-right" style={{ color: pal.textSecondary }}>
            <p>
              Работает на платформе{" "}
              <a
                href="https://t.me/oneSitePlsBot"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold hover:underline"
                style={{ color: pal.accentMain }}
              >
                SLY13
              </a>{" "}
              · @SALAVEY13
            </p>
            <p className="mt-2">© {new Date().getFullYear()} {name}</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
