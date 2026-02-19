import { getFranchizeBySlug } from "../../../actions";
import { CrewFooter } from "../../../components/CrewFooter";
import { CrewHeader } from "../../../components/CrewHeader";
import { FloatingCartIconLink } from "../../../components/FloatingCartIconLink";
import { OrderPageClient } from "../../../components/OrderPageClient";

interface FranchizeOrderPageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function FranchizeOrderPage({ params }: FranchizeOrderPageProps) {
  const { slug, id } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/order/${id}`} />
      <OrderPageClient crew={crew} slug={crew.slug || slug} orderId={id} items={items} />
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
