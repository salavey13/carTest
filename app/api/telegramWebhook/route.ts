import { handleTelegramWebhook } from "@/gateway/telegram/webhook-handler";

export async function POST(request: Request) {
  return handleTelegramWebhook(request);
}
