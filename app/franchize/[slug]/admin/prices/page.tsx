import type { Metadata } from "next";
import { CrewFooter } from "@/app/franchize/components/CrewFooter";
import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { FranchizePageShell } from "@/app/franchize/components/FranchizePageShell";
import { FranchizePriceQuickEditor } from "@/app/franchize/components/FranchizePriceQuickEditor";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";
import { buildFranchizeSectionMetadata } from "../../metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Быстрая правка цен",
    sectionDescription:
      "Минимальный список техники для быстрого редактирования аренды и цены продажи.",
    pathSuffix: "/admin/prices",
  });
}

export default async function FranchizeAdminPricesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const activePath = `/franchize/${resolvedSlug}/admin/prices`;
  const surface = crewPaletteForSurface(crew.theme);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader
        crew={crew}
        activePath={activePath}
        groupLinks={items.map((item) => item.category)}
      />
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-4">
        <FranchizePriceQuickEditor initialSlug={resolvedSlug} initialCrew={crew} />
      </FranchizePageShell>
      <CrewFooter crew={crew} />
    </main>
  );
}
