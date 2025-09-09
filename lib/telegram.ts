import { validateTelegramInitData } from "@/lib/telegram-validator";
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
  if (!initData) return false;
  if (!TELEGRAM_BOT_TOKEN) {
    logger.error("validateTelegramWebAppData: TELEGRAM_BOT_TOKEN is not configured");
    return false;
  }
  try {
    const result = await validateTelegramInitData(initData, TELEGRAM_BOT_TOKEN);
    if (!result.valid) {
      logger.warn("[lib/telegram] validation failed", { reason: result.reason, computed: result.computedHash, received: result.receivedHash });
    } else {
      logger.info("[lib/telegram] validation ok", { userId: result.user?.id });
    }
    return result.valid;
  } catch (e) {
    logger.error("[lib/telegram] validateTelegramWebAppData unexpected error", e);
    return false;
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