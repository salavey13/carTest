// app/franchize/discovery/load-network-model.ts
//
// SERVER-ONLY loader for the global crew network model (2026-10-04).
//
// Extracted verbatim from the discovery page so the map-riders sheet can
// reuse it: the «Сеть» tab of the map bottom nav now opens the network AS A
// SEGMENT of the single sliding sheet (boss 2026-10-04: «polish network tab
// in sliding on map-riders») — the page (server component) loads the model
// once and passes plain serializable nodes/links down to the client sheet.
// The discovery page keeps rendering the same model on its own route.
//
// The model is derived from existing tables (crews, crew_members active,
// users public names, cars fleet, storage_bikes on-season) — no new tables,
// no migrations, no new user inputs. Supabase admin client means this file
// must NEVER be imported from client code — the data crosses the boundary
// as plain props only.

import { supabaseAdmin } from "@/lib/supabase-server";
import {
  // The metadata reader lives in the PURE lib (vitest cannot import this
  // server-only module) — re-exported so the loader's public surface is
  // unchanged for every consumer.
  externalAudienceFromUser,
} from "../lib/blogger-stats";
import {
  bloggerRarityScore,
  bloggerRarityStars,
  buildCrewNetworkModel,
  crewAccentFromMetadata,
  deriveCrewServices,
  type CrewNetworkBlogger,
  type CrewNetworkMember,
  type CrewNetworkNodeInput,
} from "../lib/crew-network";

// Public surface preserved: consumers (and tests) import the reader from the
// loader exactly as before Task 75.
export { externalAudienceFromUser };

const CREWS_CAP = 200;
const CARS_CAP = 2000;
const STORAGE_CAP = 2000;
/** Wall posts scanned for the blogger layer — the wall itself is the cap. */
const POSTS_CAP = 1000;

interface CrewRow {
  id: string;
  name: string | null;
  slug: string | null;
  description: string | null;
  logo_url: string | null;
  owner_id: string;
  metadata: unknown;
}

interface PostRow {
  id: string;
  crew_id: string;
  author_id: string;
  like_count: number | null;
  geo_lat: number | null;
  created_at: string;
}

interface BloggerUserRow {
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  website: string | null;
  metadata: unknown;
}

interface MemberRow {
  crew_id: string;
  user_id: string;
  membership_status: string;
}

