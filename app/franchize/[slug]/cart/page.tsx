import type { Metadata } from "next";
import { getFranchizeBySlug } from "../../actions";
import { CartPageClient } from "../../components/CartPageClient";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { getFranchizeRouteCtaPolicy } from "../../lib/route-cta-policy";
import { crewPaletteWithCssVars } from "../../lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";
import { RomanQuestCake } from "@/components/roman-gift/RomanQuestCake";

interface FranchizeCartPageProps {
  params: Promise<{ slug: string }>;
  /** ?promo=CODE — колесо фортуны ведёт в корзину сразу с промокодом. */
  searchParams: Promise<{ promo?: string }>;
}


export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Корзина аренды и покупки",
    sectionDescription: "Корзина экипажа с выбранными байками, аксессуарами и быстрым переходом к оформлению.",
    pathSuffix: "/cart",
  });
}

export default async function FranchizeCartPage({ params, searchParams }: FranchizeCartPageProps) {
  const { slug } = await params;
  const { promo } = await searchParams;
  const { crew, items } = await getFranchizeBySlug(slug);
  const surface = crewPaletteWithCssVars(crew.theme);
  const ctaPolicy = getFranchizeRouteCtaPolicy("checkout");

  return (
    <main className={`min-h-screen ${ctaPolicy.pageBottomSafeAreaClassName}`} style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/cart`} groupLinks={items.map((item) => item.category)} items={items} />
      <CartPageClient
        crew={crew}
        slug={crew.slug || slug}
        items={items}
        initialPromoCode={promo?.trim() || undefined}
      />

      {/* task165 onboarding tour — stop 10/19 (boss: ALL header menu links of
          the golden standard vip-bike crew live in the quest). Riddle describes
          the NEXT page. */}
      {slug === "vip-bike" && (
        <RomanQuestCake
          featureKey="cart"
          riddle="Заказ собран? Дальше — личный кабинет: мои аренды, договоры, статусы и QR-доступы. Всё, что райдеру не нужно помнить самому."
          nextHref="/franchize/vip-bike/profile"
          nextLabel="Открыть мои аренды"
        />
      )}
      <CrewFooter crew={crew} />
    </main>
  );
}
