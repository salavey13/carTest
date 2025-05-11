"use client";

import type React from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { debugLogger as logger } from "@/lib/debugLogger";
import { toast } from "sonner";
import type { WebAppUser, WebApp, ThemeParams, WebAppInitData } from "@/types/telegram";
import type { Database } from "@/types/database.types";

type User = Database["public"]["Tables"]["users"]["Row"];

interface AppContextData extends ReturnType<typeof useTelegram> {
  isAdmin?: () => boolean; 
  isAuthenticated: boolean;
  isLoading: boolean;
  dbUser: User | null;
  error: Error | null;
  webApp?: WebApp;
  user?: WebAppUser | null;
  platform?: string;
  themeParams?: ThemeParams;
  initData?: string;
  initDataUnsafe?: WebAppInitData;
  colorScheme?: 'light' | 'dark';
  isInTelegramContext: boolean;
}

const AppContext = createContext<Partial<AppContextData>>({});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const telegramData = useTelegram();

  const contextValue = useMemo(() => {
    logger.debug(
        "[AppContext Provider] Memoizing contextValue. telegramData props:", 
        { 
            isLoading: telegramData.isLoading, 
            isAdminFuncExists: typeof telegramData.isAdmin === 'function', 
            dbUserStatus: telegramData.dbUser?.status,
            dbUserRole: telegramData.dbUser?.role,
            isAuthenticated: telegramData.isAuthenticated
        }
    );
    return {
      ...telegramData,
    };
    // Ensure useMemo re-runs if the isAdmin function reference itself changes in telegramData, or if dbUser (which isAdmin depends on) changes.
  }, [telegramData]); // Relying on telegramData object reference changing

  useEffect(() => {
    logger.log("AppContext updated (state from contextValue):", {
      isAuthenticated: contextValue.isAuthenticated,
      isLoading: contextValue.isLoading,
      userId: contextValue.dbUser?.user_id ?? contextValue.user?.id,
      dbUserStatus: contextValue.dbUser?.status,
      dbUserRole: contextValue.dbUser?.role,
      isAdminFunctionExists: typeof contextValue.isAdmin === 'function',
      error: contextValue.error?.message,
      isInTelegram: contextValue.isInTelegramContext,
    });
  }, [contextValue]);

  useEffect(() => {
    let currentToastId: string | number | undefined;
    let loadingTimer: NodeJS.Timeout | null = null;
    const LOADING_TOAST_DELAY = 300;

    if (contextValue.isLoading) {
       loadingTimer = setTimeout(() => {
          if (contextValue.isLoading && document.visibilityState === 'visible') {
             logger.debug("[AppContext] Showing auth loading toast...");
             currentToastId = toast.loading("Авторизация...", { id: "auth-loading-toast" });
          }
       }, LOADING_TOAST_DELAY);
    } else {
        if (loadingTimer) clearTimeout(loadingTimer);
        toast.dismiss("auth-loading-toast");

        if (contextValue.isAuthenticated && !contextValue.error) {
             if (document.visibilityState === 'visible') {
                 logger.debug("[AppContext] Showing auth success toast...");
                 currentToastId = toast.success("Пользователь авторизован", { id: "auth-success-toast", duration: 2000 });
             }
        }
        else if (contextValue.error) {
            if (document.visibilityState === 'visible') {
                 logger.error("[AppContext] Showing auth error toast:", contextValue.error);
                 currentToastId = toast.error("Ошибка авторизации", { id: "auth-error-toast", description: "Не удалось войти. Попробуйте позже." });
            }
        }
    }

    return () => {
        if (loadingTimer) {
            clearTimeout(loadingTimer);
        }
    };
  }, [contextValue.isAuthenticated, contextValue.isLoading, contextValue.error]);

  return <AppContext.Provider value={contextValue as AppContextData}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextData => {
  const context = useContext(AppContext);
  
  if (!context || Object.keys(context).length === 0 || context.isLoading === undefined ) {
     logger.warn("useAppContext: Context is empty or `isLoading` is undefined. Returning loading defaults.");
     return {
        webApp: undefined, user: null, platform: 'unknown',
        themeParams: { bg_color: '#000000', text_color: '#ffffff', hint_color: '#888888', link_color: '#007aff', button_color: '#007aff', button_text_color: '#ffffff', secondary_bg_color: '#1c1c1d', header_bg_color: '#000000', accent_text_color: '#007aff', section_bg_color: '#1c1c1d', section_header_text_color: '#8e8e93', subtitle_text_color: '#8e8e93', destructive_text_color: '#ff3b30' },
        initData: undefined, initDataUnsafe: { query_id: undefined, user: undefined, receiver: undefined, chat: undefined, chat_type: undefined, chat_instance: undefined, start_param: undefined, can_send_after: undefined, auth_date: 0, hash: '' },
        colorScheme: 'dark', isInTelegramContext: false, isAuthenticated: false,
        isLoading: true, 
        dbUser: null, error: null, 
        isAdmin: undefined // isAdmin is explicitly undefined during initial loading
     } as AppContextData; 
  }

  // If context is NOT loading, BUT isAdmin is STILL not a function, this is a CRITICAL issue.
  // It means useTelegram (or AppProvider's memoization) is not correctly providing the isAdmin function after dbUser is loaded.
  if (context.isLoading === false && typeof context.isAdmin !== 'function') {
    logger.error(
        "useAppContext: CRITICAL - Context is loaded (isLoading: false) but context.isAdmin is NOT a function. This suggests an issue in useTelegram or AppProvider.", 
        { 
            contextDbUserStatus: context.dbUser?.status, 
            contextDbUserRole: context.dbUser?.role,
            contextIsAuthenticated: context.isAuthenticated,
            contextKeys: Object.keys(context)
        }
    );
    // Fallback: provide a default isAdmin that checks the dbUser if available, otherwise false.
    // This prevents crashes but masks the underlying problem that isAdmin wasn't correctly passed from useTelegram.
    return {
        ...(context as AppContextData), // Spread what we have
        isAdmin: () => {
            if (context.dbUser) {
                const statusIsAdmin = context.dbUser.status === 'admin';
                const roleIsAdmin = context.dbUser.role === 'admin'; // Or other admin roles
                logger.warn(`[useAppContext Fallback isAdmin] Using direct dbUser check. Status: ${context.dbUser.status}, Role: ${context.dbUser.role}. Determined isAdmin: ${statusIsAdmin || roleIsAdmin}`);
                return statusIsAdmin || roleIsAdmin;
            }
            logger.warn("[useAppContext Fallback isAdmin] dbUser not available in context for fallback. Defaulting to false.");
            return false;
        },
    } as AppContextData;
  }

  return context as AppContextData;
};