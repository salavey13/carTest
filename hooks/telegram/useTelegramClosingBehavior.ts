"use client";

import { useEffect } from "react";
import type { TelegramWebApp } from "@/types/telegram";

/**
 * Telegram WebApp version requirements:
 * - ClosingConfirmation: v6.2+
 * - Fullscreen: v7.7+
 */
const MIN_VERSION_CLOSING_CONFIRMATION = "6.2";
const MIN_VERSION_FULLSCREEN = "7.7";

export function useTelegramClosingBehavior(tg: TelegramWebApp | null, enabled: boolean) {
  useEffect(() => {
    if (!tg || !enabled) return;

    // ClosingConfirmation requires v6.2+
    if (tg.isVersionAtLeast?.(MIN_VERSION_CLOSING_CONFIRMATION)) {
      tg.enableClosingConfirmation?.();
    }

    tg.expand?.();

    // Fullscreen requires v7.7+ - check version before calling
    if (tg.isVersionAtLeast?.(MIN_VERSION_FULLSCREEN)) {
      try {
        if (typeof tg.requestFullscreen === "function") {
          tg.requestFullscreen();
        }
      } catch {
        // Ignore if not supported despite version check
      }
    }

    return () => {
      // ClosingConfirmation requires v6.2+
      if (tg.isVersionAtLeast?.(MIN_VERSION_CLOSING_CONFIRMATION)) {
        tg.disableClosingConfirmation?.();
      }
    };
  }, [tg, enabled]);
}
