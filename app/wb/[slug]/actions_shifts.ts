"use server";

import { supabaseAdmin } from "@/hooks/supabase";

/**
 * actions_shifts.ts
 * Server-side helpers for shift operations (slugged).
 *
 * Exposes:
 * - getCrewMemberStatus(slug, memberId)
 * - setCrewMemberLiveStatus(slug, memberId, newStatus, opts?)
 * - getActiveShiftForCrewMember(slug, memberId)
 * - startWarehouseShift(slug, memberId, shiftType?)
 * - endWarehouseShift(slug, shiftId)
 * - saveCrewCheckpoint(slug, memberId, checkpointData)
 * - resetCrewCheckpoint(slug, memberId)
 *
 * These mirror the logic used by the Telegram bot shift command and make it easy
 * for client components to operate on shifts / member status.
 */

function log(...args: any[]) { if ((process.env.NEXT_PUBLIC_DEBUG ?? "1") !== "0") console.log("[wb/actions_shifts]", ...args); }
function err(...args: any[]) { if ((process.env.NEXT_PUBLIC_DEBUG ?? "1") !== "0") console.error("[wb/actions_shifts]", ...args); }

async function resolveCrewBySlug(slug: string) {
  const { data, error } = await supabaseAdmin
    .from("crews")
    .select("id, name, slug, owner_id")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Crew '${slug}' not found`);
  return data as any;
}

function safeParseSpecs(specs: any) {
  if (!specs) return {};
  if (typeof specs === "object") return specs;
  try { return JSON.parse(specs); } catch { return {}; }
}

/* -------------------------
   Member status helpers
   ------------------------- */

/**
 * Return live_status and crew_members row for the given user in crew
 */
export async function getCrewMemberStatus(slug: string, memberId: string) {
  try {
    const crew = await resolveCrewBySlug(slug);
    const { data, error } = await supabaseAdmin
      .from("crew_members")
      .select("*")
      .eq("crew_id", crew.id)
      .eq("user_id", memberId)
      .eq("membership_status", "active")
      .maybeSingle();

    if (error) throw error;
    return { success: true, member: data || null, live_status: data?.live_status || null };
  } catch (e: any) {
    err("getCrewMemberStatus error", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

/**
 * Set live_status for a crew member.
 * Optionally set last_location or other small fields.
 */
export async function setCrewMemberLiveStatus(
  slug: string,
  memberId: string,
  newStatus: string,
  opts: { last_location?: string | null } = {}
) {
  try {
    const crew = await resolveCrewBySlug(slug);
    const payload: any = { live_status: newStatus, updated_at: new Date().toISOString() };
    if (opts.last_location !== undefined) payload.last_location = opts.last_location;

    const { error } = await supabaseAdmin
      .from("crew_members")
      .update(payload)
      .eq("crew_id", crew.id)
      .eq("user_id", memberId)
      .eq("membership_status", "active");

    if (error) throw error;
    return { success: true };
  } catch (e: any) {
    err("setCrewMemberLiveStatus error", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

/* -------------------------
   Shift CRUD & checkpoint helpers
   ------------------------- */

export async function getActiveShiftForCrewMember(slug: string, memberId: string) {
  try {
    const crew = await resolveCrewBySlug(slug);
    const { data, error } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("*")
      .eq("member_id", memberId)
      .eq("crew_id", crew.id)
      .is("clock_out_time", null)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return { success: true, shift: data || null };
  } catch (e: any) {
    err("getActiveShiftForCrewMember error", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

export async function startWarehouseShift(slug: string, memberId: string, shiftType: string = "warehouse") {
  try {
    const crew = await resolveCrewBySlug(slug);
    // ensure no active shift
    const active = await supabaseAdmin
      .from("crew_member_shifts")
      .select("id")
      .eq("member_id", memberId)
      .eq("crew_id", crew.id)
      .is("clock_out_time", null)
      .limit(1)
      .maybeSingle();
    if (active.data) return { success: false, error: "Active shift exists" };

    const { data, error } = await supabaseAdmin.from("crew_member_shifts").insert({
      member_id: memberId,
      crew_id: crew.id,
      shift_type: shiftType,
      checkpoint: {},
      actions: [],
      clock_in_time: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select().single();

    if (error) throw error;
    return { success: true, shift: data };
  } catch (e: any) {
    err("startWarehouseShift error", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

export async function endWarehouseShift(slug: string, shiftId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("crew_member_shifts")
      .update({ clock_out_time: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", shiftId)
      .select()
      .maybeSingle();
    if (error) throw error;
    return { success: true, shift: data };
  } catch (e: any) {
    err("endWarehouseShift error", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

export async function saveCrewCheckpoint(slug: string, memberId: string, checkpointData: any) {
  try {
    const crew = await resolveCrewBySlug(slug);
    const { data: shift } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("*")
      .eq("member_id", memberId)
      .eq("crew_id", crew.id)
      .is("clock_out_time", null)
      .single();

    if (!shift) throw new Error("No active shift");

    const merged = { ...shift.checkpoint, saved_at: new Date().toISOString(), data: checkpointData };

    const { error } = await supabaseAdmin
      .from("crew_member_shifts")
      .update({ checkpoint: merged, updated_at: new Date().toISOString() })
      .eq("id", shift.id);

    if (error) throw error;
    return { success: true, shift };
  } catch (e: any) {
    err("saveCrewCheckpoint error", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

/* Reset writes specs.warehouse_locations for each item from checkpoint */
export async function resetCrewCheckpoint(slug: string, memberId: string) {
  try {
    const crew = await resolveCrewBySlug(slug);
    const { data: shift } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("checkpoint")
      .eq("member_id", memberId)
      .eq("crew_id", crew.id)
      .is("clock_out_time", null)
      .single();

    if (!shift?.checkpoint?.data) throw new Error("No checkpoint");

    const snapshot = shift.checkpoint.data as any[];
    let applied = 0;
    const failures: any[] = [];

    for (const row of snapshot) {
      if (!row.id) continue;
      try {
        const { data: existing } = await supabaseAdmin
          .from("cars")
          .select("specs")
          .eq("id", row.id)
          .eq("crew_id", crew.id)
          .single();

        let specs = safeParseSpecs(existing?.specs || {});
        const normalizedLocations = Array.isArray(row.locations)
          ? row.locations.map((l: any) => ({ voxel_id: l.voxel || l.voxel_id || l.id, quantity: Number(l.quantity || 0) }))
          : [];

        specs.warehouse_locations = normalizedLocations;
        const { error } = await supabaseAdmin
          .from("cars")
          .update({ specs, updated_at: new Date().toISOString() })
          .eq("id", row.id)
          .eq("crew_id", crew.id);

        if (error) failures.push({ id: row.id, error: error.message });
        else applied++;
      } catch (e: any) {
        failures.push({ id: row.id, error: e?.message || e });
      }
    }

    return { success: failures.length === 0, applied, failures };
  } catch (e: any) {
    err("resetCrewCheckpoint error", e);
    return { success: false, error: e?.message || "unknown" };
  }
}