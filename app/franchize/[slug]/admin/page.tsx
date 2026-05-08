import type { Metadata } from "next";
import { FranchizeAdminClient } from "@/app/franchize/components/FranchizeAdminClient";
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
        <FranchizeAdminClient
          initialSlug={resolvedSlug}
          editId={edit}
          initialCrew={crew}
        />
      </FranchizePageShell>
      <CrewFooter crew={crew} />
    </main>
  );
}
