// app/franchize/lib/blogger-stats.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// Blogger stats (2026-10-06, Task 75) — the self-service configuration of the
// distribution layer built in Task 74.
//
// Boss: «add ability for bloggers configure their stats — metadata handling /
// updates / initialization». Task 74 derived rarity from whatever already sat
// in users.metadata (loose social keys). That left bloggers with NO way to
// declare their real cross-platform audience — the rarity factor sat at 0
// until someone hand-edited the DB. This module defines the CANONICAL slot:
//
//     users.metadata.blogger = {
//       website: string,
//       platforms: { [key]: { handle: string, followers: number | null } },
//       updatedAt: string | null,   // server-stamped on every save
//     }
//
// Design rules (mirroring riderProfiles):
//   · GLOBAL for the user — a blogger's audience does not depend on which
//     crew's wall they posted on (riderProfiles stays per-slug on purpose);
//   · the shape is small and self-describing; the sanitizer collapses ANY
//     hostile/legacy shape into a safe value (never throws);
//   · writes go through saveBloggerStatsAction (owner-only, read-modify-write
//     on the metadata column — the blogger key is the ONLY key touched);
//   · reads are free: discovery's externalAudienceFromUser prefers this
//     bundle and falls back to the legacy loose-key scan.
//
// Pure logic — no React, no Supabase, client-safe (the profile editor and
// the server actions share the exact same sanitize/audience code).
// ─────────────────────────────────────────────────────────────────────────────

// ── limits (mirrored by the zod transport schema in the server action) ──────

export const BLOGGER_HANDLE_MAX_LEN = 80;
export const BLOGGER_WEBSITE_MAX_LEN = 200;
/** Upper sanity bound — the biggest real accounts are ~4×10⁸ followers. */
export const BLOGGER_FOLLOWERS_MAX = 500_000_000;
/** Platforms a blogger can link. Fixed whitelist — arbitrary keys never
 *  survive a sanitize round (no user-supplied key material in metadata). */
export const BLOGGER_PLATFORM_KEYS = [
  "instagram",
  "youtube",
  "telegram",
  "tiktok",
  "vk",
  "dzen",
] as const;

export type BloggerPlatformKey = (typeof BLOGGER_PLATFORM_KEYS)[number];

/** Human label + follower noun (RU plural handled at render time). */
export const BLOGGER_PLATFORMS: ReadonlyArray<{
  key: BloggerPlatformKey;
  label: string;
  followerNoun: [string, string, string];
}> = [
  { key: "instagram", label: "Instagram", followerNoun: ["подписчик", "подписчика", "подписчиков"] },
  { key: "youtube", label: "YouTube", followerNoun: ["подписчик", "подписчика", "подписчиков"] },
  { key: "telegram", label: "Telegram", followerNoun: ["подписчик", "подписчика", "подписчиков"] },
  { key: "tiktok", label: "TikTok", followerNoun: ["подписчик", "подписчика", "подписчиков"] },
  { key: "vk", label: "VK", followerNoun: ["подписчик", "подписчика", "подписчиков"] },
  { key: "dzen", label: "Дзен", followerNoun: ["читатель", "читателя", "читателей"] },
];

export interface BloggerPlatformStats {
  /** @nick, channel name or full URL — public identity on that platform. */
  handle: string;
  /** Self-declared audience size. null = not stated (presence still counts
   *  via the handle); 0 = explicitly declared as zero. */
  followers: number | null;
}

export interface BloggerStats {
  website: string;
  platforms: Record<BloggerPlatformKey, BloggerPlatformStats>;
  /** Server-stamped ISO on every successful save (audit / freshness hint). */
  updatedAt: string | null;
}

function emptyPlatforms(): Record<BloggerPlatformKey, BloggerPlatformStats> {
  return {
    instagram: { handle: "", followers: null },
    youtube: { handle: "", followers: null },
    telegram: { handle: "", followers: null },
    tiktok: { handle: "", followers: null },
    vk: { handle: "", followers: null },
    dzen: { handle: "", followers: null },
  };
}

