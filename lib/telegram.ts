import { validateTelegramInitData } from "@/lib/telegram-validator";
import { logger } from "@/lib/logger"
import type { WebAppUser } from "@/types/telegram"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const APP_URL = process.env.NEXT_PUBLIC_APP_URL

if (!TELEGRAM_BOT_TOKEN) {
  logger.warn("⚠️  Missing TELEGRAM_BOT_TOKEN. Telegram features may not work.")
}

if (!APP_URL) {
  logger.warn("⚠️  Missing APP_URL. Webhook features may not work.")
}

export async function setTelegramWebhook() {
  if (!TELEGRAM_BOT_TOKEN || !APP_URL) {
    throw new Error("Missing required environment variables")
  }

  const webhookUrl = `${APP_URL}/api/telegramWebhook`
  logger.info(`📡 Setting Telegram webhook: ${webhookUrl}`);
  
  const response = await fetch(`https://api.telegram.org/bot ${TELEGRAM_BOT_TOKEN}/setWebhook`, {
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

  const result = await response.json();
  logger.info(`✅ Webhook set: ${JSON.stringify(result)}`);
  return result;
}

export async function validateTelegramWebAppData(initData: string): Promise<boolean> {
  if (!initData) {
    logger.warn("⚠️  validateTelegramWebAppData: Empty initData");
    return false;
  }
  if (!TELEGRAM_BOT_TOKEN) {
    logger.error("💥 TELEGRAM_BOT_TOKEN is not configured");
    return false;
  }
  
  try {
    const result = await validateTelegramInitData(initData, TELEGRAM_BOT_TOKEN);
    
    if (!result.valid) {
      logger.warn(`❌ WebApp validation failed: ${result.reason}`);
    } else {
      logger.info(`✅ WebApp validation passed for @${result.user?.username}`);
    }
    
    return result.valid;
  } catch (e) {
    logger.error("💥 validateTelegramWebAppData unexpected error", e);
    return false;
  }
}

export async function sendTelegramMessage(chatId: string, text: string) {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured")
  }

  logger.log(`📤 Sending message to ${chatId}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
  
  const response = await fetch(`https://api.telegram.org/bot ${TELEGRAM_BOT_TOKEN}/sendMessage`, {
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

  const result = await response.json();
  logger.info(`✅ Message sent successfully (msg_id: ${result.result?.message_id})`);
  return result;
}

export function getTelegramUser(): WebAppUser | null {
  if (typeof window === "undefined") return null

  const telegram = (window as any).Telegram?.WebApp
  if (!telegram?.initDataUnsafe?.user) {
    logger.warn("⚠️  Telegram WebApp user not available");
    return null
  }

  return telegram.initDataUnsafe.user
}