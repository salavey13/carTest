// app/franchize/server-actions/equipment-rentals.ts
"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

/**
 * I5 — Equipment rentals server actions.
 * Plan: docs/superpowers/plans/2026-08-12-i5-equipment-rentals.md (Task 2)
 * Contract: PLAN-I5-SERVICE-OPERATIONS.md п.6 (server actions pattern)
 *
 * Equipment = cars rows with type='equipment' (helmets, jackets, gloves, etc.)
 * Rentals stored in equipment_rentals table, optionally linked to bike rental via
 * primary_rental_id (NULL = standalone rental).
 */

// ── Auth helper (verifyCrewAccess pattern from leads.ts) ─────────────────────
async function verifyCrewAccess(
  slug: string,
): Promise<{ allowed: boolean; crewId?: string; actorUserId?: string; error?: string }> {
  const { cookies } = await import("next/headers");
  const { TELEGRAM_ACTOR_COOKIE, verifyTelegramActorCookieValue } = await import("@/lib/telegram-actor-cookie");

  const cookieUserId = verifyTelegramActorCookieValue(
    (await cookies()).get(TELEGRAM_ACTOR_COOKIE)?.value,
  );

  if (cookieUserId) {
    // Telegram auth — verify crew access
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", cookieUserId)
      .maybeSingle();

    const userMetadata = user?.metadata as Record<string, unknown> | null;
    const isAdmin = userMetadata?.role === "admin" || userMetadata?.status === "admin";

    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug)
      .maybeSingle();

    if (!crew) {
      return { allowed: false, error: "Экипаж не найден." };
    }

    // Owner or admin has access
    if (crew.owner_id === cookieUserId || isAdmin) {
      return { allowed: true, crewId: crew.id, actorUserId: cookieUserId };
    }

    // Active crew member
    const { data: membership } = await supabaseAdmin
      .from("crew_members")
      .select("role, membership_status")
      .eq("crew_id", crew.id)
      .eq("user_id", cookieUserId)
      .maybeSingle();

    if (membership?.membership_status === "active") {
      return { allowed: true, crewId: crew.id, actorUserId: cookieUserId };
    }

    return { allowed: false, error: "Недостаточно прав." };
  }

  return { allowed: false, error: "Не авторизовано." };
}

// ── Types ───────────────────────────────────────────────────────────────────
export interface CreateEquipmentRentalInput {
  slug: string;
  actorUserId: string;
  equipmentId: string;
  renterUserId?: string;
  expectedReturnDate?: string;
  dailyPrice: number;
  primaryRentalId?: string;
}

export interface ReturnEquipmentRentalInput {
  slug: string;
  actorUserId: string;
  id: string;
  condition: "returned" | "damaged" | "lost";
  conditionNotes?: string;
}

export interface EquipmentRental {
  id: string;
  equipmentId: string;
  equipmentLabel: string;
  status: string;
  dailyPrice: number;
  totalCost: number;
  startDate: string;
  expectedReturnDate: string | null;
  returnedAt: string | null;
  renterUserId: string | null;
  primaryRentalId: string | null;
}

// ── Actions ─────────────────────────────────────────────────────────────────
/**
 * Create a new equipment rental.
 * Validates equipment is type='equipment', calculates total_cost = daily_price * days.
 */
