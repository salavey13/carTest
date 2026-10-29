import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getFranchizeBySlug } from "../../actions";
import { isLegacyDefaultsCrew } from "../../lib/content-blocks";
import { CrewHeader } from "../../components/CrewHeader";
import { crewPaletteForSurface } from "../../lib/theme";
import { ConfiguratorClient } from "./ConfiguratorClient";
import { buildFranchizeSectionMetadata } from "../metadata";
import { RomanQuestCake } from "@/components/roman-gift/RomanQuestCake";

interface ConfiguratorPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Конфигуратор электробайка",
    sectionDescription: "Сборка электромотоцикла под райдера: сценарий, комплектация и заявка экипажу.",
    pathSuffix: "/configurator",
  });
}

export default async function ConfiguratorPage({ params }: ConfiguratorPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const surface = crewPaletteForSurface(crew.theme);
  // 2026-10-18 review: the electro configurator is a vip-bike product surface
  // (same family as electro-enduro). Direct URL access from another crew's
  // route must not render vip-flavored assembly UI — route them home.
  if (!isLegacyDefaultsCrew(crew.slug || slug)) {
    redirect(`/franchize/${crew.slug || slug}`);
  }

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader
        crew={crew}
        activePath={`/franchize/${crew.slug || slug}/configurator`}
        groupLinks={items.map((item) => item.category)}
      items={items} />
      <ConfiguratorClient crew={crew} slug={slug} />

      {/* task165 onboarding tour — stop 3/19 (конфигуратор). Riddle describes
          the NEXT page (каталог electro-enduro); the tour skin is public, the
          birthday skin is Roman-only (the component self-gates). */}
      {slug === "vip-bike" && (
        <RomanQuestCake
          featureKey="configurator"
          riddle="Собрал байк мечты? Дальше — отдельный вход для любителей бездорожья: каталог electro-enduro, где эндуро и кросс живут на электротяге. Глянь, какие характеры там выставлены."
          nextHref="/franchize/vip-bike/electro-enduro"
          nextLabel="Открыть electro-enduro"
        />
      )}
    </main>
  );
}
