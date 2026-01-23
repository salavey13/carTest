import crypto from "crypto";
import { logger } from "@/lib/logger";

type ValidateResult = {
  valid: boolean;
  computedHash: string | null;
  receivedHash: string | null;
  user?: any;
  reason?: string;
};

export async function validateTelegramInitData(
  initDataString: string, 
  botToken: string
): Promise<ValidateResult> {
  logger.info("[TG-VALIDATOR] Starting validation...");
  
  try {
    if (!initDataString) return { valid: false, computedHash: null, receivedHash: null, reason: "empty initData" };
    if (!botToken) return { valid: false, computedHash: null, receivedHash: null, reason: "bot token missing" };

    const params = new URLSearchParams(initDataString);
    
    // Extract hash (case-insensitive)
    let receivedHash = null;
    for (const key of params.keys()) {
      if (key.toLowerCase() === 'hash') {
        receivedHash = params.get(key);
        break;
      }
    }
    
    if (!receivedHash) {
      logger.warn("[TG-VALIDATOR] ❌ Missing hash parameter");
      return { valid: false, computedHash: null, receivedHash: null, reason: "hash param missing" };
    }

    // Auth date check (case-insensitive)
    let authDate = null;
    for (const key of params.keys()) {
      if (key.toLowerCase() === 'auth_date') {
        authDate = parseInt(params.get(key) || '0', 10);
        break;
      }
    }
    
    const maxAgeSeconds = parseInt(process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS || '86400', 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const age = currentTime - authDate;
    
    if (authDate && age > maxAgeSeconds) {
      logger.warn(`[TG-VALIDATOR] ❌ auth_date expired: ${age}s old (max: ${maxAgeSeconds}s)`);
      return { valid: false, computedHash: null, receivedHash: null, reason: "auth_date expired" };
    }
    logger.log(`[TG-VALIDATOR] auth_date fresh: ${age}s ago`);

    // Build data check string WITHOUT modifying params
    const keys = Array.from(params.keys())
      .filter(key => key.toLowerCase() !== 'hash')
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    
    const dataCheckString = keys.map(key => `${key}=${params.get(key)}`).join('\n');

    logger.log(`[TG-VALIDATOR] Data check string length: ${dataCheckString.length}`);
    logger.log(`[TG-VALIDATOR] Data check string:`, dataCheckString);

    // Compute hash
    const secretKey = crypto.createHmac('sha256', botToken).update('WebAppData').digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    logger.log(`[TG-VALIDATOR] Computed hash: ${computedHash.substring(0, 16)}...`);
    logger.log(`[TG-VALIDATOR] Received hash: ${receivedHash.substring(0, 16)}...`);

    // Compare
    let valid = false;
    try {
      valid = crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(receivedHash, 'hex'));
    } catch { valid = false; }

    // Parse user for return value (separate from validation logic)
    let user = undefined;
    const userParam = params.get('user') || params.get('USER');
    if (userParam) {
      try {
        const userObj = JSON.parse(userParam);
        user = {
          id: userObj.ID ?? userObj.id,
          first_name: userObj.FIRST_NAME ?? userObj.first_name,
          last_name: userObj.LAST_NAME ?? userObj.last_name,
          username: userObj.USERNAME ?? userObj.username,
          language_code: userObj.LANGUAGE_CODE ?? userObj.language_code,
          photo_url: userObj.PHOTO_URL ?? userObj.photo_url,
          allows_write_to_pm: userObj.ALLOWS_WRITE_TO_PM ?? userObj.allows_write_to_pm,
        };
        logger.log(`[TG-VALIDATOR] User parsed: ${user.username} (${user.id})`);
      } catch (e) {
        logger.warn("[TG-VALIDATOR] ⚠️ Failed to parse user param", e);
      }
    }

    logger.info(`[TG-VALIDATOR] ${valid ? '✅ Validation SUCCESS' : '❌ Validation FAILED - Hash mismatch'}`);

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