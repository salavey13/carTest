"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { debugLogger as logger } from "@/lib/debugLogger";
import { navigationStore } from "@/stores/navigationStore";

export function useTelegramBackButton() {
  const { tg, isInTelegramContext } = useAppContext();
  const backHandlerRef = useRef<() => void>(() => {});

  const syncButtonVisibility = useCallback(() => {
    if (!tg?.BackButton) return;
    if (navigationStore.canGoBack()) tg.BackButton.show();
    else tg.BackButton.hide();
  }, [tg]);

  backHandlerRef.current = () => {
    if (navigationStore.canGoBack()) {
      window.history.back();
      return;
    }
    logger.info("[Telegram BackButton] No stack, closing Telegram WebApp.");
    tg?.close();
  };

  useEffect(() => {
    if (!isInTelegramContext || !tg?.BackButton || typeof window === "undefined") return;
    const backButton = tg.BackButton;

    const stableClick = () => backHandlerRef.current();
    const handlePopState = () => {
      navigationStore.pop();
      syncButtonVisibility();
    };

    const unsubscribe = navigationStore.subscribe(syncButtonVisibility);
    syncButtonVisibility();

    backButton.offClick(stableClick);
    backButton.onClick(stableClick);
    window.addEventListener("popstate", handlePopState);

    return () => {
      unsubscribe();
      backButton.offClick(stableClick);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isInTelegramContext, tg, syncButtonVisibility]);
}
