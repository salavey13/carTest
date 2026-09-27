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
  // Admin/crewowner config (metadata.franchize.storage) — the legacy
  // Стригинский place / 2 000 ₽ defaults live in resolveStorageConfig.
  const storageConfig = crew.storage;
  const serviceEnabled = storageConfig?.enabled ?? true;

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
          {serviceEnabled ? (
            <StorageOrderForm
              slug={resolvedSlug}
              crewName={crew.name}
              storagePlace={storageConfig?.address || crew.contacts.address || "Стригинский переулок, 13Б"}
              defaultMonthlyPriceRub={storageConfig?.defaultMonthlyPriceRub}
              seasonStartMMDD={storageConfig?.seasonStartMMDD}
              seasonEndMMDD={storageConfig?.seasonEndMMDD}
            />
          ) : (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 text-center">
              <p className="text-sm font-bold text-amber-600 dark:text-amber-400">Зимнее хранение временно недоступно</p>
              <p className="mt-2 text-sm text-amber-600/80 dark:text-amber-400/80">
                Экипаж приостановил приём заявок на сезон. Вопросы — по телефону {crew.contacts.phone || "или в Telegram"}.
              </p>
            </div>
          )}
        </FranchizeErrorBoundary>
      </FranchizePageShell>
      <CrewFooter crew={crew} />
    </main>
  );
}
