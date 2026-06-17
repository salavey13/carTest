import type { CSSProperties, ReactNode } from "react";
import type { FranchizeTheme } from "../actions";
import { readablePaletteTextOnColor } from "../lib/theme";

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
    // Set up shadcn/ui CSS variables for proper Button component styling
    "--background": isAuto ? "hsl(var(--background))" : palette.bgCard,
    "--foreground": isAuto ? "hsl(var(--foreground))" : palette.textPrimary,
    "--card": isAuto ? "hsl(var(--card))" : palette.bgCard,
    "--card-foreground": isAuto ? "hsl(var(--card-foreground))" : palette.textPrimary,
    "--popover": isAuto ? "hsl(var(--popover))" : palette.bgCard,
    "--popover-foreground": isAuto ? "hsl(var(--popover-foreground))" : palette.textPrimary,
    "--primary": isAuto ? "hsl(var(--primary))" : palette.accentMain,
    "--primary-foreground": isAuto ? "hsl(var(--primary-foreground))" : readablePaletteTextOnColor(palette.accentMain, palette),
    "--secondary": isAuto ? "hsl(var(--secondary))" : palette.bgBase,
    "--secondary-foreground": isAuto ? "hsl(var(--secondary-foreground))" : palette.textPrimary,
    "--muted": isAuto ? "hsl(var(--muted))" : palette.bgBase,
    "--muted-foreground": isAuto ? "hsl(var(--muted-foreground))" : palette.textSecondary,
    "--accent": isAuto ? "hsl(var(--accent))" : palette.accentMain,
    "--accent-foreground": isAuto ? "hsl(var(--accent-foreground))" : readablePaletteTextOnColor(palette.accentMain, palette),
    "--destructive": isAuto ? "hsl(var(--destructive))" : palette.accentMain,
    "--destructive-foreground": isAuto ? "hsl(var(--destructive-foreground))" : readablePaletteTextOnColor(palette.accentMain, palette),
    "--border": isAuto ? "hsl(var(--border))" : palette.borderSoft,
    "--input": isAuto ? "hsl(var(--input))" : palette.bgBase,
    "--ring": isAuto ? "hsl(var(--ring))" : palette.accentMain,
  } as CSSProperties;
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
