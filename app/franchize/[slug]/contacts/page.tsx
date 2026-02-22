import { getFranchizeBySlug } from "../../actions";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizeFloatingCart } from "../../components/FranchizeFloatingCart";
import { FranchizeContactsMap } from "../../components/FranchizeContactsMap";
import { crewPaletteForSurface } from "../../lib/theme";

interface FranchizeContactsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function FranchizeContactsPage({ params }: FranchizeContactsPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const surface = crewPaletteForSurface(crew.theme);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/contacts`} />

      <section className="mx-auto w-full max-w-4xl px-4 py-6">
        <h1 className="text-2xl font-semibold">Контакты</h1>

        <div className="mt-4 rounded-2xl border p-4" style={surface.card}>
          <div className="space-y-2 text-sm" style={surface.mutedText}>
            <p>Адрес: {crew.contacts.address || "—"}</p>
            <p>Телефон: {crew.contacts.phone || "—"}</p>
            <p>Telegram: {crew.contacts.telegram || "—"}</p>
            {crew.contacts.workingHours && <p>Часы работы: {crew.contacts.workingHours}</p>}
          </div>

          {crew.contacts.map.publicTransport && <p className="mt-3 text-xs" style={surface.mutedText}>Транспорт: {crew.contacts.map.publicTransport}</p>}
          {crew.contacts.map.carDirections && <p className="mt-1 text-xs" style={surface.mutedText}>Как добраться: {crew.contacts.map.carDirections}</p>}
        </div>

        <div className="mt-4">
          <FranchizeContactsMap
            gps={crew.contacts.map.gps}
            address={crew.contacts.address}
            mapImageUrl={crew.contacts.map.imageUrl}
            mapBounds={crew.contacts.map.bounds}
          />
        </div>
      </section>

      <CrewFooter crew={crew} />
      <FranchizeFloatingCart
        slug={crew.slug || slug}
        href={`/franchize/${crew.slug || slug}/cart`}
        items={items}
        accentColor={crew.theme.palette.accentMain}
        textColor={crew.theme.palette.textPrimary}
        borderColor={crew.theme.palette.borderSoft}
      />
    </main>
  );
}
