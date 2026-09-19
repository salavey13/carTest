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
//
// postId / rentalId are Postgres uuids (8-4-4-4-12 hex, hyphen-separated);
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
  | { kind: "compose"; rentalId: string; slug: string };

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

  return null;
}

// ── Builders (the notify side + share button) ────────────────────────────────

export function wallStartParam(slug: string): string {
  return `wall_${sanitizeWallSlug(slug) ?? "vip-bike"}`;
}

export function wallPostStartParam(postId: string, slug: string): string {
  const id = postId.trim();
  if (!isUuidLike(id)) throw new Error(`wallPostStartParam: postId is not a uuid: ${id}`);
  return `post_${id}_${sanitizeWallSlug(slug) ?? "vip-bike"}`;
}

export function wallComposeStartParam(rentalId: string, slug: string): string {
  const id = rentalId.trim();
  if (!isUuidLike(id)) throw new Error(`wallComposeStartParam: rentalId is not a uuid: ${id}`);
  return `wallp_${id}_${sanitizeWallSlug(slug) ?? "vip-bike"}`;
}

/** https://t.me/<bot>/app?startapp=<param> — opens the Mini App on the spot. */
export function buildTelegramAppLink(botUsername: string, startParam: string): string {
  const bot = botUsername.replace(/^@/, "").trim();
  return `https://t.me/${bot}/app?startapp=${startParam}`;
}
