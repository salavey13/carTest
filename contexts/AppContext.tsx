"use client";

import type React from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { debugLogger } from "@/lib/debugLogger";
import { logger as globalLogger } from "@/lib/logger";
import { toast } from "sonner";
import { useRouter, usePathname, useSearchParams as useNextSearchParams } from 'next/navigation'; // Добавил useNextSearchParams

interface AppContextData extends ReturnType<typeof useTelegram> {
  startParamPayload: string | null;
}

const AppContext = createContext<Partial<AppContextData>>({});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const telegramData = useTelegram();
  const [startParamPayload, setStartParamPayload] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useNextSearchParams(); // Используем хук для доступа к searchParams на клиенте

  useEffect(() => {
    if (telegramData.tg && telegramData.tg.initDataUnsafe?.start_param) {
      const rawStartParam = telegramData.tg.initDataUnsafe.start_param;
      debugLogger.info(`[AppContext] Received start_param (raw): ${rawStartParam}. This will be used as lead_identifier.`);
      setStartParamPayload(rawStartParam);
    }
  }, [telegramData.tg]);

  useEffect(() => {
    if (startParamPayload && !telegramData.isLoading && !telegramData.isAuthenticating) {
      debugLogger.info(`[AppContext] Processing startParamPayload (lead_identifier): ${startParamPayload}`);
      
      const targetPathBase = `/hotvibes`;
      const targetQuery = `lead_identifier=${startParamPayload}`;
      const fullTargetPath = `${targetPathBase}?${targetQuery}`;

      // Проверяем текущий путь и параметры
      const currentLeadIdentifier = searchParams.get('lead_identifier');

      if (pathname !== targetPathBase || currentLeadIdentifier !== startParamPayload) {
        if (typeof startParamPayload === 'string' && startParamPayload.trim().length > 0) {
          globalLogger.info(`[AppContext] Routing to HotVibes for lead_identifier: ${startParamPayload}`);
          router.push(fullTargetPath); 
          // НЕ ОЧИЩАЕМ startParamPayload здесь, чтобы /hotvibes мог его прочитать
        } else {
          debugLogger.warn(`[AppContext] Invalid or empty startParamPayload for routing: ${startParamPayload}`);
        }
      } else {
        debugLogger.info(`[AppContext] Already on target HotVibes page for lead_identifier: ${startParamPayload}, no redirect needed.`);
      }
    }
  }, [startParamPayload, router, pathname, searchParams, telegramData.isLoading, telegramData.isAuthenticating]);

  const contextValue = useMemo(() => {
    return {
        ...telegramData,
        startParamPayload,
    };
  }, [telegramData, startParamPayload]);

  useEffect(() => {
    debugLogger.log("[APP_CONTEXT EFFECT_STATUS_UPDATE] Context value changed. Current state from context:", {
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
      platform: contextValue.platform,
      startParamPayload: contextValue.startParamPayload,
    });
  }, [contextValue]);

  useEffect(() => {
    let loadingTimer: NodeJS.Timeout | null = null;
    const LOADING_TOAST_DELAY = 350;

    debugLogger.log(`[APP_CONTEXT EFFECT_TOAST_LOGIC] Evaluating toasts. isLoading: ${contextValue.isLoading}, isAuthenticating: ${contextValue.isAuthenticating}, isAuthenticated: ${contextValue.isAuthenticated}, error: ${contextValue.error?.message}, isInTG: ${contextValue.isInTelegramContext}, MOCK_ENV: ${process.env.NEXT_PUBLIC_USE_MOCK_USER}, Visible: ${document.visibilityState}`);

    const فعلاًЗагружается = contextValue.isLoading || contextValue.isAuthenticating;

    if (فعلاًЗагружается) {
       toast.dismiss("auth-success-toast");
       toast.dismiss("auth-error-toast");
       toast.dismiss("mock-user-info-toast");
       debugLogger.log("[APP_CONTEXT EFFECT_TOAST_LOGIC] In loading/authenticating state. Dismissed other toasts.");

       loadingTimer = setTimeout(() => {
          const stillLoadingInTimeout = contextValue.isLoading || contextValue.isAuthenticating;
          if (stillLoadingInTimeout && document.visibilityState === 'visible') {
             debugLogger.info("[APP_CONTEXT EFFECT_TOAST_LOGIC] Showing 'Авторизация...' loading toast (ID: auth-loading-toast).");
             toast.loading("Авторизация...", { id: "auth-loading-toast" });
          } else {
             debugLogger.log("[APP_CONTEXT EFFECT_TOAST_LOGIC] Loading toast condition NO LONGER MET inside timeout or tab not visible. Dismissing auth-loading-toast pre-emptively.");
             toast.dismiss("auth-loading-toast");
          }
       }, LOADING_TOAST_DELAY);
    } else {
        if (loadingTimer) clearTimeout(loadingTimer);
        toast.dismiss("auth-loading-toast");
        debugLogger.log("[APP_CONTEXT EFFECT_TOAST_LOGIC] Exited loading/authenticating state. Dismissed auth-loading-toast.");

        if (process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true' && !contextValue.isInTelegramContext) {
             const existingMockToast = document.querySelector('[data-sonner-toast][data-toast-id="mock-user-info-toast"]');
             if (!existingMockToast && document.visibilityState === 'visible') {
                debugLogger.info("[APP_CONTEXT EFFECT_TOAST_LOGIC] Using MOCK_USER outside of Telegram. Displaying info toast (ID: mock-user-info-toast).");
                toast.info("Внимание: используется тестовый пользователь!", {
                    description: "Данные могут не сохраняться или вести себя иначе, чем в Telegram.",
                    duration: 7000,
                    id: "mock-user-info-toast"
                });
             } else if (existingMockToast) {
                debugLogger.log("[APP_CONTEXT EFFECT_TOAST_LOGIC] Mock user info toast already exists or tab not visible. Not showing new one.");
             }
        } else if (contextValue.isInTelegramContext) {
             debugLogger.log("[APP_CONTEXT EFFECT_TOAST_LOGIC] In real Telegram context. Dismissing any mock user info toast (ID: mock-user-info-toast).");
             toast.dismiss("mock-user-info-toast");
        }

        if (contextValue.isAuthenticated && !contextValue.error) {
            toast.dismiss("auth-error-toast");
             if (document.visibilityState === 'visible') {
                 debugLogger.info("[APP_CONTEXT EFFECT_TOAST_LOGIC] User authenticated successfully. Showing success toast (ID: auth-success-toast).");
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
            debugLogger.log("[APP_CONTEXT EFFECT_TOAST_LOGIC] Not loading, not authed, no error. No specific auth status toast needed.");
        }
    }

    return () => {
        if (loadingTimer) {
            clearTimeout(loadingTimer);
            debugLogger.log("[APP_CONTEXT EFFECT_TOAST_LOGIC_CLEANUP] Cleared loadingTimer.");
        }
    };
  }, [contextValue.isAuthenticated, contextValue.isLoading, contextValue.isAuthenticating, contextValue.error, contextValue.isInTelegramContext]);

  return <AppContext.Provider value={contextValue as AppContextData}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextData => {
  const context = useContext(AppContext);
  
  if (!context || context.isLoading === undefined || context.isAuthenticating === undefined ) {
     debugLogger.info("HOOK_APP_CONTEXT: Context is empty or key state flags (`isLoading`/`isAuthenticating`) are undefined. Returning SKELETON/LOADING defaults.");
     return {
        tg: null, user: null, dbUser: null, isInTelegramContext: false, isAuthenticated: false,
        isLoading: true, isAuthenticating: true, error: null,
        isAdmin: () => { debugLogger.warn("isAdmin() called on SKELETON AppContext, returning false."); return false; },
        openLink: (url: string) => debugLogger.warn(`openLink(${url}) called on SKELETON AppContext`),
        close: () => debugLogger.warn('close() called on SKELETON AppContext'),
        showPopup: (params: any) => debugLogger.warn('showPopup() called on SKELETON AppContext', params),
        sendData: (data: string) => debugLogger.warn(`sendData(${data}) called on SKELETON AppContext`),
        getInitData: () => { debugLogger.warn('getInitData() called on SKELETON AppContext'); return null; },
        expand: () => debugLogger.warn('expand() called on SKELETON AppContext'),
        setHeaderColor: (color: string) => debugLogger.warn(`setHeaderColor(${color}) called on SKELETON AppContext`),
        setBackgroundColor: (color: string) => debugLogger.warn(`setBackgroundColor(${color}) called on SKELETON AppContext`),
        platform: 'unknown_skeleton',
        themeParams: { bg_color: '#000000', text_color: '#ffffff', hint_color: '#888888', link_color: '#007aff', button_color: '#007aff', button_text_color: '#ffffff', secondary_bg_color: '#1c1c1d', header_bg_color: '#000000', accent_text_color: '#007aff', section_bg_color: '#1c1c1d', section_header_text_color: '#8e8e93', subtitle_text_color: '#8e8e93', destructive_text_color: '#ff3b30' },
        initData: undefined,
        initDataUnsafe: undefined,
        colorScheme: 'dark',
        startParam: null,
        startParamPayload: null,
     } as AppContextData;
  }

  if (context.isLoading === false && context.isAuthenticating === false && typeof context.isAdmin !== 'function') {
    globalLogger.error(
        "HOOK_APP_CONTEXT: CRITICAL - Context fully loaded (isLoading: false, isAuthenticating: false) but context.isAdmin is NOT a function. Providing a fallback isAdmin.",
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
            debugLogger.warn(`[HOOK_APP_CONTEXT - Fallback isAdmin] Using direct dbUser check. Status: ${context.dbUser.status}, Role: ${context.dbUser.role}. Determined isAdmin: ${statusIsAdmin || roleIsAdmin}`);
            return statusIsAdmin || roleIsAdmin;
        }
        debugLogger.warn("[HOOK_APP_CONTEXT - Fallback isAdmin] dbUser not available in context for fallback. Defaulting to false.");
        return false;
    };
    return {
        ...(context as AppContextData),
        isAdmin: fallbackIsAdmin,
    };
  }
  return context as AppContextData;
};