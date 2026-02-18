interface FranchizeOrderPageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function FranchizeOrderPage({ params }: FranchizeOrderPageProps) {
  const { slug, id } = await params;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-400">/franchize/{slug}/order/{id}</p>
        <h1 className="mt-2 text-2xl font-semibold">Franchize Order (Skeleton)</h1>
        <p className="mt-2 text-sm text-zinc-300">
          This page is intentionally scaffolded. Delivery mode, payment forms, and validation will be added in T6.
        </p>
      </section>
    </main>
  );
}
