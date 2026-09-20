"use server";
// app/franchize/server-actions/rider-profile.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// Rider profile v1 (Chain-inspired) — server actions.
//
//   · getRiderProfileAction  — public (money-free) profile view; the OWNER
//     gets their customization payload back, others get the sanitized public
//     form. hideProfile collapses the view for everyone except owner/staff.
//   · saveRiderProfileAction — owner-only customization (bio/city/status/
//     hideProfile), server-side sanitize + cap; zod gates the transport.
//   · getPostReactionsAction — «Кому понравилось»: per-emoji reactor lists.
//     PRIVACY: authenticated viewers only — mirrors the reactions table
//     stance (no anon SELECT policy; see migration 20260920010000).
//
// SECURITY MODEL (mirrors community-wall.ts):
//   identity  — signed TELEGRAM_ACTOR_COOKIE or HMAC-verified initData
//               (resolveWallActor); anonymous = read-only public parts;
//   write     — ONLY the profile owner mutates their own payload (no staff
//               override: a bio is personal, not moderation surface);
//   inputs    — zod schemas + lib-level sanitize (defense in depth);
//   privacy   — public stats NEVER include ₽/phone/passport; TG usernames
//               are exposed only as deep-link buttons, never raw text.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getCrewBySlug, resolveWallActor, isCrewStaffUser } from "@/app/franchize/lib/wall-access";
import { resolveCrewBotUsername } from "@/app/franchize/lib/crew-bot";
import {
  EMPTY_RIDER_PROFILE_CUSTOM,
  RIDER_BIO_MAX_LEN,
  RIDER_CITY_MAX_LEN,
  RIDER_STATUS_EMOJIS,
  RIDER_STATUS_TEXT_MAX_LEN,
  computeRiderWallBadges,
  riderSinceLabel,
  sanitizeRiderProfileCustom,
  type RiderProfileCustom,
  type RiderPublicStats,
  type RiderRentalRef,
  type RiderWallBadge,
} from "@/app/franchize/lib/rider-profile";
import {
  computeRiderStats,
  type RentalStatsSnapshot,
  type StatsBikeInfo,
  type StatsRentalRow,
} from "@/app/franchize/lib/community-wall";

// ── schemas ──────────────────────────────────────────────────────────────────

const RIDER_ID_RE = /^[0-9]{1,16}$/; // Telegram numeric ids (users.user_id)

const GetProfileInput = z.object({
  slug: z.string().trim().min(1).max(64),
  riderId: z.string().trim().regex(RIDER_ID_RE, "riderId must be a TG numeric id"),
  initData: z.string().trim().optional(),
});

const SaveProfileInput = z.object({
  slug: z.string().trim().min(1).max(64),
  initData: z.string().trim().min(1),
  custom: z.object({
    bio: z.string().max(RIDER_BIO_MAX_LEN * 2).optional(), // hard caps below anyway
    city: z.string().max(RIDER_CITY_MAX_LEN * 2).optional(),
    statusEmoji: z.string().max(8).optional(),
    statusText: z.string().max(RIDER_STATUS_TEXT_MAX_LEN * 2).optional(),
    hideProfile: z.boolean().optional(),
  }),
});

const ReactionsInput = z.object({
  slug: z.string().trim().min(1).max(64),
  postId: z.string().trim().uuid(),
  initData: z.string().trim().optional(),
});

/** Post scan cap for profile counters/garage (NN-crew scale; badge granularity). */
const POST_SCAN_CAP = 500;

// ── view types ───────────────────────────────────────────────────────────────

export interface RiderGarageItem {
  bikeId: string;
  title: string;
  imageUrl: string | null;
  /** How many of the rider's wall posts mention this bike. */
  mentions: number;
}

