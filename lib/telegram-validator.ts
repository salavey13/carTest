import crypto from "crypto";
import { logger } from "@/lib/logger";

/**
 * Validate Telegram WebApp initData using Telegram recommended algorithm:
 *  secret_key = SHA256(bot_token)
 *  hash = HMAC_SHA256(secret_key, data_check_string)
 *
 * Returns: { valid: boolean, computedHash, receivedHash, user? , reason? }
 *
 * Notes:
 * - We use crypto.timingSafeEqual for constant-time comparison.
 * - If the client sends hash in base64 or hex, we try hex first then base64 fallback.
 */

type ValidateResult = {
  valid: boolean;
  computedHash: string | null;
  receivedHash: string | null;
  user?: any;
  reason?: string;
};

function buildDataCheckString(params: URLSearchParams) {
  const keys = Array.from(params.keys()).filter(k => k !== "hash" && k !== "signature").sort();
  return keys.map(k => `${k}=${params.get(k)}`).join("\n");
}

function toBufferHexOrBase64(hexOrBase64: string) {
  if (!hexOrBase64) return null;
  // Try hex
  try {
    if (/^[0-9a-fA-F]+$/.test(hexOrBase64) && hexOrBase64.length % 2 === 0) {
      return Buffer.from(hexOrBase64, "hex");
    }
    // fallback base64
    return Buffer.from(hexOrBase64, "base64");
  } catch (e) {
    return null;
  }
}

export async function validateTelegramInitData(initDataString: string, botToken: string): Promise<ValidateResult> {
  try {
    if (!initDataString) return { valid: false, computedHash: null, receivedHash: null, reason: "empty initData" };
    if (!botToken) return { valid: false, computedHash: null, receivedHash: null, reason: "bot token missing" };

    const params = new URLSearchParams(initDataString);
    const receivedHash = params.get("hash");
    if (!receivedHash) {
      return { valid: false, computedHash: null, receivedHash: null, reason: "hash param missing" };
    }

    const dataCheckString = buildDataCheckString(params);
    // secret key = SHA256(bot_token)
    const secretKey = crypto.createHash("sha256").update(botToken).digest();
    const hmac = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    const computedBuffer = Buffer.from(hmac, "hex");
    const receivedBuffer = toBufferHexOrBase64(receivedHash);

    if (!receivedBuffer) {
      return { valid: false, computedHash: hmac, receivedHash, reason: "received hash malformed" };
    }

    // lengths must match for timingSafeEqual; if not — compare constant-time on padded buffers
    let valid = false;
    try {
      if (computedBuffer.length === receivedBuffer.length) {
        valid = crypto.timingSafeEqual(computedBuffer, receivedBuffer);
      } else {
        // if lengths differ, do a defensive compare: create zero buffer of max length and compare
        const maxLen = Math.max(computedBuffer.length, receivedBuffer.length);
        const a = Buffer.alloc(maxLen);
        const b = Buffer.alloc(maxLen);
        computedBuffer.copy(a);
        receivedBuffer.copy(b);
        valid = crypto.timingSafeEqual(a, b);
      }
    } catch (e) {
      logger.error("[telegram-validator] timingSafeEqual failed", e);
      valid = false;
    }

    // If valid, try to parse user param (optional)
    let user = undefined;
    const userParam = params.get("user");
    if (userParam) {
      try {
        // Telegram encodes user JSON in initData as URL-encoded JSON
        user = JSON.parse(decodeURIComponent(userParam));
      } catch (e) {
        // not fatal — we'll return parsed=null but valid can still be true
        logger.warn("[telegram-validator] failed to parse user param", e);
      }
    }

    return { valid, computedHash: hmac, receivedHash, user, reason: valid ? undefined : "hash mismatch" };
  } catch (e: any) {
    logger.error("[telegram-validator] unexpected error", e);
    return { valid: false, computedHash: null, receivedHash: null, reason: e?.message || "internal error" };
  }
}