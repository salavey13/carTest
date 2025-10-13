"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { sendTelegramMessage } from "@/app/actions"; // server action
import { v4 as uuidv4 } from "uuid";

/**
 * DEBUG_ITEM_TYPE used for test/demo environment (set DEBUG_ITEM_TYPE=bike)
 * If DEBUG_ITEM_TYPE is empty, we don't filter by type (show all vehicles).
 */
const DEBUG_ITEM_TYPE = (process.env.DEBUG_ITEM_TYPE || "bike").toString();
const DEBUG_LIMIT = 500;

function safeParseSpecs(specs: any) {
  if (!specs) return {};
  if (typeof specs === "object") return specs;
  try {
    return JSON.parse(specs);
  } catch {
    return {};
  }
}

/**
 * fetchCrewBySlug - lightweight crew metadata
 */
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

/**
 * fetchCrewItemsBySlug - fetch bikes (or DEBUG_ITEM_TYPE) for crew slug.
 * - userChatId optional -> returns membership info (role) for the user.
 * - itemType optional -> override DEBUG_ITEM_TYPE
 *
 * Response stable object shape: { success, data, crew, memberRole, debug, error }
 */
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
        // NOT fatal for public view - return with warning
      } else if (mem.data) {
        memberRole = mem.data.role || null;
      }
    }

    // Choose type filter: explicit itemType -> DEBUG_ITEM_TYPE -> no filter if empty string
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

/**
 * fetchCrewAllCarsBySlug - debug helper: fetch all cars for crew without type filter.
 */
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

/**
 * updateItemQuantityForCrew
 * - slug: crew slug (resolve crew id)
 * - itemId: cars.id
 * - delta: positive -> onload (increase), negative -> offload (decrease)
 * - userId: id performing the action (string). We check membership/role.
 *
 * Authorization rules:
 * - Public: only read.
 * - To modify quantities, user must be member of crew and role in ('owner','xadmin','manager') — adjust roles as you like.
 *
 * Side effects:
 * - Update cars.quantity (string/integer fields are handled)
 * - Insert a row into warehouse_shifts (if table exists) for auditing.
 */
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

    // authorization: check membership role
    let userRole: string | null = null;
    if (userId) {
      const mem = await supabaseAdmin.from("crew_members").select("role, membership_status").eq("crew_id", crewId).eq("user_id", userId).limit(1).maybeSingle();
      if (mem.error) {
        console.warn("[updateItemQuantityForCrew] member lookup error:", mem.error);
      } else if (mem.data) {
        userRole = mem.data.role || null;
      }
    }

    // allow if owner of crew (owner_id) OR member role in these elevated roles
    const allowedRoles = ["owner", "xadmin", "manager", "admin"];
    const isOwnerByCrew = crewRes.data.owner_id && userId && crewRes.data.owner_id === userId;
    const canModify = isOwnerByCrew || (userRole && allowedRoles.includes(userRole));

    if (!canModify) {
      console.warn("[updateItemQuantityForCrew] unauthorized modification attempt", { userId, userRole, crewOwner: crewRes.data.owner_id });
      return { success: false, error: "Not authorized to modify this crew's items (must be crew owner or admin)" };
    }

    // fetch item and current quantity
    const itemRes = await supabaseAdmin.from("cars").select("*").eq("id", itemId).eq("crew_id", crewId).limit(1).maybeSingle();
    if (itemRes.error) { console.error("[updateItemQuantityForCrew] item lookup error:", itemRes.error); return { success: false, error: "Item lookup failed" }; }
    if (!itemRes.data) { return { success: false, error: "Item not found for this crew" }; }

    const item = itemRes.data as any;
    // cars.quantity could be string — normalize to int
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

    // try to insert audit shift into warehouse_shifts (if table exists)
    try {
      const shift = {
        id: uuidv4(),
        crew_id: crewId,
        item_id: itemId,
        user_id: userId ?? null,
        delta,
        previous_quantity: oldQty,
        new_quantity: newQty,
        created_at: new Date().toISOString(),
        metadata: { source: "bikehouse_ui" }
      };
      // best-effort insert
      const { error: shiftErr } = await supabaseAdmin.from("warehouse_shifts").insert(shift);
      if (shiftErr) {
        console.warn("[updateItemQuantityForCrew] failed to insert shift (non-fatal):", shiftErr);
      } else {
        console.log("[updateItemQuantityForCrew] shift inserted", shift.id);
      }
    } catch (e) {
      console.warn("[updateItemQuantityForCrew] shift insert unexpected:", e);
    }

    // return updated item (normalize specs)
    const normalized = { ...(updateData || item), specs: safeParseSpecs((updateData || item).specs) };
    console.log("[updateItemQuantityForCrew] success", { itemId, oldQty, newQty });

    return { success: true, item: normalized, debug: { oldQty, newQty, userRole } };
  } catch (e:any) {
    console.error("[updateItemQuantityForCrew] unexpected:", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

/**
 * notifyOwnerAboutStorageRequest - convenience server action that sends a message to crew owner.
 * - caller can request to notify owner about a specific item/voxel/slot for conversation.
 */
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
    // best-effort: use sendTelegramMessage from /app/actions
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