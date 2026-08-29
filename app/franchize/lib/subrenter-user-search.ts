// subrenter-user-search.ts
// ──────────────────────────────────────────────────────────────────────────
// Pure helpers for the subrenter user-picker (iter19).
//
// Assigning a subrenter used to require the partner's RAW numeric Telegram id
// (via @userinfobot). The picker lets the admin search the app's own users
// table instead — by @username, full name or id — and tap the right person.
// These helpers are shared by the server action (bike-subrenter.ts), the
// admin panel UI and tests, so they live OUTSIDE the "use server" file
// (a "use server" module may only export async functions).
//
// NOTE on the PostgREST `or=` expression: values are double-quoted so dots
// and spaces in full names («А. Корнилов») parse correctly; characters that
// would break the disjunction itself (commas, parens, quotes, backslashes)
// are stripped by the sanitizer below before they reach the query.

export interface SubrenterUserCandidate {
  userId: string;
  username: string | null;
  fullName: string | null;
}

/** Shorter queries than this return nothing useful — "R7"-length usernames still pass. */
export const SUBRENTER_USER_SEARCH_MIN_LENGTH = 2;
/** Admin picker only — 10 tappable rows is plenty on a phone screen. */
export const SUBRENTER_USER_SEARCH_LIMIT = 10;

/**
 * Normalize a raw picker query:
 *  - trim + collapse inner whitespace
 *  - strip leading @ (admins naturally type "@K0r_Al")
 *  - remove characters that break the PostgREST `or=(…)` disjunction or its
 *    quoted values (commas, parens, quotes, backslashes) — they never appear
 *    in usernames and add nothing to name searches
 */
export function normalizeSubrenterUserQuery(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^@+/, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f]/g, "")
    .replace(/[(),"'\\]/g, "")
    .slice(0, 60);
}

/**
 * PostgREST `or=` disjunction for the users table: id prefix, username
 * substring and full-name substring in one shot. The caller passes the
 * ALREADY-SANITIZED query (see normalizeSubrenterUserQuery).
 */
export function buildUserSearchOrExpression(sanitizedQuery: string): string {
  const q = sanitizedQuery;
  return `user_id.ilike."${q}*",username.ilike."*${q}*",full_name.ilike."*${q}*"`;
}

/** Lower is better; exact id beats everything, username prefix beats substring. */
export function rankSubrenterUserCandidate(
  user: SubrenterUserCandidate,
  sanitizedQuery: string,
): number {
  const q = sanitizedQuery.toLowerCase();
  if (q && user.userId.toLowerCase() === q) return 0;
  const username = (user.username ?? "").toLowerCase();
  if (username && username.startsWith(q)) return 1;
  if (username.includes(q)) return 2;
  return 3;
}

/**
 * Human label for picker rows and toasts:
 * «Александр Корнилов · @K0r_Al · 425137783» (skips missing parts).
 */
export function buildSubrenterUserLabel(user: {
  userId: string;
  username?: string | null;
  fullName?: string | null;
}): string {
  const name = (user.fullName ?? "").trim();
  const username = (user.username ?? "").trim().replace(/^@+/, "");
  const parts: string[] = [];
  if (name) parts.push(name);
  if (username) parts.push(`@${username}`);
  if (user.userId) parts.push(user.userId);
  return parts.join(" · ");
}

/**
 * iter20: exact-match resolution for free-text assignment input.
 *
 * The MAIN assignment field now accepts @username / full name / id (it used
 * to strip every non-digit — username search was impossible). On save, a
 * non-numeric value is resolved through the search results: an EXACT
 * username match (case-insensitive, @-stripped) or an exact full-name match
 * resolves unambiguously; anything else stays unresolved so the UI can ask
 * the admin to pick from the suggestion list.
 *
 * Returns the resolved candidate or null.
 */
export function findExactSubrenterUserCandidate(
  candidates: SubrenterUserCandidate[],
  rawQuery: string,
): SubrenterUserCandidate | null {
  const q = normalizeSubrenterUserQuery(rawQuery).toLowerCase();
  if (!q) return null;
  const byUsername = candidates.filter(
    (c) => (c.username ?? "").trim().replace(/^@+/, "").toLowerCase() === q,
  );
  if (byUsername.length === 1) return byUsername[0];
  if (byUsername.length > 1) return null; // ambiguous — impossible for usernames, but be safe
  const byFullName = candidates.filter(
    (c) => (c.fullName ?? "").trim().replace(/\s+/g, " ").toLowerCase() === q,
  );
  if (byFullName.length === 1) return byFullName[0];
  return null;
}
