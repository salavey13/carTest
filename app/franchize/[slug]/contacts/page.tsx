import { getFranchizeBySlug } from "../../actions";

interface FranchizeContactsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function FranchizeContactsPage({ params }: FranchizeContactsPageProps) {
  const { slug } = await params;
  const { crew } = await getFranchizeBySlug(slug);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-400">/franchize/{crew.slug || slug}/contacts</p>
        <h1 className="mt-2 text-2xl font-semibold">Contacts</h1>
        <div className="mt-4 space-y-2 text-sm text-zinc-300">
          <p>Phone: {crew.contacts.phone || "—"}</p>
          <p>Email: {crew.contacts.email || "—"}</p>
          <p>Address: {crew.contacts.address || "—"}</p>
        </div>
      </section>
    </main>
  );
}
