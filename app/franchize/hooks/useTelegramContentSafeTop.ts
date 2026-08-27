"use client";

// useTelegramContentSafeTop
// ──────────────────────────────────────────────────────────────────────────
// Returns the extra top padding (px) needed so sticky headers / modals clear
// the Telegram Mini App NATIVE buttons (back "‹" + "⋮") in FULLSCREEN mode.
//
// Why: in fullscreen mode the native controls overlay the top of the webview.
// env(safe-area-inset-top) does NOT include them (it only covers the OS notch
// / status bar), so a header padded by safe-area alone gets its action row
// (profile dropdown, cart icon, hamburger) covered by the native buttons.
//
// Resolution order (POLISH 2026-08-27, FIX 2026-08-28):
//   1. tg.contentSafeAreaInset.top (Bot API 8.0+) — exact px occupied by the
//      native controls inside the Mini App viewport (0 in normal mode,
//      ~47-56px in fullscreen). Trusted on any viewport — it is a real
//      measurement.
//   2. Fallback TG_FULLSCREEN_TOP_FALLBACK_PX — applied when the viewport is
//      NARROW (the app's mobile layout, < 1024px). FIX iter14: the old
//      `fullscreen !== false` gate is GONE — real clients report isFullscreen
//      unreliably (some say false while the native buttons still overlay the
//      webview), which collapsed the header padding to ~1.45rem and covered
//      the action row. On mobile the fallback now applies unconditionally;
//      the extra headroom in non-fullscreen matches the comfortable look the
//      user historically had (the 6rem floor) and is the safe direction.
//      Wide/desktop layouts NEVER have overlapping native buttons → 0 →
//      compact padding (no dead space on desktop Telegram).
//   3. 0 otherwise.
//
// The hook listens to `contentSafeAreaChanged` and `fullscreenChanged` events
// plus the viewport media query, so toggling fullscreen / rotating / resizing
// re-measures immediately.

import { useEffect, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";

/** Conservative fallback for fullscreen native buttons (back + menu + gap). */
export const TG_FULLSCREEN_TOP_FALLBACK_PX = 54;

/** The app's mobile-layout breakpoint (Tailwind `lg:`). */
const MOBILE_LAYOUT_MEDIA_QUERY = "(max-width: 1023px)";

type TgWebAppLike = {
  contentSafeAreaInset?: { top?: number } | null;
  isFullscreen?: boolean;
};

function readWebApp(): TgWebAppLike | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Telegram?: { WebApp?: TgWebAppLike } })?.Telegram?.WebApp;
}

function readContentTopPx(source?: TgWebAppLike | null): number {
  const top = Number(source?.contentSafeAreaInset?.top);
  return Number.isFinite(top) && top > 0 ? top : 0;
}

/**
 * Tracks whether the app renders its MOBILE layout (Tailwind `lg` breakpoint
 * = 1024px). Shared by the header padding policy so the generous Telegram
 * clearance only applies to narrow viewports.
 */
export function useIsMobileLayout(): boolean {
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY);
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return isNarrow;
}

export function useTelegramContentSafeTop(): number {
  const { tg, isInTelegramContext } = useAppContext();

  // First-render synchronous read (client only; SSR stays 0 — settled after mount)
  const [contentTop, setContentTop] = useState<number>(() =>
    isInTelegramContext ? readContentTopPx(readWebApp()) : 0,
  );
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);

  useEffect(() => {
    if (!isInTelegramContext) return;

    const source = (tg as TgWebAppLike & {
      onEvent?: (event: string, cb: () => void) => void;
      offEvent?: (event: string, cb: () => void) => void;
    } | null | undefined) ?? readWebApp();

    const read = () => {
      setContentTop(readContentTopPx(source));
    };

    read();

    // POLISH FIX: the official SDK dispatches events ONLY to onEvent
    // subscribers — it does NOT dispatch DOM events on window (verified in
    // telegram-web-app.js receiveEvent → callEventCallbacks). The old
    // window-only listeners never fired, so toggling fullscreen never
    // re-measured. Subscribe through the SDK (with window listeners kept as
    // a harmless fallback for exotic setups).
    const events = ["contentSafeAreaChanged", "fullscreenChanged"] as const;
    for (const event of events) {
      try {
        source?.onEvent?.(event, read);
      } catch {
        // older clients without the event — the value is read once above
      }
      window.addEventListener(event, read);
    }
    return () => {
      for (const event of events) {
        try {
          source?.offEvent?.(event, read);
        } catch {
          // ignore
        }
        window.removeEventListener(event, read);
      }
    };
  }, [isInTelegramContext, tg]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY);
    const apply = () => setIsNarrowViewport(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (!isInTelegramContext) return 0;
  // 1. Exact measurement from the client (any viewport, fullscreen or not)
  if (contentTop > 0) return contentTop;
  // 2. Mobile layout → fallback (fullscreen state deliberately NOT trusted —
  //    clients report it unreliably; see header comment)
  if (isNarrowViewport) return TG_FULLSCREEN_TOP_FALLBACK_PX;
  // 3. Wide layout — no overlapping native buttons
  return 0;
}
