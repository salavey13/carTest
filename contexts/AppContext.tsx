"use client";

import type React from "react";
import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { debugLogger } from "@/lib/debugLogger";
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
  const processedStartParam = useRef(false);

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
      try {
        const freshDbUser = await refreshDbUserAction(String(userId));
        if (freshDbUser) {
           setDbUserInternal(freshDbUser);
           hasUserRef.current = true;
        }
      } catch (err) {
        debugLogger.error(`[AppContext] Refresh failed:`, err);
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
    setStartParamPayload(null);
  }, []);

  useEffect(() => {
    if (processedStartParam.current) return;

    const rawParam = telegramHookData.startParam || telegramHookData.initDataUnsafe?.start_param;
    
    if (rawParam) {
      debugLogger.info(`[AppContext] Syncing Start Param: ${rawParam}`);
      setStartParamPayload(rawParam);
      processedStartParam.current = true;
    } else if (telegramHookData.tg) {
        processedStartParam.current = true;
    }
  }, [telegramHookData.startParam, telegramHookData.initDataUnsafe, telegramHookData.tg]);

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

  // FIX: Replaced `isAuthenticating` (undefined) with `isTelegramAuthenticating`
  useEffect(() => {
    let loadingTimer: NodeJS.Timeout | null = null;
    const shouldShowLoading = (isTelegramLoading || isTelegramAuthenticating) && !dbUser;

    if (shouldShowLoading) {
       appToast.dismiss("auth-success-toast"); appToast.dismiss("auth-error-toast");
       loadingTimer = setTimeout(() => {
          // Check variable name here as well
          if ((isTelegramLoading || isTelegramAuthenticating) && !dbUser) {
             appToast.loading("Авторизация...", { id: "auth-loading-toast", duration: 15000 });
          }
       }, 500);
    } else {
        if (loadingTimer) clearTimeout(loadingTimer);
        appToast.dismiss("auth-loading-toast");
        if (telegramError) {
             appToast.error(`Ошибка: ${telegramError.message}`, { id: "auth-error-toast", duration: 5000 });
        }
    }
    return () => { if (loadingTimer) clearTimeout(loadingTimer); };
  }, [isTelegramLoading, isTelegramAuthenticating, telegramError, dbUser, appToast]);

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