"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { sendTelegramMessage } from "@/app/actions";
import { v4 as uuidv4 } from "uuid";

/**
 * Debug mode ON by default. Disable by setting NEXT_PUBLIC_DEBUG=0.
 */
const DEBUG = (process.env.NEXT_PUBLIC_DEBUG ?? "1") !== "0";
const DEBUG_ITEM_TYPE = (process.env.DEBUG_ITEM_TYPE || "bike").toString();
const DEBUG_LIMIT = 500;

function log(...args: any[]) { if (DEBUG) console.log("[wb/actions]", ...args); }
function warn(...args: any[]) { if (DEBUG) console.warn("[wb/actions]", ...args); }
function err(...args: any[]) { if (DEBUG) console.error("[wb/actions]", ...args); }

function safeParseSpecs(specs: any) {
  if (!specs) return {};
  if (typeof specs === "object") return specs;
  try { return JSON.parse(specs); } catch { return {}; }
}

async function resolveCrewBySlug(slug: string) {
  const crewRes = await supabaseAdmin.from("crews").select("id, name, slug, owner_id, logo_url").eq("slug", slug).limit(1).maybeSingle();
  if (crewRes.error) throw crewRes.error;
  if (!crewRes.data) throw new Error("Crew not found");
  return crewRes.data as any;
}

/* -----------------------
   SHIFT helpers
   ----------------------- */

