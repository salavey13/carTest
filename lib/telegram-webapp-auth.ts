import { webcrypto } from "crypto";

export interface TelegramWebAppValidationResult {
  isValid: boolean;
  hashFromClient: string | null;
  computedHash?: string;
  dataCheckString?: string;
  error?: string;
}

export function buildTelegramDataCheckString(initDataString: string): { dataCheckString: string; hashFromClient: string | null } {
  const params = new URLSearchParams(initDataString);
  const hashFromClient = params.get("hash");
  const keys = Array.from(params.keys())
    .filter((key) => key !== "hash" && key !== "signature")
    .sort();

  return {
    hashFromClient,
    dataCheckString: keys.map((key) => `${key}=${params.get(key)}`).join("\n"),
  };
}

export async function computeTelegramWebAppHash(initDataString: string, botToken: string): Promise<TelegramWebAppValidationResult> {
  const { dataCheckString, hashFromClient } = buildTelegramDataCheckString(initDataString);

  if (!hashFromClient) {
    return { isValid: false, hashFromClient, dataCheckString, error: "Hash not found in initData." };
  }

  const secretKey = await webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const derivedKeyBuffer = await webcrypto.subtle.sign("HMAC", secretKey, new TextEncoder().encode(botToken));
  const derivedKey = await webcrypto.subtle.importKey(
    "raw",
    derivedKeyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await webcrypto.subtle.sign("HMAC", derivedKey, new TextEncoder().encode(dataCheckString));
  const computedHash = Array.from(new Uint8Array(signatureBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return {
    isValid: computedHash === hashFromClient,
    hashFromClient,
    computedHash,
    dataCheckString,
  };
}
