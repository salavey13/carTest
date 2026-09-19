// app/franchize/lib/wall-access.ts
// ─────────────────────────────────────────────────────────────────────────────
// Identity & access helpers for the OnlyBike community wall — shared by:
//   · server-actions/community-wall.ts (all wall writes),
//   · /api/franchize/wall-photo-upload (photo uploads BEFORE a post exists).
//
// NOT a "use server" module on purpose: it must stay importable from API
// routes without turning every helper into a callable server-action endpoint.
// Server-only by usage (imports supabaseAdmin + next/headers dynamically).
//
// Identity resolution (same two paths as the rest of the franchize app):
//   1. signed TELEGRAM_ACTOR_COOKIE (HMAC-SHA256, server-side verified),
//   2. raw initData forwarded by the client — HMAC-verified against the bot
//      token; the parsed user id is trusted only after verification.
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import {
  parseTelegramInitDataUser,
  WALL_RATE_POSTS_PER_HOUR,
  WALL_RATE_COMMENTS_PER_HOUR,
} from "@/app/franchize/lib/community-wall";

export type DbCrew = { id: string; name: string | null; slug: string | null; owner_id: string };

/** Global admin — top-level columns first (iter8 pattern), metadata legacy second. */
export function isGlobalAdminRow(
  user: { role: string | null; status: string | null; metadata: Record<string, unknown> | null } | null,
): boolean {
  const meta = user?.metadata as Record<string, unknown> | null;
  return (
    user?.role === "admin" ||
    user?.role === "vprAdmin" ||
    user?.status === "admin" ||
    meta?.role === "admin" ||
    meta?.status === "admin"
  );
}

export interface WallActor {
  userId: string;
  /** Fresh Telegram profile (only available on the initData path). */
  tg: { username: string | null; fullName: string | null; photoUrl: string | null } | null;
}

/**
 * Resolve the caller identity. Cookie first (WebApp sessions), initData as the
 * fallback for browsers that block third-party cookies. Returns null for
 * anonymous web visitors — they may read, never write.
 */
