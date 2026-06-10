import type { Metadata } from "next";
import { CrewFooter } from "@/app/franchize/components/CrewFooter";
import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { FranchizePageShell } from "@/app/franchize/components/FranchizePageShell";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";
import { buildFranchizeSectionMetadata } from "@/app/franchize/metadata";
import { FranchizeCrewShiftsClient } from "../CrewShiftsClient";

interface FranchizeSlugCrewShiftsPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Смены экипажа",
    sectionDescription:
      "Управление сменами участников экипажа: активные смены, история, отчеты.",
    pathSuffix: "/crew/shifts",
  });
}

export default async function FranchizeSlugCrewShiftsPage({
  params,
}: FranchizeSlugCrewShiftsPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const activePath = `/franchize/${resolvedSlug}/crew/shifts`;
  const surface = crewPaletteForSurface(crew.theme);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader
        crew={crew}
        activePath={activePath}
        groupLinks={items.map((item) => item.category)}
      />
      <FranchizePageShell
        theme={crew.theme}
        width="wide"
        contentClassName="space-y-4"
      >
        <FranchizeCrewShiftsClient crewSlug={resolvedSlug} />
      </FranchizePageShell>
      <CrewFooter crew={crew} />
    </main>
  );
}
