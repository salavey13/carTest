// scripts/setWebhook.ts
import axios from "axios"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const VERCEL_URL = process.env.VERCEL_URL

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable")
}

if (!VERCEL_URL) {
  throw new Error("Missing VERCEL_URL environment variable")
}

const WEBHOOK_URL = `https://${VERCEL_URL}/api/telegramWebhook`

async function setWebhook() {
  try {
    const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
      url: WEBHOOK_URL,
      allowed_updates: ["message", "pre_checkout_query", "successful_payment"],
    })

    if (response.data.ok) {
      console.log(`✅ Webhook set successfully: ${WEBHOOK_URL}`)
    } else {
      console.error(`❌ Failed to set webhook:`, response.data)
    }
  } catch (error) {
    console.error("Error setting webhook:", error)
  }
}

setWebhook()

