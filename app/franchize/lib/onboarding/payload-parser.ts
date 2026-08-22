/**
 * payload-parser.ts
 * =================
 * Parses structured /start deep-link payloads for the Telegram bot.
 *
 * This module is used by start.ts (server-side) to interpret
 * the payload that comes after /start in a Telegram deep-link.
 *
 * CONVENTION:
 *   New format (structured):  entry.electro  promo.NEON2026  buy.surron  map.groupride
 *   Legacy format (prefix):   ref_ALEX2026   invite:CODE     code-CODE   promo=CODE
 *   Bare format:              VIPSTART
 *
 * DESIGN PRINCIPLE:
 *   The parser produces a ParsedPayload with type + code + hints.
 *   The hints (intentHint, segmentHint) allow the system to
 *   pre-seed personalization BEFORE the survey even starts.
 *
 *   Example: /start entry.electro
 *     → type: "entry", code: "ELECTRO", segmentHint: "electro", intentHint: "explore"
 *
 *   This means even if the user hasn't answered a single survey question,
 *   the landing page can already show electro-focused content.
 *   The survey then REFINES the profile; the payload SEEDS it.
 *
 * TELEGRAM DEEP-LINK FORMAT:
 *   https://t.me/oneBikePlsBot?start=<payload>
 *
 * EXAMPLES IN THE WILD:
 *   https://t.me/oneBikePlsBot?start=entry.electro        → Electro campaign landing
 *   https://t.me/oneBikePlsBot?start=promo.NEON2026       → Promo code NEON2026
 *   https://t.me/oneBikePlsBot?start=buy.surron           → Direct buy intent for Surron
 *   https://t.me/oneBikePlsBot?start=map.groupride        → Community/group rides entry
 *   https://t.me/oneBikePlsBot?start=VIPSTART             → Legacy bare code
 */

import type { ParsedPayload, PayloadType, VipBikeIntent, VipBikeSegment } from "./experience-types";

// ─────────────────────────────────────────────────────
// Structured payload prefix → (type, intent, segment) mapping
// ─────────────────────────────────────────────────────

/**
 * Maps structured prefixes to their payload type and profile hints.
 *
 * IMPORTANT: segmentHint drives WHAT (bike type), intentHint drives WHY.
 * Don't conflate them — "sport" segment doesn't mean "rent" intent.
 * A sport rider could want to buy, rent, or explore.
 */
const STRUCTURED_PREFIX_MAP: Record<
  string,
  { type: PayloadType; intentHint?: VipBikeIntent; segmentHint?: VipBikeSegment }
> = {
  // Entry points — campaign-specific onboarding
  entry:   { type: "entry",  intentHint: "explore",   segmentHint: undefined },
  electro: { type: "entry",  intentHint: "explore",   segmentHint: "electro"  },
  sport:   { type: "entry",  intentHint: "explore",   segmentHint: "sport"    },
  retro:   { type: "entry",  intentHint: "explore",   segmentHint: "retro"    },
  touring: { type: "entry",  intentHint: "explore",   segmentHint: "touring"  },
  urban:   { type: "entry",  intentHint: "explore",   segmentHint: "urban"    },

  // Intent-specific entries — the payload explicitly declares WHY they're here
  buy:     { type: "buy",    intentHint: "buy",       segmentHint: undefined },
  map:     { type: "map",    intentHint: "community", segmentHint: undefined },
  rent:    { type: "entry",  intentHint: "rent",      segmentHint: undefined },
};

// Legacy prefix patterns: "promo=CODE", "ref_CODE", "invite:CODE", "code-CODE"
const LEGACY_PREFIX_RE = /^(promo|ref|invite|code)[:=_-](.+)$/i;

// ─────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────

/**
 * Parses the raw text from a Telegram /start message into a structured payload.
 *
 * Examples:
 *   "/start"               → { type: "bare", code: "", raw: "", command: "/start" }
 *   "/start entry.electro" → { type: "entry", code: "ELECTRO", raw: "entry.electro", command: "/start", segmentHint: "electro", intentHint: "explore" }
 *   "/start promo.NEON26"  → { type: "promo", code: "NEON26", raw: "promo.NEON26", command: "/start" }
 *   "/start ref_ALEX26"    → { type: "ref", code: "ALEX26", raw: "ref_ALEX26", command: "/start" }
 *   "/start VIPSTART"      → { type: "bare", code: "VIPSTART", raw: "VIPSTART", command: "/start" }
 */
