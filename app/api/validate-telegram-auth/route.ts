import { NextRequest, NextResponse } from 'next/server';
import { webcrypto } from 'crypto'; 
import { logger } from '@/lib/logger'; 

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function validateTelegramHash(initDataString: string): Promise<{ isValid: boolean; user?: any; error?: string }> {
  logger.log("[API Validate BEGIN] Starting hash validation process.");
  if (!BOT_TOKEN) {
    logger.error("SERVER CRITICAL ERROR: [API Validate] TELEGRAM_BOT_TOKEN environment variable is not set.");
    return { isValid: false, error: "Bot token not configured on server." };
  }
  logger.log("[API Validate] BOT_TOKEN is present (length > 0).");

  const params = new URLSearchParams(initDataString);
  const hash = params.get("hash");
  if (!hash) {
    logger.warn("[API Validate] Hash not found in initData string.");
    return { isValid: false, error: "Hash not found in initData." };
  }
  logger.log(`[API Validate] Received hash from initData: ${hash}`);

  params.delete("hash"); 
  const dataToCheck: string[] = [];
  // Sort parameters alphabetically by key
  const sortedParams = Array.from(params.entries()).sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
  
  for (const [key, value] of sortedParams) {
    dataToCheck.push(`${key}=${value}`);
  }

  const dataCheckString = dataToCheck.join("\n");
  logger.log(`[API Validate] DataCheckString prepared (length: ${dataCheckString.length}): "${dataCheckString.substring(0,150)}${dataCheckString.length > 150 ? '...' : ''}"`);

  try {
    // Step 1: secret_key = HMAC_SHA256(<bot_token>, "WebAppData")
    const webAppDataKey = new TextEncoder().encode("WebAppData"); // Data for the first HMAC
    
    // Import BOT_TOKEN as the key material for the first HMAC operation
    const botTokenKeyImported = await webcrypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(BOT_TOKEN), 
      { name: "HMAC", hash: "SHA-256" },
      false, // not extractable
      ["sign"] // for signing
    );
    logger.log("[API Validate] Step 1: Imported BOT_TOKEN for HMAC operation.");

    // Perform HMAC_SHA256(BOT_TOKEN, "WebAppData")
    const secretKeyDerived = await webcrypto.subtle.sign(
      "HMAC",
      botTokenKeyImported, 
      webAppDataKey        
    );
    logger.log("[API Validate] Step 1: HMAC_SHA256(BOT_TOKEN, 'WebAppData') computed (this is the secret_key for step 2).");

    // Step 2: result = HMAC_SHA256(data_check_string, secret_key)
    // Import the secretKeyDerived (result from step 1) as the key for the final HMAC operation
    const finalSigningKey = await webcrypto.subtle.importKey(
      "raw",
      secretKeyDerived, // Use the derived key from step 1
      { name: "HMAC", hash: "SHA-256" },
      false, // not extractable
      ["sign"] // for signing
    );
    logger.log("[API Validate] Step 2: Imported derived secret_key for final HMAC operation.");
    
    // Perform HMAC_SHA256(data_check_string, secretKeyDerived)
    const signatureBuffer = await webcrypto.subtle.sign(
      "HMAC",
      finalSigningKey, 
      new TextEncoder().encode(dataCheckString)
    );

    // Convert the signature to a hex string
    const signatureHex = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    logger.log(`[API Validate] Step 2: Computed final signatureHex: ${signatureHex}`);

    const isStrictlyValid = signatureHex === hash;
    
    // --- TEMPORARY BYPASS LOGIC ---
    const BYPASS_VALIDATION = process.env.TEMP_BYPASS_TG_AUTH_VALIDATION === 'true';
    if (BYPASS_VALIDATION && !isStrictlyValid) {
        logger.warn(`[API Validate] HASH MISMATCH! Computed: ${signatureHex}, Received: ${hash}. VALIDATION IS CURRENTLY BYPASSED DUE TO ENV VAR!`);
    } else if (!isStrictlyValid) {
        logger.error(`[API Validate] HASH MISMATCH! Computed: ${signatureHex}, Received: ${hash}. DataCheckString: "${dataCheckString}"`);
        // return { isValid: false, error: "Hash mismatch." }; // STRICT BEHAVIOR FOR PRODUCTION
    }
    // --- END TEMPORARY BYPASS LOGIC ---

    // If strictly valid OR if bypass is active, proceed to check user
    if (isStrictlyValid || BYPASS_VALIDATION) {
      if (isStrictlyValid) logger.info("[API Validate] Hash validation strictly successful.");
      else logger.warn("[API Validate] Hash validation BYPASSED, proceeding as if valid.");

      const userParam = params.get("user"); 
      if (userParam) {
        try {
          const user = JSON.parse(decodeURIComponent(userParam));
          logger.info("[API Validate] User data parsed successfully from 'user' param:", {userId: user?.id, username: user?.username});
          return { isValid: true, user }; 
        } catch (e) {
          logger.error("[API Validate] Error parsing user data from 'user' param, even though hash was (potentially bypassed) valid:", e);
          return { isValid: true, error: "Failed to parse user data, but hash check was ok (or bypassed)." }; 
        }
      } else {
        logger.warn("[API Validate] 'user' parameter missing in initData, but hash is (potentially bypassed) valid.");
        return { isValid: true }; // Hash is okay (or bypassed), but no user data to return
      }
    } else {
      // This block is only reached if NOT strictly valid AND bypass is OFF (i.e. strict production mode failure)
      logger.error(`[API Validate] Hash validation FAILED (Strict Mode). Computed: ${signatureHex}, Received: ${hash}.`);
      return { isValid: false, error: "Hash mismatch." };
    }

  } catch (e: any) {
    logger.error("[API Validate] CRITICAL ERROR during crypto operation or other unexpected issue:", e);
    return { isValid: false, error: `Crypto error or other failure: ${e.message}` };
  }
}

