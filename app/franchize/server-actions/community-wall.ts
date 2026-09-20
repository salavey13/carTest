// app/franchize/server-actions/community-wall.ts
"use server";

// ─────────────────────────────────────────────────────────────────────────────
// OnlyBike community wall («стена экипажа») server actions.
//
// Feed is PUBLIC (any web visitor can read the wall). Every WRITE requires a
// server-verified Telegram identity, resolved through the same two paths the
// rest of the franchize app uses (see server-actions/leads.ts):
//   1. signed TELEGRAM_ACTOR_COOKIE (HMAC-SHA256, server-side verified),
//   2. raw initData forwarded by the client — HMAC-verified against the bot
//      token; the parsed user id is only trusted after verification.
//
// Crew staff (owner / active member / global admin) get author_scope='crew'
// and moderation powers (hide post/comment, delete any post). Renters post as
// 'rider'. Users missing from public.users are auto-provisioned from their
// Telegram profile on first post/comment.
//
// Counters (like_count / comment_count) are maintained by DB triggers
// (20260919000000_onlybike_community_wall.sql) — never touch them here.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import {
  computeCrewStandings,
  RIDE_SCORING_STATUSES,
  type CrewStandingsUserRef,
} from "@/app/franchize/lib/crew-standings";
import {
  buildStatsPostBody,
  computeRiderStats,
  type RentalStatsSnapshot,
  type WallAuthorView,
  type WallBikeRefView,
  type WallCommentView,
  type WallPhotoView,
  type WallPostView,
  type WallRentalRef,
  type WallViewerInfo,
  RIDE_EARNING_STATUSES,
  sanitizeReactionCounts,
  sanitizeWallPhotoInputs,
  sanitizeWallBikeIds,
  isValidWallReaction,
  extractHashtags,
  wallBusyUntilMap,
  wallPhotoPublicUrl,
  WALL_BIKES_MAX,
  WALL_BLOCKING_RENTAL_STATUSES,
  WALL_COMMENT_MAX_LEN,
  WALL_COMMENT_PREVIEW,
  WALL_COMMENTS_FETCH_LIMIT,
  WALL_FEED_PAGE_SIZE,
  WALL_PHOTOS_MAX,
  WALL_POST_MAX_LEN,
  WALLPHOTO_BUCKET,
} from "@/app/franchize/lib/community-wall";
import {
  assertWallRate,
  assertReactionRate,
  canWriteOnWall,
  ensureUserProfile,
  getCrewBySlug,
  isCrewStaffUser,
  resolveWallActor,
  type DbCrew,
} from "@/app/franchize/lib/wall-access";
import { notifyNewWallPost } from "@/app/franchize/lib/wall-notify";
import {
  extractMentionUsernames,
  maybeNotifyReactionMilestone,
  notifyWallComment,
  notifyWallPostMentions,
  type CommentNotifyRecipient,
} from "@/app/franchize/lib/wall-engage-notify";
import { buildWallPostPreview } from "@/app/franchize/lib/community-wall";
import { buildRideSessionDraftText } from "@/app/franchize/lib/community-wall";
import {
  buildSuggestedWallPost,
  summarizeRide,
} from "@/app/franchize/lib/ride-share-notify";
import { resolveCrewBotUsername } from "@/app/franchize/lib/crew-bot";
import { resolveLeadNotifyRecipients } from "@/app/franchize/lib/new-lead-notify";

// NOTE: cookies + telegram-actor-cookie are imported DYNAMICALLY inside
// functions (same reason as server-actions/leads.ts — avoid `import
// "server-only"` poisoning the client bundle).

// ── shared row types ─────────────────────────────────────────────────────────

type DbPostRow = {
  id: string;
  crew_id: string;
  author_id: string;
  author_scope: string;
  kind: string;
  body: string;
  stats: unknown;
  rental_id: string | null;
  like_count: number;
  comment_count: number;
  reaction_counts: unknown;
  is_pinned: boolean;
  created_at: string;
};
type DbUserRow = {
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

/** Сколько @упомянутых пользователей резолвим одним комментарием (cap lookup). */
const WALL_MENTION_LOOKUP_CAP = 3;

// ── stats snapshot helpers ───────────────────────────────────────────────────

function sanitizeStatsSnapshot(raw: unknown): RentalStatsSnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.ridesCount !== "number" || !Number.isFinite(s.ridesCount)) return null;
  if (typeof s.hoursRented !== "number" || !Number.isFinite(s.hoursRented)) return null;
  return {
    ridesCount: s.ridesCount,
    hoursRented: s.hoursRented,
    totalSpent: typeof s.totalSpent === "number" && Number.isFinite(s.totalSpent) ? s.totalSpent : 0,
    bikesUsed: typeof s.bikesUsed === "number" && Number.isFinite(s.bikesUsed) ? s.bikesUsed : 0,
    firstRideAt: typeof s.firstRideAt === "string" ? s.firstRideAt : null,
    lastRideAt: typeof s.lastRideAt === "string" ? s.lastRideAt : null,
    bikes: Array.isArray(s.bikes)
      ? (s.bikes as unknown[]).flatMap((b) => {
          if (!b || typeof b !== "object") return [];
          const bb = b as Record<string, unknown>;
          if (typeof bb.vehicleId !== "string") return [];
          return [{
            vehicleId: bb.vehicleId,
            title: typeof bb.title === "string" ? bb.title : bb.vehicleId,
            count: typeof bb.count === "number" ? bb.count : 0,
          }];
        })
      : [],
  };
}

/** Crew's bikes (id → {title: model, type}) for stats filtering. */
async function loadCrewBikesMap(crewId: string): Promise<Map<string, { id: string; title: string; type: string }>> {
  const { data } = await supabaseAdmin
    .from("cars")
    .select("id, model, type")
    .eq("crew_id", crewId);
  const map = new Map<string, { id: string; title: string; type: string }>();
  for (const row of (data ?? []) as { id: string; model: string | null; type: string | null }[]) {
    map.set(String(row.id), { id: String(row.id), title: row.model || String(row.id), type: String(row.type ?? "") });
  }
  return map;
}

/** Compute the rider's rental stats for one crew (only cars.type='bike' counts). */
async function computeMyCrewStats(userId: string, crewId: string): Promise<RentalStatsSnapshot> {
  const [bikes, rentalsRes] = await Promise.all([
    loadCrewBikesMap(crewId),
    supabaseAdmin
      .from("rentals")
      .select("vehicle_id, status, total_cost, agreed_start_date, agreed_end_date, requested_start_date, requested_end_date")
      .eq("user_id", userId)
      .eq("crew_id", crewId),
  ]);
  const statsBikes = new Map([...bikes.entries()].map(([id, b]) => [id, { id: b.id, title: b.title, type: b.type }]));
  return computeRiderStats(
    (rentalsRes.data ?? []) as import("@/app/franchize/lib/community-wall").StatsRentalRow[],
    statsBikes,
  );
}

/** Build the lib-facing author view from a users row. */
function toAuthorView(row: DbUserRow): WallAuthorView {
  return {
    userId: row.user_id,
    username: row.username,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
  };
}

/** Display name for a reply prefix («Имя ответил(а)…»). */
function authorDisplayName(a: WallAuthorView | undefined): string {
  return a?.fullName || a?.username || "Райдер";
}

/**
 * Batched resolver for comment reply prefixes: collects (commentId →
 * replyToId) pairs, fetches the target rows in ONE bounded query, resolves
 * names through the already-loaded authors map (plus one extra users fetch
 * for targets whose author is not on the page). Root comments stay null.
 */
function createReplyEnricher() {
  const pairs = new Map<string, string>(); // commentId → replyToId
  return {
    add(commentId: string, replyToId: string) {
      pairs.set(commentId, replyToId);
    },
    async resolve(authors: Map<string, WallAuthorView>, patch: (commentId: string, replyTo: { commentId: string; authorName: string } | null) => void) {
      if (pairs.size === 0) return;
      const targetIds = [...new Set(pairs.values())];
      const { data: targets } = await supabaseAdmin
        .from("crew_post_comments")
        .select("id, author_id")
        .in("id", targetIds);
      const targetAuthor = new Map<string, string>();
      for (const t of (targets ?? []) as { id: string; author_id: string }[]) {
        targetAuthor.set(t.id, t.author_id);
      }
      const missingAuthors = [...new Set([...targetAuthor.values()].filter((id) => !authors.has(id)))];
      if (missingAuthors.length > 0) {
        const { data: extra } = await supabaseAdmin
          .from("users")
          .select("user_id, username, full_name, avatar_url")
          .in("user_id", missingAuthors);
        for (const row of (extra ?? []) as DbUserRow[]) authors.set(row.user_id, toAuthorView(row));
      }
      for (const [commentId, replyToId] of pairs) {
        const authorId = targetAuthor.get(replyToId);
        patch(commentId, authorId ? { commentId: replyToId, authorName: authorDisplayName(authors.get(authorId)) } : null);
      }
    },
  };
}

// ── GET FEED ─────────────────────────────────────────────────────────────────

const FeedInput = z.object({
  slug: z.string().trim().min(1),
  initData: z.string().trim().optional(),
  /** Cursor: created_at ISO of the last post of the previous page. */
  before: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Date.parse(v)), "before must be a parseable ISO date")
    .optional(),
  /** Tag filter: normalized hashtag body (see hashtagKey). */
  tag: z
    .string()
    .trim()
    .max(40)
    .regex(/^[a-zа-яё0-9_]+$/i, "tag must be a normalized hashtag body")
    .optional(),
  /** Free-text wall search (websearch syntax over the simple tsvector). */
  q: z.string().trim().min(1).max(60).optional(),
  /** Author filter (rider profile v1): «this rider's part of the wall».
   *  uuid — cast failures from hostile callers just return an empty page. */
  authorId: z.string().trim().uuid().optional(),
  // NOTE: no caller-supplied limit — pageSize is server-fixed so the
  // page-1-holds-all-pinned invariant (WALL_PIN_CAP « WALL_FEED_PAGE_SIZE)
  // cannot be broken from the outside.
});

export type GetCommunityWallResult =
  | { ok: true; posts: WallPostView[]; hasMore: boolean; nextBefore: string | null; viewer: WallViewerInfo }
  | { ok: false; error: string };

