import type { CSSProperties, ReactNode } from "react";
import type { FranchizeTheme } from "../actions";

type FranchizePageShellProps = {
  theme: FranchizeTheme;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  width?: "content" | "wide";
};

type FranchizeShellVars = CSSProperties & {
  "--franchize-shell-bg": string;
  "--franchize-shell-card": string;
  "--franchize-shell-border": string;
  "--franchize-shell-text": string;
  "--franchize-shell-muted": string;
  "--franchize-shell-accent": string;
  "--franchize-shell-primary-contrast": string;
  "--franchize-shell-ring": string;
};

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "").trim();
  const base =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  if (!/^[0-9A-Fa-f]{6}$/.test(base)) return null;

  return {
    r: Number.parseInt(base.slice(0, 2), 16),
    g: Number.parseInt(base.slice(2, 4), 16),
    b: Number.parseInt(base.slice(4, 6), 16),
  };
};

const relativeLuminance = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const channels = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrastRatio = (foreground: string, background: string) => {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
};

const pickBestAccentText = (palette: FranchizeTheme["palette"]) =>
  [palette.textPrimary, palette.bgBase, palette.bgCard].sort(
    (left, right) =>
      contrastRatio(right, palette.accentMain) -
      contrastRatio(left, palette.accentMain),
  )[0];

export function FranchizePageShell({
  theme,
  children,
  className = "",
  contentClassName = "",
  width = "content",
}: FranchizePageShellProps) {
  const palette = theme.palette;
  const shellVars: FranchizeShellVars = {
    "--franchize-shell-bg": palette.bgBase,
    "--franchize-shell-card": palette.bgCard,
    "--franchize-shell-border": palette.borderSoft,
    "--franchize-shell-text": palette.textPrimary,
    "--franchize-shell-muted": palette.textSecondary,
    "--franchize-shell-accent": palette.accentMain,
    "--franchize-shell-primary-contrast": pickBestAccentText(palette),
    "--franchize-shell-ring": palette.accentMain,
  };
  const maxWidthClass = width === "wide" ? "max-w-6xl" : "max-w-5xl";

  return (
    <section
      className={`mx-auto w-full ${maxWidthClass} px-3 py-5 sm:px-4 sm:py-8 ${className}`}
      style={shellVars}
    >
      <div
        className={`relative overflow-hidden rounded-[2rem] border p-4 backdrop-blur sm:p-6 ${contentClassName}`}
        style={{
          background:
            "radial-gradient(circle at top right, color-mix(in srgb, var(--franchize-shell-accent) 15%, transparent), transparent 34rem), color-mix(in srgb, var(--franchize-shell-card) 90%, transparent)",
          borderColor: "var(--franchize-shell-border)",
          color: "var(--franchize-shell-text)",
          boxShadow:
            "0 24px 70px color-mix(in srgb, var(--franchize-shell-accent) 14%, transparent)",
        }}
      >
        {children}
      </div>
    </section>
  );
}
