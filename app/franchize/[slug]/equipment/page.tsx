// app/franchize/[slug]/equipment/page.tsx
//
// I5 — Equipment rentals catalog and management UI
// Plan: docs/superpowers/plans/2026-08-12-i5-equipment-rentals.md (Task 3)

import { Suspense } from "react";
import { EquipmentClient } from "./EquipmentClient";
import { getFranchizeBySlug } from "../../actions";

interface EquipmentPageProps {
  params: Promise<{ slug: string }>;
}

export default async function EquipmentPage({ params }: EquipmentPageProps) {
  const { slug } = await params;
  const { crew } = await getFranchizeBySlug(slug);

  return (
    <div className="container mx-auto px-4 py-6">
      <Suspense fallback={<div className="text-center py-12">Загрузка...</div>}>
        <EquipmentClient slug={slug} crew={crew} />
      </Suspense>
    </div>
  );
}
