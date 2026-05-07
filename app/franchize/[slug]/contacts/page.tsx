import type { Metadata } from "next";
import { MapPinned, MessageCircle, Navigation, Phone, ShieldCheck, Star } from "lucide-react";
import { getFranchizeBySlug } from "../../actions";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { CopyAddressButton } from "../../components/CopyAddressButton";
import { FranchizeFloatingCart } from "../../components/FranchizeFloatingCart";
import { FranchizeHero } from "../../components/FranchizeHero";
import { FranchizePageShell } from "../../components/FranchizePageShell";
import { FranchizeContactsMap } from "../../components/FranchizeContactsMap";
import { getFranchizeRouteCtaPolicy, shouldShowFloatingCart } from "../../lib/route-cta-policy";
import { buildFranchizeIntentLinks } from "../../lib/section-links";
import { crewPaletteForSurface } from "../../lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";

interface FranchizeContactsPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: FranchizeContactsPageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Контакты",
    sectionDescription: "Контакты экипажа: адрес, телефон, Telegram и карта проезда.",
    pathSuffix: "/contacts",
  });
}

export default async function FranchizeContactsPage({ params }: FranchizeContactsPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const surface = crewPaletteForSurface(crew.theme);
  const resolvedSlug = crew.slug || slug;
  const activePath = `/franchize/${resolvedSlug}/contacts`;
  const supportTelegramHref = "https://t.me/oneBikePlsBot";
  const hasTelegram = Boolean(crew.contacts.telegram);
  const telegramHref = hasTelegram
    ? crew.contacts.telegram.startsWith("http")
      ? crew.contacts.telegram
      : `https://t.me/${crew.contacts.telegram.replace(/^@/, "")}`
    : supportTelegramHref;
  const primaryContactCta = hasTelegram
    ? { label: "Написать в Telegram", href: telegramHref }
    : { label: "Поддержка OneBikePls", href: supportTelegramHref };
  const phoneHref = crew.contacts.phone ? `tel:${crew.contacts.phone.replace(/[^+\d]/g, "")}` : "";
  const gps = crew.contacts.map.gps.trim();
  const hasGps = /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(gps);
  const directionsTarget = hasGps ? gps : crew.contacts.address;
  const directionsHref = directionsTarget
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(directionsTarget)}`
    : "";
  const ctaPolicy = getFranchizeRouteCtaPolicy("contacts");
  const showFloatingCart = shouldShowFloatingCart(ctaPolicy, { cartRelevant: false });

  return (
    <main className={`min-h-screen ${ctaPolicy.pageBottomSafeAreaClassName}`} style={surface.page}>
      <CrewHeader crew={crew} activePath={activePath} groupLinks={items.map((item) => item.category)} sectionLinks={buildFranchizeIntentLinks(resolvedSlug, activePath)} />

      <FranchizePageShell theme={crew.theme}>
        <FranchizeHero
          eyebrow={`/franchize/${resolvedSlug}/contacts · связь`}
          title="Контакты экипажа"
          subcopy="Быстрый операторский блок для связи, маршрута и проверки точки выдачи перед арендой или покупкой."
          primaryCta={primaryContactCta}
          secondaryCta={{ label: "Открыть каталог", href: `/franchize/${resolvedSlug}` }}
        />

        <section
          className="mt-6 rounded-2xl border p-4 shadow-lg shadow-black/10"
          style={{
            ...surface.subtleCard,
            ["--crew-accent" as string]: crew.theme.palette.accentMain,
            ["--crew-accent-hover" as string]: crew.theme.palette.accentMainHover,
            ["--crew-accent-contrast" as string]: "var(--franchize-shell-primary-contrast)",
            ["--crew-border" as string]: crew.theme.palette.borderSoft,
            ["--crew-card" as string]: crew.theme.palette.bgCard,
            ["--crew-muted" as string]: crew.theme.palette.textSecondary,
            ["--crew-text" as string]: crew.theme.palette.textPrimary,
          }}
        >
          <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--crew-accent)]">
                <ShieldCheck className="h-4 w-4" />
                Связь без лишних шагов
              </div>
              <h2 className="mt-3 text-2xl font-bold text-[var(--crew-text)]">Выберите быстрый канал</h2>
              <p className="mt-2 max-w-2xl text-sm text-[var(--crew-muted)]">
                Telegram — основной канал экипажа, телефон и маршрут помогают быстро подтвердить выдачу перед поездкой.
              </p>

              {crew.contacts.workingHours && (
                <p className="mt-3 inline-flex rounded-full border border-[var(--crew-border)] bg-[var(--crew-card)] px-3 py-1 text-xs font-semibold text-[var(--crew-text)]">
                  Open now / график: {crew.contacts.workingHours}
                </p>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {hasTelegram ? (
                  <a
                    href={telegramHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--crew-accent)] px-4 py-2 text-sm font-bold text-[var(--crew-accent-contrast)] transition hover:bg-[var(--crew-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crew-accent)]"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Написать в Telegram
                  </a>
                ) : (
                  <a
                    href={supportTelegramHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--crew-accent)] px-4 py-2 text-sm font-bold text-[var(--crew-accent-contrast)] transition hover:bg-[var(--crew-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crew-accent)]"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Поддержка OneBikePls
                  </a>
                )}

                {crew.contacts.phone && (
                  <a
                    href={phoneHref}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--crew-border)] px-4 py-2 text-sm font-semibold text-[var(--crew-text)] transition hover:border-[var(--crew-accent)] hover:text-[var(--crew-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crew-accent)]"
                  >
                    <Phone className="h-4 w-4" />
                    Позвонить
                  </a>
                )}

                {crew.contacts.address && <CopyAddressButton address={crew.contacts.address} />}

                {directionsHref && (
                  <a
                    href={directionsHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--crew-border)] px-4 py-2 text-sm font-semibold text-[var(--crew-text)] transition hover:border-[var(--crew-accent)] hover:text-[var(--crew-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crew-accent)]"
                  >
                    <Navigation className="h-4 w-4" />
                    {hasGps ? "Маршрут по GPS" : "Маршрут по адресу"}
                  </a>
                )}
              </div>
            </div>

            {crew.ratingSummary.count > 0 && (
              <aside className="rounded-2xl border border-[var(--crew-border)] bg-[var(--crew-card)] p-4">
                <div className="flex items-center gap-2 text-[var(--crew-accent)]">
                  <Star className="h-5 w-5 fill-current" />
                  <span className="text-3xl font-black">{crew.ratingSummary.average.toFixed(1)}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-[var(--crew-text)]">Проверенный экипаж</p>
                <p className="mt-1 text-sm text-[var(--crew-muted)]">
                  Рейтинг сформирован по {crew.ratingSummary.count} отзывам после аренд и сделок.
                </p>
              </aside>
            )}
          </div>

          <dl className="mt-5 grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-xl border border-[var(--crew-border)] bg-[var(--crew-card)] p-3">
              <dt className="flex items-center gap-2 font-semibold text-[var(--crew-text)]"><MapPinned className="h-4 w-4" /> Адрес</dt>
              <dd className="mt-1 text-[var(--crew-muted)]">{crew.contacts.address || "Адрес скоро добавим"}</dd>
            </div>
            <div className="rounded-xl border border-[var(--crew-border)] bg-[var(--crew-card)] p-3">
              <dt className="flex items-center gap-2 font-semibold text-[var(--crew-text)]"><Phone className="h-4 w-4" /> Телефон</dt>
              <dd className="mt-1 text-[var(--crew-muted)]">{crew.contacts.phone || "Телефон скоро добавим"}</dd>
            </div>
            <div className="rounded-xl border border-[var(--crew-border)] bg-[var(--crew-card)] p-3">
              <dt className="flex items-center gap-2 font-semibold text-[var(--crew-text)]"><MessageCircle className="h-4 w-4" /> Telegram</dt>
              <dd className="mt-1 text-[var(--crew-muted)]">{crew.contacts.telegram || "Используйте поддержку OneBikePls"}</dd>
            </div>
          </dl>

          {crew.contacts.map.publicTransport && <p className="mt-3 text-xs text-[var(--crew-muted)]">Транспорт: {crew.contacts.map.publicTransport}</p>}
          {crew.contacts.map.carDirections && <p className="mt-1 text-xs text-[var(--crew-muted)]">Как добраться: {crew.contacts.map.carDirections}</p>}
        </section>

        <div className="mt-4">
          <FranchizeContactsMap
            gps={crew.contacts.map.gps}
            address={crew.contacts.address}
            mapImageUrl={crew.contacts.map.imageUrl}
            mapBounds={crew.contacts.map.bounds}
            theme={crew.theme}
          />
        </div>
      </FranchizePageShell>

      <CrewFooter crew={crew} />
      {showFloatingCart && (
        <FranchizeFloatingCart
          slug={resolvedSlug}
          href={`/franchize/${resolvedSlug}/cart`}
          items={items}
          accentColor={crew.theme.palette.accentMain}
          textColor={crew.theme.palette.textPrimary}
          borderColor={crew.theme.palette.borderSoft}
          theme={crew.theme}
          className={ctaPolicy.floatingCartClassName}
        />
      )}
    </main>
  );
}
