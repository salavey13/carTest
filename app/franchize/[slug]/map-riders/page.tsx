import type { Metadata } from "next";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import { CrewFooter } from "@/app/franchize/components/CrewFooter";
import { CrewHeader } from "@/app/franchize/components/CrewHeader";
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
  const surface = crewPaletteForSurface(crew.theme);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/map-riders`} />
      <MapRidersClient crew={crew} slug={crew.slug || slug} />
      <CrewFooter crew={crew} />
    </main>
  );
}
