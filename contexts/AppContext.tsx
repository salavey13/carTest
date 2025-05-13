"use client";

import type React from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { debugLogger } // renamed to avoid conflict with globalLogger
    from "@/lib/debugLogger";
import { logger as globalLogger } from "@/lib/logger"; // Using global logger for wider scope
import { toast } from "sonner";
import type { WebAppUser, WebApp, ThemeParams, WebAppInitData } from "@/types/telegram";
import type { Database } from "@/types/database.types";

type User = Database["public"]["Tables"]["users"]["Row"];

interface AppContextData extends ReturnType<typeof useTelegram> {
  isAuthenticating: boolean; 
}

const AppContext = createContext<Partial<AppContextData>>({});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const telegramData = useTelegram();

  const contextValue = useMemo(() => {
    // debugLogger.debug( // Keep this debug log if needed, but it's very verbose for every memo
    //     "[AppContext Provider] Memoizing contextValue. telegramData props:", 
    //     { 
    //         isLoading: telegramData.isLoading, 
    //         isAuthenticating: telegramData.isAuthenticating,
    //         isAdminIsFunction: typeof telegramData.isAdmin === 'function', 
    //         dbUserStatus: telegramData.dbUser?.status,
    //         dbUserRole: telegramData.dbUser?.role,
    //         isAuthenticated: telegramData.isAuthenticated,
    //         isInTelegramContext: telegramData.isInTelegramContext, 
    //         isMockUser: process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true' 
    //     }
    // );
    return {
      ...telegramData,
    };
  }, [ 
    telegramData.tg, 
    telegramData.user, 
    telegramData.dbUser, 
    telegramData.isInTelegramContext, 
    telegramData.isAuthenticated, 
    telegramData.isAuthenticating, 
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
    telegramData.platform, 
    telegramData.themeParams,
    telegramData.initData,
    telegramData.initDataUnsafe,
    telegramData.colorScheme,
  ]);

  useEffect(() => {
    globalLogger.log("[AppContext STATUS UPDATE] Context value changed. Current state:", {
      isAuthenticated: contextValue.isAuthenticated,
      isLoading: contextValue.isLoading,
      isAuthenticating: contextValue.isAuthenticating,
      userId: contextValue.dbUser?.user_id ?? contextValue.user?.id,
      dbUserStatus: contextValue.dbUser?.status,
      dbUserRole: contextValue.dbUser?.role,
      isAdminFuncType: typeof contextValue.isAdmin,
      errorMsg: contextValue.error?.message,
      inTelegram: contextValue.isInTelegramContext,
      mockUserEnv: process.env.NEXT_PUBLIC_USE_MOCK_USER,
    });
  }, [contextValue]);

  useEffect(() => {
    let loadingTimer: NodeJS.Timeout | null = null;
    const LOADING_TOAST_DELAY = 350; // Slightly increased delay

    globalLogger.log(`[AppContext TOAST LOGIC] Evaluating toasts. isLoading: ${contextValue.isLoading}, isAuthenticating: ${contextValue.isAuthenticating}, isAuthenticated: ${contextValue.isAuthenticated}, error: ${contextValue.error?.message}, isInTG: ${contextValue.isInTelegramContext}, MOCK_ENV: ${process.env.NEXT_PUBLIC_USE_MOCK_USER}`);

    if (contextValue.isLoading || contextValue.isAuthenticating) { 
       // Clear any existing non-loading toasts immediately
       toast.dismiss("auth-success-toast");
       toast.dismiss("auth-error-toast");
       toast.dismiss("mock-user-info-toast");

       loadingTimer = setTimeout(() => {
          // Double check the condition *inside* the timeout, as state might have changed
          if ((contextValue.isLoading || contextValue.isAuthenticating) && document.visibilityState === 'visible') {
             globalLogger.info("[AppContext TOAST] Showing 'Авторизация...' loading toast (ID: auth-loading-toast).");
             toast.loading("Авторизация...", { id: "auth-loading-toast" });
          } else {
             globalLogger.log("[AppContext TOAST] Loading toast condition NO LONGER MET inside timeout or tab not visible. Dismissing pre-emptively.");
             toast.dismiss("auth-loading-toast");
          }
       }, LOADING_TOAST_DELAY);
    } else { 
        if (loadingTimer) clearTimeout(loadingTimer);
        toast.dismiss("auth-loading-toast"); // Ensure loading toast is dismissed if we exit loading state quickly

        if (process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true' && !contextValue.isInTelegramContext) {
             const existingMockToast = document.querySelector('[data-sonner-toast][data-toast-id="mock-user-info-toast"]');
             if (!existingMockToast && document.visibilityState === 'visible') {
                globalLogger.info("[AppContext TOAST] Using MOCK_USER outside of Telegram. Displaying info toast (ID: mock-user-info-toast).");
                toast.info("Внимание: используется тестовый пользователь!", { 
                    description: "Данные могут не сохраняться или вести себя иначе, чем в Telegram.",
                    duration: 7000, // Increased duration
                    id: "mock-user-info-toast" 
                });
             } else if (existingMockToast) {
                globalLogger.log("[AppContext TOAST] Mock user info toast already exists or tab not visible. Not showing new one.");
             }
        } else if (contextValue.isInTelegramContext) {
             globalLogger.log("[AppContext TOAST] In real Telegram context. Dismissing any mock user info toast (ID: mock-user-info-toast).");
             toast.dismiss("mock-user-info-toast");
        }

        if (contextValue.isAuthenticated && !contextValue.error) {
            // Ensure no error toast is lingering if auth succeeded
            toast.dismiss("auth-error-toast"); 
             if (document.visibilityState === 'visible') {
                 globalLogger.info("[AppContext TOAST] User authenticated successfully. Showing success toast (ID: auth-success-toast).");
                 toast.success("Пользователь авторизован", { id: "auth-success-toast", duration: 2500 });
             }
        } else if (contextValue.error) {
            // Ensure no success toast is lingering if auth failed
            toast.dismiss("auth-success-toast"); 
            if (document.visibilityState === 'visible') {
                 globalLogger.error("[AppContext TOAST] Auth error. Showing error toast (ID: auth-error-toast). Error:", contextValue.error.message);
                 toast.error(`Ошибка авторизации: ${contextValue.error.message}`, { 
                    id: "auth-error-toast", 
                    description: "Не удалось войти. Попробуйте перезапустить приложение или обратитесь в поддержку.",
                    duration: 10000 // Longer duration for errors
                });
            }
        }
    }

    return () => {
        if (loadingTimer) {
            clearTimeout(loadingTimer);
            globalLogger.log("[AppContext TOAST CLEANUP] Cleared loadingTimer.");
        }
        // Consider if other toasts need explicit dismissal on component unmount, though Sonner usually handles this.
        // For persistent toasts like mock-user, this is fine.
    };
  }, [contextValue.isAuthenticated, contextValue.isLoading, contextValue.isAuthenticating, contextValue.error, contextValue.isInTelegramContext]);

  return <AppContext.Provider value={contextValue as AppContextData}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextData => {
  const context = useContext(AppContext);
  
  if (!context || Object.keys(context).length === 0 || context.isLoading === undefined || context.isAuthenticating === undefined ) { 
     globalLogger.warn("useAppContext HOOK: Context is empty or `isLoading`/`isAuthenticating` is undefined. Returning SKELETON/LOADING defaults. This is normal on initial mount.");
     return {
        tg: null, user: null, dbUser: null, isInTelegramContext: false, isAuthenticated: false, 
        isLoading: true, isAuthenticating: true, error: null, 
        isAdmin: () => { globalLogger.warn("isAdmin() called on SKELETON context, returning false."); return false; },
        openLink: (url: string) => globalLogger.warn(`openLink(${url}) called on SKELETON context`),
        close: () => globalLogger.warn('close() called on SKELETON context'),
        showPopup: (params: any) => globalLogger.warn('showPopup() called on SKELETON context', params),
        sendData: (data: string) => globalLogger.warn(`sendData(${data}) called on SKELETON context`),
        getInitData: () => { globalLogger.warn('getInitData() called on SKELETON context'); return null; },
        expand: () => globalLogger.warn('expand() called on SKELETON context'),
        setHeaderColor: (color: string) => globalLogger.warn(`setHeaderColor(${color}) called on SKELETON context`),
        setBackgroundColor: (color: string) => globalLogger.warn(`setBackgroundColor(${color}) called on SKELETON context`),
        platform: 'unknown_loading', 
        themeParams: { bg_color: '#000000', text_color: '#ffffff', hint_color: '#888888', link_color: '#007aff', button_color: '#007aff', button_text_color: '#ffffff', secondary_bg_color: '#1c1c1d', header_bg_color: '#000000', accent_text_color: '#007aff', section_bg_color: '#1c1c1d', section_header_text_color: '#8e8e93', subtitle_text_color: '#8e8e93', destructive_text_color: '#ff3b30' }, // Default theme
        initData: undefined, 
        initDataUnsafe: undefined,
        colorScheme: 'dark', // Default scheme
     } as AppContextData; 
  }

  if (context.isLoading === false && context.isAuthenticating === false && typeof context.isAdmin !== 'function') {
    globalLogger.error(
        "useAppContext HOOK: CRITICAL - Context fully loaded (isLoading: false, isAuthenticating: false) but context.isAdmin is NOT a function. This should NOT happen. Providing a fallback.", 
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
            globalLogger.warn(`[useAppContext HOOK - Fallback isAdmin] Using direct dbUser check. Status: ${context.dbUser.status}, Role: ${context.dbUser.role}. Determined isAdmin: ${statusIsAdmin || roleIsAdmin}`);
            return statusIsAdmin || roleIsAdmin;
        }
        globalLogger.warn("[useAppContext HOOK - Fallback isAdmin] dbUser not available in context for fallback. Defaulting to false.");
        return false;
    };
    return {
        ...(context as AppContextData), 
        isAdmin: fallbackIsAdmin, 
    } as AppContextData;
  }
  // globalLogger.log("[useAppContext HOOK] Context seems valid and complete. isLoading:", context.isLoading, "isAuthenticating:", context.isAuthenticating, "isAdmin is func:", typeof context.isAdmin === 'function');
  return context as AppContextData;
};