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
  logger.info("[TG-VALIDATOR] Standard Validation...");

  try {
    if (!initDataString) return { valid: false, reason: "empty initData", computedHash: null, receivedHash: null };
    if (!botToken) return { valid: false, reason: "bot token missing", computedHash: null, receivedHash: null };

    // 1. Clean token (remove accidental whitespace)
    const cleanToken = botToken.trim();

    // 2. Extract Hash and Build Data Check String in one pass
    // We use .split('&') because URLSearchParams automatically DECODES values,
    // which breaks the hash calculation if the client sent URL-encoded values.
    const pairs = initDataString.split('&');
    let receivedHash: string | null = null;
    const dataPairs: string[] = [];

    for (const pair of pairs) {
      const [rawKey, rawValue] = pair.split('=');
      if (!rawKey) continue;

      if (rawKey.toLowerCase() === 'hash') {
        receivedHash = rawValue; // Keep the raw hash value
      } else {
        // We reconstruct the pair EXACTLY as it was received
        // to ensure we match the client's hash input.
        dataPairs.push(`${rawKey}=${rawValue || ''}`);
      }
    }

    if (!receivedHash) {
      return { valid: false, reason: "hash missing", computedHash: null, receivedHash: null };
    }

    // 3. Sort Keys Alphabetically
    // This matches the official spec: "sorted alphabetically"
    // Note: We sort the reconstructed strings "key=value" to handle sorting easily.
    dataPairs.sort((a, b) => {
      const keyA = a.split('=')[0];
      const keyB = b.split('=')[0];
      return keyA.localeCompare(keyB);
    });

    // 4. Join with Newlines
    const dataCheckString = dataPairs.join('\n');

    logger.log(`[TG-VALIDATOR] Data Check String:\n${dataCheckString}`);

    // 5. Create Secret Key
    // secret = HMAC-SHA256(<bot_token>, "WebAppData")
    const secretKey = crypto
      .createHmac('sha256', cleanToken)
      .update('WebAppData')
      .digest();

    // 6. Compute Hash
    // hash = HMAC-SHA256(<secret>, <data_check_string>)
    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    logger.log(`[TG-VALIDATOR] Received: ${receivedHash}`);
    logger.log(`[TG-VALIDATOR] Computed: ${computedHash}`);

    // 7. Compare
    const valid = crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(receivedHash, 'hex')
    );

    if (valid) {
      logger.info("[TG-VALIDATOR] ✅ SUCCESS");
    } else {
      logger.error("[TG-VALIDATOR] ❌ FAILED: Hash mismatch");
    }

    // 8. Parse User (Optional, for return value)
    let user = undefined;
    const userPair = dataPairs.find(p => p.toLowerCase().startsWith('user='));
    if (userPair) {
      try {
        const rawValue = userPair.split('=')[1];
        // Now we decode for usage
        const decodedStr = decodeURIComponent(rawValue);
        const userObj = JSON.parse(decodedStr);
        
        // Handle Uppercase JSON keys from weird clients
        user = {
          id: userObj.id || userObj.ID,
          first_name: userObj.first_name || userObj.FIRST_NAME,
          last_name: userObj.last_name || userObj.LAST_NAME,
          username: userObj.username || userObj.USERNAME,
          language_code: userObj.language_code || userObj.LANGUAGE_CODE,
          allows_write_to_pm: userObj.allows_write_to_pm || userObj.ALLOWS_WRITE_TO_PM,
          photo_url: userObj.photo_url || userObj.PHOTO_URL,
        };
      } catch (e) {
        logger.warn("[TG-VALIDATOR] Failed to parse user JSON", e);
      }
    }

    return { valid, computedHash, receivedHash, user, reason: valid ? undefined : "hash mismatch" };
  } catch (e: any) {
    logger.error("[TG-VALIDATOR] 💥 Critical Error", e);
    return { valid: false, reason: e.message, computedHash: null, receivedHash: null };
  }
}