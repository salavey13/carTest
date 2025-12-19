"use client";

import type React from "react";
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { debugLogger } from "@/lib/debugLogger";
import { logger as globalLogger } from "@/lib/logger";
import { useAppToast } from "@/hooks/useAppToast";
import type { Database } from "@/types/database.types";
// Imported the new action
import { refreshDbUserAction, fetchUserCrewInfoAction, fetchActiveGameAction } from "./actions";

export type UserCrewInfo = {
  id: string;
  slug: string;
  name: string;
  logo_url: string;
  is_owner: boolean;
};

// NEW: Active Lobby Type
export type ActiveLobbyInfo = {
  id: string;
  name: string;
  start_at: string | null;
  actual_start_at: string | null;
  status: string;
};

interface AppContextData extends ReturnType<typeof useTelegram> {
  startParamPayload: string | null;
  refreshDbUser: () => Promise<void>;
  clearStartParam: () => void;
  userCrewInfo: UserCrewInfo | null;
  activeLobby: ActiveLobbyInfo | null;
}

const AppContext = createContext<Partial<AppContextData>>({});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const telegramHookData = useTelegram();
  const { user, dbUser: initialDbUser, isLoading: isTelegramLoading, isAuthenticating: isTelegramAuthenticating, error: telegramError, ...restTelegramData } = telegramHookData;

  const [dbUser, setDbUserInternal] = useState<Database["public"]["Tables"]["users"]["Row"] | null>(initialDbUser);
  const [startParamPayload, setStartParamPayload] = useState<string | null>(null);
  const [userCrewInfo, setUserCrewInfo] = useState<UserCrewInfo | null>(null);
  const [activeLobby, setActiveLobby] = useState<ActiveLobbyInfo | null>(null);

  const isLoading = isTelegramLoading;
  const isAuthenticating = isTelegramAuthenticating;
  const error = telegramError;

  useEffect(() => {
    setDbUserInternal(initialDbUser);
  }, [initialDbUser]);

  const appToast = useAppToast();

  const refreshDbUser = useCallback(async () => {
    if (user?.id) {
      debugLogger.info(`[AppContext refreshDbUser] Refreshing dbUser for user ID: ${user.id}`);
      const freshDbUser = await refreshDbUserAction(String(user.id));
      setDbUserInternal(freshDbUser);
      debugLogger.info(`[AppContext refreshDbUser] dbUser refreshed successfully.`);
    } else {
      debugLogger.warn("[AppContext refreshDbUser] Cannot refresh, user.id is not available.");
    }
  }, [user?.id]);

  // Fetch Crew Info
  useEffect(() => {
    const fetchCrewInfo = async () => {
      if (!dbUser?.user_id) {
        setUserCrewInfo(null);
        return;
      }
      const crewInfo = await fetchUserCrewInfoAction(dbUser.user_id);
      setUserCrewInfo(crewInfo);
    };

    fetchCrewInfo();
  }, [dbUser]);

  // Poll for Active Game (Optimized)
  useEffect(() => {
      if (!dbUser?.user_id) return;

      const checkActiveGame = async () => {
          // Uses Server Action now (Secure & Abstracted)
          const lobbyInfo = await fetchActiveGameAction(dbUser.user_id);
          setActiveLobby(lobbyInfo);
      };

      checkActiveGame();
      
      // RELAXED TIMER: 60 seconds.
      // Real-time updates within the lobby page handle the fast-paced stuff.
      // This is just to update the Global Header if they navigate away.
      const interval = setInterval(checkActiveGame, 60000); 
      return () => clearInterval(interval);
  }, [dbUser?.user_id]);

  const clearStartParam = useCallback(() => {
    debugLogger.info("[AppContext] Clearing startParamPayload.");
    setStartParamPayload(null);
  }, []);

  useEffect(() => {
    if (telegramHookData.tg && telegramHookData.tg.initDataUnsafe?.start_param) {
      const rawStartParam = telegramHookData.tg.initDataUnsafe.start_param;
      debugLogger.info(`[AppContext] Received start_param (raw): ${rawStartParam}.`);
      setStartParamPayload(rawStartParam);
    } else {
      if (startParamPayload !== null) {
        debugLogger.info(`[AppContext] No start_param found or tg not ready, ensuring startParamPayload is null.`);
        setStartParamPayload(null);
      }
    }
  }, [telegramHookData.tg, telegramHookData.tg?.initDataUnsafe?.start_param]);

  const contextValue = useMemo(() => {
    return {
      ...restTelegramData,
      user,
      dbUser,
      isLoading,
      isAuthenticating,
      error,
      startParamPayload,
      refreshDbUser,
      clearStartParam,
      userCrewInfo,
      activeLobby,
    };
  }, [restTelegramData, user, dbUser, isLoading, isAuthenticating, error, startParamPayload, refreshDbUser, clearStartParam, userCrewInfo, activeLobby]);

  // Logging & Toasts
  useEffect(() => {
    debugLogger.log("[APP_CONTEXT] State Updated.", {
      isAuthenticated: contextValue.isAuthenticated,
      isLoading: contextValue.isLoading,
      userId: contextValue.dbUser?.user_id,
      activeLobbyId: contextValue.activeLobby?.id
    });
  }, [contextValue.isAuthenticated, contextValue.isLoading, contextValue.dbUser, contextValue.activeLobby]);

  useEffect(() => {
    let loadingTimer: NodeJS.Timeout | null = null;
    const LOADING_TOAST_DELAY = 350;
    const isClient = typeof document !== 'undefined';
    const isLoadingState = isLoading || isAuthenticating;

    if (isLoadingState) {
       appToast.dismiss("auth-success-toast"); appToast.dismiss("auth-error-toast");
       loadingTimer = setTimeout(() => {
          if ((isLoading || isAuthenticating) && (!isClient || document.visibilityState === 'visible')) {
             appToast.loading("Авторизация...", { id: "auth-loading-toast", duration: 15000 });
          } else {
             appToast.dismiss("auth-loading-toast");
          }
       }, LOADING_TOAST_DELAY);
    } else {
        if (loadingTimer) clearTimeout(loadingTimer);
        appToast.dismiss("auth-loading-toast");

        if (telegramHookData.isAuthenticated && !error) {
            appToast.dismiss("auth-error-toast");
             if (!isClient || document.visibilityState === 'visible') {
                 appToast.success("Пользователь авторизован", { id: "auth-success-toast", duration: 2500 });
             }
        } else if (error) {
            appToast.dismiss("auth-success-toast");
            if (!isClient || document.visibilityState === 'visible') {
                 globalLogger.error("[APP_CONTEXT] Auth error:", error.message);
                 appToast.error(`Ошибка авторизации: ${error.message}`, { id: "auth-error-toast", duration: 10000 });
            }
        }
    }
    return () => { if (loadingTimer) { clearTimeout(loadingTimer); }};
  }, [telegramHookData.isAuthenticated, isLoading, isAuthenticating, error, telegramHookData.isInTelegramContext, appToast]);

  return <AppContext.Provider value={contextValue as AppContextData}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextData => {
  const context = useContext(AppContext);
  const defaultRefreshDbUser = useCallback(async () => { debugLogger.warn("refreshDbUser() called on SKELETON AppContext"); }, []);
  const defaultClearStartParam = useCallback(() => { debugLogger.warn("clearStartParam() called on SKELETON AppContext"); }, []);

  if (!context || context.isLoading === undefined) {
     return {
        tg: null, user: null, dbUser: null, isInTelegramContext: false, isAuthenticated: false,
        isLoading: true, isAuthenticating: true, error: null,
        isAdmin: () => false,
        openLink: () => {}, close: () => {}, showPopup: () => {}, sendData: () => {}, getInitData: () => null, expand: () => {}, setHeaderColor: () => {}, setBackgroundColor: () => {},
        platform: 'unknown', themeParams: {}, initData: undefined, initDataUnsafe: undefined, startParam: null, startParamPayload: null,
        refreshDbUser: defaultRefreshDbUser, clearStartParam: defaultClearStartParam, userCrewInfo: null, activeLobby: null
     } as unknown as AppContextData;
  }

  // Admin fallback
  if (context.isLoading === false && typeof context.isAdmin !== 'function') {
    const fallbackIsAdmin = () => { if (context.dbUser) { const statusIsAdmin = context.dbUser.status === 'admin'; const roleIsAdmin = context.dbUser.role === 'vprAdmin' || context.dbUser.role === 'admin'; return statusIsAdmin || roleIsAdmin; } return false; };
    return { ...(context as AppContextData), isAdmin: fallbackIsAdmin, refreshDbUser: context.refreshDbUser || defaultRefreshDbUser, clearStartParam: context.clearStartParam || defaultClearStartParam };
  }

  return { ...context, refreshDbUser: context.refreshDbUser || defaultRefreshDbUser, clearStartParam: context.clearStartParam || defaultClearStartParam } as AppContextData;
};