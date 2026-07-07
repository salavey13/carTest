import { CrewFooter } from "../components/CrewFooter";
import { CrewHeader } from "../components/CrewHeader";
import { CatalogClient } from "../components/CatalogClient";
import { FranchizeErrorBoundary } from "../components/ErrorBoundary";
import { ThemeInitializer } from "../components/ThemeInitializer";
import { getFranchizeBySlug } from "../actions";
import { getFranchizeRouteCtaPolicy } from "../lib/route-cta-policy";
import { crewPaletteWithCssVars } from "../lib/theme";
import { FranchizeCatalogHero } from "../components/FranchizeCatalogHero";

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
        <FranchizeCatalogHero crew={crew} slug={slug} variant="main" />
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

      <CrewFooter crew={crew} />
    </main>
  );
}