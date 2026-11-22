"use server";

// app/franchize/server-actions/bike-maintenance.ts
//
// Task 76 (boss 2026-10-07): «planned service checkbox list in мотопарк for
// bikes … with full checking/creation/deletion of planned service items with
// proper access rights (owner/admin all, subrenter can add but can't delete,
// members can read and mark checked, etc.)».
//
// STORAGE: cars.specs.maintenance_plan — pure JSONB, NO schema migration
// (same discipline as specs.salary / specs.subrenter_chat_id), so there is
// no SQL file for Paul and no RLS matrix to maintain: every write goes
// through THIS module, which re-verifies the actor server-side on every call
// (signed cookie → initData HMAC fallback → password path for owner/admin).
//
// ACCESS MATRIX (app/franchize/lib/bike-maintenance.ts — one shared fn):
//   staff (crew owner / crew admin / co_owner / global admin)
//     → read + add + check + delete
//   subrenter of THIS bike (specs.subrenter_chat_id === actor)
//     → read + add + check, NO delete
//   active crew member
//     → read + check, NO add, NO delete
//   everybody else → nothing.

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { resolveServerActorUserId } from "./shared/auth-helpers";
import {
  MAINTENANCE_ITEMS_CAP,
  MAINTENANCE_PLAN_SPEC_KEY,
  MAINTENANCE_TEXT_MAX,
  maintenancePermsForRole,
  newMaintenanceItemId,
  sanitizeMaintenancePlan,
  type MaintenancePerms,
  type MaintenancePlan,
  type MaintenanceViewerRole,
} from "@/app/franchize/lib/bike-maintenance";

interface CarPlanRow {
  id: string;
  crew_id: string;
  specs: Record<string, unknown> | null;
}

interface NameRow {
  full_name: string | null;
  username: string | null;
}

function publicName(row: NameRow | null): string | null {
  const full = (row?.full_name ?? "").trim();
  if (full) return full;
  const nick = (row?.username ?? "").trim();
  return nick || null;
}

/** Global admin — top-level columns first (iter8 pattern), metadata legacy second.
 *  Same check as bike-wall.ts's local isGlobalAdminRow. */
function isGlobalAdminRow(user: { role: string | null; status: string | null; metadata: Record<string, unknown> | null } | null): boolean {
  const meta = user?.metadata as Record<string, unknown> | null;
  return (
    user?.role === "admin" ||
    user?.role === "vprAdmin" ||
    user?.status === "admin" ||
    meta?.role === "admin" ||
    meta?.status === "admin"
  );
}

async function userNameOf(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("full_name, username")
    .eq("user_id", userId)
    .maybeSingle();
  return publicName((data ?? null) as NameRow | null);
}

/**
 * Resolve the viewer's coarse role for ONE bike. Reuses the bike-wall's
 * identity discipline: the claimed actorUserId is only honored through
 * resolveServerActorUserId (signed cookie / HMAC initData) or the password
 * path (claimed id must BE the crew owner / a global admin — SA-001 rule).
 */
async function resolveMaintenanceRole(params: {
  slug: string;
  bikeId: string;
  actorUserId?: string;
  isPasswordAuth?: boolean;
  initData?: string;
}): Promise<
  | { ok: true; crewId: string; crewOwnerId: string | null; actorUserId: string; role: MaintenanceViewerRole }
  | { ok: false; error: string }
