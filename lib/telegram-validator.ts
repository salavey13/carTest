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
  // Split raw string manually
  const pairs = initDataString.split('&');
  const params = new Map<string, string>();
  let receivedHash = null;

  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split('=');
    const value = valueParts.join('='); // Handle values with =
    
    if (key.toLowerCase() === 'hash') {
      receivedHash = value;
    } else if (key.toLowerCase() === 'signature') {
      // Skip non-standard signature parameter
      continue;
    } else {
      params.set(key, value);
    }
  }

  if (!receivedHash) {
    return { valid: false, reason: "hash missing", computedHash: null, receivedHash: null };
  }

  // Force lowercase keys AND sort alphabetically
  const items = Array.from(params.entries())
    .map(([k, v]) => [k.toLowerCase(), v] as [string, string])
    .sort(([a], [b]) => a.localeCompare(b));
  
  const dataCheckString = items.map(([k, v]) => `${k}=${v}`).join('\n');

  const secretKey = crypto.createHmac('sha256', botToken).update('WebAppData').digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const valid = crypto.timingSafeEqual(
    Buffer.from(computedHash, 'hex'),
    Buffer.from(receivedHash, 'hex')
  );

  return { valid, computedHash, receivedHash, user: null, reason: valid ? undefined : "hash mismatch" };
}