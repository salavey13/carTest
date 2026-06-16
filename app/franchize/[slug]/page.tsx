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
      <CrewFooter crew={crew} />
    </main>
  );
}