import type { Metadata } from "next";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { getFranchizeRouteCtaPolicy } from "@/app/franchize/lib/route-cta-policy";
import { buildFranchizeIntentLinks } from "@/app/franchize/lib/section-links";
import { crewPaletteWithCssVars, readablePaletteTextOnColor, withAlpha } from "@/app/franchize/lib/theme";
import dynamic from "next/dynamic";
import { buildFranchizeSectionMetadata } from "../metadata";
import { AchievementExplorer } from "../../components/AchievementExplorer";

const MapRidersClient = dynamic(
  () => import("@/app/franchize/components/MapRidersClient").then((mod) => mod.MapRidersClient),
  { ssr: false },
);


export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Карта райдеров",
    sectionDescription: "Live-карта экипажа: райдеры рядом, meetup-точки, статусы поездки и безопасные сборы.",
    pathSuffix: "/map-riders",
  });
}

export default async function MapRidersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const crewSlug = crew.slug || slug;
  const activePath = `/franchize/${crewSlug}/map-riders`;
  const surface = crewPaletteWithCssVars(crew.theme);
  const ctaPolicy = getFranchizeRouteCtaPolicy("map-riders");

  // Palette bridge (--community-*): the SAME vars the wall and the rider
  // profile set on <main>. The map paints its panels/popups from these, so
  // wall · map · profile read as one family (consistency request).
  const accentText = readablePaletteTextOnColor(crew.theme.palette.accentMain, crew.theme.palette);
  const themeVars = {
    ["--community-accent" as string]: crew.theme.isAuto ? "var(--franchize-accent-main)" : crew.theme.palette.accentMain,
    ["--community-border" as string]: crew.theme.isAuto ? "var(--franchize-border-soft)" : crew.theme.palette.borderSoft,
    ["--community-card" as string]: surface.subtleCard.backgroundColor,
    ["--community-base-soft" as string]: withAlpha(crew.theme.isAuto ? "var(--franchize-bg-base)" : crew.theme.palette.bgBase, 0.35),
    ["--community-card-soft" as string]: withAlpha(crew.theme.isAuto ? "var(--franchize-bg-card)" : crew.theme.palette.bgCard, 0.86),
    ["--community-card-faint" as string]: withAlpha(crew.theme.isAuto ? "var(--franchize-bg-card)" : crew.theme.palette.bgCard, 0.54),
    ["--community-text" as string]: crew.theme.isAuto ? "var(--franchize-text-primary)" : crew.theme.palette.textPrimary,
    ["--community-muted" as string]: crew.theme.isAuto ? "var(--franchize-text-secondary)" : crew.theme.palette.textSecondary,
    ["--community-accent-text" as string]: crew.theme.isAuto
      ? readablePaletteTextOnColor(crew.theme.palettes?.dark?.accentMain || crew.theme.palettes?.light?.accentMain || crew.theme.palette.accentMain, crew.theme.palettes?.dark || crew.theme.palettes?.light || crew.theme.palette)
      : accentText,
  } as React.CSSProperties;

  return (
    <main className={`flex flex-col min-h-screen ${ctaPolicy.pageBottomSafeAreaClassName}`} style={{ ...surface.page, ...themeVars }}>
      <AchievementExplorer slug={crew.slug || slug} achievementId="explorer_map_riders" />
      {/* Wrap header in z-index container to isolate from map */}
      <div className="relative z-10">
        <CrewHeader crew={crew} activePath={activePath} sectionLinks={buildFranchizeIntentLinks(crewSlug, activePath)} items={items} showRail={false} />
      </div>
      <MapRidersClient crew={crew} slug={crewSlug} items={items} />
    </main>
  );
}
