import type { Metadata } from "next";
import { getFranchizeBySlug } from "../../actions";
import { WheelOfFortuneClient } from "../../components/WheelOfFortuneClient";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { crewPaletteWithCssVars } from "../../lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";
import { RomanQuestCake } from "@/components/roman-gift/RomanQuestCake";

interface FranchizeWheelPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Колесо фортуны",
    sectionDescription:
      "Крути колесо фортуны и получи промокод на скидку: 1 000 ₽, 2 000 ₽, 5 000 ₽ или 15% на аренду и покупку.",
    pathSuffix: "/wheel",
  });
}

export default async function FranchizeWheelPage({ params }: FranchizeWheelPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const surface = crewPaletteWithCssVars(crew.theme);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader
        crew={crew}
        activePath={`/franchize/${crew.slug || slug}/wheel`}
        groupLinks={items.map((item) => item.category)}
        items={items}
      />
      <WheelOfFortuneClient crew={crew} slug={crew.slug || slug} />

      {/* task165 onboarding tour — stop 5/19 (boss: ALL header menu links of
          the golden standard vip-bike crew live in the quest). Riddle describes
          the NEXT page. */}
      {slug === "vip-bike" && (
        <RomanQuestCake
          featureKey="wheel"
          riddle="Промокод — приятность. А теперь посмотри, насколько всё это большое: карта всей сети, где каждый экипаж — круг, а размер круга — его люди."
          nextHref="/franchize/discovery"
          nextLabel="Открыть карту сети"
        />
      )}
      <CrewFooter crew={crew} />
    </main>
  );
}
