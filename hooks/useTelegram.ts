"use client"

import { useCallback, useEffect, useState } from "react"
import { debugLogger } from "@/lib/debugLogger"
import { createOrUpdateUser, fetchUserData } from "@/hooks/supabase"
import type { TelegramWebApp, WebAppUser } from "@/types/telegram"
import type { Database } from "@/types/database.types"

type DatabaseUser = Database["public"]["Tables"]["users"]["Row"]

const MOCK_USER: WebAppUser = {
  id: 413553377,
  first_name: "Mock",
  last_name: "User",
  username: "mockuser",
  language_code: "ru",
  photo_url: "https://t.me/i/userpic/320/mockuser.jpg",
}

const LOCAL_STORAGE_KEY = "telegram_auth_state"

export function useTelegram() {
  const [tg, setTg] = useState<TelegramWebApp | null>(null)
  const [user, setUser] = useState<WebAppUser | null>(null)
  const [dbUser, setDbUser] = useState<DatabaseUser | null>(null)
  const [isInTelegramContext, setIsInTelegramContext] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Load cached auth state
  const loadCachedAuthState = useCallback(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (cached) {
        const { user, dbUser, timestamp } = JSON.parse(cached)
        // Check if cache is less than 1 hour old
        if (Date.now() - timestamp < 3600000) {
          return { user, dbUser }
        }
      }
    } catch (err) {
      debugLogger.error("Error loading cached auth state:", err)
    }
    return null
  }, [])

  // Save auth state to cache
  const saveAuthState = useCallback((user: WebAppUser, dbUser: DatabaseUser) => {
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({
          user,
          dbUser,
          timestamp: Date.now(),
        }),
      )
    } catch (err) {
      debugLogger.error("Error saving auth state:", err)
    }
  }, [])

  const handleAuthentication = useCallback(
    async (telegramUser: WebAppUser) => {
      debugLogger.log("Authenticating user...", telegramUser)
      try {
        let userData = await fetchUserData(telegramUser.id.toString())

        if (!userData) {
          debugLogger.log("Creating new user...")
          userData = await createOrUpdateUser(telegramUser.id.toString(), {
            username: telegramUser.username,
            first_name: telegramUser.first_name,
            last_name: telegramUser.last_name,
            language_code: telegramUser.language_code,
            photo_url: telegramUser.photo_url,
            role: "user", // Default role for new users
          })

          if (!userData) {
            throw new Error("Failed to create new user")
          }
        }

        setUser(telegramUser)
        setDbUser(userData as DatabaseUser)
        saveAuthState(telegramUser, userData as DatabaseUser)

        return userData
      } catch (err) {
        debugLogger.error("Failed to authenticate user:", err)
        setError(err instanceof Error ? err : new Error("Authentication failed"))
        throw err
      }
    },
    [saveAuthState],
  )

  const setMockUser = useCallback(async () => {
    debugLogger.log("Setting mock user")
    try {
      const userData = await handleAuthentication(MOCK_USER)
      if (!userData) {
        throw new Error("Failed to set mock user")
      }
    } catch (err) {
      debugLogger.error("Error setting mock user:", err)
      setError(err instanceof Error ? err : new Error("Failed to set mock user"))
    }
  }, [handleAuthentication])

  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      if (!mounted) return

      setIsLoading(true)
      setError(null)

      try {
        // Try to load cached auth state first
        const cached = loadCachedAuthState()
        if (cached) {
          debugLogger.log("Using cached auth state")
          setUser(cached.user)
          setDbUser(cached.dbUser)
          setIsLoading(false)
          return
        }

        if (typeof window !== "undefined") {
          // Load Telegram script if not already loaded
          if (!document.getElementById("telegram-web-app-script")) {
            const script = document.createElement("script")
            script.id = "telegram-web-app-script"
            script.src = "https://telegram.org/js/telegram-web-app.js"
            script.async = true

            script.onload = async () => {
              if (!mounted) return
              const telegram = (window as any).Telegram?.WebApp as TelegramWebApp

              if (telegram?.initDataUnsafe?.user) {
                telegram.ready()
                setTg(telegram)
                setIsInTelegramContext(true)
                await handleAuthentication(telegram.initDataUnsafe.user).catch((err) => {
                  debugLogger.error("Error during authentication:", err)
                  setError(new Error("Authentication failed"))
                })
              } else {
                debugLogger.log("No Telegram context, using mock user")
                setIsInTelegramContext(false)
                await setMockUser()
              }
              if (mounted) setIsLoading(false)
            }

            script.onerror = () => {
              if (!mounted) return
              debugLogger.error("Failed to load Telegram script")
              setError(new Error("Failed to load Telegram WebApp script"))
              setIsInTelegramContext(false)
              setMockUser().finally(() => {
                if (mounted) setIsLoading(false)
              })
            }

            document.head.appendChild(script)
          } else {
            // Script already loaded, initialize directly
            const telegram = (window as any).Telegram?.WebApp as TelegramWebApp
            if (telegram?.initDataUnsafe?.user) {
              telegram.ready()
              setTg(telegram)
              setIsInTelegramContext(true)
              await handleAuthentication(telegram.initDataUnsafe.user).catch((err) => {
                debugLogger.error("Error during authentication:", err)
                setError(new Error("Authentication failed"))
              })
            } else {
              debugLogger.log("No Telegram context, using mock user")
              setIsInTelegramContext(false)
              await setMockUser()
            }
            if (mounted) setIsLoading(false)
          }
        }
      } catch (err) {
        if (!mounted) return
        debugLogger.error("Error initializing Telegram:", err)
        setError(err instanceof Error ? err : new Error("Failed to initialize"))
        setIsInTelegramContext(false)
        await setMockUser()
        if (mounted) setIsLoading(false)
      }
    }

    initialize()

    return () => {
      mounted = false
      const script = document.getElementById("telegram-web-app-script")
      if (script) document.head.removeChild(script)
    }
  }, [handleAuthentication, setMockUser, loadCachedAuthState])

  const isAuthenticated = Boolean(dbUser)
  const isAdmin = useCallback(() => dbUser?.role === "admin", [dbUser])

  return {
    tg,
    user,
    dbUser,
    isInTelegramContext,
    isAuthenticated,
    isAdmin,
    isLoading,
    error,
  }
}

