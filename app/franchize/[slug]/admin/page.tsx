import type { Metadata } from "next";
import { FranchizeAdminClient } from "@/app/franchize/components/FranchizeAdminClient";
import { FranchizeErrorBoundary } from "../../components/ErrorBoundary";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizePageShell } from "../../components/FranchizePageShell";
import { getFranchizeBySlug } from "../../actions";
import { crewPaletteForSurface } from "../../lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";

interface FranchizeSlugAdminPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ edit?: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Админ-панель экипажа",
    sectionDescription:
      "Операторская панель настройки франшизной витрины, каталога, заказов и отзывов.",
    pathSuffix: "/admin",
  });
}

export default async function FranchizeSlugAdminPage({
  params,
  searchParams,
}: FranchizeSlugAdminPageProps) {
  const { slug } = await params;
  const { edit } = await searchParams;
  const { crew, items } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const activePath = `/franchize/${resolvedSlug}/admin`;
  const surface = crewPaletteForSurface(crew.theme);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader
        crew={crew}
        activePath={activePath}
        groupLinks={items.map((item) => item.category)}
      />
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-4">
        {/* U5: breadcrumb navigation */}
        <nav className="flex items-center gap-1.5 text-xs" style={{ color: "var(--franchize-text-secondary, #999)" }}>
          <a href={`/franchize/${resolvedSlug}`} className="hover:underline" style={{ color: "var(--franchize-accent-main, #D99A00)" }}>
            {crew.branding?.name || resolvedSlug}
          </a>
          <span>/</span>
          <span style={{ color: "var(--franchize-text-primary, #fff)" }}>Админка</span>
        </nav>

        {/* M4: wrap admin client in error boundary so a crash doesn't take down the whole page */}
        <FranchizeErrorBoundary
          resetKey={resolvedSlug}
          fallbackTitle="Админ-панель временно недоступна"
          fallbackMessage="Что-то пошло не так. Попробуйте перезагрузить страницу."
          fallbackHref={activePath}
          fallbackLinkLabel="Перезагрузить"
        >
          <FranchizeAdminClient
            initialSlug={resolvedSlug}
            editId={edit}
            initialCrew={crew}
          />
        </FranchizeErrorBoundary>
      </FranchizePageShell>
      <CrewFooter crew={crew} />
    </main>
  );
}