export async function getCommunityWallAction(input: {
  slug: string;
  initData?: string;
  before?: string;
  tag?: string;
  q?: string;
  authorId?: string;
}): Promise<GetCommunityWallResult> {
  const parsed = FeedInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректный запрос ленты." };
  const { slug, initData, before, tag, q, authorId } = parsed.data;
  const pageSize = WALL_FEED_PAGE_SIZE;

  const crew = await getCrewBySlug(slug);
  if (!crew) return { ok: false, error: "Экипаж не найден." };

  const actor = await resolveWallActor(initData);
  const isStaff = actor ? await isCrewStaffUser(actor.userId, crew) : false;
  const viewer: WallViewerInfo = { userId: actor?.userId ?? null, isCrewStaff: isStaff };

  // 1. Posts page (pinned first, then newest). Tag filter goes through the
  // !inner embed (PostgREST), search through the generated tsvector — both
  // compose with the keyset cursor.
  let query = supabaseAdmin
    .from("crew_posts")
    .select(tag ? "*, crew_post_tags!inner(tag)" : "*")
    .eq("crew_id", crew.id)
    .eq("is_hidden", false)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(pageSize + 1);
  if (tag) query = query.eq("crew_post_tags.tag", tag);
  if (q) query = query.textSearch("search_tsv", q, { type: "websearch", config: "simple" });
  if (authorId) query = query.eq("author_id", authorId);
  if (before) {
    // Page 2+: pinned posts live on page 1 only — otherwise any pinned post
    // older than the cursor would re-appear at the top of EVERY later page.
    // Correctness of the keyset is guaranteed by the pin cap (WALL_PIN_CAP=5
    // « page size 25) enforced in setPostPinnedAction.
    query = query.lt("created_at", before).eq("is_pinned", false);
  }
  const { data: postRows, error: postsErr } = await query;
  if (postsErr) {
    logger.error("[community-wall] feed query failed:", postsErr.message);
    return { ok: false, error: "Не удалось загрузить стену. Попробуй ещё раз." };
  }

  // unknown cast: the generated DB types lag the migrations (crew_post_tags /
  // search_tsv ship before the next `supabase gen types` run) — values are
  // re-validated field by field below anyway.
  const rows = (postRows ?? []) as unknown as DbPostRow[];
  const hasMore = rows.length > pageSize;
  const pageRows = rows.slice(0, pageSize);
  const postIds = pageRows.map((p) => p.id);

  if (pageRows.length === 0) {
    return { ok: true, posts: [], hasMore: false, nextBefore: null, viewer };
  }

  // 2. Authors for posts (+ comments below).
  const authorIds = [...new Set(pageRows.map((p) => p.author_id))];
  const { data: authorRows } = await supabaseAdmin
    .from("users")
    .select("user_id, username, full_name, avatar_url")
    .in("user_id", authorIds);
  const authors = new Map<string, WallAuthorView>();
  for (const row of (authorRows ?? []) as DbUserRow[]) authors.set(row.user_id, toAuthorView(row));
  // FK guarantees the row exists; the fallback keeps the wall rendering even if it was just deleted.
  for (const id of authorIds) {
    if (!authors.has(id)) authors.set(id, { userId: id, username: null, fullName: null, avatarUrl: null });
  }

  // 3. Comment PREVIEWS: the newest 2 per post, shipped with the feed so the
  // payload stays tiny. Full history loads on expand via getPostCommentsAction
  // — the post's comment_count is authoritative, so «Показать все» never lies.
  const { data: commentRows } = await supabaseAdmin
    .from("crew_post_comments")
    .select("id, post_id, author_id, body, created_at, reply_to_id")
    .in("post_id", postIds)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    // Global budget with headroom: WALL_COMMENT_PREVIEW per post is the norm,
    // but one hot post must not starve the whole page — 3× headroom lets the
    // newest ~6 land on a chatty post while others still get their two.
    .limit(postIds.length * WALL_COMMENT_PREVIEW * 3);

  const commentAuthorIds = [...new Set(((commentRows ?? []) as { author_id: string }[]).map((c) => c.author_id))];
  const missingCommentAuthors = commentAuthorIds.filter((id) => !authors.has(id));
  if (missingCommentAuthors.length > 0) {
    const { data: extraAuthors } = await supabaseAdmin
      .from("users")
      .select("user_id, username, full_name, avatar_url")
      .in("user_id", missingCommentAuthors);
    for (const row of (extraAuthors ?? []) as DbUserRow[]) authors.set(row.user_id, toAuthorView(row));
  }

  const commentsByPost = new Map<string, WallCommentView[]>();
  const replyEnricher = createReplyEnricher();
  for (const row of (commentRows ?? []) as {
    id: string;
    post_id: string;
    author_id: string;
    body: string;
    created_at: string;
    reply_to_id: string | null;
  }[]) {
    const list = commentsByPost.get(row.post_id) ?? [];
    // Rows arrive newest-first; keep only the first WALL_COMMENT_PREVIEW per post.
    if (list.length < WALL_COMMENT_PREVIEW) {
      list.push({
        id: row.id,
        postId: row.post_id,
        author: authors.get(row.author_id) ?? { userId: row.author_id, username: null, fullName: null, avatarUrl: null },
        replyTo: null,
        body: row.body,
        createdAt: row.created_at,
      });
      if (row.reply_to_id) replyEnricher.add(row.id, row.reply_to_id);
    }
    commentsByPost.set(row.post_id, list);
  }
  await replyEnricher.resolve(authors, (commentId, replyTo) => {
    for (const list of commentsByPost.values()) {
      const c = list.find((x) => x.id === commentId);
      if (c) {
        c.replyTo = replyTo;
        return;
      }
    }
  });
  // Flip each preview back to chronological order (oldest → newest).
  for (const list of commentsByPost.values()) list.reverse();

  // 4–5. Everything below the page fetch depends ONLY on postIds — so all
  // four blocks run CONCURRENTLY (Promise.all) instead of ~7 sequential
  // roundtrips. The busy-map pass lands after the mention rows (it needs the
  // collected bike ids).
  const rentalIds = [...new Set(pageRows.map((p) => p.rental_id).filter((id): id is string => !!id))];

  async function buildRentalRefs(): Promise<Map<string, WallRentalRef>> {
    const rentalRefs = new Map<string, WallRentalRef>();
    if (rentalIds.length === 0) return rentalRefs;
    const { data: rentalRows } = await supabaseAdmin
      .from("rentals")
      .select("rental_id, vehicle_id")
      .in("rental_id", rentalIds);
    const vehicleIds = [...new Set(((rentalRows ?? []) as { rental_id: string; vehicle_id: string | null }[]).map((r) => r.vehicle_id).filter((v): v is string => !!v))];
    const { data: bikeRows } = vehicleIds.length
      ? await supabaseAdmin.from("cars").select("id, model, image_url").in("id", vehicleIds)
      : { data: null };
    const bikeMeta = new Map<string, { title: string; imageUrl: string | null }>();
    for (const b of (bikeRows ?? []) as { id: string; model: string | null; image_url: string | null }[]) {
      bikeMeta.set(String(b.id), { title: b.model || String(b.id), imageUrl: b.image_url });
    }
    for (const r of (rentalRows ?? []) as { rental_id: string; vehicle_id: string | null }[]) {
      const meta = r.vehicle_id ? bikeMeta.get(r.vehicle_id) : undefined;
      rentalRefs.set(r.rental_id, {
        rentalId: r.rental_id,
        bikeTitle: meta?.title ?? "Байк",
        imageUrl: meta?.imageUrl ?? null,
      });
    }
    return rentalRefs;
  }

  async function buildPhotosByPost(): Promise<Map<string, WallPhotoView[]>> {
    const photosByPost = new Map<string, WallPhotoView[]>();
    const { data: photoRows } = await supabaseAdmin
      .from("crew_post_photos")
      .select("id, post_id, storage_path, width, height")
      .in("post_id", postIds)
      .order("position", { ascending: true });
    for (const row of (photoRows ?? []) as {
      id: string;
      post_id: string;
      storage_path: string;
      width: number | null;
      height: number | null;
    }[]) {
      const list = photosByPost.get(row.post_id) ?? [];
      list.push({ id: row.id, url: wallPhotoPublicUrl(row.storage_path), width: row.width, height: row.height });
      photosByPost.set(row.post_id, list);
    }
    return photosByPost;
  }

  async function buildBikesByPost(): Promise<Map<string, WallBikeRefView[]>> {
    const bikesByPost = new Map<string, WallBikeRefView[]>();
    const { data: bikeMentionRows } = await supabaseAdmin
      .from("crew_post_bikes")
      .select("post_id, bike_id, cars(id, model, image_url)")
      .in("post_id", postIds)
      .order("position", { ascending: true });
    for (const row of (bikeMentionRows ?? []) as unknown as {
      post_id: string;
      bike_id: string;
      cars: { model: string | null; image_url: string | null } | null;
    }[]) {
      const list = bikesByPost.get(row.post_id) ?? [];
      list.push({
        bikeId: row.bike_id,
        title: row.cars?.model || "Байк",
        imageUrl: row.cars?.image_url ?? null,
        busyUntilIso: null,
      });
      bikesByPost.set(row.post_id, list);
    }

    // LIVE AVAILABILITY for mentioned bikes (special sauce): reuse the
    // checkout gate's blocking statuses + overlap contract (lib
    // wallBusyUntilMap) so the wall always agrees with the cart.
    const mentionIds = [...new Set([...bikesByPost.values()].flatMap((list) => list.map((b) => b.bikeId)))];
    if (mentionIds.length > 0) {
      const { data: busyRows } = await supabaseAdmin
        .from("rentals")
        .select("vehicle_id, status, requested_start_date, requested_end_date, agreed_start_date, agreed_end_date")
        .in("vehicle_id", mentionIds)
        .in("status", WALL_BLOCKING_RENTAL_STATUSES);
      const busyMs = wallBusyUntilMap((busyRows ?? []) as never[], Date.now());
      for (const list of bikesByPost.values()) {
        for (const bike of list) {
          const until = busyMs.get(bike.bikeId);
          bike.busyUntilIso = until ? new Date(until).toISOString() : null;
        }
      }
    }
    return bikesByPost;
  }

  async function buildViewerReactions(): Promise<Map<string, string>> {
    const viewerReactions = new Map<string, string>();
    if (!actor || postIds.length === 0) return viewerReactions;
    const { data: reactionRows } = await supabaseAdmin
      .from("crew_post_reactions")
      .select("post_id, emoji")
      .eq("user_id", actor.userId)
      .in("post_id", postIds);
    for (const row of (reactionRows ?? []) as { post_id: string; emoji: string }[]) {
      viewerReactions.set(row.post_id, row.emoji);
    }
    return viewerReactions;
  }

  const [rentalRefs, photosByPost, bikesByPost, viewerReactions] = await Promise.all([
    buildRentalRefs(),
    buildPhotosByPost(),
    buildBikesByPost(),
    buildViewerReactions(),
  ]);

  const posts: WallPostView[] = pageRows.map((p) => ({
    id: p.id,
    kind: p.kind === "stats" ? "stats" : "post",
    body: p.body,
    stats: p.kind === "stats" ? sanitizeStatsSnapshot(p.stats) : null,
    authorScope: p.author_scope === "crew" ? "crew" : "rider",
    isPinned: p.is_pinned,
    createdAt: p.created_at,
    likeCount: p.like_count ?? 0,
    commentCount: p.comment_count ?? 0,
    reactionCounts: sanitizeReactionCounts(p.reaction_counts),
    viewerReaction: viewerReactions.get(p.id) ?? null,
    author: authors.get(p.author_id) ?? { userId: p.author_id, username: null, fullName: null, avatarUrl: null },
    comments: commentsByPost.get(p.id) ?? [],
    rental: p.rental_id ? rentalRefs.get(p.rental_id) ?? null : null,
    photos: photosByPost.get(p.id) ?? [],
    bikes: bikesByPost.get(p.id) ?? [],
  }));

  return {
    ok: true,
    posts,
    hasMore,
    nextBefore: hasMore ? pageRows[pageRows.length - 1].created_at : null,
    viewer,
  };
}

