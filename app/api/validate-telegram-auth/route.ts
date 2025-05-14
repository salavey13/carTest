import { NextRequest, NextResponse } from 'next/server';
import { webcrypto } from 'crypto'; 
import { logger } from '@/lib/logger'; 

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BYPASS_VALIDATION_ENV = process.env.TEMP_BYPASS_TG_AUTH_VALIDATION === 'true';

if (BYPASS_VALIDATION_ENV) {
  logger.warn("API_VALIDATE_INIT: TEMP_BYPASS_TG_AUTH_VALIDATION is TRUE. Hash validation will be bypassed! FOR DEBUGGING ONLY.");
}

async function validateTelegramHash(initDataString: string): Promise<{ isValid: boolean; user?: any; error?: string }> {
  logger.log("[API_VALIDATE_HASH_FN_ENTRY] Starting hash validation process.");

  if (!BOT_TOKEN) {
    logger.error("API_VALIDATE_HASH_FN_ERROR: TELEGRAM_BOT_TOKEN is not set.");
    return { isValid: false, error: "Bot token not configured on server." };
  }

  const params = new URLSearchParams(initDataString);
  const hashFromClient = params.get("hash");

  if (!hashFromClient) {
    logger.warn("[API_VALIDATE_HASH_FN_WARN] Hash missing in initData.");
    return { isValid: false, error: "Hash not found in initData." };
  }

  logger.log(`[API_VALIDATE_HASH_FN_INFO] Client hash: ${hashFromClient}`);

  const keys = Array.from(params.keys())
    .filter(key => key !== "hash" && key !== "signature")
    .sort();

  const dataCheckString = keys.map(key => `${key}=${params.get(key)}`).join('\n');

  logger.log(`[API_VALIDATE_HASH_FN_INFO] DataCheckString (len: ${dataCheckString.length}): "${dataCheckString.slice(0, 200)}${dataCheckString.length > 200 ? '...' : ''}"`);

  try {
    const secretKey = await webcrypto.subtle.importKey(
      "raw", new TextEncoder().encode(BOT_TOKEN),
      { name: "HMAC", hash: "SHA-256" },
      false, ["sign"]
    );

    const derivedKeyBuffer = await webcrypto.subtle.sign(
      "HMAC", secretKey, new TextEncoder().encode("WebAppData")
    );

    const derivedKey = await webcrypto.subtle.importKey(
      "raw", derivedKeyBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false, ["sign"]
    );

    const signatureBuffer = await webcrypto.subtle.sign(
      "HMAC", derivedKey, new TextEncoder().encode(dataCheckString)
    );

    const signatureHex = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    logger.log(`[API_VALIDATE_HASH_FN_INFO] Computed hash: ${signatureHex}`);

    const isStrictlyValid = signatureHex === hashFromClient;

    if (BYPASS_VALIDATION_ENV) {
      if (!isStrictlyValid) {
        logger.warn(`[API_VALIDATE_HASH_FN_WARN] HASH MISMATCH! Computed: ${signatureHex}, Received: ${hashFromClient}.`);
      }
      logger.warn("[API_VALIDATE_HASH_FN_INFO] BYPASS ACTIVE: Proceeding anyway.");
      const userParam = params.get("user");
      if (userParam) {
        try {
          const user = JSON.parse(decodeURIComponent(userParam));
          logger.info("[API_VALIDATE_HASH_FN_INFO] (Bypass Mode) User parsed successfully:", { userId: user?.id, username: user?.username });
          return { isValid: true, user };
        } catch (e) {
          logger.error("[API_VALIDATE_HASH_FN_ERROR] (Bypass Mode) Failed to parse user:", e);
          return { isValid: true, error: "Bypassed hash, but user parse failed." };
        }
      }
      return { isValid: true };
    }

    if (isStrictlyValid) {
      logger.info("[API_VALIDATE_HASH_FN_SUCCESS] Hash matched.");
      const userParam = params.get("user");
      if (userParam) {
        try {
          const user = JSON.parse(decodeURIComponent(userParam));
          logger.info("[API_VALIDATE_HASH_FN_SUCCESS] User parsed successfully:", { userId: user?.id, username: user?.username });
          return { isValid: true, user };
        } catch (e) {
          logger.error("[API_VALIDATE_HASH_FN_ERROR] Hash valid, but user parse failed:", e);
          return { isValid: true, error: "Hash valid, user parse failed." };
        }
      }
      return { isValid: true };
    }

    logger.error(`[API_VALIDATE_HASH_FN_ERROR] Hash mismatch. Computed: ${signatureHex}, Received: ${hashFromClient}`);
    return { isValid: false, error: "Hash mismatch (strict check failed)." };

  } catch (e: any) {
    logger.error("[API_VALIDATE_HASH_FN_ERROR] Crypto failure:", e.message, e.stack);
    return { isValid: false, error: `Crypto error: ${e.message}` };
  }
}

export async function POST(req: NextRequest) {
  logger.info("[API_VALIDATE_POST_ENTRY] /api/validate-telegram-auth POST hit.");
  try {
    const body = await req.json();
    const { initData } = body;

    logger.log("[API_VALIDATE_POST_INFO] Body parsed. initData:", typeof initData === 'string' ? initData.slice(0, 60) + (initData.length > 60 ? '...' : '') : typeof initData);

    if (typeof initData !== "string" || !initData) {
      logger.warn("[API_VALIDATE_POST_WARN] Invalid input. initData must be non-empty string.");
      return NextResponse.json({ isValid: false, error: "initData must be a non-empty string." }, { status: 400 });
    }

    if (!BOT_TOKEN) {
      logger.error("[API_VALIDATE_POST_ERROR] TELEGRAM_BOT_TOKEN missing.");
      return NextResponse.json({ isValid: false, error: "Server bot token misconfigured." }, { status: 500 });
    }

    const result = await validateTelegramHash(initData);

    const status = BYPASS_VALIDATION_ENV ? 200 : result.isValid ? 200 : 401;
    logger.log(`[API_VALIDATE_POST_INFO] Responding with status ${status}. Valid: ${result.isValid}, Bypass: ${BYPASS_VALIDATION_ENV}`);

    return NextResponse.json(result, { status });

  } catch (e: any) {
    logger.error("[API_VALIDATE_POST_ERROR] JSON parsing or logic error:", e.message, e.stack);
    return NextResponse.json({ isValid: false, error: `Server error: ${e.message}` }, { status: 500 });
  }
}