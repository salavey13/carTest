import crypto from "crypto";
import { logger } from "@/lib/logger";

type ValidateResult = {
  valid: boolean;
  computedHash: string | null;
  receivedHash: string | null;
  user?: any;
  reason?: string;
};

// 🔥 CRITICAL: Parse without ANY decoding or transformation
function parseQueryStringExact(queryString: string): Map<string, string> {
  const params = new Map<string, string>();
  const pairs = queryString.split('&');
  
  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) continue;
    
    const key = pair.substring(0, eqIndex);
    const value = pair.substring(eqIndex + 1);
    params.set(key, value); // Keep EXACTLY as-is
  }
  return params;
}

export async function validateTelegramInitData(
  initDataString: string, 
  botToken: string
): Promise<ValidateResult> {
  logger.info("[TG-VALIDATOR] Starting validation...");
  
  try {
    if (!initDataString) return { valid: false, reason: "empty initData", computedHash: null, receivedHash: null };
    if (!botToken) return { valid: false, reason: "bot token missing", computedHash: null, receivedHash: null };

    // Parse params WITHOUT any decoding
    const params = parseQueryStringExact(initDataString);
    
    // Extract hash
    let receivedHash = null;
    for (const key of params.keys()) {
      if (key.toLowerCase() === 'hash') {
        receivedHash = params.get(key);
        break;
      }
    }
    
    if (!receivedHash) {
      logger.warn("[TG-VALIDATOR] ❌ Missing hash parameter");
      return { valid: false, reason: "hash param missing", computedHash: null, receivedHash: null };
    }

    // Auth date check (decode only for validation, not for hash)
    let authDateStr = params.get('auth_date') || params.get('AUTH_DATE');
    const maxAgeSeconds = parseInt(process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS || '86400', 10);
    const currentTime = Math.floor(Date.now() / 1000);
    
    if (authDateStr) {
      const authDate = parseInt(authDateStr, 10);
      const age = currentTime - authDate;
      if (age > maxAgeSeconds) {
        logger.warn(`[TG-VALIDATOR] ❌ auth_date expired: ${age}s old (max: ${maxAgeSeconds}s)`);
        return { valid: false, reason: "auth_date expired", computedHash: null, receivedHash: null };
      }
      logger.log(`[TG-VALIDATOR] auth_date fresh: ${age}s ago`);
    }

    // Build data check string with EXACT raw values
    const keys = Array.from(params.keys())
      .filter(key => key.toLowerCase() !== 'hash')
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    
    const dataCheckString = keys.map(key => `${key}=${params.get(key)}`).join('\n');

    logger.log(`[TG-VALIDATOR] Data check string length: ${dataCheckString.length}`);
    logger.log(`[TG-VALIDATOR] Data check string:\n${dataCheckString}`);

    // Compute hash
    const secretKey = crypto.createHmac('sha256', botToken).update('WebAppData').digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    logger.log(`[TG-VALIDATOR] Computed hash: ${computedHash}`);
    logger.log(`[TG-VALIDATOR] Received hash: ${receivedHash}`);

    // Compare
    let valid = false;
    try {
      valid = crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(receivedHash, 'hex'));
    } catch { valid = false; }

    // Parse user for return value (decode only for user object)
    let user = undefined;
    const userParam = params.get('user') || params.get('USER');
    if (userParam) {
      try {
        const decodedUser = decodeURIComponent(userParam);
        const userObj = JSON.parse(decodedUser);
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

    return { valid, computedHash, receivedHash, user, reason: valid ? undefined : "hash mismatch" };
  } catch (e: any) {
    logger.error("[TG-VALIDATOR] 💥 Unexpected error", e);
    return { valid: false, reason: e.message, computedHash: null, receivedHash: null };
  }
}