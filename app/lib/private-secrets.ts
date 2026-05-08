"use server";

import "server-only";

import { supabaseAdmin } from "@/lib/supabase-server";

const MAX_SECRET_JSON_BYTES = 256 * 1024;
const RESERVED_JSON_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const FORBIDDEN_CREW_SECRET_KEY_SIGNALS = new Set([
  "password",
  "passphrase",
  "secret",
  "secretkey",
  "token",
  "apikey",
  "credential",
  "credentials",
  "privatekey",
  "clientsecret",
  "pan",
  "cvv",
  "cvc",
  "iban",
  "cardnumber",
  "cardpan",
  "cardtoken",
  "accesstoken",
  "refreshtoken",
]);

type SupabaseSchemaClient = {
  schema: (schema: string) => {
    from: (table: string) => any;
  };
};

export type CrewSensitiveData = {
  contractDefaults: Record<string, unknown>;
  docTemplates: Record<string, unknown>;
};

function privateSchema() {
  return (supabaseAdmin as unknown as SupabaseSchemaClient).schema("private");
}

function normalizePrivateId(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required for private secret access.`);
  }

  return normalized;
}

function parseJsonRecord(raw: unknown): Record<string, unknown> {
  const parsed = (() => {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return raw;
    }

    if (typeof raw !== "string" || raw.trim().length === 0) {
      return null;
    }

    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  })();

  return sanitizeCrewSecretRecordForRead(parsed);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeSecretKeySignal(key: string): string {
  return key.toLowerCase().replace(/[\s_-]+/g, "");
}

function isForbiddenCrewSecretKey(key: string): boolean {
  const signal = normalizeSecretKeySignal(key);
  if (FORBIDDEN_CREW_SECRET_KEY_SIGNALS.has(signal)) return true;
  if (/^(payment|acquiring|merchant).*(credential|credentials|secret|token|key|password)$/.test(signal)) return true;
  return /^(card)(number|pan|token|cvv|cvc)$/.test(signal);
}

function sanitizeCrewSecretValueForRead(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeCrewSecretValueForRead);
  }

  if (isPlainRecord(value)) {
    return sanitizeCrewSecretRecordForRead(value);
  }

  return value;
}

function sanitizeCrewSecretRecordForRead(value: unknown): Record<string, unknown> {
  if (!isPlainRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !RESERVED_JSON_KEYS.has(key) && !isForbiddenCrewSecretKey(key))
      .map(([key, nestedValue]) => [key, sanitizeCrewSecretValueForRead(nestedValue)]),
  );
}

function assertSafeCrewSecretValue(value: unknown, fieldName: string, path: string[]): void {
  const label = `${fieldName}.${path.join(".")}`;

  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    throw new Error(`${label} must be JSON-serializable.`);
  }

  if (typeof value === "bigint") {
    throw new Error(`${label} must not be a bigint.`);
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeCrewSecretValue(item, fieldName, [...path, String(index)]));
    return;
  }

  if (value && typeof value === "object") {
    assertSafeCrewSecretRecord(value, fieldName, path);
  }
}

function assertSafeCrewSecretRecord(value: unknown, fieldName: string, path: string[] = []): asserts value is Record<string, unknown> {
  if (!isPlainRecord(value)) {
    throw new Error(
      path.length
        ? `${fieldName}.${path.join(".")} must be a plain JSON object.`
        : `${fieldName} must be a plain JSON object.`,
    );
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const keyPath = [...path, key];
    if (RESERVED_JSON_KEYS.has(key)) {
      throw new Error(`${fieldName}.${keyPath.join(".")} uses a reserved JSON key.`);
    }

    if (isForbiddenCrewSecretKey(key)) {
      throw new Error(
        `${fieldName}.${keyPath.join(".")} looks like a credential key and must not be stored in crew_secrets.`,
      );
    }

    assertSafeCrewSecretValue(nestedValue, fieldName, keyPath);
  }
}

function serializeCrewSecretRecord(value: Record<string, unknown>, fieldName: string): string {
  assertSafeCrewSecretRecord(value, fieldName);
  const serialized = JSON.stringify(value);
  const byteLength = Buffer.byteLength(serialized, "utf8");

  if (byteLength > MAX_SECRET_JSON_BYTES) {
    throw new Error(`${fieldName} exceeds ${MAX_SECRET_JSON_BYTES} bytes.`);
  }

  return serialized;
}

export async function getUserSensitiveData(userId: string) {
  const normalizedUserId = normalizePrivateId(userId, "userId");
  const { data, error } = await privateSchema()
    .from("user_secrets")
    .select("driver_license, passport")
    .eq("user_id", normalizedUserId)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to read user private data.");
  }

  return {
    driverLicense: data?.driver_license ?? "",
    passport: data?.passport ?? "",
  };
}

export async function saveUserSensitiveData(userId: string, data: {
  driverLicense?: string;
  passport?: string;
}) {
  const normalizedUserId = normalizePrivateId(userId, "userId");
  const { error } = await privateSchema().from("user_secrets").upsert({
    user_id: normalizedUserId,
    driver_license: data.driverLicense,
    passport: data.passport,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error("Failed to save user private data.");
  }
}

// ──────────────────────────────────────────────────────────────
// CREW / FRANCHIZE SECRETS
// Store only server-owned contract defaults and document templates here.
// Payment provider credentials/tokens must stay in deployment secrets or a
// dedicated encrypted vault, never in editable crew JSON blobs.
// ──────────────────────────────────────────────────────────────
export async function getCrewSensitiveData(crewSlug: string): Promise<CrewSensitiveData> {
  const normalizedCrewSlug = normalizePrivateId(crewSlug, "crewSlug");
  const { data, error } = await privateSchema()
    .from("crew_secrets")
    .select("contract_defaults, doc_templates")
    .eq("crew_slug", normalizedCrewSlug)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to read crew private data.");
  }

  return {
    contractDefaults: parseJsonRecord(data?.contract_defaults),
    docTemplates: parseJsonRecord(data?.doc_templates),
  };
}

export async function saveCrewSensitiveData(crewSlug: string, data: {
  contractDefaults?: Record<string, unknown>;
  docTemplates?: Record<string, unknown>;
  // Future public pricing/config inputs should get explicit allowlists before storage.
}) {
  const normalizedCrewSlug = normalizePrivateId(crewSlug, "crewSlug");
  const payload: Record<string, unknown> = {
    crew_slug: normalizedCrewSlug,
    updated_at: new Date().toISOString(),
  };

  if (data.contractDefaults !== undefined) {
    payload.contract_defaults = serializeCrewSecretRecord(data.contractDefaults, "contractDefaults");
  }

  if (data.docTemplates !== undefined) {
    payload.doc_templates = serializeCrewSecretRecord(data.docTemplates, "docTemplates");
  }

  const { error } = await privateSchema().from("crew_secrets").upsert(payload);
  if (error) {
    throw new Error("Failed to save crew private data.");
  }
}
