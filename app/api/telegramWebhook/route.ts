import { handleTelegramWebhook } from "@/gateway/telegram/webhook-handler";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  logger.info("[TELEGRAM_WEBHOOK_ENTRY] Request received", {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries())
  });
  try {
    return await handleTelegramWebhook(request);
  } catch (error) {
    logger.error("[TELEGRAM_WEBHOOK_ENTRY] Unhandled error", error);
    return new Response(JSON.stringify({ ok: true, error: String(error) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Add GET endpoint for webhook health check
export async function GET(request: Request) {
  logger.info("[TELEGRAM_WEBHOOK_GET] Health check requested");
  return new Response(JSON.stringify({ status: "ok", webhook: "active", timestamp: new Date().toISOString() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
