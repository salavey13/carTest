import { CrewFooter } from "../components/CrewFooter";
import { CrewHeader } from "../components/CrewHeader";
import { CatalogClient } from "../components/CatalogClient";
import { getFranchizeBySlug } from "../actions";

interface FranchizeSlugPageProps {
  params: Promise<{ slug: string }>;
}

export default async function FranchizeSlugPage({ params }: FranchizeSlugPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}`} />
      <CatalogClient crew={crew} slug={slug} items={items} />
      <CrewFooter crew={crew} />
    </main>
  );
}
