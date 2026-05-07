import type { Metadata } from "next";
import { getFranchizeBySlug } from "../../actions";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizeHero } from "../../components/FranchizeHero";
import { FranchizePageShell } from "../../components/FranchizePageShell";
import { FranchizeRentalsBridge } from "../../components/FranchizeRentalsBridge";
import { FranchizeErrorBoundary } from "../../components/ErrorBoundary";
import { buildFranchizeIntentLinks } from "../../lib/section-links";
import { crewPaletteForSurface } from "../../lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";

interface FranchizeRentalsPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: FranchizeRentalsPageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Аренды",
    sectionDescription: "Раздел управления арендами экипажа: текущие, завершённые и ожидающие заказы.",
    pathSuffix: "/rentals",
  });
}

export default async function FranchizeRentalsPage({ params }: FranchizeRentalsPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const activePath = `/franchize/${resolvedSlug}/rentals`;
  const surface = crewPaletteForSurface(crew.theme);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={activePath} groupLinks={items.map((item) => item.category)} sectionLinks={buildFranchizeIntentLinks(resolvedSlug, activePath)} />
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-6">
        <FranchizeHero
          eyebrow={`/franchize/${resolvedSlug}/rentals · control-center`}
          title="Мои аренды"
          subcopy="Операторская оболочка для текущих, завершённых и ожидающих аренд: оставляем рабочий движок, но держим бренд экипажа и быстрые возвраты."
          primaryCta={{ label: "Вернуться в каталог", href: `/franchize/${resolvedSlug}` }}
          secondaryCta={{ label: "Классический /rentals", href: "/rentals" }}
        />

        <FranchizeErrorBoundary
          resetKey={slug}
          fallbackTitle="Раздел аренд временно недоступен"
          fallbackHref={`/franchize/${resolvedSlug}/rentals`}
          fallbackLinkLabel="Остаться в арендном разделе"
        >
          <FranchizeRentalsBridge />
        </FranchizeErrorBoundary>
      </FranchizePageShell>
      <CrewFooter crew={crew} />
    </main>
  );
}