// ── CREATE POST ──────────────────────────────────────────────────────────────

const CreatePostInput = z.object({
  slug: z.string().trim().min(1),
  body: z.string().max(WALL_POST_MAX_LEN).optional(),
  initData: z.string().trim().optional(),
  shareStats: z.boolean().optional(),
  rentalId: z.string().trim().uuid().optional(),
  // Photo payloads from /api/franchize/wall-photo-upload (staging paths).
  // Shape-checked later by sanitizeWallPhotoInputs — needs the resolved actor.
  photos: z.unknown().optional(),
  // Catalogue bike mentions — shape-checked by sanitizeWallBikeIds.
  bikes: z.unknown().optional(),
});

export type CreateCommunityPostResult =
  | { ok: true; post: WallPostView }
  | { ok: false; error: string };

export async function createCommunityPostAction(input: {
  slug: string;
  body?: string;
  initData?: string;
  shareStats?: boolean;
  rentalId?: string;
  photos?: unknown;
  bikes?: unknown;
}): Promise<CreateCommunityPostResult> {
  const parsed = CreatePostInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректный пост." };
  const { slug, initData, shareStats = false, rentalId } = parsed.data;
  const body = (parsed.data.body ?? "").trim();

  const crew = await getCrewBySlug(slug);
  if (!crew) return { ok: false, error: "Экипаж не найден." };

  const actor = await resolveWallActor(initData);
  if (!actor) {
    return { ok: false, error: "Публиковать можно из Telegram-бота экипажа — открой страницу через бота." };
  }

  // Wall writes are for the crew and its riders: staff membership or ≥1 rental.
  if (!(await canWriteOnWall(actor.userId, crew))) {
    return { ok: false, error: "Стена — для своих: арендуй байк в этом экипаже (или вступи в него), чтобы постить." };
  }
  const rate = await assertWallRate(actor.userId);
  if (!rate.ok) return { ok: false, error: rate.error };
  const authorPostsLastHour = rate.ok ? rate.posts : 0;
  const photos = sanitizeWallPhotoInputs(parsed.data.photos, actor.userId);
  if (photos === null) {
    return { ok: false, error: `Фото: максимум ${WALL_PHOTOS_MAX} на пост и только свои загруженные файлы.` };
  }

  // ── Bike mentions: ids must be UUIDs, ≤ WALL_BIKES_MAX ──
  const bikeIds = sanitizeWallBikeIds(parsed.data.bikes);
  if (bikeIds === null) {
    return { ok: false, error: `Байков в посте — максимум ${WALL_BIKES_MAX}.` };
  }

  if (!shareStats && body.length === 0 && photos.length === 0 && bikeIds.length === 0) {
    return { ok: false, error: "Пост пустой — напиши пару слов или прикрепи фото." };
  }
  if (body.length > WALL_POST_MAX_LEN) return { ok: false, error: `Максимум ${WALL_POST_MAX_LEN} символов.` };

  await ensureUserProfile(actor);

  // Optional attached rental: ONLY the actor's own rental in THIS crew.
  let verifiedRentalId: string | null = null;
  let rentalRef: WallRentalRef | null = null;
  if (rentalId) {
    const { data: rental } = await supabaseAdmin
      .from("rentals")
      .select("rental_id, vehicle_id, user_id, crew_id")
      .eq("rental_id", rentalId)
      .maybeSingle();
    const row = rental as { rental_id: string; vehicle_id: string | null; user_id: string; crew_id: string } | null;
    if (!row) {
      return { ok: false, error: "Эта аренда не найдена — обнови страницу." };
    }
    if (row.user_id !== actor.userId || row.crew_id !== crew.id) {
      return { ok: false, error: "Нельзя прикрепить чужую аренду." };
    }
    verifiedRentalId = row.rental_id;
    if (row.vehicle_id) {
      const { data: bike } = await supabaseAdmin
        .from("cars")
        .select("id, model, image_url")
        .eq("id", row.vehicle_id)
        .maybeSingle();
      const b = bike as { id: string; model: string | null; image_url: string | null } | null;
      rentalRef = {
        rentalId: row.rental_id,
        bikeTitle: b?.model || "Байк",
        imageUrl: b?.image_url ?? null,
      };
    }
  }

  // ── Bike mentions: ONLY real bikes from THIS crew's catalogue ──
  let bikeRefs: WallBikeRefView[] = [];
  if (bikeIds.length > 0) {
    const { data: bikeRows, error: bikeErr } = await supabaseAdmin
      .from("cars")
      .select("id, model, image_url")
      .eq("crew_id", crew.id)
      .eq("type", "bike") // same filter the picker uses — no helmet/service mentions
      .in("id", bikeIds);
    if (bikeErr) {
      logger.error("[community-wall] bike verify failed:", bikeErr.message);
      return { ok: false, error: "Не удалось проверить байки. Попробуй ещё раз." };
    }
    const rows = (bikeRows ?? []) as { id: string; model: string | null; image_url: string | null }[];
    if (rows.length !== bikeIds.length) {
      return { ok: false, error: "Один из байков не из каталога этого экипажа." };
    }
    // Keep the author's attach order.
    bikeRefs = bikeIds.map((id) => {
      const row = rows.find((r) => String(r.id) === id);
      return { bikeId: id, title: row?.model || "Байк", imageUrl: row?.image_url ?? null, busyUntilIso: null };
    });
  }

  // Stats snapshot is computed server-side at post time — immutable afterwards.
  let statsSnapshot: RentalStatsSnapshot | null = null;
  let finalBody = body;
  if (shareStats) {
    statsSnapshot = await computeMyCrewStats(actor.userId, crew.id);
    if (!finalBody) finalBody = buildStatsPostBody(statsSnapshot);
  }

  const authorScope = (await isCrewStaffUser(actor.userId, crew)) ? "crew" : "rider";

  // JSON round-trip: RentalStatsSnapshot (interface) → plain Json-assignable shape.
  const statsJson = statsSnapshot
    ? (JSON.parse(JSON.stringify(statsSnapshot)) as RentalStatsSnapshot)
    : null;

  const insertRow = {
    crew_id: crew.id,
    author_id: actor.userId,
    author_scope: authorScope,
    kind: statsSnapshot ? "stats" : "post",
    body: finalBody,
    stats: statsJson,
    rental_id: verifiedRentalId,
  };
  const { data: inserted, error } = await supabaseAdmin
    .from("crew_posts")
    .insert(insertRow)
    .select("id, created_at")
    .single();
  if (error || !inserted) {
    logger.error("[community-wall] insert post failed:", error?.message);
    return { ok: false, error: "Не удалось опубликовать пост. Попробуй ещё раз." };
  }
  const postId = inserted.id as string;

  // ── Tags: normalized hashtags extracted from the final body ──
  // Same tokenizer the UI renders with, so the filter always matches what
  // readers see. Rows are idempotent per (post, tag); cap 8 enforced in lib.
  const tagKeys = extractHashtags(finalBody);
  if (tagKeys.length > 0) {
    const { error: tagInsertError } = await supabaseAdmin.from("crew_post_tags").insert(
      tagKeys.map((tag) => ({ post_id: postId, tag, crew_id: crew.id })),
    );
    if (tagInsertError) {
      logger.error("[community-wall] tag rows insert failed:", tagInsertError.message);
    }
  }

  // ── Photos: move staging → posts/<postId>/<n>.jpg, then insert rows ──
  // If the move fails twice, the photo row is SKIPPED: a staging object is
  // purged by the 24h TTL janitor, so keeping the row would turn the photo
  // into a broken image on a live post within two days.
  const photoViews: WallPhotoView[] = [];
  const photoFinalPaths: string[] = [];
  for (let i = 0; i < photos.length; i += 1) {
    const photo = photos[i];
    let finalPath: string | null = null;
    for (let attempt = 0; attempt < 2 && finalPath === null; attempt += 1) {
      const target = `posts/${postId}/${i}.jpg`;
      try {
        const { error: moveError } = await supabaseAdmin.storage
          .from(WALLPHOTO_BUCKET)
          .move(photo.path, target);
        if (moveError) {
          logger.warn(`[community-wall] photo move attempt ${attempt + 1} failed:`, moveError.message);
        } else {
          finalPath = target;
        }
      } catch (moveCrash) {
        // storage-js wraps network failures into {error}, but a non-storage
        // throw must not escape AFTER the post row exists (the user would
        // retry and create a duplicate post) — treat it as a failed move.
        logger.warn(`[community-wall] photo move attempt ${attempt + 1} crashed:`, moveCrash);
      }
    }
    if (finalPath === null) {
      // Keep the post alive without this photo; the staging object ages out
      // via the TTL janitor instead of becoming a broken image later.
      continue;
    }
    // The removal path below is UNCONDITIONAL (ghost guard must clean the
    // file even if the row insert fails), but the OPTIMISTIC photo is only
    // advertised when the row exists — otherwise it would vanish on refresh.
    const { error: photoInsertError } = await supabaseAdmin.from("crew_post_photos").insert({
      post_id: postId,
      crew_id: crew.id,
      storage_path: finalPath,
      width: photo.width,
      height: photo.height,
      byte_size: photo.bytes,
      position: i,
    });
    if (photoInsertError) {
      logger.error("[community-wall] photo row insert failed:", photoInsertError.message);
      // Nothing references the object (no row) — remove it now instead of
      // leaving a permanent orphan in posts/<postId>/ (the ghost guard only
      // cleans row-backed paths).
      await supabaseAdmin.storage.from(WALLPHOTO_BUCKET).remove([finalPath]);
    } else {
      photoViews.push({
        id: `${postId}-${i}`,
        url: wallPhotoPublicUrl(finalPath),
        width: photo.width,
        height: photo.height,
      });
      photoFinalPaths.push(finalPath);
    }
  }

  // ── Bike mention rows (join table; cars already verified above) ──
  if (bikeIds.length > 0) {
    const { error: bikeInsertError } = await supabaseAdmin.from("crew_post_bikes").insert(
      bikeRefs.map((ref, i) => ({
        post_id: postId,
        bike_id: ref.bikeId,
        crew_id: crew.id,
        position: i,
      })),
    );
    if (bikeInsertError) {
      logger.error("[community-wall] bike rows insert failed:", bikeInsertError.message);
    }
  }

  const { data: me } = await supabaseAdmin
    .from("users")
    .select("user_id, username, full_name, avatar_url")
    .eq("user_id", actor.userId)
    .maybeSingle();

  const post: WallPostView = {
    id: postId,
    kind: statsSnapshot ? "stats" : "post",
    body: finalBody,
    stats: statsSnapshot,
    authorScope,
    isPinned: false,
    createdAt: inserted.created_at,
    likeCount: 0,
    commentCount: 0,
    reactionCounts: {},
    viewerReaction: null,
    author: me ? toAuthorView(me as DbUserRow) : { userId: actor.userId, username: actor.tg?.username ?? null, fullName: actor.tg?.fullName ?? null, avatarUrl: actor.tg?.photoUrl ?? null },
    comments: [],
    rental: rentalRef,
    photos: photoViews,
    bikes: bikeRefs,
  };

  // ── Crew notification: awaited ON PURPOSE (fire-and-forget freezes on
  // Vercel after the response — the d275c52 lesson). notifyNewWallPost never
  // throws, and a notify outage must never fail the post itself.
  // Ghost guard: a concurrent delete between insert and notify would otherwise
  // announce a post that no longer exists (and orphan its photos).
  const { data: stillThere } = await supabaseAdmin
    .from("crew_posts")
    .select("id")
    .eq("id", postId)
    .maybeSingle();
  if (stillThere) {
    const authorName =
      (me as DbUserRow | null)?.full_name ||
      (me as DbUserRow | null)?.username ||
      actor.tg?.fullName ||
      actor.tg?.username ||
      "Райдер";
    await notifyNewWallPost({
      slug: crew.slug || slug,
      postId,
      authorName,
      body: finalBody,
      photoCount: photoViews.length,
      bikeTitles: bikeRefs.map((b) => b.title),
      hasStats: statsSnapshot !== null,
      excludeUserId: actor.userId,
      recentAuthorPosts: authorPostsLastHour,
    });
    // Post-mention DMs (profile v1 parity with comments): @user in the body
    // pings the rider. Prefs-aware + exactly-once per (post, user) via the
    // same ledger; never throws, never blocks the post.
    await notifyWallPostMentions({
      slug: crew.slug || slug,
      postId,
      authorId: actor.userId,
      authorName,
      body: finalBody,
      postPreview: buildWallPostPreview(finalBody, 160),
      // Бот экипажа из metadata (фикс 2026-09-21) — env в проде пуст.
      botUsername: await resolveCrewBotUsername(crew.slug || slug),
    });
  } else {
    logger.warn("[community-wall] post vanished before notify — skipping + cleaning photos");
    if (photoFinalPaths.length > 0) {
      await supabaseAdmin.storage.from(WALLPHOTO_BUCKET).remove(photoFinalPaths);
    }
    await supabaseAdmin.from("crew_posts").delete().eq("id", postId); // photo rows cascade
  }

  const { revalidatePath } = await import("next/cache");
  revalidatePath(`/franchize/${crew.slug || slug}/community`);
  return { ok: true, post };
}

