"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { useTelegram } from "@/hooks/useTelegram"
import { debugLogger } from "@/lib/debugLogger"

type AppContextType = {
  dbUser: any | null
  telegramUser: any | null
  isLoading: boolean
  error: Error | null
  isInTelegramContext: boolean
  isAuthenticated: boolean
  setDbUser: (user: any) => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    dbUser: initialDbUser,
    user: telegramUser,
    isLoading,
    error,
    isInTelegramContext,
    isAuthenticated,
  } = useTelegram()
  const [dbUser, setDbUser] = useState(initialDbUser)

  useEffect(() => {
    debugLogger.log("AppContext: initialDbUser changed", initialDbUser)
    setDbUser(initialDbUser)
  }, [initialDbUser])

  debugLogger.log("AppContext: Rendering with", {
    dbUser,
    telegramUser,
    isLoading,
    error,
    isInTelegramContext,
    isAuthenticated,
  })

  return (
    <AppContext.Provider
      value={{ dbUser, telegramUser, isLoading, error, isInTelegramContext, isAuthenticated, setDbUser }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useAppContext = () => {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider")
  }
  return context
}

