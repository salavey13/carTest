// lib/wall-deeplink.ts
// ─────────────────────────────────────────────────────────────────────────────
// Pure parse/build for OnlyBike wall startapp deep links. Shared by:
//   · hooks/useStartParamRouter.ts (client routing — including the FAST path
//     that routes BEFORE Telegram auth finishes, see the router header),
//   · wall notify libs (buttons on TG notifications),
//   · the community wall «Поделиться» button.
//
// Grammar (startapp param, max ~64–512 chars — these stay ≤ 64):
//   wall                    → own crew's wall (router falls back to userCrewInfo)
//   wall_<slug>             → that crew's wall
//   post_<postId>           → post on own crew's wall (gated fallback)
//   post_<postId>_<slug>    → post on that crew's wall (the share format)
//   wallp_<rentalId>_<slug> → open the wall composer prefilled from a finished
//                             rental («поделиться поездкой» from the closure
//                             notification; renters can post too)
//   ride_<sessionId>_<slug> → open the wall composer prefilled from a finished
//                             map-riders session (share ride stats → wall post;
//                             interlink map-riders ↔ wall, Chain-style)
//   rider_<userId>_<slug>   → public rider profile page (Chain-style profile
//                             card: stats, badges, garage, the user's part of
//                             the wall). userId is the Telegram numeric id
//                             (users.user_id, digits only) — NO bare fallback:
//                             the profile is crew-scoped, slug required.
//
// postId / rentalId are Postgres uuids (8-4-4-4-12 hex, hyphen-separated);
// map-riders session ids are uuids too (gen_random_uuid).
// slugs match [A-Za-z0-9_-]+ and contain no underscores is NOT guaranteed —
// crew slugs CAN contain underscores, so trailing segments after the FIRST
// underscore belong to the slug (we split on the first "_" only and sanitize
// the rest). That is why the id always comes first.
// ─────────────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function isUuidLike(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/** Slug charset guard — strips anything that could smuggle a path/query. */
export function sanitizeWallSlug(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  return SLUG_RE.test(s) ? s : null;
}

export type WallDeepLink =
  | { kind: "wall"; slug: string | null }
  | { kind: "post"; postId: string; slug: string | null }
  | { kind: "compose"; rentalId: string; slug: string }
  | { kind: "compose-ride"; sessionId: string; slug: string }
  | { kind: "rider"; userId: string; slug: string }
  | { kind: "join"; slug: string };

/** TG user ids are pure digits (users.user_id / chat id). */
const RIDER_ID_RE = /^[0-9]{1,16}$/;

/**
 * Parse a startapp param into a wall deep link.
 * Returns null for non-wall params (caller falls through to other handlers).
 * `slug === null` means "resolver must fall back to the viewer's own crew".
 */
export function parseWallDeepLink(param: string | null | undefined): WallDeepLink | null {
  const p = (param ?? "").trim();
  if (!p) return null;

  if (p === "wall") return { kind: "wall", slug: null };

  if (p.startsWith("wall_")) {
    const slug = sanitizeWallSlug(p.slice(5));
    // wall_ with a garbage slug degrades to "own crew" instead of dead-ending.
    return { kind: "wall", slug };
  }

  if (p.startsWith("wallp_")) {
    // wallp_<rentalId>_<slug>
    const rest = p.slice(6);
    const sep = rest.indexOf("_");
    if (sep <= 0) return null;
    const rentalId = rest.slice(0, sep);
    const slug = sanitizeWallSlug(rest.slice(sep + 1));
    if (!isUuidLike(rentalId) || !slug) return null;
    return { kind: "compose", rentalId, slug };
  }

  if (p.startsWith("ride_")) {
    // ride_<sessionId>_<slug> — map-riders session → wall composer.
    // No bare fallback (same as wallp_): the slug is required to route.
    const rest = p.slice(5);
    const sep = rest.indexOf("_");
    if (sep <= 0) return null;
    const sessionId = rest.slice(0, sep);
    const slug = sanitizeWallSlug(rest.slice(sep + 1));
    if (!isUuidLike(sessionId) || !slug) return null;
    return { kind: "compose-ride", sessionId, slug };
  }

  if (p.startsWith("rider_")) {
    // rider_<userId>_<slug> — public rider profile. Digits-first split (the
    // id has no underscores of its own), slug required — same contract as
    // wallp_/ride_: a wrong-crew landing is harmless, the profile page
    // re-verifies the rider ∈ crew server-side and renders a soft fallback.
    const rest = p.slice(6);
    const sep = rest.indexOf("_");
    if (sep <= 0) return null;
    const userId = rest.slice(0, sep);
    const slug = sanitizeWallSlug(rest.slice(sep + 1));
    if (!RIDER_ID_RE.test(userId) || !slug) return null;
    return { kind: "rider", userId, slug };
  }

  if (p.startsWith("join_")) {
    // join_<slug> — crew invite (admin → future crew owner): the invitee
    // lands on the crew page with ?join_crew=true and auto-joins as MEMBER
    // (JoinCrewBanner); an admin promotes them to owner later. No bare
    // fallback: an invite is always for a concrete crew, garbage → null.
    const slug = sanitizeWallSlug(p.slice(5));
    if (!slug) return null;
    return { kind: "join", slug };
  }

  if (p.startsWith("post_")) {
    // post_<postId>_<slug> (share format) or bare post_<postId>.
    const rest = p.slice(5);
    const sep = rest.indexOf("_");
    if (sep > 0) {
      const postId = rest.slice(0, sep);
      const slug = sanitizeWallSlug(rest.slice(sep + 1));
      if (isUuidLike(postId)) return { kind: "post", postId, slug };
      return null;
    }
    if (isUuidLike(rest)) return { kind: "post", postId: rest, slug: null };
    return null;
  }

  // Alias «<slug>_community» (crew-id_community) → the same wall destination
  // as wall_<slug>. Checked LAST: fixed prefixes above win, so this suffix
  // can never hijack a parameterised form. Garbage slug → null (no route).
  if (p.endsWith("_community")) {
    const slug = sanitizeWallSlug(p.slice(0, -"_community".length));
    if (slug) return { kind: "wall", slug };
  }

  return null;
}

