// app/webhook-handlers/commands/rental-verify.ts
//
// Task 101 — Telegram button handler for the rental verification flow.
// Thin webhook-side wrapper: command-handler.ts routes every `vrf_*`
// callback_query here BEFORE the /doc / /ekip / /subrent routers (the prefix
// is unique, so no state conflicts are possible).
//
// The real logic lives in app/franchize/lib/rental-verify.ts (shared with the
// web closure paths + tests). This file exists to keep the webhook handler
// surface symmetrical with the other flow modules (doc/ekip/testdrive).

import { logger } from "@/lib/logger";
import { handleRentalVerifyCallback } from "@/app/franchize/lib/rental-verify";

export async function handleRentalVerifyCallbackCommand(params: {
  userIdStr: string;
  chatId: number;
  text: string;
  callbackQueryId: string;
  messageId?: number;
}): Promise<boolean> {
  try {
    return await handleRentalVerifyCallback({
      data: params.text,
      chatId: String(params.chatId),
      callbackQueryId: params.callbackQueryId,
      messageId: params.messageId,
    });
  } catch (e) {
    logger.warn("[rental-verify] webhook dispatch failed:", e);
    return false;
  }
}
