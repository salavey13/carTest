// app/franchize/[slug]/cash-ledger/page.tsx
import { Suspense } from "react";
import { CashLedgerClient } from "./CashLedgerClient";
import { getFranchizeBySlug } from "../../actions";

interface CashLedgerPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CashLedgerPage({ params }: CashLedgerPageProps) {
  const { slug } = await params;
  const { crew } = await getFranchizeBySlug(slug);

  return (
    <div className="container mx-auto px-4 py-6">
      <Suspense fallback={<div className="text-center py-12">Загрузка...</div>}>
        <CashLedgerClient slug={slug} crew={crew} />
      </Suspense>
    </div>
  );
}
