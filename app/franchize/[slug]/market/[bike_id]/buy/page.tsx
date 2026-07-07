import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import { CrewFooter } from "@/app/franchize/components/CrewFooter";
import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { FranchizeFloatingCart } from "@/app/franchize/components/FranchizeFloatingCart";
import { FranchizeHero } from "@/app/franchize/components/FranchizeHero";
import { FranchizePageShell } from "@/app/franchize/components/FranchizePageShell";
import { getTelegramHandleHref, getTelegramWebAppPageHref } from "@/app/franchize/lib/telegram-links";
import { getFranchizeRouteCtaPolicy, shouldShowFloatingCart } from "@/app/franchize/lib/route-cta-policy";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";
import { SaleBikeLanding } from "@/app/franchize/components/SaleBikeLanding";
import { isSameCatalogPropulsion } from "@/app/franchize/lib/catalog-propulsion";
import { buildSaleBuySectionId } from "@/app/franchize/lib/sale-anchors";
import {
  buildFranchizeSectionMetadata,
  findCatalogItemImage,
} from "../../../metadata";

interface BuyBikePageProps {
  params: Promise<{ slug: string; bike_id: string }>;
  searchParams?: Promise<{ vs?: string }>;
}

const isSaleEnabled = (value: unknown) =>
  value === 1 ||
  value === true ||
  String(value).toLowerCase() === "1" ||
  String(value).toLowerCase() === "true";

export async function generateMetadata({
  params,
}: BuyBikePageProps): Promise<Metadata> {
  const { slug, bike_id } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: ({ items }) => {
      const item = items.find((candidate) => candidate.id === bike_id);
      return item ? `Покупка · ${item.title}` : "Покупка байка";
    },
    sectionDescription: ({ items }) => {
      const item = items.find((candidate) => candidate.id === bike_id);
      return item
        ? `Покупка ${item.title}: характеристики, сравнение, тест-драйв и заявка экипажу.`
        : "Страница покупки выбранного байка: характеристики, сравнение, тест-драйв и заявка экипажу.";
    },
    pathSuffix: `/market/${bike_id}/buy`,
    ogTitle: ({ items, crew }) => {
      const item = items.find((candidate) => candidate.id === bike_id);
      return item
        ? `Купить ${item.title} · ${crew.header.brandName}`
        : "Покупка байка в экипаже oneSitePls";
    },
    ogDescription: ({ items }) => {
      const item = items.find((candidate) => candidate.id === bike_id);
      return item
        ? `Открой карточку ${item.title}, сравни комплектацию и отправь заявку на покупку.`
        : "Открой карточку выбранного байка, сравни комплектацию и отправь заявку на покупку.";
    },
    image: ({ items }) => findCatalogItemImage(items, bike_id),
    imageAlt: ({ items, crew }) =>
      items.find((item) => item.id === bike_id)?.title ||
      `${crew.header.brandName} bike preview`,
  });
}

