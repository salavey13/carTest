// /contexts/AppContext.tsx
"use client";

"use client"

import type React from "react"
import { createContext, useContext, useEffect } from "react"
import { useTelegram } from "@/hooks/useTelegram"
import { debugLogger } from "@/lib/debugLogger"
import { toast } from "sonner"

type AppContextType = ReturnType<typeof useTelegram>

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const telegramData = useTelegram()

  debugLogger.log("AppContext: Rendering with", {
    dbUser: telegramData.dbUser,
    telegramUser: telegramData.user,
    isLoading: telegramData.isLoading,
    error: telegramData.error,
    isInTelegramContext: telegramData.isInTelegramContext,
    isAuthenticated: telegramData.isAuthenticated,
  })

  // Centralize authentication toast
  useEffect(() => {
    if (telegramData.isAuthenticated && !telegramData.isLoading) {
      toast.success("Пользователь авторизован", { id: "auth-toast" }); // Unique ID to prevent duplicates
    }
  }, [telegramData.isAuthenticated, telegramData.isLoading])

  return <AppContext.Provider value={telegramData}>{children}</AppContext.Provider>
}

export const useAppContext = () => {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider")
  }
  return context
}