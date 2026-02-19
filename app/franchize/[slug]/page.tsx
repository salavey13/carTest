import { CrewFooter } from "../components/CrewFooter";
import { CrewHeader } from "../components/CrewHeader";
import { FloatingCartIconLink } from "../components/FloatingCartIconLink";
import { getFranchizeBySlug } from "../actions";

interface FranchizeSlugPageProps {
  params: Promise<{ slug: string }>;
}

export default async function FranchizeSlugPage({ params }: FranchizeSlugPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);

  return (
    <main className="min-h-screen" style={{ backgroundColor: crew.theme.palette.bgBase, color: crew.theme.palette.textPrimary }}>
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}`} />

      <section className="mx-auto w-full max-w-4xl px-4 py-6">
        {!crew.isFound && (
          <p className="mb-4 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: crew.theme.palette.accentMain, color: crew.theme.palette.accentMain }}>
            Crew slug was not found. Rendering safe fallback shell.
          </p>
        )}

        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Каталог</h1>
          <span className="text-xs" style={{ color: crew.theme.palette.textSecondary }}>
            /franchize/{crew.slug || slug}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {items.length === 0 ? (
            <div
              className="col-span-2 rounded-2xl border border-dashed p-4 text-sm"
              style={{ borderColor: crew.theme.palette.borderSoft, color: crew.theme.palette.textSecondary }}
            >
              No catalog items yet. Add cars to this crew to hydrate the catalog.
            </div>
          ) : (
            items.map((item) => (
              <article
                key={item.id}
                id={`category-${item.category.toLowerCase().replace(/\s+/g, "-")}`}
                className="rounded-2xl border p-3"
                style={{ borderColor: crew.theme.palette.borderSoft, backgroundColor: crew.theme.palette.bgCard }}
              >
                <p className="text-[11px] uppercase tracking-wide" style={{ color: crew.theme.palette.accentMain }}>
                  {item.category}
                </p>
                <h2 className="mt-1 text-sm font-semibold leading-5">{item.title}</h2>
                <p className="text-xs" style={{ color: crew.theme.palette.textSecondary }}>
                  {item.subtitle}
                </p>
                <p className="mt-3 text-sm font-medium">{item.pricePerDay} ₽ / day</p>
              </article>
            ))
          )}
        </div>
      </section>

      <CrewFooter crew={crew} />
      <FloatingCartIconLink
        href={`/franchize/${crew.slug || slug}/cart`}
        itemCount={Math.min(items.length, 9)}
        totalPrice={items.reduce((sum, item) => sum + item.pricePerDay, 0)}
        accentColor={crew.theme.palette.accentMain}
        textColor={crew.theme.palette.textPrimary}
        borderColor={crew.theme.palette.borderSoft}
      />
    </main>
  );
}