export interface RiderProfileView {
  rider: {
    userId: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
  };
  slug: string;
  /** Own profile → the page shows the customization form. */
  isSelf: boolean;
  /** Viewer moderates this crew (sees hidden profile content anyway). */
  isStaff: boolean;
  hidden: boolean;
  custom: RiderProfileCustom;
  stats: RiderPublicStats;
  badges: RiderWallBadge[];
  garage: RiderGarageItem[];
  /** Последние аренды — ТОЛЬКО self/crew staff (видимость по ролям):
   *  чужой зритель получает пустой массив, ₽ наружу не утекает. */
  recentRentals: RiderRentalRef[];
  /** «в экипаже с YYYY» — earliest of first ride / first post. */
  sinceLabel: string | null;
  /** Deeplink-friendly bot username for the «Написать в TG» button. */
  botUsername: string | null;
}

export type GetRiderProfileResult =
  | { ok: true; profile: RiderProfileView }
  | { ok: false; error: string };

export type SaveRiderProfileResult =
  | { ok: true; custom: RiderProfileCustom }
  | { ok: false; error: string };

export interface ReactionReactorGroup {
  emoji: string;
  count: number;
  reactors: { userId: string; username: string | null; fullName: string | null; avatarUrl: string | null }[];
}

export type GetPostReactionsResult =
  | { ok: true; groups: ReactionReactorGroup[] }
  | { ok: false; error: string };

// ── getRiderProfileAction ────────────────────────────────────────────────────

