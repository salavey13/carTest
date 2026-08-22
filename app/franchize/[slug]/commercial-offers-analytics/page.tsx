import type { Metadata } from "next";

import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { FranchizePageShell } from "@/app/franchize/components/FranchizePageShell";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";
import { CommercialOffersAnalyticsClient } from "./CommercialOffersAnalyticsClient";

interface FranchizeCommercialOffersAnalyticsPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Аналитика коммерческих предложений",
    sectionDescription:
      "Ежедневная статистика КП: клиенты, типы оферт, суммы и сроки действия.",
    pathSuffix: "/commercial-offers-analytics",
  });
}

export default async function FranchizeCommercialOffersAnalyticsPage({
  params,
  searchParams,
}: FranchizeCommercialOffersAnalyticsPageProps) {
  const { slug } = await params;
  const { date: dateParam } = await searchParams;
  const { crew } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const activePath = `/franchize/${resolvedSlug}/commercial-offers-analytics`;
  const surface = crewPaletteForSurface(crew.theme);

  // Default to today if no date provided
  const today = new Date().toISOString().split("T")[0];
  const selectedDate = dateParam || today;

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader
        crew={crew}
        activePath={activePath}
        groupLinks={[]}
        showRail={false}
      />
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-4" width="full">
        <CommercialOffersAnalyticsClient
          initialSlug={resolvedSlug}
          initialDate={selectedDate}
          crew={crew}
        />
      </FranchizePageShell>
    </main>
  );
}