"use client";

// rentals-analytics/hooks/useViewportHeightPx.ts
// ──────────────────────────────────────────────────────────────────────────
// iter18 — real PIXEL viewport height for the mobile bottom sheet.
//
// WHY: the sheet used to be `h-[90vh]`, but `vh` in the Telegram WebView (and
// mobile browsers generally) measures the LAYOUT viewport, which can be taller
// than the VISIBLE area (TG header, browser toolbar, fullscreen insets). The
// sheet then extended below the screen — the sticky footer («Открыть аренду»)
// was unreachable, and only rotating the device (which forces a viewport
// recalculation) brought it back.
//
// Resolution order:
//   1. tg.viewportStableHeight (Telegram WebApp SDK) — the exact px height of
//      the visible Mini App viewport, stable across keyboard shows.
//   2. window.innerHeight — the visual viewport fallback for plain browsers.
// Updated live on `viewportChanged` (TG), `resize` and `orientationchange`.
//
// Returns 0 before mount (SSR / first frame) — callers keep a CSS fallback.

import { useEffect, useState } from "react";

type TgWebAppLike = {
  viewportStableHeight?: number;
  onEvent?: (event: string, handler: () => void) => void;
  offEvent?: (event: string, handler: () => void) => void;
};

function readWebApp(): TgWebAppLike | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Telegram?: { WebApp?: TgWebAppLike } })?.Telegram?.WebApp;
}

function measure(): number {
  if (typeof window === "undefined") return 0;
  const webApp = readWebApp();
  const tgHeight = Number(webApp?.viewportStableHeight);
  if (Number.isFinite(tgHeight) && tgHeight > 0) return tgHeight;
  return Number.isFinite(window.innerHeight) && window.innerHeight > 0
    ? window.innerHeight
    : 0;
}

/**
 * Tracks the VISIBLE viewport height in pixels (Telegram-aware).
 * Re-measures on viewport changes, resizes and rotations.
 */
export function useViewportHeightPx(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    let frame = 0;
    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = measure();
        setHeight((prev) => (Math.abs(prev - next) > 0.5 ? next : prev));
      });
    };

    apply();

    const webApp = readWebApp();
    // `viewportChanged` fires when the TG header expands/collapses or the
    // user rotates — payload { isStateStable } ignored, we always re-measure.
    webApp?.onEvent?.("viewportChanged", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);

    return () => {
      cancelAnimationFrame(frame);
      webApp?.offEvent?.("viewportChanged", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  return height;
}
