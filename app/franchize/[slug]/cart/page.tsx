import { getFranchizeBySlug } from "../../actions";
import { CartPageClient } from "../../components/CartPageClient";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizeFloatingCart } from "../../components/FranchizeFloatingCart";
import { crewPaletteForSurface } from "../../lib/theme";

interface FranchizeCartPageProps {
  params: Promise<{ slug: string }>;
}

export default async function FranchizeCartPage({ params }: FranchizeCartPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const surface = crewPaletteForSurface(crew.theme);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/cart`} />
      <CartPageClient crew={crew} slug={crew.slug || slug} items={items} />
      <CrewFooter crew={crew} />
      <FranchizeFloatingCart
        slug={crew.slug || slug}
        href={`/franchize/${crew.slug || slug}/cart`}
        items={items}
        accentColor={crew.theme.palette.accentMain}
        textColor={crew.theme.palette.textPrimary}
        borderColor={crew.theme.palette.borderSoft}
      />
    </main>
  );
}
