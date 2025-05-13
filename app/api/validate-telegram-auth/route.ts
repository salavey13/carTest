import { NextRequest, NextResponse } from 'next/server';
import { webcrypto } from 'crypto'; 
import { logger } from '@/lib/logger'; 

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// New environment variable for bypass control
const BYPASS_VALIDATION_ENV = process.env.TEMP_BYPASS_TG_AUTH_VALIDATION === 'true';

if (BYPASS_VALIDATION_ENV) {
    logger.warn("API_VALIDATE_INIT: TEMP_BYPASS_TG_AUTH_VALIDATION is TRUE. Hash validation will be bypassed! FOR DEBUGGING ONLY.");
}


async function validateTelegramHash(initDataString: string): Promise<{ isValid: boolean; user?: any; error?: string }> {
  logger.log("[API_VALIDATE_HASH_FN_ENTRY] Starting hash validation process.");
  if (!BOT_TOKEN) {
    logger.error("API_VALIDATE_HASH_FN_ERROR: SERVER CRITICAL ERROR - TELEGRAM_BOT_TOKEN environment variable is not set.");
    return { isValid: false, error: "Bot token not configured on server." };
  }
  logger.log("[API_VALIDATE_HASH_FN_INFO] BOT_TOKEN is present.");

  const params = new URLSearchParams(initDataString);
  const hashFromClient = params.get("hash"); // Renamed for clarity
  if (!hashFromClient) {
    logger.warn("[API_VALIDATE_HASH_FN_WARN] Hash not found in initData string from client.");
    return { isValid: false, error: "Hash not found in initData." };
  }
  logger.log(`[API_VALIDATE_HASH_FN_INFO] Received hash from client: ${hashFromClient}`);

  params.delete("hash"); 
  const dataToCheck: string[] = [];
  const sortedParams = Array.from(params.entries()).sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
  
  for (const [key, value] of sortedParams) {
    dataToCheck.push(`${key}=${value}`);
  }

  const dataCheckString = dataToCheck.join("\n");
  logger.log(`[API_VALIDATE_HASH_FN_INFO] DataCheckString prepared (length: ${dataCheckString.length}): "${dataCheckString.substring(0,200)}${dataCheckString.length > 200 ? '...' : ''}"`); // Increased substring length

  try {
    // Step 1: secret_key = HMAC_SHA256(<bot_token>, "WebAppData")
    const webAppDataConstant = new TextEncoder().encode("WebAppData"); 
    
    const botTokenKeyMaterial = await webcrypto.subtle.importKey(
      "raw", new TextEncoder().encode(BOT_TOKEN), 
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    logger.log("[API_VALIDATE_HASH_FN_INFO] Step 1: Imported BOT_TOKEN for HMAC operation.");

    const derivedSecretKey = await webcrypto.subtle.sign( // This is the "secret_key" for the next step
      "HMAC", botTokenKeyMaterial, webAppDataConstant        
    );
    logger.log("[API_VALIDATE_HASH_FN_INFO] Step 1: HMAC_SHA256(BOT_TOKEN, 'WebAppData') computed (this is derivedSecretKey for step 2).");

    // Step 2: result = HMAC_SHA256(data_check_string, derivedSecretKey)
    const finalSigningKey = await webcrypto.subtle.importKey(
      "raw", derivedSecretKey, 
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    logger.log("[API_VALIDATE_HASH_FN_INFO] Step 2: Imported derivedSecretKey for final HMAC operation.");
    
    const computedSignatureBuffer = await webcrypto.subtle.sign(
      "HMAC", finalSigningKey, new TextEncoder().encode(dataCheckString)
    );

    const computedSignatureHex = Array.from(new Uint8Array(computedSignatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    logger.log(`[API_VALIDATE_HASH_FN_INFO] Step 2: Computed final signatureHex: ${computedSignatureHex}`);

    const isStrictlyValid = computedSignatureHex === hashFromClient;
    
    if (BYPASS_VALIDATION_ENV) {
        if (!isStrictlyValid) {
            logger.warn(`[API_VALIDATE_HASH_FN_WARN] HASH MISMATCH! Computed: ${computedSignatureHex}, Received: ${hashFromClient}. VALIDATION IS CURRENTLY BYPASSED DUE TO ENV VAR!`);
        } else {
            logger.info("[API_VALIDATE_HASH_FN_INFO] Hashes MATCHED, but BYPASS is active (informational).");
        }
        // If bypass is active, we consider it valid for the purpose of parsing user, regardless of actual hash match
        logger.warn("[API_VALIDATE_HASH_FN_INFO] BYPASS ACTIVE: Proceeding as if hash is valid.");
        const userParam = params.get("user"); 
        if (userParam) {
            try {
                const user = JSON.parse(decodeURIComponent(userParam));
                logger.info("[API_VALIDATE_HASH_FN_INFO] (Bypass Mode) User data parsed successfully from 'user' param:", {userId: user?.id, username: user?.username});
                return { isValid: true, user }; 
            } catch (e) {
                logger.error("[API_VALIDATE_HASH_FN_ERROR] (Bypass Mode) Error parsing user data from 'user' param:", e);
                return { isValid: true, error: "Bypassed hash, but failed to parse user data." }; 
            }
        } else {
            logger.warn("[API_VALIDATE_HASH_FN_WARN] (Bypass Mode) 'user' parameter missing in initData.");
            return { isValid: true }; // Bypassed hash, no user data to return
        }
    }

    // --- Strict Validation (if BYPASS_VALIDATION_ENV is false) ---
    if (isStrictlyValid) {
      logger.info("[API_VALIDATE_HASH_FN_SUCCESS] Hash validation strictly successful.");
      const userParam = params.get("user"); 
      if (userParam) {
        try {
          const user = JSON.parse(decodeURIComponent(userParam));
          logger.info("[API_VALIDATE_HASH_FN_SUCCESS] User data parsed successfully from 'user' param:", {userId: user?.id, username: user?.username});
          return { isValid: true, user }; 
        } catch (e) {
          logger.error("[API_VALIDATE_HASH_FN_ERROR] Error parsing user data from 'user' param, even though hash was valid:", e);
          // If hash is valid but user parsing fails, it's a data issue, but auth itself was sort of okay.
          // Depending on strictness, this could be isValid: false. For now, let's say hash was ok.
          return { isValid: true, error: "Hash valid, but failed to parse user data." }; 
        }
      } else {
        logger.warn("[API_VALIDATE_HASH_FN_WARN] 'user' parameter missing in initData, but hash is strictly valid.");
        return { isValid: true }; // Hash is okay, but no user data to return
      }
    } else {
      // This block is only reached if NOT strictly valid AND bypass is OFF
      logger.error(`[API_VALIDATE_HASH_FN_ERROR] Hash validation FAILED (Strict Mode). Computed: ${computedSignatureHex}, Received: ${hashFromClient}.`);
      return { isValid: false, error: "Hash mismatch (strict check failed)." };
    }

  } catch (e: any) {
    logger.error("[API_VALIDATE_HASH_FN_ERROR] CRITICAL ERROR during crypto operation or other unexpected issue:", e.message, e.stack);
    return { isValid: false, error: `Crypto error or other failure: ${e.message}` };
  }
}

export async function POST(req: NextRequest) {
  logger.info("[API_VALIDATE_POST_ENTRY] Received POST request to /api/validate-telegram-auth.");
  try {
    const body = await req.json();
    const { initData } = body;
    logger.log("[API_VALIDATE_POST_INFO] Request body parsed. initData (first 60 chars):", typeof initData === 'string' ? initData.substring(0,60) + (initData.length > 60 ? '...' : '') : `Not a string or undefined: ${typeof initData}`);

    if (typeof initData !== "string" || !initData) { // Added !initData check
      logger.warn("[API_VALIDATE_POST_WARN] Invalid request: initData is not a non-empty string or missing.");
      return NextResponse.json({ isValid: false, error: "initData must be a non-empty string and is required." }, { status: 400 });
    }

    if (!BOT_TOKEN) { // Check BOT_TOKEN early in POST handler as well
        logger.error("API_VALIDATE_POST_ERROR: SERVER CRITICAL ERROR - TELEGRAM_BOT_TOKEN is not set. Cannot validate.");
        return NextResponse.json({ isValid: false, error: "Server configuration error: Bot token missing. Cannot validate." }, { status: 500 });
    }
    
    const validationResult = await validateTelegramHash(initData);
    
    if (validationResult.isValid) {
        logger.info(`[API_VALIDATE_POST_SUCCESS] Validation SUCCEEDED (isStrictlyValid or Bypassed). User ID (if present): ${validationResult.user?.id}. Sending success-ish response.`);
    } else {
        logger.warn(`[API_VALIDATE_POST_FAILURE] Validation FAILED (isStrictlyValid=false and Bypass=false). Error: ${validationResult.error}. Sending failure-ish response.`);
    }
    
    // Determine status code:
    // If BYPASS_VALIDATION_ENV is true, always return 200.
    // If BYPASS_VALIDATION_ENV is false, return 200 if validationResult.isValid, else 401.
    const status = BYPASS_VALIDATION_ENV ? 200 : (validationResult.isValid ? 200 : 401);
    logger.log(`[API_VALIDATE_POST_INFO] Determined response status: ${status} (BypassEnv: ${BYPASS_VALIDATION_ENV}, validationResult.isValid: ${validationResult.isValid})`);
    
    return NextResponse.json(validationResult, { status });

  } catch (e: any) { // Catch errors from req.json() or other unexpected issues in POST handler
    logger.error("[API_VALIDATE_POST_ERROR] CRITICAL ERROR processing POST request (e.g., JSON parsing of request body):", e.message, e.stack);
    return NextResponse.json({ isValid: false, error: `Server error during request processing: ${e.message}` }, { status: 500 });
  }
}