// ── TOGGLE REACTION (VK-style emoji, supersedes the plain like) ─────────────

const ToggleReactionInput = z.object({
  postId: z.string().trim().uuid(),
  emoji: z.string().trim().min(1).max(8),
  initData: z.string().trim().optional(),
});

export type TogglePostReactionResult =
  | { ok: true; reaction: string | null; likeCount: number; reactionCounts: Record<string, number> }
  | { ok: false; error: string };

/**
 * VK semantics: tap = set my reaction (❤️ default), tap again = remove,
 * tap another emoji = switch. The whole toggle runs as ONE Postgres RPC
 * (migration 20260920010000: toggle_post_reaction) — atomic, race-absorbing,
 * ~1 roundtrip instead of 5 — and returns the trigger-fed aggregate, so the
 * client never guesses counts.
 */
export async function togglePostReactionAction(input: {
  postId: string;
  emoji: string;
  initData?: string;
}): Promise<TogglePostReactionResult> {
  const parsed = ToggleReactionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректная реакция." };
  const { postId, initData } = parsed.data;
  if (!isValidWallReaction(parsed.data.emoji)) return { ok: false, error: "Такой реакции нет." };
  const emoji = parsed.data.emoji;

  const actor = await resolveWallActor(initData);
  if (!actor) return { ok: false, error: "Реакции доступны из Telegram-бота экипажа." };

  const reactionRate = await assertReactionRate(actor.userId);
  if (!reactionRate.ok) return { ok: false, error: reactionRate.error };

  const { data, error } = await supabaseAdmin.rpc("toggle_post_reaction", {
    p_post_id: postId,
    p_user_id: actor.userId,
    p_emoji: emoji,
  });
  if (error) {
    logger.error("[community-wall] reaction rpc failed:", error.message);
    return { ok: false, error: "Не получилось поставить реакцию." };
  }
  const res = data as {
    error?: string;
    reaction: string | null;
    like_count: number | null;
    reaction_counts: unknown;
    added?: boolean;
  } | null;
  if (!res || res.error === "post_unavailable") return { ok: false, error: "Пост недоступен." };
  if (res.error === "bad_emoji") return { ok: false, error: "Такой реакции нет." };

  const likeCount = res.like_count ?? 0;

  // ── Author engagement notify (wall v4): reaction milestone → author DM.
  // Only on a NET-NEW reaction (RPC `added`), only on round numbers, exactly-
  // once per milestone via crew_post_notify_log. Never blocks the toggle.
  if (res.added === true && res.reaction === emoji) {
    try {
      const { data: postMeta } = await supabaseAdmin
        .from("crew_posts")
        .select("author_id, body, crew_id, is_hidden, crews(slug)")
        .eq("id", postId)
        .maybeSingle();
      const meta = postMeta as {
        author_id: string;
        body: string | null;
        crew_id: string;
        is_hidden: boolean;
        crews: { slug: string | null } | { slug: string | null }[] | null;
      } | null;
      const crewSlugRaw = Array.isArray(meta?.crews) ? meta?.crews[0]?.slug : meta?.crews?.slug;
      if (meta?.author_id && crewSlugRaw && meta.is_hidden === false) {
        // topEmoji: самая частая эмодзи поста (для «лица» уведомления).
        const counts = sanitizeReactionCounts(res.reaction_counts);
        const topEmoji =
          Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? emoji;
        await maybeNotifyReactionMilestone({
          slug: crewSlugRaw,
          postId,
          postAuthorId: meta.author_id,
          reactorId: actor.userId,
          reactorName: actor.tg?.fullName || actor.tg?.username || null,
          total: likeCount,
          topEmoji,
          postPreview: buildWallPostPreview(meta.body || "", 160),
          botUsername: await resolveCrewBotUsername(crewSlugRaw),
        });
      }
    } catch (notifyErr) {
      logger.warn("[community-wall] reaction milestone notify failed (non-fatal):", notifyErr);
    }
  }

  return {
    ok: true,
    reaction: res.reaction,
    likeCount,
    reactionCounts: sanitizeReactionCounts(res.reaction_counts),
  };
}

// ── ADD COMMENT ──────────────────────────────────────────────────────────────

const AddCommentInput = z.object({
  postId: z.string().trim().uuid(),
  body: z.string().trim().min(1).max(WALL_COMMENT_MAX_LEN),
  /** Optional reply target (VK-style, ONE level): replies-to-replies are
   *  normalized to the root comment server-side. */
  replyTo: z.string().trim().uuid().optional(),
  initData: z.string().trim().optional(),
});

export type AddPostCommentResult =
  | { ok: true; comment: WallCommentView; commentCount: number }
  | { ok: false; error: string };

