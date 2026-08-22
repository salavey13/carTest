"use client";

import { useMemo } from "react";
import type { TelegramWebApp } from "@/types/telegram";
import { DEFAULT_THEME_PARAMS } from "./useTelegramAuth";

export function useTelegramTheme(tg: TelegramWebApp | null) {
  return useMemo(() => ({
    themeParams: tg?.themeParams ?? DEFAULT_THEME_PARAMS,
    colorScheme: tg?.colorScheme ?? "dark",
  }), [tg]);
}
