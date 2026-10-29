import type { Metadata } from "next";
import { getFranchizeBySlug } from "../../actions";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizePageShell } from "../../components/FranchizePageShell";
import { FranchizeErrorBoundary } from "../../components/ErrorBoundary";
import { buildFranchizeIntentLinks } from "../../lib/section-links";
import { crewPaletteWithCssVars } from "../../lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";
import { BikesWallClient } from "./BikesWallClient";
import { RomanQuestCake } from "@/components/roman-gift/RomanQuestCake";

interface FranchizeBikesPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: FranchizeBikesPageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Мотопарк",
    sectionDescription: "История каждого мото: аренды, сервис, выручка и пробег — стена мото.",
    pathSuffix: "/bikes",
  });
}

export default async function FranchizeBikesPage({ params }: FranchizeBikesPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const activePath = `/franchize/${resolvedSlug}/bikes`;
  const surface = crewPaletteWithCssVars(crew.theme);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={activePath} groupLinks={items.map((item) => item.category)} sectionLinks={buildFranchizeIntentLinks(resolvedSlug, activePath, { storageEnabled: crew.storage?.enabled })} items={items} />
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-5">
        <FranchizeErrorBoundary
          resetKey={slug}
          fallbackTitle="Мотопарк временно недоступен"
          fallbackHref={`/franchize/${resolvedSlug}/bikes`}
          fallbackLinkLabel="Обновить"
        >
          <BikesWallClient initialSlug={resolvedSlug} crew={crew} />
        </FranchizeErrorBoundary>
      </FranchizePageShell>

      {/* task165 onboarding tour — stop 9/19 (boss: ALL header menu links of
          the golden standard vip-bike crew live in the quest). Riddle describes
          the NEXT page. */}
      {slug === "vip-bike" && (
        <RomanQuestCake
          featureKey="bikes"
          riddle="Мотопарк помнит каждый мото. Дальше — корзина: гость собирает заказ из аренды и экипировки и оформляет всё одним чекаутом."
          nextHref="/franchize/vip-bike/cart"
          nextLabel="Открыть корзину"
        />
      )}
      <CrewFooter crew={crew} />
    </main>
  );
}
