import crypto from "crypto";
import { logger } from "@/lib/logger";

type ValidateResult = {
  valid: boolean;
  computedHash: string | null;
  receivedHash: string | null;
  user?: any;
  reason?: string;
};

const ALLOWED_KEYS = [
  'auth_date', 'can_send_after', 'chat', 'chat_instance', 
  'chat_type', 'query_id', 'start_param', 'user'
];

export async function validateTelegramInitData(
  initDataString: string,
  botToken: string
): Promise<ValidateResult> {
  try {
    if (!initDataString) return { valid: false, reason: "empty initData", computedHash: null, receivedHash: null };
    if (!botToken) return { valid: false, reason: "bot token missing", computedHash: null, receivedHash: null };

    // 1. Parse using URLSearchParams (Decodes values automatically)
    const searchParams = new URLSearchParams(initDataString);

    // 2. Extract the Hash
    const receivedHash = searchParams.get('hash');
    if (!receivedHash) {
      return { valid: false, reason: "hash missing", computedHash: null, receivedHash: null };
    }
    searchParams.delete('hash');

    // 3. Filter: Remove non-standard keys
    const cleanParams = new URLSearchParams();
    for (const [key, value] of searchParams.entries()) {
      if (ALLOWED_KEYS.includes(key)) {
        cleanParams.append(key, value);
      }
    }

    // 4. Sort keys alphabetically
    const sortedKeys = Array.from(cleanParams.keys()).sort();

    // 5. Build Data Check String (Decoded values)
    const dataCheckString = sortedKeys
      .map(key => `${key}=${cleanParams.get(key)}`)
      .join('\n');

    // 6. Compute Secret Key
    const secretKey = crypto
      .createHmac('sha256', botToken.trim())
      .update('WebAppData')
      .digest();

    // 7. Compute Hash
    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // 8. Compare
    const isValid = crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(receivedHash, 'hex')
    );

    // 9. Parse User (Normalize keys in case of uppercase JSON)
    let user = undefined;
    if (isValid) {
      const userStr = cleanParams.get('user');
      if (userStr) {
        try {
          const userObj = JSON.parse(userStr);
          user = {
            id: userObj.id || userObj.ID,
            first_name: userObj.first_name || userObj.FIRST_NAME,
            last_name: userObj.last_name || userObj.LAST_NAME,
            username: userObj.username || userObj.USERNAME,
            language_code: userObj.language_code || userObj.LANGUAGE_CODE,
            photo_url: userObj.photo_url || userObj.PHOTO_URL,
            allows_write_to_pm: userObj.allows_write_to_pm || userObj.ALLOWS_WRITE_TO_PM,
          };
        } catch (e) {}
      }
    }

    return { 
      valid: isValid, 
      computedHash, 
      receivedHash, 
      user, 
      reason: isValid ? undefined : "hash mismatch" 
    };

  } catch (e: any) {
    return { valid: false, reason: e.message, computedHash: null, receivedHash: null };
  }
}