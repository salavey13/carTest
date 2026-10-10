import type { Metadata } from "next";
import { getFranchizeBySlug } from "../../actions";
import { WheelOfFortuneClient } from "../../components/WheelOfFortuneClient";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { crewPaletteWithCssVars } from "../../lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";

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
      <CrewFooter crew={crew} />
    </main>
  );
}