export async function getRiderProfileAction(input: {
  slug: string;
  riderId: string;
  initData?: string;
}): Promise<GetRiderProfileResult> {
  const parsed = GetProfileInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректный запрос профиля." };
  const { slug, riderId, initData } = parsed.data;

  const crew = await getCrewBySlug(slug);
  if (!crew) return { ok: false, error: "Экипаж не найден." };

  const [riderRes, viewer] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select("user_id, username, full_name, avatar_url, metadata")
      .eq("user_id", riderId)
      .maybeSingle(),
    resolveWallActor(initData),
  ]);
  const riderRow = riderRes.data as
    | { user_id: string; username: string | null; full_name: string | null; avatar_url: string | null; metadata: Record<string, unknown> | null }
    | null;
  if (!riderRow) return { ok: false, error: "Райдер не найден." };

  const isSelf = viewer?.userId === riderId;
  const isStaff = viewer ? await isCrewStaffUser(viewer.userId, crew) : false;
  const meta = (riderRow.metadata && typeof riderRow.metadata === "object" ? riderRow.metadata : {}) as Record<string, unknown>;
  const profiles = (meta.riderProfiles && typeof meta.riderProfiles === "object" ? meta.riderProfiles : {}) as Record<string, unknown>;
  const custom = sanitizeRiderProfileCustom(profiles[slug]);

  // Privacy gate (round-2 codereview): a profile is only meaningful INSIDE a
  // crew — do not render identity cards for random users of OTHER crews
  // (users table is global). Tie = member / owner / any rental row / any wall
  // post. The owner of the page (isSelf) always passes (edit mode works).
  const [postsRes, memberCnt, rentalCnt] = await Promise.all([
    supabaseAdmin
      .from("crew_posts")
      .select("id, body, photos, like_count, created_at, is_hidden")
      .eq("crew_id", crew.id)
      .eq("author_id", riderId)
      .order("created_at", { ascending: true })
      .limit(POST_SCAN_CAP),
    supabaseAdmin
      .from("crew_members")
      .select("user_id", { count: "exact", head: true })
      .eq("crew_id", crew.id)
      .eq("user_id", riderId),
    supabaseAdmin
      .from("rentals")
      .select("user_id", { count: "exact", head: true })
      .eq("crew_id", crew.id)
      .eq("user_id", riderId),
  ]);
  const hasTie =
    isSelf ||
    riderRow.user_id === crew.owner_id ||
    (memberCnt.count ?? 0) > 0 ||
    (rentalCnt.count ?? 0) > 0 ||
    ((postsRes.data ?? []).some((p) => (p as { is_hidden: boolean | null }).is_hidden === false));
  if (!hasTie) return { ok: false, error: "Райдер не связан с этим экипажем." };

  const baseView = {
    rider: {
      userId: riderRow.user_id,
      username: riderRow.username,
      fullName: riderRow.full_name,
      avatarUrl: riderRow.avatar_url,
    },
    slug,
    isSelf,
    isStaff,
    // Бот экипажа из metadata (фикс 2026-09-21): раньше только env — кнопка
    // «Поделиться профилем» в проде деградировала до web-ссылки.
    botUsername: await resolveCrewBotUsername(slug),
  };

  // «Скрыть профиль»: everyone except the owner and crew staff gets a
  // minimal card. The owner still receives their payload (edit mode works).
  if (custom.hideProfile && !isSelf && !isStaff) {
    return {
      ok: true,
      profile: {
        ...baseView,
        hidden: true,
        custom: { ...EMPTY_RIDER_PROFILE_CUSTOM, hideProfile: true },
        stats: {
          ridesCount: 0,
          hoursRented: 0,
          bikesUsed: 0,
          postsCount: 0,
          photoPostsCount: 0,
          commentsCount: 0,
          reactionsReceived: 0,
          checkinCount: 0,
          firstRideAt: null,
        },
        badges: [],
        garage: [],
        recentRentals: [],
        sinceLabel: null,
      },
    };
  }

  // ── 1. Rental stats (money-free public subset) ────────────────────────────
  const [bikesRes, rentalsRes] = await Promise.all([
    supabaseAdmin.from("cars").select("id, model, type, image_url").eq("crew_id", crew.id),
    supabaseAdmin
      .from("rentals")
      .select("vehicle_id, status, total_cost, agreed_start_date, agreed_end_date, requested_start_date, requested_end_date")
      .eq("user_id", riderId)
      .eq("crew_id", crew.id),
  ]);
  const cars = (bikesRes.data ?? []) as { id: string; model: string | null; type: string | null; image_url: string | null }[];
  const statsBikes = new Map<string, StatsBikeInfo>(
    cars.map((c) => [String(c.id), { id: String(c.id), title: c.model || String(c.id), type: c.type ?? "" }]),
  );
  const rental: RentalStatsSnapshot = computeRiderStats(
    (rentalsRes.data ?? []) as unknown as StatsRentalRow[],
    statsBikes,
  );

  // ── 2. Wall counters from the rider's posts (bounded — NN-crew scale) ─────
  const posts = (postsRes.data ?? []) as unknown as {
    id: string;
    body: string | null;
    photos: unknown;
    like_count: number | null;
    created_at: string;
    is_hidden: boolean | null;
  }[];
  const visiblePosts = posts.filter((p) => p.is_hidden === false);

  let photoPostsCount = 0;
  let checkinCount = 0;
  let reactionsReceived = 0;
  for (const p of visiblePosts) {
    if (Array.isArray(p.photos) && p.photos.length > 0) photoPostsCount += 1;
    if (typeof p.body === "string" && p.body.trimStart().startsWith("📍")) checkinCount += 1;
    reactionsReceived += Math.max(0, Number(p.like_count ?? 0));
  }

  // Comments count (crew-scoped through the rider's visible posts; capped —
  // badge granularity, not accounting).
  let commentsCount = 0;
  if (visiblePosts.length > 0) {
    const { count } = await supabaseAdmin
      .from("crew_post_comments")
      .select("id", { count: "exact", head: true })
      .eq("author_id", riderId)
      .in("post_id", visiblePosts.slice(0, 200).map((p) => p.id))
      .eq("is_hidden", false);
    commentsCount = count ?? 0;
  }

  const stats: RiderPublicStats = {
    ridesCount: rental.ridesCount,
    hoursRented: rental.hoursRented,
    bikesUsed: rental.bikesUsed,
    postsCount: visiblePosts.length,
    photoPostsCount,
    commentsCount,
    reactionsReceived,
    checkinCount,
    firstRideAt: rental.firstRideAt,
  };

  // ── 3. Garage: bikes the rider attached to their wall posts ──────────────
  let garage: RiderGarageItem[] = [];
  if (visiblePosts.length > 0) {
    const { data: bikeLinks } = await supabaseAdmin
      .from("crew_post_bikes")
      .select("bike_id")
      .in("post_id", visiblePosts.slice(0, 200).map((p) => p.id));
    const perBike = new Map<string, number>();
    for (const row of (bikeLinks ?? []) as { bike_id: string | number }[]) {
      const id = String(row.bike_id);
      if (statsBikes.has(id)) perBike.set(id, (perBike.get(id) ?? 0) + 1);
    }
    garage = [...perBike.entries()]
      .map(([bikeId, mentions]) => ({
        bikeId,
        title: statsBikes.get(bikeId)?.title ?? bikeId,
        imageUrl: cars.find((c) => String(c.id) === bikeId)?.image_url ?? null,
        mentions,
      }))
      .sort((a, b) => b.mentions - a.mentions || a.title.localeCompare(b.title))
      .slice(0, 6);
  }

  // ── 4. «в экипаже с …»: earliest of first ride / first post ──────────────
  const earliestPostAt = visiblePosts[0]?.created_at ?? null;

  return {
    ok: true,
    profile: {
      ...baseView,
      hidden: false,
      custom,
      stats,
      badges: computeRiderWallBadges(stats),
      garage,
      recentRentals: await loadRecentRentalsForStaffOrSelf({
        crewId: crew.id,
        riderId,
        isSelf,
        isStaff,
      }),
      sinceLabel: riderSinceLabel(rental.firstRideAt, earliestPostAt),
    },
  };
}

