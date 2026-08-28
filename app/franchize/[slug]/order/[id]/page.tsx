import type { Metadata } from "next";

// FIX (iter14): the checkout server action (doc generation + DB writes +
// Telegram fan-out) regularly exceeds the default serverless timeout — the
// live kawasaki order (order-mtbnsf97-zukmfy) died right after the doc was
// delivered, before the rental row was written.
// FIX (hotfix follow-up): Vercel does NOT clamp maxDuration to the plan limit —
// values above 60 hard-fail the BUILD on the Hobby plan
// ("invalid maxDuration value ... must have a maxDuration between 1 and 60 for
// plan hobby"). 60 is the maximum Hobby allows; if the checkout ever needs
// longer, either upgrade to Pro (max 300) or move the heavy work to a
// background queue.
export const maxDuration = 60;

import { getFranchizeBySlug } from "../../../actions";
import { CrewFooter } from "../../../components/CrewFooter";
import { CrewHeader } from "../../../components/CrewHeader";
import { OrderPageClient } from "../../../components/OrderPageClient";
import { getFranchizeRouteCtaPolicy } from "../../../lib/route-cta-policy";
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
  const ctaPolicy = getFranchizeRouteCtaPolicy("order");

  return (
    <main className={`min-h-screen ${ctaPolicy.pageBottomSafeAreaClassName}`} style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/order/${id}`} groupLinks={items.map((item) => item.category)} items={items} />
      <OrderPageClient crew={crew} slug={crew.slug || slug} orderId={id} items={items} />
      <CrewFooter crew={crew} />
    </main>
  );
}
