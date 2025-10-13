"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { sendTelegramMessage } from "@/app/actions";
import { v4 as uuidv4 } from "uuid";

const DEBUG_ITEM_TYPE = (process.env.DEBUG_ITEM_TYPE || "bike").toString();
const DEBUG_LIMIT = 500;

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
   - getActiveShiftForMember(memberId, crewId)
   - startShiftForMember(memberId, crewId, shiftType)
   - endShiftForMember(shiftId)
   - saveCheckpointForShift(memberId, crewId, checkpointData)
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
    console.error("[getActiveShiftForMember] error:", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

export async function startShiftForMember(memberId: string, crewId: string, shiftType: string = "online") {
  try {
    if (!memberId || !crewId) return { success: false, error: "memberId and crewId required" };

    // ensure no active shift exists (optional)
    const active = await supabaseAdmin
      .from("crew_member_shifts")
      .select("id")
      .eq("member_id", memberId)
      .eq("crew_id", crewId)
      .is("clock_out_time", null)
      .limit(1)
      .maybeSingle();

    if (active.error) { console.error("[startShiftForMember] active lookup error:", active.error); }
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
    return { success: true, shift: data };
  } catch (e:any) {
    console.error("[startShiftForMember] error:", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

export async function endShiftForMember(shiftId: string, memberId?: string) {
  try {
    if (!shiftId) return { success: false, error: "shiftId required" };
    const { data, error } = await supabaseAdmin
      .from("crew_member_shifts")
      .update({ clock_out_time: new Date().toISOString() })
      .eq("id", shiftId)
      .select()
      .maybeSingle();
    if (error) throw error;
    return { success: true, shift: data };
  } catch (e:any) {
    console.error("[endShiftForMember] error:", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

/**
 * saveCheckpointForShift
 * - memberId + crewId are used to resolve the active shift (clock_out_time IS NULL).
 * - checkpointData: any JSON-friendly object (we save into checkpoint JSONB).
 */
export async function saveCheckpointForShift(slug: string, memberId: string, checkpointData: any) {
  try {
    if (!slug || !memberId) return { success: false, error: "slug and memberId required" };
    const crew = await resolveCrewBySlug(slug);
    if (!crew) return { success: false, error: "Crew not found" };
    const crewId = crew.id;

    // find active shift
    const { data: shiftRow, error: shiftErr } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("*")
      .eq("member_id", memberId)
      .eq("crew_id", crewId)
      .is("clock_out_time", null)
      .limit(1)
      .maybeSingle();

    if (shiftErr) {
      console.error("[saveCheckpointForShift] shift lookup error:", shiftErr);
      return { success: false, error: "Shift lookup failed" };
    }
    if (!shiftRow) {
      return { success: false, error: "No active shift found for this member" };
    }

    // merge existing checkpoint if any
    const existing = shiftRow.checkpoint || {};
    const merged = { ...existing, saved_at: new Date().toISOString(), data: checkpointData };

    const { data, error } = await supabaseAdmin
      .from("crew_member_shifts")
      .update({ checkpoint: merged })
      .eq("id", shiftRow.id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("[saveCheckpointForShift] update error:", error);
      return { success: false, error: "Failed to save checkpoint" };
    }

    console.log("[saveCheckpointForShift] saved checkpoint for shift:", shiftRow.id);
    return { success: true, shift: data };
  } catch (e:any) {
    console.error("[saveCheckpointForShift] unexpected:", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

/* -----------------------
   Existing item fetch functions (kept as before)
   - fetchCrewBySlug
   - fetchCrewItemsBySlug
   - fetchCrewAllCarsBySlug
   ----------------------- */

export async function fetchCrewBySlug(slug: string): Promise<{ success: boolean; crew?: any; error?: string }> {
  try {
    if (!slug) return { success: false, error: "slug required" };
    console.log("[fetchCrewBySlug] slug:", slug);

    const { data, error } = await supabaseAdmin
      .from("crews")
      .select("id, name, slug, description, logo_url, owner_id, hq_location")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[fetchCrewBySlug] db error:", error);
      return { success: false, error: error.message || "DB error" };
    }
    if (!data) {
      console.log("[fetchCrewBySlug] crew not found:", slug);
      return { success: false, error: "Crew not found" };
    }
    return { success: true, crew: data };
  } catch (e: any) {
    console.error("[fetchCrewBySlug] unexpected:", e);
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

    console.log("[fetchCrewItemsBySlug] start", { slug, userChatId, itemType });

    const crewRes = await supabaseAdmin
      .from("crews")
      .select("id, name, slug, owner_id, logo_url")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();

    if (crewRes.error) {
      console.error("[fetchCrewItemsBySlug] crew lookup error:", crewRes.error);
      return { success: false, error: "Failed to lookup crew", debug: { crewLookupError: crewRes.error } };
    }
    if (!crewRes.data) {
      return { success: false, error: `Crew '${slug}' not found` };
    }
    const crew = crewRes.data as any;

    // membership / role lookup (if userChatId provided)
    let memberRole: string | null = null;
    if (userChatId) {
      const mem = await supabaseAdmin
        .from("crew_members")
        .select("role, membership_status")
        .eq("crew_id", crew.id)
        .eq("user_id", userChatId)
        .limit(1)
        .maybeSingle();
      if (mem.error) {
        console.error("[fetchCrewItemsBySlug] member lookup failed:", mem.error);
      } else if (mem.data) {
        memberRole = mem.data.role || null;
      }
    }

    const typeToUse = itemType ?? (DEBUG_ITEM_TYPE || "");
    console.log("[fetchCrewItemsBySlug] using type filter:", typeToUse || "(none)");

    let query = supabaseAdmin.from("cars").select("*").eq("crew_id", crew.id).order("make", { ascending: true });

    if (typeToUse && typeToUse.length > 0) {
      query = query.eq("type", typeToUse);
    }

    const carsRes = await query.limit(DEBUG_LIMIT);
    if (carsRes.error) {
      console.error("[fetchCrewItemsBySlug] cars query error:", carsRes.error);
      return { success: false, error: "Failed to fetch items", debug: { carsError: carsRes.error } };
    }

    const rows = (carsRes.data || []).map((r: any) => ({ ...r, specs: safeParseSpecs(r.specs) }));
    console.log("[fetchCrewItemsBySlug] returning", { crew: crew.id, count: rows.length, memberRole });

    return { success: true, data: rows, crew: { id: crew.id, name: crew.name, slug: crew.slug, owner_id: crew.owner_id, logo_url: crew.logo_url }, memberRole, debug: { count: rows.length } };
  } catch (e: any) {
    console.error("[fetchCrewItemsBySlug] unexpected error:", e);
    return { success: false, error: e?.message || "unknown error" };
  }
}

export async function fetchCrewAllCarsBySlug(slug: string): Promise<{ success: boolean; data?: any[]; crew?: any; error?: string; debug?: any }> {
  try {
    if (!slug) return { success: false, error: "slug required" };
    console.log("[fetchCrewAllCarsBySlug] slug:", slug);

    const crewRes = await supabaseAdmin.from("crews").select("id, name, slug, owner_id, logo_url").eq("slug", slug).limit(1).maybeSingle();
    if (crewRes.error) {
      console.error("[fetchCrewAllCarsBySlug] crew lookup error:", crewRes.error);
      return { success: false, error: "Crew lookup failed", debug: { crewLookupError: crewRes.error } };
    }
    if (!crewRes.data) { return { success: false, error: "Crew not found" }; }
    const crew = crewRes.data as any;

    const carsRes = await supabaseAdmin.from("cars").select("*").eq("crew_id", crew.id).order("make", { ascending: true }).limit(DEBUG_LIMIT);
    if (carsRes.error) { console.error("[fetchCrewAllCarsBySlug] cars error:", carsRes.error); return { success: false, error: "Failed to fetch cars", debug: { carsError: carsRes.error } }; }
    const data = (carsRes.data || []).map((r:any) => ({ ...r, specs: safeParseSpecs(r.specs) }));
    console.log("[fetchCrewAllCarsBySlug] returning count:", data.length);
    return { success: true, data, crew: { id: crew.id, name: crew.name, slug: crew.slug, owner_id: crew.owner_id, logo_url: crew.logo_url }, debug: { total: data.length } };
  } catch (e:any) {
    console.error("[fetchCrewAllCarsBySlug] unexpected:", e);
    return { success: false, error: e?.message || "unknown", debug: null };
  }
}

/* -----------------------
   updateItemQuantityForCrew: when an item is changed, append an action entry to the active shift.actions JSONB
   ----------------------- */

export async function updateItemQuantityForCrew(
  slug: string,
  itemId: string,
  delta: number,
  userId?: string
): Promise<{ success: boolean; item?: any; error?: string; debug?: any }> {
  try {
    if (!slug || !itemId || typeof delta !== "number") return { success: false, error: "Missing parameters" };
    console.log("[updateItemQuantityForCrew] called", { slug, itemId, delta, userId });

    // resolve crew
    const crewRes = await supabaseAdmin.from("crews").select("id, owner_id").eq("slug", slug).limit(1).maybeSingle();
    if (crewRes.error) {
      console.error("[updateItemQuantityForCrew] crew lookup error:", crewRes.error);
      return { success: false, error: "Crew lookup failed" };
    }
    if (!crewRes.data) return { success: false, error: "Crew not found" };
    const crewId = (crewRes.data as any).id;

    // check user role
    let userRole: string | null = null;
    if (userId) {
      const mem = await supabaseAdmin.from("crew_members").select("role, membership_status").eq("crew_id", crewId).eq("user_id", userId).limit(1).maybeSingle();
      if (mem.error) console.warn("[updateItemQuantityForCrew] member lookup error:", mem.error);
      else if (mem.data) userRole = mem.data.role || null;
    }
    const allowedRoles = ["owner", "xadmin", "manager", "admin"];
    const isOwnerByCrew = crewRes.data.owner_id && userId && crewRes.data.owner_id === userId;
    const canModify = isOwnerByCrew || (userRole && allowedRoles.includes(userRole));
    if (!canModify) {
      console.warn("[updateItemQuantityForCrew] unauthorized modification attempt", { userId, userRole, crewOwner: crewRes.data.owner_id });
      return { success: false, error: "Not authorized to modify this crew's items" };
    }

    // find item
    const itemRes = await supabaseAdmin.from("cars").select("*").eq("id", itemId).eq("crew_id", crewId).limit(1).maybeSingle();
    if (itemRes.error) { console.error("[updateItemQuantityForCrew] item lookup error:", itemRes.error); return { success: false, error: "Item lookup failed" }; }
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

    if (updateErr) {
      console.error("[updateItemQuantityForCrew] update error:", updateErr);
      return { success: false, error: "Failed to update item quantity" };
    }

    // --- append action entry into active shift.actions JSONB (best-effort) ---
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

        const existingActions = Array.isArray(shiftRow.actions) ? shiftRow.actions : (shiftRow.actions ? JSON.parse(shiftRow.actions) : []);
        const newActions = [...existingActions, actionEntry];

        const { error: appendErr } = await supabaseAdmin
          .from("crew_member_shifts")
          .update({ actions: newActions })
          .eq("id", shiftRow.id);

        if (appendErr) {
          console.warn("[updateItemQuantityForCrew] failed to append action to shift (non-fatal):", appendErr);
        } else {
          console.log("[updateItemQuantityForCrew] appended action to shift:", shiftRow.id);
        }
      }
    } catch (e) {
      console.warn("[updateItemQuantityForCrew] shift append unexpected:", e);
    }

    const normalized = { ...(updateData || item), specs: safeParseSpecs((updateData || item).specs) };
    console.log("[updateItemQuantityForCrew] success", { itemId, oldQty, newQty });

    return { success: true, item: normalized, debug: { oldQty, newQty, userRole } };
  } catch (e:any) {
    console.error("[updateItemQuantityForCrew] unexpected:", e);
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
    if (crewRes.error) { console.error("[notifyOwner] crew lookup failed:", crewRes.error); return { success: false, error: "Crew lookup failed" }; }
    if (!crewRes.data) return { success: false, error: "Crew not found" };
    const ownerId = crewRes.data.owner_id;
    if (!ownerId) return { success: false, error: "Owner not configured for this crew" };

    const finalMessage = `Bikehouse request for crew '${crewRes.data.name}'\nFrom: ${requesterId || "anonymous"}\n\n${message}`;
    try {
      const res = await sendTelegramMessage(finalMessage, [], undefined, ownerId);
      if (!res.success) {
        console.error("[notifyOwner] sendTelegramMessage returned error:", res.error);
        return { success: false, error: res.error || "Failed to send telegram" };
      }
      return { success: true };
    } catch (e:any) {
      console.error("[notifyOwner] unexpected send error:", e);
      return { success: false, error: e?.message || "notify failed" };
    }
  } catch (e:any) {
    console.error("[notifyOwner] unexpected:", e);
    return { success: false, error: e?.message || "unknown" };
  }
}