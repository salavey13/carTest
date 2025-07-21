"use client";

import type React from "react";
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { debugLogger } from "@/lib/debugLogger";
import { logger as globalLogger } from "@/lib/logger";
import { toast } from "sonner";
import { fetchUserData as dbFetchUserData } from "@/hooks/supabase"; 
import type { Database } from "@/types/database.types"; 

interface AppContextData extends ReturnType<typeof useTelegram> {
  startParamPayload: string | null;
  refreshDbUser: () => Promise<void>; 
  clearStartParam: () => void;
}

const AppContext = createContext<Partial<AppContextData>>({});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const telegramHookData = useTelegram(); 
  const { user, isLoading: isTelegramLoading, isAuthenticating: isTelegramAuthenticating, error: telegramError, ...restTelegramData } = telegramHookData;

  const [dbUser, setDbUserInternal] = useState<Database["public"]["Tables"]["users"]["Row"] | null>(telegramHookData.dbUser); 
  const [startParamPayload, setStartParamPayload] = useState<string | null>(null);
  
  const isLoading = isTelegramLoading;
  const isAuthenticating = isTelegramAuthenticating;
  const error = telegramError;

  useEffect(() => {
    setDbUserInternal(telegramHookData.dbUser);
  }, [telegramHookData.dbUser]);

  const refreshDbUser = useCallback(async () => {
    if (user?.id) {
      debugLogger.info(`[AppContext refreshDbUser] Refreshing dbUser for user ID: ${user.id}`);
      try {
        const freshDbUser = await dbFetchUserData(String(user.id));
        setDbUserInternal(freshDbUser); 
        debugLogger.info(`[AppContext refreshDbUser] dbUser refreshed successfully.`);
      } catch (e) {
        globalLogger.error("[AppContext refreshDbUser] Error refreshing dbUser:", e);
      }
    } else {
      debugLogger.warn("[AppContext refreshDbUser] Cannot refresh, user.id is not available.");
    }
  }, [user?.id]);
  
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
    };
  }, [restTelegramData, user, dbUser, isLoading, isAuthenticating, error, startParamPayload, refreshDbUser, clearStartParam]);

  useEffect(() => {
    debugLogger.log("[APP_CONTEXT] State Updated.", {
      isAuthenticated: contextValue.isAuthenticated,
      isLoading: contextValue.isLoading,
      isAuthenticating: contextValue.isAuthenticating,
      userId: contextValue.dbUser?.user_id ?? contextValue.user?.id,
      dbUserExists: !!contextValue.dbUser,
      isAdmin: typeof contextValue.isAdmin === 'function' ? contextValue.isAdmin() : 'N/A',
      startParamPayload: contextValue.startParamPayload,
    });
  }, [contextValue.isAuthenticated, contextValue.isLoading, contextValue.isAuthenticating, contextValue.dbUser, contextValue.user, contextValue.startParamPayload, contextValue.isAdmin]);


  useEffect(() => {
    let loadingTimer: NodeJS.Timeout | null = null;
    const LOADING_TOAST_DELAY = 350;
    const isClient = typeof document !== 'undefined';
    const فعلاًЗагружается = isLoading || isAuthenticating;

    if (فعلاًЗагружается) {
       toast.dismiss("auth-success-toast"); toast.dismiss("auth-error-toast"); toast.dismiss("mock-user-info-toast");
       loadingTimer = setTimeout(() => {
          const stillLoadingInTimeout = isLoading || isAuthenticating;
          if (stillLoadingInTimeout && (!isClient || document.visibilityState === 'visible')) {
             toast.loading("Авторизация...", { id: "auth-loading-toast", duration: 15000 });
          } else {
             toast.dismiss("auth-loading-toast");
          }
       }, LOADING_TOAST_DELAY);
    } else {
        if (loadingTimer) clearTimeout(loadingTimer);
        toast.dismiss("auth-loading-toast");
        if (process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true' && !telegramHookData.isInTelegramContext) {
             const existingMockToast = isClient ? document.querySelector('[data-sonner-toast][data-toast-id="mock-user-info-toast"]') : null;
             if (!existingMockToast && (!isClient || document.visibilityState === 'visible')) {
                toast.info("Внимание: используется тестовый пользователь!", { description: "Данные могут не сохраняться или вести себя иначе, чем в Telegram.", duration: 7000, id: "mock-user-info-toast" });
             }
        } else if (telegramHookData.isInTelegramContext) {
             toast.dismiss("mock-user-info-toast");
        }

        if (telegramHookData.isAuthenticated && !error) { // Используем isAuthenticated из хука
            toast.dismiss("auth-error-toast");
             if (!isClient || document.visibilityState === 'visible') {
                 toast.success("Пользователь авторизован", { id: "auth-success-toast", duration: 2500 });
             }
        } else if (error) {
            toast.dismiss("auth-success-toast");
            if (!isClient || document.visibilityState === 'visible') {
                 globalLogger.error("[APP_CONTEXT EFFECT_TOAST_LOGIC] Auth error. Showing error toast (ID: auth-error-toast). Error:", error.message);
                 toast.error(`Ошибка авторизации: ${error.message}`, { id: "auth-error-toast", description: "Не удалось войти. Попробуйте перезапустить приложение или обратитесь в поддержку.", duration: 10000 });
            }
        }
    }
    return () => { if (loadingTimer) { clearTimeout(loadingTimer); }};
  }, [telegramHookData.isAuthenticated, isLoading, isAuthenticating, error, telegramHookData.isInTelegramContext]);

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
        isAdmin: () => { return false; },
        openLink: (url: string) => {},
        close: () => {},
        showPopup: (params: any) => {},
        sendData: (data: string) => {},
        getInitData: () => { return null; },
        expand: () => {},
        setHeaderColor: (color: string) => {},
        setBackgroundColor: (color: string) => {},
        platform: 'unknown_skeleton',
        themeParams: { bg_color: '#000000', text_color: '#ffffff', hint_color: '#888888', link_color: '#007aff', button_color: '#007aff', button_text_color: '#ffffff', secondary_bg_color: '#1c1c1d', header_bg_color: '#000000', accent_text_color: '#007aff', section_bg_color: '#1c1c1d', section_header_text_color: '#8e8e93', subtitle_text_color: '#8e8e93', destructive_text_color: '#ff3b30' },
        initData: undefined, initDataUnsafe: undefined, startParam: null, startParamPayload: null,
        refreshDbUser: defaultRefreshDbUser,
        clearStartParam: defaultClearStartParam,
     } as AppContextData;
  }

  if (context.isLoading === false && context.isAuthenticating === false && typeof context.isAdmin !== 'function') {
    globalLogger.error( "HOOK_APP_CONTEXT: CRITICAL - Context fully loaded but context.isAdmin is NOT a function.", { contextDbUserExists: !!context.dbUser, contextDbUserStatus: context.dbUser?.status, contextDbUserRole: context.dbUser?.role, contextIsAuthenticated: context.isAuthenticated, contextKeys: Object.keys(context) });
    const fallbackIsAdmin = () => { if (context.dbUser) { const statusIsAdmin = context.dbUser.status === 'admin'; const roleIsAdmin = context.dbUser.role === 'vprAdmin' || context.dbUser.role === 'admin'; return statusIsAdmin || roleIsAdmin; } return false; };
    return { ...(context as AppContextData), isAdmin: fallbackIsAdmin, refreshDbUser: context.refreshDbUser || defaultRefreshDbUser, clearStartParam: context.clearStartParam || defaultClearStartParam };
  }

  return { ...context, refreshDbUser: context.refreshDbUser || defaultRefreshDbUser, clearStartParam: context.clearStartParam || defaultClearStartParam } as AppContextData;
};