import type { Metadata } from "next";

import { SalaryClient } from "./SalaryClient";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizePageShell } from "../../components/FranchizePageShell";
import { getFranchizeBySlug } from "../../actions";
import { crewPaletteForSurface } from "../../lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";

interface FranchizeSlugSalaryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: FranchizeSlugSalaryPageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Зарплата",
    sectionDescription:
      "Расчёт зарплаты экипажа: смены, комиссии, выплаты.",
    pathSuffix: "/salary",
  });
}

export default async function FranchizeSlugSalaryPage({
  params,
}: FranchizeSlugSalaryPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const activePath = `/franchize/${resolvedSlug}/salary`;
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
        <SalaryClient initialSlug={resolvedSlug} initialCrew={crew} />
      </FranchizePageShell>
      <CrewFooter crew={crew} />
    </main>
  );
}