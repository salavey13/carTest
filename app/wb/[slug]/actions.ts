"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { unstable_noStore as noStore } from "next/cache";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import Papa from "papaparse";
import { normalizeSizeKey } from "@/app/wb/common";
import { v4 as uuidv4 } from "uuid";

/**
 * Crew-specific warehouse actions for wb_items (blankets).
 * All operations filter by crew_id for segregation.
 * Assumes wb_items in 'cars' table with type='wb_item' and crew_id.
 */

type Maybe<T> = T | null | undefined;

const DEBUG = (process.env.NEXT_PUBLIC_DEBUG ?? "1") !== "0";
const DEBUG_LIMIT = 500;

function log(...args: any[]) { if (DEBUG) console.log("[wb/[slug]/actions]", ...args); }
function warn(...args: any[]) { if (DEBUG) console.warn("[wb/[slug]/actions]", ...args); }
function err(...args: any[]) { if (DEBUG) console.error("[wb/[slug]/actions]", ...args); }

function safeParseSpecs(specs: any) {
  if (!specs) return {};
  if (typeof specs === "object") return specs;
  try { return JSON.parse(specs); } catch { return {}; }
}

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

async function verifyCrewMember(crewId: string, userId: string | undefined): Promise<{ isMember: boolean; role?: string; isOwner: boolean; error?: string }> {
  if (!userId) return { isMember: false, isOwner: false, error: "User ID required" };
  const { data: member, error } = await supabaseAdmin
    .from("crew_members")
    .select("role, membership_status")
    .eq("crew_id", crewId)
    .eq("user_id", userId)
    .single();
  if (error && error.code !== "PGRST116") throw error; // Ignore no rows
  const isMember = !!member && member.membership_status === "active";
  const role = member?.role || null;
  const { data: crew } = await supabaseAdmin.from("crews").select("owner_id").eq("id", crewId).single();
  const isOwner = crew?.owner_id === userId;
  return { isMember, role, isOwner };
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      console.warn(`Retry ${i + 1}/${retries} failed: ${e?.message || e}`);
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastError;
}

/* =========================
   Core: Fetch crew-specific warehouse items
   ========================= */

export async function getCrewWarehouseItems(slug: string): Promise<{
  success: boolean;
  data?: any[];
  crew?: any;
  memberRole?: string | null;
  isOwner?: boolean;
  error?: string;
}> {
  noStore();
  try {
    if (!slug) throw new Error("Slug required");
    log(`[getCrewWarehouseItems] Fetching for slug: ${slug}`);

    const crew = await resolveCrewBySlug(slug);
    const crewId = crew.id;

    // Verify membership (optional, for role info)
    const { isMember, role: memberRole, isOwner, error: verifyError } = await verifyCrewMember(crewId, undefined);
    if (verifyError) warn(`[getCrewWarehouseItems] Membership verification failed: ${verifyError}`);

    const { data, error } = await supabaseAdmin
      .from("cars")
      .select("*")
      .eq("type", "wb_item")
      .eq("crew_id", crewId)
      .order("model")
      .limit(DEBUG_LIMIT);

    if (error) throw error;

    const items = (data || []).map((i: any) => ({
      ...i,
      specs: safeParseSpecs(i.specs),
    }));

    log(`[getCrewWarehouseItems] Fetched ${items.length} wb_items for crew ${crewId}`);
    return {
      success: true,
      data: items,
      crew: { id: crew.id, name: crew.name, slug: crew.slug, owner_id: crew.owner_id, logo_url: crew.logo_url },
      memberRole,
      isOwner,
    };
  } catch (error: any) {
    err("[getCrewWarehouseItems] Error:", error);
    return { success: false, error: error?.message || "Unknown error" };
  }
}

/* =========================
   Update single location qty for crew
   ========================= */

export async function updateCrewItemLocationQty(
  slug: string,
  itemId: string,
  voxelId: string,
  delta: number,
  userId?: string
): Promise<{ success: boolean; error?: string; item?: any }> {
  noStore();
  try {
    if (!slug || !itemId || typeof delta !== "number") throw new Error("Invalid parameters");

    log(`[updateCrewItemLocationQty] Updating ${itemId} in ${voxelId} by ${delta} for slug ${slug}`);

    const crew = await resolveCrewBySlug(slug);
    const crewId = crew.id;

    // Verify membership and role
    const { isMember, role: memberRole, isOwner, error: verifyError } = await verifyCrewMember(crewId, userId);
    if (verifyError) throw new Error(verifyError);
    if (!isMember && !isOwner) throw new Error("Not a member of this crew");

    const allowedRoles = ["owner", "xadmin", "manager", "admin"];
    if (!isOwner && !(memberRole && allowedRoles.includes(memberRole))) {
      throw new Error("Insufficient permissions to modify warehouse");
    }

    const { data: existingItem, error: selectError } = await supabaseAdmin
      .from("cars")
      .select("specs")
      .eq("id", itemId)
      .eq("crew_id", crewId)
      .eq("type", "wb_item")
      .single();

    if (selectError) throw new Error(`Failed to fetch item: ${selectError.message}`);
    if (!existingItem?.specs) throw new Error("Item not found or missing specs");

    let specs = safeParseSpecs(existingItem.specs);

    if (!Array.isArray(specs.warehouse_locations)) specs.warehouse_locations = [];

    let location = specs.warehouse_locations.find((l: any) => l.voxel_id === voxelId);
    if (!location) {
      location = { voxel_id: voxelId, quantity: 0 };
      specs.warehouse_locations.push(location);
    }

    location.quantity = Math.max(0, (location.quantity || 0) + delta);
    specs.warehouse_locations = specs.warehouse_locations.filter((l: any) => (l.quantity || 0) > 0);

    const totalQuantity = specs.warehouse_locations.reduce((acc: number, l: any) => acc + (l.quantity || 0), 0);

    const { error: updateError } = await supabaseAdmin
      .from("cars")
      .update({ specs })
      .eq("id", itemId)
      .eq("crew_id", crewId);

    if (updateError) throw new Error(`Failed to update item: ${updateError.message}`);

    log(`[updateCrewItemLocationQty] Success: ${itemId} in ${voxelId} by ${delta}. New total: ${totalQuantity}`);
    return {
      success: true,
      item: { id: itemId, specs, total_quantity: totalQuantity },
    };
  } catch (error: any) {
    err("[updateCrewItemLocationQty] Error:", error);
    return { success: false, error: error?.message || "Unknown error" };
  }
}

