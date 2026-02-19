import { getFranchizeBySlug } from "../../../actions";
import { CrewFooter } from "../../../components/CrewFooter";
import { CrewHeader } from "../../../components/CrewHeader";
import { FloatingCartIconLink } from "../../../components/FloatingCartIconLink";

interface FranchizeOrderPageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function FranchizeOrderPage({ params }: FranchizeOrderPageProps) {
  const { slug, id } = await params;
  const { crew } = await getFranchizeBySlug(slug);

  return (
    <main className="min-h-screen" style={{ backgroundColor: crew.theme.palette.bgBase, color: crew.theme.palette.textPrimary }}>
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/order/${id}`} />
      <section className="mx-auto w-full max-w-4xl px-4 py-6">
        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: crew.theme.palette.accentMain }}>
          /franchize/{crew.slug || slug}/order/{id}
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Franchize Order (Skeleton)</h1>
        <p className="mt-2 text-sm" style={{ color: crew.theme.palette.textSecondary }}>
          This page is intentionally scaffolded. Delivery mode, payment forms, and validation will be added in T6.
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
