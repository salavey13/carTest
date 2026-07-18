"use client";

import { useTheme } from "next-themes";
import { useMemo } from "react";
import type { FranchizeTheme } from "@/app/franchize/actions";

/**
 * Resolves the correct palette for the current global theme.
 *
 * - When `crewTheme.isAuto` is true → use CSS variables (already correct)
 * - When global theme is "light" and `crewTheme.palettes?.light` exists → use light palette
 * - Otherwise → use `crewTheme.palette` (dark default)
 *
 * Drop this into any client component: `const palette = useResolvedPalette(crew.theme)`
 * Then replace ALL `crew.theme.palette.xxx` with `palette.xxx`.
 */
export function useResolvedPalette(crewTheme: FranchizeTheme) {
  const { theme: globalTheme } = useTheme();

  return useMemo(() => {
    if (crewTheme.isAuto) return crewTheme.palette; // CSS vars handle it
    const isLightMode = globalTheme === "light";
    return isLightMode && crewTheme.palettes?.light
      ? crewTheme.palettes.light
      : crewTheme.palette;
  }, [crewTheme, globalTheme]);
}

/**
 * Returns a CSS var OR a resolved palette color.
 * Use this instead of the verbose `crew.theme.isAuto ? "var(--franchize-xxx)" : palette.xxx` pattern.
 *
 * @example
 *   // Before:
 *   style={{ color: crew.theme.isAuto ? "var(--franchize-text-primary)" : palette.textPrimary }}
 *   // After:
 *   style={{ color: autoCss(palette, crewTheme.isAuto, "textPrimary", "--franchize-text-primary") }}
 */
export function autoCss(
  palette: Record<string, string>,
  isAuto: boolean,
  key: string,
  cssVar: string,
): string {
  return isAuto ? cssVar : (palette[key] ?? cssVar);
}
