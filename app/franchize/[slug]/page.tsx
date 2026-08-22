import { Suspense } from "react";
import { headers } from "next/headers";
import { CalendarCheck2, Clock3, ListChecks, MapPin, Phone, UserRoundCheck } from "lucide-react";
import { CrewFooter } from "../components/CrewFooter";
import { CrewHeader } from "../components/CrewHeader";
import { CatalogClient } from "../components/CatalogClient";
import { DisplayModeProvider } from "../components/DisplayModeContext";
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
  const hostname = (headers().get("host") || "").split(":")[0].toLowerCase();
  const isVipBikeRentalHost =
    slug === "vip-bike" &&
    (hostname === "rental.vip-bike.ru" || hostname === "www.rental.vip-bike.ru");
  const { crew, items } = await getFranchizeBySlug(slug);
  const surface = crewPaletteWithCssVars(crew.theme);
  const ctaPolicy = getFranchizeRouteCtaPolicy(
    isVipBikeRentalHost ? "rental" : "catalog",
  );
  const conversionCta = isVipBikeRentalHost
    ? {
        title: "Нужна помощь с арендой?",
        description:
          "Не определился с моделью или датами? Напиши Илье — он проверит доступность и условия до бронирования.",
        buttonHref: "https://t.me/I_O_S_NN",
        buttonLabel: "Написать менеджеру",
      }
    : crew.cta;
  const conversionWorkingHours = isVipBikeRentalHost
    ? "10:00–20:00 (ежедневно)"
    : crew.contacts.workingHours;

  return (
    <main className={`min-h-screen overflow-x-clip ${ctaPolicy.pageBottomSafeAreaClassName}`} style={surface.page}>
      <ThemeInitializer defaultTheme="dark" />
      {!isVipBikeRentalHost && (
        <Suspense>
          <JoinCrewBanner slug={slug} />
        </Suspense>
      )}
      {/*
        FIX: Wrap CrewHeader in FranchizeErrorBoundary so that any runtime
        error inside the header (including FranchizeProfileButton's Radix
        DropdownMenu portal errors that escape the local
        CrewButtonErrorBoundary) is caught by a LOCAL boundary instead of
        bubbling up to the page-level error.tsx which shows the full-screen
        "Экипаж временно недоступен" fallback.
      */}
      <DisplayModeProvider lockMode={isVipBikeRentalHost ? "rent" : undefined}>
      <FranchizeErrorBoundary
        resetKey={slug}
        fallbackTitle="Шапка недоступна"
        fallbackHref={`/franchize/${crew.slug || slug}`}
        fallbackLinkLabel="Обновить страницу экипажа"
      >
        <CrewHeader
          crew={crew}
          activePath={`/franchize/${crew.slug || slug}`}
          groupLinks={items.map((item) => item.category)}
          items={items}
          showRail={!isVipBikeRentalHost}
          conversionHomeHref={isVipBikeRentalHost ? "/" : undefined}
          conversionContactHref={isVipBikeRentalHost ? "https://t.me/I_O_S_NN" : undefined}
        />
      </FranchizeErrorBoundary>
      <FranchizeErrorBoundary
        resetKey={slug}
        fallbackTitle="Каталог недоступен"
        fallbackHref={`/franchize/${crew.slug || slug}`}
        fallbackLinkLabel="Обновить каталог экипажа"
      >
        <CatalogClient crew={crew} slug={slug} items={items} ctaPolicy={ctaPolicy} />
      </FranchizeErrorBoundary>

      {slug === "vip-bike" && (
        <section
          id="how"
          className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-10 2xl:max-w-[1600px]"
          style={surface.page}
          aria-labelledby="rental-how-heading"
        >
          <div className="rounded-3xl border p-5 md:p-8" style={surface.card}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--franchize-accent-main)]">
              Как арендовать
            </p>
            <h2
              id="rental-how-heading"
              className="mt-2 text-2xl font-bold tracking-tight md:text-3xl"
              style={{ color: "var(--franchize-text-primary, inherit)" }}
            >
              От выбора до подтверждения
            </h2>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {[
                {
                  title: "Выбери модель",
                  text: "Открой отдельный каталог электро или бензина и сравни доступные варианты.",
                  icon: ListChecks,
                },
                {
                  title: "Укажи даты",
                  text: "Выбери период и оставь имя с телефоном в карточке мотоцикла.",
                  icon: CalendarCheck2,
                },
                {
                  title: "Получи подтверждение",
                  text: "Менеджер проверит доступность и сообщит дополнительные условия до бронирования.",
                  icon: UserRoundCheck,
                },
              ].map((step) => {
                const Icon = step.icon;
                return (
                  <article
                    key={step.title}
                    className="rounded-2xl border p-4"
                    style={surface.card}
                  >
                    <Icon className="h-6 w-6 text-[var(--franchize-accent-main)]" aria-hidden />
                    <h3 className="mt-3 font-semibold" style={{ color: "var(--franchize-text-primary, inherit)" }}>
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm leading-6" style={{ color: "var(--franchize-text-secondary, inherit)" }}>
                      {step.text}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA Section ── Anchor target for /franchize/{slug}#test-drive */}
      <section
        id="test-drive"
        className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-10 2xl:max-w-[1600px]"
        style={surface.card}
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold uppercase tracking-tight md:text-3xl" style={{ color: "var(--franchize-text-primary, inherit)" }}>
              {conversionCta.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed md:text-base" style={{ color: "var(--franchize-text-secondary, inherit)" }}>
              {conversionCta.description}
            </p>
            <div id="contacts" className="mt-4 flex scroll-mt-24 flex-wrap gap-4 text-sm" style={{ color: "var(--franchize-text-secondary, inherit)" }}>
              {crew.contacts.address && (
                <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden /> {crew.contacts.address}</span>
              )}
              {conversionWorkingHours && (
                <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4" aria-hidden /> {conversionWorkingHours}</span>
              )}
              {crew.contacts.phone && (
                <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" aria-hidden /> {crew.contacts.phone}</span>
              )}
            </div>
          </div>
          <div id="operator" className="flex scroll-mt-24 flex-col gap-3 sm:flex-row md:flex-col">
            {conversionCta.buttonHref && (
              <a
                href={conversionCta.buttonHref}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold uppercase tracking-wide transition active:scale-95"
                style={{
                  background: "var(--franchize-accent-main, #f59e0b)",
                  color: "var(--franchize-accent-contrast, #16130A)",
                }}
              >
                {conversionCta.buttonLabel}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── Review CTA ── Yandex Maps review link
          Only show if crew has reviewsLink set. No more hardcoded fallback
          to someone else's Yandex Maps link. */}
      {crew.reviewsLink && (
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
              {isVipBikeRentalHost ? "Уже арендовал мотоцикл?" : "Понравился тест-драйв?"}
            </h2>
            <p
              className="mx-auto mt-2 max-w-xl text-sm leading-relaxed md:text-base"
              style={{ color: "var(--franchize-text-secondary, inherit)" }}
            >
              {isVipBikeRentalHost
                ? "Расскажи на Яндекс Картах, как всё прошло. Отзыв поможет другим выбрать мотоцикл для аренды."
                : "Расскажи на Яндекс Картах, как всё прошло. Твой отзыв помогает другим байкерам выбрать свой электромотоцикл и мотивирует экипаж становиться лучше."}
            </p>

            <a
              href={crew.reviewsLink}
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
      )}
      </DisplayModeProvider>

      {!isVipBikeRentalHost && <CrewFooter crew={crew} />}
    </main>
  );
}
