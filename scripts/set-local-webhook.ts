// scripts/set-local-webhook.ts
// Set Telegram webhook to a local tunnel URL (ngrok, localtunnel, etc.)
import "dotenv/config";
import axios from "axios";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable");
}

// Get webhook URL from command line or prompt
const webhookUrl = process.argv[2];

if (!webhookUrl) {
  console.error(`
Usage: node scripts/set-local-webhook.ts <WEBHOOK_URL>

Example:
  node scripts/set-local-webhook.ts https://abc123.ngrok-free.app/api/telegramWebhook

To get a tunnel URL:
  1. Install ngrok: https://ngrok.com/download
  2. Run: ngrok http 3000
  3. Copy the HTTPS URL and add /api/telegramWebhook
  `);
  process.exit(1);
}

// Ensure URL ends with /api/telegramWebhook
const finalUrl = webhookUrl.endsWith("/api/telegramWebhook")
  ? webhookUrl
  : webhookUrl.replace(/\/$/, "") + "/api/telegramWebhook";

async function setWebhook() {
  try {
    console.log(`Setting webhook to: ${finalUrl}`);

    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        url: finalUrl,
        allowed_updates: ["message", "pre_checkout_query", "successful_payment", "edited_message"],
      }
    );

    if (response.data.ok) {
      console.log(`✅ Webhook set successfully!`);
      console.log(`   URL: ${finalUrl}`);
      console.log(`\nYou can now chat with your bot on Telegram.`);
    } else {
      console.error(`❌ Failed to set webhook:`, response.data);
      process.exit(1);
    }

    // Verify webhook info
    const infoResponse = await axios.get(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
    );

    if (infoResponse.data.ok) {
      console.log(`\n📋 Current webhook info:`);
      console.log(`   URL: ${infoResponse.data.result.url}`);
      console.log(`   Pending updates: ${infoResponse.data.result.pending_update_count || 0}`);
      console.log(`   Last error: ${infoResponse.data.result.last_error_message || "none"}`);
    }
  } catch (error) {
    console.error("Error setting webhook:", error);
    process.exit(1);
  }
}

setWebhook();
