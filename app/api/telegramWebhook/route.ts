import { handleTelegramWebhook } from "@/gateway/telegram/webhook-handler";
import { logger } from "@/lib/logger";

// Task 109: route-level budget pin. vercel.json sets functions maxDuration=60
// for this route, but the route export is the canonical mechanism and survives
// vercel.json key/glob mismatches. The /doc finalize chain (docx build + 8 DB
// writes + QR fetch + 3 TG sends) NEEDS the headroom — inside the ~10s default
// the tail (QR photo → success message → admin audit → lead → todos) used to
// die after the file was already in the chat (honda 2026-10-18 signature).
// Hobby plan cap is 60 — matching vercel.json exactly.
export const maxDuration = 60;

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
