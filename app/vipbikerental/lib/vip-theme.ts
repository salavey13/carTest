/**
 * VIP Bike Rental Theme Integration
 * =================================
 * Theme helpers and constants for VIP bike rental components.
 * Bridges the gap between hardcoded styles and the franchize theme system.
 */

import type { FranchizeTheme } from "@/lib/franchize-config";
import { withAlpha } from "@/app/franchize/lib/theme";

// ── VIP Bike Brand Colors ──
// These are the brand colors used across VIP bike rental pages
export const VIP_BRAND_COLORS = {
  // Primary accent (gold/amber)
  primary: "#D99A00",
  primaryHover: "#E2A812",
  primaryLight: "#FFD700",

  // Secondary colors
  secondary: "#FF6A00",
  secondaryLight: "#FF8C00",

  // Background colors
  bgDark: "#0A0A0A",
  bgCard: "#1A1A1A",
  bgLight: "#FAFAFA",

  // Text colors
  textPrimary: "#F2F2F3",
  textSecondary: "#A7ABB4",
  textMuted: "#6B7280",

  // Border colors
  border: "#2A2A2A",
  borderLight: "#E0E0E0",
} as const;

// ── CSS Variable Mappings ──
// Maps VIP brand colors to CSS variable names for consistency
export const VIP_CSS_VARS = {
  accent: "--vip-accent",
  accentHover: "--vip-accent-hover",
  accentSubtle: "--vip-accent-subtle",
  bgBase: "--vip-bg-base",
  bgCard: "--vip-bg-card",
  textPrimary: "--vip-text-primary",
  textSecondary: "--vip-text-secondary",
  border: "--vip-border",
} as const;

// ── Theme Utility Functions ──

/**
 * Get VIP brand color with alpha transparency
 * @param color - Color key from VIP_BRAND_COLORS or hex string
 * @param alpha - Alpha value (0-1)
 */
export function vipColorWithAlpha(color: keyof typeof VIP_BRAND_COLORS | string, alpha: number) {
  const hexColor = typeof color === "string" && color.startsWith("#")
    ? color
    : VIP_BRAND_COLORS[color as keyof typeof VIP_BRAND_COLORS];
  return withAlpha(hexColor, alpha);
}

/**
 * Generate gradient string for hero backgrounds
 * @param color - Accent color for gradient
 */
export function vipHeroGradient(color: string = VIP_BRAND_COLORS.primary) {
  return `radial-gradient(ellipse_at_top, ${vipColorWithAlpha(color, 0.15)}, transparent 50%)`;
}

/**
 * Generate shadow string for cards
 * @param color - Accent color for shadow
 * @param opacity - Shadow opacity
 */
export function vipCardShadow(color: string = VIP_BRAND_COLORS.primary, opacity: number = 0.3) {
  return `0 4px 20px ${vipColorWithAlpha(color, opacity)}`;
}

/**
 * Generate glow effect string
 * @param color - Accent color for glow
 * @param spread - Spread radius in pixels
 */
export function vipGlowEffect(color: string = VIP_BRAND_COLORS.primary, spread: number = 20) {
  return `0 0 ${spread}px ${vipColorWithAlpha(color, 0.4)}`;
}

// ── Style Object Generators ──

/**
 * Generate styles for a VIP accent button
 */
export function vipAccentButtonStyle(accentColor: string = VIP_BRAND_COLORS.primary) {
  return {
    backgroundColor: accentColor,
    color: "#16130A", // Dark text for contrast
    boxShadow: vipCardShadow(accentColor, 0.4),
    transition: "all 0.2s ease",
  };
}

/**
 * Generate styles for a VIP card
 */
export function vipCardStyle(
  accentColor: string = VIP_BRAND_COLORS.primary,
  isDark: boolean = true
) {
  return {
    backgroundColor: isDark ? VIP_BRAND_COLORS.bgCard : VIP_BRAND_COLORS.bgLight,
    borderColor: vipColorWithAlpha(accentColor, 0.3),
    color: isDark ? VIP_BRAND_COLORS.textPrimary : "#16130A",
    boxShadow: vipCardShadow(accentColor, 0.2),
  };
}

/**
 * Generate styles for VIP hero section
 */
export function vipHeroStyle(accentColor: string = VIP_BRAND_COLORS.primary) {
  return {
    background: [
      vipHeroGradient(accentColor),
      `linear-gradient(to bottom, ${VIP_BRAND_COLORS.bgDark}, ${VIP_BRAND_COLORS.bgCard})`,
    ].join(", "),
    backgroundColor: VIP_BRAND_COLORS.bgDark,
  };
}

// ── CSS Variable Injectors ──

/**
 * Generate CSS variables string for inline styles
 * @param accentColor - Custom accent color (optional)
 */
export function vipCssVars(accentColor?: string) {
  const accent = accentColor || VIP_BRAND_COLORS.primary;
  return {
    [VIP_CSS_VARS.accent]: accent,
    [VIP_CSS_VARS.accentHover]: VIP_BRAND_COLORS.primaryHover,
    [VIP_CSS_VARS.accentSubtle]: vipColorWithAlpha(accent, 0.12),
    [VIP_CSS_VARS.bgBase]: VIP_BRAND_COLORS.bgDark,
    [VIP_CSS_VARS.bgCard]: VIP_BRAND_COLORS.bgCard,
    [VIP_CSS_VARS.textPrimary]: VIP_BRAND_COLORS.textPrimary,
    [VIP_CSS_VARS.textSecondary]: VIP_BRAND_COLORS.textSecondary,
    [VIP_CSS_VARS.border]: VIP_BRAND_COLORS.border,
  };
}

/**
 * Convert franchize theme to VIP rental compatible styles
 * @param theme - Franchize theme object
 */
export function franchizeThemeToVipStyles(theme: FranchizeTheme) {
  const palette = theme.palette;
  return {
    accent: palette.accentMain,
    accentHover: palette.accentMainHover,
    accentSubtle: withAlpha(palette.accentMain, 0.12),
    bgBase: palette.bgBase,
    bgCard: palette.bgCard,
    textPrimary: palette.textPrimary,
    textSecondary: palette.textSecondary,
    border: palette.borderSoft,
  };
}

// ── Responsive Breakpoints ──
export const VIP_BREAKPOINTS = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;

// ── Spacing Scale ──
export const VIP_SPACING = {
  xs: "0.5rem",
  sm: "0.75rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
  "2xl": "3rem",
  "3xl": "4rem",
} as const;

// ── Border Radius ──
export const VIP_RADIUS = {
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
  "2xl": "2rem",
  full: "9999px",
} as const;
