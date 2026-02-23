import Link from "next/link";
import { getFranchizeBySlug } from "../../actions";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizeRentalsBridge } from "../../components/FranchizeRentalsBridge";

interface FranchizeRentalsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function FranchizeRentalsPage({ params }: FranchizeRentalsPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);

  return (
    <>
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/rentals`} groupLinks={items.map((item) => item.category)} />
      <section className="mx-auto w-full max-w-4xl px-4 pt-6">
        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: crew.theme.palette.accentMain }}>
          /franchize/{slug}/rentals
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Мои аренды · Franchize shell</h1>
        <p className="mt-2 text-sm" style={{ color: crew.theme.palette.textSecondary }}>
          Полноценный rentals control-center в franchize оболочке: используем существующий движок, но сохраняем бренд и навигацию экипажа.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href={`/franchize/${crew.slug || slug}`} className="underline underline-offset-4" style={{ color: crew.theme.palette.accentMain }}>
            ← Вернуться в каталог
          </Link>
          <Link href="/rentals" className="underline underline-offset-4" style={{ color: crew.theme.palette.accentMain }}>
            Открыть классический /rentals
          </Link>
        </div>

        <FranchizeRentalsBridge />
      </section>
      <CrewFooter crew={crew} />
    </>
  );
}
