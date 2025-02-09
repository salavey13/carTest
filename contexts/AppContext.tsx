"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { useTelegram } from "@/hooks/useTelegram"

type AppContextType = {
  dbUser: any | null
  isLoading: boolean
  error: Error | null
  setDbUser: (user: any) => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { dbUser: initialDbUser, isLoading, error } = useTelegram()
  const [dbUser, setDbUser] = useState(initialDbUser)

  useEffect(() => {
    setDbUser(initialDbUser)
  }, [initialDbUser])

  return <AppContext.Provider value={{ dbUser, isLoading, error, setDbUser }}>{children}</AppContext.Provider>
}

export const useAppContext = () => {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider")
  }
  return context
}

