// app/webhook-handlers/commands/rental-verify.ts
//
// Task 101 — Telegram button handler for the rental verification flow.
// Thin webhook-side wrapper: command-handler.ts routes every `vrf_*` and
// `vrfp_*` callback_query here BEFORE the /doc / /ekip / /subrent routers
// (the prefixes are unique, so no state conflicts are possible).
// Task 106 adds `vrfp_*` (dispute editor + proposal flow) and the comment
// text capture hook (`vrf_comment_` user_states → next message is captured).
//
// The real logic lives in app/franchize/lib/rental-verify.ts (shared with the
// web closure paths + tests). This file exists to keep the webhook handler
// surface symmetrical with the other flow modules (doc/ekip/testdrive).

import { logger } from "@/lib/logger";
import {
  handleRentalVerifyCallback,
  handleRentalVerifyCommentText,
  handleRentalVerifyProposalCallback,
  handleRentalVerifyReassignCallback,
} from "@/app/franchize/lib/rental-verify";

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

/** Task 106: the dispute-editor stepper + proposal answer buttons. */
export async function handleRentalVerifyProposalCallbackCommand(params: {
  userIdStr: string;
  chatId: number;
  text: string;
  callbackQueryId: string;
  messageId?: number;
}): Promise<boolean> {
  try {
    return await handleRentalVerifyProposalCallback({
      data: params.text,
      chatId: String(params.chatId),
      callbackQueryId: params.callbackQueryId,
      messageId: params.messageId,
    });
  } catch (e) {
    logger.warn("[rental-verify] proposal webhook dispatch failed:", e);
    return false;
  }
}

/**
 * TASK158: the «✍️ Кто выдал / Кто принял» role reassignment flow —
 * picker + apply callbacks (`vrf_re_*`).
 */
export async function handleRentalVerifyReassignCallbackCommand(params: {
  userIdStr: string;
  chatId: number;
  text: string;
  callbackQueryId: string;
  messageId?: number;
}): Promise<boolean> {
  try {
    return await handleRentalVerifyReassignCallback({
      data: params.text,
      chatId: String(params.chatId),
      callbackQueryId: params.callbackQueryId,
      messageId: params.messageId,
    });
  } catch (e) {
    logger.warn("[rental-verify] reassign webhook dispatch failed:", e);
    return false;
  }
}

/**
 * Task 106: comment capture — when the chat is in `vrf_comment_` state,
 * the next plain text message becomes the proposal comment. Returns false
 * when the user is NOT in that state (router falls through to other flows).
 */
export async function handleRentalVerifyTextCommand(params: {
  userIdStr: string;
  chatId: number;
  text: string;
}): Promise<boolean> {
  try {
    return await handleRentalVerifyCommentText({
      userId: params.userIdStr,
      chatId: String(params.chatId),
      text: params.text,
    });
  } catch (e) {
    logger.warn("[rental-verify] comment text dispatch failed:", e);
    return false;
  }
}
