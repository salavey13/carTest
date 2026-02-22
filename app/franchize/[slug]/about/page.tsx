import { getFranchizeBySlug } from "../../actions";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizeFloatingCart } from "../../components/FranchizeFloatingCart";
import { crewPaletteForSurface } from "../../lib/theme";

interface FranchizeAboutPageProps {
  params: Promise<{ slug: string }>;
}

export default async function FranchizeAboutPage({ params }: FranchizeAboutPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const surface = crewPaletteForSurface(crew.theme);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/about`} groupLinks={items.map((item) => item.category)} />
      <section className="mx-auto w-full max-w-4xl px-4 py-6">
        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: crew.theme.palette.accentMain }}>
          /franchize/{crew.slug || slug}/about
        </p>
        <h1 className="mt-2 text-2xl font-semibold">О нас</h1>
        <p className="mt-2 max-w-2xl text-sm" style={surface.mutedText}>
          {crew.description ||
            "Раздел в процессе наполнения. Подробный текст, преимущества и FAQ подгрузятся из метаданных франшизы."}
        </p>
      </section>
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
