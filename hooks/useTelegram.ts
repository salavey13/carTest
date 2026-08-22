"use client";

import { useCallback, useMemo } from "react";
import type { TelegramWebApp } from "@/types/telegram";
import { logger as globalLogger } from "@/lib/logger";
import { useTelegramAuth } from "@/hooks/telegram/useTelegramAuth";
import { useTelegramViewport } from "@/hooks/telegram/useTelegramViewport";
import { useTelegramTheme } from "@/hooks/telegram/useTelegramTheme";
import { useTelegramClosingBehavior } from "@/hooks/telegram/useTelegramClosingBehavior";

export function useTelegram() {
  const auth = useTelegramAuth();
  const {
    tg,
    user,
    dbUser,
    isInTelegramContext,
    isAuthenticated,
    isAuthenticating,
    isAdmin,
    isLoading,
    error,
    startParam,
  } = auth;

  useTelegramViewport(auth.tg, Boolean(auth.tg));
  useTelegramClosingBehavior(auth.tg, Boolean(auth.tg));
  const theme = useTelegramTheme(auth.tg);

  const safeWebAppCall = useCallback(<T extends (...args: any[]) => any>(
    methodName: keyof TelegramWebApp,
    ...args: Parameters<T>
  ): ReturnType<T> | undefined => {
    if (tg && typeof tg[methodName] === "function") {
      try {
        return (tg[methodName] as T)(...args);
      } catch (callError) {
        globalLogger.error(`[HOOK_TELEGRAM safeWebAppCall] Error calling tgWebApp.${String(methodName)}:`, callError);
      }
    }
    return undefined;
  }, [tg]);

  return useMemo(() => ({
    tg,
    user,
    dbUser,
    isInTelegramContext,
    isAuthenticated,
    isAuthenticating,
    isAdmin: () => isAdmin,
    isLoading,
    error,
    startParam,
    openLink: (url: string) => safeWebAppCall("openLink", url),
    close: () => safeWebAppCall("close"),
    showPopup: (params: any) => safeWebAppCall("showPopup", params),
    sendData: (data: string) => safeWebAppCall("sendData", data),
    getInitData: () => tg?.initDataUnsafe ?? null,
    expand: () => safeWebAppCall("expand"),
    setHeaderColor: (color: string) => safeWebAppCall("setHeaderColor", color),
    setBackgroundColor: (color: string) => safeWebAppCall("setBackgroundColor", color),
    platform: tg?.platform ?? "unknown",
    themeParams: theme.themeParams,
    initData: tg?.initData,
    initDataUnsafe: tg?.initDataUnsafe,
    colorScheme: theme.colorScheme,
  }), [
    dbUser,
    error,
    isAdmin,
    isAuthenticated,
    isAuthenticating,
    isInTelegramContext,
    isLoading,
    safeWebAppCall,
    startParam,
    tg,
    theme.colorScheme,
    theme.themeParams,
    user,
  ]);
}
