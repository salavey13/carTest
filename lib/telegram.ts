import { logger } from "@/lib/logger"
import type { WebAppUser } from "@/types/telegram"
import { supabaseAdmin } from "@/lib/supabase-server" // Safe Server Import

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const APP_URL = process.env.NEXT_PUBLIC_APP_URL

if (!TELEGRAM_BOT_TOKEN) {
  logger.warn("Missing TELEGRAM_BOT_TOKEN. Telegram features may not work.")
}

// ... (Existing exports like setTelegramWebhook, validateTelegramWebAppData, sendTelegramMessage remain unchanged) ...

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

    data.delete("hash")

    const dataToCheck = Array.from(data.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")

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

// --- NEW: Server-Side Upsert Logic ---
export async function upsertTelegramUser(user: WebAppUser) {
  if (!user.id) throw new Error("User ID is missing");
  
  const userIdStr = user.id.toString();
  
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          user_id: userIdStr,
          username: user.username || null,
          full_name: `${user.first_name || ""} ${user.last_name || ""}`.trim() || null,
          avatar_url: user.photo_url || null,
          language_code: user.language_code || null,
          updated_at: new Date().toISOString(),
          // Default fields for new users
          role: "user",
          status: "active",
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error(`[lib/telegram] Failed to upsert user ${userIdStr}:`, error);
    throw error; // Re-throw to be caught by Server Action
  }
}