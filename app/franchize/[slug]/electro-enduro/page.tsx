import type { Metadata } from "next";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { CatalogClient } from "../../components/CatalogClient";
import { FranchizeCatalogHero } from "../../components/FranchizeCatalogHero";
import { ThemeInitializer } from "../../components/ThemeInitializer";
import { type CatalogItemVM, getFranchizeBySlug } from "../../actions";
import { crewPaletteForSurface, readablePaletteTextOnColor, withAlpha } from "../../lib/theme";
import Link from "next/link";
import { fallbackBikes } from "../configurator/fallback-catalog";
import { buildFranchizeSectionMetadata } from "../metadata";

interface ElectroEnduroPageProps {
  params: Promise<{ slug: string }>;
}

const isSaleEnabled = (value: unknown) =>
  value === 1 ||
  value === true ||
  String(value).toLowerCase() === "1" ||
  String(value).toLowerCase() === "true";
const isRentEnabled = (value: unknown) =>
  value === 1 ||
  value === true ||
  String(value).toLowerCase() === "1" ||
  String(value).toLowerCase() === "true";
const SALE_ID_OVERRIDES = new Set([
  "falcon-gt-2025",
  "500gt",
]);
const RENT_ID_OVERRIDES = new Set([
  "falcon-gt-2025",
  "500gt",
]);
const ACCESSORY_KEYWORDS = [
  "шлем",
  "перчат",
  "ботин",
  "джерси",
  "защит",
  "черепах",
  "колен",
  "helmet",
  "glove",
  "boots",
  "jersey",
  "armor",
  "knee",
];

const emptyReviewSummary = { average: 0, count: 0, reviews: [] };

const configuratorFallbackItems = (): CatalogItemVM[] =>
  fallbackBikes.slice(0, 8).map((bike, index) => ({
    id: bike.id,
    title: `${bike.make} ${bike.model}`.trim(),
    subtitle: String(bike.specs.subtitle ?? "Electro-Enduro build-to-order"),
    description: bike.description,
    imageUrl: bike.image_url,
    mediaUrls: Array.from(
      new Set([bike.image_url, ...(bike.specs.gallery ?? [])]),
    ),
    pricePerDay: bike.daily_price,
    rentPriceLabel: `${bike.daily_price.toLocaleString("ru-RU")} ₽ / база`,
    category: index < 4 ? "Electro-Enduro" : "VipBike Custom",
    availabilityStatus: "available" as const,
    availabilityLabel: "Доступен для расчёта и предзаказа",
    isHot: index < 2,
    saleAvailable: true,
    salePrice: bike.daily_price,
    reviewSummary: emptyReviewSummary,
    rawSpecs: {
      ...bike.specs,
      sale: true,
      rent: true,
      fallback_source: "configurator-fallback",
    },
    specs: [
      { label: "power", value: `${bike.specs.power_w}W` },
      { label: "speed", value: `${bike.specs.max_speed_kmh} км/ч` },
      { label: "tier", value: String(bike.specs.tier ?? "standard") },
    ],
  }));


export async function generateMetadata({ params }: ElectroEnduroPageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Электро-эндуро",
    sectionDescription: "Электро-эндуро витрина экипажа: аренда, тест-драйв, покупка и сборка кастомного байка.",
    pathSuffix: "/electro-enduro",
    image: ({ items }) => items.find((item) => item.imageUrl && (item.category.toLowerCase().includes("electro") || item.title.toLowerCase().includes("electro") || item.title.toLowerCase().includes("электро")))?.imageUrl,
    imageAlt: ({ crew }) => `${crew.header.brandName} electro-enduro preview`,
  });
}

