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
  // isAdmin is already part of ReturnType<typeof useTelegram> if useTelegram returns it as a function
  // No need to redefine isAdmin?: () => boolean; if it's consistently a function from useTelegram
}

const AppContext = createContext<Partial<AppContextData>>({});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const telegramData = useTelegram();

  const contextValue = useMemo(() => {
    logger.debug(
        "[AppContext Provider] Memoizing contextValue. telegramData props:", 
        { 
            isLoading: telegramData.isLoading, 
            // Check actual type of isAdmin from telegramData
            isAdminIsFunction: typeof telegramData.isAdmin === 'function', 
            dbUserStatus: telegramData.dbUser?.status,
            dbUserRole: telegramData.dbUser?.role,
            isAuthenticated: telegramData.isAuthenticated,
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
    telegramData.isAdmin, // Crucial: include the function reference itself
    telegramData.isLoading, 
    telegramData.error,
    telegramData.openLink, // Assuming these methods from useTelegram are stable (wrapped in useCallback)
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
        // Do not dismiss toasts here generally, let them self-dismiss or be dismissed by other logic
        // toast.dismiss(currentToastId); // Avoid this unless specifically needed for this effect's lifecycle
    };
  }, [contextValue.isAuthenticated, contextValue.isLoading, contextValue.error]);

  return <AppContext.Provider value={contextValue as AppContextData}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextData => {
  const context = useContext(AppContext);
  
  // Default loading state if context is not yet fully initialized
  if (!context || Object.keys(context).length === 0 || context.isLoading === undefined ) {
     logger.warn("useAppContext: Context is empty or `isLoading` is undefined. Returning loading defaults.");
     return {
        // Default values from useTelegram structure
        tg: null, user: null, dbUser: null, isInTelegramContext: false, isAuthenticated: false, 
        isLoading: true, error: null, 
        isAdmin: () => false, // Default isAdmin function
        // Default implementations for other methods from useTelegram
        openLink: (url: string) => logger.warn(`openLink(${url}) called on loading context`),
        close: () => logger.warn('close() called on loading context'),
        showPopup: (params: any) => logger.warn('showPopup() called on loading context', params),
        sendData: (data: string) => logger.warn(`sendData(${data}) called on loading context`),
        getInitData: () => { logger.warn('getInitData() called on loading context'); return null; },
        expand: () => logger.warn('expand() called on loading context'),
        setHeaderColor: (color: string) => logger.warn(`setHeaderColor(${color}) called on loading context`),
        setBackgroundColor: (color: string) => logger.warn(`setBackgroundColor(${color}) called on loading context`),
        // Ensure all properties of AppContextData are present
        platform: 'unknown', // Example: if platform is part of AppContextData
        themeParams: { bg_color: '#000000', text_color: '#ffffff', hint_color: '#888888', link_color: '#007aff', button_color: '#007aff', button_text_color: '#ffffff', secondary_bg_color: '#1c1c1d', header_bg_color: '#000000', accent_text_color: '#007aff', section_bg_color: '#1c1c1d', section_header_text_color: '#8e8e93', subtitle_text_color: '#8e8e93', destructive_text_color: '#ff3b30' },
        initData: undefined,
        initDataUnsafe: { query_id: undefined, user: undefined, receiver: undefined, chat: undefined, chat_type: undefined, chat_instance: undefined, start_param: undefined, can_send_after: undefined, auth_date: 0, hash: '' },
        colorScheme: 'dark',
     } as AppContextData; 
  }

  // CRITICAL: Context is loaded (isLoading: false) but isAdmin is STILL not a function.
  // This signifies a deeper issue in useTelegram or AppProvider's memoization.
  // This check should only happen if dbUser is actually available, otherwise isAdmin might legitimately not be ready.
  if (context.isLoading === false && typeof context.isAdmin !== 'function') {
    logger.error(
        "useAppContext: CRITICAL - Context is loaded (isLoading: false) but context.isAdmin is NOT a function. This suggests an issue in useTelegram or AppProvider's provision of isAdmin.", 
        { 
            contextDbUserExists: !!context.dbUser,
            contextDbUserStatus: context.dbUser?.status, 
            contextDbUserRole: context.dbUser?.role,
            contextIsAuthenticated: context.isAuthenticated,
            contextKeys: Object.keys(context)
        }
    );
    // Fallback: provide a default isAdmin that checks the dbUser if available, otherwise false.
    // This prevents crashes but masks the underlying problem that isAdmin wasn't correctly passed from useTelegram.
    const fallbackIsAdmin = () => {
        if (context.dbUser) {
            const statusIsAdmin = context.dbUser.status === 'admin';
            // Adjust role check as per your actual admin role names
            const roleIsAdmin = context.dbUser.role === 'vprAdmin' || context.dbUser.role === 'admin'; 
            logger.warn(`[useAppContext Fallback isAdmin] Using direct dbUser check. Status: ${context.dbUser.status}, Role: ${context.dbUser.role}. Determined isAdmin: ${statusIsAdmin || roleIsAdmin}`);
            return statusIsAdmin || roleIsAdmin;
        }
        logger.warn("[useAppContext Fallback isAdmin] dbUser not available in context for fallback. Defaulting to false.");
        return false;
    };
    return {
        ...(context as AppContextData), // Spread what we have
        isAdmin: fallbackIsAdmin, // Override with the fallback
    } as AppContextData;
  }

  return context as AppContextData;
};