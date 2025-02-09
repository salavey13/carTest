"use client"
import { useCallback, useEffect, useState } from "react"
import { debugLogger } from "@/lib/debugLogger"
import { createOrUpdateUser, fetchUserData } from "@/hooks/supabase"
import type { TelegramWebApp, WebAppUser } from "@/types/telegram"

const MOCK_USER: WebAppUser = {
  id: 413553377,
  first_name: "Mock",
  last_name: "User",
  username: "mockuser",
  language_code: "ru",
}

export function useTelegram() {
  const [tg, setTg] = useState<TelegramWebApp | null>(null)
  const [user, setUser] = useState<WebAppUser | null>(null)
  const [dbUser, setDbUser] = useState<any | null>(null)
  const [jwtToken, setJwtToken] = useState<string | null>(null)
  const [isInTelegramContext, setIsInTelegramContext] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isMockUser, setIsMockUser] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const initTelegram = useCallback(async () => {
    debugLogger.log("useTelegram: initTelegram called")
    setIsLoading(true)
    try {
      if (typeof window !== "undefined") {
        const scriptId = "telegram-web-app-script"
        if (!document.getElementById(scriptId)) {
          const script = document.createElement("script")
          script.id = scriptId
          script.src = "https://telegram.org/js/telegram-web-app.js"
          script.async = true
          document.head.appendChild(script)

          script.onload = async () => {
            const telegram = (window as any).Telegram?.WebApp as TelegramWebApp
            if (telegram && telegram.initDataUnsafe?.user) {
              telegram.ready()
              setTg(telegram)
              setIsInTelegramContext(true)
              const telegramUser = telegram.initDataUnsafe.user
              setUser(telegramUser)
              await handleAuthentication(telegramUser)
            } else {
              setIsInTelegramContext(false)
            }
          }
        }
      }
    } catch (err) {
      debugLogger.error("Error initializing Telegram:", err)
      setError(err instanceof Error ? err : new Error("Unknown error occurred"))
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleAuthentication = useCallback(async (telegramUser: WebAppUser) => {
    debugLogger.log("Authenticating user...")
    try {
      const dbUser = await fetchUserData(telegramUser.id.toString())
      if (!dbUser) {
        await createOrUpdateUser(telegramUser.id.toString(), telegramUser)
      }
      setDbUser(dbUser)
    } catch (err) {
      debugLogger.error("Failed to authenticate user:", err)
      setError(err instanceof Error ? err : new Error("Unknown error occurred"))
    }
  }, [])

  const setMockUser = useCallback(async () => {
    setUser(MOCK_USER)
    setIsMockUser(true)
    await handleAuthentication(MOCK_USER)
  }, [handleAuthentication])

  const disableSwipeGestures = useCallback(() => {
    if (tg) {
      tg.disableVerticalSwipes()
      debugLogger.log("Disabled vertical swipes in Telegram WebApp")
    }
  }, [tg])

  useEffect(() => {
    debugLogger.log("useTelegram: useEffect called for initTelegram")
    initTelegram()
  }, [initTelegram])

  const isAuthenticated = !!dbUser
  const isAdmin = useCallback(() => {
    return dbUser?.role === "admin"
  }, [dbUser])

  return {
    tg,
    user,
    dbUser,
    jwtToken,
    isInTelegramContext,
    isAuthenticated,
    isAdmin,
    isLoading,
    error,
    isMockUser,
    setMockUser,
    disableSwipeGestures,
  }
}

