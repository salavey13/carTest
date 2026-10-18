// /app/franchize/[slug]/rentals-analytics/page.tsx
//
// Page entry for the rentals analytics dashboard.
//
// maxDuration=60 (vf-fix 2026-10-18): the drawer's server actions
// (updateRentalStatus, resend/verify verification actions) include awaited
// Telegram sends + the verification request; under Vercel's ~10s default the
// tail of that chain died non-deterministically (bd948bd0 incident class).
// Segment config covers the actions POSTed from this page.
export const maxDuration = 60;
//
// FIX (F10): the v1 UI (RentalsAnalyticsClient) and the AnalyticsUiSwitch
// selector are REMOVED — v2 (AnalyticsClientV2) is the only UI now.
// Deep-link ?ui=v1/v2 params are ignored.
//
// This is a Server Component. It does NOT contain any "use client" code inline.
// The client-side theme resolution lives inside AnalyticsClientV2.

import type { Metadata } from "next";

import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { FranchizePageShell } from "@/app/franchize/components/FranchizePageShell";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";
import { AnalyticsClientV2 } from "./AnalyticsClientV2";
import { AchievementExplorer } from "../../components/AchievementExplorer";

interface FranchizeSlugRentalsAnalyticsPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string; tab?: string; rentalId?: string; saleId?: string }>;
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
  const { date: dateParam, tab: tabParam, rentalId: rentalIdParam, saleId: saleIdParam } = await searchParams;
  const { crew, items } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const activePath = `/franchize/${resolvedSlug}/rentals-analytics`;
  const surface = crewPaletteForSurface(crew.theme);

  // Use Moscow TZ for "today" default (server-side).
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Moscow",
  });
  const selectedDate = dateParam || today;

  return (
    <main className="min-h-screen" style={surface.page}>
      <AchievementExplorer slug={crew.slug || slug} achievementId="explorer_analytics" />
      <CrewHeader
        crew={crew}
        activePath={activePath}
        groupLinks={[]}
        showRail={false}
      items={items} />
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-4" width="full">
        <AnalyticsClientV2
          initialSlug={resolvedSlug}
          initialDate={selectedDate}
          crew={crew}
          initialTab={tabParam}
          initialRentalId={rentalIdParam}
          initialSaleId={saleIdParam}
        />
      </FranchizePageShell>
    </main>
  );
}
