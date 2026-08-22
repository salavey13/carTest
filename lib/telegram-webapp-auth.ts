import { createHash, createHmac, timingSafeEqual } from "crypto";

export interface TelegramWebAppValidationResult {
  isValid: boolean;
  hashFromClient: string | null;
  computedHash?: string;
  dataCheckString?: string;
  error?: string;
}

export interface TelegramHashDiagnosticVariant {
  id: string;
  label: string;
  matches: boolean;
  computedHash: string;
  dataCheckString: string;
  dataCheckStringLength: number;
  includedFields: string[];
  excludedFields: string[];
  note: string;
}

export interface TelegramHashDiagnostics {
  hashFromClient: string | null;
  receivedFields: string[];
  duplicateFields: string[];
  variants: TelegramHashDiagnosticVariant[];
  notes: string[];
}

type DataCheckStringOptions = {
  excludeFields?: string[];
  includeHash?: boolean;
  preserveInputOrder?: boolean;
};

const OFFICIAL_EXCLUDED_FIELDS = new Set(["hash"]);

function hmacHex(key: string | Buffer, message: string): string {
  return createHmac("sha256", key).update(message).digest("hex");
}

function hmacBuffer(key: string | Buffer, message: string): Buffer {
  return createHmac("sha256", key).update(message).digest();
}

function safeCompareHex(a: string, b: string): boolean {
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b)) return false;
  const aBuffer = Buffer.from(a, "hex");
  const bBuffer = Buffer.from(b, "hex");
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

function getParamEntries(initDataString: string): Array<[string, string]> {
  return Array.from(new URLSearchParams(initDataString).entries());
}

function buildDataCheckStringFromEntries(
  entries: Array<[string, string]>,
  options: DataCheckStringOptions = {},
): { dataCheckString: string; includedFields: string[]; excludedFields: string[] } {
  const excludeFields = new Set(options.excludeFields ?? ["hash"]);
  const filteredEntries = entries.filter(([key]) => {
    if (key === "hash" && options.includeHash) return true;
    return !excludeFields.has(key);
  });
  const orderedEntries = options.preserveInputOrder
    ? filteredEntries
    : [...filteredEntries].sort(([keyA, valueA], [keyB, valueB]) => {
        if (keyA < keyB) return -1;
        if (keyA > keyB) return 1;
        if (valueA < valueB) return -1;
        if (valueA > valueB) return 1;
        return 0;
      });

  const includedFields = orderedEntries.map(([key]) => key);
  const excludedFields = entries
    .map(([key]) => key)
    .filter((key) => !includedFields.includes(key) || (key === "hash" && !options.includeHash));

  return {
    dataCheckString: orderedEntries.map(([key, value]) => `${key}=${value}`).join("\n"),
    includedFields,
    excludedFields: Array.from(new Set(excludedFields)),
  };
}

export function buildTelegramDataCheckString(initDataString: string): { dataCheckString: string; hashFromClient: string | null } {
  const params = new URLSearchParams(initDataString);
  const { dataCheckString } = buildDataCheckStringFromEntries(getParamEntries(initDataString), {
    excludeFields: Array.from(OFFICIAL_EXCLUDED_FIELDS),
  });

  return {
    hashFromClient: params.get("hash"),
    dataCheckString,
  };
}

export async function computeTelegramWebAppHash(initDataString: string, botToken: string): Promise<TelegramWebAppValidationResult> {
  const { dataCheckString, hashFromClient } = buildTelegramDataCheckString(initDataString);

  if (!hashFromClient) {
    return { isValid: false, hashFromClient, dataCheckString, error: "Hash not found in initData." };
  }

  const secret = hmacBuffer("WebAppData", botToken);
  const computedHash = hmacHex(secret, dataCheckString);

  return {
    isValid: safeCompareHex(computedHash, hashFromClient),
    hashFromClient,
    computedHash,
    dataCheckString,
  };
}

