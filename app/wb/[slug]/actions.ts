"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { unstable_noStore as noStore } from "next/cache";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import Papa from "papaparse";
import { v4 as uuidv4 } from "uuid";

/**
 * Crew-specific warehouse actions (slugged).
 * - All operations operate within crew scope (crew_id).
 * - Main storage for locations is specs.warehouse_locations (voxel_id, quantity).
 *
 * This file intentionally exposes compatibility wrappers so client code that
 * expects functions like `updateCrewItemLocationQty` / `uploadCrewWarehouseCsv`
 * / `getActiveShiftForCrewMember` continues to work.
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

async function verifyCrewMember(crewId: string, userId: string | undefined): Promise<{ isMember: boolean; role?: string | null; isOwner: boolean; error?: string }> {
  if (!userId) return { isMember: false, isOwner: false, error: "User ID required" };
  const { data: member, error } = await supabaseAdmin
    .from("crew_members")
    .select("role, membership_status")
    .eq("crew_id", crewId)
    .eq("user_id", userId)
    .single();
  if (error && (error as any).code !== "PGRST116") throw error; // ignore no rows
  const isMember = !!member && member.membership_status === "active";
  const role = (member as any)?.role || null;
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

    // membership info - we pass undefined to just try to fetch role gracefully
    const { isMember, role: memberRole, isOwner, error: verifyError } = await verifyCrewMember(crewId, undefined);
    if (verifyError) warn(`[getCrewWarehouseItems] Membership verify: ${verifyError}`);

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

    log(`[updateCrewItemLocationQty] ${itemId} in ${voxelId} by ${delta} for slug ${slug}`);

    const crew = await resolveCrewBySlug(slug);
    const crewId = crew.id;

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
      .update({ specs, updated_at: new Date().toISOString() })
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
        Название: `${item.make || ""} ${item.model || ""}`.trim(),
        "Общее Количество": item.total_quantity,
        Локации: (item.specs?.warehouse_locations || []).map((l: any) => `${l.voxel_id}:${l.quantity}`).join(", ") || "",
      }));
      csvData = "\uFEFF" + Papa.unparse(stockData, { header: true, delimiter: "\t", quotes: true });
    }

    return { success: true, csv: csvData };
  } catch (error: any) {
    err("[exportCrewCurrentStock] Error:", error);
    return { success: false, error: error?.message || "Export failed" };
  }
}

/* =========================
   Upload CSV (admin)
   - parsedRows is array of objects from papaparse header:true
   - tries to match by id/artikul, else insert
   - returns counts
   ========================= */

