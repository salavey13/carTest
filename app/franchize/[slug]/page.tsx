import { Suspense } from "react";
import { CrewFooter } from "../components/CrewFooter";
import { CrewHeader } from "../components/CrewHeader";
import { CatalogClient } from "../components/CatalogClient";
import { FranchizeErrorBoundary } from "../components/ErrorBoundary";
import { ThemeInitializer } from "../components/ThemeInitializer";
import { JoinCrewBanner } from "../components/JoinCrewBanner";
import { getFranchizeBySlug } from "../actions";
import { getFranchizeRouteCtaPolicy } from "../lib/route-cta-policy";
import { crewPaletteWithCssVars } from "../lib/theme";

interface FranchizeSlugPageProps {
  params: Promise<{ slug: string }>;
}

export default async function FranchizeSlugPage({ params }: FranchizeSlugPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const surface = crewPaletteWithCssVars(crew.theme);
  const ctaPolicy = getFranchizeRouteCtaPolicy("catalog");

  return (
    <main className={`min-h-screen ${ctaPolicy.pageBottomSafeAreaClassName}`} style={surface.page}>
      <ThemeInitializer defaultTheme="dark" />
      <Suspense>
        <JoinCrewBanner slug={slug} />
      </Suspense>
      {/*
        FIX: Wrap CrewHeader in FranchizeErrorBoundary so that any runtime
        error inside the header (including FranchizeProfileButton's Radix
        DropdownMenu portal errors that escape the local
        CrewButtonErrorBoundary) is caught by a LOCAL boundary instead of
        bubbling up to the page-level error.tsx which shows the full-screen
        "Экипаж временно недоступен" fallback.
      */}
      <FranchizeErrorBoundary
        resetKey={slug}
        fallbackTitle="Шапка недоступна"
        fallbackHref={`/franchize/${crew.slug || slug}`}
        fallbackLinkLabel="Обновить страницу экипажа"
      >
        <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}`} groupLinks={items.map((item) => item.category)} items={items} />
      </FranchizeErrorBoundary>
      <FranchizeErrorBoundary
        resetKey={slug}
        fallbackTitle="Каталог недоступен"
        fallbackHref={`/franchize/${crew.slug || slug}`}
        fallbackLinkLabel="Обновить каталог экипажа"
      >
        <CatalogClient crew={crew} slug={slug} items={items} ctaPolicy={ctaPolicy} />
      </FranchizeErrorBoundary>

      {/* ── Test Drive Section ── Anchor target for /franchize/{slug}#test-drive */}
      <section
        id="test-drive"
        className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-10 2xl:max-w-[1600px]"
        style={surface.card}
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold uppercase tracking-tight md:text-3xl" style={{ color: "var(--franchize-text-primary, inherit)" }}>
              Тест-драйв
            </h2>
            <p className="mt-2 text-sm leading-relaxed md:text-base" style={{ color: "var(--franchize-text-secondary, inherit)" }}>
              Попробуйте электромотоцикл перед покупкой. Покатаемся по центру Нижнего Новгорода,
              ответим на вопросы, поможем определиться с моделью. Шоурум открыт ежедневно.
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm" style={{ color: "var(--franchize-text-secondary, inherit)" }}>
              {crew.contacts.address && (
                <span className="flex items-center gap-1.5">📍 {crew.contacts.address}</span>
              )}
              {crew.contacts.workingHours && (
                <span className="flex items-center gap-1.5">🕐 {crew.contacts.workingHours}</span>
              )}
              {crew.contacts.phone && (
                <span className="flex items-center gap-1.5">📞 {crew.contacts.phone}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
            <a
              href="https://t.me/I_O_S_NN"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold uppercase tracking-wide transition active:scale-95"
              style={{
                background: "var(--franchize-accent-main, #f59e0b)",
                color: "var(--franchize-accent-contrast, #16130A)",
              }}
            >
              Записаться на тест-драйв
            </a>

          </div>
        </div>
      </section>

      {/* ── Review CTA ── Yandex Maps review link */}
      <section
        id="review"
        className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 pb-16 pt-6 2xl:max-w-[1600px]"
        style={surface.page}
      >
        <div
          className="relative overflow-hidden rounded-3xl border p-6 text-center md:p-10"
          style={{
            ...surface.card,
            borderColor:
              "color-mix(in srgb, var(--franchize-accent-main, #f59e0b) 30%, var(--franchize-border-soft, transparent))",
            boxShadow:
              "0 20px 60px color-mix(in srgb, var(--franchize-accent-main, #f59e0b) 12%, transparent), inset 0 1px 0 color-mix(in srgb, var(--franchize-accent-main, #f59e0b) 10%, transparent)",
          }}
        >
          {/* Decorative glowing orbs */}
          <div
            className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl opacity-30 md:h-56 md:w-56"
            style={{ background: "var(--franchize-accent-main, #f59e0b)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-12 -left-12 h-32 w-32 rounded-full blur-3xl opacity-20 md:h-48 md:w-48"
            style={{ background: "var(--franchize-accent-main, #f59e0b)" }}
          />

          <div className="relative z-10">
            {/* Star rating */}
            <div className="mb-4 flex justify-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg
                  key={i}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-6 w-6 md:h-7 md:w-7"
                  style={{ color: "var(--franchize-accent-main, #f59e0b)" }}
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.006z"
                    clipRule="evenodd"
                  />
                </svg>
              ))}
            </div>

            <h2
              className="text-xl font-bold uppercase tracking-tight md:text-2xl"
              style={{ color: "var(--franchize-text-primary, inherit)" }}
            >
              Понравился тест-драйв?
            </h2>
            <p
              className="mx-auto mt-2 max-w-xl text-sm leading-relaxed md:text-base"
              style={{ color: "var(--franchize-text-secondary, inherit)" }}
            >
              Расскажи на Яндекс Картах, как всё прошло. Твой отзыв помогает другим
              байкерам выбрать свой электромотоцикл и мотивирует экипаж становиться лучше.
            </p>

            <a
              href="https://yandex.ru/maps/org/vip_bike_electro/81589395232/reviews/"
              target="_blank"
              rel="noreferrer noopener"
              className="group relative mt-6 inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl px-8 py-4 text-sm font-bold uppercase tracking-wide transition-transform hover:-translate-y-0.5 active:scale-95"
              style={{
                background: "var(--franchize-accent-main, #f59e0b)",
                color: "var(--franchize-accent-contrast, #16130A)",
                boxShadow:
                  "0 0 0 1px color-mix(in srgb, var(--franchize-accent-contrast, #16130A) 12%, transparent), 0 16px 40px color-mix(in srgb, var(--franchize-accent-main, #f59e0b) 35%, transparent)",
              }}
            >
              <span className="relative z-10 flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12"
                  aria-hidden="true"
                >
                  <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z" />
                  <path d="M5.25 5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h10.5a3 3 0 003-3V13.5a.75.75 0 00-1.5 0v5.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5h5.25a.75.75 0 000-1.5H5.25z" />
                </svg>
                Оставить отзыв
              </span>
              {/* Hover shine sweep */}
              <span
                className="absolute inset-0 -translate-x-full transition-transform duration-500 group-hover:translate-x-0"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, color-mix(in srgb, var(--franchize-accent-contrast, #16130A) 16%, transparent), transparent)",
                }}
              />
            </a>

            <p
              className="mt-4 text-xs"
              style={{ color: "var(--franchize-text-secondary, inherit)" }}
            >
              Откроется в новой вкладке · Яндекс Карты
            </p>
          </div>
        </div>
      </section>

      <CrewFooter crew={crew} />
    </main>
  );
}