export async function getActiveShiftForMember(memberId: string, crewId: string) {
  try {
    if (!memberId || !crewId) return { success: false, error: "memberId and crewId required" };
    const { data, error } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("*")
      .eq("member_id", memberId)
      .eq("crew_id", crewId)
      .is("clock_out_time", null)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return { success: true, shift: data || null };
  } catch (e: any) {
    err("[getActiveShiftForMember] error:", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

export async function startShiftForMember(memberId: string, crewId: string, shiftType: string = "online") {
  try {
    if (!memberId || !crewId) return { success: false, error: "memberId and crewId required" };

    const active = await supabaseAdmin
      .from("crew_member_shifts")
      .select("id")
      .eq("member_id", memberId)
      .eq("crew_id", crewId)
      .is("clock_out_time", null)
      .limit(1)
      .maybeSingle();

    if (active.error) { warn("[startShiftForMember] active lookup error:", active.error); }
    if (active.data) {
      return { success: false, error: "Active shift already exists", shift: active.data };
    }

    const { data, error } = await supabaseAdmin.from("crew_member_shifts").insert({
      member_id: memberId,
      crew_id: crewId,
      shift_type: shiftType,
      checkpoint: {} as any,
      actions: [] as any[],
    }).select().single();

    if (error) throw error;
    log("[startShiftForMember] started shift:", data.id);
    return { success: true, shift: data };
  } catch (e:any) {
    err("[startShiftForMember] error:", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

export async function endShiftForMember(shiftId: string) {
  try {
    if (!shiftId) return { success: false, error: "shiftId required" };
    const { data, error } = await supabaseAdmin
      .from("crew_member_shifts")
      .update({ clock_out_time: new Date().toISOString() })
      .eq("id", shiftId)
      .select()
      .maybeSingle();
    if (error) throw error;
    log("[endShiftForMember] ended shift:", shiftId);
    return { success: true, shift: data };
  } catch (e:any) {
    err("[endShiftForMember] error:", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

/**
 * saveCheckpointForShift(slug, memberId, checkpointData)
 * - requires an active shift. Saves checkpoint JSONB into the active shift row under { saved_at, data }.
 */
export async function saveCheckpointForShift(slug: string, memberId: string, checkpointData: any) {
  try {
    if (!slug || !memberId) return { success: false, error: "slug and memberId required" };
    const crew = await resolveCrewBySlug(slug);
    const crewId = crew.id;
    log("[saveCheckpointForShift] slug, member:", slug, memberId);

    const { data: shiftRow, error: shiftErr } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("*")
      .eq("member_id", memberId)
      .eq("crew_id", crewId)
      .is("clock_out_time", null)
      .limit(1)
      .maybeSingle();

    if (shiftErr) { err("[saveCheckpointForShift] shift lookup error:", shiftErr); return { success: false, error: "Shift lookup failed" }; }
    if (!shiftRow) return { success: false, error: "No active shift found for this member" };

    const existing = shiftRow.checkpoint || {};
    const merged = { ...existing, saved_at: new Date().toISOString(), data: checkpointData };

    const { data, error } = await supabaseAdmin
      .from("crew_member_shifts")
      .update({ checkpoint: merged })
      .eq("id", shiftRow.id)
      .select()
      .maybeSingle();

    if (error) { err("[saveCheckpointForShift] update error:", error); return { success: false, error: "Failed to save checkpoint" }; }

    log("[saveCheckpointForShift] saved checkpoint for shift:", shiftRow.id);
    return { success: true, shift: data };
  } catch (e:any) {
    err("[saveCheckpointForShift] unexpected:", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

/**
 * resetCheckpointForShift(slug, memberId)
 * - requires active shift and checkpoint present.
 * - will apply the checkpoint snapshot quantities to the cars table (server-side restore).
 */
export async function resetCheckpointForShift(slug: string, memberId: string) {
  try {
    if (!slug || !memberId) return { success: false, error: "slug and memberId required" };
    log("[resetCheckpointForShift] called for", slug, memberId);

    const crew = await resolveCrewBySlug(slug);
    const crewId = crew.id;

    // role check: only crew adminish allowed to restore
    const memRes = await supabaseAdmin.from("crew_members").select("role").eq("crew_id", crewId).eq("user_id", memberId).limit(1).maybeSingle();
    const role = memRes.error ? null : memRes.data?.role || null;
    const allowedRoles = ["owner", "xadmin", "manager", "admin"];
    const isOwnerByCrew = crew.owner_id && crew.owner_id === memberId;
    if (!(isOwnerByCrew || (role && allowedRoles.includes(role)))) {
      warn("[resetCheckpointForShift] unauthorized attempt:", { role, memberId, crewOwner: crew.owner_id });
      return { success: false, error: "Not authorized to reset checkpoint" };
    }

    // find active shift
    const { data: shiftRow, error: shiftErr } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("*")
      .eq("member_id", memberId)
      .eq("crew_id", crewId)
      .is("clock_out_time", null)
      .limit(1)
      .maybeSingle();

    if (shiftErr) { err("[resetCheckpointForShift] shift lookup error:", shiftErr); return { success: false, error: "Shift lookup failed" }; }
    if (!shiftRow) return { success: false, error: "No active shift found" };
    if (!shiftRow.checkpoint || !shiftRow.checkpoint.data) return { success: false, error: "No checkpoint saved in active shift" };

    const snapshot = shiftRow.checkpoint.data as Array<{ id: string; quantity: number; locations?: any[] }>;
    if (!Array.isArray(snapshot)) return { success: false, error: "Checkpoint format invalid" };

    const failures: Array<{ id: string; error: string }> = [];
    let applied = 0;

    for (const row of snapshot) {
      if (!row?.id) continue;
      const desiredQty = Number(row.quantity || 0);
      try {
        const { error: updateErr } = await supabaseAdmin
          .from("cars")
          .update({ quantity: desiredQty.toString(), updated_at: new Date().toISOString() })
          .eq("id", row.id)
          .eq("crew_id", crewId);

        if (updateErr) {
          failures.push({ id: row.id, error: updateErr.message || "update failed" });
          warn("[resetCheckpointForShift] update failed for", row.id, updateErr);
        } else {
          applied++;
        }
      } catch (e:any) {
        failures.push({ id: row.id, error: e?.message || "unknown" });
        warn("[resetCheckpointForShift] unexpected error for", row.id, e);
      }
    }

    log(`[resetCheckpointForShift] applied ${applied}/${snapshot.length} updates; failures: ${failures.length}`);
    return { success: failures.length === 0, applied, attempted: snapshot.length, failures: failures.length ? failures : undefined };
  } catch (e:any) {
    err("[resetCheckpointForShift] unexpected:", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

/* -----------------------
   Fetch helpers
   ----------------------- */

export async function fetchCrewBySlug(slug: string): Promise<{ success: boolean; crew?: any; error?: string }> {
  try {
    if (!slug) return { success: false, error: "slug required" };
    log("[fetchCrewBySlug] slug:", slug);

    const { data, error } = await supabaseAdmin
      .from("crews")
      .select("id, name, slug, description, logo_url, owner_id, hq_location")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();

    if (error) { err("[fetchCrewBySlug] db error:", error); return { success: false, error: error.message || "DB error" }; }
    if (!data) { log("[fetchCrewBySlug] crew not found:", slug); return { success: false, error: "Crew not found" }; }
    return { success: true, crew: data };
  } catch (e:any) {
    err("[fetchCrewBySlug] unexpected:", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

export async function fetchCrewItemsBySlug(
  slug: string,
  userChatId?: string,
  itemType?: string
): Promise<{
  success: boolean;
  data?: any[];
  crew?: any;
  memberRole?: string | null;
  debug?: any;
  error?: string;
}> {
  try {
    if (!slug) return { success: false, error: "slug is required" };

    log("[fetchCrewItemsBySlug] start", { slug, userChatId, itemType });

    const crewRes = await supabaseAdmin
      .from("crews")
      .select("id, name, slug, owner_id, logo_url")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();

    if (crewRes.error) { err("[fetchCrewItemsBySlug] crew lookup error:", crewRes.error); return { success: false, error: "Failed to lookup crew", debug: { crewLookupError: crewRes.error } }; }
    if (!crewRes.data) { return { success: false, error: `Crew '${slug}' not found` }; }
    const crew = crewRes.data as any;

    let memberRole: string | null = null;
    if (userChatId) {
      const mem = await supabaseAdmin
        .from("crew_members")
        .select("role, membership_status")
        .eq("crew_id", crew.id)
        .eq("user_id", userChatId)
        .limit(1)
        .maybeSingle();
      if (mem.error) { warn("[fetchCrewItemsBySlug] member lookup failed:", mem.error); }
      else if (mem.data) memberRole = mem.data.role || null;
    }

    const typeToUse = itemType ?? (DEBUG_ITEM_TYPE || "");
    log("[fetchCrewItemsBySlug] using type filter:", typeToUse || "(none)");

    let query = supabaseAdmin.from("cars").select("*").eq("crew_id", crew.id).order("make", { ascending: true });
    if (typeToUse && typeToUse.length > 0) query = query.eq("type", typeToUse);

    const carsRes = await query.limit(DEBUG_LIMIT);
    if (carsRes.error) { err("[fetchCrewItemsBySlug] cars query error:", carsRes.error); return { success: false, error: "Failed to fetch items", debug: { carsError: carsRes.error } }; }

    const rows = (carsRes.data || []).map((r: any) => ({ ...r, specs: safeParseSpecs(r.specs) }));
    log("[fetchCrewItemsBySlug] returning", { crew: crew.id, count: rows.length, memberRole });

    return { success: true, data: rows, crew: { id: crew.id, name: crew.name, slug: crew.slug, owner_id: crew.owner_id, logo_url: crew.logo_url }, memberRole, debug: { count: rows.length } };
  } catch (e: any) {
    err("[fetchCrewItemsBySlug] unexpected error:", e);
    return { success: false, error: e?.message || "unknown error" };
  }
}

export async function fetchCrewAllCarsBySlug(slug: string): Promise<{ success: boolean; data?: any[]; crew?: any; error?: string; debug?: any }> {
  try {
    if (!slug) return { success: false, error: "slug required" };
    log("[fetchCrewAllCarsBySlug] slug:", slug);

    const crewRes = await supabaseAdmin.from("crews").select("id, name, slug, owner_id, logo_url").eq("slug", slug).limit(1).maybeSingle();
    if (crewRes.error) { err("[fetchCrewAllCarsBySlug] crew lookup error:", crewRes.error); return { success: false, error: "Crew lookup failed", debug: { crewLookupError: crewRes.error } }; }
    if (!crewRes.data) { return { success: false, error: "Crew not found" }; }
    const crew = crewRes.data as any;

    const carsRes = await supabaseAdmin.from("cars").select("*").eq("crew_id", crew.id).order("make", { ascending: true }).limit(DEBUG_LIMIT);
    if (carsRes.error) { err("[fetchCrewAllCarsBySlug] cars error:", carsRes.error); return { success: false, error: "Failed to fetch cars", debug: { carsError: carsRes.error } }; }
    const data = (carsRes.data || []).map((r:any) => ({ ...r, specs: safeParseSpecs(r.specs) }));
    log("[fetchCrewAllCarsBySlug] returning count:", data.length);
    return { success: true, data, crew: { id: crew.id, name: crew.name, slug: crew.slug, owner_id: crew.owner_id, logo_url: crew.logo_url }, debug: { total: data.length } };
  } catch (e:any) {
    err("[fetchCrewAllCarsBySlug] unexpected:", e);
    return { success: false, error: e?.message || "unknown", debug: null };
  }
}

/* -----------------------
   Shifts listing & export
   ----------------------- */

export async function getShiftsForCrew(slug: string, limit = 200) {
  try {
    if (!slug) return { success: false, error: "slug required" };
    const crew = await resolveCrewBySlug(slug);
    const { data, error } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("id, member_id, crew_id, clock_in_time, clock_out_time, duration_minutes, shift_type, checkpoint, actions")
      .eq("crew_id", crew.id)
      .order("clock_in_time", { ascending: false })
      .limit(limit);

    if (error) { err("[getShiftsForCrew] db error:", error); return { success: false, error: error.message || "DB error" }; }
    return { success: true, data: data || [] };
  } catch (e:any) {
    err("[getShiftsForCrew] unexpected:", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

/**
 * exportDailyFromShifts(slug, opts)
 * - Aggregates snapshots stored in shift.checkpoint.data across shifts for the crew
 * - Returns detailed TSV and summarized TSV (aggregated by item_id)
 *
 * opts:
 *   sinceDays?: number  // only include shifts whose checkpoint.saved_at is within this many days (default: 7)
 */
export async function exportDailyFromShifts(slug: string, opts?: { sinceDays?: number }) {
  try {
    if (!slug) return { success: false, error: "slug required" };
    const crew = await resolveCrewBySlug(slug);
    // fetch all shifts with checkpoint (limit reasonably)
    const { data: shifts, error: shiftsErr } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("id, member_id, clock_in_time, clock_out_time, duration_minutes, shift_type, checkpoint, actions")
      .eq("crew_id", crew.id)
      .order("clock_in_time", { ascending: false })
      .limit(1000);

    if (shiftsErr) { err("[exportDailyFromShifts] shifts fetch error:", shiftsErr); return { success: false, error: "Failed to fetch shifts" }; }

    const sinceDays = opts?.sinceDays ?? 7;
    const sinceTs = Date.now() - (sinceDays * 24 * 3600 * 1000);

    // collect detailed rows and aggregated map
    const detailedRows: Array<{ shift_id: string; member_id: string; saved_at: string | null; item_id: string; quantity: number; locations?: any[] }> = [];
    const aggMap: Record<string, number> = {}; // item_id => sum qty

    for (const s of (shifts || [])) {
      const cp = s.checkpoint;
      const savedAt = cp?.saved_at ? new Date(cp.saved_at).toISOString() : null;
      if (!cp || !cp.data) continue;
      // optionally filter by saved_at timestamp
      if (cp.saved_at && Date.parse(cp.saved_at) < sinceTs) continue;

      const snapshot = Array.isArray(cp.data) ? cp.data : [];
      for (const row of snapshot) {
        const itemId = row.id;
        const qty = Number(row.quantity || 0);
        detailedRows.push({ shift_id: s.id, member_id: s.member_id, saved_at: savedAt, item_id: itemId, quantity: qty, locations: row.locations || [] });
        aggMap[itemId] = (aggMap[itemId] || 0) + qty;
      }
    }

    // create TSVs
    let detailedTsv = "shift_id\tmember_id\tsaved_at\titem_id\tquantity\tlocations_json\n";
    for (const r of detailedRows) {
      detailedTsv += `${r.shift_id}\t${r.member_id}\t${r.saved_at || ""}\t${r.item_id}\t${r.quantity}\t${JSON.stringify(r.locations || [])}\n`;
    }

    let summaryTsv = "item_id\ttotal_quantity\n";
    for (const [itemId, total] of Object.entries(aggMap)) {
      summaryTsv += `${itemId}\t${total}\n`;
    }

    log("[exportDailyFromShifts] detailedRows:", detailedRows.length, "unique items:", Object.keys(aggMap).length);
    return { success: true, detailed_tsv: detailedTsv, summary_tsv: summaryTsv, counts: { rows: detailedRows.length, items: Object.keys(aggMap).length } };
  } catch (e:any) {
    err("[exportDailyFromShifts] unexpected:", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

/* -----------------------
   updateItemQuantityForCrew
   ----------------------- */

export async function updateItemQuantityForCrew(
  slug: string,
  itemId: string,
  delta: number,
  userId?: string
): Promise<{ success: boolean; item?: any; error?: string; debug?: any }> {
  try {
    if (!slug || !itemId || typeof delta !== "number") return { success: false, error: "Missing parameters" };
    log("[updateItemQuantityForCrew] called", { slug, itemId, delta, userId });

    const crewRes = await supabaseAdmin.from("crews").select("id, owner_id").eq("slug", slug).limit(1).maybeSingle();
    if (crewRes.error) { err("[updateItemQuantityForCrew] crew lookup error:", crewRes.error); return { success: false, error: "Crew lookup failed" }; }
    if (!crewRes.data) return { success: false, error: "Crew not found" };
    const crewId = (crewRes.data as any).id;

    // role check
    let userRole: string | null = null;
    if (userId) {
      const mem = await supabaseAdmin.from("crew_members").select("role, membership_status").eq("crew_id", crewId).eq("user_id", userId).limit(1).maybeSingle();
      if (mem.error) warn("[updateItemQuantityForCrew] member lookup error:", mem.error);
      else if (mem.data) userRole = mem.data.role || null;
    }
    const allowedRoles = ["owner", "xadmin", "manager", "admin"];
    const isOwnerByCrew = crewRes.data.owner_id && userId && crewRes.data.owner_id === userId;
    const canModify = isOwnerByCrew || (userRole && allowedRoles.includes(userRole));
    if (!canModify) {
      warn("[updateItemQuantityForCrew] unauthorized modification attempt", { userId, userRole, crewOwner: crewRes.data.owner_id });
      return { success: false, error: "Not authorized to modify this crew's items" };
    }

    // find item
    const itemRes = await supabaseAdmin.from("cars").select("*").eq("id", itemId).eq("crew_id", crewId).limit(1).maybeSingle();
    if (itemRes.error) { err("[updateItemQuantityForCrew] item lookup error:", itemRes.error); return { success: false, error: "Item lookup failed" }; }
    if (!itemRes.data) { return { success: false, error: "Item not found for this crew" }; }
    const item = itemRes.data as any;
    const oldQty = Number(item.quantity || 0);
    const newQty = Math.max(0, oldQty + delta);

    const { data: updateData, error: updateErr } = await supabaseAdmin
      .from("cars")
      .update({ quantity: newQty.toString(), updated_at: new Date().toISOString() })
      .eq("id", itemId)
      .select()
      .maybeSingle();

    if (updateErr) { err("[updateItemQuantityForCrew] update error:", updateErr); return { success: false, error: "Failed to update item quantity" }; }

    // append action to active shift if exists (best-effort)
    try {
      const shiftRes = await supabaseAdmin
        .from("crew_member_shifts")
        .select("*")
        .eq("member_id", userId ?? "")
        .eq("crew_id", crewId)
        .is("clock_out_time", null)
        .limit(1)
        .maybeSingle();

      if (!shiftRes.error && shiftRes.data) {
        const shiftRow = shiftRes.data as any;
        const actionEntry = {
          id: uuidv4(),
          ts: new Date().toISOString(),
          item_id: itemId,
          delta,
          previous_quantity: oldQty,
          new_quantity: newQty,
          actor: userId ?? null,
          source: "bikehouse_ui"
        };

        const existingActions = Array.isArray(shiftRow.actions) ? shiftRow.actions : (shiftRow.actions ? shiftRow.actions : []);
        const newActions = [...existingActions, actionEntry];

        const { error: appendErr } = await supabaseAdmin
          .from("crew_member_shifts")
          .update({ actions: newActions })
          .eq("id", shiftRow.id);

        if (appendErr) warn("[updateItemQuantityForCrew] failed to append action to shift (non-fatal):", appendErr);
        else log("[updateItemQuantityForCrew] appended action to shift:", shiftRow.id);
      }
    } catch (e) {
      warn("[updateItemQuantityForCrew] shift append unexpected:", e);
    }

    const normalized = { ...(updateData || item), specs: safeParseSpecs((updateData || item).specs) };
    log("[updateItemQuantityForCrew] success", { itemId, oldQty, newQty });

    return { success: true, item: normalized, debug: { oldQty, newQty, userRole } };
  } catch (e:any) {
    err("[updateItemQuantityForCrew] unexpected:", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

/* notify owner */
export async function notifyOwnerAboutStorageRequest(
  slug: string,
  message: string,
  requesterId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!slug || !message) return { success: false, error: "Missing params" };
    const crewRes = await supabaseAdmin.from("crews").select("id, name, owner_id").eq("slug", slug).limit(1).maybeSingle();
    if (crewRes.error) { err("[notifyOwner] crew lookup failed:", crewRes.error); return { success: false, error: "Crew lookup failed" }; }
    if (!crewRes.data) return { success: false, error: "Crew not found" };
    const ownerId = crewRes.data.owner_id;
    if (!ownerId) return { success: false, error: "Owner not configured for this crew" };

    const finalMessage = `Bikehouse request for crew '${crewRes.data.name}'\nFrom: ${requesterId || "anonymous"}\n\n${message}`;
    try {
      const res = await sendTelegramMessage(finalMessage, [], undefined, ownerId);
      if (!res.success) { err("[notifyOwner] sendTelegramMessage returned error:", res.error); return { success: false, error: res.error || "Failed to send telegram" }; }
      log("[notifyOwner] notified owner:", ownerId);
      return { success: true };
    } catch (e:any) {
      err("[notifyOwner] unexpected send error:", e);
      return { success: false, error: e?.message || "notify failed" };
    }
  } catch (e:any) {
    err("[notifyOwner] unexpected:", e);
    return { success: false, error: e?.message || "unknown" };
  }
}