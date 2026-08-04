"use client";

import { useLayoutEffect, useEffect } from "react";
import { useTheme } from "next-themes";
import type { FranchizeTheme } from "@/lib/franchize-config";

/**
 * Hook that applies franchize theme as CSS variables.
 * When theme mode is 'auto', it responds to the global theme preference.
 * When theme mode is specific (e.g., 'cyber_electro_dark'), it uses that palette.
 *
 * Uses useLayoutEffect to set CSS variables synchronously before browser paint,
 * preventing "dark flash" on initial load.
 */
export function useFranchizeTheme(theme: Partial<FranchizeTheme>) {
  const { resolvedTheme = "dark" } = useTheme();
  const isAuto = theme.isAuto;

  // Use useLayoutEffect for synchronous updates before paint
  // Fallback to useEffect for SSR compatibility
  const effectImpl = typeof window !== "undefined" ? useLayoutEffect : useEffect;

  effectImpl(() => {
    const root = document.documentElement;

    // Resolve the palette defensively. Some callers pass a partial/empty theme
    // (e.g. `useFranchizeTheme({})`), and previously the else-branch dereferenced
    // `theme.palette.*` directly, throwing
    // "Cannot read properties of undefined (reading 'accentMain')" (or 'bgBase').
    const palette = isAuto
      ? (resolvedTheme === "light" ? theme.palettes?.light : theme.palettes?.dark)
      : theme.palette;
    if (palette) {
      root.style.setProperty("--franchize-bg-base", palette.bgBase);
      root.style.setProperty("--franchize-bg-card", palette.bgCard);
      root.style.setProperty("--franchize-accent-main", palette.accentMain);
      root.style.setProperty("--franchize-accent-hover", palette.accentMainHover);
      root.style.setProperty("--franchize-text-primary", palette.textPrimary);
      root.style.setProperty("--franchize-text-secondary", palette.textSecondary);
      root.style.setProperty("--franchize-border-soft", palette.borderSoft);
    }
  }, [theme, isAuto, resolvedTheme]);

  return {
    cssVars: {
      backgroundColor: "var(--franchize-bg-base)",
      cardBackground: "var(--franchize-bg-card)",
      accentColor: "var(--franchize-accent-main)",
      accentHover: "var(--franchize-accent-hover)",
      textColor: "var(--franchize-text-primary)",
      mutedColor: "var(--franchize-text-secondary)",
      borderColor: "var(--franchize-border-soft)",
    },
  };
}
