"use client"

import type React from "react"
import { createContext, useContext } from "react"
import { useTelegram } from "@/hooks/useTelegram"
import { debugLogger } from "@/lib/debugLogger"

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

  return <AppContext.Provider value={telegramData}>{children}</AppContext.Provider>
}

export const useAppContext = () => {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider")
  }
  return context
}

