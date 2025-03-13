"use client"

import { useState, useEffect } from "react"
import { useTelegram } from "@/hooks/useTelegram"
import { supabaseAdmin } from "@/hooks/supabase"
import { sendTelegramMessage } from "@/app/actions"
import { toast } from "sonner"
import { Loader2, Trophy } from "lucide-react"

// Utility function to generate CAPTCHA string based on settings
const generateCaptchaString = (length: number, characterSet: "letters" | "numbers" | "both") => {
  let chars = ""
  if (characterSet === "letters" || characterSet === "both") {
    chars += "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
  }
  if (characterSet === "numbers" || characterSet === "both") {
    chars += "0123456789"
  }
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

// Database functions
const getCaptchaSettings = async () => {
  const { data, error } = await supabaseAdmin
    .from("settings")
    .select("string_length, character_set, case_sensitive")
    .eq("id", 1)
    .single()
  if (error) throw error
  return data
}

const updateCaptchaSettings = async (settings: {
  string_length: number
  character_set: "letters" | "numbers" | "both"
  case_sensitive: boolean
}) => {
  const { error } = await supabaseAdmin.from("settings").update(settings).eq("id", 1)
  if (error) throw error
}

const getAdminChatIds = async () => {
  const { data, error } = await supabaseAdmin.from("users").select("user_id").eq("status", "admin")
  if (error) throw error
  return data?.map((admin) => admin.user_id) || []
}

export default function CaptchaVerification() {
  const { dbUser, isLoading, isAdmin } = useTelegram()
  const [settings, setSettings] = useState<{
    string_length: number
    character_set: "letters" | "numbers" | "both"
    case_sensitive: boolean
  } | null>(null)
  const [editingSettings, setEditingSettings] = useState(settings)
  const [captchaString, setCaptchaString] = useState("")
  const [userInput, setUserInput] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState("")
  const [successfulUsers, setSuccessfulUsers] = useState<any[]>([])

  // Fetch settings and generate CAPTCHA on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await getCaptchaSettings()
        setSettings(data)
        setEditingSettings(data)
        const newCaptcha = generateCaptchaString(data.string_length, data.character_set)
        setCaptchaString(newCaptcha)
      } catch (err) {
        console.error("Ошибка загрузки настроек:", err)
        toast.error("Не удалось загрузить настройки CAPTCHA.")
      }
    }
    fetchSettings()
  }, [])

  // Check if user has already completed CAPTCHA
  useEffect(() => {
    if (dbUser && !isLoading) {
      const metadata = dbUser.metadata as any
      if (metadata?.captchaSuccess) {
        setIsSuccess(true)
      }
    }
  }, [dbUser, isLoading])

  // Fetch successful users for admin panel
  useEffect(() => {
    if (isAdmin()) {
      const fetchSuccessfulUsers = async () => {
        try {
          const { data, error } = await supabaseAdmin
            .from("users")
            .select("*")
            .filter("metadata->captchaSuccess", "eq", true)
          if (error) throw error
          setSuccessfulUsers(data || [])
        } catch (err) {
          console.error("Ошибка загрузки пользователей:", err)
          toast.error("Не удалось загрузить пользователей, прошедших CAPTCHA.")
        }
      }
      fetchSuccessfulUsers()
    }
  }, [isAdmin])

  // Handle CAPTCHA submission
  const handleSubmit = async () => {
    if (!settings) return

    const userInputToCheck = settings.case_sensitive ? userInput : userInput.toLowerCase()
    const captchaToCheck = settings.case_sensitive ? captchaString : captchaString.toLowerCase()

    if (userInputToCheck === captchaToCheck) {
      try {
        const currentMetadata = dbUser.metadata || {}
        const updatedMetadata = { ...currentMetadata, captchaSuccess: true }
        await supabaseAdmin.from("users").update({ metadata: updatedMetadata }).eq("user_id", dbUser.user_id)
        setIsSuccess(true)
        toast.success("CAPTCHA успешно пройдена!")

        // Notify admins
        const adminChatIds = await getAdminChatIds()
        for (const adminId of adminChatIds) {
          await sendTelegramMessage(
            process.env.TELEGRAM_BOT_TOKEN!,
            `🔔 Пользователь ${dbUser.username || dbUser.user_id} успешно прошел CAPTCHA.`,
            [],
            undefined,
            adminId
          )
        }
      } catch (err) {
        console.error("Ошибка обновления метаданных:", err)
        toast.error("Не удалось обновить статус. Попробуйте снова.")
      }
    } else {
      setError("Неверная CAPTCHA. Попробуйте снова.")
      setUserInput("") // Clear input for retry
    }
  }

  // Handle saving settings in admin panel
  const handleSaveSettings = async () => {
    if (!editingSettings) return
    try {
      await updateCaptchaSettings(editingSettings)
      setSettings(editingSettings)
      const newCaptcha = generateCaptchaString(editingSettings.string_length, editingSettings.character_set)
      setCaptchaString(newCaptcha)
      toast.success("Настройки успешно обновлены!")
    } catch (err) {
      console.error("Ошибка обновления настроек:", err)
      toast.error("Не удалось обновить настройки. Попробуйте снова.")
    }
  }

  // Handle sending notifications to successful users
  const handleNotify = async () => {
    try {
      for (const user of successfulUsers) {
        await sendTelegramMessage(
          process.env.TELEGRAM_BOT_TOKEN!,
          `🎉 Поздравляем! Вы успешно прошли CAPTCHA и можете продолжить. 🚀`,
          [],
          undefined,
          user.user_id
        )
      }
      toast.success("Уведомления успешно отправлены!")
    } catch (err) {
      console.error("Ошибка отправки уведомлений:", err)
      toast.error("Не удалось отправить уведомления. Попробуйте снова.")
    }
  }

  // Loading state
  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-green-900 mt-6">
        <Loader2 className="w-12 h-12 animate-spin text-yellow-400" />
      </div>
    )
  }

  // Login check
  if (!dbUser) {
    return (
      <div className="text-center p-8 bg-green-800 text-white rounded-lg mt-6">
        <h2 className="text-2xl font-bold mb-4">Пожалуйста, Войдите</h2>
        <p>Вам нужно войти, чтобы использовать CAPTCHA.</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 pt-24 bg-green-900 min-h-screen text-white mt-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Проверка CAPTCHA</h1>
        <p className="text-lg text-green-200">Пройдите CAPTCHA, чтобы продолжить.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-16 items-center justify-center">
        <div className="flex flex-col items-center">
          {isSuccess ? (
            <div className="mt-4 p-3 bg-green-800 rounded-lg inline-block">
              <p className="text-lg">CAPTCHA успешно пройдена!</p>
            </div>
          ) : (
            <div className="captcha-challenge">
              <p>
                Пожалуйста, введите следующий текст:{" "}
                <strong className="text-yellow-400">{captchaString}</strong>
              </p>
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Введите CAPTCHA здесь"
                className="w-full p-2 mt-2 border border-green-600 bg-green-900 text-white rounded-md placeholder-green-300"
              />
              <button
                onClick={handleSubmit}
                className="mt-4 px-6 py-3 bg-yellow-400 text-green-900 rounded-full font-bold text-lg flex items-center justify-center gap-2 mx-auto hover:bg-yellow-300"
              >
                Отправить
              </button>
              {error && <p className="text-red-400 mt-2">{error}</p>}
            </div>
          )}
        </div>

        {isAdmin() && (
          <div className="bg-green-800 p-6 rounded-lg w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-400" />
              Панель Администратора
            </h2>

            {/* CAPTCHA Settings */}
            <div className="settings-section mb-6">
              <h3 className="text-lg font-semibold mb-2">Настройки CAPTCHA</h3>
              <label className="block mb-2">
                Длина строки:
                <input
                  type="number"
                  min="4"
                  max="8"
                  value={editingSettings?.string_length || 4}
                  onChange={(e) =>
                    setEditingSettings({
                      ...editingSettings!,
                      string_length: parseInt(e.target.value),
                    })
                  }
                  className="w-full p-2 mt-1 border border-green-600 bg-green-900 text-white rounded-md"
                />
              </label>
              <label className="block mb-2">
                Набор символов:
                <select
                  value={editingSettings?.character_set || "both"}
                  onChange={(e) =>
                    setEditingSettings({
                      ...editingSettings!,
                      character_set: e.target.value as "letters" | "numbers" | "both",
                    })
                  }
                  className="w-full p-2 mt-1 border border-green-600 bg-green-900 text-white rounded-md"
                >
                  <option value="letters">Буквы</option>
                  <option value="numbers">Цифры</option>
                  <option value="both">Буквы и цифры</option>
                </select>
              </label>
              <label className="block mb-2">
                Чувствительность к регистру:
                <select
                  value={editingSettings?.case_sensitive ? "true" : "false"}
                  onChange={(e) =>
                    setEditingSettings({
                      ...editingSettings!,
                      case_sensitive: e.target.value === "true",
                    })
                  }
                  className="w-full p-2 mt-1 border border-green-600 bg-green-900 text-white rounded-md"
                >
                  <option value="true">Да</option>
                  <option value="false">Нет</option>
                </select>
              </label>
              <button
                onClick={handleSaveSettings}
                className="mt-4 px-6 py-3 bg-yellow-400 text-green-900 rounded-full font-bold text-lg flex items-center justify-center gap-2 mx-auto hover:bg-yellow-300"
              >
                Сохранить настройки
              </button>
            </div>

            {/* Success Checker */}
            <div className="success-checker">
              <h3 className="text-lg font-semibold mb-2">Пользователи, прошедшие CAPTCHA</h3>
              {successfulUsers.length > 0 ? (
                <>
                  <div className="max-h-60 overflow-y-auto bg-green-900 rounded-md p-2">
                    {successfulUsers.map((user) => (
                      <div key={user.user_id} className="p-2 border-b border-green-700 last:border-b-0">
                        <p className="font-medium">{user.full_name || user.username || user.user_id}</p>
                        <p className="text-sm text-green-300">ID: {user.user_id}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleNotify}
                    className="mt-4 px-6 py-3 bg-yellow-400 text-green-900 rounded-full font-bold text-lg flex items-center justify-center gap-2 mx-auto hover:bg-yellow-300"
                  >
                    Уведомить пользователей
                  </button>
                </>
              ) : (
                <p>Пока нет пользователей, прошедших CAPTCHA.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
