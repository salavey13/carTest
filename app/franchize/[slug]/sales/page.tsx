import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BatteryCharging, Bike, ClipboardList, RefreshCcw, Sparkles } from "lucide-react";
import { getFranchizeBySlug, type CatalogItemVM } from "@/app/franchize/actions";
import { CrewFooter } from "@/app/franchize/components/CrewFooter";
import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { buildFranchizeIntentLinks } from "@/app/franchize/lib/section-links";
import { crewPaletteForSurface, readablePaletteTextOnColor, withAlpha } from "@/app/franchize/lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";

interface SalesPageProps {
  params: Promise<{ slug: string }>;
}


const isTruthySpec = (value: unknown) => value === true || value === 1 || String(value).toLowerCase() === "true" || String(value).toLowerCase() === "1";

function itemMatchesVertical(item: CatalogItemVM, verticalId: string): boolean {
  const category = `${item.category} ${item.title} ${item.subtitle}`.toLowerCase();
  const specs = item.rawSpecs || {};
  if (verticalId === "electric") return category.includes("electro") || category.includes("электро") || category.includes("e-") || isTruthySpec(specs.electric);
  if (verticalId === "used") return category.includes("used") || category.includes("б/у") || category.includes("пробег") || isTruthySpec(specs.used);
  if (verticalId === "trade-in") return isTruthySpec(specs.trade_in) || isTruthySpec(specs.tradeIn) || category.includes("trade");
  return item.saleAvailable || isTruthySpec(specs.sale) || Number(item.salePrice || 0) > 0;
}

function previewItems(items: CatalogItemVM[], verticalId: string): CatalogItemVM[] {
  const matches = items.filter((item) => itemMatchesVertical(item, verticalId));
  return (matches.length ? matches : items.filter((item) => item.saleAvailable)).slice(0, 3);
}

const verticalIconById = {
  new: Sparkles,
  electric: BatteryCharging,
  used: Bike,
  "trade-in": RefreshCcw,
} as const;

function getVerticalIcon(verticalId: string) {
  return verticalIconById[verticalId as keyof typeof verticalIconById] ?? Sparkles;
}

export async function generateMetadata({ params }: SalesPageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Sales vertical",
    sectionDescription: "Продажи новых, электро, б/у и trade-in байков для франшизной витрины.",
    pathSuffix: "/sales",
  });
}

