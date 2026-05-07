import type { Metadata } from "next";
import { getFranchizeBySlug } from "../../../actions";
import { CrewFooter } from "../../../components/CrewFooter";
import { CrewHeader } from "../../../components/CrewHeader";
import { FranchizeFloatingCart } from "../../../components/FranchizeFloatingCart";
import { OrderPageClient } from "../../../components/OrderPageClient";
import { crewPaletteForSurface } from "../../../lib/theme";
import { buildFranchizeSectionMetadata } from "../../metadata";

interface FranchizeOrderPageProps {
  params: Promise<{ slug: string; id: string }>;
}


export async function generateMetadata({ params }: FranchizeOrderPageProps): Promise<Metadata> {
  const { slug, id } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Оформление заказа",
    sectionDescription: "Оформление заказа экипажа: контакты, выбранная техника, условия аренды или покупки и следующий шаг оплаты.",
    pathSuffix: `/order/${id}`,
  });
}

export default async function FranchizeOrderPage({ params }: FranchizeOrderPageProps) {
  const { slug, id } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const surface = crewPaletteForSurface(crew.theme);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/order/${id}`} groupLinks={items.map((item) => item.category)} />
      <OrderPageClient crew={crew} slug={crew.slug || slug} orderId={id} items={items} />
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
