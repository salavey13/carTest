// app/franchize/[slug]/parts/page.tsx
import { getFranchizeBySlug } from "../../actions";
import { crewPaletteWithCssVars } from "../../lib/theme";
import { CrewHeader } from "../../components/CrewHeader";
import { DisplayModeProvider } from "../../components/DisplayModeContext";
import { FranchizeErrorBoundary } from "../../components/ErrorBoundary";
import { ThemeInitializer } from "../../components/ThemeInitializer";
import { PartsCatalogClient, type PartsCategoryVM } from "../../components/PartsCatalogClient";
import { buildFranchizeSectionMetadata } from "../metadata";
import { getFranchizeRouteCtaPolicy } from "../../lib/route-cta-policy";
import { loadPartsData } from "../../lib/parts-data";

export const metadata = buildFranchizeSectionMetadata("vip-bike", {
  sectionTitle: "Запчасти",
  sectionDescription: "Каталог запчастей",
  pathSuffix: "/parts",
});

interface PartsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PartsPage({ params }: PartsPageProps) {
  const { slug } = await params;
  // Bike items feed the CrewHeader category rail (rent/sale/service counts).
  const { crew, items } = await getFranchizeBySlug(slug);
  const categories = await loadPartsData();
  const surface = crewPaletteWithCssVars(crew.theme);
  const ctaPolicy = getFranchizeRouteCtaPolicy("catalog");

  // Adapt loader model to the client view model (serializable props).
  const initialParts: PartsCategoryVM[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    parts: category.parts.map((part) => ({
      id: part.partNumber,
      name: part.name,
      partNumber: part.partNumber,
      category: category.name,
      price: Math.round(part.finalPrice),
      image: part.imagePath,
      description: part.description || undefined,
    })),
  }));

  return (
    <main className={`min-h-screen overflow-x-clip ${ctaPolicy.pageBottomSafeAreaClassName}`} style={surface.page}>
      <ThemeInitializer defaultTheme="dark" />
      <DisplayModeProvider lockMode="parts">
        <FranchizeErrorBoundary
          resetKey={slug}
          fallbackTitle="Шапка недоступна"
          fallbackHref={`/franchize/${crew.slug || slug}`}
          fallbackLinkLabel="Обновить страницу экипажа"
        >
          <CrewHeader
            crew={crew}
            activePath={`/franchize/${crew.slug || slug}/parts`}
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
          <PartsCatalogClient
            theme={crew.theme}
            telegramBotUsername={crew.contacts.telegramBotUsername}
            initialParts={initialParts}
          />
        </FranchizeErrorBoundary>
      </DisplayModeProvider>
    </main>
  );
}