// ── Блок «Аренды» (crosslink rent ↔ profile, видимость по ролям) ───────────
// self видит СВОИ аренды, staff — аренды любого райдера экипажа; всем
// остальным — пусто (визитка остаётся публичной, деньги — нет).
async function loadRecentRentalsForStaffOrSelf(input: {
  crewId: string;
  riderId: string;
  isSelf: boolean;
  isStaff: boolean;
}): Promise<RiderRentalRef[]> {
  if (!input.isSelf && !input.isStaff) return [];
  try {
    const { data } = await supabaseAdmin
      .from("rentals")
      .select(
        "rental_id, status, total_cost, agreed_start_date, agreed_end_date, vehicle:cars(make, model)",
      )
      .eq("user_id", input.riderId)
      .eq("crew_id", input.crewId)
      .order("created_at", { ascending: false })
      .limit(5);
    return (
      (data ?? []) as unknown as {
        rental_id: string;
        status: string;
        total_cost: number | string | null;
        agreed_start_date: string | null;
        agreed_end_date: string | null;
        vehicle: { make?: string | null; model?: string | null } | { make?: string | null; model?: string | null }[] | null;
      }[]
    ).map((r) => {
      const v = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
      const costNum = r.total_cost == null ? null : Number(r.total_cost);
      return {
        rentalId: r.rental_id,
        bikeTitle: v ? `${v.make || ""} ${v.model || ""}`.trim() || "байк" : "байк",
        status: r.status,
        startedAt: r.agreed_start_date,
        endedAt: r.agreed_end_date,
        totalCost: Number.isFinite(costNum as number) ? Math.round(costNum as number) : null,
      };
    });
  } catch (error) {
    logger.warn("[rider-profile] recent rentals load failed (non-fatal):", error);
    return [];
  }
}

// ── saveRiderProfileAction (owner-only) ──────────────────────────────────────

