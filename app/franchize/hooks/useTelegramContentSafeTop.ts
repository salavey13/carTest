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
// Resolution order:
//   1. tg.contentSafeAreaInset.top (Bot API 8.0+) — exact px occupied by the
//      native controls inside the Mini App viewport (0 in normal mode,
//      ~48-56px in fullscreen).
//   2. Fallback: TG_FULLSCREEN_TOP_FALLBACK_PX — conservative estimate that
//      also covers older clients without the API.
//
// The hook listens to the `contentSafeAreaChanged` event so toggling
// fullscreen re-measures immediately.

import { useEffect, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";

/** Conservative fallback for fullscreen native buttons (back + menu + gap). */
export const TG_FULLSCREEN_TOP_FALLBACK_PX = 54;

export function useTelegramContentSafeTop(): number {
  const { tg, isInTelegramContext } = useAppContext();
  const [contentTop, setContentTop] = useState<number>(() => {
    if (!isInTelegramContext || typeof window === "undefined") return 0;
    const inset = (window as unknown as { Telegram?: { WebApp?: { contentSafeAreaInset?: { top?: number } } } })
      ?.Telegram?.WebApp?.contentSafeAreaInset;
    const top = Number(inset?.top);
    return Number.isFinite(top) && top > 0 ? top : 0;
  });

  useEffect(() => {
    if (!isInTelegramContext) return;

    const read = () => {
      const inset = tg?.contentSafeAreaInset ?? (window as unknown as { Telegram?: { WebApp?: { contentSafeAreaInset?: { top?: number } } } })?.Telegram?.WebApp?.contentSafeAreaInset;
      const top = Number(inset?.top);
      setContentTop(Number.isFinite(top) && top > 0 ? top : 0);
    };

    read();
    const handler = () => read();
    window.addEventListener("contentSafeAreaChanged", handler);
    return () => window.removeEventListener("contentSafeAreaChanged", handler);
  }, [isInTelegramContext, tg]);

  return contentTop;
}
