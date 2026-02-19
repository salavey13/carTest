import { getFranchizeBySlug } from "../../actions";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { FloatingCartIconLink } from "../../components/FloatingCartIconLink";

interface FranchizeAboutPageProps {
  params: Promise<{ slug: string }>;
}

export default async function FranchizeAboutPage({ params }: FranchizeAboutPageProps) {
  const { slug } = await params;
  const { crew } = await getFranchizeBySlug(slug);

  return (
    <main className="min-h-screen" style={{ backgroundColor: crew.theme.palette.bgBase, color: crew.theme.palette.textPrimary }}>
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/about`} />
      <section className="mx-auto w-full max-w-4xl px-4 py-6">
        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: crew.theme.palette.accentMain }}>
          /franchize/{crew.slug || slug}/about
        </p>
        <h1 className="mt-2 text-2xl font-semibold">О нас</h1>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: crew.theme.palette.textSecondary }}>
          {crew.description ||
            "About page scaffold for franchize runtime. Content blocks will be hydrated from crew metadata in subsequent tasks."}
        </p>
      </section>
      <CrewFooter crew={crew} />
      <FloatingCartIconLink
        href={`/franchize/${crew.slug || slug}/cart`}
        itemCount={0}
        totalPrice={0}
        accentColor={crew.theme.palette.accentMain}
        textColor={crew.theme.palette.textPrimary}
        borderColor={crew.theme.palette.borderSoft}
      />
    </main>
  );
}
