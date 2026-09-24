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
// password fallback) + the rental must belong to the caller's crew.
// 2026-09-24 (owner request «give renter the powers»): the RENTER of the
// rental can also type the draft from his own device — crew membership is
// not required for him, a signed-cookie identity matching rentals.user_id
// is enough. The bike's partner-owner (subrenter, cars.specs.subrenter_chat_id)
// is accepted too — same role the photo-upload validateUpload grants him.
// Status guard: only `active` rentals accept a draft (closed rentals are
// history).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyCrewAccess } from "@/app/api/franchize/_auth";
import {
  TELEGRAM_ACTOR_COOKIE,
  verifyTelegramActorCookieValue,
} from "@/lib/telegram-actor-cookie";
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
      .select("rental_id, crew_id, user_id, vehicle_id, status, metadata")
      .eq("rental_id", rentalId)
      .maybeSingle();
    if (rentalError || !rental) {
      return NextResponse.json({ success: false, error: "Аренда не найдена." }, { status: 404 });
    }

    // Signed-cookie identity is required for the RENTER/SUBRENTER path — the
    // forgeable x-telegram-user-id header stays crew-only (verifyCrewAccess).
    const cookieUserId = verifyTelegramActorCookieValue(
      request.cookies.get(TELEGRAM_ACTOR_COOKIE)?.value,
    );

    const access = await verifyCrewAccess(request, rental.crew_id ?? undefined);
    if (!access.ok) {
      // Renter path: the caller is the rental's own renter (rentals.user_id).
      const isRenter = Boolean(cookieUserId) && cookieUserId === rental.user_id;
      // Subrenter path: partner-owner of THIS bike (cars.specs.subrenter_chat_id)
      // — same role validateUpload grants him on photo uploads.
      let isSubrenter = false;
      if (!isRenter && cookieUserId && rental.vehicle_id) {
        const { data: vehicleRow } = await supabaseAdmin
          .from("cars")
          .select("specs")
          .eq("id", rental.vehicle_id)
          .maybeSingle();
        const sub = (vehicleRow?.specs as Record<string, unknown> | null)?.["subrenter_chat_id"];
        // .trim() on the string branch — the webhook snapshot and
        // subrenter-notify both trim subrenter_chat_id, padded values must
        // still match (review 2026-09-24).
        isSubrenter =
          (typeof sub === "string" && (sub === cookieUserId || sub.trim() === cookieUserId)) ||
          (typeof sub === "number" && String(sub) === cookieUserId);
      }
      if (!isRenter && !isSubrenter) return access.response;
    }

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

    // Audit trail: this draft feeds the deposit deduction at closure — record
    // WHO typed it (crew path → verifyCrewAccess userId; renter/subrenter →
    // signed-cookie identity) to settle future disputes cheaply
    // (review 2026-09-24).
    logger.info("[rental-odometer] draft saved", {
      rentalId,
      odometerAfter,
      odometerBefore,
      actor: access.ok ? access.userId : cookieUserId,
    });

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
