import type { Metadata } from "next";
import { getFranchizeBySlug } from "../../actions";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizeHero } from "../../components/FranchizeHero";
import { FranchizePageShell } from "../../components/FranchizePageShell";
import { FranchizeErrorBoundary } from "../../components/ErrorBoundary";
import { buildFranchizeIntentLinks } from "../../lib/section-links";
import { crewPaletteWithCssVars } from "../../lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";
import { RentalsListClient } from "./RentalsListClient";

interface FranchizeRentalsPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: FranchizeRentalsPageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Аренды",
    sectionDescription: "Все аренды экипажа: текущие, завершённые и ожидающие заказы.",
    pathSuffix: "/rentals",
  });
}

export default async function FranchizeRentalsPage({ params }: FranchizeRentalsPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const activePath = `/franchize/${resolvedSlug}/rentals`;
  const surface = crewPaletteWithCssVars(crew.theme);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={activePath} groupLinks={items.map((item) => item.category)} sectionLinks={buildFranchizeIntentLinks(resolvedSlug, activePath)} items={items} />
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-6">
        <FranchizeHero
          eyebrow={`/franchize/${resolvedSlug}/rentals · crew-operations`}
          title="Все аренды"
          subcopy="Все аренды экипажа. Доступ по паролю — /analytics-pass в Telegram-боте."
          primaryCta={{ label: "Вернуться в каталог", href: `/franchize/${resolvedSlug}` }}
          secondaryCta={{ label: "Аналитика аренд", href: `/franchize/${resolvedSlug}/rentals-analytics` }}
        />

        <FranchizeErrorBoundary
          resetKey={slug}
          fallbackTitle="Раздел аренд временно недоступен"
          fallbackHref={`/franchize/${resolvedSlug}/rentals`}
          fallbackLinkLabel="Остаться в разделе аренд"
        >
          <RentalsListClient initialSlug={resolvedSlug} crew={crew} />
        </FranchizeErrorBoundary>
      </FranchizePageShell>
      <CrewFooter crew={crew} />
    </main>
  );
}
