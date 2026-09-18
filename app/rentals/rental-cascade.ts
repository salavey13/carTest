// /app/rentals/rental-cascade.ts
// ─────────────────────────────────────────────────────────────────────────────
// Cascade helpers for unified rentals lifecycle (2026-09-19).
//
// Equipment rentals (metadata.item_type='equipment') that are issued together
// with a bike rental are linked to it via metadata.primary_rental_id
// (see createEquipmentRowsForRental in server-actions/equipment-rentals.ts).
// Until now closing the bike rental left those gear rows "active" forever —
// they showed up as separate open rentals in the operator's lists.
//
// Two flows fix that:
//   1. closeLinkedEquipmentRentals() — called when a BIKE rental is closed
//      (confirmVehicleReturn, updateRentalStatus → completed). Auto-closes
//      every active gear row linked to it, marking them auto-closed.
//   2. supersedeRentalForExtension() — called after extendRental created the
//      new "prolonged" rental. Closes the ORIGINAL rental with a
//      "superseded by new rental" comment (the bug: the original stayed
//      active alongside the extension) and RE-LINKS still-open gear rows to
//      the new rental so they follow the continuing trip.
//
// Money safety: linked gear rows are inventory mirrors with total_cost = 0
// (2026-09-13 double-count fix), and auto_create_rental_transaction has a
// `total_cost > 0` guard — auto-closing them does NOT create income rows.
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

/** Rental statuses that mean "the trip is still going" for gear mirrors. */
const OPEN_RENTAL_STATUSES = ["pending_confirmation", "confirmed", "active"];

export interface CascadeCloseResult {
  closed: number;
  rentalIds: string[];
  error?: string;
}

/**
 * Auto-close every open equipment rental linked to `primaryRentalId`
 * (metadata.primary_rental_id = primaryRentalId, item_type = 'equipment').
 * Best-effort: logs and returns an error string instead of throwing, so the
 * caller's main flow (rental closure) is never broken by the cascade.
 */
export async function closeLinkedEquipmentRentals(
  primaryRentalId: string,
  closedBy: string,
  opts?: { reason?: string },
): Promise<CascadeCloseResult> {
  const empty: CascadeCloseResult = { closed: 0, rentalIds: [] };
  if (!primaryRentalId) return empty;

  try {
    const { data: linked, error } = await supabaseAdmin
      .from("rentals")
      .select("rental_id, metadata, status")
      .eq("metadata->>primary_rental_id", primaryRentalId)
      .eq("metadata->>item_type", "equipment")
      .in("status", OPEN_RENTAL_STATUSES);

    if (error) {
      logger.error("[rental-cascade] Failed to fetch linked equipment rentals:", error);
      return { ...empty, error: error.message };
    }
    if (!linked || linked.length === 0) return empty;

    const nowIso = new Date().toISOString();
    const closedIds: string[] = [];

    for (const row of linked) {
      // Patch metadata (not replace): keep size/condition/damage history.
      const meta = (row.metadata || {}) as Record<string, unknown>;
      const nextMetadata = {
        ...meta,
        // Mirror returnEquipmentRental's "returned" vocabulary; keep an
        // explicit condition if the gear was already processed.
        equipment_condition:
          typeof meta.equipment_condition === "string" && meta.equipment_condition
            ? meta.equipment_condition
            : "Норм",
        returned_at: meta.returned_at || nowIso,
        received_by: closedBy,
        auto_closed: {
          at: nowIso,
          by: closedBy,
          reason: opts?.reason || "primary_rental_closed",
          primary_rental_id: primaryRentalId,
        },
      };

      const { error: updErr } = await supabaseAdmin
        .from("rentals")
        .update({
          status: "completed",
          agreed_end_date: nowIso,
          metadata: nextMetadata,
          updated_at: nowIso,
        })
        .eq("rental_id", row.rental_id);

      if (updErr) {
        logger.error(`[rental-cascade] Failed to auto-close equipment rental ${row.rental_id}:`, updErr);
        continue;
      }
      closedIds.push(row.rental_id);
    }

    // Close pending return todos for the auto-closed gear rows
    // (same cleanup returnEquipmentRental does for manually returned gear).
    if (closedIds.length > 0) {
      try {
        await supabaseAdmin
          .from("crew_todos")
          .update({ status: "done", completed_at: new Date().toISOString() })
          .in("rental_id", closedIds)
          .eq("status", "pending");
      } catch (todoErr) {
        logger.warn("[rental-cascade] Failed to close return todos (non-fatal):", todoErr);
      }
    }

    logger.info("[rental-cascade] Auto-closed linked equipment rentals", {
      primaryRentalId,
      closed: closedIds.length,
      ids: closedIds,
    });
    return { closed: closedIds.length, rentalIds: closedIds };
  } catch (err) {
    logger.error("[rental-cascade] closeLinkedEquipmentRentals exception:", err);
    return { ...empty, error: err instanceof Error ? err.message : "unknown" };
  }
}

