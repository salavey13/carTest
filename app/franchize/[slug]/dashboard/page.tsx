import type { Metadata } from "next";

import { FranchizeCloserDashboardClient } from "@/app/franchize/components/FranchizeCloserDashboardClient";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizePageShell } from "../../components/FranchizePageShell";
import { getFranchizeBySlug } from "../../actions";
import { crewPaletteForSurface } from "../../lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";

interface FranchizeSlugDashboardPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: FranchizeSlugDashboardPageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Панель горячих заявок",
    sectionDescription:
      "Панель горячих заявок франшизы: быстрые ответы в Telegram и ручная обработка сделок.",
    pathSuffix: "/dashboard",
  });
}

export default async function FranchizeSlugDashboardPage({
  params,
}: FranchizeSlugDashboardPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const activePath = `/franchize/${resolvedSlug}/dashboard`;
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
        <FranchizeCloserDashboardClient
          initialSlug={resolvedSlug}
          initialCrew={crew}
        />
      </FranchizePageShell>
      <CrewFooter crew={crew} />
    </main>
  );
}
