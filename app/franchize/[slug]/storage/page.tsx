import type { Metadata } from "next";
import { getFranchizeBySlug } from "../../actions";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizePageShell } from "../../components/FranchizePageShell";
import { FranchizeErrorBoundary } from "../../components/ErrorBoundary";
import { buildFranchizeIntentLinks } from "../../lib/section-links";
import { crewPaletteWithCssVars } from "../../lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";
import { StorageWallClient } from "./StorageWallClient";

interface FranchizeStoragePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: FranchizeStoragePageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Зимнее хранение",
    sectionDescription: "Стена зимнего хранения: байки владельцев на сезоне, статусы, история каждого перемещения и договоры.",
    pathSuffix: "/storage",
  });
}

export default async function FranchizeStoragePage({ params }: FranchizeStoragePageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const activePath = `/franchize/${resolvedSlug}/storage`;
  const surface = crewPaletteWithCssVars(crew.theme);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={activePath} groupLinks={items.map((item) => item.category)} sectionLinks={buildFranchizeIntentLinks(resolvedSlug, activePath, { storageEnabled: crew.storage?.enabled })} items={items} />
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-5">
        <FranchizeErrorBoundary
          resetKey={slug}
          fallbackTitle="Стена хранения временно недоступна"
          fallbackHref={`/franchize/${resolvedSlug}/storage`}
          fallbackLinkLabel="Обновить"
        >
          <StorageWallClient
            initialSlug={resolvedSlug}
            crewName={crew.name}
            contactsPhone={crew.contacts.phone || ""}
            storageConfig={crew.storage}
            serviceEnabled={crew.storage?.enabled ?? true}
          />
        </FranchizeErrorBoundary>
      </FranchizePageShell>
      <CrewFooter crew={crew} />
    </main>
  );
}
