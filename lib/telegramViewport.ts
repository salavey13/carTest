"use client";

import type { TelegramWebApp } from "@/types/telegram";
import { logger } from "@/lib/logger";

type ExpandOptions = {
  attempts?: number;
  delayMs?: number;
};

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_DELAY_MS = 120;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function safeReady(webApp: TelegramWebApp | null | undefined): void {
  if (!webApp?.ready) {
    return;
  }

  try {
    webApp.ready();
  } catch (error) {
    logger.warn("[TG_VIEWPORT] ready() failed:", error);
  }
}

export async function safeExpand(
  webApp: TelegramWebApp | null | undefined,
  options: ExpandOptions = {},
): Promise<boolean> {
  if (!webApp?.expand) {
    return false;
  }

  const attempts = Math.max(1, options.attempts ?? DEFAULT_ATTEMPTS);
  const delayMs = Math.max(0, options.delayMs ?? DEFAULT_DELAY_MS);

  for (let i = 0; i < attempts; i += 1) {
    try {
      webApp.expand();
      return true;
    } catch (error) {
      logger.warn(`[TG_VIEWPORT] expand() attempt ${i + 1}/${attempts} failed:`, error);
      if (i < attempts - 1) {
        await wait(delayMs);
      }
    }
  }

  return false;
}

export function attachVisibilityExpandRecovery(
  webApp: TelegramWebApp | null | undefined,
  options: ExpandOptions = {},
): (() => void) | undefined {
  if (!webApp?.expand || typeof document === "undefined") {
    return undefined;
  }

  const onVisible = () => {
    if (document.visibilityState === "visible") {
      void safeExpand(webApp, options);
    }
  };

  document.addEventListener("visibilitychange", onVisible);
  return () => document.removeEventListener("visibilitychange", onVisible);
}