export function explainTelegramHashMismatchReasons(): string[] {
  return [
    "Official HMAC path must derive the secret as HMAC-SHA256(key='WebAppData', message=botToken), then sign the sorted data-check-string with that derived binary key.",
    "The data-check-string must exclude hash. The newer Telegram signature field is for third-party Ed25519 validation and should be included in bot-token HMAC validation when Telegram sends it.",
    "Some old snippets incorrectly exclude both hash and signature; if that variant matches, production initData includes signature but our signed field set is wrong.",
    "A common bug is reversing the derivation step: HMAC-SHA256(key=botToken, message='WebAppData').",
    "Another legacy bug is using SHA256(botToken), raw botToken, or raw WebAppData directly as the signing key instead of Telegram's derived secret.",
    "Signing the raw query string, preserving input order, including hash itself, or sorting by encoded bytes instead of decoded key/value pairs changes the digest.",
    "URL decoding differences matter: plus signs, percent-encoded JSON, slash escaping in photo_url, Unicode names, and malformed double-encoding can all alter the data-check-string.",
    "Duplicate query keys are rare but dangerous; validators that call params.get(key) can silently sign the first value only instead of every received pair.",
    "Wrong bot token or wrong bot/environment is the boring killer: prod may be launched by one bot while Vercel signs with another TELEGRAM_BOT_TOKEN.",
    "Auth freshness checks are separate from hash matching, but stale auth_date can look like auth failure if we add max-age enforcement during debugging.",
  ];
}

export function computeTelegramWebAppHashDiagnostics(initDataString: string, botToken: string): TelegramHashDiagnostics {
  const entries = getParamEntries(initDataString);
  const params = new URLSearchParams(initDataString);
  const hashFromClient = params.get("hash");
  const receivedFields = entries.map(([key]) => key);
  const duplicateFields = Array.from(
    receivedFields.reduce((counts, key) => counts.set(key, (counts.get(key) ?? 0) + 1), new Map<string, number>()),
  )
    .filter(([, count]) => count > 1)
    .map(([key]) => key);

  const officialSecret = hmacBuffer("WebAppData", botToken);
  const reversedSecret = hmacBuffer(botToken, "WebAppData");
  const shaTokenSecret = createHash("sha256").update(botToken).digest();

  const variantInputs: Array<{
    id: string;
    label: string;
    secret: string | Buffer;
    options: DataCheckStringOptions;
    note: string;
  }> = [
    {
      id: "official_include_signature_exclude_hash",
      label: "Official bot-token HMAC: include signature, exclude hash",
      secret: officialSecret,
      options: { excludeFields: ["hash"] },
      note: "Expected Telegram Mini App validation path for Telegram.WebApp.initData.",
    },
    {
      id: "legacy_exclude_signature_and_hash",
      label: "Legacy field set: exclude signature and hash",
      secret: officialSecret,
      options: { excludeFields: ["hash", "signature"] },
      note: "Tests whether the third-party Ed25519 signature field was incorrectly removed from the HMAC data-check-string.",
    },
    {
      id: "wrong_reversed_derivation",
      label: "Wrong derivation: key=botToken, message=WebAppData",
      secret: reversedSecret,
      options: { excludeFields: ["hash"] },
      note: "Detects the old/reversed HMAC derivation bug.",
    },
    {
      id: "wrong_direct_bot_token_key",
      label: "Wrong signing key: raw bot token",
      secret: botToken,
      options: { excludeFields: ["hash"] },
      note: "Detects validators that skip Telegram's derived WebAppData secret.",
    },
    {
      id: "wrong_direct_webappdata_key",
      label: "Wrong signing key: raw WebAppData",
      secret: "WebAppData",
      options: { excludeFields: ["hash"] },
      note: "Detects validators that use the constant as the final signing key.",
    },
    {
      id: "wrong_sha256_token_secret",
      label: "Wrong legacy secret: SHA256(botToken)",
      secret: shaTokenSecret,
      options: { excludeFields: ["hash"] },
      note: "Detects old snippets that use SHA256(botToken) as the HMAC secret.",
    },
    {
      id: "wrong_include_hash",
      label: "Wrong field set: include hash in signed string",
      secret: officialSecret,
      options: { includeHash: true, excludeFields: [] },
      note: "Detects accidental inclusion of the client hash in the data-check-string.",
    },
    {
      id: "wrong_preserve_input_order",
      label: "Wrong ordering: preserve input query order",
      secret: officialSecret,
      options: { excludeFields: ["hash"], preserveInputOrder: true },
      note: "Detects validators that forgot lexicographic sorting.",
    },
  ];

  const variants = variantInputs.map(({ id, label, secret, options, note }) => {
    const { dataCheckString, includedFields, excludedFields } = buildDataCheckStringFromEntries(entries, options);
    const computedHash = hmacHex(secret, dataCheckString);
    return {
      id,
      label,
      matches: hashFromClient ? safeCompareHex(computedHash, hashFromClient) : false,
      computedHash,
      dataCheckString,
      dataCheckStringLength: dataCheckString.length,
      includedFields,
      excludedFields,
      note,
    };
  });

  return {
    hashFromClient,
    receivedFields,
    duplicateFields,
    variants,
    notes: explainTelegramHashMismatchReasons(),
  };
}
