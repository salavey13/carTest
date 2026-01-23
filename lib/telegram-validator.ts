import crypto from "crypto";
import { logger } from "@/lib/logger";

type ValidateResult = {
  valid: boolean;
  computedHash: string | null;
  receivedHash: string | null;
  user?: any;
  reason?: string;
};

// 🔥 Normalize user object keys from uppercase to lowercase
function normalizeUserObject(user: any): any {
  if (!user) return user;
  
  // If already lowercase, return as-is
  if (user.id !== undefined) return user;
  
  // Normalize uppercase keys to lowercase
  return {
    id: user.ID,
    first_name: user.FIRST_NAME,
    last_name: user.LAST_NAME,
    username: user.USERNAME,
    language_code: user.LANGUAGE_CODE,
    photo_url: user.PHOTO_URL,
    allows_write_to_pm: user.ALLOWS_WRITE_TO_PM,
    is_premium: user.IS_PREMIUM,
    is_bot: user.IS_BOT,
    added_to_attachment_menu: user.ADDED_TO_ATTACHMENT_MENU
  };
}

// 🔥 FIXED: Normalize user JSON before building data-check-string
function buildDataCheckString(initDataString: string): string {
  const params = new URLSearchParams(initDataString);
  
  // Normalize the user parameter if present
  const userParam = params.get("user");
  if (userParam) {
    try {
      const decodedUser = decodeURIComponent(userParam);
      const userObj = JSON.parse(decodedUser);
      const normalizedUserObj = normalizeUserObject(userObj);
      const normalizedUserStr = JSON.stringify(normalizedUserObj);
      params.set("user", encodeURIComponent(normalizedUserStr));
    } catch (e) {
      logger.warn("[TG-VALIDATOR] Failed to normalize user param", e);
      // Fall back to original if normalization fails
    }
  }
  
  const keys = Array.from(params.keys())
    .filter(k => k !== "hash")
    .sort();
  
  return keys.map(k => `${k}=${params.get(k)}`).join("\n");
}

export async function validateTelegramInitData(
  initDataString: string, 
  botToken: string
): Promise<ValidateResult> {
  logger.info("[TG-VALIDATOR] Starting validation...");
  
  try {
    if (!initDataString) return { valid: false, computedHash: null, receivedHash: null, reason: "empty initData" };
    if (!botToken) return { valid: false, computedHash: null, receivedHash: null, reason: "bot token missing" };

    const params = new URLSearchParams(initDataString);
    const receivedHash = params.get("hash");
    if (!receivedHash) {
      logger.warn("[TG-VALIDATOR] ❌ Missing hash parameter");
      return { valid: false, computedHash: null, receivedHash: null, reason: "hash param missing" };
    }

    // Timestamp check
    const authDateParam = params.get("auth_date");
    const maxAgeSeconds = parseInt(process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS || '86400', 10);
    const currentTime = Math.floor(Date.now() / 1000);
    
    if (authDateParam) {
      const authDate = parseInt(authDateParam, 10);
      const age = currentTime - authDate;
      
      if (age > maxAgeSeconds) {
        logger.warn(`[TG-VALIDATOR] ❌ auth_date expired: ${age}s old (max: ${maxAgeSeconds}s)`);
        return { valid: false, computedHash: null, receivedHash: null, reason: "auth_date expired" };
      }
      logger.log(`[TG-VALIDATOR] auth_date fresh: ${age}s ago`);
    } else {
      logger.warn("[TG-VALIDATOR] ⚠️ auth_date missing from initData");
    }

    logger.log(`[TG-VALIDATOR] Received hash: ${receivedHash.substring(0, 16)}...`);
    const dataCheckString = buildDataCheckString(initDataString);
    logger.log(`[TG-VALIDATOR] Data check string length: ${dataCheckString.length}`);

    // ✅ CORRECT: Mini App algorithm
    const secretKey = crypto.createHmac('sha256', botToken).update('WebAppData').digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    logger.log(`[TG-VALIDATOR] Computed hash: ${computedHash.substring(0, 16)}...`);

    // Timing-safe comparison
    let valid = false;
    try {
      valid = crypto.timingSafeEqual(
        Buffer.from(computedHash, 'hex'),
        Buffer.from(receivedHash, 'hex')
      );
    } catch (e) {
      valid = false;
    }

    // Parse user for return value
    let user = undefined;
    const userParam = params.get("user");
    if (userParam) {
      try {
        const rawUser = JSON.parse(decodeURIComponent(userParam));
        user = normalizeUserObject(rawUser);
        logger.log(`[TG-VALIDATOR] User parsed: ${user.username} (${user.id})`);
      } catch (e) {
        logger.warn("[TG-VALIDATOR] ⚠️ Failed to parse user param", e);
      }
    }

    if (valid) {
      logger.info("[TG-VALIDATOR] ✅ Validation SUCCESS");
    } else {
      logger.warn("[TG-VALIDATOR] ❌ Validation FAILED - Hash mismatch");
    }

    return { 
      valid, 
      computedHash, 
      receivedHash, 
      user, 
      reason: valid ? undefined : "hash mismatch" 
    };
  } catch (e: any) {
    logger.error("[TG-VALIDATOR] 💥 Unexpected error", e);
    return { valid: false, computedHash: null, receivedHash: null, reason: e.message };
  }
}