// ── Builders (the notify side + share button) ────────────────────────────────

/**
 * Telegram `startapp` budget: keep the WHOLE param ≤ 64 chars. Slugs that do
 * not fit are DROPPED (not truncated) — a truncated slug would fast-route to
 * /franchize/<wrong-slug>/community (empty shell wall), while the bare form
 * (`post_<id>` / `wall`) degrades to the viewer's-crew fallback, which is
 * correct for the renter/member who usually taps these links.
 */
function budgetedSlug(slug: string, reserved: number): string {
  const s = sanitizeWallSlug(slug) ?? "";
  const budget = 64 - reserved;
  return s.length > 0 && s.length <= budget ? s : "";
}

export function wallStartParam(slug: string): string {
  const s = budgetedSlug(slug, 5);
  return s ? `wall_${s}` : "wall";
}

export function wallPostStartParam(postId: string, slug: string): string {
  const id = postId.trim();
  if (!isUuidLike(id)) throw new Error(`wallPostStartParam: postId is not a uuid: ${id}`);
  const s = budgetedSlug(slug, 5 + 36 + 1);
  return s ? `post_${id}_${s}` : `post_${id}`;
}

export function wallComposeStartParam(rentalId: string, slug: string): string {
  const id = rentalId.trim();
  if (!isUuidLike(id)) throw new Error(`wallComposeStartParam: rentalId is not a uuid: ${id}`);
  // wallp_ has NO bare fallback (the parser requires a slug to route). Over-
  // budget or invalid slugs truncate to a VALID prefix instead: slugs that
  // long are theoretical (21 chars covers every real crew), and a wrong-crew
  // landing is harmless — the draft action re-verifies rental ∈ crew server-
  // side and the composer surfaces the error as a wall notice.
  const budget = 64 - 6 - 36 - 1;
  const s = sanitizeWallSlug(slug) ?? "vip-bike";
  return `wallp_${id}_${s.slice(0, Math.max(1, budget))}`;
}

/** rider_<userId>_<slug> start param for the public rider profile page.
 *  No bare fallback (the page is crew-scoped); over-budget slugs truncate to
 *  a valid prefix — wrong-crew landing degrades to a soft fallback card. */
export function riderProfileStartParam(userId: string, slug: string): string {
  const id = userId.trim();
  if (!RIDER_ID_RE.test(id)) throw new Error(`riderProfileStartParam: userId is not a TG numeric id: ${id}`);
  const budget = 64 - 6 - id.length - 1;
  const s = sanitizeWallSlug(slug) ?? "vip-bike";
  return `rider_${id}_${s.slice(0, Math.max(1, budget))}`;
}

/** join_<slug> start param — crew invite link (admin → future owner).
 *  Slug is required and budget-truncated (same rationale as wallp_). */
export function crewJoinStartParam(slug: string): string {
  const s = sanitizeWallSlug(slug);
  if (!s) throw new Error(`crewJoinStartParam: invalid crew slug: ${slug}`);
  const budget = 64 - 5;
  return `join_${s.slice(0, Math.max(1, budget))}`;
}

export function wallRideStartParam(sessionId: string, slug: string): string {
  const id = sessionId.trim();
  if (!isUuidLike(id)) throw new Error(`wallRideStartParam: sessionId is not a uuid: ${id}`);
  // ride_ mirrors wallp_: no bare fallback, slug truncated to the valid budget.
  const budget = 64 - 5 - 36 - 1;
  const s = sanitizeWallSlug(slug) ?? "vip-bike";
  return `ride_${id}_${s.slice(0, Math.max(1, budget))}`;
}

/** https://t.me/<bot>/app?startapp=<param> — opens the Mini App on the spot. */
export function buildTelegramAppLink(botUsername: string, startParam: string): string {
  const bot = botUsername.replace(/^@/, "").trim();
  return `https://t.me/${bot}/app?startapp=${startParam}`;
}
