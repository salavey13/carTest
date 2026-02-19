import Link from "next/link";
import { getFranchizeBySlug } from "../../actions";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { FloatingCartIconLink } from "../../components/FloatingCartIconLink";

interface FranchizeCartPageProps {
  params: Promise<{ slug: string }>;
}

export default async function FranchizeCartPage({ params }: FranchizeCartPageProps) {
  const { slug } = await params;
  const { crew } = await getFranchizeBySlug(slug);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/cart`} />
      <section className="mx-auto w-full max-w-4xl px-4 py-6">
        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: crew.theme.palette.accentMain }}>
          /franchize/{crew.slug || slug}/cart
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Franchize Cart</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cart skeleton is ready for hydration. Quantity controls and order wiring will be implemented in the next tasks.
        </p>
        <div
          className="mt-6 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground"
        >
          Cart is currently empty.
        </div>
        <Link href={`/franchize/${crew.slug || slug}`} className="mt-4 inline-flex text-sm underline-offset-4 hover:underline" style={{ color: crew.theme.palette.accentMain }}>
          Back to crew catalog
        </Link>
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
