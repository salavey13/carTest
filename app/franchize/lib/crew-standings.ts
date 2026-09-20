// app/franchize/lib/crew-standings.ts
// ─────────────────────────────────────────────────────────────────────────────
// «Зачёт экипажа» (crew standings) — weekly per-rider score from REAL events.
//
// WHY THIS IS OUR STANDOUT FEATURE (vs Chain): Chain's groups are chats —
// their members never generate verifiable ride events. OUR crews own a real
// fleet: every rental is a real ride by a real rider on a real bike of THIS
// crew. That makes a leaderboard of actual rides something only we can build.
//
// Score (transparent, explainable, no hidden magic):
//   ride (реальный выезд)      ×10  — the hardest, real-world action
//   spot check-in (📍-пост)    ×4   — went somewhere on the bike
//   wall post                  ×3   — brought content to the crew
//   reaction received          ×1   — the crew appreciated it
//
// PRIVACY / MONEY RULE (mirrors rider-profile & bike-wall):
//   · rides counted ONLY for real bikes (cars.type === 'bike') with an
//     earning status (RIDE_EARNING_STATUSES — cancelled/expired never score);
//   · NO ₽ anywhere: total_cost is never selected by the callers, and this
//     lib never reads it;
//   · inputs are PRE-SCOPED by the caller (crew + rolling week) — the lib
//     stays pure and deterministic: same rows in, same standings out.
//
// Tie-break chain (deterministic across pages/renders):
//   score desc → rides desc → reactionsReceived desc → userId asc.
// ─────────────────────────────────────────────────────────────────────────────

export interface CrewStandingsRideRow {
  user_id: string | null;
  status: string | null;
  /** cars.type via the vehicle embed — only 'bike' scores. */
  vehicleType?: string | null;
}

export interface CrewStandingsPostRow {
  author_id: string | null;
  body: string | null;
  /** crew_posts.like_count (numeric or string from the REST layer). */
  like_count?: number | string | null;
}

export interface CrewStandingsEntry {
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  rides: number;
  checkins: number;
  posts: number;
  reactionsReceived: number;
  score: number;
}

export interface CrewStandingsUserRef {
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
}

/** Score weights — single source of truth (tests assert these). */
export const STANDINGS_SCORE = {
  RIDE: 10,
  CHECKIN: 4,
  POST: 3,
  REACTION: 1,
} as const;

/** Hard cap on returned entries (payload budget; NN-crew scale is tens). */
export const STANDINGS_MAX_ENTRIES = 50;
/** Per-post defensive cap for like_count sums (hostile metadata guard). */
const MAX_REACTIONS_PER_POST = 10_000;
/** check-in posts start with this prefix (parity with rider-profile stats). */
const CHECKIN_PREFIX = "📍";

/** Check-in rule mirrored EXACTLY from server-actions/rider-profile.ts. */
export function isCrewStandingsCheckinBody(body: unknown): boolean {
  return typeof body === "string" && body.trimStart().startsWith(CHECKIN_PREFIX);
}

function toSafeCount(value: unknown, max: number): number {
  const n = typeof value === "number" ? value : Number(String(value ?? ""));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.floor(n), max);
}

/**
 * Build the weekly standings from pre-scoped rows.
 *
 * Rows must already be crew-scoped and week-scoped by the caller's queries
 * (`.eq('crew_id', …)` + `.gte(<week field>, weekAgo)`); this function only
 * aggregates, scores, sorts and caps. Riders with any activity but no known
 * user row (deleted profile) are skipped — a leaderboard without names would
 * be noise.
 */
export function computeCrewStandings(
  rides: CrewStandingsRideRow[],
  posts: CrewStandingsPostRow[],
  usersById: Map<string, CrewStandingsUserRef>,
): CrewStandingsEntry[] {
  const acc = new Map<string, { rides: number; checkins: number; posts: number; reactions: number }>();

  const touch = (userId: string) => {
    let row = acc.get(userId);
    if (!row) {
      row = { rides: 0, checkins: 0, posts: 0, reactions: 0 };
      acc.set(userId, row);
    }
    return row;
  };

  for (const r of rides) {
    // Parity with computeRiderStats: cancelled/expired never score, and only
    // real bikes count (equipment/service items would inflate the score).
    if (!r.user_id) continue;
    if (!RIDE_SCORING_STATUSES.has(r.status ?? "")) continue;
    if (r.vehicleType !== "bike") continue;
    touch(r.user_id).rides += 1;
  }

  for (const p of posts) {
    if (!p.author_id) continue;
    const row = touch(p.author_id);
    row.posts += 1;
    if (isCrewStandingsCheckinBody(p.body)) row.checkins += 1;
    row.reactions += toSafeCount(p.like_count, MAX_REACTIONS_PER_POST);
  }

  const entries: CrewStandingsEntry[] = [];
  for (const [userId, row] of acc) {
    const user = usersById.get(userId);
    // Deleted/unknown user rows are skipped: no name → no leaderboard line.
    if (!user) continue;
    entries.push({
      userId,
      fullName: user.fullName ?? null,
      username: user.username ?? null,
      avatarUrl: user.avatarUrl ?? null,
      rides: row.rides,
      checkins: row.checkins,
      posts: row.posts,
      reactionsReceived: row.reactions,
      score:
        row.rides * STANDINGS_SCORE.RIDE +
        row.checkins * STANDINGS_SCORE.CHECKIN +
        row.posts * STANDINGS_SCORE.POST +
        row.reactions * STANDINGS_SCORE.REACTION,
    });
  }

  entries.sort(
    (a, b) =>
      b.score - a.score ||
      b.rides - a.rides ||
      b.reactionsReceived - a.reactionsReceived ||
      (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0),
  );

  return entries.slice(0, STANDINGS_MAX_ENTRIES);
}

/** Local copy for lib purity: lib/community-wall exports the ₽-side variant.
 *  KEEP IN SYNC with RIDE_EARNING_STATUSES (tests assert the parity). */
export const RIDE_SCORING_STATUSES = new Set([
  "completed",
  "active",
  "confirmed",
  "pending_confirmation",
]);

/** Display name for a standings entry (parity with wall author chips). */
export function crewStandingsDisplayName(entry: Pick<CrewStandingsEntry, "fullName" | "username">): string {
  const name = (entry.fullName || entry.username || "").trim();
  return name || "Райдер";
}
