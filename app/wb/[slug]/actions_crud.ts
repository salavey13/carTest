"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { unstable_noStore as noStore } from "next/cache";

function safeParseSpecs(specs: any) {
  if (!specs) return {};
  if (typeof specs === "object") return specs;
  try { return JSON.parse(specs); } catch { return {}; }
}
function log(...args: any[]) { if ((process.env.NEXT_PUBLIC_DEBUG ?? "1") !== "0") console.log("[wb/actions_crud]", ...args); }
function err(...args: any[]) { if ((process.env.NEXT_PUBLIC_DEBUG ?? "1") !== "0") console.error("[wb/actions_crud]", ...args); }

async function resolveCrewBySlug(slug: string) {
  noStore();
  const { data, error } = await supabaseAdmin
    .from("crews")
    .select("id, name, slug, owner_id, logo_url")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Crew '${slug}' not found`);
  return data as any;
}

async function verifyCrewMember(crewId: string, userId: string | undefined) {
  if (!userId) return { isMember: false, role: null, isOwner: false, error: "User ID required" };
  const { data: member, error } = await supabaseAdmin
    .from("crew_members")
    .select("role, membership_status")
    .eq("crew_id", crewId)
    .eq("user_id", userId)
    .single();
  if (error && (error as any).code !== "PGRST116") throw error;
  const isMember = !!member && member.membership_status === "active";
  const role = (member as any)?.role || null;
  const { data: crew } = await supabaseAdmin.from("crews").select("owner_id").eq("id", crewId).single();
  const isOwner = crew?.owner_id === userId;
  return { isMember, role, isOwner };
}

// small helper: check public.users for admin flag/status
async function isGlobalAdmin(userId?: string) {
  if (!userId) return false;
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("status, is_admin")
      .eq("id", userId)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn("[isGlobalAdmin] query error", error);
      return false;
    }
    return (data?.status === "admin") || !!data?.is_admin;
  } catch (e) {
    console.warn("[isGlobalAdmin] unexpected", e);
    return false;
  }
}

/** 
 * getCrewWarehouseItems
 * returns raw server items (specs parsed) and crew meta
 */
export async function getCrewWarehouseItems(slug: string) {
  noStore();
  try {
    if (!slug) throw new Error("Slug required");
    log(`[getCrewWarehouseItems] ${slug}`);

    const crew = await resolveCrewBySlug(slug);
    const crewId = crew.id;

    const { data, error } = await supabaseAdmin
      .from("cars")
      .select("*")
      .eq("type", "wb_item")
      .eq("crew_id", crewId)
      .order("model")
      .limit(1000);

    if (error) throw error;

    const items = (data || []).map((i: any) => ({ ...i, specs: safeParseSpecs(i.specs) }));

    return {
      success: true,
      data: items,
      crew: { id: crew.id, name: crew.name, slug: crew.slug, owner_id: crew.owner_id, logo_url: crew.logo_url },
    };
  } catch (e: any) {
    err("getCrewWarehouseItems error", e);
    return { success: false, error: e?.message || "Unknown error" };
  }
}

/**
 * updateCrewItemLocationQty
 * update single location qty inside specs.warehouse_locations (voxel_id)
 *
 * Also logs event into active shift.actions if userId is provided and active shift exists.
 */
export async function updateCrewItemLocationQty(
  slug: string,
  itemId: string,
  voxelId: string,
  delta: number,
  userId?: string
) {
  noStore();
  try {
    if (!slug || !itemId || typeof delta !== "number") throw new Error("Invalid parameters");

    const crew = await resolveCrewBySlug(slug);
    const crewId = crew.id;

    const { isMember, role, isOwner, error } = await verifyCrewMember(crewId, userId);
    if (error) throw new Error(error);

    // allow owner OR active member OR global admin
    const callerIsAdmin = await isGlobalAdmin(userId);
    if (!isOwner && !isMember && !callerIsAdmin) throw new Error("Not a member of this crew");

    const { data: existingItem, error: selErr } = await supabaseAdmin
      .from("cars")
      .select("specs")
      .eq("id", itemId)
      .eq("crew_id", crewId)
      .eq("type", "wb_item")
      .single();
    if (selErr) throw selErr;
    if (!existingItem?.specs) throw new Error("Item not found or missing specs");

    const specs = safeParseSpecs(existingItem.specs);
    if (!Array.isArray(specs.warehouse_locations)) specs.warehouse_locations = [];

    let location = specs.warehouse_locations.find((l: any) => l.voxel_id === voxelId);
    if (!location) {
      location = { voxel_id: voxelId, quantity: 0 };
      specs.warehouse_locations.push(location);
    }

    location.quantity = Math.max(0, (location.quantity || 0) + delta);
    specs.warehouse_locations = specs.warehouse_locations.filter((l: any) => (l.quantity || 0) > 0);

    const totalQuantity = specs.warehouse_locations.reduce((acc: number, l: any) => acc + (l.quantity || 0), 0);

    // update only specs (no timestamps)
    const { error: updateError } = await supabaseAdmin
      .from("cars")
      .update({ specs })
      .eq("id", itemId)
      .eq("crew_id", crewId);

    if (updateError) throw updateError;

    log(`[updateCrewItemLocationQty] ok ${itemId} ${voxelId} ${delta} total=${totalQuantity}`);

    // --- Log action to active shift.actions if possible ---
    try {
      if (userId) {
        const { data: activeShift } = await supabaseAdmin
          .from("crew_member_shifts")
          .select("*")
          .eq("member_id", userId)
          .eq("crew_id", crewId)
          .is("clock_out_time", null)
          .limit(1)
          .maybeSingle();

        if (activeShift && activeShift.id) {
          const actions = Array.isArray(activeShift.actions) ? activeShift.actions : [];
          const evt: any = {
            type: delta < 0 ? "offload" : "onload",
            itemId,
            voxel_id: voxelId,
            qty: Math.abs(delta),
            delta,
            user_id: userId,
            ts: new Date().toISOString(),
          };
          actions.push(evt);

          // write back
          const { error: updShiftErr } = await supabaseAdmin
            .from("crew_member_shifts")
            .update({ actions })
            .eq("id", activeShift.id);
          if (updShiftErr) log("Failed to append action to shift:", updShiftErr);
        }
      }
    } catch (logErr) {
      log("Error while logging action into shift:", logErr);
    }

    return { success: true, item: { id: itemId, specs, total_quantity: totalQuantity } };
  } catch (e: any) {
    err("updateCrewItemLocationQty error", e);
    return { success: false, error: e?.message || "Unknown error" };
  }
}