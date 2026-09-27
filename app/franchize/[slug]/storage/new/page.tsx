import type { Metadata } from "next";
import { getFranchizeBySlug } from "../../../actions";
import { CrewFooter } from "../../../components/CrewFooter";
import { CrewHeader } from "../../../components/CrewHeader";
import { FranchizeErrorBoundary } from "../../../components/ErrorBoundary";
import { FranchizePageShell } from "../../../components/FranchizePageShell";
import { crewPaletteWithCssVars } from "../../../lib/theme";
import { buildFranchizeSectionMetadata } from "../../metadata";
import { StorageOrderForm } from "../StorageOrderForm";

interface FranchizeStorageOrderPageProps {
  params: Promise<{ slug: string }>;
}

export const maxDuration = 60; // the checkout generates + uploads the DOCX (same as /order)

export async function generateMetadata({ params }: FranchizeStorageOrderPageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Заявка на зимнее хранение",
    sectionDescription: "Оформление заявки на зимнее хранение мотоцикла: данные байка, сезон, договор с ПЭП.",
    pathSuffix: "/storage/new",
  });
}

export default async function FranchizeStorageOrderPage({ params }: FranchizeStorageOrderPageProps) {
  const { slug } = await params;
  const { crew } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const surface = crewPaletteWithCssVars(crew.theme);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${resolvedSlug}/storage/new`} groupLinks={[]} items={[]} />
      <FranchizePageShell theme={crew.theme} contentClassName="max-w-2xl space-y-5">
        <FranchizeErrorBoundary
          resetKey={`${slug}:storage-new`}
          fallbackTitle="Форма заявки временно недоступна"
          fallbackHref={`/franchize/${resolvedSlug}/storage`}
          fallbackLinkLabel="К стене хранения"
        >
          <StorageOrderForm
            slug={resolvedSlug}
            crewName={crew.name}
            storagePlace={crew.contacts.address || "Стригинский переулок, 13Б"}
          />
        </FranchizeErrorBoundary>
      </FranchizePageShell>
      <CrewFooter crew={crew} />
    </main>
  );
}
