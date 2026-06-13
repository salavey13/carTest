import type { FranchizeTheme } from "@/lib/franchize-config";

export type CrewPalette = FranchizeTheme["palette"];

type Rgb = { r: number; g: number; b: number };

const parseHexToRgb = (color: string): Rgb | null => {
  const normalized = color.replace("#", "").trim();
  const base = normalized.length === 3
    ? normalized.split("").map((char) => `${char}${char}`).join("")
    : normalized;

  if (!/^[0-9A-Fa-f]{6}$/.test(base)) return null;

  return {
    r: Number.parseInt(base.slice(0, 2), 16),
    g: Number.parseInt(base.slice(2, 4), 16),
    b: Number.parseInt(base.slice(4, 6), 16),
  };
};

export const hexToRgb = (hex: string) => parseHexToRgb(hex) ?? { r: 242, g: 242, b: 243 };

export const withAlpha = (color: string, alpha: number) => {
  const safeAlpha = Math.min(1, Math.max(0, alpha));
  const rgb = parseHexToRgb(color);

  if (!rgb) {
    return `color-mix(in srgb, ${color} ${Math.round(safeAlpha * 100)}%, transparent)`;
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${safeAlpha})`;
};

const relativeLuminanceOrNull = (color: string) => {
  const rgb = parseHexToRgb(color);
  if (!rgb) return null;

  const toLinear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
};

export const relativeLuminance = (hex: string) => relativeLuminanceOrNull(hex) ?? 0;

export const contrastRatio = (foreground: string, background: string) => {
  const foregroundLum = relativeLuminanceOrNull(foreground);
  const backgroundLum = relativeLuminanceOrNull(background);

  if (foregroundLum === null || backgroundLum === null) return 1;

  const lighter = Math.max(foregroundLum, backgroundLum);
  const darker = Math.min(foregroundLum, backgroundLum);

  return (lighter + 0.05) / (darker + 0.05);
};

export const readableTextOnColor = (background: string, candidates = ["#16130A", "#FFFFFF"]) => {
  if (relativeLuminanceOrNull(background) === null) return candidates[0] ?? "currentColor";

  return candidates
    .filter((candidate) => relativeLuminanceOrNull(candidate) !== null)
    .sort((left, right) => contrastRatio(right, background) - contrastRatio(left, background))[0] ?? candidates[0] ?? "currentColor";
};

export const readablePaletteTextOnColor = (background: string, palette: CrewPalette) => (
  readableTextOnColor(background, [palette.textPrimary, palette.bgBase, palette.bgCard, palette.textSecondary])
);

export function crewPaletteForSurface(theme: FranchizeTheme) {
  const palette = theme.palette;

  return {
    page: {
      backgroundColor: palette.bgBase,
      color: palette.textPrimary,
    },
    card: {
      backgroundColor: palette.bgCard,
      borderColor: palette.borderSoft,
      color: palette.textPrimary,
    },
    mutedText: {
      color: palette.textSecondary,
    },
    subtleCard: {
      backgroundColor: withAlpha(palette.bgCard, 0.86),
      borderColor: palette.borderSoft,
      color: palette.textPrimary,
    },
    accentPill: {
      borderColor: palette.accentMain,
      color: palette.accentMain,
      backgroundColor: withAlpha(palette.accentMain, 0.12),
    },
  };
}

/**
 * Returns CSS variable-based styles for client components.
 * Use this when you want the theme to respond to global theme preference.
 * This works with useFranchizeTheme hook to set CSS variables.
 */
export function crewPaletteWithCssVars(theme: FranchizeTheme) {
  // When isAuto is true, these CSS variables will be set by useFranchizeTheme
  // based on the global theme preference
  if (theme.isAuto) {
    return {
      page: {
        backgroundColor: "var(--franchize-bg-base)",
        color: "var(--franchize-text-primary)",
      },
      card: {
        backgroundColor: "var(--franchize-bg-card)",
        borderColor: "var(--franchize-border-soft)",
        color: "var(--franchize-text-primary)",
      },
      mutedText: {
        color: "var(--franchize-text-secondary)",
      },
      subtleCard: {
        backgroundColor: "var(--franchize-bg-card)",
        borderColor: "var(--franchize-border-soft)",
        color: "var(--franchize-text-primary)",
      },
      accentPill: {
        borderColor: "var(--franchize-accent-main)",
        color: "var(--franchize-accent-main)",
        backgroundColor: "var(--franchize-accent-main)",
      },
    };
  }

  // Fall back to regular palette when not in auto mode
  return crewPaletteForSurface(theme);
}

export function catalogCardVariantStyles(theme: FranchizeTheme, variantIndex: number) {
  const palette = theme.palette;
  const variants = [
    {
      borderColor: withAlpha(palette.borderSoft, 0.3),
      backgroundColor: palette.bgCard,
    },
    {
      borderColor: "transparent",
      backgroundImage: `linear-gradient(to bottom, ${withAlpha(palette.bgCard, 0.96)}, ${theme.palette.bgBase})`,
      boxShadow: `0 8px 24px ${withAlpha(palette.accentMain, 0.05)}`,
    },
    {
      borderColor: "transparent",
      backgroundColor: palette.bgCard,
      boxShadow: `0 0 0 1px ${withAlpha(palette.accentMain, 0.08)}, 0 12px 20px ${withAlpha(palette.bgBase, 0.4)}`,
    },
  ] as const;

  return variants[Math.abs(variantIndex) % variants.length];
}


export function floatingCartOverlayBackground(theme: FranchizeTheme) {
  // When in auto mode, use CSS variable; otherwise use palette directly
  if (theme.isAuto) {
    return "var(--franchize-bg-card)";
  }
  const alpha = theme.mode === "light" ? 0.9 : 0.94;
  return withAlpha(theme.palette.bgCard, alpha);
}

export function interactionRingStyle(theme: FranchizeTheme) {
  return {
    boxShadow: `0 0 0 2px ${withAlpha(theme.palette.accentMain, 0.72)}`,
  };
}


export function focusRingOutlineStyle(theme: FranchizeTheme) {
  return {
    outlineColor: withAlpha(theme.palette.accentMain, 0.78),
  };
}
