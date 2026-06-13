"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import type { FranchizeTheme } from "@/lib/franchize-config";

/**
 * Hook that applies franchize theme as CSS variables.
 * When theme mode is 'auto', it responds to the global theme preference.
 * When theme mode is specific (e.g., 'cyber_electro_dark'), it uses that palette.
 */
export function useFranchizeTheme(theme: FranchizeTheme) {
  const { resolvedTheme = "dark" } = useTheme();
  const isAuto = theme.isAuto;

  useEffect(() => {
    const root = document.documentElement;

    if (isAuto) {
      // Use global theme preference when mode is 'auto'
      const palette = resolvedTheme === "light" ? theme.palettes?.light : theme.palettes?.dark;
      if (palette) {
        root.style.setProperty("--franchize-bg-base", palette.bgBase);
        root.style.setProperty("--franchize-bg-card", palette.bgCard);
        root.style.setProperty("--franchize-accent-main", palette.accentMain);
        root.style.setProperty("--franchize-accent-hover", palette.accentMainHover);
        root.style.setProperty("--franchize-text-primary", palette.textPrimary);
        root.style.setProperty("--franchize-text-secondary", palette.textSecondary);
        root.style.setProperty("--franchize-border-soft", palette.borderSoft);
      }
    } else {
      // Use crew's fixed palette when mode is not 'auto'
      root.style.setProperty("--franchize-bg-base", theme.palette.bgBase);
      root.style.setProperty("--franchize-bg-card", theme.palette.bgCard);
      root.style.setProperty("--franchize-accent-main", theme.palette.accentMain);
      root.style.setProperty("--franchize-accent-hover", theme.palette.accentMainHover);
      root.style.setProperty("--franchize-text-primary", theme.palette.textPrimary);
      root.style.setProperty("--franchize-text-secondary", theme.palette.textSecondary);
      root.style.setProperty("--franchize-border-soft", theme.palette.borderSoft);
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
