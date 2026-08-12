import type { Metadata } from "next";
import { CrewFooter } from "@/app/franchize/components/CrewFooter";
import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { FranchizePageShell } from "@/app/franchize/components/FranchizePageShell";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";
import { CashLedgerClient } from "./CashLedgerClient";

interface FranchizeSlugCashLedgerPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: FranchizeSlugCashLedgerPageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Кассовая книга",
    sectionDescription:
      "Кассовая книга экипажа: учёт доходов, расходов и чистого денежного потока.",
    pathSuffix: "/cash-ledger",
  });
}

export default async function FranchizeSlugCashLedgerPage({
  params,
}: FranchizeSlugCashLedgerPageProps) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const activePath = `/franchize/${resolvedSlug}/cash-ledger`;
  const surface = crewPaletteForSurface(crew.theme);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader
        crew={crew}
        activePath={activePath}
        groupLinks={items.map((item) => item.category)}
      />
      <FranchizePageShell
        theme={crew.theme}
        width="wide"
        contentClassName="space-y-4"
      >
        <CashLedgerClient crewSlug={resolvedSlug} crew={crew} />
      </FranchizePageShell>
      <CrewFooter crew={crew} />
    </main>
  );
}