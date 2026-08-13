// app/franchize/server-actions/equipment-rentals.ts
"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import {
  verifyCrewAccess,
  handleError,
  successResponse,
  errorResponse,
  type ActionResponse,
  type CrewAccessResult,
} from "./shared/auth-helpers";

/**
 * I5 — Equipment rentals server actions.
 * Plan: docs/superpowers/plans/2026-08-12-i5-equipment-rentals.md (Task 2)
 * Contract: PLAN-I5-SERVICE-OPERATIONS.md п.6 (server actions pattern)
 *
 * Equipment = cars rows with type='equipment' (helmets, jackets, gloves, etc.)
 * Rentals stored in equipment_rentals table, optionally linked to bike rental via
 * primary_rental_id (NULL = standalone rental).
 */

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
 *
 * Validates that the equipment exists and has type='equipment', then creates a rental record.
 * Total cost is automatically calculated based on the daily price and rental duration.
 *
 * @param input - Rental parameters including equipment ID, pricing, and dates
 * @returns Success with rental ID, or error with message
 *
 * @example
 * ```ts
 * const result = await createEquipmentRental({
 *   slug: "my-crew",
 *   actorUserId: "user-123",
 *   equipmentId: "equip-helmet-m",
 *   dailyPrice: 200,
 *   expectedReturnDate: "2026-08-15"
 * });
 * ```
 */
export async function createEquipmentRental(
  input: CreateEquipmentRentalInput,
): Promise<ActionResponse<{ id: string }>> {
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
  } catch (err) {
    logger.error("[createEquipmentRental] Exception:", err);
    return errorResponse(handleError(err, "createEquipmentRental"));
  }
}

/**
 * Return an equipment rental.
 * Sets status, returned_at, received_by, and condition_notes.
 */
export async function returnEquipmentRental(
  input: ReturnEquipmentRentalInput,
): Promise<ActionResponse> {
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
  } catch (err) {
    logger.error("[returnEquipmentRental] Exception:", err);
    return errorResponse(handleError(err, "returnEquipmentRental"));
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
}): Promise<ActionResponse<EquipmentRental[]>> {
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
  } catch (err) {
    logger.error("[listEquipmentRentals] Exception:", err);
    return errorResponse(handleError(err, "listEquipmentRentals"));
  }
}

/**
 * Get equipment catalog for a crew.
 * Returns all cars rows with type='equipment'.
 */
export async function getEquipmentCatalog(params: {
  slug: string;
  actorUserId: string;
}): Promise<ActionResponse<EquipmentItem[]>> {
  const { slug, actorUserId } = params;

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    const { data: equipment, error } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, daily_price, type")
      .eq("type", "equipment")
      .order("make", { ascending: true });

    if (error) {
      logger.error("[getEquipmentCatalog] Query failed:", error);
      return { success: false, error: "Не удалось загрузить каталог." };
    }

    const formatted = (equipment || []).map((e: any) => ({
      id: e.id,
      make: e.make,
      model: e.model,
      daily_price: Number(e.daily_price || 0),
      type: e.type,
    }));

    return { success: true, data: formatted };
  } catch (err) {
    logger.error("[getEquipmentCatalog] Exception:", err);
    return errorResponse(handleError(err, "getEquipmentCatalog"));
  }
}

export interface EquipmentItem {
  id: string;
  make: string;
  model: string;
  daily_price: number;
  type: string;
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
}): Promise<ActionResponse<{ created: number }>> {
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
      return successResponse({ created: 0 });
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
      return errorResponse(error.message);
    }

    logger.info('[createEquipmentRowsForRental] Created equipment rentals', {
      rentalId,
      crewId,
      created: data?.length || 0,
    });

    return successResponse({ created: data?.length || 0 });
  } catch (err) {
    logger.error('[createEquipmentRowsForRental] Exception:', err);
    return errorResponse(handleError(err, 'createEquipmentRowsForRental'));
  }
}
