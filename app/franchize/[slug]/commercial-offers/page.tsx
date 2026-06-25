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
import { CommercialOffersClient } from "./CommercialOffersClient";

interface FranchizeCommercialOffersPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string }>;
}

export async function generateMetadata({ params }: FranchizeCommercialOffersPageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Коммерческие предложения",
    sectionDescription: "Список коммерческих предложений экипажа: клиенты, типы оферт, суммы и сроки действия.",
    pathSuffix: "/commercial-offers",
  });
}

export default async function FranchizeCommercialOffersPage({ params, searchParams }: FranchizeCommercialOffersPageProps) {
  const { slug } = await params;
  const { date: dateParam } = await searchParams;
  const { crew } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const activePath = `/franchize/${resolvedSlug}/commercial-offers`;
  const surface = crewPaletteWithCssVars(crew.theme);

  const today = new Date().toISOString().split("T")[0];
  const selectedDate = dateParam || today;

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader
        crew={crew}
        activePath={activePath}
        groupLinks={[]}
        sectionLinks={buildFranchizeIntentLinks(resolvedSlug, activePath)}
      />
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-4" width="full">
        <FranchizeHero
          eyebrow={`/franchize/${resolvedSlug}/commercial-offers · control-center`}
          title="Коммерческие предложения"
          subcopy="Список КП за выбранный день: клиент, тип оферты, сумма, срок действия, QR. Источник — private.commercial_proposal_artifacts."
          primaryCta={{ label: "Вернуться в каталог", href: `/franchize/${resolvedSlug}` }}
          secondaryCta={{ label: "К аналитике аренд", href: `/franchize/${resolvedSlug}/rentals-analytics` }}
        />
        <FranchizeErrorBoundary
          resetKey={slug}
          fallbackTitle="Раздел КП временно недоступен"
          fallbackHref={`/franchize/${resolvedSlug}/commercial-offers`}
          fallbackLinkLabel="Перезагрузить раздел КП"
        >
          <CommercialOffersClient initialSlug={resolvedSlug} initialDate={selectedDate} crew={crew} />
        </FranchizeErrorBoundary>
      </FranchizePageShell>
      <CrewFooter crew={crew} />
    </main>
  );
}