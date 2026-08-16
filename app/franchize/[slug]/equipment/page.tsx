// app/franchize/[slug]/equipment/page.tsx
import { Suspense } from "react";
import { EquipmentClient } from "./EquipmentClient";
import { getFranchizeBySlug } from "../../actions";
import { crewPaletteForSurface } from "../../lib/theme";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizePageShell } from "../../components/FranchizePageShell";
import { DisplayModeProvider } from "../../components/DisplayModeContext";
import { CatalogClient } from "../../components/CatalogClient";
import { buildFranchizeSectionMetadata } from "../metadata";
import { resolveFranchizeCtaPolicy } from "../../lib/route-cta-policy";

export const metadata = buildFranchizeSectionMetadata("vip-bike", {
  sectionTitle: "Оборудование",
  sectionDescription: "Каталог арендуемого оборудования экипажа",
});

interface EquipmentPageProps {
  params: Promise<{ slug: string }>;
}

export default async function EquipmentPage({ params }: EquipmentPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const surface = crewPaletteForSurface(crew.theme);
  const ctaPolicy = resolveFranchizeCtaPolicy(crew);

  // Equipment catalog is publicly viewable — no crew membership gate.
  // Uses the SAME CatalogClient as rent/sale/service, locked to "equipment" mode.
  return (
    <main className="min-h-screen" style={surface.page}>
      <DisplayModeProvider lockMode="equipment">
        <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/equipment`} items={items} showRail />
        <FranchizePageShell theme={crew.theme} contentClassName="space-y-4">
          <Suspense fallback={<div className="text-center py-12">Загрузка...</div>}>
            <CatalogClient crew={crew} slug={crew.slug || slug} items={items} ctaPolicy={ctaPolicy} />
          </Suspense>
        </FranchizePageShell>
      </DisplayModeProvider>
    </main>
  );
}