export interface SupersedeResult {
  ok: boolean;
  closedOriginal: boolean;
  relinkedEquipment: number;
  error?: string;
}

/**
 * After extendRental successfully created the "prolonged" rental:
 *   1. Close the ORIGINAL rental — status 'completed' + metadata
 *      superseded_by/superseded_reason + a history entry so the operator
 *      sees WHY it closed by itself. payment_status and agreed dates are
 *      preserved (the original period really happened; its money trigger
 *      fires correctly on this completion).
 *   2. Re-link open equipment rows (primary_rental_id) from the original to
 *      the new rental — the trip continues, the gear must close when the
 *      EXTENSION closes, not when the superseded rental does.
 * Best-effort: if the close fails the extension still works (old behavior).
 */
export async function supersedeRentalForExtension(params: {
  originalRentalId: string;
  newRentalId: string;
  closedBy: string;
}): Promise<SupersedeResult> {
  const { originalRentalId, newRentalId, closedBy } = params;
  const failed: SupersedeResult = {
    ok: false,
    closedOriginal: false,
    relinkedEquipment: 0,
  };

  try {
    const { data: original, error } = await supabaseAdmin
      .from("rentals")
      .select("rental_id, status, metadata")
      .eq("rental_id", originalRentalId)
      .maybeSingle();

    if (error || !original) {
      logger.error("[rental-cascade] Supersede: original rental not found:", error);
      return { ...failed, error: error?.message || "original not found" };
    }

    const nowIso = new Date().toISOString();
    const meta = (original.metadata || {}) as Record<string, unknown>;
    const history = (Array.isArray(meta.history) ? meta.history : []) as Array<{
      status: string;
      at: string;
      by?: string;
      message?: string;
    }>;

    const wasActive = original.status === "active";
    const nextMetadata = {
      ...meta,
      superseded_by: newRentalId,
      superseded_at: nowIso,
      superseded_by_actor: closedBy,
      superseded_reason: "prolonged",
      history: [
        ...history,
        {
          status: "completed",
          at: nowIso,
          by: closedBy,
          message: `Аренда продлена — закрыта автоматически, продолжается в новой аренде ${newRentalId.slice(0, 8)}`,
        },
      ],
    };

    // Only an active rental actually changes status; an already-completed
    // one just gets the supersede markers for the audit trail.
    const updatePayload: Record<string, unknown> = {
      metadata: nextMetadata,
      updated_at: nowIso,
    };
    if (wasActive) updatePayload.status = "completed";

    const { error: updErr } = await supabaseAdmin
      .from("rentals")
      .update(updatePayload)
      .eq("rental_id", originalRentalId);

    if (updErr) {
      logger.error("[rental-cascade] Supersede: failed to close original rental:", updErr);
      return { ...failed, error: updErr.message };
    }

    // Re-link open equipment rows to the new (prolonged) rental.
    let relinked = 0;
    try {
      const { data: linked, error: linkErr } = await supabaseAdmin
        .from("rentals")
        .select("rental_id, metadata")
        .eq("metadata->>primary_rental_id", originalRentalId)
        .eq("metadata->>item_type", "equipment")
        .in("status", OPEN_RENTAL_STATUSES);

      if (linkErr) {
        logger.warn("[rental-cascade] Supersede: equipment re-link lookup failed:", linkErr);
      } else {
        for (const row of linked ?? []) {
          const rowMeta = (row.metadata || {}) as Record<string, unknown>;
          const { error: relinkErr } = await supabaseAdmin
            .from("rentals")
            .update({
              metadata: {
                ...rowMeta,
                primary_rental_id: newRentalId,
                relinked_from_primary: originalRentalId,
                relinked_at: nowIso,
              },
              updated_at: nowIso,
            })
            .eq("rental_id", row.rental_id);
          if (relinkErr) {
            logger.warn(`[rental-cascade] Supersede: re-link failed for ${row.rental_id}:`, relinkErr);
          } else {
            relinked += 1;
          }
        }
      }
    } catch (relinkEx) {
      logger.warn("[rental-cascade] Supersede: equipment re-link exception (non-fatal):", relinkEx);
    }

    logger.info("[rental-cascade] Original rental superseded by extension", {
      originalRentalId,
      newRentalId,
      wasActive,
      relinkedEquipment: relinked,
    });

    return { ok: true, closedOriginal: wasActive, relinkedEquipment: relinked };
  } catch (err) {
    logger.error("[rental-cascade] supersedeRentalForExtension exception:", err);
    return { ...failed, error: err instanceof Error ? err.message : "unknown" };
  }
}
