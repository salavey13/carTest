// /app/franchize/lib/storage-config.ts
// ─────────────────────────────────────────────────────────────────────────────
// «Зимнее хранение» — per-crew configuration (admin/crewowner config, 2026-09-27).
//
// Where it lives: crews.metadata.franchize.storage — written by the config
// editor (saveFranchizeConfig → actions-runtime.ts, «Зимнее хранение» section)
// or by the bot skill script. This module is the PURE read/resolve side shared
// by pages, the wall client, the order form and the catalog modal.
//
// Legacy rule: crews without a storage block keep the pre-config behaviour —
// the service exists only for vip-bike (that's how it shipped in 04615d0),
// with the Стригинский переулок, 13Б place and the 2 000 ₽/мес entry price.
// A crew CAN opt in/out explicitly: storage.enabled wins over the legacy slug
// check, so any crew may enable the same flow from the editor.
//
// PURE ONLY — no supabase, no "use client", no server imports: vitest and
// client components both consume this file.
// ─────────────────────────────────────────────────────────────────────────────

export interface StorageCrewConfig {
  /** Header link + catalog pill + wall/checkout availability. */
  enabled: boolean;
  /** Physical storage place («Стригинский переулок, 13Б»). */
  address: string;
  /** Entry price the offer/form pre-fill (staff confirms the final rate). */
  defaultMonthlyPriceRub: number;
  /** Season defaults for the order form, MM-DD strings ("10-15" → "06-01"). */
  seasonStartMMDD: string;
  seasonEndMMDD: string;
  /** What the keeper does during the season (offer views). */
  careDuties: string[];
}

export const DEFAULT_STORAGE_ADDRESS = "Стригинский переулок, 13Б";
export const DEFAULT_STORAGE_MONTHLY_PRICE_RUB = 2000;
/** vip-bike shipped with this season (contract п. 2.1: 15 октября → 1 июня). */
export const DEFAULT_STORAGE_SEASON_START_MMDD = "10-15";
export const DEFAULT_STORAGE_SEASON_END_MMDD = "06-01";

/** Mirrors WinterStorageModal CARE_POINTS / the contract's п. 4.1.3–4.1.4. */
export const DEFAULT_STORAGE_CARE_DUTIES: string[] = [
  "Крытое помещение с ограниченным доступом",
  "Отключение и периодическая подзарядка аккумулятора",
  "Контроль давления в шинах, смещение точки контакта",
  "Укрытие чехлом и защита от грызунов",
  "Ежемесячный осмотр, фотоотчёт — по запросу",
  "Ответственность Хранителя в размере оценочной стоимости",
];

const MMDD_RE = /^\d{2}-\d{2}$/;

type UnknownRecord2 = Record<string, unknown>;

function readPath<T>(obj: unknown, path: string[], fallback: T): T {
  let current: unknown = obj;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return fallback;
    }
    current = (current as UnknownRecord2)[key];
  }
  return (current as T) ?? fallback;
}

/** "10-15" → { month: 10, day: 15 }; null when the string is not MM-DD. */
export function parseStorageMMDD(raw: unknown): { month: number; day: number } | null {
  const value = String(raw ?? "").trim();
  if (!MMDD_RE.test(value)) return null;
  const [m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { month: m, day: d };
}

function sanitizeAddress(raw: unknown): string {
  return String(raw ?? "").replace(/\s*[\r\n]+\s*/g, " ").trim().slice(0, 300);
}

function sanitizeCareDuties(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const list = raw
    .map((item) => String(item ?? "").replace(/\s*[\r\n]+\s*/g, " ").trim())
    .filter((item) => item.length > 0 && item.length <= 300)
    .slice(0, 12);
  return list;
}

export interface ResolveStorageConfigOptions {
  /**
   * The crew's DEFAULT address from metadata (contacts.address chain:
   * `franchize.contacts.address` → `footer.address` → `hq_location`, or the
   * private contractDefaults.return_address). It wins over the legacy
   * Стригинский hardcode when `storage.address` is not configured — vip-bike
   * moved to пл. Комсомольская 2, so the contract must follow the crew
   * metadata instead of a frozen literal (boss nuance 1, 2026-09-29).
   */
  fallbackAddress?: string;
}

/**
 * Resolve the per-crew storage config from the hydrated `franchize` record
 * (the SAME record actions-runtime passes to resolveFranchizeTheme — i.e.
 * `metadata.franchize ?? metadata`, NOT the whole metadata).
 *
 * Explicit storage.enabled always wins (boolean or "true"/"false" string for
 * hand-edited metadata); when the key is ABSENT the legacy pre-config rule
 * applies — vip-bike only — so a partial block can never silently disable
 * the service.
 *
 * Address priority: `storage.address` (special metadata field, config editor)
 * → `opts.fallbackAddress` (the crew's default address from metadata)
 * → DEFAULT_STORAGE_ADDRESS (legacy vip-bike literal, last resort only).
 */
export function resolveStorageConfig(
  franchize: unknown,
  slug: string,
  opts?: ResolveStorageConfigOptions,
): StorageCrewConfig {
  const crewSlug = String(slug ?? "").trim();
  const storage = readPath<UnknownRecord2>(franchize, ["storage"], {});

  const enabledRaw = readPath(storage, ["enabled"], undefined);
  const enabled =
    typeof enabledRaw === "boolean"
      ? enabledRaw
      : enabledRaw === "true" || enabledRaw === "false" // hand-edited metadata strings
        ? enabledRaw === "true"
        : // enabled key ABSENT → keep the legacy slug rule (an empty or
          // partial block must not silently disable vip-bike's service)
          crewSlug === "vip-bike";

  const priceRaw = Number(readPath(storage, ["defaultMonthlyPriceRub"], 0));

  const seasonStart = parseStorageMMDD(readPath(storage, ["seasonStart"], DEFAULT_STORAGE_SEASON_START_MMDD))
    ? String(readPath(storage, ["seasonStart"], DEFAULT_STORAGE_SEASON_START_MMDD)).trim()
    : DEFAULT_STORAGE_SEASON_START_MMDD;
  const seasonEnd = parseStorageMMDD(readPath(storage, ["seasonEnd"], DEFAULT_STORAGE_SEASON_END_MMDD))
    ? String(readPath(storage, ["seasonEnd"], DEFAULT_STORAGE_SEASON_END_MMDD)).trim()
    : DEFAULT_STORAGE_SEASON_END_MMDD;

  return {
    enabled: Boolean(enabled),
    address:
      sanitizeAddress(readPath(storage, ["address"], ""))
      || sanitizeAddress(opts?.fallbackAddress)
      || DEFAULT_STORAGE_ADDRESS,
    defaultMonthlyPriceRub:
      Number.isFinite(priceRaw) && priceRaw > 0 ? Math.round(priceRaw) : DEFAULT_STORAGE_MONTHLY_PRICE_RUB,
    seasonStartMMDD: seasonStart,
    seasonEndMMDD: seasonEnd,
    careDuties: (() => {
      const list = sanitizeCareDuties(readPath(storage, ["careDuties"], []));
      return list.length > 0 ? list : DEFAULT_STORAGE_CARE_DUTIES;
    })(),
  };
}