export async function createEquipmentRental(
  input: CreateEquipmentRentalInput,
): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
  const { slug, actorUserId, equipmentId, renterUserId, expectedReturnDate, dailyPrice, primaryRentalId } = input;

  if (!slug || !actorUserId || !equipmentId || dailyPrice <= 0) {
    return { success: false, error: "Некорректные входные данные." };
  }

  try {
    // Verify crew access
    const access = await verifyCrewAccess(slug);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    // Verify equipment exists and is type='equipment'
    const { data: equipment, error: equipError } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, type")
      .eq("id", equipmentId)
      .maybeSingle();

    if (equipError || !equipment) {
      return { success: false, error: "Предмет не найден." };
    }

    if (equipment.type !== "equipment") {
      return { success: false, error: "Предмет не найден среди экипировки." };
    }

    // Calculate days and total_cost
    let days = 1;
    if (expectedReturnDate) {
      const start = new Date();
      const end = new Date(expectedReturnDate);
      const diffMs = end.getTime() - start.getTime();
      days = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    }

    const totalCost = dailyPrice * days;

    // Create rental
    const { data: rental, error: insertError } = await supabaseAdmin
      .from("equipment_rentals")
      .insert({
        crew_id: access.crewId,
        equipment_id: equipmentId,
        renter_user_id: renterUserId || null,
        primary_rental_id: primaryRentalId || null,
        expected_return_date: expectedReturnDate || null,
        daily_price: dailyPrice,
        total_cost: totalCost,
        status: "active",
        issued_by: actorUserId,
        issued_at: new Date().toISOString(),
        created_by: actorUserId,
      })
      .select("id")
      .single();

    if (insertError || !rental) {
      logger.error("[createEquipmentRental] Insert failed:", insertError);
      return { success: false, error: "Не удалось создать аренду." };
    }

    logger.info("[createEquipmentRental] Created equipment rental", {
      id: rental.id,
      equipmentId,
      crewId: access.crewId,
    });

    return { success: true, data: { id: rental.id } };
  } catch (err: any) {
    logger.error("[createEquipmentRental] Exception:", err);
    return { success: false, error: err?.message || "Unknown error." };
  }
}

/**
 * Return an equipment rental.
 * Sets status, returned_at, received_by, and condition_notes.
 */
export async function returnEquipmentRental(
  input: ReturnEquipmentRentalInput,
): Promise<{ success: boolean; error?: string }> {
  const { slug, actorUserId, id, condition, conditionNotes } = input;

  if (!slug || !actorUserId || !id || !condition) {
    return { success: false, error: "Некорректные входные данные." };
  }

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    // Update rental
    const { data: rental, error: updateError } = await supabaseAdmin
      .from("equipment_rentals")
      .update({
        status: condition,
        returned_at: new Date().toISOString(),
        received_by: actorUserId,
        condition_notes: conditionNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("crew_id", access.crewId)
      .eq("status", "active")
      .select("id")
      .maybeSingle();

    if (updateError) {
      logger.error("[returnEquipmentRental] Update failed:", updateError);
      return { success: false, error: "Не удалось обновить аренду." };
    }

    if (!rental) {
      return { success: false, error: "Аренда не найдена или уже закрыта." };
    }

    logger.info("[returnEquipmentRental] Returned equipment rental", {
      id,
      condition,
      crewId: access.crewId,
    });

    return { success: true };
  } catch (err: any) {
    logger.error("[returnEquipmentRental] Exception:", err);
    return { success: false, error: err?.message || "Unknown error." };
  }
}

/**
 * List equipment rentals for a crew.
 * Optionally filter by status.
 */
export async function listEquipmentRentals(params: {
  slug: string;
  actorUserId: string;
  statusFilter?: string;
}): Promise<{
  success: boolean;
  data?: EquipmentRental[];
  error?: string;
}> {
  const { slug, actorUserId, statusFilter } = params;

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    let query = supabaseAdmin
      .from("equipment_rentals")
      .select(`
        id,
        equipment_id,
        status,
        daily_price,
        total_cost,
        start_date,
        expected_return_date,
        returned_at,
        renter_user_id,
        primary_rental_id,
        equipment:cars(id, make, model)
      `)
      .eq("crew_id", access.crewId);

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    query = query.order("created_at", { ascending: false });

    const { data: rentals, error } = await query;

    if (error) {
      logger.error("[listEquipmentRentals] Query failed:", error);
      return { success: false, error: "Не удалось загрузить список." };
    }

    const formatted = (rentals || []).map((r: any) => ({
      id: r.id,
      equipmentId: r.equipment_id,
      equipmentLabel: r.equipment ? `${r.equipment.make} ${r.equipment.model}` : r.equipment_id,
      status: r.status,
      dailyPrice: Number(r.daily_price),
      totalCost: Number(r.total_cost),
      startDate: r.start_date,
      expectedReturnDate: r.expected_return_date,
      returnedAt: r.returned_at,
      renterUserId: r.renter_user_id,
      primaryRentalId: r.primary_rental_id,
    }));

    return { success: true, data: formatted };
  } catch (err: any) {
    logger.error("[listEquipmentRentals] Exception:", err);
    return { success: false, error: err?.message || "Unknown error." };
  }
}

