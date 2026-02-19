import Image from "next/image";
import { CrewFooter } from "../components/CrewFooter";
import { CrewHeader } from "../components/CrewHeader";
import { FloatingCartIconLink } from "../components/FloatingCartIconLink";
import { getFranchizeBySlug } from "../actions";

interface FranchizeSlugPageProps {
  params: Promise<{ slug: string }>;
}

const toCategoryId = (category: string) => `category-${category.toLowerCase().replace(/\s+/g, "-")}`;

export default async function FranchizeSlugPage({ params }: FranchizeSlugPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);

  const orderedCategories = Array.from(
    new Set([...crew.catalog.categories, ...items.map((item) => item.category).filter(Boolean)]),
  );

  const itemsByCategory = orderedCategories
    .map((category) => ({
      category,
      items: items.filter((item) => item.category === category),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}`} />

      <section className="mx-auto w-full max-w-4xl px-4 py-6" id="catalog-sections">
        {!crew.isFound && (
          <p className="mb-4 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: crew.theme.palette.accentMain, color: crew.theme.palette.accentMain }}>
            Crew slug was not found. Rendering safe fallback shell.
          </p>
        )}

        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Каталог (bike only)</h1>
          <span className="text-xs text-muted-foreground">/franchize/{crew.slug || slug}</span>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            No bike catalog items yet. Add `type=bike` cars to this crew to hydrate the catalog.
          </div>
        ) : (
          <div className="space-y-6">
            {itemsByCategory.map((group) => (
              <section key={group.category} id={toCategoryId(group.category)}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: crew.theme.palette.accentMain }}>
                  {group.category}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {group.items.map((item) => (
                    <article key={item.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                      <div className="relative h-28 w-full">
                        {item.imageUrl ? (
                          <Image src={item.imageUrl} alt={item.title} fill sizes="(max-width: 768px) 50vw, 280px" className="object-cover" unoptimized />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-muted-foreground">Изображение байка скоро загрузим</div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="mt-1 text-sm font-semibold leading-5">{item.title}</h3>
                        <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                        <p className="mt-3 text-sm font-medium">{item.pricePerDay} ₽ / day</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
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
