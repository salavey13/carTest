"use client"
import { useCallback, useEffect, useState } from "react"
import { debugLogger } from "@/lib/debugLogger"
import { createOrUpdateUser, fetchUserData } from "@/hooks/supabase"
import type { TelegramWebApp, WebAppUser } from "@/types/telegram"
import type { Database } from "@/types/database.types"
import { toast } from "sonner"

type DatabaseUser = Database["public"]["Tables"]["users"]["Row"]

const MOCK_USER: WebAppUser = {
  id: 413553377,
  first_name: "Mock",
  last_name: "User",
  username: "mockuser",
  language_code: "ru",
  photo_url: "https://t.me/i/userpic/320/mockuser.jpg",
}

export function useTelegram() {
  const [tg, setTg] = useState<TelegramWebApp | null>(null)
  const [user, setUser] = useState<WebAppUser | null>(null)
  const [dbUser, setDbUser] = useState<DatabaseUser | null>(null)
  const [isInTelegramContext, setIsInTelegramContext] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

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
            role: "user",
          })

          if (!userData) {
            throw new Error("Failed to create new user")
          }
        }

        setUser(telegramUser)
        setDbUser(userData as DatabaseUser)
        toast.success("Пользователь авторизован")
        return userData
      } catch (err) {
        debugLogger.error("Failed to authenticate user:", err)
        setError(err instanceof Error ? err : new Error("Authentication failed"))
        toast.error("Ошибка авторизации")
        throw err
      }
    },
    []
  )

  const setMockUser = useCallback(async () => {
    debugLogger.log("Setting mock user")
    try {
      const userData = await handleAuthentication(MOCK_USER)
      if (!userData) {
        throw new Error("Failed to set mock user")
      }
      toast.info("Используется тестовый пользователь")
    } catch (err) {
      debugLogger.error("Error setting mock user:", err)
      setError(err instanceof Error ? err : new Error("Failed to set mock user"))
      toast.error("Ошибка установки тестового пользователя")
    }
  }, [handleAuthentication])

  useEffect(() => {
    let mounted = true
    let intervalId: NodeJS.Timeout | null = null

    const initialize = async () => {
      if (!mounted) return

      setIsLoading(true)
      setError(null)

      const checkTelegram = async () => {
        if (typeof window !== "undefined") {
          const telegram = (window as any).Telegram?.WebApp
          if (telegram?.initDataUnsafe?.user) {
            telegram.ready()
            setTg(telegram)
            setIsInTelegramContext(true)
            await handleAuthentication(telegram.initDataUnsafe.user).catch((err) => {
              debugLogger.error("Error during authentication:", err)
              setError(new Error("Authentication failed"))
            })
            setIsLoading(false)
            if (intervalId) clearInterval(intervalId)
            toast.success("Telegram подключен")
          } else if (!document.getElementById("telegram-web-app-script")) {
            debugLogger.log("Loading Telegram script dynamically")
            const script = document.createElement("script")
            script.id = "telegram-web-app-script"
            script.src = "https://telegram.org/js/telegram-web-app.js"
            script.async = true

            script.onload = async () => {
              if (!mounted) return
              const telegram = (window as any).Telegram?.WebApp
              if (telegram?.initDataUnsafe?.user) {
                telegram.ready()
                setTg(telegram)
                setIsInTelegramContext(true)
                await handleAuthentication(telegram.initDataUnsafe.user).catch((err) => {
                  debugLogger.error("Error during authentication:", err)
                  setError(new Error("Authentication failed"))
                })
                setIsLoading(false)
                if (intervalId) clearInterval(intervalId)
                toast.success("Telegram подключен после загрузки")
              }
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
          }
        }
      }

      // Initial check
      await checkTelegram()

      // Poll every 500ms until Telegram is ready or 5s timeout
      if (!isInTelegramContext && mounted) {
        intervalId = setInterval(async () => {
          await checkTelegram()
        }, 500)
        setTimeout(async () => {  // Made async here
          if (intervalId && !isInTelegramContext) {
            clearInterval(intervalId)
            debugLogger.log("No Telegram context after timeout, using mock user")
            setIsInTelegramContext(false)
            await setMockUser()  // Now valid in async function
            setIsLoading(false)
          }
        }, 5000)
      }
    }

    initialize()

    return () => {
      mounted = false
      if (intervalId) clearInterval(intervalId)
      const script = document.getElementById("telegram-web-app-script")
      if (script) document.head.removeChild(script)
    }
  }, [handleAuthentication, setMockUser])

  const isAuthenticated = Boolean(dbUser)
  const isAdmin = useCallback(() => dbUser?.status === "admin", [dbUser])

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