// ── Doc-manual integration (I5 Equipment T4) ─────────────────────────────────────

/**
 * Mapping from equipment flags in DocFlowContext to cars equipment IDs.
 * These IDs are seeded in migration 20260812000006_seed_equipment.sql.
 */
const EQUIPMENT_FLAG_TO_CAR_ID: Record<string, string> = {
  // Helmets (size preferences default to M if not specified)
  helmets: 'equip-helmet-m',
  // Gloves (size M default)
  gloves: 'equip-gloves-m',
  // Jacket (size M default)
  jacket: 'equip-jacket-m',
  // Boots (size M default)
  boots: 'equip-boots-m',
};

/**
 * DocFlowContext subset for equipment rental creation.
 */
export interface DocFlowEquipmentContext {
  helmets?: number;
  gloves?: number;
  jacket?: boolean;
  boots?: boolean;
  net?: boolean;
  backpack?: boolean;
  bag?: boolean;
  charger?: boolean;
}

/**
 * Create equipment_rentals rows for equipment rented with a bike.
 * Called from doc-manual after successful rental creation.
 *
 * Maps equipment flags (helmets, gloves, jacket, boots) to equipment_rentals rows
 * with primary_rental_id linking to the bike rental.
 *
 * @param rentalId - The bike rental ID
 * @param context - DocFlowContext with equipment flags
 * @param operatorChatId - Operator who created the rental
 * @param crewId - Crew ID for the rentals
 */
export async function createEquipmentRowsForRental(params: {
  rentalId: string;
  context: DocFlowEquipmentContext;
  operatorChatId: string;
  crewId: string;
}): Promise<{ success: boolean; created: number; error?: string }> {
  const { rentalId, context, operatorChatId, crewId } = params;

  try {
    const rowsToCreate: Array<{
      equipment_id: string;
      daily_price: number;
      total_cost: number;
    }> = [];

    // Helmets (0-2 helmets)
    const helmetCount = context.helmets || 0;
    for (let i = 0; i < helmetCount; i++) {
      rowsToCreate.push({
        equipment_id: EQUIPMENT_FLAG_TO_CAR_ID.helmets,
        daily_price: 200,
        total_cost: 200, // TODO: calculate based on rental duration
      });
    }

    // Gloves (0-2 pairs)
    const glovesCount = context.gloves || 0;
    for (let i = 0; i < glovesCount; i++) {
      rowsToCreate.push({
        equipment_id: EQUIPMENT_FLAG_TO_CAR_ID.gloves,
        daily_price: 100,
        total_cost: 100,
      });
    }

    // Jacket (1 if true)
    if (context.jacket) {
      rowsToCreate.push({
        equipment_id: EQUIPMENT_FLAG_TO_CAR_ID.jacket,
        daily_price: 300,
        total_cost: 300,
      });
    }

    // Boots (1 if true)
    if (context.boots) {
      rowsToCreate.push({
        equipment_id: EQUIPMENT_FLAG_TO_CAR_ID.boots,
        daily_price: 150,
        total_cost: 150,
      });
    }

    // Skip if no equipment
    if (rowsToCreate.length === 0) {
      return { success: true, created: 0 };
    }

    // Insert all rows in one batch
    const { data, error } = await supabaseAdmin
      .from('equipment_rentals')
      .insert(
        rowsToCreate.map((row) => ({
          crew_id: crewId,
          equipment_id: row.equipment_id,
          primary_rental_id: rentalId,
          daily_price: row.daily_price,
          total_cost: row.total_cost,
          status: 'active',
          issued_by: operatorChatId,
          issued_at: new Date().toISOString(),
          created_by: operatorChatId,
        }))
      )
      .select('id');

    if (error) {
      logger.warn('[createEquipmentRowsForRental] Failed to insert rows:', error);
      // Continue — rental is more important than equipment rows (contract over breakdown)
      return { success: false, created: 0, error: error.message };
    }

    logger.info('[createEquipmentRowsForRental] Created equipment rentals', {
      rentalId,
      crewId,
      created: data?.length || 0,
    });

    return { success: true, created: data?.length || 0 };
  } catch (err: any) {
    logger.error('[createEquipmentRowsForRental] Exception:', err);
    return { success: false, created: 0, error: err?.message || 'Unknown error' };
  }
}
