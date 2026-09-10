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
  SUBRENTER_SHARE_PCT,
  getEquipmentCostPart,
  getSubrenterCut,
  buildSubrenterActivationMessage,
  buildSubrenterCompletionMessage,
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
  /** Partner share resolved by the caller (skips the artifact lookup). */
  pct?: number;
}

/**
 * Partner share actually applied to this crew's subrent deals: the latest
 * contract artifact's owner_percentage (private.subrent_contract_artifacts,
 * crew_id column stores the crew SLUG) → clamped [1..99] → default 50.
 * 2026-09-10 parity: the SAME pct must show in the TG messages, the profile
 * «Мои байки в парке» panel and the weekly payout report — previously the
 * messages and the profile hardcoded 50% while the report paid the artifact
 * pct, so the numbers disagreed for non-50 contracts. Best-effort: any
 * lookup failure falls back to 50 without throwing.
 */
export async function resolveSubrenterSharePct(crewId: string | null | undefined): Promise<number> {
  if (!crewId) return SUBRENTER_SHARE_PCT;
  try {
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("slug")
      .eq("id", crewId)
      .maybeSingle();
    const slug = typeof (crew as { slug?: string | null } | null)?.slug === "string"
      ? (crew as { slug: string }).slug
      : null;
    if (!slug) return SUBRENTER_SHARE_PCT;
    const { data: artifact } = await supabaseAdmin
      .schema("private" as never)
      .from("subrent_contract_artifacts")
      .select("owner_percentage")
      .eq("crew_id", slug)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const stored = Number((artifact as { owner_percentage?: string | null } | null)?.owner_percentage);
    if (Number.isFinite(stored) && stored >= 1 && stored <= 99) return Math.round(stored);
  } catch {
    // non-fatal — the default split keeps working
  }
  return SUBRENTER_SHARE_PCT;
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
    // 2026-09-10 parity: resolve the partner share ONCE and use it in BOTH
    // the cut math and the message text (artifact owner_percentage → 50).
    let crewIdResolved: string | null = null;
    let pct = input.pct ?? null;

    if (!vehicle) {
      const { data: rental } = await supabaseAdmin
        .from("rentals")
        .select(`
          rental_id, total_cost, metadata, crew_id,
          agreed_start_date, agreed_end_date,
          vehicle:cars(id, make, model, specs)
        `)
        .eq("rental_id", input.rentalId)
        .maybeSingle();
      if (!rental) return "";
      vehicle = (rental as unknown as { vehicle?: SubrenterNotifyInput["vehicle"] }).vehicle ?? null;
      totalCost = (rental as { total_cost?: number | null }).total_cost ?? null;
      metadata = (rental as { metadata?: Record<string, unknown> | null }).metadata ?? null;
      startDate = (rental as { agreed_start_date?: string | null }).agreed_start_date ?? null;
      endDate = (rental as { agreed_end_date?: string | null }).agreed_end_date ?? null;
      crewIdResolved = (rental as { crew_id?: string | null }).crew_id ?? null;
    }
    if (!vehicle) return "";
    if (pct == null) pct = await resolveSubrenterSharePct(crewIdResolved);

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
    // iter32: pass the total — equipment-only rows (if a partner's bike ever
    // produces one) must not shift the split base.
    const equipmentRub = getEquipmentCostPart(md, totalCost);
    const cutRub = getSubrenterCut(totalCost, equipmentRub, pct);
    const bikeTitle = `${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim() || String(vehicle.id);

    const text = buildSubrenterActivationMessage({
      bikeTitle,
      renterName,
      totalRub: totalCost ?? 0,
      equipmentRub,
      cutRub,
      pct,
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

// ── iter32: completion notification (ExO «Engagement» + «Autonomy») ─────────

/**
 * Notify the partner-owner that a rental of HIS bike just finished. Mirrors
 * notifySubrenterOfRentalActivation: same data resolution, same non-fatal
 * contract, but the close-the-loop message with the FINAL earned amount.
 *
 * Called from updateRentalStatus when the status flips to "completed" (the
 * drawer's «Завершить», the rental page, API callers) — every completion
 * path funnels through it. A missing notification must never break a return.
 */
export async function notifySubrenterOfRentalCompletion(
  input: SubrenterNotifyInput,
): Promise<string> {
  try {
    let vehicle = input.vehicle ?? null;
    let totalCost = input.totalCost;
    let metadata = input.metadata ?? null;
    let renterName = input.renterName ?? null;
    let startDate = input.startDate ?? null;
    let endDate = input.endDate ?? null;
    // 2026-09-10 parity: same pct resolution as the activation message.
    let crewIdResolved: string | null = null;
    let pct = input.pct ?? null;

    if (!vehicle) {
      const { data: rental } = await supabaseAdmin
        .from("rentals")
        .select(`
          rental_id, total_cost, metadata, crew_id,
          agreed_start_date, agreed_end_date,
          vehicle:cars(id, make, model, specs)
        `)
        .eq("rental_id", input.rentalId)
        .maybeSingle();
      if (!rental) return "";
      vehicle = (rental as unknown as { vehicle?: SubrenterNotifyInput["vehicle"] }).vehicle ?? null;
      totalCost = (rental as { total_cost?: number | null }).total_cost ?? null;
      metadata = (rental as { metadata?: Record<string, unknown> | null }).metadata ?? null;
      startDate = (rental as { agreed_start_date?: string | null }).agreed_start_date ?? null;
      endDate = (rental as { agreed_end_date?: string | null }).agreed_end_date ?? null;
      crewIdResolved = (rental as { crew_id?: string | null }).crew_id ?? null;
    }
    if (!vehicle) return "";
    if (pct == null) pct = await resolveSubrenterSharePct(crewIdResolved);

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

    const equipmentRub = getEquipmentCostPart(md, totalCost);
    const cutRub = getSubrenterCut(totalCost, equipmentRub, pct);
    const bikeTitle = `${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim() || String(vehicle.id);

    const text = buildSubrenterCompletionMessage({
      bikeTitle,
      renterName,
      totalRub: totalCost ?? 0,
      equipmentRub,
      cutRub,
      pct,
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
      logger.warn("[subrenter-notify] completion message failed", {
        rentalId: input.rentalId,
        subrenterChatId,
        error: result?.error,
      });
    }
    return subrenterChatId;
  } catch (error) {
    logger.warn("[subrenter-notify] completion non-fatal failure", { rentalId: input.rentalId, error });
    return "";
  }
}
