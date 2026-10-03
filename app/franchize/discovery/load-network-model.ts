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
  buildCrewNetworkModel,
  crewAccentFromMetadata,
  deriveCrewServices,
  type CrewNetworkMember,
  type CrewNetworkNodeInput,
} from "../lib/crew-network";

const CREWS_CAP = 200;
const CARS_CAP = 2000;
const STORAGE_CAP = 2000;

interface CrewRow {
  id: string;
  name: string | null;
  slug: string | null;
  description: string | null;
  logo_url: string | null;
  owner_id: string;
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

/** Serializable result — crosses the server→client boundary as props. */
export interface CrewNetworkModelResult {
  nodes: ReturnType<typeof buildCrewNetworkModel>["nodes"];
  links: ReturnType<typeof buildCrewNetworkModel>["links"];
  peopleCount: number;
  connectionCount: number;
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
    return { nodes: [], links: [], peopleCount: 0, connectionCount: 0 };
  }

  const crewIds = crews.map((c) => c.id);
  const slugs = crews.map((c) => (c.slug ?? "").trim()).filter(Boolean);

  const [membersRes, carsRes, storageRes] = await Promise.all([
    supabaseAdmin
      .from("crew_members")
      .select("crew_id, user_id, membership_status")
      .in("crew_id", crewIds)
      .eq("membership_status", "active"),
    // fleet size per crew (catalog = the core service; test artifacts excluded)
    supabaseAdmin.from("cars").select("crew_id, is_test_result").in("crew_id", crewIds).limit(CARS_CAP),
    // bikes currently on season (storage_bikes is keyed by crew_slug)
    supabaseAdmin.from("storage_bikes").select("crew_slug, status").in("crew_slug", slugs).limit(STORAGE_CAP),
  ]);

  const memberRows = (membersRes.data ?? []) as MemberRow[];
  const carRows = (carsRes.data ?? []) as CarRow[];
  const storageRows = (storageRes.data ?? []) as StorageRow[];

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

  return buildCrewNetworkModel(inputs, people);
}
