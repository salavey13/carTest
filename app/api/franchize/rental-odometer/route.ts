// /app/api/franchize/rental-odometer/route.ts
//
// 2026-09-11 — "odometer at the end" moved from the closure modal to the main
// rental page (owner request): the operator types the final odometer while the
// bike is being returned, sees the LIVE difference vs the handover reading, and
// by the time the closure modal opens the value is already saved — the operator
// instantly knows how much (if anything) to deduct from the deposit.
//
// This endpoint persists the END-odometer draft on an ACTIVE rental:
//   rentals.metadata.odometer_after_draft = <km>
// The closure flow (confirmVehicleReturn) keeps writing the authoritative
// metadata.odometer_after. Auth: verifyCrewAccess (signed actor cookie /
// password fallback) + the rental must belong to the caller's crew. Status
// guard: only `active` rentals accept a draft (closed rentals are history).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyCrewAccess } from "@/app/api/franchize/_auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

interface OdometerDraftRequest {
  rentalId: string;
  /** Final odometer reading in km. `null` clears the draft. */
  odometerAfter: number | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as OdometerDraftRequest;
    const rentalId = typeof body?.rentalId === "string" ? body.rentalId : "";
    const rawOdo = body?.odometerAfter;

    if (!rentalId) {
      return NextResponse.json({ success: false, error: "rentalId обязателен." }, { status: 400 });
    }
    // null clears the draft; anything else must be a sane positive km number.
    let odometerAfter: number | null = null;
    if (rawOdo !== null && rawOdo !== undefined) {
      const n = Math.round(Number(rawOdo));
      if (!Number.isFinite(n) || n < 0 || n > 10_000_000) {
        return NextResponse.json({ success: false, error: "Некорректное значение одометра." }, { status: 400 });
      }
      odometerAfter = n;
    }

    const { data: rental, error: rentalError } = await supabaseAdmin
      .from("rentals")
      .select("rental_id, crew_id, status, metadata")
      .eq("rental_id", rentalId)
      .maybeSingle();
    if (rentalError || !rental) {
      return NextResponse.json({ success: false, error: "Аренда не найдена." }, { status: 404 });
    }

    const access = await verifyCrewAccess(request, rental.crew_id ?? undefined);
    if (!access.ok) return access.response;

    if (rental.status !== "active") {
      return NextResponse.json(
        { success: false, error: "Финальный одометр фиксируется только для активной аренды." },
        { status: 409 },
      );
    }

    const meta = (rental.metadata as Record<string, unknown> | null) ?? {};

    // Handover reading — same resolution chain the rental page uses.
    const pickupFreeze = meta.pickup_freeze as { odometer_km?: unknown } | null | undefined;
    const beforeRaw =
      (typeof pickupFreeze?.odometer_km === "number" ? pickupFreeze.odometer_km : undefined)
      ?? meta.odometer_before
      ?? meta.last_known_odometer
      ?? meta.odometer_before_hint
      ?? null;
    const odometerBefore = typeof beforeRaw === "number" && Number.isFinite(beforeRaw) ? beforeRaw : null;

    const { error: updateError } = await supabaseAdmin
      .from("rentals")
      .update({
        metadata: { ...meta, odometer_after_draft: odometerAfter },
        updated_at: new Date().toISOString(),
      })
      .eq("rental_id", rentalId);
    if (updateError) {
      logger.error("[rental-odometer] metadata update failed:", updateError.message);
      return NextResponse.json({ success: false, error: "Не удалось сохранить одометр." }, { status: 500 });
    }

    const delta =
      odometerAfter !== null && odometerBefore !== null
        ? Math.round(odometerAfter - odometerBefore)
        : null;

    return NextResponse.json({ success: true, odometerAfter, odometerBefore, delta });
  } catch (e) {
    logger.error("[rental-odometer] Unexpected error:", e);
    return NextResponse.json({ success: false, error: "Внутренняя ошибка." }, { status: 500 });
  }
}