export const EMPTY_BLOGGER_STATS: BloggerStats = {
  website: "",
  platforms: emptyPlatforms(),
  updatedAt: null,
};

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function cleanFollowers(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/[\s_]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(BLOGGER_FOLLOWERS_MAX, Math.round(n));
}

/**
 * Collapse any hostile/legacy shape into a safe BloggerStats. Never throws —
 * stats are self-declared marketing numbers, garbage degrades to empty.
 * Unknown platform keys are DROPPED (whitelist, not pass-through).
 */
export function sanitizeBloggerStats(raw: unknown): BloggerStats {
  const src = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const platforms = emptyPlatforms();
  const rawPlatforms = typeof src.platforms === "object" && src.platforms !== null && !Array.isArray(src.platforms)
    ? (src.platforms as Record<string, unknown>)
    : {};
  for (const key of BLOGGER_PLATFORM_KEYS) {
    const entry = rawPlatforms[key];
    if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) {
      const e = entry as Record<string, unknown>;
      platforms[key] = { handle: cleanText(e.handle, BLOGGER_HANDLE_MAX_LEN), followers: cleanFollowers(e.followers) };
    } else if (typeof entry === "string") {
      // legacy/compact shape: platforms.instagram = "@nick"
      platforms[key] = { handle: cleanText(entry, BLOGGER_HANDLE_MAX_LEN), followers: null };
    } else if (typeof entry === "number" && Number.isFinite(entry) && entry >= 0) {
      // compact shape: platforms.instagram = 1500 (audience number only)
      platforms[key] = { handle: "", followers: Math.min(BLOGGER_FOLLOWERS_MAX, Math.round(entry)) };
    }
  }
  return {
    website: cleanText(src.website, BLOGGER_WEBSITE_MAX_LEN),
    platforms,
    updatedAt: typeof src.updatedAt === "string" && src.updatedAt.length <= 40 ? src.updatedAt : null,
  };
}

export function isBloggerStatsEmpty(s: BloggerStats): boolean {
  if (s.website) return false;
  for (const key of BLOGGER_PLATFORM_KEYS) {
    if (s.platforms[key].handle) return false;
    if (s.platforms[key].followers != null) return false;
  }
  return true;
}

/**
 * External audience the blogger brings from other platforms — the Task 74
 * rarity factor, now fed by self-declared numbers:
 *   · nothing declared → null (rarity scores on-chain activity only);
 *   · handles/website declared but no numbers → 1 (presence proof);
 *   · otherwise → the LARGEST declared audience (max, not sum — platforms
 *     overlap heavily, summing would double-count the same humans).
 */
export function bloggerStatsExternalAudience(s: BloggerStats): number | null {
  let audience: number | null = null;
  const declarePresence = () => {
    audience = Math.max(audience ?? 0, 1);
  };
  if (s.website) declarePresence();
  for (const key of BLOGGER_PLATFORM_KEYS) {
    const p = s.platforms[key];
    if (p.handle) declarePresence();
    if (p.followers != null && p.followers > 0) {
      audience = Math.max(audience ?? 0, p.followers);
    }
  }
  return audience;
}

/** True when at least one platform handle is a full URL (not a bare nick). */
function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * Public deep link for a configured handle. Accepts "@nick", "nick" or a
 * full URL (used as-is). Returns null when the handle is empty or a URL
 * that fails to parse — the chip renders as text instead of a broken link.
 */
export function bloggerHandleHref(key: BloggerPlatformKey, handle: string): string | null {
  const h = handle.trim();
  if (!h) return null;
  if (isHttpUrl(h)) {
    try {
      const u = new URL(h);
      return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
    } catch {
      return null;
    }
  }
  const nick = h.replace(/^@/, "").replace(/\/+$/, "");
  if (!nick || !/^[\w.\-]{1,64}$/.test(nick)) return null;
  switch (key) {
    case "instagram":
      return `https://instagram.com/${nick}`;
    case "youtube":
      return `https://youtube.com/@${nick}`;
    case "telegram":
      return `https://t.me/${nick}`;
    case "tiktok":
      return `https://tiktok.com/@${nick}`;
    case "vk":
      return `https://vk.com/${nick}`;
    case "dzen":
      return `https://dzen.ru/${nick}`;
  }
}

