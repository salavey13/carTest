"use client";

import { useEffect } from "react";
import type { TelegramWebApp } from "@/types/telegram";

export function useTelegramClosingBehavior(tg: TelegramWebApp | null, enabled: boolean) {
  useEffect(() => {
    if (!tg || !enabled || typeof tg.enableClosingConfirmation !== "function") return;
    tg.enableClosingConfirmation();
    return () => {
      if (typeof tg.disableClosingConfirmation === "function") {
        tg.disableClosingConfirmation();
      }
    };
  }, [tg, enabled]);
}
