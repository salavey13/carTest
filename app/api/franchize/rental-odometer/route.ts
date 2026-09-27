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
//
// 2026-09-28 (owner request «allow renter to set start odometer value for
// rental he created via web app flow»): `field: "start"` writes the
// HANDOVER reading (metadata.odometer_before) while the rental has NOT been
// picked up yet (pending_confirmation/confirmed, no pickup_freeze). The
// renter — who created the deal in the web app and knows the real dash
// reading before the ride — no longer has to wait for the operator; the
// freeze dialog (FranchizeRentalDocumentsPanel) pre-fills from this value.
// The write mirrors the /doc flow (doc-manual.ts stores odometer_before at
// creation) so salary/analytic consumers see the same shape.

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
  /** Which reading to write: "end" (default, draft for closure) or "start"
   *  (authoritative metadata.odometer_before before handout). */
  field?: "start" | "end";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as OdometerDraftRequest;
    const rentalId = typeof body?.rentalId === "string" ? body.rentalId : "";
    const rawOdo = body?.odometerAfter;
    const fieldRaw = body?.field;
    if (fieldRaw !== undefined && fieldRaw !== "start" && fieldRaw !== "end") {
      return NextResponse.json({ success: false, error: "field должен быть start или end." }, { status: 400 });
    }
    const field = fieldRaw === "start" ? "start" : "end";

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
      .select("rental_id, crew_id, user_id, vehicle_id, status, metadata, updated_at")
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
    // Hoisted for the start-mode actorKind label below (same predicate as the
    // renter branch inside the access check).
    const isRenterActor = Boolean(cookieUserId) && cookieUserId === rental.user_id;
    if (!access.ok) {
      // Renter path: the caller is the rental's own renter (rentals.user_id).
      const isRenter = isRenterActor;
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

    const meta = (rental.metadata as Record<string, unknown> | null) ?? {};

    // ── CAS metadata merge (boss review R1 #1) ──
    // The metadata jsonb is a shared document: the pickup-freeze dialog,
    // this route (end draft) and the webhook's contract_verifier update all
    // write it. A plain read-modify-write could resurrect a STALE object and
    // silently delete a concurrent pickup_freeze (the deposit-math anchor).
    // The update is therefore conditioned on the updated_at seen at read
    // time (compare-and-swap); 0 affected rows → re-read, re-check the
    // guards, merge on top of the FRESH metadata, retry (bounded).
    let seenUpdatedAt = (rental as { updated_at?: string | null }).updated_at ?? null;
    const casUpdate = async (
      buildMetadata: (freshMeta: Record<string, unknown>) => Record<string, unknown> | null,
    ): Promise<{ ok: boolean; error?: string; conflict?: boolean }> => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        // The caller re-reads metadata inside buildMetadata via the loop —
        // first attempt uses the already-fetched row, retries re-read.
        let freshMeta = meta;
        if (attempt > 0) {
          const { data: fresh } = await supabaseAdmin
            .from("rentals")
            .select("metadata, updated_at")
            .eq("rental_id", rentalId)
            .maybeSingle();
          if (!fresh) return { ok: false, error: "Аренда не найдена." };
          freshMeta = (fresh.metadata as Record<string, unknown> | null) ?? {};
          seenUpdatedAt = (fresh as { updated_at?: string | null }).updated_at ?? null;
        }
        const nextMetadata = buildMetadata(freshMeta);
        if (nextMetadata === null) return { ok: true }; // no-op requested
        let updateQuery = supabaseAdmin
          .from("rentals")
          .update(
            { metadata: nextMetadata, updated_at: new Date().toISOString() },
            { count: "exact" }, // CAS needs the affected-rows count
          )
          .eq("rental_id", rentalId);
        // updated_at может быть NULL (старые строки) — тогда CAS-условие «IS NULL».
        updateQuery =
          seenUpdatedAt == null
            ? updateQuery.is("updated_at", null)
            : updateQuery.eq("updated_at", seenUpdatedAt);
        const { error: casError, count } = await updateQuery.select("rental_id");
        if (casError) return { ok: false, error: casError.message };
        if ((count ?? 0) > 0) return { ok: true };
        // count === 0 → concurrent writer won; loop re-reads and retries.
      }
      return { ok: false, conflict: true, error: "Одометр не сохранён — карточка параллельно изменяется. Повторите попытку." };
    };

    if (field === "start") {
      // ── Start-odometer mode ──
      // The handover reading belongs to the PRE-pickup phase: once the
      // operator saved the pickup freeze, the freeze owns the reading and
      // the API no longer accepts overrides (the freeze is what the deposit
      // math and the audit trail hang on). Closed/cancelled are history.
      if (rental.status !== "pending_confirmation" && rental.status !== "confirmed") {
        return NextResponse.json(
          { success: false, error: "Стартовый одометр фиксируется до выдачи ТС." },
          { status: 409 },
        );
      }
      const existingFreeze = meta.pickup_freeze as { frozen_at?: unknown } | null | undefined;
      if (existingFreeze?.frozen_at) {
        return NextResponse.json(
          { success: false, error: "Выдача уже зафиксирована — стартовый одометр изменить нельзя." },
          { status: 409 },
        );
      }
      const startValue = odometerAfter; // null = no-op (start value is write-once-until-freeze)
      const actorKind = access.ok ? "operator" : isRenterActor ? "renter" : "subrenter";
      if (startValue === null) {
        // R1 #7: «clear» is not a legal start-mode operation — respond honestly
        // instead of a metadata touch that would bump updated_at for nothing.
        return NextResponse.json({ success: true, field: "start", odometerBefore: null, noop: true });
      }
      // R1 #6 (soft anomaly flag): a start reading BELOW the last known
      // odometer (specs / previous closure) understates the season delta.
      // Not rejected — the hint can be stale — but flagged for the audit.
      const knownRaw = meta.last_known_odometer ?? meta.odometer_before_hint;
      const known = typeof knownRaw === "number" && Number.isFinite(knownRaw) ? knownRaw : null;
      const belowKnown = known != null && startValue < known;
      const cas = await casUpdate((freshMeta) => ({
        ...freshMeta,
        odometer_before: startValue,
        odometer_before_source: actorKind,
        odometer_before_at: new Date().toISOString(),
        ...(belowKnown ? { odometer_before_below_known: true } : {}),
      }));
      if (!cas.ok) {
        if (cas.conflict) {
          return NextResponse.json({ success: false, error: cas.error }, { status: 409 });
        }
        logger.error("[rental-odometer] start update failed:", cas.error ?? "unknown");
        return NextResponse.json({ success: false, error: "Не удалось сохранить одометр." }, { status: 500 });
      }
      logger.info("[rental-odometer] start odometer saved", {
        rentalId,
        odometerBefore: startValue,
        source: actorKind,
        belowKnown,
        actor: access.ok ? access.userId : cookieUserId,
      });

      // 2026-09-28: renter self-service badge «Стартовый замер» (+ combo) —
      // non-fatal, renter-path only (crew has its own odometer badges).
      if (isRenterActor && !access.ok && cookieUserId) {
        try {
          const { grantRenterStartOdometer } = await import(
            "@/app/franchize/server-actions/renter-self-service-achievements"
          );
          await grantRenterStartOdometer({ userId: cookieUserId, rentalId });
        } catch (achErr) {
          logger.warn("[rental-odometer] renter odometer achievement failed (non-fatal)", achErr);
        }
      }

      return NextResponse.json({ success: true, field: "start", odometerBefore: startValue, belowKnown: belowKnown || undefined });
    }

    if (rental.status !== "active") {
      return NextResponse.json(
        { success: false, error: "Финальный одометр фиксируется только для активной аренды." },
        { status: 409 },
      );
    }

    // Handover reading — same resolution chain the rental page uses.
    const pickupFreeze = meta.pickup_freeze as { odometer_km?: unknown } | null | undefined;
    const beforeRaw =
      (typeof pickupFreeze?.odometer_km === "number" ? pickupFreeze.odometer_km : undefined)
      ?? meta.odometer_before
      ?? meta.last_known_odometer
      ?? meta.odometer_before_hint
      ?? null;
    const odometerBefore = typeof beforeRaw === "number" && Number.isFinite(beforeRaw) ? beforeRaw : null;

    const endCas = await casUpdate((freshMeta) => ({ ...freshMeta, odometer_after_draft: odometerAfter }));
    if (!endCas.ok) {
      if (endCas.conflict) {
        return NextResponse.json({ success: false, error: endCas.error }, { status: 409 });
      }
      logger.error("[rental-odometer] metadata update failed:", endCas.error ?? "unknown");
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
