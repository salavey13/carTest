/**
 * GearSection.tsx
 * ================
 * Equipment and safety grid section.
 */
"use client";

import { VibeContentRenderer } from "@/components/VibeContentRenderer";

const gearItems = [
  "::FaHelmetSafety:: Шлемы",
  "::FaHands:: Перчатки",
  "::FaShirt:: Джерси",
  "::FaShoePrints:: Ботинки",
  "::FaShield:: Черепахи",
  "::FaPersonRunning:: Колени",
  "::FaRoadBarrier:: Локти и защита корпуса",
  "::FaKitMedical:: Аптечка и расходники",
];

export function GearSection() {
  return (
    <section>
      <div className="mb-8 text-center">
        <h2 className="font-orbitron text-3xl sm:text-4xl">Экип и безопасность — отдельный блок перед стартом</h2>
        <p className="mx-auto mt-3 max-w-3xl text-muted-foreground">
          Перед арендой или покупкой сразу закрываем вопрос защиты: подбираем комплект под стиль катания и сезон.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {gearItems.map((item) => (
          <div key={item} className="rounded-xl border border-border/70 bg-card/60 px-3 py-3 text-sm">
            <VibeContentRenderer content={item} />
          </div>
        ))}
      </div>
    </section>
  );
}