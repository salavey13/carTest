import Link from "next/link";
import { notFound } from "next/navigation";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import { CrewFooter } from "@/app/franchize/components/CrewFooter";
import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { FranchizeFloatingCart } from "@/app/franchize/components/FranchizeFloatingCart";
import { FranchizeHero } from "@/app/franchize/components/FranchizeHero";
import { FranchizePageShell } from "@/app/franchize/components/FranchizePageShell";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";
import { SaleBikeLanding } from "@/app/franchize/components/SaleBikeLanding";
import { isSameCatalogPropulsion } from "@/app/franchize/lib/catalog-propulsion";
import { buildSaleBuySectionId } from "@/app/franchize/lib/sale-anchors";

interface BuyBikePageProps {
  params: Promise<{ slug: string; bike_id: string }>;
  searchParams?: Promise<{ vs?: string }>;
}

const isSaleEnabled = (value: unknown) =>
  value === 1 ||
  value === true ||
  String(value).toLowerCase() === "1" ||
  String(value).toLowerCase() === "true";

export default async function BuyBikePage({
  params,
  searchParams,
}: BuyBikePageProps) {
  const { slug, bike_id } = await params;
  const { vs } = (await searchParams) ?? {};
  const { crew, items } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const surface = crewPaletteForSurface(crew.theme);
  const item = items.find((candidate) => candidate.id === bike_id);

  if (!item) notFound();
  const buySectionId = buildSaleBuySectionId(item.id);
  if (!item.saleAvailable && !isSaleEnabled(item.rawSpecs?.sale)) {
    return (
      <main
        className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 p-6 text-center"
        style={surface.page}
      >
        <h1 className="text-2xl font-semibold">
          Этот байк не помечен как продажа
        </h1>
        <p className="text-sm opacity-80">
          Откройте карточку через маркет и выберите аренду.
        </p>
        <Link
          href={`/franchize/${resolvedSlug}?vehicle=${encodeURIComponent(bike_id)}&flow=rent`}
          className="rounded-xl border px-4 py-2 text-sm font-semibold"
        >
          Вернуться в маркет
        </Link>
      </main>
    );
  }

  const otherSaleBikes = items.filter(
    (candidate) =>
      candidate.id !== item.id &&
      (candidate.saleAvailable || isSaleEnabled(candidate.rawSpecs?.sale)) &&
      isSameCatalogPropulsion(item, candidate),
  );
  const vsItem = vs
    ? (otherSaleBikes.find((candidate) => candidate.id === vs) ?? null)
    : null;

  return (
    <main
      className="min-h-screen"
      style={surface.page}
    >
      <CrewHeader
        crew={crew}
        activePath={`/franchize/${resolvedSlug}/market/${bike_id}/buy`}
        groupLinks={items.map((candidate) => candidate.category)}
      />
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-6">
        <FranchizeHero
          eyebrow={`/franchize/${resolvedSlug}/market/${bike_id}/buy · sale`}
          title={`Покупка · ${item.title}`}
          subcopy="Операторская витрина продажи: сравнение, конфигурация, тест-драйв и быстрый возврат в маркет без потери бренда экипажа."
          primaryCta={{ label: "Настроить покупку", href: `#${buySectionId}` }}
          secondaryCta={{ label: "Вернуться в маркет", href: `/franchize/${resolvedSlug}?vehicle=${encodeURIComponent(bike_id)}` }}
        />
      </FranchizePageShell>
      <SaleBikeLanding
        crew={crew}
        item={item}
        vsItem={vsItem}
        otherSaleBikes={otherSaleBikes}
      />
      <CrewFooter crew={crew} />
      <FranchizeFloatingCart
        slug={resolvedSlug}
        href={`/franchize/${resolvedSlug}/cart`}
        items={items}
        accentColor={crew.theme.palette.accentMain}
        textColor={crew.theme.palette.textPrimary}
        borderColor={crew.theme.palette.borderSoft}
        theme={crew.theme}
      />
    </main>
  );
}