export default async function ElectroEnduroPage({
  params,
}: ElectroEnduroPageProps) {
  const { slug } = await params;
  const hydrated = await getFranchizeBySlug(slug);
  const shouldUseVipBikeFallback =
    (slug === "vip-bike" || hydrated.crew.slug === "vip-bike") &&
    (!hydrated.crew.isFound || hydrated.items.length === 0);
  const crew = shouldUseVipBikeFallback
    ? {
        ...hydrated.crew,
        slug: "vip-bike",
        name: "VIP_BIKE",
        description:
          "Electro-Enduro витрина: аренда, тест-драйв и сборка электробайка.",
        isFound: true,
        header: {
          ...hydrated.crew.header,
          brandName: "VIP BIKE RENTAL",
          tagline: "Electro-Enduro rental + custom builds",
          logoHref: "/vipbikerental",
        },
        contacts: {
          ...hydrated.crew.contacts,
          telegram: hydrated.crew.contacts.telegram || "I_O_S_NN",
        },
        footer: {
          ...hydrated.crew.footer,
          socialLinks: hydrated.crew.footer.socialLinks.length
            ? hydrated.crew.footer.socialLinks
            : [{ label: "Telegram", href: "https://t.me/I_O_S_NN" }],
        },
      }
    : hydrated.crew;
  const items = shouldUseVipBikeFallback
    ? configuratorFallbackItems()
    : hydrated.items;
  const surface = crewPaletteForSurface(crew.theme);
  const accentText = readablePaletteTextOnColor(crew.theme.palette.accentMain, crew.theme.palette);
  const saleItems = items.filter((item) => {
    const id = item.id.toLowerCase();
    return (
      item.saleAvailable ||
      isSaleEnabled(item.rawSpecs?.sale) ||
      SALE_ID_OVERRIDES.has(id)
    );
  });
  const rentItems = items.filter((item) => {
    const id = item.id.toLowerCase();
    return (
      item.availabilityStatus === "available" ||
      isRentEnabled(item.rawSpecs?.rent) ||
      RENT_ID_OVERRIDES.has(id)
    );
  });
  const featuredRentItems = rentItems
    .filter((item) => item.id.toLowerCase().includes("seqvens-zero"))
    .slice(0, 3);
  const featuredSaleItems = saleItems
    .filter((item) => item.id.toLowerCase().includes("falcon-gt-2025"))
    .slice(0, 3);
  const rentPreview =
    featuredRentItems.length > 0 ? featuredRentItems : rentItems.slice(0, 3);
  const salePreview =
    featuredSaleItems.length > 0 ? featuredSaleItems : saleItems.slice(0, 3);
  const accessoryHighlights = Array.from(
    new Set(
      items
        .flatMap((item) => [
          ...item.specs.map((spec) => `${spec.label}: ${spec.value}`),
          ...(Array.isArray(item.rawSpecs?.accessories)
            ? (item.rawSpecs?.accessories as unknown[]).map(String)
            : []),
        ])
        .filter((entry) =>
          ACCESSORY_KEYWORDS.some((keyword) =>
            entry.toLowerCase().includes(keyword),
          ),
        ),
    ),
  ).slice(0, 8);

  return (
    <main
      className="min-h-screen text-[var(--enduro-text)]"
      style={{
        ...surface.page,
        ["--enduro-accent" as string]: crew.theme.palette.accentMain,
        ["--enduro-accent-text" as string]: accentText,
        ["--enduro-border" as string]: crew.theme.palette.borderSoft,
        ["--enduro-text" as string]: crew.theme.palette.textPrimary,
        ["--enduro-muted" as string]: crew.theme.palette.textSecondary,
        ["--enduro-card" as string]: surface.subtleCard.backgroundColor,
        ["--enduro-card-faint" as string]: withAlpha(crew.theme.palette.bgCard, 0.7),
        ["--enduro-card-soft" as string]: withAlpha(crew.theme.palette.bgCard, 0.48),
        ["--enduro-accent-faint" as string]: withAlpha(crew.theme.palette.accentMain, 0.12),
      }}
    >
      <ThemeInitializer defaultTheme="light" />
      <CrewHeader
        crew={crew}
        activePath={`/franchize/${crew.slug || slug}/electro-enduro`}
        groupLinks={saleItems.map((item) => item.category)}
      />
      <FranchizeCatalogHero crew={crew} slug={crew.slug || slug} variant="electro-enduro" />
      {accessoryHighlights.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 pt-6 2xl:max-w-[1600px]">
          <div className="rounded-3xl border border-[var(--enduro-border)] bg-[var(--enduro-card-soft)] p-5 text-[var(--enduro-text)]">
            <h3 className="text-xl font-semibold">
              Экип и аксессуары из текущих спецификаций
            </h3>
            <p className="mt-2 text-sm text-[var(--enduro-muted)]">
              Ниже карточки, которые уже встречаются в спецификациях моделей.
              Это помогает быстро проверить, что входит в комплект и что стоит
              добавить к заказу.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {accessoryHighlights.map((entry) => (
                <div
                  key={entry}
                  className="rounded-xl border border-[var(--enduro-border)] px-3 py-2 text-sm text-[var(--enduro-text)]"
                >
                  {entry}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      {shouldUseVipBikeFallback && (
        <section className="mx-auto w-full max-w-7xl px-4 pt-6 2xl:max-w-[1600px]">
          <div className="rounded-2xl border border-[var(--enduro-border)] bg-[var(--enduro-accent-faint)] p-4 text-sm text-[var(--enduro-muted)]">
            Live crew hydration is temporarily unavailable, so this page is
            using the VipBike configurator fallback catalog instead of an empty
            showroom.
          </div>
        </section>
      )}
      <CatalogClient
        crew={crew}
        slug={crew.slug || slug}
        items={saleItems}
        mode="electro"
      />
      {/* Intro section moved below catalog per UX requirements */}
      <section className="mx-auto w-full max-w-5xl px-4 py-6 sm:max-w-6xl lg:max-w-7xl 2xl:max-w-[1600px]">
        <div className="mx-auto rounded-3xl border border-[var(--enduro-border)] bg-[var(--enduro-card)] p-5 backdrop-blur-sm sm:p-8 lg:max-w-4xl">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--enduro-muted)]">
            Electro-Enduro flow
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--enduro-text)] sm:text-3xl">
            Electro-enduro: два сценария в одном каталоге
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-[var(--enduro-muted)] sm:text-base">
            Для быстрого старта удобно взять байк в аренду и оценить поведение
            на маршруте. Для заказа в собственность используйте конфигуратор:
            параметры, комплектация и оформление идут отдельным потоком.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-2">
            <article className="flex flex-col rounded-2xl border border-[var(--enduro-border)] bg-[var(--enduro-card-soft)] p-5 text-[var(--enduro-text)] shadow-lg transition-all hover:shadow-xl">
              <h2 className="text-lg font-medium">Аренда / тест-драйв</h2>
              <ul className="mt-3 flex-1 list-disc space-y-2 pl-5 text-sm text-[var(--enduro-muted)]">
                <li>Быстрый старт для знакомства с техникой.</li>
                <li>
                  Подходит для сравнения нескольких моделей перед покупкой.
                </li>
                <li>Маршрутный формат и базовый инструктаж перед выездом.</li>
              </ul>
              <div className="mt-4 inline-flex rounded-xl border border-[var(--enduro-border)] bg-[var(--enduro-accent-faint)] px-4 py-2 text-sm font-medium text-[var(--enduro-accent)]">
                Вы находитесь в каталоге аренды
              </div>
            </article>
            <article className="flex flex-col rounded-2xl border border-[var(--enduro-border)] bg-[var(--enduro-card-soft)] p-5 text-[var(--enduro-text)] shadow-lg transition-all hover:shadow-xl">
              <h2 className="text-lg font-medium">
                Продажа / кастомная сборка
              </h2>
              <ul className="mt-3 flex-1 list-disc space-y-2 pl-5 text-sm text-[var(--enduro-muted)]">
                <li>
                  Выбор батареи, мощности, подвески и дополнительных опций.
                </li>
                <li>Отдельный flow: конфигурация → корзина → заказ.</li>
                <li>Лучше для тех, кто ищет байк в постоянное владение.</li>
              </ul>
              <Link
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-[var(--enduro-accent)] bg-[var(--enduro-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--enduro-accent-text)] transition-all hover:opacity-90 sm:w-auto"
                href={`/franchize/${crew.slug || slug}/configurator`}
              >
                Перейти в конфигуратор
              </Link>
            </article>
          </div>
        </div>
      </section>
      <CrewFooter crew={crew} />
    </main>
  );
}