> {
  const { slug, bikeId } = params;

  const { data: crew } = await supabaseAdmin
    .from("crews")
    .select("id, owner_id")
    .eq("slug", slug.trim())
    .maybeSingle();
  if (!crew) return { ok: false, error: "Экипаж не найден." };

  // ── identity (same three paths as bike-wall.ts) ─────────────────────────
  let actorUserId = await resolveServerActorUserId({
    claimedActorUserId: params.actorUserId,
    initData: params.initData,
  });

  if (!actorUserId && params.isPasswordAuth && params.actorUserId) {
    // Password analytics path: the flag alone grants nothing — the claimed
    // actorUserId must be this crew's owner or a global admin.
    const { data: actorUser } = await supabaseAdmin
      .from("users")
      .select("role, status, metadata")
      .eq("user_id", params.actorUserId)
      .maybeSingle();
    if (crew.owner_id === params.actorUserId || isGlobalAdminRow(actorUser ?? null)) {
      actorUserId = params.actorUserId;
    }
  }

  if (!actorUserId) return { ok: false, error: "Не авторизовано." };

  // ── the bike must belong to this crew and be a bike ──────────────────────
  const { data: car } = await supabaseAdmin
    .from("cars")
    .select("id, crew_id, specs")
    .eq("id", bikeId.trim())
    .eq("crew_id", crew.id)
    .eq("type", "bike")
    .maybeSingle();
  if (!car) return { ok: false, error: "Мото не найдено в этом экипаже." };

  // ── role: staff → subrenter → member → none ─────────────────────────────
  if (crew.owner_id === actorUserId) {
    return { ok: true, crewId: crew.id, crewOwnerId: crew.owner_id, actorUserId, role: "staff" };
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("role, status, metadata")
    .eq("user_id", actorUserId)
    .maybeSingle();
  if (isGlobalAdminRow(user ?? null)) {
    return { ok: true, crewId: crew.id, crewOwnerId: crew.owner_id, actorUserId, role: "staff" };
  }

  const { data: membership } = await supabaseAdmin
    .from("crew_members")
    .select("role, membership_status")
    .eq("crew_id", crew.id)
    .eq("user_id", actorUserId)
    .maybeSingle();

  if (membership?.membership_status === "active" && ["owner", "admin", "co_owner"].includes(membership.role || "")) {
    return { ok: true, crewId: crew.id, crewOwnerId: crew.owner_id, actorUserId, role: "staff" };
  }

  const specs = (car.specs ?? {}) as Record<string, unknown>;
  if (typeof specs.subrenter_chat_id === "string" && specs.subrenter_chat_id === actorUserId) {
    return { ok: true, crewId: crew.id, crewOwnerId: crew.owner_id, actorUserId, role: "subrenter" };
  }

  if (membership?.membership_status === "active") {
    return { ok: true, crewId: crew.id, crewOwnerId: crew.owner_id, actorUserId, role: "member" };
  }

  return { ok: false, error: "Недостаточно прав для просмотра." };
}

/** Load + sanitize the plan of one car row (fresh read for read-modify-write). */
function planOf(car: CarPlanRow): MaintenancePlan {
  return sanitizeMaintenancePlan(car.specs?.[MAINTENANCE_PLAN_SPEC_KEY]);
}

/** Persist the plan back into specs (read-modify-write on the JSONB key only). */
async function writePlan(car: CarPlanRow, plan: MaintenancePlan, actorUserId: string): Promise<boolean> {
  const specs = { ...(car.specs ?? {}) };
  specs[MAINTENANCE_PLAN_SPEC_KEY] = { ...plan, updatedAt: new Date().toISOString(), updatedBy: actorUserId };
  const { error } = await supabaseAdmin
    .from("cars")
    .update({ specs })
    .eq("id", car.id);
  if (error) {
    logger.error("[bike-maintenance] specs write failed:", error.message);
    return false;
  }
  return true;
}

const baseSchema = z.object({
  slug: z.string().trim().min(1),
  bikeId: z.string().trim().min(1),
  actorUserId: z.string().trim().max(32).optional(),
  isPasswordAuth: z.boolean().optional(),
  initData: z.string().trim().optional(),
});

export async function getBikeMaintenanceAction(params: {
  slug: string;
  bikeId: string;
  actorUserId?: string;
  isPasswordAuth?: boolean;
  initData?: string;
}): Promise<{
  success: boolean;
  data?: { plan: MaintenancePlan; perms: MaintenancePerms };
  error?: string;
}> {
  try {
    const parsed = baseSchema.safeParse(params);
    if (!parsed.success) return { success: false, error: "Некорректный запрос." };
    const gate = await resolveMaintenanceRole(parsed.data);
    if (!gate.ok) return { success: false, error: gate.error };
    const perms = maintenancePermsForRole(gate.role);
    if (!perms.canRead) return { success: false, error: "Недостаточно прав для просмотра." };

    const { data: car } = await supabaseAdmin
      .from("cars")
      .select("id, crew_id, specs")
      .eq("id", parsed.data.bikeId)
      .eq("crew_id", gate.crewId)
      .maybeSingle();
    if (!car) return { success: false, error: "Мото не найдено." };

    return { success: true, data: { plan: planOf(car as CarPlanRow), perms } };
  } catch (error) {
    logger.error("[getBikeMaintenanceAction]", error);
    return { success: false, error: error instanceof Error ? error.message : "Внутренняя ошибка" };
  }
}

const addSchema = baseSchema.extend({ text: z.string().trim().min(1).max(MAINTENANCE_TEXT_MAX) });

export async function addBikeMaintenanceItemAction(params: {
  slug: string;
  bikeId: string;
  text: string;
  actorUserId?: string;
  isPasswordAuth?: boolean;
  initData?: string;
}): Promise<{ success: boolean; data?: { plan: MaintenancePlan }; error?: string }> {
  try {
    const parsed = addSchema.safeParse(params);
    if (!parsed.success) return { success: false, error: "Текст пункта обязателен (до 200 символов)." };
    const gate = await resolveMaintenanceRole(parsed.data);
    if (!gate.ok) return { success: false, error: gate.error };
    const perms = maintenancePermsForRole(gate.role);
    if (!perms.canAdd) return { success: false, error: "Добавлять пункты может владелец, админ или партнёр этого мото." };

    const { data: car } = await supabaseAdmin
      .from("cars")
      .select("id, crew_id, specs")
      .eq("id", parsed.data.bikeId)
      .eq("crew_id", gate.crewId)
      .maybeSingle();
    if (!car) return { success: false, error: "Мото не найдено." };

    const row = car as CarPlanRow;
    const plan = planOf(row);
    if (plan.items.length >= MAINTENANCE_ITEMS_CAP) {
      return { success: false, error: `Список переполнен (максимум ${MAINTENANCE_ITEMS_CAP} пунктов).` };
    }
    const createdByName = await userNameOf(gate.actorUserId);
    plan.items = [
      ...plan.items,
      {
        id: newMaintenanceItemId(),
        text: parsed.data.text.slice(0, MAINTENANCE_TEXT_MAX),
        done: false,
        doneAt: null,
        doneBy: null,
        doneByName: null,
        createdAt: new Date().toISOString(),
        createdBy: gate.actorUserId,
        createdByName,
      },
    ];
    if (!(await writePlan(row, plan, gate.actorUserId))) {
      return { success: false, error: "Не удалось сохранить пункт." };
    }
    return { success: true, data: { plan } };
  } catch (error) {
    logger.error("[addBikeMaintenanceItemAction]", error);
    return { success: false, error: error instanceof Error ? error.message : "Внутренняя ошибка" };
  }
}

const toggleSchema = baseSchema.extend({ itemId: z.string().trim().min(1).max(80), done: z.boolean() });

export async function toggleBikeMaintenanceItemAction(params: {
  slug: string;
  bikeId: string;
  itemId: string;
  done: boolean;
  actorUserId?: string;
  isPasswordAuth?: boolean;
  initData?: string;
}): Promise<{ success: boolean; data?: { plan: MaintenancePlan }; error?: string }> {
  try {
    const parsed = toggleSchema.safeParse(params);
    if (!parsed.success) return { success: false, error: "Некорректный запрос." };
    const gate = await resolveMaintenanceRole(parsed.data);
    if (!gate.ok) return { success: false, error: gate.error };
    const perms = maintenancePermsForRole(gate.role);
    if (!perms.canCheck) return { success: false, error: "Отмечать выполнение могут только члены экипажа и партнёр этого мото." };

    const { data: car } = await supabaseAdmin
      .from("cars")
      .select("id, crew_id, specs")
      .eq("id", parsed.data.bikeId)
      .eq("crew_id", gate.crewId)
      .maybeSingle();
    if (!car) return { success: false, error: "Мото не найдено." };

    const row = car as CarPlanRow;
    const plan = planOf(row);
    const item = plan.items.find((i) => i.id === parsed.data.itemId);
    if (!item) return { success: false, error: "Пункт не найден." };
    item.done = parsed.data.done;
    item.doneAt = parsed.data.done ? new Date().toISOString() : null;
    item.doneBy = parsed.data.done ? gate.actorUserId : null;
    item.doneByName = parsed.data.done ? await userNameOf(gate.actorUserId) : null;
    if (!(await writePlan(row, plan, gate.actorUserId))) {
      return { success: false, error: "Не удалось сохранить отметку." };
    }
    return { success: true, data: { plan } };
  } catch (error) {
    logger.error("[toggleBikeMaintenanceItemAction]", error);
    return { success: false, error: error instanceof Error ? error.message : "Внутренняя ошибка" };
  }
}

const deleteSchema = baseSchema.extend({ itemId: z.string().trim().min(1).max(80) });

export async function deleteBikeMaintenanceItemAction(params: {
  slug: string;
  bikeId: string;
  itemId: string;
  actorUserId?: string;
  isPasswordAuth?: boolean;
  initData?: string;
}): Promise<{ success: boolean; data?: { plan: MaintenancePlan }; error?: string }> {
  try {
    const parsed = deleteSchema.safeParse(params);
    if (!parsed.success) return { success: false, error: "Некорректный запрос." };
    const gate = await resolveMaintenanceRole(parsed.data);
    if (!gate.ok) return { success: false, error: gate.error };
    const perms = maintenancePermsForRole(gate.role);
    if (!perms.canDelete) {
      return { success: false, error: "Удалять пункты может только владелец или админ экипажа." };
    }

    const { data: car } = await supabaseAdmin
      .from("cars")
      .select("id, crew_id, specs")
      .eq("id", parsed.data.bikeId)
      .eq("crew_id", gate.crewId)
      .maybeSingle();
    if (!car) return { success: false, error: "Мото не найдено." };

    const row = car as CarPlanRow;
    const plan = planOf(row);
    const next = plan.items.filter((i) => i.id !== parsed.data.itemId);
    if (next.length === plan.items.length) return { success: false, error: "Пункт не найден." };
    plan.items = next;
    if (!(await writePlan(row, plan, gate.actorUserId))) {
      return { success: false, error: "Не удалось удалить пункт." };
    }
    return { success: true, data: { plan } };
  } catch (error) {
    logger.error("[deleteBikeMaintenanceItemAction]", error);
    return { success: false, error: error instanceof Error ? error.message : "Внутренняя ошибка" };
  }
}
