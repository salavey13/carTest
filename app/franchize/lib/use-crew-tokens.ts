// /app/franchize/lib/use-crew-tokens.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared theme-token hook for every franchize page/component.
//
// Why this exists:
//   - Item modal, Cart, Order each had their own ad-hoc CSS-var indirection
//     (`--order-accent`, `--cart-accent`, `--item-accent`, ...) which drifted
//     and let goldish sneaks slip into the light theme.
//   - This hook returns ONE consistent token shape for both `isAuto` (CSS
//     variables) and explicit (palette) modes, so callers can write the
//     same `<div style={T.card}>` regardless of theme plumbing.
//   - Every token has a guaranteed-contrast fallback: in light mode we
//     never use the raw brand gold as body text — we use textPrimary.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useMemo, type CSSProperties } from "react";
import type { FranchizeTheme } from "@/lib/franchize-config";
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";
import {
  withAlpha,
  readablePaletteTextOnColor,
} from "@/app/franchize/lib/theme";

export type CrewTokens = {
  /** True when the crew is in CSS-var (auto / device-preference) mode. */
  isAuto: boolean;
  /** True when the resolved theme is light. */
  isLight: boolean;
  /** Primary brand accent (gold for vip-bike). */
  accent: string;
  /** Slightly lighter accent (for hover / press states). */
  accentHover: string;
  /** Accent with 10-12% alpha — for "soft pill" backgrounds. */
  accentSoft: string;
  /** Text color guaranteed to be readable ON the accent fill. */
  accentContrast: string;
  /** Page background. */
  bg: string;
  /** Slightly elevated card background (modals, cards). */
  bgCard: string;
  /** Even more elevated surface (inputs, nested cards). */
  bgElevated: string;
  /** Primary border color. */
  border: string;
  /** Soft border color. */
  borderSoft: string;
  /** Active / focused border color (uses accent). */
  borderActive: string;
  /** Primary text color (guaranteed readable in the current mode). */
  text: string;
  /** Muted / secondary text color. */
  textMuted: string;
  /** Faint / tertiary text color (timestamps, hints). */
  textFaint: string;
  /** Ready-made style objects for common surfaces. */
  styles: {
    /** Full-page wrapper. */
    page: CSSProperties;
    /** Card / panel surface. */
    card: CSSProperties;
    /** Subtle nested card (input groups, list rows). */
    subtleCard: CSSProperties;
    /** Input / select background. */
    input: CSSProperties;
    /** Primary CTA (filled button). */
    ctaPrimary: CSSProperties;
    /** Secondary CTA (outlined). */
    ctaSecondary: CSSProperties;
    /** Muted text style. */
    mutedText: CSSProperties;
    /** Accent pill (small badge with accent fill). */
    accentPill: CSSProperties;
    /** Soft accent badge (no fill, accent border + text). */
    accentBadge: CSSProperties;
    /** Success / positive badge — uses accent in dark, green-tinged in light. */
    successBadge: CSSProperties;
    /** Warning badge — same approach. */
    warningBadge: CSSProperties;
  };
};

function resolvePalette(theme: FranchizeTheme) {
  if (theme.isAuto) {
    return theme.palettes?.light || theme.palettes?.dark || theme.palette;
  }
  if (theme.mode === "light" && theme.palettes?.light) {
    return theme.palettes.light;
  }
  return theme.palettes?.dark || theme.palette;
}

function detectIsLight(theme: FranchizeTheme, palette: ReturnType<typeof resolvePalette>): boolean {
  if (theme.isAuto) {
    // We can't know the live device preference at hook time without
    // reading the DOM, so callers that need this should prefer
    // CSS variables for layout. For token resolution we assume the
    // palette is the "neutral" one and let CSS-var usage drive the
    // actual rendering. In practice, components that care about light
    // vs dark use `isAuto` and feed CSS variables through styles.
    return false;
  }
  return theme.mode === "light";
}

/**
 * useCrewTokens — the single source of truth for theme tokens in the
 * franchize flow. Always use this instead of inlining CSS vars or
 * reading `crew.theme.palette` directly.
 *
 * It also runs `useFranchizeTheme` to set the global CSS variables
 * (for `isAuto` mode) so that any child using `var(--franchize-*)`
 * still works.
 */