/* =========================
   CSV Export helpers (crew-specific)
   ========================= */

export async function exportCrewDiffToOwner(
  slug: string,
  diffData: any[],
  userId?: string
): Promise<{ success: boolean; csv?: string; error?: string }> {
  try {
    const crew = await resolveCrewBySlug(slug);
    const csvData = "\uFEFF" + Papa.unparse(
      diffData.map((d) => ({ Артикул: d.id, Изменение: d.diffQty, Ячейка: d.voxel })),
      { header: true, delimiter: "\t", quotes: true }
    );

    // Send to owner chat
    const ownerChatId = crew.owner_id; // Assume owner_id is chat_id
    if (!ownerChatId) throw new Error("Crew owner not configured");

    const res = await sendComplexMessage(
      ownerChatId,
      `Изменения склада для экипажа ${crew.name} (${slug})`,
      [],
      { attachment: { type: "document", content: csvData, filename: `warehouse_diff_${slug}.tsv` } }
    );

    if (!res.success) throw new Error(res.error || "Failed to send to owner");

    return { success: true, csv: csvData };
  } catch (error: any) {
    err("[exportCrewDiffToOwner] Error:", error);
    return { success: false, error: error?.message || "Export failed" };
  }
}

export async function exportCrewCurrentStock(
  slug: string,
  items: any[],
  summarized = false,
  userId?: string
): Promise<{ success: boolean; csv?: string; error?: string }> {
  try {
    const crew = await resolveCrewBySlug(slug);

    let csvData;
    if (summarized) {
      const stockData = items.map((item) => ({ Артикул: item.id, Количество: item.total_quantity }));
      csvData = "\uFEFF" + Papa.unparse(stockData, { header: true, delimiter: "\t", quotes: true });
    } else {
      const stockData = items.map((item) => ({
        Артикул: item.id,
        Название: `${item.make} ${item.model}`,
        "Общее Количество": item.total_quantity,
        Локации: item.specs?.warehouse_locations?.map((l: any) => `${l.voxel_id}:${l.quantity}`).join(", ") || "",
      }));
      csvData = "\uFEFF" + Papa.unparse(stockData, { header: true, delimiter: "\t", quotes: true });
    }

    // Optional: send to owner or return for client download
    return { success: true, csv: csvData };
  } catch (error: any) {
    err("[exportCrewCurrentStock] Error:", error);
    return { success: false, error: error?.message || "Export failed" };
  }
}

/* =========================
   Shift management (adapted for warehouse)
   ========================= */

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
    err("[getActiveShiftForCrewMember] error:", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

export async function startWarehouseShift(slug: string, memberId: string, shiftType: string = "warehouse") {
  try {
    const crew = await resolveCrewBySlug(slug);
    // Ensure no active shift
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
    }).select().single();
    if (error) throw error;
    return { success: true, shift: data };
  } catch (e: any) {
    return { success: false, error: e?.message || "unknown" };
  }
}

export async function endWarehouseShift(slug: string, shiftId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("crew_member_shifts")
      .update({ clock_out_time: new Date().toISOString() })
      .eq("id", shiftId)
      .select()
      .maybeSingle();
    if (error) throw error;
    return { success: true, shift: data };
  } catch (e: any) {
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

    const merged = {
      ...shift.checkpoint,
      saved_at: new Date().toISOString(),
      data: checkpointData,
    };

    const { error } = await supabaseAdmin
      .from("crew_member_shifts")
      .update({ checkpoint: merged })
      .eq("id", shift.id);

    if (error) throw error;
    return { success: true, shift };
  } catch (e: any) {
    return { success: false, error: e?.message || "unknown" };
  }
}

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
        const specs = safeParseSpecs(row.specs || {});
        specs.warehouse_locations = row.locations || [];
        const { error } = await supabaseAdmin
          .from("cars")
          .update({ specs })
          .eq("id", row.id)
          .eq("crew_id", crew.id);
        if (error) failures.push({ id: row.id, error: error.message });
        else applied++;
      } catch (e: any) {
        failures.push({ id: row.id, error: e.message });
      }
    }

    return { success: failures.length === 0, applied, failures };
  } catch (e: any) {
    return { success: false, error: e?.message || "unknown" };
  }
}

/* =========================
   Notifications to crew owner
   ========================= */

export async function notifyCrewOwner(
  slug: string,
  message: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const crew = await resolveCrewBySlug(slug);
    const ownerChatId = crew.owner_id; // Assuming owner_id is Telegram chat ID
    if (!ownerChatId) throw new Error("Crew owner chat not configured");

    const fullMessage = `Warehouse update for crew ${crew.name} (${slug})\nFrom: ${userId || "system"}\n\n${message}`;
    const res = await sendComplexMessage(ownerChatId, fullMessage);
    if (!res.success) throw new Error(res.error || "Failed to notify owner");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "Notification failed" };
  }
}