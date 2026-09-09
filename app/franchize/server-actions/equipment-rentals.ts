// app/franchize/server-actions/equipment-rentals.ts
"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { resolveCrewOwnerChatId } from "@/lib/rental-date-utils";
import {
  verifyCrewAccess,
  handleError,
  successResponse,
  errorResponse,
  type ActionResponse,
  type CrewAccessResult,
} from "./shared/auth-helpers";
import {
  itemDailyPrice,
  conditionToUnifiedStatus,
  conditionToEquipmentCondition,
  unifiedToLegacyStatus,
  pickCrewEquipmentByCategory,
  EQUIPMENT_FLAG_TO_CATEGORY,
  type EquipmentCatalogItem,
} from "@/app/franchize/lib/equipment-shared";

/**
 * I5 — Equipment rentals server actions (2026-09-10 UNIFIED STORAGE).
 *
 * Equipment = cars rows with type='equipment' (helmets, jackets, gloves, etc.).
 * Since migration 20260815000001 (+ 20260910120000) equipment rentals live in
 * the SAME `rentals` table as bike rentals, marked with
 * `metadata.item_type='equipment'` — one pipeline, one money ledger, one
 * analytics surface. The legacy `equipment_rentals` table is a read-only
 * archive; this module no longer writes to it.
 *
 * Metadata vocabulary (keep in sync with bot /ekip + web checkout):
 *   item_type: 'equipment' | 'bike'
 *   crew_id, daily_price, equipment_size, equipment_condition, damage_reports[]
 *   primary_rental_id (equipment issued together with a bike rental)
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
 * Create a new equipment rental (unified `rentals` row).
 *
 * Validates that the equipment exists and has type='equipment', then creates
 * a rental record with metadata.item_type='equipment'. Total cost is
 * automatically calculated based on the daily price and rental duration.
 *
 * @example
 * ```ts
 * const result = await createEquipmentRental({
 *   slug: "my-crew",
 *   actorUserId: "user-123",
 *   equipmentId: "equip-helmet-street-pro-vip-bike",
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
      .select("id, make, model, type, daily_price, specs")
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

    // Owner placeholder (same approach as bot /doc and /ekip flows)
    const ownerChatId = await resolveCrewOwnerChatId(supabaseAdmin, access.crewId) || actorUserId;

    const startIso = new Date().toISOString();
    const endIso = expectedReturnDate
      ? new Date(expectedReturnDate).toISOString()
      : null;

    // Create unified rental row
    const { data: rental, error: insertError } = await supabaseAdmin
      .from("rentals")
      .insert({
        user_id: renterUserId || ownerChatId,
        owner_id: ownerChatId,
        created_by_operator_chat_id: actorUserId,
        crew_id: access.crewId,
        vehicle_id: equipmentId,
        requested_start_date: startIso,
        requested_end_date: endIso,
        agreed_start_date: startIso,
        agreed_end_date: endIso,
        status: "active",
        payment_status: "fully_paid",
        total_cost: totalCost,
        metadata: {
          source: "web_equipment_client",
          item_type: "equipment",
          crew_id: access.crewId,
          daily_price: dailyPrice,
          equipment_title: `${equipment.make} ${equipment.model}`,
          equipment_condition: "Выдан",
          damage_reports: [],
          primary_rental_id: primaryRentalId || null,
          issued_by: actorUserId,
          issued_at: startIso,
        },
      })
      .select("rental_id")
      .maybeSingle();

    if (insertError || !rental) {
      logger.error("[createEquipmentRental] Insert failed:", insertError);
      return { success: false, error: "Не удалось создать аренду." };
    }

    logger.info("[createEquipmentRental] Created unified equipment rental", {
      id: rental.rental_id,
      equipmentId,
      crewId: access.crewId,
    });

    return { success: true, data: { id: rental.rental_id } };
  } catch (err) {
    logger.error("[createEquipmentRental] Exception:", err);
    return errorResponse(handleError(err, "createEquipmentRental"));
  }
}

/**
 * Return an equipment rental.
 * Maps the legacy condition vocabulary onto the unified rentals pipeline:
 *   returned → completed, damaged/lost → disputed
 * and records the return in metadata (equipment_condition + damage_reports).
 * The money trigger (auto_create_rental_transaction) writes income_equipment
 * on this transition — idempotently.
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

    // Read the current row so metadata can be patched (not replaced)
    const { data: current, error: readError } = await supabaseAdmin
      .from("rentals")
      .select("rental_id, metadata, status")
      .eq("rental_id", id)
      .eq("crew_id", access.crewId)
      .eq("metadata->>item_type", "equipment")
      .maybeSingle();

    if (readError) {
      logger.error("[returnEquipmentRental] Read failed:", readError);
      return { success: false, error: "Не удалось обновить аренду." };
    }

    if (!current) {
      return { success: false, error: "Аренда не найдена или уже закрыта." };
    }

    if (current.status === "completed" || current.status === "disputed") {
      return { success: false, error: "Аренда не найдена или уже закрыта." };
    }

    const meta = (current.metadata || {}) as Record<string, unknown>;
    const damageReports = Array.isArray(meta.damage_reports) ? meta.damage_reports : [];
    const nextMetadata = {
      ...meta,
      equipment_condition: conditionToEquipmentCondition(condition),
      received_by: actorUserId,
      returned_at: new Date().toISOString(),
      damage_reports: conditionNotes
        ? [...damageReports, {
            phase: "return",
            severity: condition === "returned" ? "minor" : "major",
            notes: conditionNotes,
            created_at: new Date().toISOString(),
            created_by: actorUserId,
          }]
        : damageReports,
    };

    const { error: updateError } = await supabaseAdmin
      .from("rentals")
      .update({
        status: conditionToUnifiedStatus(condition),
        agreed_end_date: new Date().toISOString(),
        metadata: nextMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("rental_id", id)
      .eq("crew_id", access.crewId);

    if (updateError) {
      logger.error("[returnEquipmentRental] Update failed:", updateError);
      return { success: false, error: "Не удалось обновить аренду." };
    }

    // Close the linked return todo (same crew_todos the issuing flow created)
    try {
      await supabaseAdmin
        .from("crew_todos")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("rental_id", id)
        .eq("status", "pending");
    } catch (todoErr) {
      logger.warn("[returnEquipmentRental] Failed to close return todos (non-fatal):", todoErr);
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
 * List equipment rentals for a crew (unified `rentals` rows).
 * Optionally filter by legacy status; returned in the legacy API shape.
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
      .from("rentals")
      .select(`
        rental_id,
        vehicle_id,
        status,
        total_cost,
        requested_start_date,
        agreed_start_date,
        agreed_end_date,
        updated_at,
        metadata,
        user_id,
        equipment:cars(id, make, model)
      `)
      .eq("crew_id", access.crewId)
      .eq("metadata->>item_type", "equipment");

    // Legacy status filter → unified statuses
    if (statusFilter === "active") {
      query = query.in("status", ["pending_confirmation", "confirmed", "active"]);
    } else if (statusFilter === "returned") {
      query = query.eq("status", "completed");
    } else if (statusFilter === "damaged" || statusFilter === "lost") {
      query = query.eq("status", "disputed");
    }

    query = query.order("created_at", { ascending: false }).limit(200);

    const { data: rentals, error } = await query;

    if (error) {
      logger.error("[listEquipmentRentals] Query failed:", error);
      return { success: false, error: "Не удалось загрузить список." };
    }

    const formatted = (rentals || []).map((r: any) => {
      const meta = (r.metadata || {}) as Record<string, any>;
      return {
        id: r.rental_id,
        equipmentId: r.vehicle_id,
        equipmentLabel: r.equipment ? `${r.equipment.make} ${r.equipment.model}` : (meta.equipment_title || r.vehicle_id),
        status: unifiedToLegacyStatus(r.status, meta.equipment_condition),
        dailyPrice: Number(meta.daily_price ?? r.total_cost ?? 0),
        totalCost: Number(r.total_cost ?? 0),
        startDate: meta.issued_at || r.requested_start_date || r.agreed_start_date,
        expectedReturnDate: r.requested_end_date,
        returnedAt: meta.returned_at || (r.status === "completed" ? r.updated_at : null),
        renterUserId: r.user_id,
        primaryRentalId: meta.primary_rental_id || null,
      };
    });

    return { success: true, data: formatted };
  } catch (err) {
    logger.error("[listEquipmentRentals] Exception:", err);
    return errorResponse(handleError(err, "listEquipmentRentals"));
  }
}

/**
 * Get equipment catalog for a crew.
 * Returns all cars rows with type='equipment' with rich specs.
 */
