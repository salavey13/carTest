// /contexts/AppContext.tsx
"use client";

import type React from "react";
import { createContext, useContext, useEffect, useMemo } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { debugLogger } from "@/lib/debugLogger";
import { toast } from "sonner";

// Define the shape of the context data
// Infer the type from the hook's return value for robustness
type AppContextType = ReturnType<typeof useTelegram>;

// Create the context with an initial undefined value
const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Get data from the useTelegram hook
  const telegramData = useTelegram();

  // Memoize the context value to prevent unnecessary re-renders of consumers
  // if telegramData object reference changes but values are the same.
  const contextValue = useMemo(() => telegramData, [telegramData]);

  // Log context changes for debugging (only when contextValue actually changes)
  useEffect(() => {
    debugLogger.log("AppContext updated:", {
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
    // Show success toast only once when authentication completes successfully
    if (contextValue.isAuthenticated && !contextValue.isLoading && !contextValue.error) {
        // Use a unique ID to prevent the toast from showing multiple times on rapid updates
        toast.success("Пользователь авторизован", { id: "auth-success-toast", duration: 2000 });
    }
    // Optional: Show error toast if authentication fails
    else if (!contextValue.isLoading && contextValue.error) {
         toast.error("Ошибка авторизации", { id: "auth-error-toast", description: contextValue.error.message });
    }
     // Optional: Show loading toast? Could be annoying.
     // else if (contextValue.isLoading) {
     //     toast.loading("Авторизация...", { id: "auth-loading-toast" });
     // } else {
     //     toast.dismiss("auth-loading-toast"); // Dismiss loading if no longer loading
     // }

  }, [contextValue.isAuthenticated, contextValue.isLoading, contextValue.error]);

  // Provide the memoized value to the context consumers
  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

// Custom hook for consuming the context
export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  // Ensure the hook is used within a provider
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};