export function useCrewTokens(theme: FranchizeTheme): CrewTokens {
  useFranchizeTheme(theme);
  const palette = resolvePalette(theme);
  // Normalize undefined → false for downstream consumers. The `useFranchizeTheme`
  // hook sometimes returns `isAuto: undefined` during SSR before the
  // ThemeProvider hydrates.
  const isAuto = Boolean(theme.isAuto);
  const isLight = detectIsLight(theme, palette);

  return useMemo<CrewTokens>(() => {
    const accent = isAuto
      ? "var(--franchize-accent-main)"
      : palette.accentMain;
    const accentHover = isAuto
      ? "var(--franchize-accent-hover, var(--franchize-accent-main))"
      : palette.accentMainHover || palette.accentMain;
    const accentSoft = isAuto
      ? "color-mix(in srgb, var(--franchize-accent-main) 12%, transparent)"
      : withAlpha(palette.accentMain, 0.12);
    const accentContrast = isAuto
      ? "var(--franchize-accent-contrast, #16130A)"
      : readablePaletteTextOnColor(palette.accentMain, palette);
    const bg = isAuto ? "var(--franchize-bg-base)" : palette.bgBase;
    const bgCard = isAuto ? "var(--franchize-bg-card)" : palette.bgCard;
    const bgElevated = isAuto
      ? "color-mix(in srgb, var(--franchize-bg-card) 92%, var(--franchize-bg-base))"
      : withAlpha(palette.bgCard, 0.88);
    const border = isAuto
      ? "color-mix(in srgb, var(--franchize-border-soft) 45%, transparent)"
      : withAlpha(palette.borderSoft, 0.45);
    const borderSoft = isAuto
      ? "color-mix(in srgb, var(--franchize-border-soft) 25%, transparent)"
      : withAlpha(palette.borderSoft, 0.25);
    const borderActive = accent;
    const text = isAuto ? "var(--franchize-text-primary)" : palette.textPrimary;
    const textMuted = isAuto ? "var(--franchize-text-secondary)" : palette.textSecondary;
    const textFaint = isAuto
      ? "color-mix(in srgb, var(--franchize-text-secondary) 65%, transparent)"
      : withAlpha(palette.textSecondary, 0.65);

    // Success / warning colors — in dark theme we reuse accent-tinted
    // values; in light theme we use darker variants for contrast.
    const successFg = isLight ? "#047857" : "#34d399";
    const successBg = isLight
      ? "color-mix(in srgb, #10b981 14%, transparent)"
      : "color-mix(in srgb, #10b981 18%, transparent)";
    const successBorder = isLight
      ? "color-mix(in srgb, #10b981 35%, transparent)"
      : "color-mix(in srgb, #10b981 40%, transparent)";
    const warningFg = isLight ? "#b45309" : "#fbbf24";
    const warningBg = isLight
      ? "color-mix(in srgb, #f59e0b 14%, transparent)"
      : "color-mix(in srgb, #f59e0b 18%, transparent)";
    const warningBorder = isLight
      ? "color-mix(in srgb, #f59e0b 35%, transparent)"
      : "color-mix(in srgb, #f59e0b 40%, transparent)";
    const dangerFg = isLight ? "#b91c1c" : "#f87171";
    const dangerBg = isLight
      ? "color-mix(in srgb, #ef4444 12%, transparent)"
      : "color-mix(in srgb, #ef4444 16%, transparent)";
    const dangerBorder = isLight
      ? "color-mix(in srgb, #ef4444 35%, transparent)"
      : "color-mix(in srgb, #ef4444 40%, transparent)";

    const styles: CrewTokens["styles"] = {
      page: { backgroundColor: bg, color: text },
      card: { backgroundColor: bgCard, borderColor: borderSoft, color: text },
      subtleCard: { backgroundColor: bgElevated, borderColor: borderSoft, color: text },
      input: { backgroundColor: bg, borderColor: border, color: text },
      ctaPrimary: { backgroundColor: accent, color: accentContrast, borderColor: accent },
      ctaSecondary: { backgroundColor: "transparent", color: text, borderColor: border },
      mutedText: { color: textMuted },
      accentPill: { backgroundColor: accentSoft, color: accent, borderColor: accentSoft },
      accentBadge: { backgroundColor: "transparent", color: accent, borderColor: accent },
      successBadge: { backgroundColor: successBg, color: successFg, borderColor: successBorder },
      warningBadge: { backgroundColor: warningBg, color: warningFg, borderColor: warningBorder },
    };
    // Attach the danger pair for callers that need it.
    (styles as Record<string, CSSProperties>).dangerBadge = {
      backgroundColor: dangerBg,
      color: dangerFg,
      borderColor: dangerBorder,
    };

    return {
      isAuto,
      isLight,
      accent,
      accentHover,
      accentSoft,
      accentContrast,
      bg,
      bgCard,
      bgElevated,
      border,
      borderSoft,
      borderActive,
      text,
      textMuted,
      textFaint,
      styles,
    };
  }, [isAuto, isLight, palette]);
}