export async function saveRiderProfileAction(input: {
  slug: string;
  initData?: string;
  custom: z.infer<typeof SaveProfileInput>["custom"];
}): Promise<SaveRiderProfileResult> {
  const parsed = SaveProfileInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректный профиль." };

  const actor = await resolveWallActor(parsed.data.initData);
  if (!actor) return { ok: false, error: "Профиль доступен из Telegram-бота экипажа." };

  const crew = await getCrewBySlug(parsed.data.slug);
  if (!crew) return { ok: false, error: "Экипаж не найден." };

  // Deep sanitize — the zod layer only bounds the transport, the lib decides
  // the final shape (emoji whitelist, caps, whitespace collapse).
  const custom = sanitizeRiderProfileCustom({
    bio: parsed.data.custom.bio ?? "",
    city: parsed.data.custom.city ?? "",
    statusEmoji: parsed.data.custom.statusEmoji ?? "",
    statusText: parsed.data.custom.statusText ?? "",
    hideProfile: parsed.data.custom.hideProfile ?? false,
  });
  // The emoji must come from the picker; a hostile direct action call cannot
  // smuggle arbitrary glyphs onto the public page.
  if (custom.statusEmoji && !(RIDER_STATUS_EMOJIS as readonly string[]).includes(custom.statusEmoji)) {
    return { ok: false, error: "Такой эмодзи-статус недоступен." };
  }

  try {
    const { data: row } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", actor.userId)
      .maybeSingle();
    const meta = (row?.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<string, unknown>;
    const profiles = (meta.riderProfiles && typeof meta.riderProfiles === "object" ? meta.riderProfiles : {}) as Record<string, unknown>;
    const nextProfiles: Record<string, unknown> = { ...profiles, [crew.slug || parsed.data.slug]: custom };
    const { error } = await supabaseAdmin
      .from("users")
      .update({ metadata: { ...meta, riderProfiles: nextProfiles }, updated_at: new Date().toISOString() })
      .eq("user_id", actor.userId);
    if (error) {
      logger.error("[rider-profile] save failed:", error.message);
      return { ok: false, error: "Не получилось сохранить профиль." };
    }
    return { ok: true, custom };
  } catch (error) {
    logger.warn("[rider-profile] save crashed:", error);
    return { ok: false, error: "Не получилось сохранить профиль." };
  }
}

// ── getPostReactionsAction («Кому понравилось», Chain #5) ────────────────────

export async function getPostReactionsAction(input: {
  slug: string;
  postId: string;
  initData?: string;
}): Promise<GetPostReactionsResult> {
  const parsed = ReactionsInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректный запрос." };
  const { slug, postId, initData } = parsed.data;

  const crew = await getCrewBySlug(slug);
  if (!crew) return { ok: false, error: "Экипаж не найден." };

  // Privacy: reactor enumeration is for signed-in riders only (anonymous web
  // visitors see counts on the feed, never the people behind them).
  const viewer = await resolveWallActor(initData);
  if (!viewer) return { ok: false, error: "Список реакций доступен из Telegram-бота экипажа." };

  // The post must belong to THIS crew — otherwise reactions of another crew's
  // post could be enumerated by id guessing.
  const { data: postRow } = await supabaseAdmin
    .from("crew_posts")
    .select("id, crew_id")
    .eq("id", postId)
    .maybeSingle();
  const post = postRow as { id: string; crew_id: string } | null;
  if (!post || post.crew_id !== crew.id) return { ok: false, error: "Пост недоступен." };

  const { data: reactionRows } = await supabaseAdmin
    .from("crew_post_reactions")
    .select("user_id, emoji")
    .eq("post_id", postId)
    .limit(300);
  const rows = (reactionRows ?? []) as { user_id: string; emoji: string }[];
  if (rows.length === 0) return { ok: true, groups: [] };

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: userRows } = await supabaseAdmin
    .from("users")
    .select("user_id, username, full_name, avatar_url")
    .in("user_id", userIds);
  const users = new Map(
    ((userRows ?? []) as { user_id: string; username: string | null; full_name: string | null; avatar_url: string | null }[]).map((u) => [
      u.user_id,
      { userId: u.user_id, username: u.username, fullName: u.full_name, avatarUrl: u.avatar_url },
    ]),
  );

  const byEmoji = new Map<string, ReactionReactorGroup>();
  for (const r of rows) {
    let group = byEmoji.get(r.emoji);
    if (!group) {
      group = { emoji: r.emoji, count: 0, reactors: [] };
      byEmoji.set(r.emoji, group);
    }
    group.count += 1;
    const u = users.get(r.user_id);
    if (u) group.reactors.push(u);
  }
  const groups = [...byEmoji.values()].sort((a, b) => b.count - a.count);
  return { ok: true, groups };
}
