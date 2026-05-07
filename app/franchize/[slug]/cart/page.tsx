import type { Metadata } from "next";
import { getFranchizeBySlug } from "../../actions";
import { CartPageClient } from "../../components/CartPageClient";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizeFloatingCart } from "../../components/FranchizeFloatingCart";
import { crewPaletteForSurface } from "../../lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";

interface FranchizeCartPageProps {
  params: Promise<{ slug: string }>;
}


export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Корзина аренды и покупки",
    sectionDescription: "Корзина экипажа с выбранными байками, аксессуарами и быстрым переходом к оформлению.",
    pathSuffix: "/cart",
  });
}

export default async function FranchizeCartPage({ params }: FranchizeCartPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const surface = crewPaletteForSurface(crew.theme);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/cart`} groupLinks={items.map((item) => item.category)} />
      <CartPageClient crew={crew} slug={crew.slug || slug} items={items} />
      <CrewFooter crew={crew} />
      <FranchizeFloatingCart
        slug={crew.slug || slug}
        href={`/franchize/${crew.slug || slug}/cart`}
        items={items}
        accentColor={crew.theme.palette.accentMain}
        textColor={crew.theme.palette.textPrimary}
        borderColor={crew.theme.palette.borderSoft}
        theme={crew.theme}
      />
    </main>
  );
}
