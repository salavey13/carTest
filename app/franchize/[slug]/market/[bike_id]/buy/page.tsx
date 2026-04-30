import Link from "next/link";
import { notFound } from "next/navigation";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";
import { SaleBikeLanding } from "@/app/franchize/components/SaleBikeLanding";

interface BuyBikePageProps {
  params: Promise<{ slug: string; bike_id: string }>;
}

const isSaleEnabled = (value: unknown) => value === 1 || value === true || String(value).toLowerCase() === "1" || String(value).toLowerCase() === "true";

export default async function BuyBikePage({ params }: BuyBikePageProps) {
  const { slug, bike_id } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const item = items.find((candidate) => candidate.id === bike_id);

  if (!item) notFound();
  if (!isSaleEnabled(item.rawSpecs?.sale)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 p-6 text-center" style={crewPaletteForSurface(crew.theme).page}>
        <h1 className="text-2xl font-semibold">Этот байк не помечен как продажа</h1>
        <p className="text-sm opacity-80">Откройте карточку через маркет и выберите аренду.</p>
        <Link href={`/franchize/${slug}?vehicle=${encodeURIComponent(bike_id)}&flow=rent`} className="rounded-xl border px-4 py-2 text-sm font-semibold">Вернуться в маркет</Link>
      </main>
    );
  }

  return <SaleBikeLanding crew={crew} item={item} />;
}