interface UserRow {
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface CarRow {
  crew_id: string | null;
  is_test_result: boolean | null;
}

interface StorageRow {
  crew_slug: string | null;
  status: string | null;
}

function publicName(row: Pick<UserRow, "username" | "full_name">): string {
  const full = (row.full_name ?? "").trim();
  if (full) return full;
  const nick = (row.username ?? "").trim();
  return nick ? `@${nick.replace(/^@/, "")}` : "Райдер";
}

/** Keys that may carry a cross-platform audience in users.metadata —
 *  top-level or one bundle deep. Grows as bloggers link more platforms. */
// (moved to ../lib/blogger-stats together with externalAudienceFromUser)

/** Serializable result — crosses the server→client boundary as props. */
export interface CrewNetworkModelResult {
  nodes: ReturnType<typeof buildCrewNetworkModel>["nodes"];
  links: ReturnType<typeof buildCrewNetworkModel>["links"];
  peopleCount: number;
  connectionCount: number;
  bloggers: CrewNetworkBlogger[];
  bloggerLinks: ReturnType<typeof buildCrewNetworkModel>["bloggerLinks"];
}

export async function loadNetworkModel(): Promise<CrewNetworkModelResult> {
  const { data: crewRows } = await supabaseAdmin
    .from("crews")
    .select("id, name, slug, description, logo_url, owner_id, metadata")
    .not("slug", "is", null)
    .order("created_at", { ascending: true })
    .limit(CREWS_CAP);

  const crews = (crewRows ?? []) as CrewRow[];
  if (crews.length === 0) {
    return { nodes: [], links: [], peopleCount: 0, connectionCount: 0, bloggers: [], bloggerLinks: [] };
  }

  const crewIds = crews.map((c) => c.id);
  const slugs = crews.map((c) => (c.slug ?? "").trim()).filter(Boolean);

  const [membersRes, carsRes, storageRes, postsRes] = await Promise.all([
    supabaseAdmin
      .from("crew_members")
      .select("crew_id, user_id, membership_status")
      .in("crew_id", crewIds)
      .eq("membership_status", "active"),
    // fleet size per crew (catalog = the core service; test artifacts excluded)
    supabaseAdmin.from("cars").select("crew_id, is_test_result").in("crew_id", crewIds).limit(CARS_CAP),
    // bikes currently on season (storage_bikes is keyed by crew_slug)
    supabaseAdmin.from("storage_bikes").select("crew_slug, status").in("crew_slug", slugs).limit(STORAGE_CAP),
    // distribution layer (2026-10-05): public crew-wall posts → bloggers.
    // Same table the wall renders; no new tables, no migrations.
    supabaseAdmin
      .from("crew_posts")
      .select("id, crew_id, author_id, like_count, geo_lat, is_hidden, created_at")
      .in("crew_id", crewIds)
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .limit(POSTS_CAP),
  ]);

  const memberRows = (membersRes.data ?? []) as MemberRow[];
  const carRows = (carsRes.data ?? []) as CarRow[];
  const storageRows = (storageRes.data ?? []) as StorageRow[];
  const postRows = (postsRes.data ?? []) as PostRow[];

  // Membership sets: owner first (the implicit one-man-crew member), then
  // active crew_members. This is the ONLY social signal we use.
  const membersByCrew = new Map<string, string[]>();
  for (const crew of crews) {
    membersByCrew.set(crew.id, crew.owner_id ? [crew.owner_id] : []);
  }
  for (const row of memberRows) {
    if (!row.user_id) continue;
    const list = membersByCrew.get(row.crew_id);
    if (!list) continue;
    if (!list.includes(row.user_id)) list.push(row.user_id);
  }

  const bikeCountByCrew = new Map<string, number>();
  for (const row of carRows) {
    if (!row.crew_id || row.is_test_result === true) continue;
    bikeCountByCrew.set(row.crew_id, (bikeCountByCrew.get(row.crew_id) ?? 0) + 1);
  }

  const storageCountBySlug = new Map<string, number>();
  for (const row of storageRows) {
    if (!row.crew_slug || row.status !== "in_storage") continue;
    storageCountBySlug.set(row.crew_slug, (storageCountBySlug.get(row.crew_slug) ?? 0) + 1);
  }

  const allUserIds = [...new Set([...membersByCrew.values()].flat())];
  const people = new Map<string, CrewNetworkMember>();
  if (allUserIds.length > 0) {
    const { data: userRows } = await supabaseAdmin
      .from("users")
      .select("user_id, username, full_name, avatar_url")
      .in("user_id", allUserIds);
    for (const row of (userRows ?? []) as UserRow[]) {
      people.set(row.user_id, {
        userId: row.user_id,
        name: publicName(row),
        avatarUrl: row.avatar_url ?? null,
      });
    }
  }

  // ── distribution layer (2026-10-05): wall authors → bloggers ─────────────
  // Boss's blue-product idea: crews MAKE the product, bloggers DISTRIBUTE it.
  // A user with ≥1 public post on any crew wall IS a blogger — no new user
  // inputs, the wall itself is the signup sheet. Rarity prices the voice:
  // output × cross-crew spread × geotags × likes × external audience.
  const postsByAuthor = new Map<
    string,
    { crews: Set<string>; perCrew: Map<string, number>; geos: number; likes: number; lastAt: string | null }
  >();
  for (const post of postRows) {
    if (!post.author_id || !post.crew_id) continue;
    let agg = postsByAuthor.get(post.author_id);
    if (!agg) {
      agg = { crews: new Set(), perCrew: new Map(), geos: 0, likes: 0, lastAt: null };
      postsByAuthor.set(post.author_id, agg);
    }
    agg.crews.add(post.crew_id);
    agg.perCrew.set(post.crew_id, (agg.perCrew.get(post.crew_id) ?? 0) + 1);
    if (post.geo_lat != null) agg.geos += 1;
    agg.likes += post.like_count ?? 0;
    if (!agg.lastAt || post.created_at > agg.lastAt) agg.lastAt = post.created_at;
  }

  const bloggerIds = [...postsByAuthor.keys()];
  const bloggerUsers = new Map<string, BloggerUserRow>();
  if (bloggerIds.length > 0) {
    const { data: bloggerRows } = await supabaseAdmin
      .from("users")
      .select("user_id, username, full_name, avatar_url, website, metadata")
      .in("user_id", bloggerIds);
    for (const row of (bloggerRows ?? []) as BloggerUserRow[]) {
      bloggerUsers.set(row.user_id, row);
    }
  }

  const bloggers: CrewNetworkBlogger[] = [...postsByAuthor.entries()].map(([userId, agg]) => {
    const user = bloggerUsers.get(userId);
    const postCount = [...agg.perCrew.values()].reduce((sum, n) => sum + n, 0);
    const externalAudience = externalAudienceFromUser(user);
    const rarityScore = bloggerRarityScore({
      postCount,
      crewCount: agg.crews.size,
      geotagCount: agg.geos,
      likeCount: agg.likes,
      externalAudience,
    });
    return {
      userId,
      name: user ? publicName(user) : "Райдер",
      avatarUrl: user?.avatar_url ?? null,
      postCount,
      crewIds: [...agg.crews],
      postsByCrew: Object.fromEntries(agg.perCrew),
      geotagCount: agg.geos,
      likeCount: agg.likes,
      externalAudience,
      rarityScore,
      rarityStars: bloggerRarityStars(rarityScore),
      lastPostAt: agg.lastAt,
    };
  });

  const inputs: CrewNetworkNodeInput[] = crews.map((crew, index) => {
    const slug = (crew.slug ?? "").trim();
    return {
      crewId: crew.id,
      slug,
      name: (crew.name ?? "").trim() || slug,
      description: (crew.description ?? "").trim(),
      logoUrl: crew.logo_url ?? null,
      accent: crewAccentFromMetadata(crew.metadata, index),
      memberUserIds: membersByCrew.get(crew.id) ?? [],
      services: deriveCrewServices({
        slug,
        metadata: crew.metadata,
        bikeCount: bikeCountByCrew.get(crew.id) ?? 0,
        storageBikeCount: storageCountBySlug.get(slug) ?? 0,
      }),
    };
  });

  return buildCrewNetworkModel(inputs, people, bloggers);
}
