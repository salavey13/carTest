"use client"

import { useCallback, useEffect, useState } from "react"
import { debugLogger } from "@/lib/debugLogger"
import { fetchUserData } from "@/hooks/supabase"
import { createOrUpdateUser } from "@/app/actions"
import type { TelegramWebApp, WebAppUser } from "@/types/telegram"
import type { Database } from "@/types/database.types"

type DatabaseUser = Database["public"]["Tables"]["users"]["Row"]

const MOCK_USER: WebAppUser = {
  id: 413553377,
  first_name: "Mock",
  last_name: "User",
  username: "mockuser",
  language_code: "ru",
}

const LOCAL_STORAGE_KEY = "telegram_user_data"

export function useTelegram() {
  const [tg, setTg] = useState<TelegramWebApp | null>(null)
  const [user, setUser] = useState<WebAppUser | null>(null)
  const [dbUser, setDbUser] = useState<DatabaseUser | null>(null)
  const [jwtToken, setJwtToken] = useState<string | null>(null)
  const [isInTelegramContext, setIsInTelegramContext] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isMockUser, setIsMockUser] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const loadCachedUser = useCallback(() => {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY)
    return cached ? JSON.parse(cached) : null
  }, [])

  const saveCachedUser = useCallback((telegramUser: WebAppUser, dbUser: DatabaseUser) => {
    const data = { telegramUser, dbUser, timestamp: Date.now() }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
  }, [])

  const handleAuthentication = useCallback(async (telegramUser: WebAppUser) => {
    debugLogger.log("Authenticating user...", telegramUser)
    try {
      const cached = loadCachedUser()
      if (cached && cached.telegramUser.id === telegramUser.id) {
        debugLogger.log("Using cached user data")
        setDbUser(cached.dbUser)
        return
      }

      const fetchedUser = await fetchUserData(telegramUser.id.toString())
      if (!fetchedUser) {
        debugLogger.log("Creating new user...")
        const newUser = await createOrUpdateUser(telegramUser.id.toString(), telegramUser)
        setDbUser(newUser as DatabaseUser)
        saveCachedUser(telegramUser, newUser as DatabaseUser)
      } else {
        setDbUser(fetchedUser as DatabaseUser)
        saveCachedUser(telegramUser, fetchedUser as DatabaseUser)
      }
    } catch (err) {
      debugLogger.error("Failed to authenticate user:", err)
      setError(err instanceof Error ? err : new Error("Authentication failed"))
    }
  }, [loadCachedUser, saveCachedUser])

  const initTelegram = useCallback(async () => {
    debugLogger.log("Initializing Telegram WebApp")
    setIsLoading(true)
    setError(null)

    try {
      if (typeof window !== "undefined") {
        const telegram = (window as any).Telegram?.WebApp as TelegramWebApp
        if (telegram?.initDataUnsafe?.user) {
          telegram.ready()
          setTg(telegram)
          setIsInTelegramContext(true)
          const telegramUser = telegram.initDataUnsafe.user
          setUser(telegramUser)
          await handleAuthentication(telegramUser)
        } else {
          debugLogger.log("No Telegram context, using mock user")
          setIsInTelegramContext(false)
          await setMockUser()
        }
      } else {
        throw new Error("Window is not defined")
      }
    } catch (err) {
      debugLogger.error("Error initializing Telegram:", err)
      setIsInTelegramContext(false)
      await setMockUser()
    } finally {
      setIsLoading(false)
    }
  }, [handleAuthentication])

  const setMockUser = useCallback(async () => {
    debugLogger.log("Setting mock user")
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
    let mounted = true
    const initialize = async () => {
      if (!mounted) return
      if (typeof window !== "undefined" && !document.getElementById("telegram-web-app-script")) {
        const script = document.createElement("script")
        script.id = "telegram-web-app-script"
        script.src = "https://telegram.org/js/telegram-web-app.js"
        script.async = true
        script.onload = () => mounted && initTelegram()
        script.onerror = () => {
          debugLogger.error("Failed to load Telegram script")
          if (mounted) {
            setError(new Error("Failed to load Telegram WebApp script"))
            setMockUser()
          }
        }
        document.head.appendChild(script)
      } else {
        initTelegram()
      }
    }
    initialize()
    return () => {
      mounted = false
      const script = document.getElementById("telegram-web-app-script")
      if (script) document.head.removeChild(script)
    }
  }, [initTelegram, setMockUser])

  const isAuthenticated = Boolean(dbUser)
  const isAdmin = useCallback(() => dbUser?.role === "admin", [dbUser])

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