export default async function BuyBikePage({
  params,
  searchParams,
}: BuyBikePageProps) {
  const { slug, bike_id } = await params;
  const { vs } = (await searchParams) ?? {};
  const { crew, items } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const surface = crewPaletteForSurface(crew.theme);
  const ctaPolicy = getFranchizeRouteCtaPolicy("product-buy");
  const item = items.find((candidate) => candidate.id === bike_id);
  const contactHref = `/franchize/${resolvedSlug}/contacts`;
  const catalogHref = `/franchize/${resolvedSlug}`;
  const profileHref = getTelegramWebAppPageHref(`franchize/${resolvedSlug}/profile`, crew.contacts.telegramBotUsername) || `/franchize/${resolvedSlug}/profile`;
  const telegramHref = getTelegramHandleHref(crew.contacts.telegram);

  if (!item) notFound();
  const buySectionId = buildSaleBuySectionId(item.id);
  if (!item.saleAvailable && !isSaleEnabled(item.rawSpecs?.sale)) {
    return (
      <main
          className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 p-6 text-center"
        style={surface.page}
      >
        <h1 className="text-2xl font-semibold">
          Этот байк сейчас не продаётся
        </h1>
        <p className="text-sm opacity-80">
          Продажная карточка недоступна: позиция могла остаться только для
          аренды или временно уйти на проверку документов.
        </p>
        <div className="grid w-full gap-2 sm:grid-cols-2">
          <Link
            href={`/franchize/${resolvedSlug}?vehicle=${encodeURIComponent(bike_id)}&flow=rent`}
            className="rounded-xl border px-4 py-2 text-sm font-semibold"
          >
            Вернуться в каталог
          </Link>
          <Link
            href={profileHref}
            className="rounded-xl border px-4 py-2 text-sm font-semibold"
          >
            В профиль
          </Link>
          <a
            href={telegramHref}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border px-4 py-2 text-sm font-semibold"
          >
            Написать в Telegram
          </a>
          <Link
            href={contactHref}
            className="rounded-xl border px-4 py-2 text-sm font-semibold"
          >
            Поддержка / контакты
          </Link>
        </div>
        <p className="text-xs opacity-70">
          Оплата и договор не запускаются, пока оператор не подтвердит продажный
          статус байка.
        </p>
      </main>
    );
  }

  const showFloatingCart = shouldShowFloatingCart(ctaPolicy, { cartRelevant: true, hasItemContext: true });

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
    <main className={`min-h-screen ${ctaPolicy.pageBottomSafeAreaClassName}`} style={surface.page}>
      <CrewHeader
        crew={crew}
        activePath={`/franchize/${resolvedSlug}/market/${bike_id}/buy`}
        groupLinks={items.map((candidate) => candidate.category)}
        items={items}
      />
      <SaleBikeLanding
        crew={crew}
        item={item}
        vsItem={vsItem}
        otherSaleBikes={otherSaleBikes}
      />
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-6">
        <FranchizeHero
          eyebrow={`/franchize/${resolvedSlug}/market/${bike_id}/buy · sale`}
          title={`Покупка · ${item.title}`}
          subcopy="Операторская витрина продажи: сравнение, конфигурация, тест-драйв и быстрый возврат в маркет без потери бренда экипажа."
          primaryCta={{ label: "Настроить покупку", href: `#${buySectionId}` }}
          secondaryCta={{
            label: "Вернуться в маркет",
            href: `/franchize/${resolvedSlug}?vehicle=${encodeURIComponent(bike_id)}`,
          }}
        />
      </FranchizePageShell>
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-6">
        <section className="rounded-3xl border p-4" style={surface.subtleCard}>
          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-[0.16em]"
                style={{ color: crew.theme.isAuto ? "var(--franchize-accent-main)" : crew.theme.palette.accentMain }}
              >
                Что будет дальше
              </p>
              <ol className="mt-3 space-y-2 text-sm">
                {[
                  `Сравните комплектацию ${item.title} и выберите конфигурацию покупки.`,
                  "Передайте заявку в Telegram: оператор закрепит тест-драйв, цену и резерв.",
                  "Договор, предоплата и передача байка подтверждаются только после ручной проверки документов.",
                ].map((step, index) => (
                  <li key={step} className="flex gap-2">
                    <span
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={{
                        backgroundColor: crew.theme.isAuto
                          ? "var(--franchize-accent-main)"
                          : `${crew.theme.palette.accentMain}24`,
                        color: crew.theme.isAuto ? "var(--franchize-accent-main)" : crew.theme.palette.accentMain,
                      }}
                    >
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <p
                className="mt-3 rounded-2xl border p-3 text-xs"
                style={{
                  ...surface.card,
                  borderColor: crew.theme.isAuto ? "var(--franchize-border-soft)" : crew.theme.palette.borderSoft,
                }}
              >
                Безопасность сделки: маркет не списывает деньги сам по себе,
                договор и платёж подтверждаются оператором, а спорные правки
                фиксируются в Telegram-переписке.
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <a
                href={telegramHref}
                target="_blank"
                rel="noreferrer"
                className="flex justify-center rounded-xl px-4 py-3 font-semibold"
                style={{
                  backgroundColor: crew.theme.isAuto ? "var(--franchize-accent-main)" : crew.theme.palette.accentMain,
                  color: crew.theme.isAuto
                    ? (crew.theme.palettes?.light?.accentTextOn || crew.theme.palettes?.dark?.accentTextOn || crew.theme.palette.accentTextOn)
                    : crew.theme.palette.accentTextOn,
                }}
              >
                Написать оператору в Telegram
              </a>
              <Link
                href={contactHref}
                className="flex justify-center rounded-xl border px-4 py-3"
                style={{
                  borderColor: crew.theme.isAuto ? "var(--franchize-border-soft)" : crew.theme.palette.borderSoft,
                  color: crew.theme.isAuto ? "var(--franchize-text-primary)" : crew.theme.palette.textPrimary,
                }}
              >
                Поддержка / контакты
              </Link>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={catalogHref}
                  className="rounded-xl border px-3 py-2 text-center text-xs"
                  style={{ borderColor: crew.theme.isAuto ? "var(--franchize-border-soft)" : crew.theme.palette.borderSoft }}
                >
                  Каталог
                </Link>
                <Link
                  href={profileHref}
                  className="rounded-xl border px-3 py-2 text-center text-xs"
                  style={{ borderColor: crew.theme.isAuto ? "var(--franchize-border-soft)" : crew.theme.palette.borderSoft }}
                >
                  Профиль
                </Link>
              </div>
            </div>
          </div>
        </section>
      </FranchizePageShell>
      <CrewFooter crew={crew} />
      {showFloatingCart && (
        <FranchizeFloatingCart
          slug={resolvedSlug}
          href={`/franchize/${resolvedSlug}/cart`}
          items={items}
          accentColor={crew.theme.isAuto ? "var(--franchize-accent-main)" : crew.theme.palette.accentMain}
          textColor={crew.theme.isAuto ? "var(--franchize-text-primary)" : crew.theme.palette.textPrimary}
          borderColor={crew.theme.isAuto ? "var(--franchize-border-soft)" : crew.theme.palette.borderSoft}
          theme={crew.theme}
          className={ctaPolicy.floatingCartClassName}
        />
      )}
    </main>
  );
}
