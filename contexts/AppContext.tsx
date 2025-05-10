"use client";

import type React from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { debugLogger as logger } from "@/lib/debugLogger";
import { toast } from "sonner";
import type { WebAppUser, WebApp, ThemeParams, WebAppInitData } from "@/types/telegram";
import type { Database } from "@/types/database.types";

type User = Database["public"]["Tables"]["users"]["Row"];

// Define the shape of the context data
interface AppContextData extends ReturnType<typeof useTelegram> {
  // Ensure all expected fields are here, even if from useTelegram
  // For example, if useTelegram returns isAdmin, isAuthenticated, etc.
  // For this fix, specifically ensure isAdmin is present.
  isAdmin: () => boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  dbUser: User | null;
  error: Error | null;
  // Add other known properties from useTelegram if necessary for the default
  webApp?: WebApp;
  user?: WebAppUser | null;
  platform?: string;
  themeParams?: ThemeParams;
  initData?: string;
  initDataUnsafe?: WebAppInitData;
  colorScheme?: 'light' | 'dark';
  isInTelegramContext: boolean;
}

// Create the context with an initial undefined value
const AppContext = createContext<Partial<AppContextData>>({});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Get data from the useTelegram hook
  const telegramData = useTelegram();

  // Context value now only contains telegram data
  const contextValue = useMemo(() => ({
    ...telegramData,
  }), [telegramData]);

  // Log context changes for debugging
  useEffect(() => {
    logger.log("AppContext updated:", {
      isAuthenticated: contextValue.isAuthenticated,
      isLoading: contextValue.isLoading,
      userId: contextValue.dbUser?.user_id ?? contextValue.user?.id,
      dbUserStatus: contextValue.dbUser?.status,
      error: contextValue.error?.message,
      isInTelegram: contextValue.isInTelegramContext,
    });
  }, [contextValue]);

  // Centralize the "User Authorized" toast notification
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

  // Provide the memoized value to the context consumers
  return <AppContext.Provider value={contextValue as AppContextData}>{children}</AppContext.Provider>;
};

// Custom hook for consuming the context
export const useAppContext = (): AppContextData => {
  const context = useContext(AppContext);
  
  if (!context || Object.keys(context).length === 0) {
     const errorMsg = "useAppContext: Context is empty or undefined, possibly during initial render or AppProvider not wrapping the component tree.";
     logger.warn(errorMsg);
     // Return a default, fully-formed AppContextData object for safe destructuring
     return {
        // Defaults from useTelegram (guessed)
        webApp: undefined,
        user: null,
        platform: 'unknown',
        themeParams: {
            bg_color: '#000000',
            text_color: '#ffffff',
            hint_color: '#888888',
            link_color: '#007aff',
            button_color: '#007aff',
            button_text_color: '#ffffff',
            secondary_bg_color: '#1c1c1d',
            header_bg_color: '#000000',
            accent_text_color: '#007aff',
            section_bg_color: '#1c1c1d',
            section_header_text_color: '#8e8e93',
            subtitle_text_color: '#8e8e93',
            destructive_text_color: '#ff3b30',
        },
        initData: undefined,
        initDataUnsafe: {
            query_id: undefined,
            user: undefined,
            receiver: undefined,
            chat: undefined,
            chat_type: undefined,
            chat_instance: undefined,
            start_param: undefined,
            can_send_after: undefined,
            auth_date: 0,
            hash: '',
        },
        colorScheme: 'dark',
        isInTelegramContext: false,
        
        // Defaults for AppContext specific state
        isAuthenticated: false,
        isLoading: true, // Critical: indicate that context is loading
        dbUser: null,
        error: null, // Or new Error("Context not initialized")
        isAdmin: () => false, // CRITICAL FIX: Provide a default callable function
     } as AppContextData; // Cast is okay here as we are providing a full default structure
  }
  // Cast to full type once checks pass
  return context as AppContextData;
};