export function parseStartPayload(text?: string): ParsedPayload {
  if (!text) return { type: "bare", code: "", raw: "" };

  const trimmed = text.trim();
  if (!trimmed.startsWith("/start")) return { type: "bare", code: "", raw: trimmed };

  const [_cmd, ...rest] = trimmed.split(/\s+/);
  const payload = rest.join(" ").trim();

  if (!payload) return { type: "bare", code: "", raw: "", command: "/start" };

  const parsed = parsePayload(payload);
  return { ...parsed, command: "/start" };
}

/**
 * Parses the payload string (without the /start prefix).
 * This is the core parser — usable both in start.ts and in tests.
 *
 * Priority:
 *   1. Structured dot-notation: "entry.electro", "buy.surron", "promo.NEON26"
 *   2. Legacy prefix patterns:  "ref_ALEX26", "invite:CODE", "code-CODE", "promo=CODE"
 *   3. Bare code:               "VIPSTART", "NEON2026"
 */
export function parsePayload(payload: string): ParsedPayload {
  if (!payload) return { type: "bare", code: "", raw: "" };

  const decoded = decodeURIComponent(payload).trim();

  // 1. Structured dot-notation: "prefix.value"
  const dotIndex = decoded.indexOf(".");
  if (dotIndex > 0 && dotIndex < decoded.length - 1) {
    const prefix = decoded.slice(0, dotIndex).toLowerCase();
    const value = decoded.slice(dotIndex + 1).trim().toUpperCase().slice(0, 64);

    const mapping = STRUCTURED_PREFIX_MAP[prefix];
    if (mapping) {
      return {
        type: mapping.type,
        code: value,
        raw: decoded,
        intentHint: mapping.intentHint,
        segmentHint: mapping.segmentHint,
      };
    }

    // Unknown structured prefix — treat as promo-like
    return {
      type: "promo",
      code: value,
      raw: decoded,
      intentHint: undefined,
      segmentHint: undefined,
    };
  }

  // 2. Legacy prefix patterns: "promo=CODE", "ref_CODE", "invite:CODE", "code-CODE"
  const legacyMatch = decoded.match(LEGACY_PREFIX_RE);
  if (legacyMatch) {
    const legacyType = legacyMatch[1].toLowerCase() as PayloadType;
    const code = legacyMatch[2].trim().toUpperCase().slice(0, 64);
    return {
      type: legacyType,
      code,
      raw: decoded,
    };
  }

  // 3. Bare code
  const normalized = decoded.toUpperCase().slice(0, 64);
  return {
    type: "bare",
    code: normalized,
    raw: decoded,
  };
}

/**
 * Extracts just the promo/referral code from a payload.
 * This is a convenience wrapper for backward compatibility
 * with the existing extractPromoCode() in start.ts.
 *
 * Returns null if no code can be extracted.
 */
export function extractPromoCode(payload: string): string | null {
  const parsed = parsePayload(payload);
  if (!parsed.code) return null;

  // All payload types with a code can be treated as a promo source
  // except "entry" payloads which are campaign markers, not codes.
  if (parsed.type === "entry" || parsed.type === "map" || parsed.type === "buy") {
    // These are intent signals, not promo codes.
    // But we still persist the raw payload for audit.
    return null;
  }

  return parsed.code;
}

// ─────────────────────────────────────────────────────
// Deep-link URL builder
// ─────────────────────────────────────────────────────

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || "oneBikePlsBot";

/**
 * Builds a Telegram deep-link URL for the /start command.
 *
 * Examples:
 *   buildStartLink("entry.electro")       → "https://t.me/oneBikePlsBot?start=entry.electro"
 *   buildStartLink("promo.NEON2026")      → "https://t.me/oneBikePlsBot?start=promo.NEON2026"
 *   buildStartLink(undefined, "onboard")  → "https://t.me/oneBikePlsBot?start=onboard"
 */
export function buildStartLink(payload?: string, fallback = "onboard"): string {
  const encoded = encodeURIComponent(payload || fallback);
  return `https://t.me/${BOT_USERNAME}?start=${encoded}`;
}

/**
 * Pre-built deep-link constants for common use cases.
 * Use these in components instead of hand-coding URLs.
 */
export const START_LINKS = {
  /** Default onboarding entry (generic) */
  onboard: buildStartLink("onboard"),
  /** Electro campaign entry */
  electro: buildStartLink("entry.electro"),
  /** Sport campaign entry */
  sport: buildStartLink("entry.sport"),
  /** Retro/neo-retro campaign entry */
  retro: buildStartLink("entry.retro"),
  /** Map/community entry */
  mapRide: buildStartLink("map.groupride"),
  /** Direct buy intent */
  buy: buildStartLink("buy.bike"),
  /** Build a promo-specific link */
  promo: (code: string) => buildStartLink(`promo.${code}`),
} as const;