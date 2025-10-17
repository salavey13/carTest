"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { notifyCrewOwner } from "@/app/wb/[slug]/actions_notify";
import Papa from "papaparse";

function log(...args: any[]) {
  if ((process.env.NEXT_PUBLIC_DEBUG ?? "1") !== "0") console.log("[wb/actions_shifts]", ...args);
}
function err(...args: any[]) {
  if ((process.env.NEXT_PUBLIC_DEBUG ?? "1") !== "0") console.error("[wb/actions_shifts]", ...args);
}

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

/* -------------------------
   Member status helpers
   ------------------------- */

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

export async function setCrewMemberLiveStatus(
  slug: string,
  memberId: string,
  newStatus: string,
  opts: { last_location?: string | null } = {}
) {
  try {
    const crew = await resolveCrewBySlug(slug);

    const payload: any = { live_status: newStatus };
    if (opts.last_location !== undefined) payload.last_location = opts.last_location;

    const { error } = await supabaseAdmin
      .from("crew_members")
      .update(payload)
      .eq("crew_id", crew.id)
      .eq("user_id", memberId)
      .eq("membership_status", "active");

    if (error) throw error;

    const adminChat = process.env.ADMIN_CHAT_ID;
    const safeMessage = `Shift status changed: user=${memberId} crew=${slug} -> ${newStatus}`;

    try {
      if (adminChat) await sendComplexMessage(adminChat, safeMessage);
    } catch (notifyErr) {
      log("Failed to notify admin:", notifyErr);
    }

    try {
      await notifyCrewOwner(slug, `Member ${memberId} changed status to ${newStatus}`, memberId);
    } catch (ownerNotifyError) {
      log("Failed to notify crew owner:", ownerNotifyError);
    }

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
    const active = await supabaseAdmin
      .from("crew_member_shifts")
      .select("id")
      .eq("member_id", memberId)
      .eq("crew_id", crew.id)
      .is("clock_out_time", null)
      .limit(1)
      .maybeSingle();
    if (active.data) return { success: false, error: "Active shift exists" };

    const { data, error } = await supabaseAdmin
      .from("crew_member_shifts")
      .insert({
        member_id: memberId,
        crew_id: crew.id,
        shift_type: shiftType,
        checkpoint: {},
        actions: [],
        clock_in_time: new Date().toISOString(),
      })
      .select()
      .single();

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
      .update({ clock_out_time: new Date().toISOString() })
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

    const { error } = await supabaseAdmin.from("crew_member_shifts").update({ checkpoint: merged }).eq("id", shift.id);

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
        const { data: existing } = await supabaseAdmin.from("cars").select("specs").eq("id", row.id).eq("crew_id", crew.id).single();

        let specs = safeParseSpecs(existing?.specs || {});
        const normalizedLocations = Array.isArray(row.locations)
          ? row.locations.map((l: any) => ({ voxel_id: l.voxel || l.voxel_id || l.id, quantity: Number(l.quantity || 0) }))
          : [];

        specs.warehouse_locations = normalizedLocations;
        const { error } = await supabaseAdmin.from("cars").update({ specs }).eq("id", row.id).eq("crew_id", crew.id);

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

/* -------------------------
   Export daily entry for shift (onloads + offloads)
   ------------------------- */

/**
 * exportDailyEntryForShift
 * - slug: crew slug
 * - opts: { isTelegram?: boolean } — if false/undefined, will attempt to send to ADMIN_CHAT_ID
 *
 * Behavior:
 * - collect shifts for today (clock_in_time >= startOfDay UTC) and active shift (clock_out_time IS NULL)
 * - collect actions: onload/offload (type field OR delta sign)
 * - aggregate by itemId + voxel_id + type, summing qty
 * - format TSV and either send to admin or return csv
 */
export async function exportDailyEntryForShift(slug: string, opts: { isTelegram?: boolean } = {}) {
  try {
    const crew = await resolveCrewBySlug(slug);
    // start of day in UTC
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const startOfDay_iso = startOfDay.toISOString();

    // 1) fetch shifts that started today
    const { data: shiftsToday, error: sErr } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("*")
      .eq("crew_id", crew.id)
      .gte("clock_in_time", startOfDay_iso)
      .limit(1000);

    if (sErr) throw sErr;

    // 2) fetch active shift (if exists) to include actions from ongoing shift
    const { data: activeShift } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("*")
      .eq("crew_id", crew.id)
      .is("clock_out_time", null)
      .limit(1000);

    // combine unique shifts
    const shiftsMap = new Map<string, any>();
    (shiftsToday || []).forEach((s: any) => shiftsMap.set(String(s.id), s));
    (activeShift || []).forEach((s: any) => shiftsMap.set(String(s.id), s));
    const shifts = Array.from(shiftsMap.values());

    // 3) collect all onload/offload actions
    const rows: Array<{ itemId: string; voxel: string | null; qty: number; user: string | null; ts: string | null; type: string }> = [];

    for (const sh of shifts) {
      const actions = Array.isArray(sh.actions) ? sh.actions : [];
      // sort by timestamp if present to keep order
      actions.sort((a: any, b: any) => {
        const ta = a.ts ? new Date(a.ts).getTime() : 0;
        const tb = b.ts ? new Date(b.ts).getTime() : 0;
        return ta - tb;
      });
      for (const a of actions) {
        // unify possible shapes: { type, itemId, voxel_id, voxel, qty, amount, delta, ts, user_id }
        const deltaRaw = typeof a.delta === "number" ? a.delta : (typeof a.qty === "number" ? a.qty : (typeof a.amount === "number" ? a.amount : null));
        const delta = deltaRaw === null ? null : Number(deltaRaw);
        if (delta === null || isNaN(delta)) continue;

        const t = a.type || (delta < 0 ? "offload" : "onload");
        const qty = Math.abs(delta || 0);
        const itemId = a.itemId || a.item_id || a.id || a.sku || null;
        if (!itemId) continue;
        const voxel = a.voxel || a.voxel_id || (a.location && (a.location.voxel || a.location.voxel_id)) || null;

        rows.push({
          itemId: String(itemId),
          voxel: voxel ? String(voxel) : null,
          qty,
          user: a.user_id || a.user || sh.member_id || null,
          ts: a.ts || a.ts_iso || sh.clock_in_time || null,
          type: t,
        });
      }
    }

    if (rows.length === 0) {
      return { success: true, csv: "", message: "No onload/offload actions for today" };
    }

    // 4) aggregate by itemId + voxel + type
    const aggMap = new Map<string, { itemId: string; voxel: string | null; type: string; qty: number; users: Set<string>; ops: number }>();
    for (const r of rows) {
      const key = `${r.itemId}::${r.voxel || ""}::${r.type}`;
      const cur = aggMap.get(key) || { itemId: r.itemId, voxel: r.voxel, type: r.type, qty: 0, users: new Set<string>(), ops: 0 };
      cur.qty += r.qty;
      if (r.user) cur.users.add(r.user);
      cur.ops += 1;
      aggMap.set(key, cur);
    }

    const aggregated = Array.from(aggMap.values()).map((v) => ({
      Артикул: v.itemId,
      Тип: v.type,
      Ячейка: v.voxel || "",
      Количество: v.qty,
      Участников: Array.from(v.users).join(","),
      Операций: v.ops,
    }));

    const csv = "\uFEFF" + Papa.unparse(aggregated, { header: true, delimiter: "\t", quotes: true });

    // 5) deliver
    if (!opts.isTelegram) {
      const adminChat = process.env.ADMIN_CHAT_ID;
      if (!adminChat) {
        return { success: true, csv, message: "ADMIN_CHAT_ID not configured; csv returned" };
      }
      const res = await sendComplexMessage(
        adminChat,
        `Daily onload/offload for crew ${crew.name} (${crew.slug}) — ${new Date().toISOString()}`,
        [],
        { attachment: { type: "document", content: csv, filename: `daily_onoff_${crew.slug}.tsv` } }
      );
      if (!res.success) throw new Error(res.error || "Failed to send to admin");
      return { success: true, csv };
    }

    return { success: true, csv };
  } catch (e: any) {
    err("exportDailyEntryForShift error", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

/* -------------------------
   Send delivery car request
   ------------------------- */

/**
 * sendDeliveryCarRequest(slug, opts)
 * - aggregates today's offload qty (all providers combined) and sends a short message to TAXI_REQUEST_CHAT_ID
 * - opts: { forceType?: 'taxi'|'pickup'|'auto' }  // 'auto' means choose by threshold
 * Threshold: default 10 items => pickup
 */
export async function sendDeliveryCarRequest(slug: string, opts: { forceType?: "taxi" | "pickup" | "auto" } = {}) {
  try {
    const crew = await resolveCrewBySlug(slug);
    // gather today's shifts + active
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const startOfDay_iso = startOfDay.toISOString();

    const { data: shiftsToday } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("*")
      .eq("crew_id", crew.id)
      .gte("clock_in_time", startOfDay_iso)
      .limit(1000);

    const { data: activeShift } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("*")
      .eq("crew_id", crew.id)
      .is("clock_out_time", null)
      .limit(1000);

    const shiftsMap = new Map<string, any>();
    (shiftsToday || []).forEach((s: any) => shiftsMap.set(String(s.id), s));
    (activeShift || []).forEach((s: any) => shiftsMap.set(String(s.id), s));
    const shifts = Array.from(shiftsMap.values());

    let totalOffloadQty = 0;
    // for message: top items by qty
    const itemMap = new Map<string, number>();

    for (const sh of shifts) {
      const actions = Array.isArray(sh.actions) ? sh.actions : [];
      for (const a of actions) {
        const deltaRaw = typeof a.delta === "number" ? a.delta : (typeof a.qty === "number" ? a.qty : (typeof a.amount === "number" ? a.amount : null));
        const delta = deltaRaw === null ? null : Number(deltaRaw);
        if (delta === null || isNaN(delta)) continue;
        const isOffload = (a.type === "offload") || (delta < 0);
        if (!isOffload) continue;
        const qty = Math.abs(delta || 0);
        const itemId = a.itemId || a.item_id || a.id || a.sku || "unknown";
        totalOffloadQty += qty;
        itemMap.set(String(itemId), (itemMap.get(String(itemId)) || 0) + qty);
      }
    }

    // choose car type
    const threshold = 10;
    let carType: "taxi" | "pickup" | "auto" = "auto";
    if (opts.forceType === "taxi" || opts.forceType === "pickup") carType = opts.forceType;
    else carType = totalOffloadQty >= threshold ? "pickup" : "taxi";

    const chatId = process.env.TAXI_REQUEST_CHAT_ID || process.env.ADMIN_CHAT_ID;
    if (!chatId) throw new Error("TAXI_REQUEST_CHAT_ID not configured");

    // prepare message
    const topItems = Array.from(itemMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const topList = topItems.map(([id, q]) => `${id}: ${q}`).join("\n") || "—";

    const msg = `🚚 Запрос на подачу машины для склада ${crew.name} (${crew.slug})
Всего offload (сегодня): ${totalOffloadQty}
Рекомендуемый тип: ${carType === "auto" ? (totalOffloadQty >= threshold ? "pickup" : "taxi") : carType}
Top items:
${topList}

Примечание: Ozon/YM handled manually.`;

    const res = await sendComplexMessage(chatId as string, msg);
    if (!res.success) throw new Error(res.error || "Failed to send taxi request");

    // also notify admin channel if different
    if (process.env.ADMIN_CHAT_ID && process.env.ADMIN_CHAT_ID !== chatId) {
      try {
        await sendComplexMessage(process.env.ADMIN_CHAT_ID, `[TAXI_REQUEST] ${crew.slug} -> ${carType} qty=${totalOffloadQty}`);
      } catch (_) {}
    }

    return { success: true, totalOffloadQty, carType };
  } catch (e: any) {
    err("sendDeliveryCarRequest error", e);
    return { success: false, error: e?.message || "unknown" };
  }
}

/* -------------------------
   utility: safeParseSpecs (used by reset)
   ------------------------- */
function safeParseSpecs(specs: any) {
  if (!specs) return {};
  if (typeof specs === "object") return specs;
  try {
    return JSON.parse(specs);
  } catch {
    return {};
  }
}