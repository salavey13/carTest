import type { Metadata } from "next";

import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { FranchizePageShell } from "@/app/franchize/components/FranchizePageShell";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";
import { buildFranchizeIntentLinks } from "@/app/franchize/lib/section-links";
import { buildFranchizeSectionMetadata } from "../metadata";
import { RentalsAnalyticsClient } from "./RentalsAnalyticsClient";

interface FranchizeSlugRentalsAnalyticsPageProps {
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
    sectionTitle: "Аналитика аренд",
    sectionDescription:
      "Ежедневная статистика аренд с детальной информацией по каждому заказу и документам.",
    pathSuffix: "/rentals-analytics",
  });
}

export default async function FranchizeSlugRentalsAnalyticsPage({
  params,
  searchParams,
}: FranchizeSlugRentalsAnalyticsPageProps) {
  const { slug } = await params;
  const { date: dateParam } = await searchParams;
  const { crew } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const activePath = `/franchize/${resolvedSlug}/rentals-analytics`;
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
        sectionLinks={buildFranchizeIntentLinks(resolvedSlug, activePath)}
      />
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-4" width="full">
        <RentalsAnalyticsClient
          initialSlug={resolvedSlug}
          initialDate={selectedDate}
          crew={crew}
        />
      </FranchizePageShell>
    </main>
  );
}