import Link from "next/link";

interface FranchizeCartPageProps {
  params: Promise<{ slug: string }>;
}

export default async function FranchizeCartPage({ params }: FranchizeCartPageProps) {
  const { slug } = await params;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-400">/franchize/{slug}/cart</p>
        <h1 className="mt-2 text-2xl font-semibold">Franchize Cart</h1>
        <p className="mt-2 text-sm text-zinc-300">
          Cart skeleton is ready for hydration. Quantity controls and order wiring will be implemented in the next tasks.
        </p>
        <div className="mt-6 rounded-xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-400">Cart is currently empty.</div>
        <Link href={`/franchize/${slug}`} className="mt-4 inline-flex text-sm text-amber-400 underline-offset-4 hover:underline">
          Back to crew catalog
        </Link>
      </section>
    </main>
  );
}
