// /app/franchize/[slug]/leaderboard/page.tsx
import type { Metadata } from "next";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import { CrewFooter } from "@/app/franchize/components/CrewFooter";
import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { getFranchizeRouteCtaPolicy } from "@/app/franchize/lib/route-cta-policy";
import { buildFranchizeIntentLinks } from "@/app/franchize/lib/section-links";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";
import dynamic from "next/dynamic";
import { buildFranchizeSectionMetadata } from "../metadata";

const FranchizeLeaderboardClient = dynamic(
  () =>
    import("@/app/franchize/components/FranchizeLeaderboardClient").then(
      (mod) => mod.FranchizeLeaderboardClient,
    ),
  { ssr: false },
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Зал славы экипажа",
    sectionDescription:
      "Рейтинг самых активных райдеров экипажа: сезонный заезд, живая статистика и награды за выносливость.",
    pathSuffix: "/leaderboard",
  });
}

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { crew } = await getFranchizeBySlug(slug);
  const crewSlug = crew.slug || slug;
  const activePath = `/franchize/${crewSlug}/leaderboard`;
  const surface = crewPaletteForSurface(crew.theme);
  const ctaPolicy = getFranchizeRouteCtaPolicy("leaderboard");

  return (
    <main
      className={`min-h-screen ${ctaPolicy.pageBottomSafeAreaClassName}`}
      style={surface.page}
    >
      <CrewHeader
        crew={crew}
        activePath={activePath}
        sectionLinks={buildFranchizeIntentLinks(crewSlug, activePath)}
      />
      <FranchizeLeaderboardClient crew={crew} slug={crewSlug} />
      <CrewFooter crew={crew} />
    </main>
  );
}