/** website → safe href (null → render as text, never a javascript: URL). */
export function bloggerWebsiteHref(website: string): string | null {
  const w = website.trim();
  if (!w) return null;
  const withProto = isHttpUrl(w) ? w : `https://${w}`;
  try {
    const u = new URL(withProto);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Compact RU audience label — «12 000», «1,2 млн» for the popup chips. */
export function formatBloggerAudience(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 10 ? Math.round(m) : Math.round(m * 10) / 10} млн`.replace(".", ",");
  }
  if (n >= 10_000) {
    const k = n / 1000;
    return `${Math.round(k)} тыс.`;
  }
  return n.toLocaleString("ru-RU");
}

// ── metadata reader (moved here from the discovery loader, Task 75) ─────────
// The loader is server-only (imports supabaseAdmin) — vitest cannot import
// it, so the reader lives in this pure module next to the canonical shape it
// reads. The loader re-exports it unchanged (same export surface, same tests
// contract).

/** Keys that may carry a cross-platform audience in users.metadata —
 *  top-level or one bundle deep. Grows as bloggers link more platforms. */
const SOCIAL_AUDIENCE_KEY_RE =
  /^(instagram|youtube|telegram|tiktok|vk|dzen|audience|followers|subscribers|external_audience|social_audience)$/i;
const AUDIENCE_NUMBER_KEY_RE = /(follower|subscriber|audience)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * External audience of a blogger — the 2026-10-05 rarity factor: «factor in
 * the rarity of the blogger in case some additional audience is present on
 * other platforms».
 *
 * Read order (Task 75):
 *   1. CANONICAL bundle users.metadata.blogger (self-declared via the rider
 *      profile editor — sanitizeBloggerStats + bloggerStatsExternalAudience);
 *   2. LEGACY fallback — users.website (declared presence → 1) and numeric
 *      audience values in users.metadata (top level or one bundle deep,
 *      e.g. instagram: { followers: 1200 }).
 * Returns: null = presence unknown; ≥1 = audience size / declared presence.
 */
export function externalAudienceFromUser(
  row: { website: string | null; metadata: unknown } | undefined,
): number | null {
  if (!row) return null;
  const meta = isRecord(row.metadata) ? row.metadata : {};
  // 1. Canonical self-declared bundle — wins whenever the blogger actually
  //    configured their stats (exact numbers beat heuristic key scanning).
  if ("blogger" in meta) {
    const bundle = sanitizeBloggerStats(meta.blogger);
    if (!isBloggerStatsEmpty(bundle)) return bloggerStatsExternalAudience(bundle);
  }
  // 2. Legacy loose-key scan (unchanged) — pre-Task-75 metadata keeps working.
  let audience: number | null = (row.website ?? "").trim() ? 1 : null;
  const bump = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      audience = Math.max(audience ?? 0, Math.round(value));
    }
  };
  for (const [key, value] of Object.entries(meta)) {
    if (SOCIAL_AUDIENCE_KEY_RE.test(key)) {
      bump(value);
      if (isRecord(value)) {
        for (const [subKey, subValue] of Object.entries(value)) {
          if (AUDIENCE_NUMBER_KEY_RE.test(subKey)) bump(subValue);
        }
      } else if (typeof value === "string" && value.trim()) {
        // declared presence without numbers
        audience = Math.max(audience ?? 0, 1);
      }
    } else if (isRecord(value)) {
      // one bundle deeper (settings/socials objects) — the keys still count
      for (const [subKey, subValue] of Object.entries(value)) {
        if (SOCIAL_AUDIENCE_KEY_RE.test(subKey)) {
          bump(subValue);
          if (isRecord(subValue)) {
            for (const [deepKey, deepValue] of Object.entries(subValue)) {
              if (AUDIENCE_NUMBER_KEY_RE.test(deepKey)) bump(deepValue);
            }
          }
        }
      }
    }
  }
  return audience;
}
