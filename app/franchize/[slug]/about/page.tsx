import { getFranchizeBySlug } from "../../actions";

interface FranchizeAboutPageProps {
  params: Promise<{ slug: string }>;
}

export default async function FranchizeAboutPage({ params }: FranchizeAboutPageProps) {
  const { slug } = await params;
  const { crew } = await getFranchizeBySlug(slug);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-400">/franchize/{crew.slug || slug}/about</p>
        <h1 className="mt-2 text-2xl font-semibold">About {crew.header.brandName}</h1>
        <p className="mt-2 text-sm text-zinc-300">
          {crew.description || "About page scaffold for franchize runtime. Content blocks will be hydrated from crew metadata in subsequent tasks."}
        </p>
      </section>
    </main>
  );
}
