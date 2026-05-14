"use client";

import { useEffect } from "react";
import type { TelegramWebApp } from "@/types/telegram";

export function useTelegramClosingBehavior(tg: TelegramWebApp | null, enabled: boolean) {
  useEffect(() => {
    if (!tg || !enabled) return;
    tg.enableClosingConfirmation?.();
    tg.expand?.();
    tg.requestFullscreen?.();

    return () => {
      tg.disableClosingConfirmation?.();
    };
  }, [tg, enabled]);
}
