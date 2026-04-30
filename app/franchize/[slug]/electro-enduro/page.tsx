import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { CatalogClient } from "../../components/CatalogClient";
import { getFranchizeBySlug } from "../../actions";
import { crewPaletteForSurface } from "../../lib/theme";

interface ElectroEnduroPageProps {
  params: Promise<{ slug: string }>;
}

const isSaleEnabled = (value: unknown) => value === 1 || value === true || String(value).toLowerCase() === "1" || String(value).toLowerCase() === "true";

export default async function ElectroEnduroPage({ params }: ElectroEnduroPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const surface = crewPaletteForSurface(crew.theme);
  const saleItems = items.filter((item) => item.saleAvailable || isSaleEnabled(item.rawSpecs?.sale));

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/electro-enduro`} groupLinks={saleItems.map((item) => item.category)} />
      <CatalogClient crew={crew} slug={slug} items={saleItems} mode="electro" />
      <CrewFooter crew={crew} />
    </main>
  );
}
