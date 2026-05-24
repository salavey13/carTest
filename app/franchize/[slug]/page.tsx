import { CrewFooter } from "../components/CrewFooter";
import { CrewHeader } from "../components/CrewHeader";
import { CatalogClient } from "../components/CatalogClient";
import { FranchizeErrorBoundary } from "../components/ErrorBoundary";
import { getFranchizeBySlug } from "../actions";
import { getFranchizeRouteCtaPolicy } from "../lib/route-cta-policy";
import { crewPaletteForSurface } from "../lib/theme";

interface FranchizeSlugPageProps {
  params: Promise<{ slug: string }>;
}

export default async function FranchizeSlugPage({ params }: FranchizeSlugPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const surface = crewPaletteForSurface(crew.theme);
  const ctaPolicy = getFranchizeRouteCtaPolicy("catalog");

  return (
    <main className={`min-h-screen ${ctaPolicy.pageBottomSafeAreaClassName}`} style={surface.page}>
      {/*
        FIX: Wrap CrewHeader in FranchizeErrorBoundary so that any runtime
        error inside the header (including FranchizeProfileButton's Radix
        DropdownMenu portal errors that escape the local
        CrewButtonErrorBoundary) is caught by a LOCAL boundary instead of
        bubbling up to the page-level error.tsx which shows the full-screen
        "Экипаж временно недоступен" fallback.

        Without this wrapper, a portal crash in FranchizeProfileButton's
        DropdownMenu bypasses the local CrewButtonErrorBoundary (because
        Radix renders the portal content outside that boundary's DOM tree)
        and reaches the page-level error boundary, replacing the ENTIRE
        page with the "crew recovery" screen. This FranchizeErrorBoundary
        renders a small inline fallback widget instead, so the catalog
        remains visible even if the header breaks.
      */}
      <FranchizeErrorBoundary
        resetKey={slug}
        fallbackTitle="Шапка недоступна"
        fallbackHref={`/franchize/${crew.slug || slug}`}
        fallbackLinkLabel="Обновить страницу экипажа"
      >
        <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}`} groupLinks={items.map((item) => item.category)} />
      </FranchizeErrorBoundary>
      <FranchizeErrorBoundary
        resetKey={slug}
        fallbackTitle="Каталог недоступен"
        fallbackHref={`/franchize/${crew.slug || slug}`}
        fallbackLinkLabel="Обновить каталог экипажа"
      >
        <CatalogClient crew={crew} slug={slug} items={items} ctaPolicy={ctaPolicy} />
      </FranchizeErrorBoundary>
      <CrewFooter crew={crew} />
    </main>
  );
}