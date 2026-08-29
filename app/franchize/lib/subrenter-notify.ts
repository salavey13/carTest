// app/franchize/lib/subrenter-notify.ts
// ──────────────────────────────────────────────────────────────────────────
// Subrenter Telegram notifications (iter18).
//
// When a rental of a SUBRENTED bike (cars.specs.subrenter_chat_id set) is
// activated, the partner-owner gets an immediate-satisfaction message: his
// bike is out with a renter + his 50% cut of the BIKE part (equipment is NOT
// split — it is crew property and crew revenue).
//
// Called from every activation path:
//   • activateRental            (web rental page, 2-step handout confirmation)
//   • updateRentalStatus        (manual status flips to "active")
//   • activateRentalIfReady     (auto-activation after verification todos)
//
// All failures are non-fatal: a missing notification must never break an
// activation.

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import {
  getEquipmentCostPart,
  getSubrenterCut,
  buildSubrenterActivationMessage,
} from "@/app/franchize/lib/subrenter-economics";

export interface SubrenterNotifyInput {
  rentalId: string;
  /** Pre-fetched vehicle row — saves a query when the caller already has it. */
  vehicle?: {
    id: string | number;
    make?: string | null;
    model?: string | null;
    specs?: Record<string, unknown> | null;
  } | null;
  /** Pre-fetched rental fields (both are usually already in hand). */
  totalCost?: number | string | null;
  metadata?: Record<string, unknown> | null;
  renterName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  crewName?: string | null;
}

/**
 * Notify the partner-owner that his bike just went out on a rental.
 * Returns the notified chat id ("" when the bike is not subrented / nothing
 * was sent) so callers can log it.
 */
export async function notifySubrenterOfRentalActivation(
  input: SubrenterNotifyInput,
): Promise<string> {
  try {
    let vehicle = input.vehicle ?? null;
    let totalCost = input.totalCost;
    let metadata = input.metadata ?? null;
    let renterName = input.renterName ?? null;
    let startDate = input.startDate ?? null;
    let endDate = input.endDate ?? null;

    if (!vehicle) {
      const { data: rental } = await supabaseAdmin
        .from("rentals")
        .select(`
          rental_id, total_cost, metadata,
          agreed_start_date, agreed_end_date,
          vehicle:cars(id, make, model, specs)
        `)
        .eq("rental_id", input.rentalId)
        .maybeSingle();
      if (!rental) return "";
      vehicle = (rental as { vehicle?: SubrenterNotifyInput["vehicle"] }).vehicle ?? null;
      totalCost = (rental as { total_cost?: number | null }).total_cost ?? null;
      metadata = (rental as { metadata?: Record<string, unknown> | null }).metadata ?? null;
      startDate = (rental as { agreed_start_date?: string | null }).agreed_start_date ?? null;
      endDate = (rental as { agreed_end_date?: string | null }).agreed_end_date ?? null;
    }
    if (!vehicle) return "";

    const md = metadata ?? {};
    if (!renterName) {
      const rn = md["renter_name"];
      if (typeof rn === "string" && rn.trim()) renterName = rn.trim();
    }

    const subrenterChatIdRaw = (vehicle.specs ?? {})["subrenter_chat_id"];
    const subrenterChatId =
      typeof subrenterChatIdRaw === "string" && subrenterChatIdRaw.trim().length > 0
        ? subrenterChatIdRaw.trim()
        : typeof subrenterChatIdRaw === "number" && Number.isFinite(subrenterChatIdRaw)
          ? String(subrenterChatIdRaw)
          : "";
    if (!subrenterChatId) return "";

    // Never notify the acting crew about their own internal rows (e.g. the
    // partner renting his own bike) — still returns the chat id.
    const equipmentRub = getEquipmentCostPart(md);
    const cutRub = getSubrenterCut(totalCost, equipmentRub);
    const bikeTitle = `${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim() || String(vehicle.id);

    const text = buildSubrenterActivationMessage({
      bikeTitle,
      renterName,
      totalRub: totalCost ?? 0,
      equipmentRub,
      cutRub,
      shortRentalId: input.rentalId.slice(0, 8),
      startDate,
      endDate,
      crewName: input.crewName ?? null,
    });

    const { sendComplexMessage } = await import(
      "@/app/webhook-handlers/actions/sendComplexMessage"
    );
    const result = await sendComplexMessage(subrenterChatId, text, [], {
      parseMode: "HTML",
    });
    if (!result?.success) {
      logger.warn("[subrenter-notify] activation message failed", {
        rentalId: input.rentalId,
        subrenterChatId,
        error: result?.error,
      });
    }
    return subrenterChatId;
  } catch (error) {
    logger.warn("[subrenter-notify] non-fatal failure", { rentalId: input.rentalId, error });
    return "";
  }
}
