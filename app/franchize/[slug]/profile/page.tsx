import type { Metadata } from "next";
import { getFranchizeBySlug } from "../../actions";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizePageShell } from "../../components/FranchizePageShell";
import { crewPaletteForSurface } from "../../lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";
import { FranchizeProfileClient } from "./ProfileClient";

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
      />
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-4">
        <FranchizeProfileClient initialCrew={crew} />
      </FranchizePageShell>
      <CrewFooter crew={crew} />
    </main>
  );
}
