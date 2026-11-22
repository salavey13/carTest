import type { Metadata } from "next";
import { getFranchizeBySlug } from "../../../actions";
import { CrewFooter } from "../../../components/CrewFooter";
import { CrewHeader } from "../../../components/CrewHeader";
import { FranchizePageShell } from "../../../components/FranchizePageShell";
import { FranchizeErrorBoundary } from "../../../components/ErrorBoundary";
import { buildFranchizeIntentLinks } from "../../../lib/section-links";
import { crewPaletteWithCssVars } from "../../../lib/theme";
import { buildFranchizeSectionMetadata } from "../../metadata";
import { StorageBikeStoryClient } from "../StorageBikeStoryClient";

interface FranchizeStorageStoryPageProps {
  params: Promise<{ slug: string; bikeId: string }>;
}

export async function generateMetadata({ params }: FranchizeStorageStoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Карточка хранения",
    sectionDescription: "Карточка байка на зимнем хранении: сезон, оплаты, история перемещений и договор.",
    pathSuffix: "/storage",
  });
}

export default async function FranchizeStorageStoryPage({ params }: FranchizeStorageStoryPageProps) {
  const { slug, bikeId } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const activePath = `/franchize/${resolvedSlug}/storage`;
  const surface = crewPaletteWithCssVars(crew.theme);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={activePath} groupLinks={items.map((item) => item.category)} sectionLinks={buildFranchizeIntentLinks(resolvedSlug, activePath, { storageEnabled: crew.storage?.enabled })} items={items} />
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-5">
        <FranchizeErrorBoundary
          resetKey={`${resolvedSlug}:storage-story`}
          fallbackTitle="Карточка хранения временно недоступна"
          fallbackHref={`/franchize/${resolvedSlug}/storage`}
          fallbackLinkLabel="К стене хранения"
        >
          <StorageBikeStoryClient
            initialSlug={resolvedSlug}
            bikeId={bikeId}
            crewName={crew.name}
            contactsPhone={crew.contacts.phone || ""}
            storageConfig={crew.storage}
          />
        </FranchizeErrorBoundary>
      </FranchizePageShell>
      <CrewFooter crew={crew} />
    </main>
  );
}