export async function uploadCrewWarehouseCsv(parsedRows: any[], slug: string, userId?: string) {
  noStore();
  try {
    if (!slug) throw new Error("Slug required");
    const crew = await resolveCrewBySlug(slug);
    const crewId = crew.id;

    let applied = 0;
    const failures: any[] = [];

    for (const rawRow of parsedRows) {
      try {
        // Normalize common fields — allow flexible CSV columns
        const id = rawRow["Артикул"] || rawRow["id"] || rawRow["artikul"] || rawRow["article"] || rawRow["sku"];
        const make = rawRow["Make"] || rawRow["make"] || rawRow["Бренд"] || rawRow["brand"] || rawRow["make"] || "";
        const model = rawRow["Model"] || rawRow["model"] || rawRow["Название"] || rawRow["name"] || "";
        const locationsRaw = rawRow["Локации"] || rawRow["locations"] || rawRow["locations_str"] || rawRow["locations_list"] || rawRow["Ячейки"] || rawRow["cells"] || "";
        // parse locations like "A1:5,B2:3"
        const locs: any[] = [];
        if (typeof locationsRaw === "string" && locationsRaw.trim().length > 0) {
          locationsRaw.split(/[;,]+/).forEach((pair: string) => {
            const [v, q] = pair.split(":").map((s: string) => s && s.trim());
            if (v) locs.push({ voxel_id: v, quantity: Number(q || 0) });
          });
        } else if (Array.isArray(rawRow.locations)) {
          (rawRow.locations as any[]).forEach((l: any) => {
            if (typeof l === "string") {
              const [v, q] = l.split(":").map((s:string) => s && s.trim());
              if (v) locs.push({ voxel_id: v, quantity: Number(q || 0) });
            } else if (l && l.voxel_id) {
              locs.push({ voxel_id: l.voxel_id, quantity: Number(l.quantity || 0) });
            }
          });
        }

        // Build specs
        const specs: any = {
          ...(rawRow.specs && typeof rawRow.specs === "object" ? rawRow.specs : {}),
          warehouse_locations: locs,
          size: rawRow["size"] || rawRow["Размер"] || undefined,
          color: rawRow["color"] || rawRow["Цвет"] || undefined,
          season: rawRow["season"] || rawRow["Сезон"] || undefined,
          pattern: rawRow["pattern"] || rawRow["Узор"] || undefined,
        };

        // Try to find existing by id
        if (id) {
          const { data: exists } = await supabaseAdmin
            .from("cars")
            .select("id")
            .eq("id", id)
            .eq("crew_id", crewId)
            .limit(1)
            .maybeSingle();

          if (exists) {
            const { error: updateErr } = await supabaseAdmin
              .from("cars")
              .update({
                make,
                model,
                specs,
                updated_at: new Date().toISOString(),
              })
              .eq("id", id)
              .eq("crew_id", crewId);

            if (updateErr) {
              failures.push({ id, error: updateErr.message });
            } else applied++;
            continue;
          }
        }

        // Insert new
        const newId = id || uuidv4();
        const insertPayload: any = {
          id: newId,
          crew_id: crewId,
          type: "wb_item",
          make,
          model,
          specs,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const { error: insertErr } = await supabaseAdmin.from("cars").insert(insertPayload);
        if (insertErr) {
          failures.push({ id: newId, error: insertErr.message });
        } else applied++;
      } catch (e: any) {
        failures.push({ row: rawRow, error: e?.message || e });
      }
    }

    return { success: failures.length === 0, applied, failures, message: `Applied ${applied}, failed ${failures.length}` };
  } catch (e: any) {
    err("[uploadCrewWarehouseCsv] error:", e);
    return { success: false, error: e?.message || "upload failed" };
  }
}

/* =========================
   Shift management
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
      created_at: new Date().toISOString(),
    }).select().single();
    if (error) throw error;
    return { success: true, shift: data };
  } catch (e: any) {
    err("[startWarehouseShift] error:", e);
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
    err("[endWarehouseShift] error:", e);
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
      .update({ checkpoint: merged, updated_at: new Date().toISOString() })
      .eq("id", shift.id);

    if (error) throw error;
    return { success: true, shift };
  } catch (e: any) {
    err("[saveCrewCheckpoint] error:", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

/* =========================
   Reset checkpoint: IMPORTANT
   - This replaces inventory data by writing specs.warehouse_locations
   - We carefully update specs (not top-level quantity)
   ========================= */
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
        // Fetch existing specs to merge safely
        const { data: existing } = await supabaseAdmin
          .from("cars")
          .select("specs")
          .eq("id", row.id)
          .eq("crew_id", crew.id)
          .single();

        let specs = safeParseSpecs(existing?.specs || {});
        // Ensure we write locations in normalized shape: {voxel_id, quantity}
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
        failures.push({ id: row.id, error: e.message });
      }
    }

    return { success: failures.length === 0, applied, failures };
  } catch (e: any) {
    err("[resetCrewCheckpoint] Error:", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

/* =========================
   Notifications
   ========================= */

export async function notifyCrewOwner(
  slug: string,
  message: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const crew = await resolveCrewBySlug(slug);
    const ownerChatId = crew.owner_id;
    if (!ownerChatId) throw new Error("Crew owner chat not configured");

    const fullMessage = `Warehouse update for crew ${crew.name} (${slug})\nFrom: ${userId || "system"}\n\n${message}`;
    const res = await sendComplexMessage(ownerChatId, fullMessage);
    if (!res.success) throw new Error(res.error || "Failed to notify owner");
    return { success: true };
  } catch (e: any) {
    err("[notifyCrewOwner] Error:", e);
    return { success: false, error: e?.message || "Notification failed" };
  }
}

/* =========================
   Thin compatibility wrappers (client expects these names sometimes)
   ========================= */

export async function updateItemQuantityForCrew(slug: string, itemId: string, voxelId: string, delta: number, userId?: string) {
  return updateCrewItemLocationQty(slug, itemId, voxelId, delta, userId);
}
export async function startShiftForMember(slug: string, memberId: string, shiftType?: string) {
  return startWarehouseShift(slug, memberId, shiftType);
}
export async function endShiftForMember(slug: string, shiftId: string) {
  return endWarehouseShift(slug, shiftId);
}
export async function saveCheckpointForMember(slug: string, memberId: string, checkpointData: any) {
  return saveCrewCheckpoint(slug, memberId, checkpointData);
}
export async function resetCheckpointForMember(slug: string, memberId: string) {
  return resetCrewCheckpoint(slug, memberId);
}
export async function getActiveShiftForMember(slug: string, memberId: string) {
  return getActiveShiftForCrewMember(slug, memberId);
}
export async function uploadWarehouseCsvForCrew(parsedRows: any[], slug: string, userId?: string) {
  return uploadCrewWarehouseCsv(parsedRows, slug, userId);
}