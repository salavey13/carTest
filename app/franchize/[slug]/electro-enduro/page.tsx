import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { CatalogClient } from "../../components/CatalogClient";
import { type CatalogItemVM, getFranchizeBySlug } from "../../actions";
import { crewPaletteForSurface } from "../../lib/theme";
import Link from "next/link";
import { fallbackBikes } from "../configurator/fallback-catalog";

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
  "sequence-zero",
  "seqvenz-zero",
  "falcon-gt-2025",
  "500gt",
]);
const RENT_ID_OVERRIDES = new Set([
  "sequence-zero",
  "seqvenz-zero",
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
    .filter((item) => item.id.toLowerCase().includes("sequence-zero"))
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
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader
        crew={crew}
        activePath={`/franchize/${crew.slug || slug}/electro-enduro`}
        groupLinks={saleItems.map((item) => item.category)}
      />
      <section className="mx-auto w-full max-w-7xl px-4 pt-6 2xl:max-w-[1600px]">
        <div className="rounded-3xl border border-white/15 bg-black/30 p-5 backdrop-blur-sm sm:p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-white/60">
            Electro-Enduro flow
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
            Electro-enduro: два сценария в одном каталоге
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-white/75 sm:text-base">
            Для быстрого старта удобно взять байк в аренду и оценить поведение
            на маршруте. Для заказа в собственность используйте конфигуратор:
            параметры, комплектация и оформление идут отдельным потоком.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-emerald-300/35 bg-emerald-950/70 p-4 text-white shadow-lg shadow-black/20">
              <h2 className="text-lg font-medium">Аренда / тест-драйв</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/80">
                <li>Быстрый старт для знакомства с техникой.</li>
                <li>
                  Подходит для сравнения нескольких моделей перед покупкой.
                </li>
                <li>Маршрутный формат и базовый инструктаж перед выездом.</li>
              </ul>
              <Link
                className="mt-4 inline-flex rounded-xl border border-white/30 px-3 py-2 text-sm hover:bg-white hover:text-black"
                href={`/franchize/${crew.slug || slug}`}
              >
                Открыть каталог аренды
              </Link>
            </article>
            <article className="rounded-2xl border border-amber-300/35 bg-amber-950/75 p-4 text-white shadow-lg shadow-black/20">
              <h2 className="text-lg font-medium">
                Продажа / кастомная сборка
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/80">
                <li>
                  Выбор батареи, мощности, подвески и дополнительных опций.
                </li>
                <li>Отдельный flow: конфигурация → корзина → заказ.</li>
                <li>Лучше для тех, кто ищет байк в постоянное владение.</li>
              </ul>
              <Link
                className="mt-4 inline-flex rounded-xl border border-white/30 px-3 py-2 text-sm hover:bg-white hover:text-black"
                href={`/franchize/${crew.slug || slug}/configurator`}
              >
                Перейти в конфигуратор
              </Link>
            </article>
          </div>
        </div>
      </section>
      <section className="mx-auto w-full max-w-7xl px-4 pt-6 2xl:max-w-[1600px]">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <article className="rounded-3xl border border-emerald-300/35 bg-emerald-950/70 p-5 text-white shadow-lg shadow-black/20">
            <h3 className="text-xl font-semibold">
              Группа аренды (test-ride friendly)
            </h3>
            <p className="mt-2 text-sm text-white/75">
              Включает модели для первого знакомства и коротких прокатных
              сессий.
            </p>
            <div className="mt-4 space-y-2">
              {rentPreview.map((item) => (
                <Link
                  key={item.id}
                  href={`/franchize/${crew.slug || slug}/electro-enduro?vehicle=${item.id}`}
                  className="flex items-center justify-between rounded-xl border border-white/20 px-3 py-2 text-sm hover:bg-white hover:text-black"
                >
                  <span>{item.title}</span>
                  <span className="text-xs opacity-80">
                    {item.pricePerDay} ₽/день
                  </span>
                </Link>
              ))}
            </div>
          </article>
          <article className="rounded-3xl border border-amber-300/35 bg-amber-950/75 p-5 text-white shadow-lg shadow-black/20">
            <h3 className="text-xl font-semibold">
              Группа продажи (build-to-order)
            </h3>
            <p className="mt-2 text-sm text-white/75">
              Фокус на кастомизации и заказе модели в конфигураторе.
            </p>
            <div className="mt-4 space-y-2">
              {salePreview.map((item) => (
                <Link
                  key={item.id}
                  href={`/franchize/${crew.slug || slug}/configurator?vehicle=${item.id}`}
                  className="flex items-center justify-between rounded-xl border border-white/20 px-3 py-2 text-sm hover:bg-white hover:text-black"
                >
                  <span>{item.title}</span>
                  <span className="text-xs opacity-80">
                    {item.pricePerDay} ₽/день
                  </span>
                </Link>
              ))}
            </div>
          </article>
        </div>
      </section>
      {accessoryHighlights.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 pt-6 2xl:max-w-[1600px]">
          <div className="rounded-3xl border border-white/15 bg-white/5 p-5 text-white">
            <h3 className="text-xl font-semibold">
              Экип и аксессуары из текущих спецификаций
            </h3>
            <p className="mt-2 text-sm text-white/75">
              Ниже карточки, которые уже встречаются в спецификациях моделей.
              Это помогает быстро проверить, что входит в комплект и что стоит
              добавить к заказу.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {accessoryHighlights.map((entry) => (
                <div
                  key={entry}
                  className="rounded-xl border border-white/20 px-3 py-2 text-sm text-white/85"
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
          <div className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-white/80">
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
      <CrewFooter crew={crew} />
    </main>
  );
}
