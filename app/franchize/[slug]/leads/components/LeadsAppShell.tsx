"use client";

import { type ReactNode } from "react";
import type { ThemeTokens } from "@/app/franchize/[slug]/leads/hooks/useTheme";

interface Props {
  children: ReactNode;
  className?: string;
  T: ThemeTokens;
  isMobile?: boolean;
}

/**
 * Root layout wrapper for the leads page.
 *
 * - Establishes the dark glass-panel background gradient (--bg #09090b)
 * - Provides horizontal page padding (mobile 16px / desktop 24-32px)
 * - Adds safe-area insets for mobile (iOS notch + home indicator)
 * - Stacks children vertically with consistent spacing
 */
export function LeadsAppShell({ children, className = "", T, isMobile = false }: Props) {
  return (
    <div
      className={`relative min-h-[100dvh] w-full ${className}`}
      style={{
        // Subtle radial-gradient + linear gradient on top of T.bg base.
        // Two layered backgrounds: a faint accent glow (top-left) and a vertical
        // dim fade (bottom). Both via color-mix so they react to the dynamic
        // crew theme accent color. Previously hardcoded #0c0c0f/#09090b which
        // broke on light themes and on crew theme overrides.
        background: `
          radial-gradient(1200px 480px at 12% -8%, ${hexA(T.accent, 0.10)}, transparent 60%),
          radial-gradient(900px 420px at 92% 0%, ${hexA(T.accent, 0.06)}, transparent 55%),
          linear-gradient(180deg, ${T.bgElevated} 0%, ${T.bg} 40%, ${T.bg} 100%)
        `,
        color: T.text,
      }}
    >
      {/* Top safe-area spacer (iOS notch / Dynamic Island) */}
      <div style={{ height: "env(safe-area-inset-top, 0px)" }} aria-hidden />

      <main
        className={`relative mx-auto w-full max-w-[1440px] ${
          isMobile ? "px-4 pb-24 pt-4" : "px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-8"
        }`}
        style={{
          // Reserve space for the mobile home-indicator + any fixed bottom tab bars.
          paddingBottom: isMobile
            ? "calc(env(safe-area-inset-bottom, 0px) + 96px)"
            : "calc(env(safe-area-inset-bottom, 0px) + 48px)",
        }}
      >
        {children}
      </main>
    </div>
  );
}

/** Convert #rrggbb + alpha → rgba() string. Falls back to the raw color if parsing fails. */
function hexA(hex: string, alpha: number): string {
  const m = /^#?([a-f0-9]{6})$/i.exec((hex || "").trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
