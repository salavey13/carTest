"use client";

import { useEffect } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { debugLogger as logger } from "@/lib/debugLogger";
import { navigationStore } from "@/stores/navigationStore";

export function useTelegramBackButton() {
  const { tg, isInTelegramContext } = useAppContext();

  useEffect(() => {
    if (!isInTelegramContext || !tg?.BackButton || typeof window === "undefined") {
      return;
    }

    const backButton = tg.BackButton;

    const syncButtonVisibility = () => {
      if (navigationStore.canGoBack()) {
        backButton.show();
      } else {
        backButton.hide();
      }
    };

    const handleBack = () => {
      if (navigationStore.canGoBack()) {
        window.history.back();
        return;
      }

      logger.info("[Telegram BackButton] No internal navigation stack, closing Telegram WebApp.");
      tg.close();
    };

    const handlePopState = () => {
      navigationStore.pop();
      syncButtonVisibility();
    };

    const unsubscribe = navigationStore.subscribe(syncButtonVisibility);

    syncButtonVisibility();
    backButton.onClick(handleBack);
    window.addEventListener("popstate", handlePopState);

    return () => {
      unsubscribe();
      backButton.offClick(handleBack);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isInTelegramContext, tg]);
}
