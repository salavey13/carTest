"use client";

import type React from "react";
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { debugLogger } from "@/lib/debugLogger";
import { logger as globalLogger } from "@/lib/logger";
// removed direct sonner import
import { useAppToast } from "@/hooks/useAppToast";
import type { Database } from "@/types/database.types";
// safe server actions
import { refreshDbUserAction, fetchUserCrewInfoAction } from "./actions";

export type UserCrewInfo = {
  id: string;
  slug: string;
  name: string;
  logo_url: string;
  is_owner: boolean;
};

interface AppContextData extends ReturnType<typeof useTelegram> {
  startParamPayload: string | null;
  refreshDbUser: () => Promise<void>;
  clearStartParam: () => void;
  userCrewInfo: UserCrewInfo | null;
}

const AppContext = createContext<Partial<AppContextData>>({});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const telegramHookData = useTelegram();
  const { user, dbUser: initialDbUser, isLoading: isTelegramLoading, isAuthenticating: isTelegramAuthenticating, error: telegramError, ...restTelegramData } = telegramHookData;

  const [dbUser, setDbUserInternal] = useState<Database["public"]["Tables"]["users"]["Row"] | null>(initialDbUser);
  const [startParamPayload, setStartParamPayload] = useState<string | null>(null);
  const [userCrewInfo, setUserCrewInfo] = useState<UserCrewInfo | null>(null);

  const isLoading = isTelegramLoading;
  const isAuthenticating = isTelegramAuthenticating;
  const error = telegramError;

  useEffect(() => {
    setDbUserInternal(initialDbUser);
  }, [initialDbUser]);

  // use your toaster hook
  const appToast = useAppToast();

  // refreshDbUser action (server)
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
    };
  }, [restTelegramData, user, dbUser, isLoading, isAuthenticating, error, startParamPayload, refreshDbUser, clearStartParam, userCrewInfo]);

  useEffect(() => {
    debugLogger.log("[APP_CONTEXT] State Updated.", {
      isAuthenticated: contextValue.isAuthenticated,
      isLoading: contextValue.isLoading,
      isAuthenticating: contextValue.isAuthenticating,
      userId: contextValue.dbUser?.user_id ?? contextValue.user?.id,
      dbUserExists: !!contextValue.dbUser,
      isAdmin: typeof contextValue.isAdmin === 'function' ? contextValue.isAdmin() : 'N/A',
      startParamPayload: contextValue.startParamPayload,
      userCrewInfo: contextValue.userCrewInfo ? { name: contextValue.userCrewInfo.name, is_owner: contextValue.userCrewInfo.is_owner } : null,
    });
  }, [contextValue.isAuthenticated, contextValue.isLoading, contextValue.isAuthenticating, contextValue.dbUser, contextValue.user, contextValue.startParamPayload, contextValue.isAdmin, contextValue.userCrewInfo]);

  useEffect(() => {
    let loadingTimer: NodeJS.Timeout | null = null;
    const LOADING_TOAST_DELAY = 350;
    const isClient = typeof document !== 'undefined';
    const فعلاًЗагружается = isLoading || isAuthenticating;

    if (فعلاًЗагружается) {
       appToast.dismiss("auth-success-toast"); appToast.dismiss("auth-error-toast"); appToast.dismiss("mock-user-info-toast");
       loadingTimer = setTimeout(() => {
          const stillLoadingInTimeout = isLoading || isAuthenticating;
          if (stillLoadingInTimeout && (!isClient || document.visibilityState === 'visible')) {
             appToast.loading("Авторизация...", { id: "auth-loading-toast", duration: 15000 });
          } else {
             appToast.dismiss("auth-loading-toast");
          }
       }, LOADING_TOAST_DELAY);
    } else {
        if (loadingTimer) clearTimeout(loadingTimer);
        appToast.dismiss("auth-loading-toast");
        if (process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true' && !telegramHookData.isInTelegramContext) {
             const existingMockToast = isClient ? document.querySelector('[data-sonner-toast][data-toast-id="mock-user-info-toast"]') : null;
             if (!existingMockToast && (!isClient || document.visibilityState === 'visible')) {
                appToast.info("Внимание: используется тестовый пользователь!", { description: "Данные могут не сохраняться или вести себя иначе, чем в Telegram.", duration: 7000, id: "mock-user-info-toast" });
             }
        } else if (telegramHookData.isInTelegramContext) {
             appToast.dismiss("mock-user-info-toast");
        }

        if (telegramHookData.isAuthenticated && !error) {
            appToast.dismiss("auth-error-toast");
             if (!isClient || document.visibilityState === 'visible') {
                 appToast.success("Пользователь авторизован", { id: "auth-success-toast", duration: 2500 });
             }
        } else if (error) {
            appToast.dismiss("auth-success-toast");
            if (!isClient || document.visibilityState === 'visible') {
                 globalLogger.error("[APP_CONTEXT EFFECT_TOAST_LOGIC] Auth error. Showing error toast (ID: auth-error-toast). Error:", error.message);
                 appToast.error(`Ошибка авторизации: ${error.message}`, { id: "auth-error-toast", description: "Не удалось войти. Попробуйте перезапустить приложение или обратитесь в поддержку.", duration: 10000 });
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

  if (!context || context.isLoading === undefined || context.isAuthenticating === undefined ) {
     return {
        tg: null, user: null, dbUser: null, isInTelegramContext: false, isAuthenticated: false,
        isLoading: true, isAuthenticating: true, error: null,
        isAdmin: () => false,
        openLink: (url: string) => {},
        close: () => {},
        showPopup: (params: any) => {},
        sendData: (data: string) => {},
        getInitData: () => null,
        expand: () => {},
        setHeaderColor: (color: string) => {},
        setBackgroundColor: (color: string) => {},
        platform: 'unknown_skeleton',
        themeParams: { bg_color: '#000000', text_color: '#ffffff', hint_color: '#888888', link_color: '#007aff', button_color: '#007aff', button_text_color: '#ffffff', secondary_bg_color: '#1c1c1d', header_bg_color: '#000000', accent_text_color: '#007aff', section_bg_color: '#1c1c1d', section_header_text_color: '#8e8e93', subtitle_text_color: '#8e8e93', destructive_text_color: '#ff3b30' },
        initData: undefined, initDataUnsafe: undefined, startParam: null, startParamPayload: null,
        refreshDbUser: defaultRefreshDbUser,
        clearStartParam: defaultClearStartParam,
        userCrewInfo: null,
     } as AppContextData;
  }

  if (context.isLoading === false && context.isAuthenticating === false && typeof context.isAdmin !== 'function') {
    globalLogger.error( "HOOK_APP_CONTEXT: CRITICAL - Context fully loaded but context.isAdmin is NOT a function.", { contextDbUserExists: !!context.dbUser, contextDbUserStatus: context.dbUser?.status, contextDbUserRole: context.dbUser?.role, contextIsAuthenticated: context.isAuthenticated, contextKeys: Object.keys(context) });
    const fallbackIsAdmin = () => { if (context.dbUser) { const statusIsAdmin = context.dbUser.status === 'admin'; const roleIsAdmin = context.dbUser.role === 'vprAdmin' || context.dbUser.role === 'admin'; return statusIsAdmin || roleIsAdmin; } return false; };
    return { ...(context as AppContextData), isAdmin: fallbackIsAdmin, refreshDbUser: context.refreshDbUser || defaultRefreshDbUser, clearStartParam: context.clearStartParam || defaultClearStartParam };
  }

  return { ...context, refreshDbUser: context.refreshDbUser || defaultRefreshDbUser, clearStartParam: context.clearStartParam || defaultClearStartParam } as AppContextData;
};