// app/lib/startapp-state.ts
//
// Encode/decode structured state into Telegram WebApp `startapp` parameter.
//
// Use case: bot (Telegram /doc, /buy, etc.) has already collected some data
// from the user (bike, dates, helmet, package), and wants to hand off to
// the web app so it can skip already-done steps and only ask for the
// remaining inputs (e.g. personal info, payment).
//
// Format: `<type>_<base64url(json)>` where type is a short namespace like
// `cart`, `rental`, `sale`. The base64url variant is URL-safe (uses `-` and
// `_` instead of `+` and `/`, and strips padding).
//
// Example: `cart_eyJiaWtlIjoiZmFsY29uLXByby0yMDI1IiwiZGF0ZXMiOns...}`
//
// Limits: Telegram `startapp` param max length is 64 chars after `startapp=`.
// The bot should keep payloads under ~512 bytes of base64 (≈ 380 bytes of
// JSON) to stay well within limits even with long bot usernames.

/** What kind of flow this state belongs to. */
export type StartappStateType = "cart" | "rental" | "sale";

/** Structured state payload — what the bot already knows. */
export interface StartappState {
  /** Discriminator for downstream consumers. */
  type: StartappStateType;
  /** Bike id (matches `cars.id` in Supabase). */
  bikeId: string;
  /** Rental start date (YYYY-MM-DD). */
  startDate?: string;
  /** Rental end date (YYYY-MM-DD). */
  endDate?: string;
  /** Rental start time (HH:MM, 24h). */
  startTime?: string;
  /** Rental end time (HH:MM, 24h). */
  endTime?: string;
  /** Number of helmets requested. */
  helmetCount?: number;
  /** Package tier selected ("Базовый" | "Комфорт" | "Максимум"). */
  package?: string;
  /** Selected perk ("Стандарт" | "Шлем + GoPro" | "Полный комплект"). */
  perk?: string;
  /** For sale: chosen color variant. */
  color?: string;
  /** For sale: chosen trim/option. */
  optionId?: string;
  /** Bot user id that originated this flow (for analytics + claim). */
  botUserId?: number;
  /** Unix-ms timestamp when state was created (TTL checks). */
  ts?: number;
}

/** Prefix used in startapp to flag a state payload. */
export const STARTAPP_STATE_PREFIX = "cart_";

/** Telegram-imposed max length for the startapp query param (64 chars). */
const MAX_TELEGRAM_STARTAPP = 64;

/** Soft cap on the encoded payload to stay within Telegram limits. */
const MAX_ENCODED_LENGTH = 56;

// ─── base64url helpers (browser + node safe) ─────────────────────────────────

function b64UrlEncode(str: string): string {
  // Use Buffer if available (Node); fall back to btoa (browser).
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf-8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64UrlDecode(s: string): string {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const full = padded + "=".repeat(padLen);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(full, "base64").toString("utf-8");
  }
  return decodeURIComponent(escape(atob(full)));
}

// ─── encode / decode ─────────────────────────────────────────────────────────

/**
 * Build a Telegram WebApp startapp value that carries structured state.
 * Returns the string AFTER `startapp=` — caller concatenates.
 *
 * @example
 *   const s = encodeStartappState({ type: "cart", bikeId: "falcon-pro", startDate: "2026-07-15" });
 *   const url = `https://t.me/${bot}/app?startapp=${s}`;
 */
export function encodeStartappState(state: StartappState): string {
  // Always stamp the timestamp so consumers can do TTL checks.
  const payload: StartappState = { ts: Date.now(), ...state };
  const json = JSON.stringify(payload);
  const encoded = b64UrlEncode(json);
  const result = `${STARTAPP_STATE_PREFIX}${encoded}`;

  if (result.length > MAX_ENCODED_LENGTH) {
    // Surface the error rather than silently truncating — caller can decide.
    throw new Error(
      `startapp state too long: ${result.length} chars (max ${MAX_ENCODED_LENGTH}). ` +
        `Drop optional fields or shorten bikeId.`,
    );
  }
  return result;
}

/**
 * Parse a startapp value into structured state.
 * Returns `null` if the value doesn't look like a state payload
 * (different prefix → caller falls through to legacy handlers).
 */
export function decodeStartappState(
  startParam: string | null | undefined,
): StartappState | null {
  if (!startParam || !startParam.startsWith(STARTAPP_STATE_PREFIX)) {
    return null;
  }
  try {
    const json = b64UrlDecode(startParam.slice(STARTAPP_STATE_PREFIX.length));
    const parsed = JSON.parse(json) as StartappState;

    // Sanity check — reject obviously bad payloads.
    if (!parsed || typeof parsed !== "object" || !parsed.bikeId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Build a full deep-link URL for Telegram with structured state.
 * Convenience wrapper around `encodeStartappState`.
 */
export function buildTelegramDeepLink(
  botUsername: string,
  state: StartappState,
): string {
  const param = encodeStartappState(state);
  return `https://t.me/${botUsername}/app?startapp=${param}`;
}

/**
 * TTL check — state older than `maxAgeMs` (default 24h) is considered stale.
 * Bot can re-collect fresh data; web app can show "session expired".
 */
export function isStartappStateFresh(
  state: StartappState,
  maxAgeMs: number = 24 * 60 * 60 * 1000,
): boolean {
  if (!state.ts) return false;
  return Date.now() - state.ts < maxAgeMs;
}
