// app/franchize/[slug]/equipment/page.tsx
//
// I5 — Equipment rentals catalog and management UI
// Plan: docs/superpowers/plans/2026-08-12-i5-equipment-rentals.md (Task 3)

import { Suspense } from "react";
import { EquipmentClient } from "./EquipmentClient";

export default function EquipmentPage({ params }: { params: { slug: string } }) {
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Экипировка</h1>

      <Suspense fallback={<div>Загрузка...</div>}>
        <EquipmentClient slug={params.slug} />
      </Suspense>
    </div>
  );
}
