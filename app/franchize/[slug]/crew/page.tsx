import type { Metadata } from "next";
import { CrewFooter } from "@/app/franchize/components/CrewFooter";
import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { FranchizePageShell } from "@/app/franchize/components/FranchizePageShell";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";
import { FranchizeCrewOverviewClient } from "./CrewOverviewClient";

interface FranchizeSlugCrewPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Управление экипажем",
    sectionDescription:
      "Панель управления экипажем: участники, смены, статистика.",
    pathSuffix: "/crew",
  });
}

export default async function FranchizeSlugCrewPage({
  params,
}: FranchizeSlugCrewPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const activePath = `/franchize/${resolvedSlug}/crew`;
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
        <FranchizeCrewOverviewClient
          crewSlug={resolvedSlug}
          initialCrew={crew}
        />
      </FranchizePageShell>
      <CrewFooter crew={crew} />
    </main>
  );
}
