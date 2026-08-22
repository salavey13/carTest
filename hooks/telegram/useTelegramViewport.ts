"use client";

import { useEffect } from "react";
import { attachVisibilityExpandRecovery, safeExpand, safeReady } from "@/lib/telegramViewport";
import type { TelegramWebApp } from "@/types/telegram";

export function useTelegramViewport(tg: TelegramWebApp | null, enabled: boolean) {
  useEffect(() => {
    if (!tg || !enabled) return;
    safeReady(tg);
    let detach: (() => void) | undefined;
    let isActive = true;
    (async () => {
      if (tg.expand) {
        await safeExpand(tg, { attempts: 3, delayMs: 120 });
        if (!isActive) return;
        detach = attachVisibilityExpandRecovery(tg, { attempts: 2, delayMs: 150 });
      }
    })();
    return () => {
      isActive = false;
      detach?.();
    };
  }, [tg, enabled]);
}
