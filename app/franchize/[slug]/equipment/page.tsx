// app/franchize/[slug]/equipment/page.tsx
import { Suspense } from "react";
import { EquipmentClient } from "./EquipmentClient";
import { getFranchizeBySlug } from "../../actions";
import { crewPaletteForSurface } from "../../lib/theme";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizePageShell } from "../../components/FranchizePageShell";
import { buildFranchizeSectionMetadata } from "../metadata";

export const metadata = buildFranchizeSectionMetadata("vip-bike", {
  sectionTitle: "Оборудование",
  sectionDescription: "Каталог арендуемого оборудования экипажа",
});

interface EquipmentPageProps {
  params: Promise<{ slug: string }>;
}

export default async function EquipmentPage({ params }: EquipmentPageProps) {
  const { slug } = await params;
  const { crew } = await getFranchizeBySlug(slug);
  const surface = crewPaletteForSurface(crew.theme);

  // Equipment catalog is publicly viewable — no crew membership gate.
  // Anyone can browse equipment, just like bikes and services.
  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/equipment`} />
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-4">
        <Suspense fallback={<div className="text-center py-12">Загрузка...</div>}>
          <EquipmentClient slug={crew.slug || slug} crew={crew} />
        </Suspense>
      </FranchizePageShell>
    </main>
  );
}
