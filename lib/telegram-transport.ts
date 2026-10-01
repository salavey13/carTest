// lib/telegram-transport.ts
// ──────────────────────────────────────────────────────────────────────────
// Unified Telegram delivery transport (iter8).
//
// The project is deployed on Vercel (v0-car-test.vercel.app) where
// TELEGRAM_BOT_TOKEN is configured and api.telegram.org is reachable. The
// /api/forward-telegram endpoint on that deployment acts as a message
// forwarding service (sendMessage / sendPhoto / sendDocument / sendMediaGroup,
// including base64 file attachments) — so ANY environment (sandbox, local dev,
// cron scripts) can deliver Telegram messages WITHOUT holding the bot token.
//
// This module is the single place that decides HOW a message is delivered:
//   1. FORWARD mode (default): POST to the forwarding API. The token stays on
//      Vercel; callers need none.
//   2. DIRECT mode / fallback: classic api.telegram.org call with
//      TELEGRAM_BOT_TOKEN (used automatically when forwarding fails and a
//      token is present, or when TELEGRAM_SEND_MODE=direct).
//
// Env knobs:
//   FORWARD_TELEGRAM_URL    — forwarding endpoint (default: the Vercel deployment)
//   FORWARD_TELEGRAM_ORIGIN — Origin header the endpoint whitelists
//                             (default: the deployment's own origin)
//   TELEGRAM_SEND_MODE      — "forward" (default) | "direct"
//   TELEGRAM_BOT_TOKEN      — only needed for the direct path / fallback

import { logger } from "@/lib/logger";

const FORWARD_URL = (process.env.FORWARD_TELEGRAM_URL || "https://v0-car-test.vercel.app/api/forward-telegram").trim();
const FORWARD_ORIGIN = (process.env.FORWARD_TELEGRAM_ORIGIN || "https://v0-car-test.vercel.app").trim();
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const FORWARD_TIMEOUT_MS = Number(process.env.FORWARD_TELEGRAM_TIMEOUT_MS || 20000);
// Code review 2026-10-02: the direct path previously had NO timeout — one hung
// fetch inside a fanout batch stalled the whole run until the serverless
// budget (50s) ran out and Vercel froze the invocation. Every fetch gets a
// deadline now; photos sent by URL may need a long Telegram-side download, so
// the budget matches the forward path by default.
const DIRECT_TIMEOUT_MS = Number(process.env.TELEGRAM_DIRECT_TIMEOUT_MS || 20000);

export type TelegramDeliveryMethod = "sendMessage" | "sendPhoto" | "sendDocument" | "sendMediaGroup";

export interface TelegramTransportResult {
  ok: boolean;
  messageId?: number;
  /** Which path actually delivered the message. */
  via?: "forward" | "direct";
  error?: string;
  /** Telegram 429 flood-control delay (seconds) when the error is rate
   *  limiting — callers may retry once after this delay. */
  retryAfter?: number;
  /** Raw Telegram result payload (message object or media group array). */
  result?: unknown;
}

/**
 * Pure: extract `parameters.retry_after` from a Telegram error response.
 * Handles BOTH shapes seen in the wild:
 *   · direct Bot API / forward route body: { ok:false, parameters:{ retry_after } }
 *   · forward route error envelope:       { error:"…", telegram:{ parameters:{ retry_after } } }
 * Returns null for anything else (never throws — logging paths use it).
 */
export function parseTelegramRetryAfter(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const sources: unknown[] = [obj.parameters, (obj.telegram as Record<string, unknown> | undefined)?.parameters];
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const raw = (source as Record<string, unknown>).retry_after;
    const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return null;
}

export interface ForwardFile {
  data: string; // base64
  filename: string;
  contentType?: string;
}

function forwardDisabled(): boolean {
  return (process.env.TELEGRAM_SEND_MODE || "forward").trim().toLowerCase() === "direct";
}

