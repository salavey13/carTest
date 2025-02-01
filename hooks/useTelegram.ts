// hooks/useTelegram.ts
"use client"
import { useCallback, useEffect, useState } from "react";
import { debugLogger } from "@/lib/debugLogger";
import type { TelegramWebApp, WebAppUser } from "@/types/telegram";
import { authenticateUser } from "@/app/actions";

const MOCK_USER: WebAppUser = {
  id: 413553377,
  first_name: "Mock",
  last_name: "User",
  username: "mockuser",
  language_code: "ru",
};

export function useTelegram() {
  const [tg, setTg] = useState<TelegramWebApp | null>(null);
  const [user, setUser] = useState<WebAppUser | null>(null);
  const [dbUser, setDbUser] = useState<WebAppUser | null>(null);
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const [isInTelegramContext, setIsInTelegramContext] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMockUser, setIsMockUser] = useState(false)
  const [error, setError] = useState<Error | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [webAppVersion, setWebAppVersion] = useState<number>(0);

  const initTelegram = useCallback(async () => {
    debugLogger.log("useTelegram: initTelegram called");
    setIsLoading(true);

    try {
      if (typeof window !== "undefined") {
        const scriptId = "telegram-web-app-script";
        if (!document.getElementById(scriptId)) {
          const script = document.createElement("script");
          script.id = scriptId;
          script.src = "https://telegram.org/js/telegram-web-app.js";
          script.async = true;
          document.head.appendChild(script);

          script.onload = () => {
            const telegram = (window as any).Telegram?.WebApp as TelegramWebApp;
            if (telegram && telegram.initDataUnsafe?.user) {
              telegram.ready();
              setTg(telegram);
              setWebAppVersion(Number.parseFloat(telegram.version));
              setIsInTelegramContext(true);
              setTheme(telegram.colorScheme);

              const user = telegram.initDataUnsafe?.user// || MOCK_USER;
              setUser(user);
              //handleAuthentication(user);
            } else {
              setIsInTelegramContext(false);
            }
          };
        }
      }
    } catch (err) {
      debugLogger.error("Error initializing Telegram:", err);
      setError(err instanceof Error ? err : new Error("Unknown error occurred"));
    } finally {
      setIsLoading(false);
    }
  }, []);

 const handleAuthentication = useCallback(async (user: WebAppUser) => {
    debugLogger.log("Authenticating user...");
    try {
      const { user: authenticatedUser, token } = await authenticateUser(user.id.toString(), {
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        language_code: user.language_code,
        photo_url: user.photo_url,
      });
      if (authenticatedUser && token) {
        debugLogger.log("User authenticated successfully");
        setJwtToken(await token);
        setDbUser(authenticatedUser);
      } else {
        throw new Error("Authentication failed");
      }
    } catch (err) {
      debugLogger.error("Failed to authenticate user:", err);
      setError(err instanceof Error ? err : new Error("Unknown error occurred"));
    }
  }, []);

  useEffect(() => {
    debugLogger.log("useTelegram: useEffect called for initTelegram");
    initTelegram();
  }, [initTelegram]);

const getJwtToken = useCallback(() => jwtToken, [jwtToken]);

  /*const shareUrl = useCallback(
    (url: string) => {
      if (tg && isInTelegramContext) {
        tg.shareUrl(url)
      } else {
        debugLogger.warn("shareUrl called outside Telegram context")
        alert(`Share URL: ${url}`)
      }
    },
    [tg, isInTelegramContext],
  )*/

  const openLink = useCallback(
    (url: string) => {
      if (tg && isInTelegramContext) {
        tg.openLink(url)
      } else {
        debugLogger.warn("openLink called outside Telegram context")
        window.open(url, "_blank")
      }
    },
    [tg, isInTelegramContext],
  )

  const setMockUser = useCallback(() => {
    setUser(MOCK_USER)
    setIsMockUser(true)
    handleAuthentication(MOCK_USER)
  }, [handleAuthentication])

  // Add isAuthenticated to return value
  const isAuthenticated = !!dbUser

  // Add theme change handler
  /*useEffect(() => {
    if (tg) {
      const handleThemeChange = () => setTheme(tg.colorScheme)
      tg.onEvent('themeChanged', handleThemeChange)
      return () => tg.offEvent('themeChanged', handleThemeChange)
    }
  }, [tg])*/

  return {
    tg,
    user,
    dbUser,
    getJwtToken,
    isInTelegramContext,
    isAuthenticated,
    isLoading,
 //   shareUrl,
    openLink,
    error,
    isMockUser,
    setMockUser,
    theme,
    webAppVersion,
  };
}


/*import { useEffect, useState } from 'react';

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export function useTelegram() {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initTelegram = () => {
      if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.expand();
        tg.enableClosingConfirmation();
        tg.MainButton.setText('Complete Test →');
        setUser(tg.initDataUnsafe.user);
        setIsLoading(false);
      }
    };

    window.addEventListener('telegram-ready', initTelegram);
    return () => window.removeEventListener('telegram-ready', initTelegram);
  }, []);

  return { user, isLoading };
}*/

