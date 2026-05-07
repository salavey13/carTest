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
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}`} groupLinks={items.map((item) => item.category)} />
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
