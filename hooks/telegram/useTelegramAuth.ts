"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { logger as globalLogger } from "@/lib/logger";
import { isAllowedMockContext } from "@/lib/telegram-mock-context";
import { getTelegramLaunchParamsFromWindow } from "@/lib/telegram-launch-params";
import { fetchDbUserAction, upsertTelegramUserAction } from "@/contexts/actions";
import type { Database } from "@/types/database.types";
import type { TelegramWebApp, WebAppInitData, WebAppUser } from "@/types/telegram";

export const DEFAULT_THEME_PARAMS = {
  bg_color: "#000000",
  text_color: "#ffffff",
  hint_color: "#888888",
  link_color: "#007aff",
  button_color: "#007aff",
  button_text_color: "#ffffff",
  secondary_bg_color: "#1c1c1d",
  header_bg_color: "#000000",
  accent_text_color: "#007aff",
  section_bg_color: "#1c1c1d",
  section_header_text_color: "#8e8e93",
  subtitle_text_color: "#8e8e93",
  destructive_text_color: "#ff3b30",
};

type DatabaseUser = Database["public"]["Tables"]["users"]["Row"] | null;
const MOCK_USER_ID_STR = process.env.NEXT_PUBLIC_MOCK_USER_ID || "413553377";
const MOCK_USER: WebAppUser | null = process.env.NEXT_PUBLIC_USE_MOCK_USER === "true" ? {
  id: parseInt(MOCK_USER_ID_STR, 10),
  first_name: process.env.NEXT_PUBLIC_MOCK_USER_FIRST_NAME || "Mock",
  last_name: process.env.NEXT_PUBLIC_MOCK_USER_LAST_NAME || "User",
  username: process.env.NEXT_PUBLIC_MOCK_USER_USERNAME || "mockuser",
  language_code: process.env.NEXT_PUBLIC_MOCK_USER_LANG || "ru",
  photo_url: process.env.NEXT_PUBLIC_MOCK_USER_PHOTO || "",
} : null;

async function validateTelegramAuthWithApi(initDataString: string): Promise<WebAppUser | null> {
  if (!initDataString) return null;
  try {
    const response = await fetch("/api/validate-telegram-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: initDataString }),
    });
    const result = await response.json();
    if (!response.ok || !result?.isValid || !result?.user?.id) return null;
    const tgUser = result.user as WebAppInitData["user"];
    return tgUser ? { ...tgUser } as WebAppUser : null;
  } catch {
    return null;
  }
}

export function useTelegramAuth() {
  const [tg, setTg] = useState<TelegramWebApp | null>(null);
  const [user, setUser] = useState<WebAppUser | null>(null);
  const [dbUser, setDbUser] = useState<DatabaseUser>(null);
  const [isInTelegramContext, setIsInTelegramContext] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [startParam, setStartParam] = useState<string | null>(null);
  const mounted = useRef(false);

  const handleAuthentication = useCallback(async (userToAuth: WebAppUser) => {
    const userId = String(userToAuth.id);
    const payload = {
      userId,
      username: userToAuth.username || null,
      fullName: `${userToAuth.first_name || ""} ${userToAuth.last_name || ""}`.trim() || null,
      avatarUrl: userToAuth.photo_url || null,
      languageCode: userToAuth.language_code || null,
    };
    let userFromDb = await fetchDbUserAction(userId);
    if (!userFromDb) userFromDb = await upsertTelegramUserAction(payload);
    else {
      const changed = userFromDb.username !== payload.username || userFromDb.full_name !== payload.fullName || userFromDb.avatar_url !== payload.avatarUrl || userFromDb.language_code !== payload.languageCode;
      if (changed) userFromDb = await upsertTelegramUserAction(payload);
    }
    if (!userFromDb) throw new Error("Failed to authenticate Telegram user in DB.");
    return userFromDb;
  }, []);

  useEffect(() => {
    mounted.current = true;
    const can = () => mounted.current;
    (async () => {
      try {
        const launchParams = getTelegramLaunchParamsFromWindow();
        const webApp = typeof window !== "undefined" ? (window as any).Telegram?.WebApp ?? null : null;
        const initData = webApp?.initData || launchParams.initData || "";
        if (can()) {
          setTg(webApp);
          setStartParam(webApp?.initDataUnsafe?.start_param || launchParams.startParam || null);
        }

        let candidate = await validateTelegramAuthWithApi(initData);
        if (!candidate && webApp?.initDataUnsafe?.user?.id && process.env.NODE_ENV === "development") candidate = webApp.initDataUnsafe.user;
        if (!candidate && MOCK_USER && isAllowedMockContext()) candidate = MOCK_USER;

        const realTg = Boolean(initData && candidate && candidate !== MOCK_USER);
        if (can()) setIsInTelegramContext(realTg);

        if (!candidate) throw new Error("No user data available for authentication.");
        const persisted = await handleAuthentication(candidate);
        if (can()) {
          setUser(candidate);
          setDbUser(persisted);
          setIsAuthenticated(true);
          setError(null);
        }
      } catch (e) {
        if (can()) setError(e instanceof Error ? e : new Error("Telegram auth init failed."));
      } finally {
        if (can()) {
          setIsAuthenticating(false);
          setIsLoading(false);
        }
      }
    })();

    return () => {
      mounted.current = false;
    };
  }, [handleAuthentication]);

  const isAdmin = useMemo(() => {
    if (!dbUser) return false;
    return dbUser.status === "admin" || dbUser.role === "admin" || dbUser.role === "vprAdmin";
  }, [dbUser]);

  return { tg, user, dbUser, isInTelegramContext, isAuthenticated, isAuthenticating, isLoading, error, startParam, isAdmin };
}
