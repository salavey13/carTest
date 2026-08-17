// app/franchize/[slug]/equipment/page.tsx
import { getFranchizeBySlug } from "../../actions";
import { crewPaletteWithCssVars } from "../../lib/theme";
import { CrewHeader } from "../../components/CrewHeader";
import { CatalogClient } from "../../components/CatalogClient";
import { DisplayModeProvider } from "../../components/DisplayModeContext";
import { FranchizeErrorBoundary } from "../../components/ErrorBoundary";
import { ThemeInitializer } from "../../components/ThemeInitializer";
import { buildFranchizeSectionMetadata } from "../metadata";
import { getFranchizeRouteCtaPolicy } from "../../lib/route-cta-policy";

export const metadata = buildFranchizeSectionMetadata("vip-bike", {
  sectionTitle: "Оборудование",
  sectionDescription: "Каталог арендуемого оборудования экипажа",
});

interface EquipmentPageProps {
  params: Promise<{ slug: string }>;
}

export default async function EquipmentPage({ params }: EquipmentPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const surface = crewPaletteWithCssVars(crew.theme);
  const ctaPolicy = getFranchizeRouteCtaPolicy("catalog");

  return (
    <main className={`min-h-screen overflow-x-clip ${ctaPolicy.pageBottomSafeAreaClassName}`} style={surface.page}>
      <ThemeInitializer defaultTheme="dark" />
      <DisplayModeProvider lockMode="equipment">
        <FranchizeErrorBoundary
          resetKey={slug}
          fallbackTitle="Шапка недоступна"
          fallbackHref={`/franchize/${crew.slug || slug}`}
          fallbackLinkLabel="Обновить страницу экипажа"
        >
          <CrewHeader
            crew={crew}
            activePath={`/franchize/${crew.slug || slug}/equipment`}
            groupLinks={items.map((item) => item.category)}
            items={items}
            showRail
          />
        </FranchizeErrorBoundary>
        <FranchizeErrorBoundary
          resetKey={slug}
          fallbackTitle="Каталог недоступен"
          fallbackHref={`/franchize/${crew.slug || slug}`}
          fallbackLinkLabel="Обновить каталог экипажа"
        >
          <CatalogClient crew={crew} slug={crew.slug || slug} items={items} ctaPolicy={ctaPolicy} />
        </FranchizeErrorBoundary>
      </DisplayModeProvider>
    </main>
  );
}
