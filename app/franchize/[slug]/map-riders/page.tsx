import { getFranchizeBySlug } from "@/app/franchize/actions";
import { CrewFooter } from "@/app/franchize/components/CrewFooter";
import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { MapRidersClient } from "@/app/franchize/components/MapRidersClient";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";

export default async function MapRidersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { crew } = await getFranchizeBySlug(slug);
  const surface = crewPaletteForSurface(crew.theme);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${slug}/map-riders`} />
      <MapRidersClient crew={crew} />
      <CrewFooter crew={crew} />
    </main>
  );
}