/** Call the forwarding API on the Vercel deployment. */
async function callForward(
  method: TelegramDeliveryMethod,
  chatId: string | number,
  payload: Record<string, unknown>,
  files?: Record<string, ForwardFile>,
): Promise<TelegramTransportResult> {
  try {
    const response = await fetch(FORWARD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // The endpoint whitelists browser origins (CORS) — server-to-server
        // callers simply present an allowed origin.
        "Origin": FORWARD_ORIGIN,
      },
      body: JSON.stringify({ chat_id: chatId, method, payload, files }),
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    });
    const text = await response.text();
    let json: { ok?: boolean; result?: unknown; message_id?: number; error?: string; telegram?: { description?: string } } | null = null;
    try { json = JSON.parse(text); } catch { json = null; }

    if (response.ok && json?.ok) {
      const result = json.result as { message_id?: number } | undefined;
      return {
        ok: true,
        via: "forward",
        messageId: json.message_id ?? result?.message_id,
        result: json.result,
      };
    }
    const description = json?.telegram?.description || json?.error || `HTTP ${response.status}`;
    logger.warn("[telegram-transport] forward call failed", { method, chatId: String(chatId), description: String(description).slice(0, 300) });
    return { ok: false, via: "forward", error: String(description), retryAfter: parseTelegramRetryAfter(json) ?? undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("[telegram-transport] forward call threw", { method, chatId: String(chatId), message });
    return { ok: false, via: "forward", error: message };
  }
}

/** Classic direct Telegram Bot API call (multipart when files present). */
async function callDirect(
  method: TelegramDeliveryMethod,
  chatId: string | number,
  payload: Record<string, unknown>,
  files?: Record<string, ForwardFile>,
): Promise<TelegramTransportResult> {
  if (!TELEGRAM_BOT_TOKEN) {
    return { ok: false, via: "direct", error: "TELEGRAM_BOT_TOKEN not configured" };
  }
  try {
    let response: Response;
    if (files && Object.keys(files).length > 0) {
      const form = new FormData();
      form.append("chat_id", String(chatId));
      for (const [key, value] of Object.entries(payload)) {
        if (key === "media") {
          form.append(key, JSON.stringify(value));
        } else if (value !== undefined && value !== null) {
          form.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
        }
      }
      for (const [attachName, file] of Object.entries(files)) {
        const buffer = Buffer.from(file.data, "base64");
        form.append(attachName, new Blob([buffer], { type: file.contentType || "application/octet-stream" }), file.filename);
      }
      response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, { method: "POST", body: form, signal: AbortSignal.timeout(DIRECT_TIMEOUT_MS) });
    } else {
      response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, ...payload }),
        signal: AbortSignal.timeout(DIRECT_TIMEOUT_MS),
      });
    }
    const data = (await response.json()) as { ok: boolean; description?: string; parameters?: { retry_after?: number }; result?: { message_id?: number } };
    if (!data.ok) {
      return { ok: false, via: "direct", error: data.description || `HTTP ${response.status}`, retryAfter: parseTelegramRetryAfter(data) ?? undefined };
    }
    return { ok: true, via: "direct", messageId: data.result?.message_id, result: data.result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, via: "direct", error: message };
  }
}

/**
 * Deliver a Telegram API call. Forward-first (keeps the bot token exclusively
 * on the Vercel deployment), direct fallback when forwarding fails and a local
 * token exists. Set TELEGRAM_SEND_MODE=direct to skip forwarding entirely.
 */
export async function telegramDeliver(
  method: TelegramDeliveryMethod,
  chatId: string | number,
  payload: Record<string, unknown>,
  files?: Record<string, ForwardFile>,
): Promise<TelegramTransportResult> {
  if (!forwardDisabled()) {
    const forwarded = await callForward(method, chatId, payload, files);
    if (forwarded.ok) return forwarded;
    // Fall through to direct only when we actually have a token.
    if (!TELEGRAM_BOT_TOKEN) return forwarded;
    logger.info("[telegram-transport] falling back to direct Telegram API", { method, chatId: String(chatId) });
  }
  return callDirect(method, chatId, payload, files);
}

/** Helper: Buffer → base64 forward-file record. */
export function bufferToForwardFile(buffer: Buffer | Uint8Array, filename: string, contentType: string): ForwardFile {
  const b = buffer instanceof Buffer ? buffer : Buffer.from(buffer);
  return { data: b.toString("base64"), filename, contentType };
}
