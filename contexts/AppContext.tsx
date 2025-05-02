"use client";

import type React from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { debugLogger as logger } from "@/lib/debugLogger";
import { toast } from "sonner"; // Keep for auth toasts

// Define the shape of the context data
// --- REMOVED debugToastsEnabled ---
interface AppContextData extends ReturnType<typeof useTelegram> {}

// Create the context with an initial undefined value
const AppContext = createContext<Partial<AppContextData>>({});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Get data from the useTelegram hook
  const telegramData = useTelegram();

  // --- REMOVED debugToastsEnabled state ---

  // Context value now only contains telegram data
  const contextValue = useMemo(() => ({
    ...telegramData,
  }), [telegramData]); // Dependency only on telegramData

  // Log context changes for debugging
  useEffect(() => {
    logger.log("AppContext updated:", {
      isAuthenticated: contextValue.isAuthenticated,
      isLoading: contextValue.isLoading,
      userId: contextValue.dbUser?.user_id ?? contextValue.user?.id,
      dbUserStatus: contextValue.dbUser?.status,
      error: contextValue.error?.message,
      isInTelegram: contextValue.isInTelegramContext,
      // --- REMOVED debugToastsEnabled log ---
    });
  }, [contextValue]);


  // Centralize the "User Authorized" toast notification
  // This logic remains the same as it doesn't depend on the removed flag
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
                 currentToastId = toast.error("Ошибка авторизации", { id: "auth-error-toast", description: contextValue.error.message });
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
  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

// Custom hook for consuming the context
export const useAppContext = (): AppContextData => {
  const context = useContext(AppContext);
  // --- REMOVED hasOwnProperty check for debugToastsEnabled ---
  if (!context) {
     const error = new Error("useAppContext must be used within an AppProvider and after its initialization");
     logger.fatal("useAppContext Error:", error);
     throw error;
  }
  // Cast to full type once checks pass
  return context as AppContextData;
};