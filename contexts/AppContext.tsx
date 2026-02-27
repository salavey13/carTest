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

  // STICKY STATE: Initialize with initialDbUser, but never let it go back to null automatically
  const [dbUser, setDbUserInternal] = useState<Database["public"]["Tables"]["users"]["Row"] | null>(initialDbUser);
  const [startParamPayload, setStartParamPayload] = useState<string | null>(null);
  const [userCrewInfo, setUserCrewInfo] = useState<UserCrewInfo | null>(null);
  const [activeLobby, setActiveLobby] = useState<ActiveLobbyInfo | null>(null);

  // We use a ref to track if we ever had a user, to prevent overwriting with null during loading/transitions
  const hasUserRef = useRef(!!initialDbUser);

  // STABILIZED EFFECT:
  // If we receive a valid user, update state and mark as found.
  // If we receive null, ONLY update state if we haven't found a user yet (true logout requires manual handling).
  useEffect(() => {
    if (initialDbUser) {
      setDbUserInternal(initialDbUser);
      hasUserRef.current = true;
    } else if (!hasUserRef.current) {
      // Only set to null if we never had a user (initial load state)
      setDbUserInternal(null);
    }
    // Note: If initialDbUser becomes null (e.g. during hook re-init), we explicitly ignore it 
    // to keep the "stale" but valid user data visible during transitions.
  }, [initialDbUser]);

  const appToast = useAppToast();

  const refreshDbUser = useCallback(async () => {
    // Use either the hook user or the sticky dbUser ID
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
    } else {
      debugLogger.warn("[AppContext refreshDbUser] Cannot refresh, user ID is not available.");
    }
  }, [user?.id, dbUser?.user_id]);

  useEffect(() => {
    const fetchCrewInfo = async () => {
      if (!dbUser?.user_id) {
        // Only clear crew info if we are genuinely logged out (dbUser is null)
        // Since dbUser is sticky, this won't flash during nav
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
      // Polling is currently disabled to save resources as requested
      // const interval = setInterval(checkActiveGame, 60000); 
      // return () => clearInterval(interval);
  }, [dbUser?.user_id]);

  const clearStartParam = useCallback(() => {
    setStartParamPayload(null);
  }, []);

  useEffect(() => {
    if (telegramHookData.tg && telegramHookData.tg.initDataUnsafe?.start_param) {
      setStartParamPayload(telegramHookData.tg.initDataUnsafe.start_param);
    }
  }, [telegramHookData.tg]);

  const contextValue = useMemo(() => {
    return {
      ...restTelegramData,
      user,
      dbUser, // Returns the sticky internal state
      isLoading: isTelegramLoading, // Pass through loading state, but dbUser remains available
      isAuthenticating: isTelegramAuthenticating,
      error: telegramError,
      startParamPayload,
      refreshDbUser,
      clearStartParam,
      userCrewInfo,
      activeLobby,
    };
  }, [restTelegramData, user, dbUser, isTelegramLoading, isTelegramAuthenticating, telegramError, startParamPayload, refreshDbUser, clearStartParam, userCrewInfo, activeLobby]);

  // Toast Logic (Simplified to reduce noise)
  useEffect(() => {
    let loadingTimer: NodeJS.Timeout | null = null;
    const LOADING_TOAST_DELAY = 500;
    const isClient = typeof document !== 'undefined';
    
    // Only show loading toast if we don't have a user yet
    const shouldShowLoading = (isTelegramLoading || isTelegramAuthenticating) && !dbUser;

    if (shouldShowLoading) {
       appToast.dismiss("auth-success-toast"); 
       appToast.dismiss("auth-error-toast");
       loadingTimer = setTimeout(() => {
          if (shouldShowLoading && (!isClient || document.visibilityState === 'visible')) {
             appToast.loading("Авторизация...", { id: "auth-loading-toast", duration: 15000 });
          }
       }, LOADING_TOAST_DELAY);
    } else {
        if (loadingTimer) clearTimeout(loadingTimer);
        appToast.dismiss("auth-loading-toast");

        if (telegramHookData.isAuthenticated && !telegramError && !dbUser) {
             // Only show success if we just got the user
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

  // Admin fallback logic
  if (context.isLoading === false && typeof context.isAdmin !== 'function') {
    const fallbackIsAdmin = () => { 
        if (context.dbUser) { 
            const statusIsAdmin = context.dbUser.status === 'admin'; 
            const roleIsAdmin = context.dbUser.role === 'vprAdmin' || context.dbUser.role === 'admin'; 
            return statusIsAdmin || roleIsAdmin; 
        } 
        return false; 
    };
    return { ...context, isAdmin: fallbackIsAdmin } as AppContextData;
  }

  return context as AppContextData;
};