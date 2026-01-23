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
    if (!initDataString) return { valid: false, reason: "empty initData", computedHash: null, receivedHash: null };
    if (!botToken) return { valid: false, reason: "bot token missing", computedHash: null, receivedHash: null };

    // 1. Split raw pairs
    const pairs = initDataString.split('&');
    
    // 2. Parse and Filter
    // We keep the ORIGINAL CASE of keys (e.g., AUTH_DATE stays AUTH_DATE)
    // We only remove 'hash' (case-insensitive check)
    const sortedData = pairs
      .map(pair => {
        const eqIndex = pair.indexOf('=');
        if (eqIndex === -1) return null;
        const key = pair.substring(0, eqIndex); // 🔥 KEEP ORIGINAL CASE
        const value = pair.substring(eqIndex + 1);
        return { key, value };
      })
      .filter(item => {
        if (!item) return false;
        // Remove hash, signature, sign (Case Insensitive removal)
        if (item.key.toLowerCase() === 'hash' || 
            item.key.toLowerCase() === 'signature' || 
            item.key.toLowerCase() === 'sign') {
          return false;
        }
        return true;
      }) as { key: string, value: string }[];

    // 3. Sort alphabetically (Standard String Sort - respects case)
    sortedData.sort((a, b) => a.key.localeCompare(b.key));

    // 4. Build string
    const dataCheckString = sortedData.map(item => `${item.key}=${item.value}`).join('\n');

    logger.log(`[TG-VALIDATOR] Data Check String:\n${dataCheckString}`);

    // 5. Validate Date
    const authDateItem = sortedData.find(item => item.key.toLowerCase() === 'auth_date');
    if (authDateItem) {
      try {
        const authDate = parseInt(decodeURIComponent(authDateItem.value), 10);
        const maxAgeSeconds = parseInt(process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS || '86400', 10);
        const currentTime = Math.floor(Date.now() / 1000);
        const age = currentTime - authDate;
        
        if (age > maxAgeSeconds) {
          return { valid: false, reason: "auth_date expired", computedHash: null, receivedHash: null };
        }
        logger.log(`[TG-VALIDATOR] ✅ auth_date valid: ${age}s ago`);
      } catch (e) {
        logger.warn("[TG-VALIDATOR] ⚠️ Could not parse auth_date");
      }
    }

    // 6. Extract Received Hash (Case Insensitive lookup)
    const receivedHashItem = pairs.find(p => p.toLowerCase().startsWith('hash='));
    const receivedHashValue = receivedHashItem ? receivedHashItem.split('=')[1] : null;

    if (!receivedHashValue) {
      return { valid: false, reason: "hash param missing", computedHash: null, receivedHash: null };
    }

    // 7. Compute Hash
    const secretKey = crypto.createHmac('sha256', botToken).update('WebAppData').digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    logger.log(`[TG-VALIDATOR] Computed: ${computedHash}`);
    logger.log(`[TG-VALIDATOR] Received: ${receivedHashValue}`);

    // 8. Compare
    let valid = false;
    try {
      valid = crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(receivedHashValue, 'hex'));
    } catch { valid = false; }

    // 9. Parse User
    let user = undefined;
    const userItem = sortedData.find(item => item.key.toLowerCase() === 'user');
    if (userItem) {
      try {
        const decodedUserStr = decodeURIComponent(userItem.value);
        const userObj = JSON.parse(decodedUserStr);
        
        user = {
          id: userObj.id || userObj.ID,
          first_name: userObj.first_name || userObj.FIRST_NAME,
          last_name: userObj.last_name || userObj.LAST_NAME,
          username: userObj.username || userObj.USERNAME,
          language_code: userObj.language_code || userObj.LANGUAGE_CODE,
          allows_write_to_pm: userObj.allows_write_to_pm || userObj.ALLOWS_WRITE_TO_PM,
        };
        logger.log(`[TG-VALIDATOR] User: ${user.username} (${user.id})`);
      } catch (e) {
        logger.warn("[TG-VALIDATOR] Failed to parse user", e);
      }
    }

    logger.info(`[TG-VALIDATOR] ${valid ? '✅ SUCCESS' : '❌ FAILED'}`);

    return { valid, computedHash, receivedHash: receivedHashValue, user, reason: valid ? undefined : "hash mismatch" };
  } catch (e: any) {
    logger.error("[TG-VALIDATOR] 💥 Error", e);
    return { valid: false, reason: e.message, computedHash: null, receivedHash: null };
  }
}