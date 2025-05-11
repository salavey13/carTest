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
  isAuthenticating: boolean; // Explicitly add if not already in ReturnType
}

const AppContext = createContext<Partial<AppContextData>>({});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const telegramData = useTelegram();

  const contextValue = useMemo(() => {
    logger.debug(
        "[AppContext Provider] Memoizing contextValue. telegramData props:", 
        { 
            isLoading: telegramData.isLoading, 
            isAuthenticating: telegramData.isAuthenticating, // Log this new state
            isAdminIsFunction: typeof telegramData.isAdmin === 'function', 
            dbUserStatus: telegramData.dbUser?.status,
            dbUserRole: telegramData.dbUser?.role,
            isAuthenticated: telegramData.isAuthenticated,
            isMockUser: process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true' 
        }
    );
    return {
      ...telegramData,
    };
  }, [
    telegramData.tg, 
    telegramData.user, 
    telegramData.dbUser, 
    telegramData.isInTelegramContext, 
    telegramData.isAuthenticated, 
    telegramData.isAuthenticating, // Add to dependencies
    telegramData.isAdmin, 
    telegramData.isLoading, 
    telegramData.error,
    telegramData.openLink, 
    telegramData.close,
    telegramData.showPopup,
    telegramData.sendData,
    telegramData.getInitData,
    telegramData.expand,
    telegramData.setHeaderColor,
    telegramData.setBackgroundColor,
  ]);

  useEffect(() => {
    logger.log("AppContext updated (state from contextValue):", {
      isAuthenticated: contextValue.isAuthenticated,
      isLoading: contextValue.isLoading,
      isAuthenticating: contextValue.isAuthenticating,
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
    let mockUserToastId: string | number | undefined;

    if (contextValue.isLoading || contextValue.isAuthenticating) { // Consider isAuthenticating as part of loading phase for toasts
       loadingTimer = setTimeout(() => {
          if ((contextValue.isLoading || contextValue.isAuthenticating) && document.visibilityState === 'visible') {
             logger.debug("[AppContext] Showing auth loading toast...");
             currentToastId = toast.loading("Авторизация...", { id: "auth-loading-toast" });
          }
       }, LOADING_TOAST_DELAY);
    } else {
        if (loadingTimer) clearTimeout(loadingTimer);
        toast.dismiss("auth-loading-toast");

        if (process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true' && document.visibilityState === 'visible') {
             // Check if toast already exists by ID to prevent duplicates if this effect re-runs
             const existingMockToast = document.querySelector('[data-sonner-toast][data-toast-id="mock-user-info-toast"]');
             if (!existingMockToast) {
                logger.info("[AppContext] Using MOCK_USER. Displaying info toast.");
                mockUserToastId = toast.info("Внимание: используется тестовый пользователь!", {
                    description: "Данные могут не сохраняться или вести себя иначе, чем в Telegram.",
                    duration: 5000,
                    id: "mock-user-info-toast" // Ensure this ID is unique
                });
             }
        }

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
  }, [contextValue.isAuthenticated, contextValue.isLoading, contextValue.isAuthenticating, contextValue.error]);


  return <AppContext.Provider value={contextValue as AppContextData}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextData => {
  const context = useContext(AppContext);
  
  if (!context || Object.keys(context).length === 0 || context.isLoading === undefined || context.isAuthenticating === undefined ) {
     logger.warn("useAppContext: Context is empty or `isLoading`/`isAuthenticating` is undefined. Returning loading defaults.");
     return {
        tg: null, user: null, dbUser: null, isInTelegramContext: false, isAuthenticated: false, 
        isLoading: true, isAuthenticating: true, error: null, 
        isAdmin: () => false, 
        openLink: (url: string) => logger.warn(`openLink(${url}) called on loading context`),
        close: () => logger.warn('close() called on loading context'),
        showPopup: (params: any) => logger.warn('showPopup() called on loading context', params),
        sendData: (data: string) => logger.warn(`sendData(${data}) called on loading context`),
        getInitData: () => { logger.warn('getInitData() called on loading context'); return null; },
        expand: () => logger.warn('expand() called on loading context'),
        setHeaderColor: (color: string) => logger.warn(`setHeaderColor(${color}) called on loading context`),
        setBackgroundColor: (color: string) => logger.warn(`setBackgroundColor(${color}) called on loading context`),
        platform: undefined, 
        themeParams: undefined,
        initData: undefined, 
        initDataUnsafe: undefined,
        colorScheme: undefined,
     } as AppContextData; 
  }

  if (context.isLoading === false && context.isAuthenticating === false && typeof context.isAdmin !== 'function') {
    logger.error(
        "useAppContext: CRITICAL - Context fully loaded (isLoading: false, isAuthenticating: false) but context.isAdmin is NOT a function.", 
        { 
            contextDbUserExists: !!context.dbUser,
            contextDbUserStatus: context.dbUser?.status, 
            contextDbUserRole: context.dbUser?.role,
            contextIsAuthenticated: context.isAuthenticated,
            contextKeys: Object.keys(context)
        }
    );
    const fallbackIsAdmin = () => {
        if (context.dbUser) {
            const statusIsAdmin = context.dbUser.status === 'admin';
            const roleIsAdmin = context.dbUser.role === 'vprAdmin' || context.dbUser.role === 'admin'; 
            logger.warn(`[useAppContext Fallback isAdmin] Using direct dbUser check. Status: ${context.dbUser.status}, Role: ${context.dbUser.role}. Determined isAdmin: ${statusIsAdmin || roleIsAdmin}`);
            return statusIsAdmin || roleIsAdmin;
        }
        logger.warn("[useAppContext Fallback isAdmin] dbUser not available in context for fallback. Defaulting to false.");
        return false;
    };
    return {
        ...(context as AppContextData), 
        isAdmin: fallbackIsAdmin, 
    } as AppContextData;
  }

  return context as AppContextData;
};