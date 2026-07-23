// /analytics/hooks/useTheme.ts
// Theme tokens hook for the analytics redesign. Mirrors the canonical
// ThemeTokens interface used across the franchize leads/analytics UIs so that
// analytics Phase 1 components (../components/*) can import it via the
// relative `../hooks/useTheme` path.
"use client";

import { useMemo } from "react";

export interface ThemeTokens {
  text: string;
  textMuted: string;
  textFaint: string;
  bg: string;
  bgCard: string;
  bgCardHover: string;
  bgElevated: string;
  border: string;
  borderSoft: string;
  borderActive: string;
  inputBg: string;
  inputBorder: string;
  shadow: string;
  accent: string;
  accentContrast: string;
}

interface UseThemeProps {
  isAuto: boolean;
  isLightTheme: boolean;
  textColor: string;
  bgColor: string;
  accentColor: string;
}

export function useTheme({
  isAuto,
  isLightTheme,
  textColor,
  bgColor,
  accentColor,
}: UseThemeProps): ThemeTokens {
  return useMemo(() => {
    if (isAuto) {
      return {
        text: "var(--franchize-text-primary)",
        textMuted: "var(--franchize-text-secondary)",
        textFaint:
          "color-mix(in srgb, var(--franchize-text-secondary) 65%, transparent)",
        bg: "var(--franchize-bg-base)",
        bgCard: "color-mix(in srgb, var(--franchize-bg-card) 96%, transparent)",
        bgCardHover:
          "color-mix(in srgb, var(--franchize-accent-main) 6%, transparent)",
        bgElevated: "var(--franchize-bg-card)",
        border:
          "color-mix(in srgb, var(--franchize-border-soft) 45%, transparent)",
        borderSoft:
          "color-mix(in srgb, var(--franchize-border-soft) 25%, transparent)",
        borderActive: "var(--franchize-accent-main)",
        inputBg: "var(--franchize-bg-base)",
        inputBorder:
          "color-mix(in srgb, var(--franchize-border-soft) 55%, transparent)",
        shadow:
          "0 4px 24px color-mix(in srgb, var(--franchize-accent-main) 6%, transparent)",
        accent: "var(--franchize-accent-main)",
        accentContrast: "var(--franchize-accent-contrast)",
      };
    }
    return {
      text: isLightTheme ? "#1e293b" : textColor,
      textMuted: isLightTheme ? "#64748b" : `${textColor}99`,
      textFaint: isLightTheme ? "#94a3b8" : `${textColor}60`,
      bg: isLightTheme ? "#f8fafc" : bgColor,
      bgCard: isLightTheme ? "#ffffff" : `${accentColor}08`,
      bgCardHover: isLightTheme ? "#f1f5f9" : `${accentColor}12`,
      bgElevated: isLightTheme ? "#ffffff" : `${accentColor}10`,
      border: isLightTheme ? "#e2e8f0" : `${accentColor}22`,
      borderSoft: isLightTheme ? "#f1f5f9" : `${accentColor}12`,
      borderActive: accentColor,
      inputBg: isLightTheme ? "#ffffff" : `${accentColor}0a`,
      inputBorder: isLightTheme ? "#cbd5e1" : `${accentColor}30`,
      shadow: isLightTheme
        ? "0 4px 20px rgba(0,0,0,0.08)"
        : "0 4px 24px rgba(0,0,0,0.35)",
      accent: accentColor,
      accentContrast: isLightTheme ? "#16130A" : "#ffffff",
    };
  }, [isAuto, isLightTheme, textColor, bgColor, accentColor]);
}