export async function POST(req: NextRequest) {
  logger.info("[API Validate POST Handler] Received request.");
  try {
    const body = await req.json();
    const { initData } = body;
    logger.log("[API Validate POST Handler] Request body parsed. initData (first 50 chars):", typeof initData === 'string' ? initData.substring(0,50) : 'Not a string or undefined');

    if (typeof initData !== "string") {
      logger.warn("[API Validate POST Handler] Invalid request: initData is not a string or missing.");
      return NextResponse.json({ error: "initData must be a string and is required." }, { status: 400 });
    }

    if (!BOT_TOKEN) {
        logger.error("SERVER CRITICAL ERROR in API POST Handler: TELEGRAM_BOT_TOKEN is not set. Cannot validate.");
        return NextResponse.json({ error: "Server configuration error: Bot token missing. Cannot validate." }, { status: 500 });
    }
    
    const validationResult = await validateTelegramHash(initData);
    
    // Log the outcome clearly
    if (validationResult.isValid) {
        logger.info(`[API Validate POST Handler] Validation SUCCEEDED (or bypassed). User ID (if present): ${validationResult.user?.id}. Sending success response.`);
    } else {
        logger.warn(`[API Validate POST Handler] Validation FAILED. Error: ${validationResult.error}. Sending failure response.`);
    }

    // For production, status should be 401 if !validationResult.isValid AND bypass is OFF.
    // Due to current bypass, we always return 200 if BOT_TOKEN is present and rely on `isValid` in body.
    // Revisit this for production to ensure proper 401s.
    const status = (process.env.TEMP_BYPASS_TG_AUTH_VALIDATION === 'true' || validationResult.isValid) ? 200 : 401;
    logger.log(`[API Validate POST Handler] Determined response status: ${status} (Bypass: ${process.env.TEMP_BYPASS_TG_AUTH_VALIDATION === 'true'}, isValid: ${validationResult.isValid})`);
    
    return NextResponse.json(validationResult, { status });

  } catch (e: any) {
    logger.error("[API Validate POST Handler] CRITICAL ERROR processing request:", e);
    return NextResponse.json({ error: `Server error during request processing: ${e.message}` }, { status: 500 });
  }
}