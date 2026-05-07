import type { Metadata } from "next";
import { getFranchizeBySlug } from "../../actions";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizeFloatingCart } from "../../components/FranchizeFloatingCart";
import { FranchizeHero } from "../../components/FranchizeHero";
import { FranchizePageShell } from "../../components/FranchizePageShell";
import { FranchizeContactsMap } from "../../components/FranchizeContactsMap";
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
  const telegramHref = crew.contacts.telegram
    ? crew.contacts.telegram.startsWith("http")
      ? crew.contacts.telegram
      : `https://t.me/${crew.contacts.telegram.replace(/^@/, "")}`
    : `/franchize/${resolvedSlug}`;

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={activePath} groupLinks={items.map((item) => item.category)} sectionLinks={buildFranchizeIntentLinks(resolvedSlug, activePath)} />

      <FranchizePageShell theme={crew.theme}>
        <FranchizeHero
          eyebrow={`/franchize/${resolvedSlug}/contacts · связь`}
          title="Контакты экипажа"
          subcopy="Быстрый операторский блок для связи, маршрута и проверки точки выдачи перед арендой или покупкой."
          primaryCta={{ label: "Написать в Telegram", href: telegramHref }}
          secondaryCta={{ label: "Открыть каталог", href: `/franchize/${resolvedSlug}` }}
        />

        <div className="mt-6 rounded-2xl border p-4" style={surface.subtleCard}>
          <div className="space-y-2 text-sm" style={surface.mutedText}>
            <p>Адрес: {crew.contacts.address || "—"}</p>
            <p>Телефон: {crew.contacts.phone || "—"}</p>
            <p>Telegram: {crew.contacts.telegram || "—"}</p>
            {crew.contacts.workingHours && <p>Часы работы: {crew.contacts.workingHours}</p>}
          </div>
          {crew.ratingSummary.count > 0 && (
            <div className="mt-4 rounded-2xl border px-3 py-2 text-sm" style={surface.card}>
              <span className="font-bold" style={{ color: crew.theme.palette.accentMain }}>★ {crew.ratingSummary.average.toFixed(1)}</span>
              <span style={surface.mutedText}> · рейтинг экипажа по {crew.ratingSummary.count} отзывам</span>
            </div>
          )}

          {crew.contacts.map.publicTransport && <p className="mt-3 text-xs" style={surface.mutedText}>Транспорт: {crew.contacts.map.publicTransport}</p>}
          {crew.contacts.map.carDirections && <p className="mt-1 text-xs" style={surface.mutedText}>Как добраться: {crew.contacts.map.carDirections}</p>}
        </div>

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
