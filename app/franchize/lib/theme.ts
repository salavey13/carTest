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