export async function getEquipmentCatalog(params: {
  slug: string;
  actorUserId?: string;
}): Promise<ActionResponse<EquipmentItem[]>> {
  const { slug } = params;

  try {
    // Equipment catalog is publicly viewable — no crew membership gate.
    // Look up crew_id from slug to filter equipment owned by this crew.
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id")
      .eq("slug", slug)
      .single();

    if (!crew) {
      return { success: false, error: "Экипаж не найден." };
    }

    const { data: equipment, error } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, description, daily_price, type, specs")
      .eq("type", "equipment")
      .eq("crew_id", crew.id)
      .order("make", { ascending: true });

    if (error) {
      logger.error("[getEquipmentCatalog] Query failed:", error);
      return { success: false, error: "Не удалось загрузить каталог." };
    }

    const formatted = (equipment || []).map((e: any) => ({
      id: e.id,
      make: e.make,
      model: e.model,
      description: e.description || null,
      daily_price: Number(e.daily_price || 0),
      type: e.type,
      specs: e.specs || {},
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
  description: string | null;
  daily_price: number;
  type: string;
  specs: Record<string, unknown>;
}

// ── Doc-manual integration (I5 Equipment T4) ─────────────────────────────────────

/**
 * DocFlowContext subset for equipment rental creation.
 */
export interface DocFlowEquipmentContext {
  helmets?: number;
  gloves?: number;
  jacket?: boolean;
  pants?: boolean;
  boots?: boolean;
  net?: boolean;
  backpack?: boolean;
  bag?: boolean;
  charger?: boolean;
}

/**
 * Create equipment rental rows for equipment issued together with a bike
 * rental (called from doc-manual after successful rental creation).
 *
 * 2026-09-10 FIXES vs the legacy implementation:
 *  • Resolves REAL per-crew catalog ids by specs.category — the old
 *    EQUIPMENT_FLAG_TO_CAR_ID map used slug-less seed ids
 *    (`equip-helmet-street-pro`) plus a non-existent boots id, so every
 *    insert failed the FK and equipment rows were silently skipped.
 *  • Prices come from cars.daily_price (seed: helmet 1000₽, rest 500₽),
 *    not hardcoded 200/300₽ constants.
 *  • Writes unified `rentals` rows (metadata.item_type='equipment',
 *    primary_rental_id link) instead of the archived equipment_rentals
 *    table, with total_cost = daily_price × rental days.
 */
export async function createEquipmentRowsForRental(params: {
  rentalId: string;
  context: DocFlowEquipmentContext;
  operatorChatId: string;
  crewId: string;
}): Promise<ActionResponse<{ created: number }>> {
  const { rentalId, context, operatorChatId, crewId } = params;

  try {
    // Read the primary (bike) rental for dates + owner placeholder
    const { data: primary, error: primaryError } = await supabaseAdmin
      .from("rentals")
      .select("rental_id, agreed_start_date, agreed_end_date, requested_start_date, requested_end_date, user_id, owner_id, created_by_operator_chat_id")
      .eq("rental_id", rentalId)
      .maybeSingle();

    if (primaryError || !primary) {
      logger.warn("[createEquipmentRowsForRental] Primary rental not found:", primaryError?.message);
      return errorResponse("primary rental not found");
    }

    // Resolve the crew's equipment catalog (REAL ids, REAL prices)
    const { data: catalog, error: catalogError } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, daily_price, specs")
      .eq("type", "equipment")
      .eq("crew_id", crewId);

    if (catalogError) {
      logger.warn("[createEquipmentRowsForRental] Catalog query failed:", catalogError.message);
      return errorResponse(catalogError.message);
    }

    const crewCatalog = (catalog || []) as unknown as EquipmentCatalogItem[];
    if (crewCatalog.length === 0) {
      logger.info("[createEquipmentRowsForRental] Crew has no equipment catalog — skipping", { crewId });
      return successResponse({ created: 0 });
    }

    // Build the (item, quantity) plan from the doc flags
    const plan: Array<{ item: EquipmentCatalogItem; qty: number }> = [];
    for (const [flag, category] of Object.entries(EQUIPMENT_FLAG_TO_CATEGORY)) {
      const raw = (context as Record<string, unknown>)[flag];
      const qty = typeof raw === "number" ? raw : raw === true ? 1 : 0;
      if (qty <= 0) continue;
      const item = pickCrewEquipmentByCategory(crewCatalog, category);
      if (!item) {
        logger.warn(`[createEquipmentRowsForRental] No crew equipment for category "${category}" — flag ${flag} skipped`, { crewId });
        continue;
      }
      plan.push({ item, qty });
    }

    if (plan.length === 0) {
      return successResponse({ created: 0 });
    }

    // Rental days from the primary rental dates (fallback 1)
    const startRaw = primary.agreed_start_date || primary.requested_start_date;
    const endRaw = primary.agreed_end_date || primary.requested_end_date;
    let days = 1;
    if (startRaw && endRaw) {
      try {
        const diffMs = new Date(endRaw).getTime() - new Date(startRaw).getTime();
        days = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
      } catch {
        days = 1;
      }
    }

    const ownerChatId = primary.created_by_operator_chat_id || primary.owner_id || primary.user_id || operatorChatId;
    const startIso = startRaw || new Date().toISOString();
    const endIso = endRaw || null;

    const rowsToInsert = plan.flatMap(({ item, qty }) =>
      Array.from({ length: qty }, () => {
        const daily = itemDailyPrice(item);
        return {
          user_id: ownerChatId,
          owner_id: ownerChatId,
          created_by_operator_chat_id: operatorChatId,
          crew_id: crewId,
          vehicle_id: item.id,
          requested_start_date: startIso,
          requested_end_date: endIso,
          agreed_start_date: startIso,
          agreed_end_date: endIso,
          status: "active",
          payment_status: "fully_paid",
          total_cost: daily * days,
          metadata: {
            source: "doc_command",
            item_type: "equipment",
            crew_id: crewId,
            daily_price: daily,
            equipment_title: `${item.make} ${item.model}`,
            equipment_size: (item.specs?.size as string) || (Array.isArray(item.specs?.sizes) ? String((item.specs!.sizes as string[])[0]) : null) || null,
            equipment_condition: "Выдан",
            damage_reports: [],
            primary_rental_id: rentalId,
            issued_by: operatorChatId,
            issued_at: new Date().toISOString(),
          },
        };
      }),
    );

    const { data, error } = await supabaseAdmin
      .from("rentals")
      .insert(rowsToInsert)
      .select("rental_id");

    if (error) {
      logger.warn("[createEquipmentRowsForRental] Failed to insert rows:", error);
      // Continue — rental is more important than equipment rows (contract over breakdown)
      return errorResponse(error.message);
    }

    logger.info("[createEquipmentRowsForRental] Created unified equipment rentals", {
      rentalId,
      crewId,
      created: data?.length || 0,
    });

    return successResponse({ created: data?.length || 0 });
  } catch (err) {
    logger.error("[createEquipmentRowsForRental] Exception:", err);
    return errorResponse(handleError(err, "createEquipmentRowsForRental"));
  }
}
