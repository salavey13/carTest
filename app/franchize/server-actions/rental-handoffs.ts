"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { z } from "zod";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RentalHandoff {
  id: string;
  rental_id: string;
  phase: "handout" | "return";

  // Boolean checklist items
  passport_checked?: boolean;
  license_checked?: boolean;
  deposit_collected?: boolean;
  helmet_issued?: boolean;
  keys_issued?: boolean;
  instructions_given?: boolean;
  photos_taken?: boolean;
  condition_checked?: boolean;
  helmet_returned?: boolean;
  keys_returned?: boolean;
  deposit_returned?: boolean;
  no_damages_confirmed?: boolean;

  // Numeric fields
  odometer_start?: number | null;
  odometer_end?: number | null;
  fuel_level_start?: number | null;
  fuel_level_end?: number | null;
  battery_level_start?: number | null;
  battery_level_end?: number | null;

  // Text notes
  damage_notes?: string | null;
  handout_notes?: string | null;
  return_notes?: string | null;

  // Equipment / completeness fields
  keys_count?: number | null;
  charger_included?: boolean | null;
  lock_cable_included?: boolean | null;
  jacket_issued?: boolean | null;
  second_helmet_issued?: boolean | null;
  bag_issued?: boolean | null;
  net_issued?: boolean | null;
  camera_mount_issued?: boolean | null;
  moto_cover_issued?: boolean | null;
  ebike_charger_issued?: boolean | null;
  other_equipment?: string | null;
  equipment_condition_return?: string | null;

  // Tracking
  completed_at?: string | null;
  completed_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RentalHandoffSummary {
  handout: RentalHandoff | null;
  return: RentalHandoff | null;
}

// ─── Server Actions ─────────────────────────────────────────────────────────────

/**
 * Get handoff summary for a specific rental (both handout and return phases).
 */
