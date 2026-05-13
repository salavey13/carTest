"use client";

import { useEffect } from "react";
import { attachVisibilityExpandRecovery, safeExpand, safeReady } from "@/lib/telegramViewport";
import type { TelegramWebApp } from "@/types/telegram";

export function useTelegramViewport(tg: TelegramWebApp | null, enabled: boolean) {
  useEffect(() => {
    if (!tg || !enabled) return;
    safeReady(tg);
    let detach: (() => void) | undefined;
    (async () => {
      if (tg.expand) {
        await safeExpand(tg, { attempts: 3, delayMs: 120 });
        detach = attachVisibilityExpandRecovery(tg, { attempts: 2, delayMs: 150 });
      }
    })();
    return () => detach?.();
  }, [tg, enabled]);
}
