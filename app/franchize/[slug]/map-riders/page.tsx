import type { Metadata } from "next";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import { CrewFooter } from "@/app/franchize/components/CrewFooter";
import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { getFranchizeRouteCtaPolicy } from "@/app/franchize/lib/route-cta-policy";
import { buildFranchizeIntentLinks } from "@/app/franchize/lib/section-links";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";
import dynamic from "next/dynamic";
import { buildFranchizeSectionMetadata } from "../metadata";

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
  const { crew } = await getFranchizeBySlug(slug);
  const crewSlug = crew.slug || slug;
  const activePath = `/franchize/${crewSlug}/map-riders`;
  const surface = crewPaletteForSurface(crew.theme);
  const ctaPolicy = getFranchizeRouteCtaPolicy("map-riders");

  return (
    <main className={`min-h-screen ${ctaPolicy.pageBottomSafeAreaClassName}`} style={surface.page}>
      <CrewHeader crew={crew} activePath={activePath} sectionLinks={buildFranchizeIntentLinks(crewSlug, activePath)} />
      <MapRidersClient crew={crew} slug={crewSlug} />
      <CrewFooter crew={crew} />
    </main>
  );
}
