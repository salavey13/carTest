import { NextRequest, NextResponse } from 'next/server';
import { webcrypto } from 'crypto'; // Using Node.js crypto module for server-side
import { logger } from '@/lib/logger'; // Assuming global logger exists

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function validateTelegramHash(initDataString: string): Promise<{ isValid: boolean; user?: any; error?: string }> {
  if (!BOT_TOKEN) {
    logger.error("SERVER CRITICAL ERROR: TELEGRAM_BOT_TOKEN environment variable is not set.");
    return { isValid: false, error: "Bot token not configured on server." };
  }
  logger.debug("[API Validate] BOT_TOKEN is present (length check).");

  const params = new URLSearchParams(initDataString);
  const hash = params.get("hash");
  if (!hash) {
    logger.warn("[API Validate] Hash not found in initData.");
    return { isValid: false, error: "Hash not found in initData." };
  }
  logger.debug(`[API Validate] Received hash: ${hash}`);

  params.delete("hash"); 
  const dataToCheck: string[] = [];
  const sortedParams = Array.from(params.entries()).sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
  
  for (const [key, value] of sortedParams) {
    dataToCheck.push(`${key}=${value}`);
  }

  const dataCheckString = dataToCheck.join("\n");
  logger.debug(`[API Validate] DataCheckString prepared: "${dataCheckString.substring(0,100)}..."`);

  try {
    // Step 1: HMAC_SHA256(BOT_TOKEN, "WebAppData")
    // Import "WebAppData" as the key material for the first HMAC operation
    const secretKeyMaterial = new TextEncoder().encode("WebAppData");
    const secretKeyImported = await webcrypto.subtle.importKey(
      "raw",
      secretKeyMaterial, // This is the "key" for the HMAC in terms of material
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    // Sign BOT_TOKEN (as data) using the key derived from "WebAppData"
    const botTokenAsData = new TextEncoder().encode(BOT_TOKEN);
    const derivedBotTokenKey = await webcrypto.subtle.sign( // This is HMAC_SHA256("WebAppData", BOT_TOKEN)
      "HMAC",
      secretKeyImported, // Key derived from "WebAppData"
      botTokenAsData       // BOT_TOKEN as data
    );
    // derivedBotTokenKey is now the actual "secret_key" for the next step.
    logger.debug("[API Validate] HMAC_SHA256('WebAppData', BOT_TOKEN) computed successfully.");

    // Step 2: HMAC_SHA256(data_check_string, derivedBotTokenKey)
    // Import the derivedBotTokenKey as the key for the final HMAC
    const finalSigningKey = await webcrypto.subtle.importKey(
      "raw",
      derivedBotTokenKey, // This is the result from step 1
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    // Sign dataCheckString using this final key
    const signatureBuffer = await webcrypto.subtle.sign(
      "HMAC",
      finalSigningKey, 
      new TextEncoder().encode(dataCheckString)
    );

    const signatureHex = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    logger.debug(`[API Validate] Computed signatureHex: ${signatureHex}`);

    if (signatureHex === hash) {
      logger.info("[API Validate] Hash validation successful.");
      const userParam = params.get("user"); 
      if (userParam) {
        try {
          const user = JSON.parse(decodeURIComponent(userParam));
          logger.info("[API Validate] User data parsed successfully:", {userId: user?.id, username: user?.username});
          return { isValid: true, user };
        } catch (e) {
          logger.error("[API Validate] Error parsing user data from initData:", e);
          return { isValid: false, error: "Failed to parse user data." };
        }
      }
      logger.warn("[API Validate] User parameter missing in initData, but hash is valid.");
      return { isValid: true }; 
    } else {
      logger.warn("[API Validate] Hash validation FAILED.", {computed: signatureHex, received: hash});
      return { isValid: false, error: "Hash mismatch." };
    }
  } catch (e: any) {
    logger.error("[API Validate] Crypto operation error:", e);
    return { isValid: false, error: `Crypto error: ${e.message}` };
  }
}

export async function POST(req: NextRequest) {
  logger.info("[API Validate POST] Received request.");
  try {
    const body = await req.json();
    const { initData } = body;

    if (typeof initData !== "string") {
      logger.warn("[API Validate POST] Invalid request: initData is not a string.");
      return NextResponse.json({ error: "initData must be a string." }, { status: 400 });
    }

    if (!BOT_TOKEN) {
        // This log is already in validateTelegramHash, but good to have one here too.
        logger.error("SERVER CRITICAL ERROR in API POST: TELEGRAM_BOT_TOKEN is not set.");
        return NextResponse.json({ error: "Server configuration error: Bot token missing." }, { status: 500 });
    }
    
    const validationResult = await validateTelegramHash(initData);
    
    logger.info(`[API Validate POST] Validation result: isValid=${validationResult.isValid}, user_id=${validationResult.user?.id}`);
    return NextResponse.json(validationResult, { 
        status: validationResult.isValid ? 200 : 401 
    });

  } catch (e: any) {
    logger.error("[API Validate POST] Error processing request:", e);
    return NextResponse.json({ error: `Server error: ${e.message}` }, { status: 500 });
  }
}