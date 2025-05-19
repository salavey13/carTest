"use client";

import type React from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react"; // Added useState
import { useTelegram } from "@/hooks/useTelegram";
// import { debugLogger } from "@/lib/debugLogger"; // Keep if specific debugs needed for AppContext itself
import { logger as globalLogger } from "@/lib/logger"; 
import { toast } from "sonner";
// Types not directly used in this file if passed through from useTelegram
// import type { WebAppUser, WebApp, ThemeParams, WebAppInitData } from "@/types/telegram";
// import type { Database } from "@/types/database.types";

// type User = Database["public"]["Tables"]["users"]["Row"]; // Not directly used

interface AppContextData extends ReturnType<typeof useTelegram> {
  // isAuthenticating is already part of ReturnType<typeof useTelegram>
  startParamPayload: string | null; // Added to store the parsed start_param
}

const AppContext = createContext<Partial<AppContextData>>({});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const telegramData = useTelegram(); // This now contains all states including isLoading, isAuthenticating, error etc.
  const [startParamPayload, setStartParamPayload] = useState<string | null>(null);

  useEffect(() => {
    if (telegramData.tg && telegramData.tg.initDataUnsafe?.start_param) {
      const rawStartParam = telegramData.tg.initDataUnsafe.start_param;
      globalLogger.info(`[AppContext] Received start_param: ${rawStartParam}`);
      setStartParamPayload(rawStartParam);
    }
  }, [telegramData.tg]);


  // contextValue simply passes through what useTelegram provides.
  // useMemo here ensures that the context object reference only changes if telegramData itself changes.
  const contextValue = useMemo(() => {
    // No need for extensive debug logging here for memoization itself,
    // as the primary source of truth and logging is useTelegram.
    return {
        ...telegramData,
        startParamPayload, // Add startParamPayload to the context
    };
  }, [telegramData, startParamPayload]); // Dependency array is telegramData and startParamPayload

  useEffect(() => {
    globalLogger.log("[APP_CONTEXT EFFECT_STATUS_UPDATE] Context value changed. Current state from context:", {
      isAuthenticated: contextValue.isAuthenticated,
      isLoading: contextValue.isLoading, // Directly from useTelegram
      isAuthenticating: contextValue.isAuthenticating, // Directly from useTelegram
      userId: contextValue.dbUser?.user_id ?? contextValue.user?.id,
      dbUserStatus: contextValue.dbUser?.status,
      dbUserRole: contextValue.dbUser?.role,
      isAdminFuncType: typeof contextValue.isAdmin,
      errorMsg: contextValue.error?.message, // Directly from useTelegram
      inTelegram: contextValue.isInTelegramContext,
      mockUserEnv: process.env.NEXT_PUBLIC_USE_MOCK_USER,
      platform: contextValue.platform,
      startParamPayload: contextValue.startParamPayload, // Log the payload
    });
  }, [contextValue]); // Log whenever the memoized contextValue changes

  useEffect(() => {
    let loadingTimer: NodeJS.Timeout | null = null;
    const LOADING_TOAST_DELAY = 350; 

    globalLogger.log(`[APP_CONTEXT EFFECT_TOAST_LOGIC] Evaluating toasts. isLoading: ${contextValue.isLoading}, isAuthenticating: ${contextValue.isAuthenticating}, isAuthenticated: ${contextValue.isAuthenticated}, error: ${contextValue.error?.message}, isInTG: ${contextValue.isInTelegramContext}, MOCK_ENV: ${process.env.NEXT_PUBLIC_USE_MOCK_USER}, Visible: ${document.visibilityState}`);

    // Consolidate loading state check
    const فعلاًЗагружается = contextValue.isLoading || contextValue.isAuthenticating;

    if (فعلاًЗагружается) { 
       toast.dismiss("auth-success-toast");
       toast.dismiss("auth-error-toast");
       toast.dismiss("mock-user-info-toast");
       globalLogger.log("[APP_CONTEXT EFFECT_TOAST_LOGIC] In loading/authenticating state. Dismissed other toasts.");

       loadingTimer = setTimeout(() => {
          // Re-check condition inside timeout
          const stillLoadingInTimeout = contextValue.isLoading || contextValue.isAuthenticating;
          if (stillLoadingInTimeout && document.visibilityState === 'visible') {
             globalLogger.info("[APP_CONTEXT EFFECT_TOAST_LOGIC] Showing 'Авторизация...' loading toast (ID: auth-loading-toast).");
             toast.loading("Авторизация...", { id: "auth-loading-toast" });
          } else {
             globalLogger.log("[APP_CONTEXT EFFECT_TOAST_LOGIC] Loading toast condition NO LONGER MET inside timeout or tab not visible. Dismissing auth-loading-toast pre-emptively.");
             toast.dismiss("auth-loading-toast");
          }
       }, LOADING_TOAST_DELAY);
    } else { // Not loading AND not authenticating
        if (loadingTimer) clearTimeout(loadingTimer);
        toast.dismiss("auth-loading-toast"); // Ensure loading toast is dismissed
        globalLogger.log("[APP_CONTEXT EFFECT_TOAST_LOGIC] Exited loading/authenticating state. Dismissed auth-loading-toast.");

        // Mock user toast logic
        if (process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true' && !contextValue.isInTelegramContext) {
             const existingMockToast = document.querySelector('[data-sonner-toast][data-toast-id="mock-user-info-toast"]');
             if (!existingMockToast && document.visibilityState === 'visible') {
                globalLogger.info("[APP_CONTEXT EFFECT_TOAST_LOGIC] Using MOCK_USER outside of Telegram. Displaying info toast (ID: mock-user-info-toast).");
                toast.info("Внимание: используется тестовый пользователь!", { 
                    description: "Данные могут не сохраняться или вести себя иначе, чем в Telegram.",
                    duration: 7000, 
                    id: "mock-user-info-toast" 
                });
             } else if (existingMockToast) {
                globalLogger.log("[APP_CONTEXT EFFECT_TOAST_LOGIC] Mock user info toast already exists or tab not visible. Not showing new one.");
             }
        } else if (contextValue.isInTelegramContext) { // Explicitly in real TG context
             globalLogger.log("[APP_CONTEXT EFFECT_TOAST_LOGIC] In real Telegram context. Dismissing any mock user info toast (ID: mock-user-info-toast).");
             toast.dismiss("mock-user-info-toast");
        }

        // Auth success/error toast logic
        if (contextValue.isAuthenticated && !contextValue.error) {
            toast.dismiss("auth-error-toast"); 
             if (document.visibilityState === 'visible') {
                 globalLogger.info("[APP_CONTEXT EFFECT_TOAST_LOGIC] User authenticated successfully. Showing success toast (ID: auth-success-toast).");
                 toast.success("Пользователь авторизован", { id: "auth-success-toast", duration: 2500 });
             }
        } else if (contextValue.error) {
            toast.dismiss("auth-success-toast"); 
            if (document.visibilityState === 'visible') {
                 globalLogger.error("[APP_CONTEXT EFFECT_TOAST_LOGIC] Auth error. Showing error toast (ID: auth-error-toast). Error:", contextValue.error.message);
                 toast.error(`Ошибка авторизации: ${contextValue.error.message}`, { 
                    id: "auth-error-toast", 
                    description: "Не удалось войти. Попробуйте перезапустить приложение или обратитесь в поддержку.",
                    duration: 10000 
                });
            }
        } else {
            // This case: !isLoading, !isAuthenticating, !isAuthenticated, !error
            // Means user is simply not authenticated yet, but no error occurred (e.g. first visit, no initData)
            globalLogger.log("[APP_CONTEXT EFFECT_TOAST_LOGIC] Not loading, not authed, no error. No specific auth status toast needed.");
        }
    }

    return () => {
        if (loadingTimer) {
            clearTimeout(loadingTimer);
            globalLogger.log("[APP_CONTEXT EFFECT_TOAST_LOGIC_CLEANUP] Cleared loadingTimer.");
        }
    };
  }, [contextValue.isAuthenticated, contextValue.isLoading, contextValue.isAuthenticating, contextValue.error, contextValue.isInTelegramContext]);

  return <AppContext.Provider value={contextValue as AppContextData}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextData => {
  const context = useContext(AppContext);
  
  // Check if context is truly uninitialized (e.g. called outside Provider, or Provider hasn't run its effect yet)
  // `isLoading` and `isAuthenticating` are good indicators from `useTelegram`'s initial state.
  if (!context || context.isLoading === undefined || context.isAuthenticating === undefined ) { 
     globalLogger.warn("HOOK_APP_CONTEXT: Context is empty or key state flags (`isLoading`/`isAuthenticating`) are undefined. Returning SKELETON/LOADING defaults. This is usually very brief on initial mount BEFORE useTelegram initializes.");
     return {
        tg: null, user: null, dbUser: null, isInTelegramContext: false, isAuthenticated: false, 
        isLoading: true, isAuthenticating: true, error: null, 
        isAdmin: () => { globalLogger.warn("isAdmin() called on SKELETON AppContext, returning false."); return false; },
        openLink: (url: string) => globalLogger.warn(`openLink(${url}) called on SKELETON AppContext`),
        close: () => globalLogger.warn('close() called on SKELETON AppContext'),
        showPopup: (params: any) => globalLogger.warn('showPopup() called on SKELETON AppContext', params),
        sendData: (data: string) => globalLogger.warn(`sendData(${data}) called on SKELETON AppContext`),
        getInitData: () => { globalLogger.warn('getInitData() called on SKELETON AppContext'); return null; },
        expand: () => globalLogger.warn('expand() called on SKELETON AppContext'),
        setHeaderColor: (color: string) => globalLogger.warn(`setHeaderColor(${color}) called on SKELETON AppContext`),
        setBackgroundColor: (color: string) => globalLogger.warn(`setBackgroundColor(${color}) called on SKELETON AppContext`),
        platform: 'unknown_skeleton', 
        themeParams: { bg_color: '#000000', text_color: '#ffffff', hint_color: '#888888', link_color: '#007aff', button_color: '#007aff', button_text_color: '#ffffff', secondary_bg_color: '#1c1c1d', header_bg_color: '#000000', accent_text_color: '#007aff', section_bg_color: '#1c1c1d', section_header_text_color: '#8e8e93', subtitle_text_color: '#8e8e93', destructive_text_color: '#ff3b30' },
        initData: undefined, 
        initDataUnsafe: undefined,
        colorScheme: 'dark',
        startParam: null, // Added from useTelegram
        startParamPayload: null, // Added to AppContextData
     } as AppContextData; 
  }

  // This specific check is for a rare edge case where useTelegram might have finished, 
  // but the isAdmin function somehow isn't correctly formed on the context object.
  if (context.isLoading === false && context.isAuthenticating === false && typeof context.isAdmin !== 'function') {
    globalLogger.error(
        "HOOK_APP_CONTEXT: CRITICAL - Context fully loaded (isLoading: false, isAuthenticating: false) but context.isAdmin is NOT a function. This indicates a problem with how useTelegram returns its memoized value or how AppContext consumes it. Providing a fallback isAdmin.", 
        { 
            contextDbUserExists: !!context.dbUser,
            contextDbUserStatus: context.dbUser?.status, 
            contextDbUserRole: context.dbUser?.role,
            contextIsAuthenticated: context.isAuthenticated,
            contextKeys: Object.keys(context) // Log all keys to see what's actually there
        }
    );
    const fallbackIsAdmin = () => { // Define the fallback function
        if (context.dbUser) {
            const statusIsAdmin = context.dbUser.status === 'admin';
            const roleIsAdmin = context.dbUser.role === 'vprAdmin' || context.dbUser.role === 'admin'; 
            globalLogger.warn(`[HOOK_APP_CONTEXT - Fallback isAdmin] Using direct dbUser check. Status: ${context.dbUser.status}, Role: ${context.dbUser.role}. Determined isAdmin: ${statusIsAdmin || roleIsAdmin}`);
            return statusIsAdmin || roleIsAdmin;
        }
        globalLogger.warn("[HOOK_APP_CONTEXT - Fallback isAdmin] dbUser not available in context for fallback. Defaulting to false.");
        return false;
    };
    // Return the context spread, but override isAdmin with the fallback
    return {
        ...(context as AppContextData), // Cast to ensure type compliance
        isAdmin: fallbackIsAdmin, 
    };
  }
  // globalLogger.log("[HOOK_APP_CONTEXT] Context seems valid and complete. isLoading:", context.isLoading, "isAuthenticating:", context.isAuthenticating, "isAdmin is func:", typeof context.isAdmin === 'function');
  return context as AppContextData; // All checks passed, context is good.
};