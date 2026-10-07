import type { CSSProperties, ReactNode } from "react";
import type { FranchizeTheme } from "../actions";
import { readablePaletteTextOnColor } from "../lib/theme";

type FranchizePageShellProps = {
  theme: FranchizeTheme;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  width?: "content" | "wide" | "full";
};

/**
 * Convert a palette color to the app-wide shadcn convention.
 *
 * The whole app stores shadcn variables (--card, --border, --primary, …) as
 * raw HSL triplets ("36 92% 68%") — tailwind.config.ts consumes them as
 * `hsl(var(--card))`. This shell previously assigned HEX strings
 * ("#1A1A1A"), producing `hsl(#1A1A1A)` → invalid at computed-value time →
 * `bg-card` collapsed to transparent and `border` fell back to `currentColor`
 * (bright beige) on every crew page using Card/Badge/Select/Button.
 * Converting hex → triplet restores proper crew styling. Non-hex input is
 * returned unchanged (never worse than before).
 */
function hslTriplet(color: string): string {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return color;

  const hex = match[1];
  const full = hex.length === 3
    ? hex.split("").map((ch) => ch + ch).join("")
    : hex;

  let r = parseInt(full.slice(0, 2), 16) / 255;
  let g = parseInt(full.slice(2, 4), 16) / 255;
  let b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }

  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

type FranchizeShellVars = CSSProperties & {
  "--franchize-shell-bg": string;
  "--franchize-shell-card": string;
  "--franchize-shell-border": string;
  "--franchize-shell-text": string;
  "--franchize-shell-muted": string;
  "--franchize-shell-accent": string;
  "--franchize-shell-primary-contrast": string;
  "--franchize-shell-ring": string;
  // shadcn/ui CSS variables for proper component styling
  "--background": string;
  "--foreground": string;
  "--card": string;
  "--card-foreground": string;
  "--popover": string;
  "--popover-foreground": string;
  "--primary": string;
  "--primary-foreground": string;
  "--secondary": string;
  "--secondary-foreground": string;
  "--muted": string;
  "--muted-foreground": string;
  "--accent": string;
  "--accent-foreground": string;
  "--destructive": string;
  "--destructive-foreground": string;
  "--border": string;
  "--input": string;
  "--ring": string;
};

export function FranchizePageShell({
  theme,
  children,
  className = "",
  contentClassName = "",
  width = "content",
}: FranchizePageShellProps) {
  const palette = theme.palette;
  const isAuto = theme.isAuto;

  // Use CSS variables when in auto mode, otherwise use palette directly
  const shellVars: FranchizeShellVars = {
    "--franchize-shell-bg": isAuto ? "var(--franchize-bg-base)" : palette.bgBase,
    "--franchize-shell-card": isAuto ? "var(--franchize-bg-card)" : palette.bgCard,
    "--franchize-shell-border": isAuto ? "var(--franchize-border-soft)" : palette.borderSoft,
    "--franchize-shell-text": isAuto ? "var(--franchize-text-primary)" : palette.textPrimary,
    "--franchize-shell-muted": isAuto ? "var(--franchize-text-secondary)" : palette.textSecondary,
    "--franchize-shell-accent": isAuto ? "var(--franchize-accent-main)" : palette.accentMain,
    "--franchize-shell-primary-contrast": isAuto
      ? readablePaletteTextOnColor(theme.palettes?.dark?.accentMain || theme.palettes?.light?.accentMain || palette.accentMain, theme.palettes?.dark || theme.palettes?.light || palette)
      : readablePaletteTextOnColor(palette.accentMain, palette),
    "--franchize-shell-ring": isAuto ? "var(--franchize-accent-main)" : palette.accentMain,
    // Set up shadcn/ui CSS variables for proper shadcn component styling
    // (Card/Badge/Select/Button consume them as hsl(var(--x))).
    //
    // AUTO MODE: no shadcn overrides at all — inherit the global :root/.dark
    // triplets (which ARE the auto crew palette by seed design). The previous
    // overrides here were broken: `hsl(var(--background))` is a self-cycle and
    // `var(--franchize-accent-main)` is a hex consumed inside hsl() → invalid
    // → transparent backgrounds / currentColor borders.
    //
    // NON-AUTO: palette hex converted to HSL triplets (hslTriplet).
    ...(isAuto
      ? {}
      : {
          "--background": hslTriplet(palette.bgCard),
          "--foreground": hslTriplet(palette.textPrimary),
          "--card": hslTriplet(palette.bgCard),
          "--card-foreground": hslTriplet(palette.textPrimary),
          "--popover": hslTriplet(palette.bgCard),
          "--popover-foreground": hslTriplet(palette.textPrimary),
          "--primary": hslTriplet(palette.accentMain),
          "--primary-foreground": hslTriplet(readablePaletteTextOnColor(palette.accentMain, palette)),
          "--secondary": hslTriplet(palette.bgBase),
          "--secondary-foreground": hslTriplet(palette.textPrimary),
          "--muted": hslTriplet(palette.bgBase),
          "--muted-foreground": hslTriplet(palette.textSecondary),
          "--accent": hslTriplet(palette.accentMain),
          "--accent-foreground": hslTriplet(readablePaletteTextOnColor(palette.accentMain, palette)),
          "--destructive": "0 84% 60%",
          "--destructive-foreground": "0 0% 100%",
          "--border": hslTriplet(palette.borderSoft),
          "--input": hslTriplet(palette.borderSoft),
          "--ring": hslTriplet(palette.accentMain),
        }),
  } as FranchizeShellVars;
  // Full-width: no max-width constraint and minimal padding
  // Wide: max-w-6xl with standard padding
  // Content: max-w-5xl with standard padding
  const isFull = width === "full";
  const maxWidthClass = isFull ? "" : width === "wide" ? "max-w-6xl" : "max-w-5xl";
  const paddingClass = isFull ? "px-2 py-3 sm:px-3 sm:py-4" : "px-3 py-5 sm:px-4 sm:py-8";
  const innerPadding = isFull ? "p-2 sm:p-3" : "p-4 sm:p-6";
  const roundedClass = isFull ? "rounded-xl sm:rounded-2xl" : "rounded-[2rem]";

  return (
    <section
      className={`mx-auto w-full ${maxWidthClass} ${paddingClass} ${className}`}
      style={shellVars}
    >
      <div
        className={`relative overflow-hidden ${roundedClass} border ${innerPadding} backdrop-blur ${contentClassName}`}
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
