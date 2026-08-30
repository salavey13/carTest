import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFranchizeBySlug } from "../../../actions";
import { CrewFooter } from "../../../components/CrewFooter";
import { CrewHeader } from "../../../components/CrewHeader";
import { FranchizePageShell } from "../../../components/FranchizePageShell";
import { FranchizeErrorBoundary } from "../../../components/ErrorBoundary";
import { buildFranchizeIntentLinks } from "../../../lib/section-links";
import { crewPaletteWithCssVars } from "../../../lib/theme";
import { buildFranchizeSectionMetadata } from "../../metadata";
import { BikeStoryClient } from "./BikeStoryClient";

interface FranchizeBikeStoryPageProps {
  params: Promise<{ slug: string; bikeId: string }>;
}

export async function generateMetadata({ params }: FranchizeBikeStoryPageProps): Promise<Metadata> {
  const { slug, bikeId } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "История мото",
    sectionDescription: `Стена мото: аренды, сервис, выручка и пробег — вся история одного мото.`,
    pathSuffix: `/bikes/${bikeId}`,
  });
}

export default async function FranchizeBikeStoryPage({ params }: FranchizeBikeStoryPageProps) {
  const { slug, bikeId } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  if (!crew?.slug) notFound();
  const resolvedSlug = crew.slug || slug;
  const activePath = `/franchize/${resolvedSlug}/bikes`;
  const surface = crewPaletteWithCssVars(crew.theme);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={activePath} groupLinks={items.map((item) => item.category)} sectionLinks={buildFranchizeIntentLinks(resolvedSlug, activePath)} items={items} />
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-5">
        <FranchizeErrorBoundary
          resetKey={`${slug}-${bikeId}`}
          fallbackTitle="История мото временно недоступна"
          fallbackHref={`/franchize/${resolvedSlug}/bikes`}
          fallbackLinkLabel="Вернуться в мотопарк"
        >
          <BikeStoryClient initialSlug={resolvedSlug} initialBikeId={bikeId} crew={crew} />
        </FranchizeErrorBoundary>
      </FranchizePageShell>
      <CrewFooter crew={crew} />
    </main>
  );
}
