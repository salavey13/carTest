// /app/franchize/[slug]/rentals-analytics/page.tsx
//
// Page entry for the rentals analytics dashboard. Supports a `?ui=v2` feature
// flag (also stored in localStorage) that switches between the legacy
// RentalsAnalyticsClient (v1, 1483 lines) and the new AnalyticsClientV2
// (split-pane / mobile sheet / 3 tabs).
//
// Feature-flag resolution order:
//   1. ?ui=v2 query param — explicit override
//   2. ?ui=v1 query param — explicit override back to v1
//   3. localStorage.analytics_ui_v2 === "true" — sticky preference
//   4. Default: v1 (until v2 passes acceptance scenarios)

import type { Metadata } from "next";

import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { FranchizePageShell } from "@/app/franchize/components/FranchizePageShell";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";
import { RentalsAnalyticsClient } from "./RentalsAnalyticsClient";
import { AnalyticsClientV2 } from "./AnalyticsClientV2";
import { AnalyticsUiSwitch } from "./AnalyticsUiSwitch";

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

  // Use LOCAL date for "today" default IN MOSCOW TIMEZONE.
  // The page is a server component — `new Date()` here returns the server's
  // local time, which is UTC in production. Using `todayLocalIso()` (which
  // uses `new Date().getFullYear()/getMonth()/getDate()`) would return the
  // server's UTC date, not Moscow date — drifting by up to 3 hours between
  // 00:00-03:00 Moscow. Instead, we force Europe/Moscow via `toLocaleString`
  // with `timeZone: "Europe/Moscow"` + `en-CA` locale (which emits YYYY-MM-DD).
  // This MUST match the client-side `todayLocalIso()` in
  // `components/lib/analytics-utils.ts` (which runs in the user's browser TZ —
  // typically Moscow for VIP Bike operators).
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Moscow",
  });
  const selectedDate = dateParam || today;

  // Feature flag: ?ui=v2 wins; ?ui=v1 forces legacy; otherwise the
  // AnalyticsUiSwitch client component resolves localStorage on mount.
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
        <AnalyticsUiSwitch forceV2={forceV2} forceV1={forceV1}>
          {({ useV2 }) =>
            useV2 ? (
              <AnalyticsClientV2
                initialSlug={resolvedSlug}
                initialDate={selectedDate}
                crew={crew}
              />
            ) : (
              <RentalsAnalyticsClient
                initialSlug={resolvedSlug}
                initialDate={selectedDate}
                crew={crew}
              />
            )
          }
        </AnalyticsUiSwitch>
      </FranchizePageShell>
    </main>
  );
}
