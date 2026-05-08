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
};

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
    "--franchize-shell-primary-contrast": readablePaletteTextOnColor(palette.accentMain, palette),
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
