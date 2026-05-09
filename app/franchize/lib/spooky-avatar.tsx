// /app/franchize/lib/spooky-avatar.tsx
"use client";

import { useEffect } from "react";

/* ───────────────────────────────────────────────────────────────────────────
   Shared spooky ghost-glow utilities for avatar/logo loading states.

   SECURITY: All colour references use var(--spooky-accent) so that the
   keyframe text is a *static* string. The actual colour value flows only
   through React's style prop (which escapes values), eliminating any
   CSS-injection vector from a crafted palette entry like
   "red;} body{display:none}/*".
   ─────────────────────────────────────────────────────────────────────────── */

export const SPOOKY_STYLE_ID = "franchize-spooky-avatar-keyframes";
export const SPOOKY_ACCENT_VAR = "--spooky-accent";

/**
 * Validate that a CSS colour string is safe to pass into var() + color-mix().
 * Accepts #hex, rgb(), rgba(), hsl(), hsla(), hwb(), oklch(), named colours.
 * Rejects bare HSL triplets like "34 92% 70%" (needs hsl() wrapper)
 * and anything that looks like a CSS injection attempt.
 */
const SAFE_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|hwb\([^)]+\)|okl(ch|ab)\([^)]+\)|[a-zA-Z]+)$/;

export function sanitizeAccentColor(raw: string, fallback = "#f9ac67"): string {
  const trimmed = raw.trim();
  if (SAFE_COLOR_RE.test(trimmed)) return trimmed;
  return fallback;
}

/** Extract the first letter of a name for the ghost placeholder */
export function getFirstLetter(name: string): string {
  return (name.trim()[0] || "O").toUpperCase();
}

/** Inject spooky @keyframes into <head> once. Idempotent. */
export function ensureSpookyKeyframes() {
  if (typeof document === "undefined" || document.getElementById(SPOOKY_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = SPOOKY_STYLE_ID;
  style.textContent = `
@keyframes spookyPulse {
  0%, 100% {
    opacity: 0.55;
    text-shadow:
      0 0 6px var(${SPOOKY_ACCENT_VAR}),
      0 0 18px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 27%, transparent),
      0 0 36px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 13%, transparent);
    transform: scale(1);
  }
  40% {
    opacity: 1;
    text-shadow:
      0 0 10px var(${SPOOKY_ACCENT_VAR}),
      0 0 28px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 53%, transparent),
      0 0 56px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 27%, transparent),
      0 0 80px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 13%, transparent);
    transform: scale(1.12);
  }
  60% {
    opacity: 0.7;
    text-shadow:
      0 0 4px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 67%, transparent),
      0 0 14px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 20%, transparent);
    transform: scale(0.96) rotate(-2deg);
  }
  80% {
    opacity: 0.9;
    text-shadow:
      0 0 8px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 80%, transparent),
      0 0 22px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 33%, transparent),
      0 0 44px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 20%, transparent);
    transform: scale(1.06) rotate(1deg);
  }
}
@keyframes spookyFlicker {
  0%, 100% { opacity: 1; }
  4% { opacity: 0.4; }
  6% { opacity: 1; }
  42% { opacity: 1; }
  44% { opacity: 0.6; }
  46% { opacity: 1; }
  78% { opacity: 1; }
  80% { opacity: 0.35; }
  82% { opacity: 0.9; }
  83% { opacity: 0.4; }
  84% { opacity: 1; }
}
@keyframes ghostDissolve {
  0% {
    opacity: 1;
    transform: scale(1);
    filter: blur(0px);
    text-shadow:
      0 0 10px var(${SPOOKY_ACCENT_VAR}),
      0 0 28px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 53%, transparent),
      0 0 56px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 27%, transparent);
  }
  35% {
    opacity: 0.8;
    transform: scale(1.15);
    filter: blur(0.5px);
    text-shadow:
      0 0 14px var(${SPOOKY_ACCENT_VAR}),
      0 0 40px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 73%, transparent),
      0 0 80px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 40%, transparent);
  }
  70% {
    opacity: 0.3;
    transform: scale(1.5);
    filter: blur(3px);
    text-shadow:
      0 0 24px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 80%, transparent),
      0 0 60px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 40%, transparent);
  }
  100% {
    opacity: 0;
    transform: scale(2.2);
    filter: blur(8px);
    text-shadow:
      0 0 40px var(${SPOOKY_ACCENT_VAR}),
      0 0 90px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 53%, transparent);
  }
}
`;
  document.head.appendChild(style);
}

/* ───────────────────────────────────────────────────────────────────────────
   SpookyLetter — permanent ghost letter for broken images
   ─────────────────────────────────────────────────────────────────────────── */

interface SpookyLetterProps {
  letter: string;
  color: string;
  /** Size class, e.g. "text-sm" (avatar) or "text-2xl" (logo) */
  sizeClass?: string;
}

export function SpookyLetter({ letter, color, sizeClass = "text-sm" }: SpookyLetterProps) {
  useEffect(() => {
    ensureSpookyKeyframes();
  }, []);

  return (
    <span
      className={`flex h-full w-full items-center justify-center font-bold select-none ${sizeClass}`}
      style={{
        color,
        [SPOOKY_ACCENT_VAR as string]: sanitizeAccentColor(color),
        animation: "spookyPulse 3s ease-in-out infinite, spookyFlicker 5s steps(1) infinite",
      }}
    >
      {letter}
    </span>
  );
}
