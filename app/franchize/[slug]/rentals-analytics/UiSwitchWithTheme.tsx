"use client";

// /app/franchize/[slug]/rentals-analytics/UiSwitchWithTheme.tsx
//
// Client component wrapper that builds ThemeTokens from the crew theme and
// passes them to AnalyticsUiSwitch.
//
// WHY THIS EXISTS: page.tsx is a Server Component. It CANNOT contain a
// "use client" function inline (the directive must be at file top-level,
// not nested inside a server component). This file is the extracted client
// wrapper that page.tsx imports.
//
// v2 is the default. v1 accessible via ?ui=v1 or localStorage.analytics_ui_v2 = "false".

import type { ReactNode } from "react";
import { AnalyticsUiSwitch } from "./AnalyticsUiSwitch";
import { RentalsAnalyticsClient } from "./RentalsAnalyticsClient";
import { AnalyticsClientV2 } from "./AnalyticsClientV2";
import { useTheme, type ThemeTokens } from "./hooks/useTheme";

interface UiSwitchWithThemeProps {
  forceV2: boolean;
  forceV1: boolean;
  crew: any;
  resolvedSlug: string;
  selectedDate: string;
}

export function UiSwitchWithTheme({
  forceV2,
  forceV1,
  crew,
  resolvedSlug,
  selectedDate,
}: UiSwitchWithThemeProps) {
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