export async function resolveWallActor(initData?: string): Promise<WallActor | null> {
  const { cookies } = await import("next/headers");
  const { TELEGRAM_ACTOR_COOKIE, verifyTelegramActorCookieValue } = await import("@/lib/telegram-actor-cookie");

  const cookieUserId = verifyTelegramActorCookieValue((await cookies()).get(TELEGRAM_ACTOR_COOKIE)?.value);
  if (cookieUserId) return { userId: cookieUserId, tg: null };

  if (initData && initData.trim().length > 0) {
    try {
      const { computeTelegramWebAppHash } = await import("@/lib/telegram-webapp-auth");
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        logger.warn("[community-wall] TELEGRAM_BOT_TOKEN missing — initData path unavailable");
        return null;
      }
      const validation = await computeTelegramWebAppHash(initData, botToken);
      if (!validation.isValid) {
        logger.warn("[community-wall] initData signature invalid — rejecting");
        return null;
      }
      // Freshness: a captured initData must not replay forever (24h window,
      // same constant the auth lib uses elsewhere).
      const { isTelegramInitDataFresh } = await import("@/lib/telegram-webapp-auth");
      if (!isTelegramInitDataFresh(initData)) {
        logger.warn("[community-wall] initData stale (>24h) — rejecting");
        return null;
      }
      const parsed = parseTelegramInitDataUser(initData);
      if (!parsed) {
        logger.warn("[community-wall] initData valid but user payload unparsable");
        return null;
      }
      return {
        userId: parsed.id,
        tg: { username: parsed.username, fullName: parsed.fullName, photoUrl: parsed.photoUrl },
      };
    } catch (err) {
      logger.warn("[community-wall] initData resolution failed:", err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  return null;
}

/** Crew staff check: owner / global admin / ANY active crew membership. */
export async function isCrewStaffUser(
  userId: string,
  crew: Pick<DbCrew, "id" | "owner_id">,
): Promise<boolean> {
  if (crew.owner_id === userId) return true;
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("role, status, metadata")
    .eq("user_id", userId)
    .maybeSingle();
  if (isGlobalAdminRow(user ?? null)) return true;
  const { data: member } = await supabaseAdmin
    .from("crew_members")
    .select("user_id")
    .eq("crew_id", crew.id)
    .eq("user_id", userId)
    .eq("membership_status", "active")
    .maybeSingle();
  return !!member;
}

/**
 * Write scope for the wall: the wall «живёт для экипажа и его райдеров», so
 * posting/commenting requires a real crew relation — staff membership OR at
 * least one rental in this crew (any status: a pending request already makes
 * you this crew's renter). Likes stay open to any VERIFIED Telegram identity
 * (visitor applause, VK-wall style) — no crew relation needed there.
 */
export async function canWriteOnWall(
  userId: string,
  crew: Pick<DbCrew, "id" | "owner_id">,
): Promise<boolean> {
  if (await isCrewStaffUser(userId, crew)) return true;
  const { data: rental } = await supabaseAdmin
    .from("rentals")
    .select("rental_id")
    .eq("user_id", userId)
    .eq("crew_id", crew.id)
    .limit(1)
    .maybeSingle();
  return !!rental;
}

/**
 * Minimal spam brake: count this author's wall posts / comments in the last
 * hour (head-count queries — no payload, works across instances because it is
 * DB-based, not in-memory).
 */
export async function assertWallRate(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [postsRes, commentsRes] = await Promise.all([
    supabaseAdmin.from("crew_posts").select("id", { count: "exact", head: true }).eq("author_id", userId).gte("created_at", since),
    supabaseAdmin.from("crew_post_comments").select("id", { count: "exact", head: true }).eq("author_id", userId).gte("created_at", since),
  ]);
  const posts = postsRes.count ?? 0;
  const comments = commentsRes.count ?? 0;
  if (posts >= WALL_RATE_POSTS_PER_HOUR) {
    return { ok: false, error: `Не так быстро: максимум ${WALL_RATE_POSTS_PER_HOUR} постов в час.` };
  }
  if (comments >= WALL_RATE_COMMENTS_PER_HOUR) {
    return { ok: false, error: `Не так быстро: максимум ${WALL_RATE_COMMENTS_PER_HOUR} комментариев в час.` };
  }
  return { ok: true };
}

/**
 * Make sure the author exists in public.users (FK target) without ever
 * overwriting richer profile data the bot already stored. Only fills gaps.
 */
export async function ensureUserProfile(actor: WallActor): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("user_id, username, full_name, avatar_url")
    .eq("user_id", actor.userId)
    .maybeSingle();

  if (!existing) {
    const insertRow: {
      user_id: string;
      metadata: { source: string };
      username?: string;
      full_name?: string;
      avatar_url?: string;
    } = {
      user_id: actor.userId,
      metadata: { source: "community_wall" },
    };
    if (actor.tg?.username) insertRow.username = actor.tg.username;
    if (actor.tg?.fullName) insertRow.full_name = actor.tg.fullName;
    if (actor.tg?.photoUrl) insertRow.avatar_url = actor.tg.photoUrl;
    const { error } = await supabaseAdmin.from("users").insert(insertRow);
    if (error) logger.warn("[community-wall] user auto-provision failed:", error.message);
    return;
  }

  // Fill only NULL fields — never clobber bot-managed profile data.
  const patch: { username?: string; full_name?: string; avatar_url?: string } = {};
  if (actor.tg?.username && !existing.username) patch.username = actor.tg.username;
  if (actor.tg?.fullName && !existing.full_name) patch.full_name = actor.tg.fullName;
  if (actor.tg?.photoUrl && !existing.avatar_url) patch.avatar_url = actor.tg.photoUrl;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabaseAdmin.from("users").update(patch).eq("user_id", actor.userId);
  if (error) logger.warn("[community-wall] profile patch failed:", error.message);
}

export async function getCrewBySlug(slug: string): Promise<DbCrew | null> {
  const { data } = await supabaseAdmin
    .from("crews")
    .select("id, name, slug, owner_id")
    .eq("slug", slug.trim())
    .maybeSingle();
  return (data as DbCrew | null) ?? null;
}
