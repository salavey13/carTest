// /app/franchize/[slug]/rentals-analytics/page.tsx
//
// Page entry for the rentals analytics dashboard. v2 is the default UI.
// v1 accessible via ?ui=v1 query param or localStorage.analytics_ui_v2 = "false".

import type { Metadata } from "next";

import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { FranchizePageShell } from "@/app/franchize/components/FranchizePageShell";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";
import { RentalsAnalyticsClient } from "./RentalsAnalyticsClient";
import { AnalyticsClientV2 } from "./AnalyticsClientV2";
import { AnalyticsUiSwitch } from "./AnalyticsUiSwitch";
import { useTheme, type ThemeTokens } from "./hooks/useTheme";

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

// Wrapper to build theme tokens on the client side (AnalyticsUiSwitch needs them).
// This is a client component that reads the crew theme + builds T via useTheme.
function UiSwitchWithTheme({
  forceV2,
  forceV1,
  crew,
  resolvedSlug,
  selectedDate,
}: {
  forceV2: boolean;
  forceV1: boolean;
  crew: any;
  resolvedSlug: string;
  selectedDate: string;
}) {
  "use client";
  // Resolve theme tokens from crew theme (same logic as AnalyticsClientV2)
  const isAuto = crew?.theme?.isAuto ?? true;
  const palette = crew?.theme?.palettes?.dark || crew?.theme?.palette || {};
  const T: ThemeTokens = useTheme({
    isAuto,
    isLightTheme: false,
    textColor: palette.textPrimary || "#ffffff",
    bgColor: palette.bgBase || "#0a0a0a",
    accentColor: palette.accentMain || "#22c55e",
  });

  return (
    <AnalyticsUiSwitch
      forceV2={forceV2}
      forceV1={forceV1}
      T={T}
      v1={
        <RentalsAnalyticsClient
          initialSlug={resolvedSlug}
          initialDate={selectedDate}
          crew={crew}
        />
      }
      v2={
        <AnalyticsClientV2
          initialSlug={resolvedSlug}
          initialDate={selectedDate}
          crew={crew}
        />
      }
    />
  );
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
