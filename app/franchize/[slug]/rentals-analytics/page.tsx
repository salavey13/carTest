// /app/franchize/[slug]/rentals-analytics/page.tsx
//
// Page entry for the rentals analytics dashboard. v2 is the default UI.
// v1 accessible via ?ui=v1 query param or localStorage.analytics_ui_v2 = "false".
//
// This is a Server Component. It does NOT contain any "use client" code inline.
// The client-side theme resolution + UI switch lives in UiSwitchWithTheme.tsx.

import type { Metadata } from "next";

import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { FranchizePageShell } from "@/app/franchize/components/FranchizePageShell";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";
import { UiSwitchWithTheme } from "./UiSwitchWithTheme";

interface FranchizeSlugRentalsAnalyticsPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string; ui?: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Аналитика аренд",
    sectionDescription:
      "Ежедневная статистика аренд с детальной информацией по каждому заказу и документам.",
    pathSuffix: "/rentals-analytics",
  });
}

export default async function FranchizeSlugRentalsAnalyticsPage({
  params,
  searchParams,
}: FranchizeSlugRentalsAnalyticsPageProps) {
  const { slug } = await params;
  const { date: dateParam, ui } = await searchParams;
  const { crew } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const activePath = `/franchize/${resolvedSlug}/rentals-analytics`;
  const surface = crewPaletteForSurface(crew.theme);

  // Use Moscow TZ for "today" default (server-side).
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Moscow",
  });
  const selectedDate = dateParam || today;

  const forceV2 = ui === "v2";
  const forceV1 = ui === "v1";

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader
        crew={crew}
        activePath={activePath}
        groupLinks={[]}
        showRail={false}
      />
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-4" width="full">
        <UiSwitchWithTheme
          forceV2={forceV2}
          forceV1={forceV1}
          crew={crew}
          resolvedSlug={resolvedSlug}
          selectedDate={selectedDate}
        />
      </FranchizePageShell>
    </main>
  );
}
