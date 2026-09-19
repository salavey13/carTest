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
  wallPhotoPublicUrl,
  WALL_BIKES_MAX,
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
}): Promise<GetCommunityWallResult> {
  const parsed = FeedInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректный запрос ленты." };
  const { slug, initData, before } = parsed.data;
  const pageSize = WALL_FEED_PAGE_SIZE;

  const crew = await getCrewBySlug(slug);
  if (!crew) return { ok: false, error: "Экипаж не найден." };

  const actor = await resolveWallActor(initData);
  const isStaff = actor ? await isCrewStaffUser(actor.userId, crew) : false;
  const viewer: WallViewerInfo = { userId: actor?.userId ?? null, isCrewStaff: isStaff };

  // 1. Posts page (pinned first, then newest).
  let query = supabaseAdmin
    .from("crew_posts")
    .select("*")
    .eq("crew_id", crew.id)
    .eq("is_hidden", false)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(pageSize + 1);
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

  const rows = (postRows ?? []) as DbPostRow[];
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
    .select("id, post_id, author_id, body, created_at")
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
  for (const row of (commentRows ?? []) as {
    id: string;
    post_id: string;
    author_id: string;
    body: string;
    created_at: string;
  }[]) {
    const list = commentsByPost.get(row.post_id) ?? [];
    // Rows arrive newest-first; keep only the first WALL_COMMENT_PREVIEW per post.
    if (list.length < WALL_COMMENT_PREVIEW) {
      list.push({
        id: row.id,
        postId: row.post_id,
        author: authors.get(row.author_id) ?? { userId: row.author_id, username: null, fullName: null, avatarUrl: null },
        body: row.body,
        createdAt: row.created_at,
      });
    }
    commentsByPost.set(row.post_id, list);
  }
  // Flip each preview back to chronological order (oldest → newest).
  for (const list of commentsByPost.values()) list.reverse();

  // 4. Optional rental refs (bike title + photo for attached rides).
  const rentalIds = [...new Set(pageRows.map((p) => p.rental_id).filter((id): id is string => !!id))];
  const rentalRefs = new Map<string, WallRentalRef>();
  if (rentalIds.length > 0) {
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
  }

  // 4b. Post photos (public wallpix URLs — no signed-URL round trips).
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

  // 4c. Bike mentions (catalogue card data via the FK embed).
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
    });
    bikesByPost.set(row.post_id, list);
  }

  // 5. The viewer's own reactions for the page (counts live on crew_posts,
  // maintained by the DB trigger — never recomputed here).
  const viewerReactions = new Map<string, string>();
  if (actor && postIds.length > 0) {
    const { data: reactionRows } = await supabaseAdmin
      .from("crew_post_reactions")
      .select("post_id, emoji")
      .eq("user_id", actor.userId)
      .in("post_id", postIds);
    for (const row of (reactionRows ?? []) as { post_id: string; emoji: string }[]) {
      viewerReactions.set(row.post_id, row.emoji);
    }
  }

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
      return { bikeId: id, title: row?.model || "Байк", imageUrl: row?.image_url ?? null };
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
      authorName,
      body: finalBody,
      photoCount: photoViews.length,
      bikeTitles: bikeRefs.map((b) => b.title),
      hasStats: statsSnapshot !== null,
      excludeUserId: actor.userId,
      recentAuthorPosts: authorPostsLastHour,
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
 * tap another emoji = switch. Counters come back from the DB (trigger-fed),
 * so the client never guesses the aggregate after a round trip.
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

  const { data: post } = await supabaseAdmin
    .from("crew_posts")
    .select("id, is_hidden")
    .eq("id", postId)
    .maybeSingle();
  const postRow = post as { id: string; is_hidden: boolean } | null;
  if (!postRow || postRow.is_hidden) return { ok: false, error: "Пост недоступен." };

  const { data: existing } = await supabaseAdmin
    .from("crew_post_reactions")
    .select("emoji")
    .eq("post_id", postId)
    .eq("user_id", actor.userId)
    .maybeSingle();
  const existingEmoji = (existing as { emoji: string } | null)?.emoji ?? null;

  let finalEmoji: string | null = emoji;
  if (existingEmoji === emoji) {
    // Re-tap the same emoji → remove (VK undo).
    const { error } = await supabaseAdmin
      .from("crew_post_reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", actor.userId);
    if (error) {
      logger.error("[community-wall] reaction remove failed:", error.message);
      return { ok: false, error: "Не получилось убрать реакцию." };
    }
    finalEmoji = null;
  } else if (existingEmoji) {
    // Switch emoji: same PK, update the row (trigger moves the counts).
    const { error } = await supabaseAdmin
      .from("crew_post_reactions")
      .update({ emoji })
      .eq("post_id", postId)
      .eq("user_id", actor.userId);
    if (error) {
      logger.error("[community-wall] reaction switch failed:", error.message);
      return { ok: false, error: "Не получилось переключить реакцию." };
    }
  } else {
    const { error } = await supabaseAdmin
      .from("crew_post_reactions")
      .insert({ post_id: postId, user_id: actor.userId, emoji });
    if (error) {
      // PK race (double tap on a post I hadn't reacted to yet): the row now
      // exists — fall through and read the fresh aggregate instead of lying.
      if (error.code !== "23505") {
        logger.error("[community-wall] reaction insert failed:", error.message);
        return { ok: false, error: "Не получилось поставить реакцию." };
      }
      finalEmoji = emoji;
    }
  }

  const { data: fresh } = await supabaseAdmin
    .from("crew_posts")
    .select("like_count, reaction_counts")
    .eq("id", postId)
    .maybeSingle();
  return {
    ok: true,
    reaction: finalEmoji,
    likeCount: (fresh as { like_count: number | null } | null)?.like_count ?? 0,
    reactionCounts: sanitizeReactionCounts((fresh as { reaction_counts: unknown } | null)?.reaction_counts),
  };
}

