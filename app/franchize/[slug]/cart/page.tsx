import { getFranchizeBySlug } from "../../actions";
import { CartPageClient } from "../../components/CartPageClient";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { FloatingCartIconLink } from "../../components/FloatingCartIconLink";

interface FranchizeCartPageProps {
  params: Promise<{ slug: string }>;
}

export default async function FranchizeCartPage({ params }: FranchizeCartPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/cart`} />
      <CartPageClient crew={crew} slug={crew.slug || slug} items={items} />
      <CrewFooter crew={crew} />
      <FloatingCartIconLink
        href={`/franchize/${crew.slug || slug}/cart`}
        itemCount={Math.min(items.length, 2)}
        totalPrice={items.slice(0, 2).reduce((sum, item) => sum + item.pricePerDay, 0)}
        accentColor={crew.theme.palette.accentMain}
        textColor={crew.theme.palette.textPrimary}
        borderColor={crew.theme.palette.borderSoft}
      />
    </main>
  );
}
