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
    logger.debug("[AppContext Provider] Memoizing contextValue. isLoading from telegramData:", telegramData.isLoading, "isAdmin function exists:", typeof telegramData.isAdmin === 'function');
    return {
      ...telegramData,
    };
  }, [telegramData, telegramData.dbUser, telegramData.isLoading, telegramData.isAuthenticated, telegramData.isAdmin]); // Added telegramData.dbUser and other key fields to dependencies

  useEffect(() => {
    logger.log("AppContext updated (state from contextValue):", {
      isAuthenticated: contextValue.isAuthenticated,
      isLoading: contextValue.isLoading,
      userId: contextValue.dbUser?.user_id ?? contextValue.user?.id,
      dbUserStatus: contextValue.dbUser?.status,
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
  
  // Check if context is truly uninitialized (still loading) or if isAdmin is missing post-load
  if (!context || Object.keys(context).length === 0 || context.isLoading === undefined) {
     logger.warn("useAppContext: Context is empty or `isLoading` is undefined. Returning loading defaults.");
     return {
        webApp: undefined, user: null, platform: 'unknown',
        themeParams: { bg_color: '#000000', text_color: '#ffffff', hint_color: '#888888', link_color: '#007aff', button_color: '#007aff', button_text_color: '#ffffff', secondary_bg_color: '#1c1c1d', header_bg_color: '#000000', accent_text_color: '#007aff', section_bg_color: '#1c1c1d', section_header_text_color: '#8e8e93', subtitle_text_color: '#8e8e93', destructive_text_color: '#ff3b30' },
        initData: undefined, initDataUnsafe: { query_id: undefined, user: undefined, receiver: undefined, chat: undefined, chat_type: undefined, chat_instance: undefined, start_param: undefined, can_send_after: undefined, auth_date: 0, hash: '' },
        colorScheme: 'dark', isInTelegramContext: false, isAuthenticated: false,
        isLoading: true, 
        dbUser: null, error: null, 
        isAdmin: undefined // Explicitly undefined during initial loading phase
     } as AppContextData; 
  }

  // If context is loaded but isAdmin is STILL not a function, this is an issue with useTelegram hook.
  if (context.isLoading === false && typeof context.isAdmin !== 'function') {
    logger.error("useAppContext: CRITICAL - Context is loaded (isLoading: false) but isAdmin is NOT a function. AppContext/useTelegram issue.", context);
    // Return a safe default that indicates non-admin status to prevent crashes
    return {
        ...context, // Spread what we have
        isAdmin: () => false, // Provide a default non-admin function
    } as AppContextData;
  }

  return context as AppContextData;
};