// ── ADD COMMENT ──────────────────────────────────────────────────────────────

const AddCommentInput = z.object({
  postId: z.string().trim().uuid(),
  body: z.string().trim().min(1).max(WALL_COMMENT_MAX_LEN),
  initData: z.string().trim().optional(),
});

export type AddPostCommentResult =
  | { ok: true; comment: WallCommentView; commentCount: number }
  | { ok: false; error: string };

export async function addPostCommentAction(input: {
  postId: string;
  body: string;
  initData?: string;
}): Promise<AddPostCommentResult> {
  const parsed = AddCommentInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Комментарий пустой или слишком длинный." };
  const { postId, initData } = parsed.data;
  const body = parsed.data.body.trim();

  const actor = await resolveWallActor(initData);
  if (!actor) {
    return { ok: false, error: "Комментировать можно из Telegram-бота экипажа — открой страницу через бота." };
  }

  const { data: post } = await supabaseAdmin
    .from("crew_posts")
    .select("id, crew_id, is_hidden")
    .eq("id", postId)
    .maybeSingle();
  const postRow = post as { id: string; crew_id: string; is_hidden: boolean } | null;
  if (!postRow || postRow.is_hidden) return { ok: false, error: "Пост недоступен." };

  // Same write scope + rate brake as posts (crew riders & staff only).
  const { data: crewRow } = await supabaseAdmin
    .from("crews")
    .select("id, owner_id")
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
    .insert({ post_id: postRow.id, crew_id: postRow.crew_id, author_id: actor.userId, body })
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
    body,
    createdAt: inserted.created_at,
  };

  const { data: freshPost } = await supabaseAdmin
    .from("crew_posts")
    .select("comment_count")
    .eq("id", postRow.id)
    .maybeSingle();

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
    .select("id, post_id, author_id, body, created_at")
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
  }[])
    .map((row) => ({
      id: row.id,
      postId: row.post_id,
      author: authors.get(row.author_id) ?? { userId: row.author_id, username: null, fullName: null, avatarUrl: null },
      body: row.body,
      createdAt: row.created_at,
    }))
    // Flip newest-first → chronological for rendering.
    .reverse();
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
