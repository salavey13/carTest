import type { Metadata } from "next";
import { getFranchizeBySlug } from "../../actions";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizeFloatingCart } from "../../components/FranchizeFloatingCart";
import { FranchizeHero } from "../../components/FranchizeHero";
import { FranchizePageShell } from "../../components/FranchizePageShell";
import { crewPaletteForSurface } from "../../lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";

interface FranchizeAboutPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: FranchizeAboutPageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "О нас",
    sectionDescription: "О франшизе, команде, ценностях и формате работы экипажа.",
    pathSuffix: "/about",
  });
}

export default async function FranchizeAboutPage({ params }: FranchizeAboutPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const surface = crewPaletteForSurface(crew.theme);
  const resolvedSlug = crew.slug || slug;

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${resolvedSlug}/about`} groupLinks={items.map((item) => item.category)} />
      <FranchizePageShell theme={crew.theme}>
        <FranchizeHero
          eyebrow={`/franchize/${resolvedSlug}/about · экипаж`}
          title="О нас"
          subcopy={crew.description || "Операторская страница экипажа: ценности, формат работы и доверие перед первой заявкой. Подробности подтянутся из метаданных франшизы."}
          primaryCta={{ label: "Смотреть каталог", href: `/franchize/${resolvedSlug}` }}
          secondaryCta={{ label: "Связаться", href: `/franchize/${resolvedSlug}/contacts` }}
        >
          {crew.ratingSummary.count > 0 ? (
            <div className="rounded-2xl border px-4 py-3 text-sm" style={surface.subtleCard}>
              <span className="font-bold" style={{ color: crew.theme.palette.accentMain }}>★ {crew.ratingSummary.average.toFixed(1)}</span>
              <span style={surface.mutedText}> · {crew.ratingSummary.count} отзывов экипажа</span>
            </div>
          ) : null}
        </FranchizeHero>
      </FranchizePageShell>
      <CrewFooter crew={crew} />
      <FranchizeFloatingCart
        slug={resolvedSlug}
        href={`/franchize/${resolvedSlug}/cart`}
        items={items}
        accentColor={crew.theme.palette.accentMain}
        textColor={crew.theme.palette.textPrimary}
        borderColor={crew.theme.palette.borderSoft}
        theme={crew.theme}
      />
    </main>
  );
}