export async function addPostCommentAction(input: {
  postId: string;
  body: string;
  replyTo?: string;
  initData?: string;
}): Promise<AddPostCommentResult> {
  const parsed = AddCommentInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Комментарий пустой или слишком длинный." };
  const { postId, initData } = parsed.data;
  const body = parsed.data.body.trim();
  const replyTo = parsed.data.replyTo ?? null;

  const actor = await resolveWallActor(initData);
  if (!actor) {
    return { ok: false, error: "Комментировать можно из Telegram-бота экипажа — открой страницу через бота." };
  }

  const { data: post } = await supabaseAdmin
    .from("crew_posts")
    .select("id, crew_id, is_hidden, author_id, body")
    .eq("id", postId)
    .maybeSingle();
  const postRow = post as {
    id: string;
    crew_id: string;
    is_hidden: boolean;
    author_id: string;
    body: string | null;
  } | null;
  if (!postRow || postRow.is_hidden) return { ok: false, error: "Пост недоступен." };

  // ── Reply target: same post, visible, normalized to ROOT (one level) ──
  // The optimistic render gets the ROOT author's name so the freshly
  // appended comment never flip-flops with what a refetch would show.
  let verifiedReplyToId: string | null = null;
  let replyToName: string | null = null;
  let replyRootAuthorId: string | null = null;
  if (replyTo) {
    const { data: target } = await supabaseAdmin
      .from("crew_post_comments")
      .select("id, post_id, is_hidden, reply_to_id")
      .eq("id", replyTo)
      .maybeSingle();
    const t = target as {
      id: string;
      post_id: string;
      is_hidden: boolean;
      reply_to_id: string | null;
    } | null;
    if (!t || t.post_id !== postRow.id || t.is_hidden) {
      return { ok: false, error: "Комментарий, на который отвечаешь, уже недоступен." };
    }
    // Flatten: a reply to a reply attaches to the ROOT comment instead —
    // the wall's threads are one level deep, same as VK's render model.
    verifiedReplyToId = t.reply_to_id ?? t.id;
    const rootId = verifiedReplyToId;
    const { data: rootRow } = await supabaseAdmin
      .from("crew_post_comments")
      .select("id, author_id")
      .eq("id", rootId)
      .maybeSingle();
    const rootAuthorId = (rootRow as { author_id: string } | null)?.author_id;
    replyRootAuthorId = rootAuthorId ?? null;
    if (rootAuthorId) {
      const { data: nameRow } = await supabaseAdmin
        .from("users")
        .select("user_id, username, full_name")
        .eq("user_id", rootAuthorId)
        .maybeSingle();
      const nr = nameRow as { username: string | null; full_name: string | null } | null;
      replyToName = nr?.full_name || nr?.username || "Райдер";
    }
    replyToName = replyToName ?? "Райдер";
  }

  // Same write scope + rate brake as posts (crew riders & staff only).
  const { data: crewRow } = await supabaseAdmin
    .from("crews")
    .select("id, owner_id, slug, name")
    .eq("id", postRow.crew_id)
    .maybeSingle();
  if (!crewRow || !(await canWriteOnWall(actor.userId, crewRow as Pick<DbCrew, "id" | "owner_id">))) {
    return { ok: false, error: "Комментируют свои: арендуй байк в экипаже или вступи в него." };
  }
  const rate = await assertWallRate(actor.userId);
  if (!rate.ok) return { ok: false, error: rate.error };

  await ensureUserProfile(actor);

  const { data: inserted, error } = await supabaseAdmin
    .from("crew_post_comments")
    .insert({ post_id: postRow.id, crew_id: postRow.crew_id, author_id: actor.userId, body, reply_to_id: verifiedReplyToId })
    .select("id, created_at")
    .single();
  if (error || !inserted) {
    logger.error("[community-wall] insert comment failed:", error?.message);
    return { ok: false, error: "Не удалось отправить комментарий." };
  }

  const { data: me } = await supabaseAdmin
    .from("users")
    .select("user_id, username, full_name, avatar_url")
    .eq("user_id", actor.userId)
    .maybeSingle();

  const comment: WallCommentView = {
    id: inserted.id,
    postId: postRow.id,
    author: me
      ? toAuthorView(me as DbUserRow)
      : { userId: actor.userId, username: actor.tg?.username ?? null, fullName: actor.tg?.fullName ?? null, avatarUrl: actor.tg?.photoUrl ?? null },
    replyTo: verifiedReplyToId ? { commentId: verifiedReplyToId, authorName: replyToName ?? "Райдер" } : null,
    body,
    createdAt: inserted.created_at,
  };

  const { data: freshPost } = await supabaseAdmin
    .from("crew_posts")
    .select("comment_count")
    .eq("id", postRow.id)
    .maybeSingle();

  // ── Engagement notify (wall v4): автору поста, автору корневого
  // комментария (при ответе) и @упомянутым. Один DM на один комментарий
  // получателю (dedup через crew_post_notify_log), never throws —
  // сбои уведомлений не влияют на сам комментарий.
  try {
    const recipients: CommentNotifyRecipient[] = [];
    if (postRow.author_id) {
      recipients.push({ userId: postRow.author_id, reason: "post_author" });
    }
    if (replyRootAuthorId && replyRootAuthorId !== postRow.author_id) {
      recipients.push({
        userId: replyRootAuthorId,
        reason: "reply_author",
        replyToName: replyToName ?? null,
      });
    }
    const mentionNames = extractMentionUsernames(body); // регистр сохранён
    if (mentionNames.length > 0) {
      // Точное совпадение (indexed, без SQL-дикой карты): `_` в username —
      // это ПОДЧЁРКИВАНИЕ, а не wildcard (ilike превращал @ivan_petrov в
      // «ivan-что-угодно-petrov» и пинговал чужих людей). Один запрос по
      // ОБЕИМ вариантам регистра (как напечатал автор + lower) закрывает
      // оба направления: DB хранит «Sly13» при набранном «@sly13» — и наоборот.
      const variants = [...new Set([...mentionNames, ...mentionNames.map((n) => n.toLowerCase())])];
      const { data: mentionedUsers } = await supabaseAdmin
        .from("users")
        .select("user_id")
        .in("username", variants)
        .limit(WALL_MENTION_LOOKUP_CAP);
      for (const u of (mentionedUsers ?? []) as { user_id: string }[]) {
        recipients.push({ userId: u.user_id, reason: "mentioned" });
      }
    }
    // Boss-request 2026-09-21 «notify crew owner and admin about almost
    // everything»: арендатор (НЕ член экипажа) оставил комментарий → cc
    // owner+админам с головой «Арендатор прокомментировал на стене».
    // Комментарии своих членов экипажу и так видны на стене — cc не шумим.
    try {
      const { data: selfMember } = await supabaseAdmin
        .from("crew_members")
        .select("user_id")
        .eq("crew_id", postRow.crew_id)
        .eq("user_id", actor.userId)
        .eq("membership_status", "active") // codereview P2-2: паритет с isCrewStaffUser
        .maybeSingle();
      if (!selfMember) {
        const watchSlug = (crewRow as { slug: string | null }).slug || "";
        const watchIds = await resolveLeadNotifyRecipients(watchSlug, { includeMembers: false });
        const seen = new Set(recipients.map((r) => r.userId));
        for (const id of watchIds) {
          if (id && id !== actor.userId && !seen.has(id)) {
            seen.add(id);
            recipients.push({ userId: id, reason: "crew_watch" });
          }
        }
      }
    } catch (watchErr) {
      logger.warn("[community-wall] crew_watch recipients failed (non-fatal):", watchErr);
    }
    const commenterName =
      (me as DbUserRow | null)?.full_name ||
      (me as DbUserRow | null)?.username ||
      actor.tg?.fullName ||
      actor.tg?.username ||
      "Райдер";
    await notifyWallComment({
      slug: (crewRow as { slug: string | null; name: string | null }).slug || "",
      postId: postRow.id,
      commentId: inserted.id,
      commenterId: actor.userId,
      commenterName,
      commentBody: body.slice(0, 200),
      postPreview: buildWallPostPreview(postRow.body || "", 160),
      recipients,
      // Бот экипажа из metadata (фикс 2026-09-21) — env в проде пуст.
      botUsername: await resolveCrewBotUsername(
        (crewRow as { slug: string | null; name: string | null }).slug || "",
      ),
    });
  } catch (notifyErr) {
    logger.warn("[community-wall] comment notify failed (non-fatal):", notifyErr);
  }

  return { ok: true, comment, commentCount: (freshPost as { comment_count: number | null } | null)?.comment_count ?? 0 };
}

// ── MODERATION (staff) + own-post delete ─────────────────────────────────────

const ModeratePostInput = z.object({
  postId: z.string().trim().uuid(),
  initData: z.string().trim().optional(),
  hide: z.boolean(),
});

export type ModerateCommunityPostResult = { ok: true } | { ok: false; error: string };

export async function hideCommunityPostAction(input: {
  postId: string;
  initData?: string;
  hide: boolean;
}): Promise<ModerateCommunityPostResult> {
  const parsed = ModeratePostInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректный пост." };
  const { postId, initData, hide } = parsed.data;

  const actor = await resolveWallActor(initData);
  if (!actor) return { ok: false, error: "Модерация доступна экипажу." };

  const { data: post } = await supabaseAdmin
    .from("crew_posts")
    .select("id, crew_id")
    .eq("id", postId)
    .maybeSingle();
  const postRow = post as { id: string; crew_id: string } | null;
  if (!postRow) return { ok: false, error: "Пост не найден." };

  const { data: crew } = await supabaseAdmin.from("crews").select("id, owner_id").eq("id", postRow.crew_id).maybeSingle();
  if (!crew || !(await isCrewStaffUser(actor.userId, crew as Pick<DbCrew, "id" | "owner_id">))) {
    return { ok: false, error: "Недостаточно прав для модерации." };
  }

  // Hide: stamp who/when. Unhide: only flip the flag — hidden_by/hidden_at are
  // kept as an audit trail of the last moderation action (and avoid null-patch
  // typing friction on Update shapes).
  const { error } = hide
    ? await supabaseAdmin
        .from("crew_posts")
        .update({ is_hidden: true, hidden_by: actor.userId, hidden_at: new Date().toISOString() })
        .eq("id", postId)
    : await supabaseAdmin
        .from("crew_posts")
        .update({ is_hidden: false })
        .eq("id", postId);
  if (error) {
    logger.error("[community-wall] moderate post failed:", error.message);
    return { ok: false, error: "Не удалось изменить пост." };
  }

  const { revalidatePath } = await import("next/cache");
  const { data: crewSlug } = await supabaseAdmin.from("crews").select("slug").eq("id", postRow.crew_id).maybeSingle();
  if (crewSlug?.slug) revalidatePath(`/franchize/${crewSlug.slug}/community`);
  return { ok: true };
}

