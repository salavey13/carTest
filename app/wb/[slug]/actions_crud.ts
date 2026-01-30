"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { unstable_noStore as noStore } from "next/cache";

function safeParseSpecs(specs: any) {
  if (!specs) return {};
  if (typeof specs === "object") return specs;
  try { return JSON.parse(specs); } catch { return {}; }
}

async function resolveCrewBySlug(slug: string) {
  noStore();
  const { data, error } = await supabaseAdmin
    .from("crews")
    .select("id, name, slug, owner_id")
    .eq("slug", slug)
    .single();
  if (error || !data) throw new Error(`Crew '${slug}' not found`);
  return data;
}

/**
 * verifyCrewAccess - THE HYBRID CLEARANCE ENGINE
 * Checks permanent membership OR active participation in a linked Lobby.
 */
async function verifyCrewAccess(crewId: string, userId: string | undefined) {
  if (!userId) return { isMember: false, role: null, isOwner: false };

  // 1. Check if Owner
  const { data: crew } = await supabaseAdmin.from("crews").select("owner_id").eq("id", crewId).single();
  if (crew?.owner_id === userId) return { isMember: true, role: 'owner', isOwner: true };

  // 2. Check Permanent Membership
  const { data: member } = await supabaseAdmin
    .from("crew_members")
    .select("role, membership_status")
    .eq("crew_id", crewId)
    .eq("user_id", userId)
    .eq("membership_status", "active")
    .maybeSingle();
  if (member) return { isMember: true, role: member.role, isOwner: false };

  // 3. Check Temporary "Raid" Clearance via Lobby
  // Access granted if user is in an 'active' lobby tied to this crew
  const { data: lobbyMember } = await supabaseAdmin
    .from("lobby_members")
    .select("role, lobbies!inner(status, crew_id)")
    .eq("user_id", userId)
    .eq("lobbies.crew_id", crewId)
    .eq("lobbies.status", "active")
    .maybeSingle();

  if (lobbyMember) return { isMember: true, role: 'raider', isOwner: false };

  return { isMember: false, role: null, isOwner: false };
}

export async function updateCrewItemLocationQty(
  slug: string,
  itemId: string,
  voxelId: string,
  delta: number,
  userId?: string
) {
  noStore();
  try {
    const crew = await resolveCrewBySlug(slug);
    const { isMember, error: authErr } = await verifyCrewAccess(crew.id, userId);
    if (!isMember) throw new Error(authErr || "NO_TACTICAL_CLEARANCE");

    // 1. Fetch Item
    const { data: item } = await supabaseAdmin.from("cars").select("specs, make, model").eq("id", itemId).single();
    if (!item) throw new Error("ITEM_NOT_FOUND");

    const specs = safeParseSpecs(item.specs);
    if (!Array.isArray(specs.warehouse_locations)) specs.warehouse_locations = [];

    // 2. Voxel Math
    let location = specs.warehouse_locations.find((l: any) => (l.voxel_id || l.voxel) === voxelId);
    if (!location) {
      location = { voxel_id: voxelId, quantity: 0 };
      specs.warehouse_locations.push(location);
    }
    location.quantity = Math.max(0, (location.quantity || 0) + delta);
    specs.warehouse_locations = specs.warehouse_locations.filter((l: any) => l.quantity > 0);

    // 3. Commit to Database
    await supabaseAdmin.from("cars").update({ specs }).eq("id", itemId);

    // 4. --- RAID LOGGING (The Ledger) ---
    if (userId) {
      const { data: activeShift } = await supabaseAdmin
        .from("crew_member_shifts")
        .select("id, actions")
        .eq("member_id", userId)
        .eq("crew_id", crew.id)
        .is("clock_out_time", null)
        .maybeSingle();

      // Auto-start shift for ad-hoc raiders if it doesn't exist
      let shiftId = activeShift?.id;
      let currentActions = Array.isArray(activeShift?.actions) ? [...activeShift.actions] : [];

      if (!shiftId) {
        const { data: newShift } = await supabaseAdmin.from("crew_member_shifts").insert({
          member_id: userId,
          crew_id: crew.id,
          shift_type: 'raid',
          clock_in_time: new Date().toISOString()
        }).select().single();
        shiftId = newShift?.id;
      }

      if (shiftId) {
        currentActions.push({
          type: delta < 0 ? "offload" : "onload",
          itemId,
          item: `${item.make} ${item.model}`,
          voxel_id: voxelId,
          qty: Math.abs(delta),
          ts: new Date().toISOString()
        });
        await supabaseAdmin.from("crew_member_shifts").update({ actions: currentActions }).eq("id", shiftId);
      }
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getCrewWarehouseItems(slug: string) {
  noStore();
  try {
    const crew = await resolveCrewBySlug(slug);
    const { data, error } = await supabaseAdmin.from("cars").select("*").eq("type", "wb_item").eq("crew_id", crew.id).order("model");
    if (error) throw error;
    const items = (data || []).map((i: any) => ({ ...i, specs: safeParseSpecs(i.specs) }));
    return { success: true, data: items, crew };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}