export default async function FranchizeSalesPage({ params }: SalesPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const crewSlug = crew.slug || slug;
  const activePath = `/franchize/${crewSlug}/sales`;
  const surface = crewPaletteForSurface(crew.theme);
  const brandName = crew.header.brandName || crew.name || "VIP BIKE";
  const saleItems = items.filter((item) => item.saleAvailable || Number(item.salePrice || 0) > 0 || isTruthySpec(item.rawSpecs?.sale));
  const salesVerticals = crew.contentBlocks.salesVerticals;
  const accentText = readablePaletteTextOnColor(crew.theme.palette.accentMain, crew.theme.palette);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={activePath} groupLinks={items.map((item) => item.category)} sectionLinks={buildFranchizeIntentLinks(crewSlug, activePath)} />
      <div
        className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-20 md:pt-24"
        style={{
          ["--sales-accent" as string]: crew.theme.palette.accentMain,
          ["--sales-border" as string]: crew.theme.palette.borderSoft,
          ["--sales-card" as string]: surface.subtleCard.backgroundColor,
          ["--sales-base-soft" as string]: withAlpha(crew.theme.palette.bgBase, 0.25),
          ["--sales-card-faint" as string]: withAlpha(crew.theme.palette.bgCard, 0.55),
          ["--sales-accent-text" as string]: accentText,
          color: crew.theme.palette.textPrimary,
        }}
      >
        <section className="rounded-3xl border border-[var(--sales-border)] bg-[var(--sales-card)] p-6 shadow-2xl md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--sales-accent)]">FRZ-R8 • sales vertical</p>
          <div className="mt-4 grid gap-8 lg:grid-cols-[1.15fr,0.85fr] lg:items-end">
            <div>
              <h1 className="font-orbitron text-4xl leading-tight md:text-6xl">Продажи {brandName}: new / electric / used / trade-in</h1>
              <p className="mt-4 max-w-2xl text-base opacity-70 md:text-lg">
                Страница собирает все продажные сценарии в один операторский вход: от заявки на новый байк до trade-in оценки и электро-конфигуратора.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={`/franchize/${crewSlug}/configurator`} className="rounded-full bg-[var(--sales-accent)] px-5 py-3 text-sm font-semibold text-[var(--sales-accent-text)] transition hover:brightness-110">
                  Открыть конфигуратор
                </Link>
                <Link href={`/franchize/${crewSlug}/onboarding`} className="rounded-full border border-current/20 px-5 py-3 text-sm font-semibold transition hover:border-current/50">
                  Partner checklist
                </Link>
              </div>
            </div>
            <aside className="rounded-3xl border border-[var(--sales-border)] bg-[var(--sales-base-soft)] p-5">
              <div className="flex items-center gap-3 text-[var(--sales-accent)]">
                <ClipboardList className="h-6 w-6" />
                <span className="text-sm font-semibold uppercase tracking-[0.16em]">pipeline snapshot</span>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-[var(--sales-border)] bg-[var(--sales-card-faint)] p-3">
                  <dt className="opacity-55">Продажных SKU</dt>
                  <dd className="mt-1 text-2xl font-semibold text-[var(--sales-accent)]">{saleItems.length}</dd>
                </div>
                <div className="rounded-2xl border border-[var(--sales-border)] bg-[var(--sales-card-faint)] p-3">
                  <dt className="opacity-55">Вертикалей</dt>
                  <dd className="mt-1 text-2xl font-semibold text-[var(--sales-accent)]">{salesVerticals.length}</dd>
                </div>
              </dl>
            </aside>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {salesVerticals.map((vertical) => {
            const Icon = getVerticalIcon(vertical.id);
            const previews = previewItems(items, vertical.id);
            return (
              <article key={vertical.id} className="rounded-3xl border border-[var(--sales-border)] bg-[var(--sales-card)] p-5">
                <div className="flex items-start justify-between gap-3">
                  <Icon className="h-7 w-7 text-[var(--sales-accent)]" />
                  <span className="rounded-full border border-[var(--sales-accent)]/35 px-3 py-1 text-xs text-[var(--sales-accent)]">{vertical.id}</span>
                </div>
                <h2 className="mt-4 text-2xl font-semibold">{vertical.title}</h2>
                <p className="mt-2 text-sm leading-6 opacity-70">{vertical.pitch}</p>
                <div className="mt-4 space-y-2">
                  {previews.map((item) => (
                    <Link key={`${vertical.id}-${item.id}`} href={`/franchize/${crewSlug}/market/${item.id}/buy`} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--sales-border)] bg-[var(--sales-base-soft)] px-3 py-2 text-sm transition hover:border-[var(--sales-accent)]/60">
                      <span className="min-w-0 truncate">{item.title}</span>
                      <span className="shrink-0 text-xs opacity-65">{item.salePrice ? `${item.salePrice.toLocaleString("ru-RU")} ₽` : item.rentPriceLabel}</span>
                    </Link>
                  ))}
                  {!previews.length ? <p className="rounded-2xl border border-dashed border-current/15 p-3 text-sm opacity-60">Добавьте SKU в каталог, чтобы включить карточки этой вертикали.</p> : null}
                </div>
                <Link href={`/franchize/${crewSlug}/contacts?intent=${vertical.id}`} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--sales-accent)]">
                  {vertical.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            );
          })}
        </section>
      </div>
      <CrewFooter crew={crew} />
    </main>
  );
}
