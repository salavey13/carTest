// /app/franchize/[slug]/admin/deposits/page.tsx
import { DepositsAdminClient } from "./DepositsAdminClient";
import { CrewHeader } from "../../../components/CrewHeader";
import { getFranchizeBySlug } from "../../../actions";
import { crewPaletteForSurface } from "../../../lib/theme";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function DepositsAdminPage({ params }: Props) {
  const { slug } = await params;
  const { crew } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const surface = crewPaletteForSurface(crew.theme);
  const activePath = `/franchize/${resolvedSlug}/admin/deposits`;

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={activePath} groupLinks={[]} items={[]} />
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--franchize-text-primary, inherit)" }}>
          🏥 Депозиты
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--franchize-text-secondary, inherit)" }}>
          Отслеживание депозитов: наличные, Тинькофф, Сбербанк
        </p>
        <DepositsAdminClient slug={resolvedSlug} />
      </div>
    </main>
  );
}
