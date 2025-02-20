import { logger } from "@/lib/logger"
import type { WebAppUser } from "@/types/telegram"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const APP_URL = process.env.NEXT_PUBLIC_APP_URL

if (!TELEGRAM_BOT_TOKEN) {
  logger.warn("Missing TELEGRAM_BOT_TOKEN. Telegram features may not work.")
}

if (!APP_URL) {
  logger.warn("Missing APP_URL. Webhook features may not work.")
}

export async function setTelegramWebhook() {
  if (!TELEGRAM_BOT_TOKEN || !APP_URL) {
    throw new Error("Missing required environment variables")
  }

  const webhookUrl = `${APP_URL}/api/telegramWebhook`
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["message", "callback_query", "pre_checkout_query"],
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to set webhook: ${response.statusText}`)
  }

  return response.json()
}

export async function validateTelegramWebAppData(initData: string): Promise<boolean> {
  try {
    const data = new URLSearchParams(initData)
    const hash = data.get("hash")
    if (!hash) return false

    // Remove hash from data before checking
    data.delete("hash")

    // Sort parameters alphabetically
    const dataToCheck = Array.from(data.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")

    // Create HMAC-SHA256 hash
    const crypto = require("crypto")
    const secretKey = crypto.createHash("sha256").update(TELEGRAM_BOT_TOKEN!).digest()

    const generatedHash = crypto.createHmac("sha256", secretKey).update(dataToCheck).digest("hex")

    return generatedHash === hash
  } catch (error) {
    logger.error("Error validating Telegram WebApp data:", error)
    return false
  }
}

export async function sendTelegramMessage(chatId: string, text: string) {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured")
  }

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.statusText}`)
  }

  return response.json()
}

export function getTelegramUser(): WebAppUser | null {
  if (typeof window === "undefined") return null

  const telegram = (window as any).Telegram?.WebApp
  if (!telegram?.initDataUnsafe?.user) return null

  return telegram.initDataUnsafe.user
}

