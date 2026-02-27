"use client";

import type React from "react";
import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { debugLogger } from "@/lib/debugLogger";
import { logger as globalLogger } from "@/lib/logger";
import { useAppToast } from "@/hooks/useAppToast";
import type { Database } from "@/types/database.types";
import { refreshDbUserAction, fetchUserCrewInfoAction, fetchActiveGameAction } from "./actions";

export type UserCrewInfo = {
  id: string;
  slug: string;
  name: string;
  logo_url: string;
  is_owner: boolean;
};

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

  const hasUserRef = useRef(!!initialDbUser);
  
  // FIX: Ref to track if we've already synced the start param from Telegram this session.
  // This prevents the param from resurfacing after being cleared.
  const startParamSyncedRef = useRef(false);

  useEffect(() => {
    if (initialDbUser) {
      setDbUserInternal(initialDbUser);
      hasUserRef.current = true;
    } else if (!hasUserRef.current) {
      setDbUserInternal(null);
    }
  }, [initialDbUser]);

  const appToast = useAppToast();

  const refreshDbUser = useCallback(async () => {
    const userId = user?.id || dbUser?.user_id;
    if (userId) {
      debugLogger.info(`[AppContext refreshDbUser] Refreshing dbUser for user ID: ${userId}`);
      try {
        const freshDbUser = await refreshDbUserAction(String(userId));
        if (freshDbUser) {
           setDbUserInternal(freshDbUser);
           hasUserRef.current = true;
           debugLogger.info(`[AppContext refreshDbUser] dbUser refreshed successfully.`);
        }
      } catch (err) {
        debugLogger.error(`[AppContext refreshDbUser] Failed to refresh:`, err);
      }
    }
  }, [user?.id, dbUser?.user_id]);

  useEffect(() => {
    const fetchCrewInfo = async () => {
      if (!dbUser?.user_id) {
        if (!hasUserRef.current) setUserCrewInfo(null);
        return;
      }
      const crewInfo = await fetchUserCrewInfoAction(dbUser.user_id);
      setUserCrewInfo(crewInfo);
    };

    fetchCrewInfo();
  }, [dbUser]);

  useEffect(() => {
      if (!dbUser?.user_id) return;
      const checkActiveGame = async () => {
          const lobbyInfo = await fetchActiveGameAction(dbUser.user_id);
          setActiveLobby(lobbyInfo);
      };
      checkActiveGame();
  }, [dbUser?.user_id]);

  const clearStartParam = useCallback(() => {
    debugLogger.info("[AppContext] Clearing startParamPayload.");
    setStartParamPayload(null);
  }, []);

  // FIX: Only sync start_param if we haven't done so yet.
  // Telegram's initDataUnsafe.start_param persists forever, so we must ignore it after the first read/clear.
  useEffect(() => {
    if (startParamSyncedRef.current) return;

    if (telegramHookData.tg && telegramHookData.tg.initDataUnsafe?.start_param) {
      const rawStartParam = telegramHookData.tg.initDataUnsafe.start_param;
      debugLogger.info(`[AppContext] Received start_param (raw): ${rawStartParam}. Syncing once.`);
      setStartParamPayload(rawStartParam);
      startParamSyncedRef.current = true;
    }
  }, [telegramHookData.tg]);

  const contextValue = useMemo(() => {
    return {
      ...restTelegramData,
      user,
      dbUser, 
      isLoading: isTelegramLoading,
      isAuthenticating: isTelegramAuthenticating,
      error: telegramError,
      startParamPayload,
      refreshDbUser,
      clearStartParam,
      userCrewInfo,
      activeLobby,
    };
  }, [restTelegramData, user, dbUser, isTelegramLoading, isTelegramAuthenticating, telegramError, startParamPayload, refreshDbUser, clearStartParam, userCrewInfo, activeLobby]);

  // Toast Logic
  useEffect(() => {
    let loadingTimer: NodeJS.Timeout | null = null;
    const LOADING_TOAST_DELAY = 500;
    const isClient = typeof document !== 'undefined';
    
    const shouldShowLoading = (isTelegramLoading || isTelegramAuthenticating) && !dbUser;

    if (shouldShowLoading) {
       appToast.dismiss("auth-success-toast"); appToast.dismiss("auth-error-toast");
       loadingTimer = setTimeout(() => {
          if (shouldShowLoading && (!isClient || document.visibilityState === 'visible')) {
             appToast.loading("Авторизация...", { id: "auth-loading-toast", duration: 15000 });
          }
       }, LOADING_TOAST_DELAY);
    } else {
        if (loadingTimer) clearTimeout(loadingTimer);
        appToast.dismiss("auth-loading-toast");

        if (telegramHookData.isAuthenticated && !telegramError && !dbUser) {
             // Success
        } else if (telegramError) {
             if (!isClient || document.visibilityState === 'visible') {
                 appToast.error(`Ошибка: ${telegramError.message}`, { id: "auth-error-toast", duration: 5000 });
            }
        }
    }
    return () => { if (loadingTimer) clearTimeout(loadingTimer); };
  }, [isTelegramLoading, isTelegramAuthenticating, telegramError, telegramHookData.isAuthenticated, dbUser, appToast]);

  return <AppContext.Provider value={contextValue as AppContextData}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextData => {
  const context = useContext(AppContext);
  const defaultRefreshDbUser = useCallback(async () => {}, []);
  const defaultClearStartParam = useCallback(() => {}, []);

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

  if (context.isLoading === false && typeof context.isAdmin !== 'function') {
    const fallbackIsAdmin = () => { if (context.dbUser) { const statusIsAdmin = context.dbUser.status === 'admin'; const roleIsAdmin = context.dbUser.role === 'vprAdmin' || context.dbUser.role === 'admin'; return statusIsAdmin || roleIsAdmin; } return false; };
    return { ...context, isAdmin: fallbackIsAdmin } as AppContextData;
  }

  return context as AppContextData;
};