export async function getRentalHandoff(input: {
  actorUserId: string;
  rentalId: string;
  isPasswordAuth?: boolean;
}): Promise<{ success: boolean; data?: RentalHandoffSummary | null; error?: string }> {
  try {
    const parsed = z.object({
      actorUserId: z.string().trim().min(1),
      rentalId: z.string().uuid(),
      isPasswordAuth: z.boolean().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { actorUserId, rentalId, isPasswordAuth = false } = parsed.data;

    // Verify access to this rental
    const { data: rental } = await supabaseAdmin
      .from("rentals")
      .select("vehicle:cars!inner(crew_id)")
      .eq("rental_id", rentalId)
      .maybeSingle();

    if (!rental) {
      return { success: false, error: "Аренда не найдена." };
    }

    const rentalVehicle = rental.vehicle as { crew_id: string } | null;
    if (!rentalVehicle) {
      return { success: false, error: "Техника не найдена." };
    }

    // Check crew ownership
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("owner_id")
      .eq("id", rentalVehicle.crew_id)
      .maybeSingle();

    const isCrewOwner = crew?.owner_id === actorUserId;

    if (!isPasswordAuth && !isCrewOwner) {
      // Check admin status
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("metadata")
        .eq("user_id", actorUserId)
        .maybeSingle();

      const userMetadata = user?.metadata as Record<string, unknown> | null;
      const isAdmin = userMetadata?.role === "admin";

      if (!isAdmin) {
        return { success: false, error: "Недостаточно прав для просмотра." };
      }
    }

    // Get both handout and return
    const { data: handoffs } = await supabaseAdmin
      .from("rental_handoffs")
      .select("*")
      .eq("rental_id", rentalId)
      .in("phase", ["handout", "return"]);

    const handout = handoffs?.find(h => h.phase === "handout") as RentalHandoff | null || null;
    const returnData = handoffs?.find(h => h.phase === "return") as RentalHandoff | null || null;

    return {
      success: true,
      data: { handout, return: returnData },
    };
  } catch (error) {
    console.error("[get-rental-handoff] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Save or update a handoff phase (handout or return).
 * Creates new record if doesn't exist, updates if it does.
 */
export async function saveRentalHandoff(input: {
  actorUserId: string;
  rentalId: string;
  phase: "handout" | "return";
  data: Partial<Omit<RentalHandoff, "id" | "rental_id" | "phase" | "created_at" | "updated_at">>;
  isPasswordAuth?: boolean;
}): Promise<{ success: boolean; data?: RentalHandoff; error?: string }> {
  try {
    const parsed = z.object({
      actorUserId: z.string().trim().min(1),
      rentalId: z.string().uuid(),
      phase: z.enum(["handout", "return"]),
      data: z.object({
        passport_checked: z.boolean().optional(),
        license_checked: z.boolean().optional(),
        deposit_collected: z.boolean().optional(),
        helmet_issued: z.boolean().optional(),
        keys_issued: z.boolean().optional(),
        instructions_given: z.boolean().optional(),
        photos_taken: z.boolean().optional(),
        condition_checked: z.boolean().optional(),
        helmet_returned: z.boolean().optional(),
        keys_returned: z.boolean().optional(),
        deposit_returned: z.boolean().optional(),
        no_damages_confirmed: z.boolean().optional(),
        odometer_start: z.number().int().positive().nullable().optional(),
        odometer_end: z.number().int().positive().nullable().optional(),
        fuel_level_start: z.number().int().min(0).max(100).nullable().optional(),
        fuel_level_end: z.number().int().min(0).max(100).nullable().optional(),
        battery_level_start: z.number().int().min(0).max(100).nullable().optional(),
        battery_level_end: z.number().int().min(0).max(100).nullable().optional(),
        damage_notes: z.string().nullable().optional(),
        handout_notes: z.string().nullable().optional(),
        return_notes: z.string().nullable().optional(),
        keys_count: z.number().int().min(0).nullable().optional(),
        charger_included: z.boolean().optional(),
        lock_cable_included: z.boolean().optional(),
        jacket_issued: z.boolean().optional(),
        second_helmet_issued: z.boolean().optional(),
        bag_issued: z.boolean().optional(),
        net_issued: z.boolean().optional(),
        camera_mount_issued: z.boolean().optional(),
        moto_cover_issued: z.boolean().optional(),
        ebike_charger_issued: z.boolean().optional(),
        other_equipment: z.string().nullable().optional(),
        equipment_condition_return: z.string().nullable().optional(),
      }),
      isPasswordAuth: z.boolean().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { actorUserId, rentalId, phase, data, isPasswordAuth = false } = parsed.data;

    // Verify access
    const { data: rental } = await supabaseAdmin
      .from("rentals")
      .select("vehicle:cars!inner(crew_id)")
      .eq("rental_id", rentalId)
      .maybeSingle();

    if (!rental) {
      return { success: false, error: "Аренда не найдена." };
    }

    const rentalVehicle = rental.vehicle as { crew_id: string } | null;
    if (!rentalVehicle) {
      return { success: false, error: "Техника не найдена." };
    }

    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("owner_id")
      .eq("id", rentalVehicle.crew_id)
      .maybeSingle();

    const isCrewOwner = crew?.owner_id === actorUserId;

    if (!isPasswordAuth && !isCrewOwner) {
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("metadata")
        .eq("user_id", actorUserId)
        .maybeSingle();

      const userMetadata = user?.metadata as Record<string, unknown> | null;
      const isAdmin = userMetadata?.role === "admin";

      if (!isAdmin) {
        return { success: false, error: "Недостаточно прав для сохранения." };
      }
    }

    // Prepare upsert data
    const now = new Date().toISOString();
    const upsertData = {
      rental_id: rentalId,
      phase,
      ...data,
      // If all required checkboxes are checked, mark as completed
      completed_at: isPhaseComplete(phase, data) ? now : null,
      completed_by: isPhaseComplete(phase, data) ? actorUserId : null,
      updated_at: now,
    };

    // Upsert handoff
    const { data: result, error } = await supabaseAdmin
      .from("rental_handoffs")
      .upsert(upsertData, { onConflict: "rental_id,phase" })
      .select("*")
      .single();

    if (error) {
      console.error("[save-rental-handoff] Upsert error:", error);
      return { success: false, error: error.message };
    }

    // Update rental.metadata with odometer readings for analytics display
    if (data.odometer_start || data.odometer_end) {
      const { data: existingRental } = await supabaseAdmin
        .from("rentals")
        .select("metadata")
        .eq("rental_id", rentalId)
        .maybeSingle();

      const existingMetadata = (existingRental?.metadata as Record<string, unknown>) || {};
      await supabaseAdmin
        .from("rentals")
        .update({
          metadata: {
            ...existingMetadata,
            odometer_start: data.odometer_start || existingMetadata.odometer_start,
            odometer_end: data.odometer_end || existingMetadata.odometer_end,
            handoff_updated_at: now,
          },
        })
        .eq("rental_id", rentalId);
    }

    if (error) {
      console.error("[save-rental-handoff] Upsert error:", error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: result as RentalHandoff,
    };
  } catch (error) {
    console.error("[save-rental-handoff] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Delete a handoff record (e.g., to restart the process).
 */
export async function deleteRentalHandoff(input: {
  actorUserId: string;
  rentalId: string;
  phase: "handout" | "return";
  isPasswordAuth?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = z.object({
      actorUserId: z.string().trim().min(1),
      rentalId: z.string().uuid(),
      phase: z.enum(["handout", "return"]),
      isPasswordAuth: z.boolean().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { actorUserId, rentalId, phase, isPasswordAuth = false } = parsed.data;

    // Verify access
    const { data: rental } = await supabaseAdmin
      .from("rentals")
      .select("vehicle:cars!inner(crew_id)")
      .eq("rental_id", rentalId)
      .maybeSingle();

    if (!rental) {
      return { success: false, error: "Аренда не найдена." };
    }

    const rentalVehicle = rental.vehicle as { crew_id: string } | null;
    if (!rentalVehicle) {
      return { success: false, error: "Техника не найдена." };
    }

    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("owner_id")
      .eq("id", rentalVehicle.crew_id)
      .maybeSingle();

    const isCrewOwner = crew?.owner_id === actorUserId;

    if (!isPasswordAuth && !isCrewOwner) {
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("metadata")
        .eq("user_id", actorUserId)
        .maybeSingle();

      const userMetadata = user?.metadata as Record<string, unknown> | null;
      const isAdmin = userMetadata?.role === "admin";

      if (!isAdmin) {
        return { success: false, error: "Недостаточно прав для удаления." };
      }
    }

    const { error } = await supabaseAdmin
      .from("rental_handoffs")
      .delete()
      .eq("rental_id", rentalId)
      .eq("phase", phase);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("[delete-rental-handoff] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Check if a handoff phase is complete (all required items checked).
 * Handout requires: passport, license, deposit, helmet, keys, odometer_start
 * Return requires: condition, helmet_returned, keys_returned, odometer_end
 */
function isPhaseComplete(
  phase: "handout" | "return",
  data: Partial<Omit<RentalHandoff, "id" | "rental_id" | "phase" | "created_at" | "updated_at">>
): boolean {
  if (phase === "handout") {
    return !!(
      data.passport_checked &&
      data.license_checked &&
      data.deposit_collected &&
      data.helmet_issued &&
      data.keys_issued &&
      data.odometer_start !== null &&
      data.odometer_start !== undefined
    );
  } else {
    // Return phase
    return !!(
      data.condition_checked &&
      data.helmet_returned &&
      data.keys_returned &&
      data.odometer_end !== null &&
      data.odometer_end !== undefined
    );
  }
}
