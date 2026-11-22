// app/webhook-handlers/commands/rental-payout.ts
//
// Task 107 — Telegram wiring for the VERIFIED PAYOUT flow (hub, cards,
// mark/unmark, mark-all). Thin webhook-side wrapper, symmetrical with the
// verify flow (rental-verify.ts): the real logic lives in
// app/franchize/lib/rental-payout.ts and is shared with the web surfaces.
//
// Callback prefix `payo_` is deliberately NOT `pay_` — that one belongs to
// the /doc payment-split callbacks and must stay untouched.
// Deep links: t.me/<bot>?start=payout → sendPayoutHubMessage.

import { logger } from "@/lib/logger";
import {
  handleRentalPayoutCallback,
  sendPayoutHubMessage,
} from "@/app/franchize/lib/rental-payout";

/** `payo_*` callback_query router entry (command-handler.ts). */
export async function handleRentalPayoutCallbackCommand(params: {
  userIdStr: string;
  chatId: number;
  text: string;
  callbackQueryId: string;
  messageId?: number;
}): Promise<boolean> {
  try {
    return await handleRentalPayoutCallback({
      data: params.text,
      chatId: String(params.chatId),
      callbackQueryId: params.callbackQueryId,
      messageId: params.messageId,
    });
  } catch (e) {
    logger.warn("[rental-payout] webhook dispatch failed:", e);
    return false;
  }
}

/** /payouts command + t.me/<bot>?start=payout deep link → fresh hub message. */
export async function handlePayoutsCommand(params: {
  userIdStr: string;
  chatId: number;
}): Promise<void> {
  try {
    await sendPayoutHubMessage(String(params.chatId));
  } catch (e) {
    logger.warn("[rental-payout] /payouts dispatch failed:", e);
  }
}

/**
 * True when the /start payload targets the payout hub (deep links use
 * `?start=payout`). Kept here so start.ts does not grow payout imports.
 */
export function isPayoutStartPayload(text: string | undefined | null): boolean {
  if (!text) return false;
  const m = /^\/start(?:@\S+)?\s+(.*)$/i.exec(text.trim());
  if (!m) return false;
  const payload = m[1].trim();
  return payload === "payout" || payload.startsWith("payout.") || payload.startsWith("payout_");
}
