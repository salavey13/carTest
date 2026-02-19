import { getFranchizeBySlug } from "../../actions";
import { CrewFooter } from "../../components/CrewFooter";
import { CrewHeader } from "../../components/CrewHeader";
import { FloatingCartIconLink } from "../../components/FloatingCartIconLink";

interface FranchizeContactsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function FranchizeContactsPage({ params }: FranchizeContactsPageProps) {
  const { slug } = await params;
  const { crew } = await getFranchizeBySlug(slug);

  return (
    <main className="min-h-screen" style={{ backgroundColor: crew.theme.palette.bgBase, color: crew.theme.palette.textPrimary }}>
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/contacts`} />
      <section className="mx-auto w-full max-w-4xl px-4 py-6">
        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: crew.theme.palette.accentMain }}>
          /franchize/{crew.slug || slug}/contacts
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Контакты</h1>
        <div className="mt-4 space-y-2 text-sm" style={{ color: crew.theme.palette.textSecondary }}>
          <p>Phone: {crew.contacts.phone || "—"}</p>
          <p>Email: {crew.contacts.email || "—"}</p>
          <p>Address: {crew.contacts.address || "—"}</p>
        </div>
      </section>
      <CrewFooter crew={crew} />
      <FloatingCartIconLink
        href={`/franchize/${crew.slug || slug}/cart`}
        itemCount={0}
        totalPrice={0}
        accentColor={crew.theme.palette.accentMain}
        textColor={crew.theme.palette.textPrimary}
        borderColor={crew.theme.palette.borderSoft}
      />
    </main>
  );
}
