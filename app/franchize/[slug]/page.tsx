import Link from "next/link";
import { getFranchizeBySlug } from "../actions";

interface FranchizeSlugPageProps {
  params: Promise<{ slug: string }>;
}

export default async function FranchizeSlugPage({ params }: FranchizeSlugPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-400">/franchize/{slug}</p>
          <h1 className="text-2xl font-semibold">{crew.header.brandName}</h1>
          <p className="text-sm text-zinc-300">{crew.description || crew.header.tagline}</p>
          {!crew.isFound && (
            <p className="rounded-lg border border-amber-600/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              Crew slug was not found. Rendering safe fallback shell.
            </p>
          )}
        </header>

        <nav className="flex flex-wrap gap-2">
          {crew.header.menuLinks.map((link) => (
            <Link
              key={`${link.href}-${link.label}`}
              href={link.href.replace("{slug}", crew.slug || slug)}
              className="rounded-full border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-amber-400 hover:text-amber-300"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <section className="grid gap-3 md:grid-cols-2">
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-400">
              No catalog items yet. Add cars to this crew to hydrate the catalog.
              <div className="mt-3">
                <Link href="/franchize/vip-bike" className="text-amber-400 underline-offset-4 hover:underline">
                  Open VIP_BIKE hydration reference
                </Link>
              </div>
            </div>
          ) : (
            items.map((item) => (
              <article key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-amber-400">{item.category}</p>
                <h2 className="mt-1 text-lg font-medium">{item.title}</h2>
                <p className="text-sm text-zinc-400">{item.subtitle}</p>
                <p className="mt-3 text-sm text-zinc-300">{item.pricePerDay} ₽ / day</p>
              </article>
            ))
          )}
        </section>
      </section>
    </main>
  );
}
