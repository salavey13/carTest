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
    .maybeSingle();
  if (error || !data) throw new Error(`Экипаж '${slug}' не найден`);
  return data;
}

/**
 * Проверка доступа: Владелец, Член экипажа или Участник активного лобби (Рейдер)
 */
async function verifyCrewAccess(crewId: string, userId: string | undefined) {
  if (!userId) return { allowed: false, role: null };

  // 1. Проверка на владельца
  const { data: crew } = await supabaseAdmin.from("crews").select("owner_id").eq("id", crewId).single();
  if (crew?.owner_id === userId) return { allowed: true, role: 'owner' };

  // 2. Проверка на постоянное членство
  const { data: member } = await supabaseAdmin
    .from("crew_members")
    .select("role, membership_status")
    .eq("crew_id", crewId)
    .eq("user_id", userId)
    .eq("membership_status", "active")
    .maybeSingle();
  if (member) return { allowed: true, role: member.role };

  // 3. Проверка на временный доступ через активное Лобби
  const { data: lobbyMember } = await supabaseAdmin
    .from("lobby_members")
    .select("lobbies!inner(status, crew_id)")
    .eq("user_id", userId)
    .eq("lobbies.crew_id", crewId)
    .eq("lobbies.status", "active")
    .maybeSingle();

  if (lobbyMember) return { allowed: true, role: 'raider' };

  return { allowed: false, role: null };
}

export async function getCrewWarehouseItems(slug: string) {
  noStore();
  try {
    const crew = await resolveCrewBySlug(slug);
    const { data, error } = await supabaseAdmin
      .from("cars")
      .select("*")
      .eq("type", "wb_item")
      .eq("crew_id", crew.id)
      .order("model");

    if (error) throw error;
    const items = (data || []).map((i: any) => ({ ...i, specs: safeParseSpecs(i.specs) }));

    return { success: true, data: items, crew };
  } catch (e: any) {
    return { success: false, error: e?.message || "Ошибка загрузки" };
  }
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
    const { allowed } = await verifyCrewAccess(crew.id, userId);
    if (!allowed) throw new Error("У вас нет доступа к этому складу");

    const { data: item } = await supabaseAdmin.from("cars").select("specs, make, model").eq("id", itemId).single();
    if (!item) throw new Error("Товар не найден");

    const specs = safeParseSpecs(item.specs);
    if (!Array.isArray(specs.warehouse_locations)) specs.warehouse_locations = [];

    let location = specs.warehouse_locations.find((l: any) => l.voxel_id === voxelId);
    if (!location) {
      location = { voxel_id: voxelId, quantity: 0 };
      specs.warehouse_locations.push(location);
    }

    location.quantity = Math.max(0, (location.quantity || 0) + delta);
    specs.warehouse_locations = specs.warehouse_locations.filter((l: any) => (l.quantity || 0) > 0);

    await supabaseAdmin.from("cars").update({ specs }).eq("id", itemId).eq("crew_id", crew.id);

    // Логирование действия в активную смену
    if (userId) {
      const { data: activeShift } = await supabaseAdmin
        .from("crew_member_shifts")
        .select("id, actions")
        .eq("member_id", userId)
        .eq("crew_id", crew.id)
        .is("clock_out_time", null)
        .maybeSingle();

      let shiftId = activeShift?.id;
      let actions = Array.isArray(activeShift?.actions) ? [...activeShift.actions] : [];

      // Если смены нет (рейдер забыл нажать "Начать"), создаем её автоматически
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
        actions.push({
          type: delta < 0 ? "offload" : "onload",
          itemId,
          item: `${item.make} ${item.model}`,
          voxel: voxelId,
          qty: Math.abs(delta),
          ts: new Date().toISOString()
        });
        await supabaseAdmin.from("crew_member_shifts").update({ actions }).eq("id", shiftId);
      }
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "Ошибка обновления" };
  }
}