import type { Metadata } from "next";
import { getFranchizeBySlug } from "../../actions";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizePageShell } from "../../components/FranchizePageShell";
import { crewPaletteForSurface } from "../../lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";
import { FranchizeProfileClient } from "./ProfileClient";
import { RomanQuestCake } from "@/components/roman-gift/RomanQuestCake";

interface FranchizeProfilePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: FranchizeProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Профиль райдера",
    sectionDescription:
      "Персональный профиль франшизы: достижения, активность, сохранённые данные и быстрые переходы к арендам.",
    pathSuffix: "/profile",
  });
}

export default async function FranchizeProfilePage({
  params,
}: FranchizeProfilePageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const activePath = `/franchize/${resolvedSlug}/profile`;
  const surface = crewPaletteForSurface(crew.theme);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader
        crew={crew}
        activePath={activePath}
        groupLinks={items.map((item) => item.category)}
        items={items}
      />
      {/* overflowMode="clip": the tab dock in ProfileClient is position:sticky
          — overflow:hidden (default) creates a scroll container that silently
          disables viewport-sticky for descendants. clip clips identically but
          keeps sticky working; old engines fall back to the hidden class. */}
      <FranchizePageShell
        theme={crew.theme}
        contentClassName="space-y-4"
        overflowMode="clip"
      >
        <FranchizeProfileClient initialCrew={crew} initialSlug={resolvedSlug} />
      </FranchizePageShell>

      {/* task165 onboarding tour — stop 11/19 (boss: ALL header menu links of
          the golden standard vip-bike crew live in the quest). Riddle describes
          the NEXT page. */}
      {slug === "vip-bike" && (
        <RomanQuestCake
          featureKey="profile"
          riddle="Все брони — в одном месте. Дальше — цифры: прайс-калькулятор, где каждая стоимость объяснена — что входит, что опционально, откуда залог."
          nextHref="/franchize/vip-bike/calc-explainer"
          nextLabel="Открыть прайс-калькулятор"
        />
      )}
      <CrewFooter crew={crew} />
    </main>
  );
}