export async function deleteCommunityPostAction(input: {
  postId: string;
  initData?: string;
}): Promise<ModerateCommunityPostResult> {
  const parsed = z.object({ postId: z.string().trim().uuid(), initData: z.string().trim().optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректный пост." };
  const { postId, initData } = parsed.data;

  const actor = await resolveWallActor(initData);
  if (!actor) return { ok: false, error: "Только автор или экипаж может удалить пост." };

  const { data: post } = await supabaseAdmin
    .from("crew_posts")
    .select("id, crew_id, author_id")
    .eq("id", postId)
    .maybeSingle();
  const postRow = post as { id: string; crew_id: string; author_id: string } | null;
  if (!postRow) return { ok: false, error: "Пост не найден." };

  const { data: crew } = await supabaseAdmin
    .from("crews")
    .select("id, owner_id, slug")
    .eq("id", postRow.crew_id)
    .maybeSingle();
  const crewRow = crew as { id: string; owner_id: string; slug: string | null } | null;
  const isAuthor = postRow.author_id === actor.userId;
  if (!isAuthor && (!crewRow || !(await isCrewStaffUser(actor.userId, crewRow as Pick<DbCrew, "id" | "owner_id">)))) {
    return { ok: false, error: "Удалить можно только свой пост." };
  }

  // Photo cleanup: collect storage paths BEFORE the row delete (the FK cascade
  // wipes crew_post_photos), then remove the objects best-effort after.
  const { data: photoRows } = await supabaseAdmin
    .from("crew_post_photos")
    .select("storage_path")
    .eq("post_id", postId);
  const photoPaths = ((photoRows ?? []) as { storage_path: string }[])
    .map((r) => r.storage_path)
    .filter(Boolean);

  const { error } = await supabaseAdmin.from("crew_posts").delete().eq("id", postId);
  if (error) {
    logger.error("[community-wall] delete post failed:", error.message);
    return { ok: false, error: "Не удалось удалить пост." };
  }

  if (photoPaths.length > 0) {
    const { error: rmError } = await supabaseAdmin.storage.from(WALLPHOTO_BUCKET).remove(photoPaths);
    if (rmError) logger.warn("[community-wall] photo cleanup failed:", rmError.message);
  }

  const { revalidatePath } = await import("next/cache");
  if (crewRow?.slug) revalidatePath(`/franchize/${crewRow.slug}/community`);
  return { ok: true };
}

// ── PIN (staff) ─────────────────────────────────────────────────────────────

/** Max pinned posts per crew feed — keeps the page-1 keyset correct (5 « 25). */
const WALL_PIN_CAP = 5;

export async function setPostPinnedAction(input: {
  postId: string;
  pinned: boolean;
  initData?: string;
}): Promise<ModerateCommunityPostResult> {
  const parsed = z
    .object({ postId: z.string().trim().uuid(), pinned: z.boolean(), initData: z.string().trim().optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректный пост." };
  const { postId, pinned, initData } = parsed.data;

  const actor = await resolveWallActor(initData);
  if (!actor) return { ok: false, error: "Закреплять может только экипаж." };

  const { data: post } = await supabaseAdmin
    .from("crew_posts")
    .select("id, crew_id, is_hidden")
    .eq("id", postId)
    .maybeSingle();
  const postRow = post as { id: string; crew_id: string; is_hidden: boolean } | null;
  if (!postRow || postRow.is_hidden) return { ok: false, error: "Пост недоступен." };

  const { data: crew } = await supabaseAdmin
    .from("crews")
    .select("id, owner_id, slug")
    .eq("id", postRow.crew_id)
    .maybeSingle();
  const crewRow = crew as { id: string; owner_id: string; slug: string | null } | null;
  if (!crewRow || !(await isCrewStaffUser(actor.userId, crewRow as Pick<DbCrew, "id" | "owner_id">))) {
    return { ok: false, error: "Недостаточно прав для закрепления." };
  }

  if (pinned) {
    // Cap pins so page 1 always holds every pinned post (pagination invariant).
    // Soft cap: two concurrent staff pins could exceed it — acceptable, the
    // keyset stays correct while pins « page size.
    const { count } = await supabaseAdmin
      .from("crew_posts")
      .select("id", { count: "exact", head: true })
      .eq("crew_id", postRow.crew_id)
      .eq("is_pinned", true)
      .neq("id", postId);
    if ((count ?? 0) >= WALL_PIN_CAP) {
      return { ok: false, error: `Закреплённых постов максимум ${WALL_PIN_CAP} — сначала сними закреп с другого.` };
    }
  }

  const { error } = await supabaseAdmin.from("crew_posts").update({ is_pinned: pinned }).eq("id", postId);
  if (error) {
    logger.error("[community-wall] pin post failed:", error.message);
    return { ok: false, error: "Не удалось закрепить пост." };
  }

  const { revalidatePath } = await import("next/cache");
  if (crewRow.slug) revalidatePath(`/franchize/${crewRow.slug}/community`);
  return { ok: true };
}

// ── COMMENT EXPANSION (read) ────────────────────────────────────────────────

/**
 * Full comment history for ONE post (feed ships only the newest-2 preview).
 * Public read — the post must be visible; hidden comments stay out.
 */
export async function getPostCommentsAction(input: {
  postId: string;
  initData?: string;
}): Promise<{ ok: true; comments: WallCommentView[] } | { ok: false; error: string }> {
  const parsed = z
    .object({ postId: z.string().trim().uuid(), initData: z.string().trim().optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректный пост." };
  const postId = parsed.data.postId;

  const { data: post } = await supabaseAdmin
    .from("crew_posts")
    .select("id, is_hidden")
    .eq("id", postId)
    .maybeSingle();
  const postRow = post as { id: string; is_hidden: boolean } | null;
  if (!postRow || postRow.is_hidden) return { ok: false, error: "Пост недоступен." };

  const { data: rows, error } = await supabaseAdmin
    .from("crew_post_comments")
    .select("id, post_id, author_id, body, created_at, reply_to_id")
    .eq("post_id", postId)
    .eq("is_hidden", false)
    // Newest first + server-side reverse: the expansion always shows the
    // NEWEST comments (oldest of a >200-comment post scroll away, never the
    // fresh ones).
    .order("created_at", { ascending: false })
    .limit(WALL_COMMENTS_FETCH_LIMIT);
  if (error) {
    logger.error("[community-wall] comments fetch failed:", error.message);
    return { ok: false, error: "Не удалось загрузить комментарии." };
  }

  const authorIds = [...new Set(((rows ?? []) as { author_id: string }[]).map((r) => r.author_id))];
  const authors = new Map<string, WallAuthorView>();
  if (authorIds.length > 0) {
    const { data: authorRows } = await supabaseAdmin
      .from("users")
      .select("user_id, username, full_name, avatar_url")
      .in("user_id", authorIds);
    for (const row of (authorRows ?? []) as DbUserRow[]) authors.set(row.user_id, toAuthorView(row));
  }

  const comments: WallCommentView[] = ((rows ?? []) as {
    id: string;
    post_id: string;
    author_id: string;
    body: string;
    created_at: string;
    reply_to_id: string | null;
  }[])
    .map((row) => ({
      id: row.id,
      postId: row.post_id,
      author: authors.get(row.author_id) ?? { userId: row.author_id, username: null, fullName: null, avatarUrl: null },
      replyTo: null as WallCommentView["replyTo"],
      body: row.body,
      createdAt: row.created_at,
    }))
    // Flip newest-first → chronological for rendering.
    .reverse();

  // Reply prefixes (VK «Имя ответил(а)…»): one bounded fetch for targets.
  const enricher = createReplyEnricher();
  for (const c of ((rows ?? []) as { id: string; reply_to_id: string | null }[])) {
    if (c.reply_to_id) enricher.add(c.id, c.reply_to_id);
  }
  await enricher.resolve(authors, (commentId, replyTo) => {
    const c = comments.find((x) => x.id === commentId);
    if (c) c.replyTo = replyTo;
  });

  return { ok: true, comments };
}

export async function hideCommunityCommentAction(input: {
  commentId: string;
  initData?: string;
  hide: boolean;
}): Promise<ModerateCommunityPostResult> {
  const parsed = z
    .object({ commentId: z.string().trim().uuid(), initData: z.string().trim().optional(), hide: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректный комментарий." };
  const { commentId, initData, hide } = parsed.data;

  const actor = await resolveWallActor(initData);
  if (!actor) return { ok: false, error: "Модерация доступна экипажу." };

  const { data: comment } = await supabaseAdmin
    .from("crew_post_comments")
    .select("id, crew_id")
    .eq("id", commentId)
    .maybeSingle();
  const row = comment as { id: string; crew_id: string } | null;
  if (!row) return { ok: false, error: "Комментарий не найден." };

  const { data: crew } = await supabaseAdmin.from("crews").select("id, owner_id").eq("id", row.crew_id).maybeSingle();
  if (!crew || !(await isCrewStaffUser(actor.userId, crew as Pick<DbCrew, "id" | "owner_id">))) {
    return { ok: false, error: "Недостаточно прав для модерации." };
  }

  const { error } = await supabaseAdmin
    .from("crew_post_comments")
    .update({ is_hidden: hide })
    .eq("id", commentId);
  if (error) {
    logger.error("[community-wall] moderate comment failed:", error.message);
    return { ok: false, error: "Не удалось изменить комментарий." };
  }
  return { ok: true };
}

// ── MY STATS PREVIEW (composer) ──────────────────────────────────────────────

const MyStatsInput = z.object({
  slug: z.string().trim().min(1),
  initData: z.string().trim().optional(),
});

export type GetMyRentalStatsResult =
  | { ok: true; stats: RentalStatsSnapshot; autoText: string }
  | { ok: false; error: string };

export async function getMyRentalStatsAction(input: {
  slug: string;
  initData?: string;
}): Promise<GetMyRentalStatsResult> {
  const parsed = MyStatsInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректный запрос." };

  const crew = await getCrewBySlug(parsed.data.slug);
  if (!crew) return { ok: false, error: "Экипаж не найден." };

  const actor = await resolveWallActor(parsed.data.initData);
  if (!actor) return { ok: false, error: "Статистика доступна из Telegram-бота экипажа." };

  const stats = await computeMyCrewStats(actor.userId, crew.id);
  return { ok: true, stats, autoText: buildStatsPostBody(stats) };
}

// ── BIKE PICKER OPTIONS (composer «прикрепить байк») ────────────────────────

export interface WallBikeOption {
  bikeId: string;
  title: string;
  imageUrl: string | null;
}

export type GetWallBikeOptionsResult =
  | { ok: true; bikes: WallBikeOption[] }
  | { ok: false; error: string };

/**
 * Catalogue bikes of the crew for the composer's mention picker. Public read
 * (the catalogue itself is public) — no identity required: anonymous visitors
 * just never see the composer.
 */
export async function getWallBikeOptionsAction(input: {
  slug: string;
}): Promise<GetWallBikeOptionsResult> {
  const parsed = z.object({ slug: z.string().trim().min(1) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректный запрос." };

  const crew = await getCrewBySlug(parsed.data.slug);
  if (!crew) return { ok: false, error: "Экипаж не найден." };

  const { data, error } = await supabaseAdmin
    .from("cars")
    .select("id, model, image_url")
    .eq("crew_id", crew.id)
    .eq("type", "bike")
    .order("model", { ascending: true })
    .limit(60);
  if (error) {
    logger.error("[community-wall] bike options failed:", error.message);
    return { ok: false, error: "Не удалось загрузить каталог." };
  }
  const bikes: WallBikeOption[] = ((data ?? []) as { id: string; model: string | null; image_url: string | null }[]).map(
    (b) => ({ bikeId: String(b.id), title: b.model || String(b.id), imageUrl: b.image_url ?? null }),
  );
  return { ok: true, bikes };
}

// ── TRENDING TAGS (7 days) + weekly pulse ────────────────────────────────────

export interface WallTrendingTag {
  tag: string;
  count: number;
}

export type GetWallTrendingResult =
  | { ok: true; tags: WallTrendingTag[]; weekPosts: number }
  | { ok: false; error: string };

/**
 * Top-5 crew hashtags of the rolling week + how many posts the crew shared
 * in 7 days. Tags are counted in JS over one bounded fetch (≤ ~2k rows at
 * this scale) — no RPC needed; the (crew_id, tag, created_at) index serves it.
 */
export async function getWallTrendingAction(input: { slug: string }): Promise<GetWallTrendingResult> {
  const parsed = z.object({ slug: z.string().trim().min(1) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректный запрос." };

  const crew = await getCrewBySlug(parsed.data.slug);
  if (!crew) return { ok: false, error: "Экипаж не найден." };

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: tagRows }, { count: weekPosts }] = await Promise.all([
    supabaseAdmin
      .from("crew_post_tags")
      .select("tag")
      .eq("crew_id", crew.id)
      .gte("created_at", weekAgo)
      .limit(2000),
    supabaseAdmin
      .from("crew_posts")
      .select("id", { count: "exact", head: true })
      .eq("crew_id", crew.id)
      .eq("is_hidden", false)
      .gte("created_at", weekAgo),
  ]);

  const counts = new Map<string, number>();
  for (const row of (tagRows ?? []) as { tag: string }[]) {
    counts.set(row.tag, (counts.get(row.tag) ?? 0) + 1);
  }
  const tags: WallTrendingTag[] = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, 5);

  return { ok: true, tags, weekPosts: weekPosts ?? 0 };
}

// ── CREW STANDINGS («Зачёт экипажа») ─────────────────────────────────────────
// The standout feature Chain cannot copy: our crews own a REAL fleet, so the
// weekly leaderboard is built from real ride events (rentals on real bikes),
// not from self-reported activity. Public + money-free: the same stance as
// the wall itself (posts are public, ₽ never leaves staff surfaces).

export interface WallStandingsEntry {
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

export type GetWallStandingsResult =
  | {
      ok: true;
      /** Ranked entries (best first), capped — the wall shows top-5, the
       *  rider profile finds its own row for the «#N недели» chip. */
      standings: WallStandingsEntry[];
      weekRides: number;
      weekPosts: number;
    }
  | { ok: false; error: string };

export async function getWallStandingsAction(input: { slug: string }): Promise<GetWallStandingsResult> {
  const parsed = z.object({ slug: z.string().trim().min(1) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректный запрос." };

  const crew = await getCrewBySlug(parsed.data.slug);
  if (!crew) return { ok: false, error: "Экипаж не найден." };

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Two bounded fetches (≤ ~2k rows each at NN scale — same budget as the
  // trending strip). NO money columns are selected, ever: the standings are
  // public while rental money stays a staff-only surface.
  const [ridesRes, postsRes] = await Promise.all([
    supabaseAdmin
      .from("rentals")
      .select("user_id, status, agreed_start_date, vehicle:cars(type)")
      .eq("crew_id", crew.id)
      .gte("agreed_start_date", weekAgo)
      .limit(2000),
    supabaseAdmin
      .from("crew_posts")
      .select("author_id, body, like_count")
      .eq("crew_id", crew.id)
      .eq("is_hidden", false)
      .gte("created_at", weekAgo)
      .limit(2000),
  ]);

  const rideRows = (ridesRes.data ?? []) as unknown as {
    user_id: string | null;
    status: string | null;
    vehicle?: { type?: string | null } | null;
  }[];
  const postRows = (postsRes.data ?? []) as unknown as {
    author_id: string | null;
    body: string | null;
    like_count?: number | string | null;
  }[];

  // Names/avatars for everyone who scored anything (≤ 50 rows via the lib cap).
  const touched = new Set<string>();
  for (const r of rideRows) if (r.user_id) touched.add(r.user_id);
  for (const p of postRows) if (p.author_id) touched.add(p.author_id);
  const usersById = new Map<string, CrewStandingsUserRef>();
  if (touched.size > 0) {
    const { data: userRows } = await supabaseAdmin
      .from("users")
      .select("user_id, username, full_name, avatar_url")
      .in("user_id", [...touched].slice(0, 200));
    for (const row of (userRows ?? []) as { user_id: string; username: string | null; full_name: string | null; avatar_url: string | null }[]) {
      usersById.set(row.user_id, { fullName: row.full_name, username: row.username, avatarUrl: row.avatar_url });
    }
  }

  const standings: WallStandingsEntry[] = computeCrewStandings(
    rideRows.map((r) => ({ user_id: r.user_id, status: r.status, vehicleType: r.vehicle?.type ?? null })),
    postRows.map((p) => ({ author_id: p.author_id, body: p.body, like_count: p.like_count })),
    usersById,
  );

  const weekRides = rideRows.filter((r) => RIDE_SCORING_STATUSES.has(r.status ?? "") && r.vehicle?.type === "bike").length;

  return { ok: true, standings, weekRides, weekPosts: postRows.length };
}

// ── NEW-POSTS PROBE (background pill) ───────────────────────────────────────

export type CountNewWallPostsResult =
  | { ok: true; count: number; bikesBusy: { bikeId: string; busyUntilIso: string | null }[] }
  | { ok: false; error: string };

/**
 * How many fresh posts appeared after the newest one the viewer already has.
 * Cheap head-count, polled on an interval by the «N новых постов» pill —
 * no new tables, composes with the existing keyset. When the client passes
 * the currently-mentioned bike ids, the probe ALSO returns fresh live
 * availability for them, so «в аренде до ~19:30» dots never go stale during
 * a long session.
 */
export async function countNewWallPostsAction(input: {
  slug: string;
  /** created_at ISO of the newest post currently on the viewer's screen. */
  after: string;
  /** Currently-mentioned catalogue bike ids on screen (optional). */
  bikeIds?: string[];
}): Promise<CountNewWallPostsResult> {
  const parsed = z
    .object({
      slug: z.string().trim().min(1),
      after: z
        .string()
        .trim()
        .refine((v) => !Number.isNaN(Date.parse(v)), "after must be a parseable ISO date"),
      bikeIds: z.array(z.string().trim().min(1).max(128)).max(60).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректный запрос." };

  const crew = await getCrewBySlug(parsed.data.slug);
  if (!crew) return { ok: false, error: "Экипаж не найден." };

  const { count, error } = await supabaseAdmin
    .from("crew_posts")
    .select("id", { count: "exact", head: true })
    .eq("crew_id", crew.id)
    .eq("is_hidden", false)
    .gt("created_at", parsed.data.after);
  if (error) {
    logger.error("[community-wall] new-posts probe failed:", error.message);
    return { ok: false, error: "Не удалось проверить новые посты." };
  }

  const bikeIds = parsed.data.bikeIds ?? [];
  if (bikeIds.length === 0) return { ok: true, count: count ?? 0, bikesBusy: [] };

  const { data: busyRows } = await supabaseAdmin
    .from("rentals")
    .select("vehicle_id, status, requested_start_date, requested_end_date, agreed_start_date, agreed_end_date")
    .in("vehicle_id", bikeIds)
    .in("status", WALL_BLOCKING_RENTAL_STATUSES);
  const busyMs = wallBusyUntilMap((busyRows ?? []) as never[], Date.now());
  const bikesBusy = bikeIds.map((bikeId) => ({
    bikeId,
    busyUntilIso: busyMs.has(bikeId) ? new Date(busyMs.get(bikeId)!).toISOString() : null,
  }));
  return { ok: true, count: count ?? 0, bikesBusy };
}

// ── SINGLE POST (deep-link landing: startapp=post_<id>_<slug>) ───────────────

const SinglePostInput = z.object({
  slug: z.string().trim().min(1),
  postId: z.string().trim().uuid(),
});

export type GetWallPostResult =
  | { ok: true; post: WallPostView }
  | { ok: false; error: string };

/**
 * Один пост по id — для deep-link посадки, когда пост старый и не попал в
 * первую страницу ленты (кнопки уведомлений и «Поделиться» должны вести К
 * ПОСТУ, а не к верху стены). Публичное чтение, как и вся лента. Вернёт
 * error для скрытых/чужих экипажей — как если бы поста не было.
 */
export async function getWallPostAction(input: {
  slug: string;
  postId: string;
}): Promise<GetWallPostResult> {
  const parsed = SinglePostInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректный запрос." };

  const crew = await getCrewBySlug(parsed.data.slug);
  if (!crew) return { ok: false, error: "Экипаж не найден." };

  const { data: row } = await supabaseAdmin
    .from("crew_posts")
    .select("*")
    .eq("id", parsed.data.postId)
    .eq("crew_id", crew.id)
    .eq("is_hidden", false)
    .maybeSingle();
  const postRow = row as DbPostRow | null;
  if (!postRow) return { ok: false, error: "Пост недоступен." };

  const { data: authorRow } = await supabaseAdmin
    .from("users")
    .select("user_id, username, full_name, avatar_url")
    .eq("user_id", postRow.author_id)
    .maybeSingle();
  const author = authorRow
    ? toAuthorView(authorRow as DbUserRow)
    : { userId: postRow.author_id, username: null, fullName: null, avatarUrl: null };

  // Comments preview (same 2-newest contract as the feed).
  const { data: commentRows } = await supabaseAdmin
    .from("crew_post_comments")
    .select("id, post_id, author_id, body, created_at, reply_to_id")
    .eq("post_id", postRow.id)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(WALL_COMMENT_PREVIEW);
  const commentAuthorIds = [...new Set(((commentRows ?? []) as { author_id: string }[]).map((c) => c.author_id))];
  const { data: commentAuthors } = commentAuthorIds.length
    ? await supabaseAdmin
        .from("users")
        .select("user_id, username, full_name, avatar_url")
        .in("user_id", commentAuthorIds)
    : { data: null };
  const cAuthors = new Map<string, WallAuthorView>();
  for (const row of (commentAuthors ?? []) as DbUserRow[]) cAuthors.set(row.user_id, toAuthorView(row));
  const comments: WallCommentView[] = ((commentRows ?? []) as {
    id: string;
    post_id: string;
    author_id: string;
    body: string;
    created_at: string;
  }[])
    .slice(0, WALL_COMMENT_PREVIEW)
    .map((c) => ({
      id: c.id,
      postId: c.post_id,
      author: cAuthors.get(c.author_id) ?? { userId: c.author_id, username: null, fullName: null, avatarUrl: null },
      replyTo: null,
      body: c.body,
      createdAt: c.created_at,
    }))
    .reverse();

  // Photos + bike mentions (+ live availability) in parallel.
  const [photosRes, bikesRes] = await Promise.all([
    supabaseAdmin
      .from("crew_post_photos")
      .select("id, post_id, storage_path, width, height")
      .eq("post_id", postRow.id)
      .order("position", { ascending: true }),
    supabaseAdmin
      .from("crew_post_bikes")
      .select("post_id, bike_id, cars(id, model, image_url)")
      .eq("post_id", postRow.id)
      .order("position", { ascending: true }),
  ]);
  const photos: WallPhotoView[] = ((photosRes.data ?? []) as {
    id: string;
    storage_path: string;
    width: number | null;
    height: number | null;
  }[]).map((p) => ({
    id: p.id,
    url: wallPhotoPublicUrl(p.storage_path),
    width: p.width,
    height: p.height,
  }));
  const bikes: WallBikeRefView[] = [];
  for (const row of (bikesRes.data ?? []) as unknown as {
    bike_id: string;
    cars: { model: string | null; image_url: string | null } | null;
  }[]) {
    bikes.push({
      bikeId: row.bike_id,
      title: row.cars?.model || "Байк",
      imageUrl: row.cars?.image_url ?? null,
      busyUntilIso: null,
    });
  }
  const mentionIds = bikes.map((b) => b.bikeId);
  if (mentionIds.length > 0) {
    const { data: busyRows } = await supabaseAdmin
      .from("rentals")
      .select("vehicle_id, status, requested_start_date, requested_end_date, agreed_start_date, agreed_end_date")
      .in("vehicle_id", mentionIds)
      .in("status", WALL_BLOCKING_RENTAL_STATUSES);
    const busyMs = wallBusyUntilMap((busyRows ?? []) as never[], Date.now());
    for (const bike of bikes) {
      const until = busyMs.get(bike.bikeId);
      bike.busyUntilIso = until ? new Date(until).toISOString() : null;
    }
  }

  // Rental ref (если пост привязан к аренде).
  let rental: WallRentalRef | null = null;
  if (postRow.rental_id) {
    const { data: rentalRow } = await supabaseAdmin
      .from("rentals")
      .select("rental_id, vehicle_id")
      .eq("rental_id", postRow.rental_id)
      .maybeSingle();
    const r = rentalRow as { rental_id: string; vehicle_id: string | null } | null;
    if (r?.vehicle_id) {
      const { data: bike } = await supabaseAdmin
        .from("cars")
        .select("id, model, image_url")
        .eq("id", r.vehicle_id)
        .maybeSingle();
      const b = bike as { model: string | null; image_url: string | null } | null;
      rental = { rentalId: r.rental_id, bikeTitle: b?.model || "Байк", imageUrl: b?.image_url ?? null };
    }
  }

  const post: WallPostView = {
    id: postRow.id,
    kind: postRow.kind === "stats" ? "stats" : "post",
    body: postRow.body,
    stats: postRow.kind === "stats" ? sanitizeStatsSnapshot(postRow.stats) : null,
    authorScope: postRow.author_scope === "crew" ? "crew" : "rider",
    isPinned: postRow.is_pinned,
    createdAt: postRow.created_at,
    likeCount: postRow.like_count ?? 0,
    commentCount: postRow.comment_count ?? 0,
    reactionCounts: sanitizeReactionCounts(postRow.reaction_counts),
    viewerReaction: null, // deep-link посадка — viewer ещё не «себя» показал; подгрузка ленты поправит
    author,
    comments,
    rental,
    photos,
    bikes,
  };
  return { ok: true, post };
}

// ── RENTAL COMPOSE DRAFT («поделиться поездкой» из уведомления о закрытии) ──

const RentalDraftInput = z.object({
  slug: z.string().trim().min(1),
  rentalId: z.string().trim().uuid(),
  initData: z.string().trim().optional(),
});

export interface WallRentalDraft {
  rentalId: string;
  bikeId: string | null;
  bikeTitle: string;
  hours: number;
  days: number | null;
  km: number | null;
  totalCost: number;
  depositReturned: boolean | null;
  periodStartIso: string | null;
  periodEndIso: string | null;
  crewName: string;
  /** Готовый текст поста (summary baked in) — редактируемый. */
  autoText: string;
  /** true — актор владеет арендой и МОЖЕТ прикрепить rentalId к посту. */
  canAttachRental: boolean;
}

export type GetWallRentalDraftResult =
  | { ok: true; draft: WallRentalDraft }
  | { ok: false; error: string };

/**
 * Черновик поста из закрытой аренды: сводка поездки + готовый текст.
 * Доступно арендатору этой аренды ИЛИ staff экипажа (арендаторы постят наравне
 * с экипажем — canWriteOnWall). Прикрепить rental_id к посту может только
 * владелец аренды (createCommunityPostAction это отдельно проверит).
 */
export async function getWallRentalDraftAction(input: {
  slug: string;
  rentalId: string;
  initData?: string;
}): Promise<GetWallRentalDraftResult> {
  const parsed = RentalDraftInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректный запрос." };

  const crew = await getCrewBySlug(parsed.data.slug);
  if (!crew) return { ok: false, error: "Экипаж не найден." };

  const actor = await resolveWallActor(parsed.data.initData);
  if (!actor) return { ok: false, error: "Черновик доступен из Telegram-бота экипажа." };

  const { data: rentalRow } = await supabaseAdmin
    .from("rentals")
    .select(
      "rental_id, user_id, crew_id, vehicle_id, total_cost, agreed_start_date, agreed_end_date, requested_start_date, requested_end_date, metadata, status, cars(id, model, image_url)",
    )
    .eq("rental_id", parsed.data.rentalId)
    .maybeSingle();
  const r = rentalRow as {
    rental_id: string;
    user_id: string | null;
    crew_id: string;
    vehicle_id: string | null;
    total_cost: number | string | null;
    agreed_start_date: string | null;
    agreed_end_date: string | null;
    requested_start_date: string | null;
    requested_end_date: string | null;
    metadata: Record<string, unknown> | null;
    status: string | null;
    cars: { id: string; model: string | null; image_url: string | null } | null;
  } | null;
  if (!r || r.crew_id !== crew.id) return { ok: false, error: "Аренда не найдена в этом экипаже." };

  const isOwner = !!r.user_id && r.user_id === actor.userId;
  const isStaff = await isCrewStaffUser(actor.userId, crew);
  if (!isOwner && !isStaff) {
    return { ok: false, error: "Этот черновик — для райдера и экипажа." };
  }

  const md = (r.metadata ?? {}) as Record<string, unknown>;
  const odoBefore = Number.isFinite(Number(md.odometer_before ?? md.odometerBefore))
    ? Number(md.odometer_before ?? md.odometerBefore)
    : null;
  const odoAfter = Number.isFinite(Number(md.odometer_after ?? md.odometerAfter))
    ? Number(md.odometer_after ?? md.odometerAfter)
    : null;
  const depositReturned =
    typeof r.metadata === "object" && r.metadata !== null && "deposit_returned" in (r.metadata as Record<string, unknown>)
      ? Boolean((r.metadata as Record<string, unknown>).deposit_returned)
      : null;

  const bikeTitle = r.cars?.model || "Байк";
  const draft = summarizeRide({
    bikeTitle,
    startIso: r.agreed_start_date ?? r.requested_start_date,
    endIso: r.agreed_end_date ?? r.requested_end_date,
    totalCost: r.total_cost,
    odometerBefore: odoBefore,
    odometerAfter: odoAfter,
    depositReturned,
    crewName: crew.name || crew.slug || "экипаж",
    crewSlug: crew.slug,
  });

  return {
    ok: true,
    draft: {
      rentalId: r.rental_id,
      bikeId: r.cars?.id ?? null,
      bikeTitle,
      hours: draft.hours,
      days: draft.days,
      km: draft.km,
      totalCost: draft.totalCost,
      depositReturned,
      periodStartIso: r.agreed_start_date ?? r.requested_start_date,
      periodEndIso: r.agreed_end_date ?? r.requested_end_date,
      crewName: crew.name || crew.slug || "экипаж",
      autoText: buildSuggestedWallPost(draft),
      canAttachRental: isOwner,
    },
  };
}

// ── RIDE COMPOSE DRAFT (map-riders заезд → пост на стене) ────────────────────

const RideDraftInput = z.object({
  slug: z.string().trim().min(1),
  sessionId: z.string().trim().uuid(),
  initData: z.string().trim().optional(),
});

export interface WallRideDraft {
  sessionId: string;
  rideName: string | null;
  vehicleLabel: string | null;
  rideMode: string | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  maxSpeedKmh: number | null;
  avgSpeedKmh: number | null;
  startedAtIso: string | null;
  crewName: string;
  /** Готовый текст поста (статистика заезда baked in) — редактируемый. */
  autoText: string;
}

export type GetWallRideDraftResult =
  | { ok: true; draft: WallRideDraft }
  | { ok: false; error: string };

/**
 * Черновик поста «поделиться заездом» из завершённой/активной сессии
 * map-riders. Читает ТОЛЬКО свою сессию (или staff экипажа) — чужие сессии
 * не утекают (по аналогии с getWallRentalDraftAction: черновик — для
 * автора заезда и staff).
 */
export async function getWallRideDraftAction(input: {
  slug: string;
  sessionId: string;
  initData?: string;
}): Promise<GetWallRideDraftResult> {
  const parsed = RideDraftInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректный запрос." };

  const crew = await getCrewBySlug(parsed.data.slug);
  if (!crew) return { ok: false, error: "Экипаж не найден." };

  const actor = await resolveWallActor(parsed.data.initData);
  if (!actor) return { ok: false, error: "Черновик доступен из Telegram-бота экипажа." };

  const { data: sessionRow } = await supabaseAdmin
    .from("map_rider_sessions")
    .select(
      "id, crew_slug, user_id, ride_name, vehicle_label, ride_mode, total_distance_km, duration_seconds, max_speed_kmh, avg_speed_kmh, started_at, status",
    )
    .eq("id", parsed.data.sessionId)
    .maybeSingle();
  const s = sessionRow as {
    id: string;
    crew_slug: string;
    user_id: string;
    ride_name: string | null;
    vehicle_label: string | null;
    ride_mode: string | null;
    total_distance_km: number | null;
    duration_seconds: number | null;
    max_speed_kmh: number | null;
    avg_speed_kmh: number | null;
    started_at: string | null;
    status: string | null;
  } | null;
  if (!s) return { ok: false, error: "Заезд не найден — обнови страницу." };
  // Сессия не из этого экипажа → не показываем (не раскрываем существование).
  if (s.crew_slug !== crew.slug) return { ok: false, error: "Заезд не найден в этом экипаже." };

  const isOwner = !!s.user_id && s.user_id === actor.userId;
  const isStaff = await isCrewStaffUser(actor.userId, crew);
  if (!isOwner && !isStaff) {
    return { ok: false, error: "Этот черновик — для автора заезда и экипажа." };
  }

  const crewName = crew.name || crew.slug || "экипаж";
  const autoText = buildRideSessionDraftText({
    sessionId: s.id,
    rideName: s.ride_name,
    vehicleLabel: s.vehicle_label,
    rideMode: s.ride_mode,
    distanceKm: Number.isFinite(Number(s.total_distance_km)) ? Number(s.total_distance_km) : null,
    durationSeconds: Number.isFinite(Number(s.duration_seconds)) ? Number(s.duration_seconds) : null,
    maxSpeedKmh: Number.isFinite(Number(s.max_speed_kmh)) ? Number(s.max_speed_kmh) : null,
    avgSpeedKmh: Number.isFinite(Number(s.avg_speed_kmh)) ? Number(s.avg_speed_kmh) : null,
    startedAtIso: s.started_at,
    crewName,
  });

  return {
    ok: true,
    draft: {
      sessionId: s.id,
      rideName: s.ride_name,
      vehicleLabel: s.vehicle_label,
      rideMode: s.ride_mode,
      distanceKm: Number.isFinite(Number(s.total_distance_km)) ? Number(s.total_distance_km) : null,
      durationSeconds: Number.isFinite(Number(s.duration_seconds)) ? Number(s.duration_seconds) : null,
      maxSpeedKmh: Number.isFinite(Number(s.max_speed_kmh)) ? Number(s.max_speed_kmh) : null,
      avgSpeedKmh: Number.isFinite(Number(s.avg_speed_kmh)) ? Number(s.avg_speed_kmh) : null,
      startedAtIso: s.started_at,
      crewName,
      autoText,
    },
  };
}
