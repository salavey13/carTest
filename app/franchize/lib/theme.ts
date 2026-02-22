import type { FranchizeTheme } from "../actions";

export type CrewPalette = FranchizeTheme["palette"];

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "").trim();
  const base = normalized.length === 3
    ? normalized.split("").map((char) => `${char}${char}`).join("")
    : normalized;
  if (!/^[0-9A-Fa-f]{6}$/.test(base)) {
    return { r: 242, g: 242, b: 243 };
  }

  return {
    r: Number.parseInt(base.slice(0, 2), 16),
    g: Number.parseInt(base.slice(2, 4), 16),
    b: Number.parseInt(base.slice(4, 6), 16),
  };
};

const withAlpha = (hex: string, alpha: number) => {
  const safeAlpha = Math.min(1, Math.max(0, alpha));
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
};

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

export function catalogCardVariantStyles(theme: FranchizeTheme, variantIndex: number) {
  const palette = theme.palette;
  const variants = [
    {
      borderColor: palette.borderSoft,
      backgroundColor: palette.bgCard,
    },
    {
      borderColor: withAlpha(palette.accentMain, 0.35),
      backgroundImage: `linear-gradient(to bottom, ${withAlpha(palette.bgCard, 0.96)}, ${theme.palette.bgBase})`,
      boxShadow: `0 12px 28px ${withAlpha(palette.accentMain, 0.08)}`,
    },
    {
      borderColor: palette.borderSoft,
      backgroundColor: palette.bgCard,
      boxShadow: `0 0 0 1px ${withAlpha(palette.accentMain, 0.12)}, 0 16px 26px ${withAlpha("#000000", 0.45)}`,
    },
  ] as const;

  return variants[Math.abs(variantIndex) % variants.length];
}


export function floatingCartOverlayBackground(theme: FranchizeTheme) {
  const alpha = theme.mode === "light" ? 0.9 : 0.94;
  return withAlpha(theme.palette.bgCard, alpha);
}

export function interactionRingStyle(theme: FranchizeTheme) {
  return {
    boxShadow: `0 0 0 2px ${withAlpha(theme.palette.accentMain, 0.72)}`,
  };
}
