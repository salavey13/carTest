// /hooks/useTelegram.ts
// Detect Telegram WebApp context and expose MainButton/Haptic APIs.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface TelegramWebApp {
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    setText: (text: string) => void;
    setParams: (params: { text?: string; color?: string; text_color?: string }) => void;
  };
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
  };
  initDataUnsafe: {
    user?: { id: number; first_name: string; last_name?: string; username?: string };
  };
  ready: () => void;
  expand: () => void;
  isExpanded: boolean;
  platform: string;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

export function useTelegram() {
  const [isReady, setIsReady] = useState(false);

  const webApp = useMemo(() => {
    if (typeof window === "undefined") return null;
    return window.Telegram?.WebApp || null;
  }, []);

  const isTelegram = webApp !== null;

  useEffect(() => {
    if (webApp) {
      webApp.ready();
      webApp.expand();
      setIsReady(true);
    }
  }, [webApp]);

  // Set MainButton
  const setMainButton = useCallback(
    (text: string, color: string, onClick: () => void) => {
      if (!webApp?.MainButton) return;
      webApp.MainButton.setParams({ text, color });
      webApp.MainButton.onClick(onClick);
      webApp.MainButton.show();
      return () => {
        webApp.MainButton.offClick(onClick);
        webApp.MainButton.hide();
      };
    },
    [webApp],
  );

  // Haptic feedback
  const haptic = useCallback(
    (type: "impact" | "notification" | "selection", style?: string) => {
      if (!webApp?.HapticFeedback) return;
      if (type === "impact") webApp.HapticFeedback.impactOccurred((style as any) || "medium");
      if (type === "notification") webApp.HapticFeedback.notificationOccurred((style as any) || "success");
      if (type === "selection") webApp.HapticFeedback.selectionChanged();
    },
    [webApp],
  );

  return {
    isTelegram,
    isReady,
    webApp,
    themeParams: webApp?.themeParams || {},
    setMainButton,
    haptic,
    userId: webApp?.initDataUnsafe?.user?.id?.toString(),
  };
}
