// app/franchize/lib/rental-verify.ts
//
// Task 101 — RENTAL VERIFICATION («verified» salary state), SERVER HALF.
// Pure types/state-machine/formatting live in rental-verify-core.ts (zero
// imports — unit-testable); everything here touches Supabase/Telegram.
//
// WHY: month-end salary deduction used to mean hand-auditing EVERY rental of
// the period — a half-day process, and a sensitive one (boss: «this topic is
// very sensitive, treat it with full respect»). Now, right after a rental is
// CLOSED, the bot sends the calculated commission to BOTH the attributed
// operator and the crew owner with an inline keyboard:
//   ✅ Подтверждаю  /  ⚠️ Оспорить
// When both parties confirm, the rental becomes VERIFIED — lists/profile/CSV
// mark it, so month-end only reviews the small ⏳/⚠️ remainder. This turns
// the monthly reconciliation into an on-the-fly, gamified routine.
//
// MONEY-SAFETY CONTRACT:
//   • The commission math is the EXACT canonical one (computeRentalSalary +
//     resolveBikeCategories + countEquipmentUnits + standardRentalPrice — the
//     same functions computeCategoryBonuses uses for the actual salary).
//   • The snapshot is FROZEN at request time into rental_verifications.snapshot
//     — the numbers both parties saw are the numbers stored.
//   • Nothing here writes to the cash ledger / wallet — verification is a
//     REVIEW state, payouts stay an explicit owner action.
//   • Every DB touch degrades gracefully: if Paul has not applied
//     docs/crewDocs/rental-verifications-table-2026-10-17.sql yet, requests
//     no-op with a warn and UI simply shows no badges. Deploy order-agnostic.
//
// Callback wiring: command-handler.ts routes `vrf_*` callback_data here via
// app/webhook-handlers/commands/rental-verify.ts.

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { telegramDeliver } from "@/lib/telegram-transport";
import {
  getSalaryConfig,
  getBikeCategoryOverrides,
  resolveBikeCategories,
  countEquipmentUnits,
  computeRentalSalary,
  equipmentStandardCost,
  equipmentStandardLines,
  standardRentalPriceDetailed,
  RENTAL_CATEGORY_LABELS,
  effectiveGearDays,
  buildGearDaysLine,
  buildEquipmentCommLine,
  type RentalEquipment,
} from "@/lib/salary-coefficients";
import {
  daysLabelRu,
  equipmentFlagsLabel,
  hoursLabelRu,
} from "@/lib/salary-coefficients-shared";
import { resolveRentalOperator, type ShiftLike } from "@/app/franchize/lib/operator-attribution";
// Task 114: per-rental audit grade computed at request time (pure module).
import { buildAuditStamp, computeRentalAuditGrade, computeVerificationReasonability } from "@/app/franchize/lib/rental-audit";
// Task 117: the operator score uses the SAME commission math as the payout hub.
import { commissionOf } from "./rental-payout-core";
import {
  grantFranchizeAchievementAction,
  syncFranchizeCountersAction,
} from "@/app/franchize/profile-actions";
import {
  acceptOpenProposal,
  adjustPartKeyboard,
  applyVerificationAction,
  applySplitDelta,
  auditGradeLine,
  bikeTierLabelRu,
  clearDraft,
  computeNoProblemoStreak,
  declineOpenProposal,
  disputeEditorKeyboard,
  escapeVerifyHtml,
  formatDealDoneText,
  formatDisputeEditor,
  formatProposalMessage,
  formatRubVerify,
  formatVerificationSummary,
  labelFromUsersMap,
  nextUpLine,
  otherPartyChatId,
  parseNegotiation,
  parseProposalCallback,
  proposalResponseKeyboard,
  proposalSentKeyboard,
  resetSplitPart,
  resolveVerificationRole,
  sendProposalFromDraft,
  selfHealErrorText,
  setDraftComment,
  setDraftSplit,
  snapshotSplitOf,
  splitTotal,
  startDraft,
  streakProgressLine,
  verificationKeyboard,
  verificationSpeedLine,
  verificationStatusNote,
  verifyProgressLine,
  warmCloserLine,
  withdrawOpenProposal,
  type InlineButton,
  type NegotiationState,
  type OpenProposal,
  type RentalVerificationRow,
  type RentalVerificationSnapshot,
  type RentalVerificationStatus,
  type SplitPartKey,
  type StreakRow,
  type VerificationActor,
  type VerificationBrief,
} from "./rental-verify-core";

// Re-export the pure surface so consumers (webhook wrapper, server actions,
// CSV builder, category bonuses) have ONE import path.
export {
  acceptOpenProposal,
  applyVerificationAction,
  declineOpenProposal,
  disputeEditorKeyboard,
  escapeVerifyHtml,
  formatDealDoneText,
  formatDisputeEditor,
  formatProposalMessage,
  formatRubVerify,
  formatVerificationSummary,
  labelFromUsersMap,
  parseNegotiation,
  parseProposalCallback,
  proposalResponseKeyboard,
  proposalSentKeyboard,
  resolveVerificationRole,
  sendProposalFromDraft,
  selfHealErrorText,
  snapshotSplitOf,
  splitTotal,
  startDraft,
  tallyVerificationStatuses,
  verificationKeyboard,
  verificationStatusNote,
  withdrawOpenProposal,
  VERIFICATION_STATUS_LABELS,
} from "./rental-verify-core";
export type {
  ApplyActionResult,
  InlineButton,
  NegotiationRound,
  NegotiationState,
  OpenProposal,
  RentalVerificationRow,
  RentalVerificationSnapshot,
  RentalVerificationStatus,
  SplitPartKey,
  SplitParts,
  VerificationBrief,
  VerificationEffect,
} from "./rental-verify-core";

// ── Snapshot computation (canonical math) ────────────────────────────────────

export async function computeRentalVerificationSnapshot(params: {
  rental: {
    rental_id: string;
    total_cost: number | null;
    metadata: Record<string, unknown> | null;
    requested_start_date: string | null;
    requested_end_date: string | null;
    agreed_start_date: string | null;
    agreed_end_date: string | null;
    created_by_operator_chat_id?: string | null;
    created_at?: string | null;
    /** Task 123: photo counters — optional so old callers keep compiling. */
    start_photo_count?: number | null;
    end_photo_count?: number | null;
    vehicle: {
      id?: string;
      make?: string | null;
      model?: string | null;
      specs?: Record<string, unknown> | null;
      daily_price?: number | null;
    } | null;
  };
  crewId: string;
  requestedAtIso: string;
}): Promise<RentalVerificationSnapshot> {
  const { rental, crewId } = params;
  const [config, bikeOverrides] = await Promise.all([
    getSalaryConfig(crewId),
    getBikeCategoryOverrides(crewId),
  ]);
  const vehicle = rental.vehicle;
  const meta = (rental.metadata || {}) as Record<string, unknown>;
  const eq = (meta.equipment || {}) as RentalEquipment;
  const categories = resolveBikeCategories(vehicle?.id || "", bikeOverrides);
  const price = Number(rental.total_cost) || 0;
  const startIso = rental.requested_start_date || rental.agreed_start_date || null;
  const endIso = rental.requested_end_date || rental.agreed_end_date || null;
  const stdDetail = standardRentalPriceDetailed({
    specs: vehicle?.specs,
    startIso,
    endIso,
    dailyPrice: vehicle?.daily_price,
    fallbackTotalCost: price,
  });
  // Task 118 (boss 2026-10-21): gear bills EVERY charged day — the client rule
  // «1-е сутки полная цена, дальше — половина» is now ALSO the эталон rule and
  // the operator's commission ladder (200 ₽/ед day 1, 100 ₽/ед days 2+).
  // Bikes have NO taper: ladder price × days, flat ₽/аренда bonus.
  const gearDays = effectiveGearDays({ days: stdDetail.days, hours: stdDetail.hours });
  // Task 121: hours ride along — a <24h window halves the CLIENT gear price
  // too (шлем 1000→500, остальное 500→250), so эталон matches what the
  // client actually should pay and the markup line stays honest.
  const gearStandardCost = equipmentStandardCost(eq, gearDays, stdDetail.hours);
  const stdPrice = stdDetail.price + gearStandardCost;
  const equipmentUnits = countEquipmentUnits(eq);
  // Task 120 (boss): rentals shorter than 24 hours halve the operator's
  // commission (мот 1 000→500 · экип 200→100/ед). The hours come from the
  // same stdDetail the эталон uses — one canon, the DM formula stays honest.
  const salary = computeRentalSalary({
    config,
    rentalCategory: categories.rental,
    equipmentUnits,
    totalCost: price,
    standardPrice: stdPrice,
    equipmentDays: gearDays,
    rentalHours: stdDetail.hours,
  });

  const freeze = meta.pickup_freeze as Record<string, unknown> | undefined;
  const penaltyMeta = meta.penalty as { amount?: number; destination?: string; reason?: string } | undefined;

  // ── Task 117: freeze the formula the DM shows («откуда цифры») ──
  // Digit-equal with the salary math above: same baseline, same config.
  const gearLines = equipmentStandardLines(eq, stdDetail.hours).map((l) => `${l.label} — ${l.sum} ₽`);
  const markup = Math.max(0, price - stdPrice);
  // Task 118: pre-format the day-ladder lines (plural-safe labels frozen here,
  // the pure formatter only prints what it is given).
  const gearDaysLabel = gearDays > 1 ? daysLabelRu(gearDays) : null;
  const gearDaysLine = buildGearDaysLine(eq, gearDays, gearStandardCost);
  const equipCommLine = buildEquipmentCommLine(
    equipmentUnits,
    config.equipmentRentalUnit,
    config.equipmentRentalUnitFollowup,
    gearDays,
  );
  const bikeImage = typeof (vehicle as any)?.image_url === "string" ? (vehicle as any).image_url.trim() : "";
  // ── Task 123: photo presence frozen with the numbers ──
  // Counts: the rental columns are the truth the return page shows; the
  // metadata sources (pickup_freeze.photo_urls, start/end_photo_url) fill the
  // gaps when a column was not maintained. Canonical URL per state: the
  // renter-uploaded «ДО»/«ПОСЛЕ» shot wins, otherwise the first pickup-freeze
  // photo represents «ДО». null (field absent) when a rental has neither —
  // the DM then simply shows no photo line.
  const freezePhotos = Array.isArray(freeze?.photo_urls)
    ? (freeze!.photo_urls as unknown[]).filter((u): u is string => typeof u === "string" && /^https:\/\//i.test(u.trim()))
    : [];
  const startPhotoUrl =
    typeof meta.start_photo_url === "string" && /^https:\/\//i.test(meta.start_photo_url.trim())
      ? meta.start_photo_url.trim()
      : null;
  const endPhotoUrl =
    typeof meta.end_photo_url === "string" && /^https:\/\//i.test(meta.end_photo_url.trim())
      ? meta.end_photo_url.trim()
      : null;
  const photosBefore = Math.max(
    Number(rental.start_photo_count) || 0,
    freezePhotos.length,
    startPhotoUrl ? 1 : 0,
  );
  const photosAfter = Math.max(Number(rental.end_photo_count) || 0, endPhotoUrl ? 1 : 0);
  // Task 123 (durable): the latest «ДО»/«ПОСЛЕ» storage paths from
  // rental_photos — the private bucket serves via SIGNED urls, so the path is
  // what gets frozen; the signed link is minted at send time and never stale.
  let beforePath: string | null = null;
  let afterPath: string | null = null;
  if (photosBefore > 0 || photosAfter > 0) {
    try {
      const { data: photoRows } = await supabaseAdmin
        .from("rental_photos")
        .select("photo_type, storage_path, created_at")
        .eq("rental_id", rental.rental_id)
        .in("photo_type", ["start", "end"])
        .order("created_at", { ascending: false })
        .limit(20);
      for (const p of (photoRows || []) as Array<{ photo_type: string; storage_path: string }>) {
        if (!p.storage_path) continue;
        if (p.photo_type === "end" && !afterPath) afterPath = p.storage_path;
        if (p.photo_type === "start" && !beforePath) beforePath = p.storage_path;
        if (beforePath && afterPath) break;
      }
    } catch {
      // non-fatal: paths are an upgrade — counts and metadata URLs still work
    }
  }
  const photosBlock =
    photosBefore > 0 || photosAfter > 0
      ? {
          before: photosBefore,
          after: photosAfter,
          beforeUrl: startPhotoUrl || freezePhotos[0] || null,
          afterUrl: endPhotoUrl,
          beforePath,
          afterPath,
        }
      : null;
  return {
    bikeName: `${vehicle?.make || ""} ${vehicle?.model || ""}`.trim(),
    rentalCategory: categories.rental,
    rentalCategoryLabel: RENTAL_CATEGORY_LABELS[categories.rental] || categories.rental,
    totalCost: price,
    base: salary.base,
    equipment: salary.equipment,
    overprice: salary.overprice,
    total: salary.total,
    equipmentUnits,
    equipmentFlags: equipmentFlagsLabel(eq),
    overpricePercent: config.overpricePercent,
    depositReturned: typeof meta.deposit_returned === "boolean" ? (meta.deposit_returned as boolean) : null,
    damageNotes:
      typeof meta.damage_notes === "string" && meta.damage_notes.trim() ? (meta.damage_notes as string) : null,
    returnNotes:
      typeof meta.return_notes === "string" && meta.return_notes.trim() ? (meta.return_notes as string) : null,
    penalty:
      penaltyMeta && Number(penaltyMeta.amount) > 0
        ? {
            amount: Number(penaltyMeta.amount),
            destination: String(penaltyMeta.destination || "cash"),
            reason: String(penaltyMeta.reason || ""),
          }
        : null,
    attribution: {
      source: "request",
      createdByChatId:
        typeof rental.created_by_operator_chat_id === "string" && rental.created_by_operator_chat_id.trim()
          ? rental.created_by_operator_chat_id.trim()
          : null,
      handedByChatId:
        freeze && typeof freeze.frozen_by === "string" && freeze.frozen_by.trim()
          ? freeze.frozen_by.trim()
          : null,
      returnedByChatId:
        typeof meta.return_confirmed_by === "string" && meta.return_confirmed_by.trim()
          ? meta.return_confirmed_by.trim()
          : null,
    },
    requestedAtIso: params.requestedAtIso,
    rentalWindow: {
      startIso,
      endIso,
      hours: stdDetail.hours,
      days: stdDetail.days,
      durationLabel:
        stdDetail.hours > 0
          ? stdDetail.hours >= 24
            ? daysLabelRu(stdDetail.days || Math.ceil(stdDetail.hours / 24))
            : hoursLabelRu(stdDetail.hours)
          : "—",
    },
    formula: {
      fallback: stdDetail.fallback,
      bikeStandard: stdDetail.price,
      bikeTierLabel: stdDetail.fallback ? null : bikeTierLabelRu(stdDetail.tier, stdDetail.days, stdDetail.hours),
      bikeRate: stdDetail.rate,
      bikeDays: stdDetail.days,
      bikeHours: stdDetail.hours,
      gearLines,
      gearStandard: gearStandardCost,
      gearDays,
      equipFollowupUnit: config.equipmentRentalUnitFollowup,
      gearDaysLabel,
      gearDaysLine,
      equipCommLine,
      shortRental: salary.shortRental === true,
      standardTotal: stdPrice,
      clientTotal: price,
      markup,
      baseCoef: config.rental[categories.rental] ?? 0,
      equipmentUnitCoef: config.equipmentRentalUnit,
      overpricePercent: config.overpricePercent,
    },
    bikePhotoUrl: bikeImage.startsWith("http") ? bikeImage : null,
    photos: photosBlock,
  };
}

// ── Graceful table access ────────────────────────────────────────────────────

/** True when the failure is «Paul hasn't applied the SQL yet» — feature no-ops. */
export function isMissingRelationError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42P01") return true; // undefined_table
  return /relation .* does not exist|schema cache/i.test(error.message || "");
}

/**
 * Task 106 degradation: the negotiation lives in ONE extra jsonb column.
 * Until Paul applies the ALTER TABLE, every write/select touching it fails
 * with PGRST204 (unknown column) — the editor then no-ops and «Оспорить»
 * behaves exactly like the task-101 plain dispute.
 */
function isMissingNegotiationError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "PGRST204") return true;
  return /'negotiation' column/i.test(error.message || "");
}

// ── Users lookup ─────────────────────────────────────────────────────────────

/** Chat id → @username/full_name labels (exported for the drawer resend action). */
export async function loadUsersMap(
  chatIds: Array<string | null | undefined>,
): Promise<Map<string, { username?: string | null; full_name?: string | null }>> {
  const unique = [...new Set(chatIds.filter(Boolean).map(String))];
  const map = new Map<string, { username?: string | null; full_name?: string | null }>();
  if (unique.length === 0) return map;
  const { data } = await supabaseAdmin
    .from("users")
    .select("user_id, username, full_name")
    .in("user_id", unique);
  for (const row of (data || []) as Array<{
    user_id: string | number;
    username?: string | null;
    full_name?: string | null;
  }>) {
    map.set(String(row.user_id), { username: row.username, full_name: row.full_name });
  }
  return map;
}

// ── Request orchestration ────────────────────────────────────────────────────

/**
 * Called (fire-and-forget, non-fatal) right after a rental is closed, from
 * BOTH closure paths: confirmVehicleReturn (rental page) and updateRentalStatus
 * (analytics dashboard). Creates the verification row and DMs both parties.
 */
export async function requestRentalVerification(params: {
  rentalId: string;
  actorChatId: string;
  source: string;
  /**
   * Task 124 — the closure modal's «✅ расчёт сходится» checkbox (checked by
   * default). true → a calm «оператор сверил расчёт при закрытии» check rides
   * in the snapshot; false → the row is forced to normal layout with an
   * «оператор не согласился» warning so the second party looks twice.
   */
  operatorAgreed?: boolean;
}): Promise<{ sent: boolean; reason?: string }> {
  try {
    // ── Fetch the closed rental + vehicle ──
    // Task 117: image_url rides along — the DM opens with the bike photo so
    // the recipient INSTANTLY knows which trip this сверка is about.
    const { data: rentalRow, error: rentalError } = await supabaseAdmin
      .from("rentals")
      .select(`
        rental_id, crew_id, owner_id, total_cost, metadata, status,
        deposit_amount, deposit_returned,
        created_by_operator_chat_id, created_at,
        requested_start_date, requested_end_date, agreed_start_date, agreed_end_date,
        start_photo_count, end_photo_count,
        vehicle:cars(id, make, model, specs, daily_price, type, crew_id, is_test_result, image_url)
      `)
      .eq("rental_id", params.rentalId)
      .maybeSingle();
    if (rentalError) throw rentalError;
    const rental = rentalRow as any;
    if (!rental) return { sent: false, reason: "rental not found" };
    if (!rental.crew_id) return { sent: false, reason: "no crew — personal rental" };

    // Gear/service docs carry no operator bonus — nothing to verify.
    const meta = (rental.metadata || {}) as Record<string, unknown>;
    const vehicle = Array.isArray(rental.vehicle) ? rental.vehicle[0] : rental.vehicle;
    if (meta.item_type === "equipment" || vehicle?.type === "equipment" || vehicle?.type === "service") {
      return { sent: false, reason: "equipment/service doc — no operator bonus" };
    }

    // ── Attributed operator (canonical chain) ──
    // Same window idiom as computeCategoryBonuses: ±1 day around created_at so
    // a rental created at 23:50 still matches the operator's shift.
    const createdAtMs = Date.parse(String(rental.created_at || "")) || Date.now();
    const { data: shiftRows } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("member_id, clock_in_time, clock_out_time")
      .eq("crew_id", rental.crew_id)
      .gte("clock_in_time", new Date(createdAtMs - 25 * 3600 * 1000).toISOString())
      .lte("clock_in_time", new Date(createdAtMs + 25 * 3600 * 1000).toISOString());
    const shifts: ShiftLike[] = (shiftRows || []).map((s: any) => ({
      member_id: s.member_id,
      clock_in_time: s.clock_in_time,
      clock_out_time: s.clock_out_time ?? null,
    }));
    const attribution = resolveRentalOperator(
      {
        created_by_operator_chat_id: rental.created_by_operator_chat_id,
        created_at: rental.created_at,
        metadata: rental.metadata,
      },
      shifts,
    );

    const operatorChatId = attribution.operatorId ? String(attribution.operatorId) : null;
    const ownerChatId = rental.owner_id ? String(rental.owner_id) : null;
    if (!operatorChatId && !ownerChatId) return { sent: false, reason: "no parties to verify" };

    // ── Snapshot BEFORE anything else (freeze the numbers) ──
    const nowIso = new Date().toISOString();
    const snapshot = await computeRentalVerificationSnapshot({
      rental: {
        rental_id: rental.rental_id,
        total_cost: rental.total_cost,
        metadata: rental.metadata,
        requested_start_date: rental.requested_start_date,
        requested_end_date: rental.requested_end_date,
        agreed_start_date: rental.agreed_start_date,
        agreed_end_date: rental.agreed_end_date,
        created_by_operator_chat_id: rental.created_by_operator_chat_id,
        created_at: rental.created_at,
        start_photo_count: (rental as any).start_photo_count,
        end_photo_count: (rental as any).end_photo_count,
        vehicle,
      },
      crewId: rental.crew_id,
      requestedAtIso: nowIso,
    });

    // ── Task 114: audit grade — frozen with the numbers ──
    // Same 8 checks as the Aug/Sep/Oct backfill audit, now for EVERY new row:
    // bulkVerifyFineAction reads snapshot.audit.grade, so a missing stamp
    // would make the monthly «✅ fine» sweep blind to fresh closures.
    try {
      let artifact: { total_sum?: number | null; deposit_rub?: number | null } | null = null;
      if (meta.source === "doc_command" && Number(rental.total_cost) > 0) {
        const privateSchema = (supabaseAdmin as unknown as { schema: (s: string) => typeof supabaseAdmin }).schema("private");
        const { data: art } = await privateSchema
          .from("rental_contract_artifacts")
          .select("total_sum, deposit_rub")
          .eq("rental_id", rental.rental_id)
          .maybeSingle();
        artifact = art || null;
      }
      snapshot.audit = buildAuditStamp(
        computeRentalAuditGrade({
          status: rental.status,
          totalCost: rental.total_cost,
          depositAmount: rental.deposit_amount,
          depositReturned: rental.deposit_returned,
          metadata: meta,
          requestedStartDate: rental.requested_start_date,
          requestedEndDate: rental.requested_end_date,
          agreedStartDate: rental.agreed_start_date,
          agreedEndDate: rental.agreed_end_date,
          createdByOperatorChatId: rental.created_by_operator_chat_id,
          vehicleType: vehicle?.type ?? null,
          isTestResult: (vehicle as any)?.is_test_result === true,
          artifact: artifact ? { totalSum: artifact.total_sum, depositRub: artifact.deposit_rub } : null,
        }),
        nowIso,
        "auto-audit-2026-10-19",
      );
    } catch (auditErr) {
      // Non-fatal: an ungraded row only loses the bulk sweep shortcut.
      logger.warn(`[rental-verify] audit grade failed for ${rental.rental_id} (non-fatal):`, auditErr);
    }

    // ── Task 123: NO PROBLEMO verdict — frozen with the numbers ──
    // The audit grade + the last-mile checks (penalty/damage/deposit) decide
    // the DM layout NOW, at request time: clean rentals collapse their расчёт
    // into a Telegram expandable spoiler under the 🟢 headline. Frozen like
    // the audit block so a resend months later shows the SAME layout the
    // parties first saw.
    try {
      const reasonability = computeVerificationReasonability({
        audit: {
          grade: snapshot.audit?.grade ?? "almost",
          notes: snapshot.audit?.notes ?? ["аудит не выполнен"],
        },
        markup: Number.isFinite(Number(snapshot.formula?.markup)) ? Number(snapshot.formula?.markup) : null,
        total: Number(snapshot.totalCost) || 0,
        penaltyAmount: Number(snapshot.penalty?.amount) || 0,
        damageNotes: snapshot.damageNotes,
        depositReturned: snapshot.depositReturned,
        depositAmount: Number(rental.deposit_amount) || 0,
        hasFormula: !!snapshot.formula && snapshot.formula.standardTotal > 0,
      });
      snapshot.reasonability = { ...reasonability, checkedAt: nowIso };
      // Task 124 — the operator's «✅ расчёт сходится» vote from the closure
      // modal. Agreement adds a check line (any layout); disagreement forces
      // the rich layout with a warning line — the owner must look twice.
      if (params.operatorAgreed === true) {
        snapshot.reasonability = {
          mode: snapshot.reasonability?.mode ?? "normal",
          checks: [...(snapshot.reasonability?.checks || []), "оператор сверил расчёт при закрытии"],
          checkedAt: nowIso,
        };
      } else if (params.operatorAgreed === false) {
        snapshot.reasonability = {
          mode: "normal",
          checks: ["оператор снял отметку «расчёт ок» при закрытии — проверьте внимательнее"],
          checkedAt: nowIso,
        };
      }
    } catch (reasonErr) {
      // Non-fatal: an ungraded layout just means the rich DM stays.
      logger.warn(`[rental-verify] reasonability failed for ${rental.rental_id} (non-fatal):`, reasonErr);
    }

    const { data: crewRow } = await supabaseAdmin
      .from("crews")
      .select("slug, name")
      .eq("id", rental.crew_id)
      .maybeSingle();
    const crewSlug = (crewRow?.slug as string) || null;
    const crewName = (crewRow?.name as string) || null;

    // ── Idempotent insert: first request wins (re-closures don't re-spam) ──
    const insertPayload = {
      rental_id: rental.rental_id,
      crew_id: rental.crew_id,
      crew_slug: crewSlug,
      operator_chat_id: operatorChatId,
      owner_chat_id: ownerChatId,
      requested_by: String(params.actorChatId),
      status: "pending" as const,
      snapshot,
      source: params.source,
    };
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("rental_verifications")
      .upsert(insertPayload, { onConflict: "rental_id", ignoreDuplicates: true })
      .select("rental_id")
      .maybeSingle();
    if (insertError) {
      if (isMissingRelationError(insertError)) {
        logger.warn(
          "[rental-verify] rental_verifications table missing — run docs/crewDocs/rental-verifications-table-2026-10-17.sql; skipping verify request",
        );
        return { sent: false, reason: "table missing" };
      }
      throw insertError;
    }
    // ignoreDuplicates + select returns nothing when the row already existed.
    if (!inserted) {
      return { sent: false, reason: "verification already requested" };
    }

    // ── Notify both parties ──
    const usersMap = await loadUsersMap([
      operatorChatId,
      ownerChatId,
      snapshot.attribution.createdByChatId,
      snapshot.attribution.handedByChatId,
      snapshot.attribution.returnedByChatId,
    ]);
    const operatorLabel = labelFromUsersMap(usersMap, operatorChatId);
    const ownerLabel = labelFromUsersMap(usersMap, ownerChatId);

    const singleParty = !operatorChatId || operatorChatId === ownerChatId;
    const statusNote = verificationStatusNote({
      status: "pending",
      singleParty,
      operatorLabel,
      ownerLabel,
    });

    // ── Task 117: the operator's verified score (копилка) shown in the DM ──
    const operatorScore = await loadOperatorVerifiedScore(operatorChatId).catch(() => null);

    const summary = formatVerificationSummary({
      crewName,
      snapshot,
      usersMap,
      operatorChatId,
      ownerChatId,
      statusNote,
      operatorScore,
    });
    const keyboard = verificationKeyboard(rental.rental_id);

    const recipients = [...new Set([operatorChatId, ownerChatId].filter(Boolean) as string[])];
    for (const chatId of recipients) {
      try {
        // Task 117: bike photo first (separate message — sendPhoto captions
        // cap at 1024 chars, too tight for the rich formula text), then the
        // full summary. Photo failure is cosmetic — the summary must land.
        await sendVerificationBikePhoto(chatId, snapshot.bikePhotoUrl, snapshot.bikeName);
        // Task 123: the rental's own ДО/ПОСЛЕ state shot (one photo, see
        // sendVerificationStatePhoto) + photo counts live in the summary.
        await sendVerificationStatePhoto(chatId, snapshot.photos);
        await sendComplexMessage(chatId, summary, keyboard, { parseMode: "HTML", keyboardType: "inline" });
      } catch (e) {
        logger.warn(`[rental-verify] summary send failed for ${chatId} (rental ${rental.rental_id}):`, e);
      }
    }

    // ── VF-FIX 2026-10-18: cc the crew owner + admins ──
    // Boss: «upon closing rental notification for verification is sent to
    // crew owner, crew admins». Task 118 (boss: «show buttons to admin as
    // well»): the staff copy carries the SAME ✅/⚠️ keyboard — crew staff act
    // as «admin» (an admin ✅ stamps the administration's voice; the final
    // word stays with the owner party — task 120; ⚠️ joins the negotiation).
    try {
      const ccSent = await ccVerificationToCrewStaff({
        crewSlug,
        rentalId: rental.rental_id,
        summary,
        bikePhotoUrl: snapshot.bikePhotoUrl,
        statePhotos: snapshot.photos,
        keyboard: keyboard as unknown as InlineButton[][],
        exclude: [
          operatorChatId,
          ownerChatId,
          String(params.actorChatId || ""),
          snapshot.attribution.createdByChatId,
          snapshot.attribution.handedByChatId,
          snapshot.attribution.returnedByChatId,
        ],
      });
      if (ccSent > 0) logger.info(`[rental-verify] staff cc sent to ${ccSent} chat(s) for ${rental.rental_id}`);
    } catch (ccErr) {
      logger.warn("[rental-verify] staff cc failed (non-fatal):", ccErr);
    }

    logger.info(
      `[rental-verify] verification requested for ${rental.rental_id}: operator=${operatorChatId ?? "—"} owner=${ownerChatId ?? "—"} total=${snapshot.total}₽`,
    );
    return { sent: true };
  } catch (err) {
    logger.warn(`[rental-verify] requestRentalVerification failed for ${params.rentalId} (non-fatal):`, err);
    return { sent: false, reason: "exception" };
  }
}

// ── Task 117: operator score (копилка) + bike photo preview ────────────────

/**
 * The operator's «счёт» — sum of their CONFIRMED (verified) commissions.
 * The money game: every ✅✅ сверка drops its bonus into this piggy bank;
 * the running total is shown inside every verification DM (boss 2026-10-21:
 * «добавь счетчик текущего "счета"… показывай текущий "счет" в оповещении»).
 * Commission source = commissionOf (agreed negotiation split wins) — the
 * SAME money the payout hub and the profile strip count.
 */
export async function loadOperatorVerifiedScore(
  chatId: string | null | undefined,
): Promise<{ sum: number; count: number }> {
  const out = { sum: 0, count: 0 };
  const viewer = chatId ? String(chatId) : "";
  if (!viewer) return out;
  try {
    const { data: rows, error } = await supabaseAdmin
      .from("rental_verifications")
      .select("snapshot, negotiation, payout")
      .eq("operator_chat_id", viewer)
      .eq("status", "verified")
      .limit(1000);
    if (error) {
      if (!isMissingRelationError(error)) logger.warn("[rental-verify] score query failed:", error.message);
      return out;
    }
    for (const row of (rows || []) as PayoutSourceRowLike[]) {
      out.sum += commissionOf(row).amount;
      out.count += 1;
    }
  } catch (e) {
    logger.warn("[rental-verify] loadOperatorVerifiedScore failed (non-fatal):", e);
  }
  return out;
}

/** Minimal shape commissionOf needs (avoids importing the payout row type). */
interface PayoutSourceRowLike {
  snapshot?: unknown;
  negotiation?: unknown;
  payout?: unknown;
}

/**
 * Task 122 — lifetime verified count for ONE viewer (both party roles).
 * Feeds the 🏆 progress line («до „Безупречная десятка" ещё N сверк») in the
 * done-DM. Same head-count query grantVerificationAchievements uses.
 */
async function countVerifiedFor(chatId: string | null | undefined): Promise<number> {
  const viewer = chatId ? String(chatId) : "";
  if (!viewer) return 0;
  try {
    const { count, error } = await supabaseAdmin
      .from("rental_verifications")
      .select("rental_id", { count: "exact", head: true })
      .eq("status", "verified")
      .or(`operator_chat_id.eq.${viewer},owner_chat_id.eq.${viewer}`);
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

export interface NextVerificationPointer {
  rentalId: string;
  status: RentalVerificationStatus;
  operatorChatId: string | null;
  ownerChatId: string | null;
  bikeName: string;
  amountRub: number;
  /** Own crew of THAT row — the 👀 deeplink must use ITS bot (review #3). */
  crewSlug: string | null;
}

/**
 * Task 122 — the NEXT open сверка for this viewer: «notification can contain
 * quick "next" latest unverified rental to maybe look at» (boss 2026-10-21).
 * Party rows first, newest request wins (memory is freshest — the season
 * stats list makes the same choice). When the viewer has no personal open
 * rows but IS crew staff, fall back to the crew's newest open row: the owner
 * always gets a pointer, even for rentals where he is not the owner party.
 * Strictly non-fatal — any error → null (no pointer line).
 */
export async function findNextVerificationFor(params: {
  chatId: string;
  crewSlug: string | null | undefined;
  excludeRentalId?: string | null;
}): Promise<NextVerificationPointer | null> {
  const viewer = String(params.chatId || "");
  if (!viewer) return null;
  const exclude = params.excludeRentalId ? String(params.excludeRentalId) : null;
  const pick = (rows: any[] | null): NextVerificationPointer | null => {
    const row = (rows || [])[0] as any;
    if (!row?.rental_id) return null;
    const snap = (row.snapshot || {}) as Record<string, unknown>;
    const total = Number(snap.total);
    return {
      rentalId: String(row.rental_id),
      status: row.status as RentalVerificationStatus,
      operatorChatId: row.operator_chat_id ? String(row.operator_chat_id) : null,
      ownerChatId: row.owner_chat_id ? String(row.owner_chat_id) : null,
      bikeName: String(snap.bikeName || "аренда"),
      amountRub: Number.isFinite(total) && total > 0 ? total : 0,
      crewSlug: row.crew_slug ? String(row.crew_slug) : null,
    };
  };
  try {
    const baseSelect =
      "rental_id, status, operator_chat_id, owner_chat_id, crew_slug, requested_at, snapshot";
    const openStatuses = ["pending", "operator_confirmed", "owner_confirmed"] as const;
    // 1) Personal queue — rows where the viewer is a party.
    {
      let q = supabaseAdmin
        .from("rental_verifications")
        .select(baseSelect)
        .in("status", [...openStatuses])
        .or(`operator_chat_id.eq.${viewer},owner_chat_id.eq.${viewer}`)
        .order("requested_at", { ascending: false })
        .limit(1);
      if (exclude) q = q.neq("rental_id", exclude);
      const { data, error } = await q;
      if (!error) {
        const hit = pick(data);
        if (hit) return hit;
      } else if (isMissingRelationError(error)) {
        return null;
      } else {
        logger.warn("[rental-verify] next-pointer party query failed:", error.message);
      }
    }
    // 2) Crew-wide fallback for staff (owner sees the crew's queue).
    if (params.crewSlug) {
      const staff = await loadCrewStaffChatIds(params.crewSlug);
      if (staff.includes(viewer)) {
        const { data: crew } = await supabaseAdmin
          .from("crews")
          .select("id")
          .eq("slug", params.crewSlug)
          .maybeSingle();
        if (crew?.id) {
          let q2 = supabaseAdmin
            .from("rental_verifications")
            .select(baseSelect)
            .in("status", [...openStatuses])
            .eq("crew_id", crew.id)
            .order("requested_at", { ascending: false })
            .limit(1);
          if (exclude) q2 = q2.neq("rental_id", exclude);
          const { data: rows2, error: err2 } = await q2;
          if (!err2) return pick(rows2);
        }
      }
    }
  } catch (e) {
    logger.warn("[rental-verify] findNextVerificationFor failed (non-fatal):", e);
  }
  return null;
}

/**
 * Task 122 — the shared «verified» done-DM (both verify paths funnel here:
 * the plain ✅✅ and the accepted deal). Base text + the warm half:
 * ⚡️ speed flex (same 60-min window as verify_speedy), 🏆 explicit ladder to
 * the next verification achievement, a ✨ warm closer instead of a cold stop,
 * and the ⏭ NEXT open сверка pointer with a 👀 deeplink («notification can
 * contain quick "next" latest unverified rental to maybe look at» — boss
 * 2026-10-21). Every step per-recipient and strictly non-fatal.
 */
async function sendVerifiedDoneDms(params: {
  rentalId: string;
  crewSlug: string | null | undefined;
  requestedAtIso: string | null | undefined;
  verifiedAtIso: string | null | undefined;
  /** Full base text WITHOUT the warm half (may differ per recipient). */
  baseText: (chatId: string) => string;
  recipients: string[];
}): Promise<void> {
  const speedLine = verificationSpeedLine(params.requestedAtIso, params.verifiedAtIso);
  const warm = warmCloserLine(params.rentalId);
  let botUsername: string | null = null;
  try {
    const { resolveCrewBotUsername } = await import("@/app/franchize/lib/crew-bot");
    botUsername = await resolveCrewBotUsername(params.crewSlug || null);
  } catch {
    botUsername = null;
  }
  const { buildTelegramAppLink } = await import("@/lib/wall-deeplink");
  for (const chatId of params.recipients) {
    try {
      const parts: string[] = [params.baseText(chatId)];
      if (speedLine) parts.push(`\n\n${speedLine}`);
      const progress = verifyProgressLine(await countVerifiedFor(chatId).catch(() => 0));
      if (progress) parts.push(`\n${progress}`);
      // Task 124 — the 🕶️ no-problemo streak rides with the celebration
      // (quiet below 3; at 13 the «13 no problemo подряд» badge lands too).
      const streakLine = streakProgressLine(await loadNoProblemoStreakFor(chatId).catch(() => 0));
      if (streakLine) parts.push(`\n${streakLine}`);
      parts.push(`\n✨ ${warm}`);
      const next = await findNextVerificationFor({
        chatId,
        crewSlug: params.crewSlug || null,
        excludeRentalId: params.rentalId,
      }).catch(() => null);
      const keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];
      if (next) {
        parts.push(
          `\n\n${nextUpLine({
            bikeName: next.bikeName,
            amountRub: next.amountRub,
            status: next.status,
            viewerIsOperator: !!next.operatorChatId && next.operatorChatId === chatId,
            viewerIsOwner: !!next.ownerChatId && next.ownerChatId === chatId,
          })}`,
        );
        if (botUsername) {
          // Review #3: a cross-crew pointer must deeplink through THAT crew's
          // bot (startapp=rental_… resolves per-crew bot), falling back to the
          // current bot when the pointer's crew has no bot of its own.
          let linkBot = botUsername;
          if (next.crewSlug && next.crewSlug !== (params.crewSlug || null)) {
            try {
              const { resolveCrewBotUsername } = await import("@/app/franchize/lib/crew-bot");
              linkBot = (await resolveCrewBotUsername(next.crewSlug)) || botUsername;
            } catch {
              linkBot = botUsername;
            }
          }
          const bikeLabel = next.bikeName.length > 24 ? `${next.bikeName.slice(0, 23)}…` : next.bikeName;
          keyboard.push([
            {
              text: `👀 Следующая: ${bikeLabel}`,
              url: buildTelegramAppLink(linkBot, `rental_${next.rentalId}`),
            },
          ]);
        }
      }
      // Task 107: every «verified» DM still carries the payout-hub entry —
      // the money game continues after the confirm.
      keyboard.push([{ text: "💰 Мои выплаты", callback_data: "payo_hub_0" }]);
      await sendComplexMessage(chatId, parts.join(""), keyboard, {
        parseMode: "HTML",
        keyboardType: "inline",
      });
    } catch {
      /* non-fatal */
    }
  }
}

/**
 * Bike preview photo before the verification summary (task 117). A separate
 * plain message — sendPhoto captions cap at 1024 chars, and the rich summary
 * needs every byte of the 4096 text budget. Any failure is cosmetic: the
 * summary message follows and must never be blocked by the photo.
 */
async function sendVerificationBikePhoto(
  chatId: string,
  photoUrl: string | null | undefined,
  bikeName: string,
): Promise<void> {
  const url = (photoUrl || "").trim();
  if (!url || !/^https:\/\//i.test(url)) return;
  try {
    const payload = {
      photo: url,
      caption: bikeName
        ? `🛵 ${escapeVerifyHtml(bikeName)} — сверка этой аренды 👇`
        : `🛵 Фото байка — сверка ниже 👇`,
    };
    const res = await telegramDeliver("sendPhoto", chatId, payload);
    if (res?.ok === false) {
      logger.warn(`[rental-verify] bike photo rejected for ${chatId}: ${res.error || "unknown"}`);
    }
  } catch (e) {
    logger.warn(`[rental-verify] bike photo send failed for ${chatId} (cosmetic):`, e);
  }
}

/**
 * Task 123 — the rental's own «ДО/ПОСЛЕ» state photo, right after the bike
 * preview (boss: «besides picture of the bike — send photos before/after
 * presence»). ONE extra message per recipient, deliberately: the «ПОСЛЕ»
 * shot is the one a сверка actually needs (state at return), «ДО» rides as
 * the fallback when no return photo exists; both counts still show in the
 * summary text. Private-bucket paths are signed HERE (send time, 1h TTL) —
 * frozen paths never go stale. Cosmetic-only — never blocks the summary.
 */
async function signedStatePhoto(
  photos: RentalVerificationSnapshot["photos"],
): Promise<{ url: string; caption: string } | null> {
  const attempts: Array<{ url?: string | null; path?: string | null; caption: string }> = [
    { url: photos?.afterUrl, path: photos?.afterPath, caption: "📸 ПОСЛЕ — состояние при возврате" },
    { url: photos?.beforeUrl, path: photos?.beforePath, caption: "📸 ДО — состояние при выдаче" },
  ];
  for (const a of attempts) {
    // 1) a public metadata URL (start/end_photo_url) — usable as-is
    const url = (a.url || "").trim();
    if (url && /^https:\/\//i.test(url)) return { url, caption: a.caption };
    // 2) the durable storage path — mint a short-lived signed link
    const path = (a.path || "").trim();
    if (path) {
      try {
        const { data, error } = await supabaseAdmin.storage
          .from("rental-photos")
          .createSignedUrl(path, 3600);
        const signed = data?.signedUrl;
        if (!error && signed && /^https?:\/\//i.test(signed)) return { url: signed, caption: a.caption };
        logger.warn(`[rental-verify] state photo sign failed for ${path}: ${error?.message || "no url"}`);
      } catch (e) {
        logger.warn("[rental-verify] state photo sign threw (cosmetic):", e);
      }
    }
  }
  return null;
}

async function sendVerificationStatePhoto(
  chatId: string,
  photos: RentalVerificationSnapshot["photos"],
): Promise<void> {
  const pick = await signedStatePhoto(photos);
  if (!pick) return;
  try {
    const res = await telegramDeliver("sendPhoto", chatId, {
      photo: pick.url,
      caption: pick.caption,
    });
    if (res?.ok === false) {
      logger.warn(`[rental-verify] state photo rejected for ${chatId}: ${res.error || "unknown"}`);
    }
  } catch (e) {
    logger.warn(`[rental-verify] state photo send failed for ${chatId} (cosmetic):`, e);
  }
}

// ── VF-FIX 2026-10-18: staff cc helper ─────────────────────────────────────

/**
 * Task 118 — chat ids of the CREW STAFF: crew owner + admins/co_owner
 * (active). They act as «admin» in the verification machine (same ✅/⚠️
 * buttons as the parties). Task 120 semantics: an admin ✅ stamps the
 * administration's voice — the FINAL word always stays with the owner party.
 * Deliberately NOT resolveLeadNotifyRecipients — that one also appends the
 * global ADMIN_CHAT_ID, which is a server-level operator, not this crew's
 * supervisor. Never throws — worst case an empty list (then admins simply
 * have no buttons).
 */
export async function loadCrewStaffChatIds(crewSlug: string | null | undefined): Promise<string[]> {
  if (!crewSlug) return [];
  try {
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", crewSlug)
      .maybeSingle();
    if (!crew) return [];
    const ids = new Set<string>();
    if (crew.owner_id) ids.add(String(crew.owner_id));
    if (crew.id) {
      const { data: admins } = await supabaseAdmin
        .from("crew_members")
        .select("user_id, role, membership_status")
        .eq("crew_id", crew.id)
        .in("role", ["owner", "admin", "co_owner"])
        .eq("membership_status", "active");
      for (const a of admins || []) {
        if (a?.user_id) ids.add(String(a.user_id));
      }
    }
    return [...ids];
  } catch (e) {
    logger.warn("[rental-verify] loadCrewStaffChatIds failed (non-fatal):", e);
    return [];
  }
}

/**
 * Read-only copy of the verification summary to crew owner + admins
 * (resolveLeadNotifyRecipients, no member fanout), deduped against the
 * verification parties / actor / attribution chats.
 * Task 118 (boss: «show buttons to admin as well»): the copy now carries the
 * SAME ✅/⚠️ keyboard — staff act as «admin» in the state machine (an admin ✅
 * stamps the administration's voice, the owner party's ✅ stays mandatory-
 * final per task 120; ⚠️ opens the dispute editor). Never throws.
 */
export async function ccVerificationToCrewStaff(params: {
  crewSlug: string | null;
  rentalId: string;
  summary: string;
  /** Task 117: bike photo preview sent right before the copy (cosmetic). */
  bikePhotoUrl?: string | null;
  /** Task 123: the rental's own ДО/ПОСЛЕ state shot for the staff copy. */
  statePhotos?: RentalVerificationSnapshot["photos"];
  exclude: Array<string | null | undefined>;
  /** Task 118: the ✅/⚠️ keyboard for staff (they are first-class actors now). */
  keyboard?: InlineButton[][];
}): Promise<number> {
  if (!params.crewSlug) return 0;
  const { resolveLeadNotifyRecipients } = await import("@/app/franchize/lib/new-lead-notify");
  const { telegramDeliver } = await import("@/lib/telegram-transport");
  const { buildTelegramAppLink } = await import("@/lib/wall-deeplink");
  const { resolveCrewBotUsername } = await import("@/app/franchize/lib/crew-bot");

  const excludeSet = new Set(params.exclude.filter(Boolean).map(String));
  const targets = (await resolveLeadNotifyRecipients(params.crewSlug, { includeMembers: false }))
    .map((id) => (id == null ? null : String(id)))
    .filter((id): id is string => !!id && !excludeSet.has(id));
  if (targets.length === 0) return 0;

  let botUsername: string | null = null;
  try {
    botUsername = await resolveCrewBotUsername(params.crewSlug);
  } catch {
    // deeplink — best effort
  }

  const withKeyboard = (params.keyboard || []).length > 0;
  const text = [
    params.summary,
    "",
    withKeyboard
      ? "📋 Копия для команды — кнопки ✅/⚠️ работают у оператора, владельца и админов экипажа (админ ✅ фиксирует отметку администрации — финальное подтверждение всегда за владельцем)."
      : "📋 Копия для команды — кнопки ✅/⚠️ у оператора и владельца.",
    "Подтвердить сверку вручную можно в приложении: аналитика аренд → карточка аренды.",
  ].join("\n");

  // URL buttons are not InlineButton (callback_data) — the deeplink row rides
  // along with the ✅/⚠️ keyboard, so the payload type stays loose here.
  type CcButton = { text: string; callback_data?: string; url?: string };
  const rows: CcButton[][] = [
    ...(params.keyboard || []),
    ...(botUsername
      ? [[{ text: "🔑 Открыть аренду", url: buildTelegramAppLink(botUsername, `rental_${params.rentalId}`) }]]
      : []),
  ];
  const payload: Record<string, unknown> = {
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (rows.length > 0) {
    payload.reply_markup = { inline_keyboard: rows };
  }

  let sent = 0;
  await Promise.allSettled(
    targets.map(async (chatId) => {
      try {
        // Task 117: the same bike preview the parties got (cosmetic — never
        // counted as a delivery, never blocks the text copy).
        await sendVerificationBikePhoto(chatId, params.bikePhotoUrl, "");
        // Task 123: the ДО/ПОСЛЕ state shot rides along for staff too.
        await sendVerificationStatePhoto(chatId, params.statePhotos);
      } catch {
        /* cosmetic only */
      }
      try {
        const res = await telegramDeliver("sendMessage", chatId, payload);
        if (res?.ok !== false) sent += 1;
      } catch (e) {
        logger.warn(`[rental-verify] staff cc send failed for ${chatId} (rental ${params.rentalId}):`, e);
      }
    }),
  );
  return sent;
}

/**
 * Task 118 — lightweight staff note (proposal sent / accepted / declined /
 * withdrawn / verified / disputed): plain text, no keyboard, deduped against
 * the directly-notified chats. The boss watches negotiations without being
 * dragged into every DM thread. Never throws.
 */
export async function ccVerificationNoteToCrewStaff(params: {
  crewSlug: string | null;
  rentalId: string;
  text: string;
  /** Chats that already get the news directly (parties/proposer) — deduped out. */
  exclude: Array<string | null | undefined>;
}): Promise<number> {
  if (!params.crewSlug) return 0;
  try {
    const { resolveLeadNotifyRecipients } = await import("@/app/franchize/lib/new-lead-notify");
    const { telegramDeliver } = await import("@/lib/telegram-transport");
    const excludeSet = new Set(params.exclude.filter(Boolean).map(String));
    const targets = (await resolveLeadNotifyRecipients(params.crewSlug, { includeMembers: false }))
      .map((id) => (id == null ? null : String(id)))
      .filter((id): id is string => !!id && !excludeSet.has(id));
    if (targets.length === 0) return 0;
    let sent = 0;
    await Promise.allSettled(
      targets.map(async (chatId) => {
        try {
          const res = await telegramDeliver("sendMessage", chatId, {
            text: params.text,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          });
          if (res?.ok !== false) sent += 1;
        } catch (e) {
          logger.warn(`[rental-verify] staff note send failed for ${chatId} (rental ${params.rentalId}):`, e);
        }
      }),
    );
    return sent;
  } catch (e) {
    logger.warn("[rental-verify] ccVerificationNoteToCrewStaff failed (non-fatal):", e);
    return 0;
  }
}

// ── Callback handling (Telegram buttons) ─────────────────────────────────────

export async function answerCallback(callbackQueryId: string, text: string): Promise<void> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;
    await fetch(
      `https://api.telegram.org/bot${token}/answerCallbackQuery?callback_query_id=${encodeURIComponent(callbackQueryId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      },
    );
  } catch (e) {
    logger.warn("[rental-verify] answerCallbackQuery failed:", e);
  }
}

// ── Self-heal: сверка for an already-closed rental ──────────────────────────
// Boss 2026-10-20: «we should be able to "сверять" already closed rentals».
// Old messages (pre-system closures, or rows removed by the svc/equipment
// cleanup) carry ✅/⚠️/hub buttons that used to dead-end with «Сверка не
// найдена (аренда закрыта до ввода сверки)». Instead of a dead end the tap
// now re-creates the сверка on the fly (requestRentalVerification — frozen
// snapshot + DMs to both parties + staff cc) and the game continues.

/**
 * A tap hit a rental with NO verification row: for a completed regular rental
 * create the сверка row right now (same machine as a fresh closure). Returns
 * `healed` on success; otherwise `message` is a ready-to-show refusal (null →
 * caller falls back to its classic dead-end text). Service/equipment docs and
 * non-closed rentals are deliberately NOT converted.
 */
export async function selfHealVerificationRow(
  rentalId: string,
  actorChatId: string,
): Promise<{ healed: boolean; message?: string | null }> {
  try {
    const { data: rentalRow } = await supabaseAdmin
      .from("rentals")
      .select("status")
      .eq("rental_id", rentalId)
      .maybeSingle();
    if (!rentalRow) return { healed: false, message: "Аренда не найдена." };
    if ((rentalRow as any).status !== "completed") {
      // An active/cancelled rental has nothing to сверять yet — classic text.
      return { healed: false, message: null };
    }
    const res = await requestRentalVerification({
      rentalId,
      actorChatId,
      source: "self-heal",
    });
    if (res.sent) return { healed: true };
    return { healed: false, message: selfHealErrorText(res.reason) };
  } catch (e) {
    logger.warn(`[rental-verify] self-heal failed for ${rentalId}:`, e);
    return { healed: false, message: null };
  }
}

/**
 * Entry point from command-handler.ts (prefix `vrf_`):
 *   vrf_ok_<rentalId>   — «✅ Подтверждаю»
 *   vrf_dis_<rentalId>  — «⚠️ Оспорить»
 */
export async function handleRentalVerifyCallback(params: {
  data: string;
  chatId: string;
  callbackQueryId: string;
  /** For stripping the buttons from the tapped message after the decision. */
  messageId?: number;
}): Promise<boolean> {
  const data = params.data || "";
  const ok = data.startsWith("vrf_ok_");
  const dispute = data.startsWith("vrf_dis_");
  if (!ok && !dispute) return false;
  const rentalId = data.replace(ok ? "vrf_ok_" : "vrf_dis_", "").trim();
  if (!rentalId) {
    await answerCallback(params.callbackQueryId, "Не распознал аренду.");
    return true;
  }

  try {
    const { data: row, error } = await supabaseAdmin
      .from("rental_verifications")
      .select("*")
      .eq("rental_id", rentalId)
      .maybeSingle();
    if (error && !isMissingRelationError(error)) throw error;

    let current: RentalVerificationRow | null = (row as RentalVerificationRow) || null;
    if (!current) {
      // No row (old DM before the verification system, or the row was cleaned
      // up later) → try to re-create the сверка instead of dead-ending; a
      // healed row joins the normal state machine below.
      const heal = await selfHealVerificationRow(rentalId, String(params.chatId));
      if (!heal.healed) {
        await answerCallback(params.callbackQueryId, heal.message || "Сверка не найдена (аренда закрыта до ввода сверки).");
        return true;
      }
      const { data: fresh, error: freshError } = await supabaseAdmin
        .from("rental_verifications")
        .select("*")
        .eq("rental_id", rentalId)
        .maybeSingle();
      if (freshError && !isMissingRelationError(freshError)) throw freshError;
      if (!fresh) {
        await answerCallback(params.callbackQueryId, "Сверка создана, но не сохранилась — попробуйте ещё раз.");
        return true;
      }
      current = fresh as RentalVerificationRow;
      await answerCallback(params.callbackQueryId, "Сверка не была заведена — создал заново ✅");
    }
    // ── TASK 102 race hardening ──────────────────────────────────────────────
    // Both parties can tap ✅ within the same second: two callbacks each read
    // `pending`, each computes its own next state, and the SECOND write used
    // to blindly overwrite the first — final state stuck at operator_confirmed
    // / owner_confirmed while BOTH humans had confirmed (buttons already
    // stripped → dead end). The update is now a conditional (optimistic-lock)
    // write: it only lands while the row still has the status we read. When a
    // parallel writer won the race we re-read and re-apply against the fresh
    // row — the state machine is idempotent, so the loser converges to
    // «verified» instead of clobbering it.
    // Task 118: crew staff (owner/admin/co_owner of the CREW) act as «admin» —
    // an admin ✅ stamps the administration's voice (final only when the owner
    // party has already confirmed — task 120), an admin ⚠️ disputes + opens
    // the editor.
    let current_ = current;
    const staffChatIds = await loadCrewStaffChatIds(current_.crew_slug || null);
    let result = applyVerificationAction(current_, {
      action: ok ? "confirm" : "dispute",
      chatId: String(params.chatId),
      nowIso: new Date().toISOString(),
      adminChatIds: staffChatIds,
    });
    if (!result.row) {
      await answerCallback(params.callbackQueryId, result.error || "Действие недоступно.");
      return true;
    }

    let writeLanded = false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { data: written, error: updateError } = await supabaseAdmin
        .from("rental_verifications")
        .update({
          status: result.row.status,
          operator_confirmed_at: result.row.operator_confirmed_at,
          owner_confirmed_at: result.row.owner_confirmed_at,
          verified_at: result.row.verified_at,
          disputed_by: result.row.disputed_by,
          dispute_reason: result.row.dispute_reason,
          updated_at: new Date().toISOString(),
        })
        .eq("rental_id", rentalId)
        // Optimistic lock: only write while nobody else changed the status
        // since our read. (verified is terminal — nobody can race past it.)
        .eq("status", current_.status)
        .select("status")
        .maybeSingle();
      if (updateError) throw updateError;
      if (written) {
        writeLanded = true;
        break;
      }
      // Lost the race — re-read the row someone else just advanced and apply
      // our action to THAT state instead.
      const { data: fresh, error: rereadError } = await supabaseAdmin
        .from("rental_verifications")
        .select("*")
        .eq("rental_id", rentalId)
        .maybeSingle();
      if (rereadError) throw rereadError;
      if (!fresh) break;
      current_ = fresh as RentalVerificationRow;
      result = applyVerificationAction(current_, {
        action: ok ? "confirm" : "dispute",
        chatId: String(params.chatId),
        nowIso: new Date().toISOString(),
        adminChatIds: staffChatIds,
      });
      if (!result.row) {
        await answerCallback(params.callbackQueryId, result.error || "Действие недоступно.");
        return true;
      }
    }
    if (!writeLanded) {
      await answerCallback(params.callbackQueryId, "Не удалось сохранить — попробуйте ещё раз.");
      return true;
    }

    // Best-effort: strip the buttons from the tapped message so the decision
    // feels final (cosmetic — failures are ignored).
    if (params.messageId) {
      try {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (token) {
          await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: params.chatId,
              message_id: params.messageId,
              reply_markup: { inline_keyboard: [] },
            }),
          });
        }
      } catch {
        /* cosmetic only */
      }
    }

    const usersMap = await loadUsersMap([current.operator_chat_id, current.owner_chat_id]);
    const snapshot = current.snapshot as RentalVerificationSnapshot;

    if (result.effect === "verified") {
      await answerCallback(params.callbackQueryId, "✅ Подтверждено — спасибо!");
      // Task 118/120: an admin ✅ (when it CLOSES the row — the owner party
      // has already confirmed) stamps WHO closed it into the negotiation
      // jsonb (audit trail) and word the done-text accordingly.
      const isAdminVerify = result.actor === "admin";
      if (isAdminVerify) {
        try {
          const negoNow = parseNegotiation((current_ as any).negotiation);
          await supabaseAdmin
            .from("rental_verifications")
            .update({
              negotiation: { ...negoNow, adminVerified: { by: String(params.chatId), at: new Date().toISOString() } },
              updated_at: new Date().toISOString(),
            })
            .eq("rental_id", rentalId);
        } catch (stampErr) {
          logger.warn(`[rental-verify] adminVerified stamp failed for ${rentalId} (non-fatal):`, stampErr);
        }
      }
      // Task 117: fresh operator score AFTER this сверка landed — the piggy
      // bank grew right now, show it (+this commission) instead of a stale
      // number. Falls back to «без счёта» on any failure (never blocks).
      const freshScore = await loadOperatorVerifiedScore(current_.operator_chat_id).catch(() => null);
      const { amount: confirmedAmount } = commissionOf(current_);
      const doneText = [
        isAdminVerify ? `🤝 <b>Расчёт подтверждён владельцем и администрацией</b>` : `🤝 <b>Расчёт подтверждён обеими сторонами</b>`,
        ``,
        `🛵 ${escapeVerifyHtml(snapshot?.bikeName || "аренда")} · комиссия ${formatRubVerify(Number(snapshot?.total) || 0)}`,
        isAdminVerify
          ? `Владелец подтвердил, админ экипажа ${escapeVerifyHtml(labelFromUsersMap(usersMap, String(params.chatId)))} закрыл сверку — аренда помечена как <b>проверенная</b> ✅.`
          : `Аренда помечена как <b>проверенная</b> ✅ — в конце месяца она уже не требует разбора.`,
      ].join("\n");
      // Task 106: when the row carries an AGREED (corrected) split, both
      // parties get the honest final numbers instead of the frozen ones.
      const agreedNego = parseNegotiation((current_ as any).negotiation);
      const scoreTail =
        freshScore && current_.operator_chat_id
          ? `\n\n🏅 Счёт ${escapeVerifyHtml(labelFromUsersMap(usersMap, current_.operator_chat_id))}: <b>${formatRubVerify(freshScore.sum)}</b> (${freshScore.count} ар.) — +${formatRubVerify(confirmedAmount)} за эту аренду 💰`
          : "";
      const baseDone = agreedNego.agreed
        ? formatDealDoneText({
            snapshot: snapshot || {},
            agreedSplit: agreedNego.agreed.split,
            proposerLabel: labelFromUsersMap(usersMap, agreedNego.agreed.proposedBy),
            acceptorLabel: labelFromUsersMap(usersMap, agreedNego.agreed.acceptedBy),
          })
        : doneText;
      // Task 122: the warm half (speed / ladder / closer / next-up) is shared
      // with the deal-accept path — one funnel, same game feel everywhere.
      const staffNoteText = baseDone + scoreTail;
      const verifiedRecipients = [...new Set([current.operator_chat_id, current.owner_chat_id].filter(Boolean) as string[])];
      await sendVerifiedDoneDms({
        rentalId,
        crewSlug: current.crew_slug || null,
        requestedAtIso: current_.requested_at,
        verifiedAtIso: current_.verified_at,
        baseText: () =>
          // Review #2: restore the pre-122 behavior — BOTH parties (and the
          // staff note) see the operator's 🏅 score tail, same as the old
          // doneFinal. The scoreTail is "" when there is no operator party.
          baseDone + scoreTail,
        recipients: verifiedRecipients,
      });
      // Task 118: staff (who were not parties) see the outcome too — plain note.
      await ccVerificationNoteToCrewStaff({
        crewSlug: current.crew_slug || null,
        rentalId,
        text: staffNoteText,
        exclude: [...verifiedRecipients, isAdminVerify ? String(params.chatId) : ""],
      });
      await grantVerificationAchievements(current_, { speedy: isSpeedyConfirm(current_) });
      await grantNegotiationAchievements(current_);
      return true;
    }

    if (result.effect === "disputed") {
      await answerCallback(params.callbackQueryId, "Отмечено как спор — сверьтесь вручную.");
      const actorLabel = labelFromUsersMap(usersMap, String(params.chatId));
      const disputeText = [
        `⚠️ <b>Расчёт оспорен</b>`,
        ``,
        `${escapeVerifyHtml(actorLabel)}${result.actor === "admin" ? " (администратор экипажа)" : ""} оспорил сверку по аренде ${escapeVerifyHtml(snapshot?.bikeName || "")} (комиссия ${formatRubVerify(Number(snapshot?.total) || 0)}).`,
        `Аренда помечена как «спор» в ЗП-списках — разберитесь лично и закройте вопрос до конца месяца.`,
      ].join("\n");
      const disputeRecipients = [...new Set([current.operator_chat_id, current.owner_chat_id].filter(Boolean) as string[])];
      for (const chatId of disputeRecipients) {
        if (chatId === String(params.chatId)) continue;
        try {
          await sendComplexMessage(chatId, disputeText, [], { parseMode: "HTML" });
        } catch {
          /* non-fatal */
        }
      }
      // Task 118: staff see the dispute too — plain note (never blocks).
      await ccVerificationNoteToCrewStaff({
        crewSlug: current.crew_slug || null,
        rentalId,
        text: disputeText,
        exclude: [...disputeRecipients, String(params.chatId)],
      });
      // Task 106: the dispute is no longer a dead end — the disputant gets a
      // live split editor right away (two-party rows only; degrade silently
      // when the negotiation column is not applied yet). Task 118: admins
      // (crew staff) get the same editor and join as a third voice.
      await openDisputeEditorAfterDispute(rentalId, current_, String(params.chatId), result.actor as "operator" | "owner" | "admin");
      return true;
    }

    // Task 120: admin ✅ recorded but NOT final — the crew owner's
    // confirmation is always mandatory. Nudge the owner party with a fresh
    // keyboard and tell the staff what the state now is.
    if (result.effect === "admin_awaiting_owner") {
      await answerCallback(params.callbackQueryId, "🛡 Отмечено — теперь нужно ✅ владельца.");
      const adminLabel = labelFromUsersMap(usersMap, String(params.chatId));
      try {
        const negoNow = parseNegotiation((current_ as any).negotiation);
        await supabaseAdmin
          .from("rental_verifications")
          .update({
            negotiation: { ...negoNow, adminVerified: { by: String(params.chatId), at: new Date().toISOString() } },
            updated_at: new Date().toISOString(),
          })
          .eq("rental_id", rentalId);
      } catch (stampErr) {
        logger.warn(`[rental-verify] adminVerified (awaiting) stamp failed for ${rentalId} (non-fatal):`, stampErr);
      }
      const ownerChatId = current_.owner_chat_id ? String(current_.owner_chat_id) : null;
      if (ownerChatId && ownerChatId !== String(params.chatId)) {
        const nudge = [
          `🛡 <b>Администрация сверила расчёт</b>`,
          ``,
          `${escapeVerifyHtml(adminLabel)} (админ экипажа) подтвердил сверку по аренде ${escapeVerifyHtml(snapshot?.bikeName || "")} (комиссия ${formatRubVerify(Number(snapshot?.total) || 0)}).`,
          `Финальное подтверждение всегда за владельцем — осталось ваше ✅:`,
        ].join("\n");
        try {
          await sendComplexMessage(ownerChatId, nudge, verificationKeyboard(rentalId), {
            parseMode: "HTML",
            keyboardType: "inline",
          });
        } catch {
          /* non-fatal */
        }
      }
      // Staff visibility (the admin tapper + parties already know).
      await ccVerificationNoteToCrewStaff({
        crewSlug: current_.crew_slug || null,
        rentalId,
        text: `🛡 ${escapeVerifyHtml(adminLabel)} (админ) подтвердил сверку по аренде ${escapeVerifyHtml(snapshot?.bikeName || "")} — ждём подтверждение владельца (комиссия ${formatRubVerify(Number(snapshot?.total) || 0)}).`,
        exclude: [ownerChatId || "", String(params.chatId)],
      });
      return true;
    }

    // wait_other_party — nudge the other side with a fresh keyboard.
    const otherChatId = result.actor === "operator" ? current.owner_chat_id : current.operator_chat_id;
    await answerCallback(params.callbackQueryId, "Принято ✅ Ждём вторую сторону.");
    if (otherChatId) {
      const actorLabel = labelFromUsersMap(usersMap, String(params.chatId));
      const nudge = [
        `✅ ${escapeVerifyHtml(actorLabel)} подтвердил расчёт по аренде ${escapeVerifyHtml(snapshot?.bikeName || "")} (комиссия ${formatRubVerify(Number(snapshot?.total) || 0)}).`,
        `Осталось ваше подтверждение:`,
      ].join("\n");
      try {
        await sendComplexMessage(otherChatId, nudge, verificationKeyboard(rentalId), {
          parseMode: "HTML",
          keyboardType: "inline",
        });
      } catch {
        /* non-fatal */
      }
    }
    return true;
  } catch (err) {
    logger.warn(`[rental-verify] callback failed for ${rentalId}:`, err);
    await answerCallback(params.callbackQueryId, "Ошибка сверки — попробуйте ещё раз.");
    return true;
  }
}

// ── Task 106: NEGOTIATION server half («дил») ────────────────────────────────
// The dispute editor + proposal flow. All money-sensitive transitions still
// go through applyVerificationAction (the task-101/102 state machine); the
// negotiation jsonb only carries the DRAFT / OPEN proposal / AGREED split.

/** True editMessageText (the shared editMessage deletes+resends — flickers). */
export async function editTelegramMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
  buttons: InlineButton[][] = [],
): Promise<boolean> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return false;
    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "HTML",
        ...(buttons.length ? { reply_markup: { inline_keyboard: buttons } } : { reply_markup: { inline_keyboard: [] } }),
      }),
    });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    // «message is not modified» — the same content; harmless, counts as ok.
    if (json && !json.ok && /message is not modified/i.test(json.description || "")) return true;
    return !!(json && json.ok);
  } catch (e) {
    logger.warn("[rental-verify] editMessageText failed:", e);
    return false;
  }
}

/** Render-or-send: edit the tapped editor message, fall back to a fresh DM. */
async function renderEditorMessage(
  chatId: string,
  messageId: number | undefined,
  text: string,
  buttons: InlineButton[][],
): Promise<void> {
  if (messageId && (await editTelegramMessageText(chatId, messageId, text, buttons))) return;
  try {
    await sendComplexMessage(chatId, text, buttons, { parseMode: "HTML", keyboardType: "inline" });
  } catch (e) {
    logger.warn(`[rental-verify] editor render failed for ${chatId}:`, e);
  }
}

/**
 * After a dispute lands, open the split editor for the disputant (new DM).
 * Pure negotiation — the row was already written by the caller; here we only
 * attach a draft so the first render shows the frozen numbers.
 * Task 118: the disputant may be a crew admin (role «admin») — same editor.
 */
async function openDisputeEditorAfterDispute(
  rentalId: string,
  row: RentalVerificationRow,
  chatId: string,
  role: "operator" | "owner" | "admin",
): Promise<void> {
  try {
    const singleParty = !row.operator_chat_id || row.operator_chat_id === row.owner_chat_id;
    if (singleParty) return; // no second human — nothing to negotiate with
    const original = snapshotSplitOf(row.snapshot as Partial<RentalVerificationSnapshot>);
    const nego = startDraft(parseNegotiation((row as any).negotiation), chatId, role, original);
    const { error } = await supabaseAdmin
      .from("rental_verifications")
      .update({ negotiation: nego, updated_at: new Date().toISOString() })
      .eq("rental_id", rentalId);
    if (error) {
      if (isMissingNegotiationError(error)) {
        logger.warn("[rental-verify] negotiation column missing — editor skipped (apply rental-verifications-negotiation SQL)");
        return;
      }
      throw error;
    }
    const usersMap = await loadUsersMap([chatId]);
    const text = [
      `⚠️ Расчёт оспорен. Поправьте числа прямо здесь и отправьте предложение второй стороне —`,
      `или подтвердите, если передумали.`,
      ``,
      formatDisputeEditor({
        snapshot: row.snapshot as Partial<RentalVerificationSnapshot>,
        draft: original,
        actorLabel: labelFromUsersMap(usersMap, chatId),
      }),
    ].join("\n");
    try {
      await sendComplexMessage(chatId, text, disputeEditorKeyboard(rentalId, original, original), {
        parseMode: "HTML",
        keyboardType: "inline",
      });
    } catch {
      /* non-fatal */
    }
  } catch (e) {
    logger.warn(`[rental-verify] openDisputeEditorAfterDispute failed for ${rentalId} (non-fatal):`, e);
  }
}

/**
 * Entry point from command-handler.ts (prefix `vrfp_`): the dispute editor
 * stepper + the proposal answer buttons. Every path answers the callback.
 * Returns false for foreign data so the router can fall through.
 */
export async function handleRentalVerifyProposalCallback(params: {
  data: string;
  chatId: string;
  callbackQueryId: string;
  messageId?: number;
}): Promise<boolean> {
  const parsed = parseProposalCallback(params.data || "");
  if (!parsed) return false;
  const { rentalId } = parsed;
  try {
    const { data: row, error } = await supabaseAdmin
      .from("rental_verifications")
      .select("*")
      .eq("rental_id", rentalId)
      .maybeSingle();
    if (error && !isMissingRelationError(error)) throw error;
    if (!row) {
      await answerCallback(params.callbackQueryId, "Сверка не найдена.");
      return true;
    }
    const current = row as RentalVerificationRow;
    const chatId = String(params.chatId);
    // Task 118: parties act as operator/owner; crew staff (owner/admin/co_owner
    // of the crew) act as «admin» — the editor, proposals and answers all work.
    const staffChatIds = await loadCrewStaffChatIds(current.crew_slug || null);
    const role = resolveVerificationRole(current, chatId, staffChatIds);
    if (!role) {
      await answerCallback(params.callbackQueryId, "Вы не участник сверки по этой аренде.");
      return true;
    }
    const singleParty = !current.operator_chat_id || current.operator_chat_id === current.owner_chat_id;
    if (singleParty) {
      await answerCallback(params.callbackQueryId, "Вторая сторона отсутствует — расчёт подтверждается одним ✅.");
      return true;
    }
    const original = snapshotSplitOf(current.snapshot as Partial<RentalVerificationSnapshot>);
    let nego = parseNegotiation((current as any).negotiation);
    const usersMap = await loadUsersMap([current.operator_chat_id, current.owner_chat_id, chatId]);
    const actorLabel = labelFromUsersMap(usersMap, chatId);

    // Draft guard: view/part/adjust silently (re)create the actor's draft.
    // Task 118: a fresh editor for the PROPOSER prefills from his own open
    // proposal (the edit-after-send loop), everyone else starts from frozen.
    const ensureDraft = (): void => {
      if (!nego.draft || nego.draft.by !== chatId) {
        const prefill = nego.open && nego.open.by === chatId ? nego.open.split : undefined;
        nego = startDraft(nego, chatId, role, original, prefill);
      }
    };

    /** Persist negotiation (degrades to a callback error when column missing). */
    const saveNego = async (next: NegotiationState, extra: Record<string, unknown> = {}): Promise<boolean> => {
      const { error: upErr } = await supabaseAdmin
        .from("rental_verifications")
        .update({ negotiation: next, updated_at: new Date().toISOString(), ...extra })
        .eq("rental_id", rentalId);
      if (upErr) {
        if (isMissingNegotiationError(upErr)) {
          await answerCallback(params.callbackQueryId, "Редактор недоступен — примените SQL (rental-verifications-negotiation).");
          return false;
        }
        throw upErr;
      }
      return true;
    };

    switch (parsed.action) {
      case "view": {
        ensureDraft();
        if (!(await saveNego(nego))) return true;
        await answerCallback(params.callbackQueryId, "Редактор расчёта");
        await renderEditorMessage(chatId, params.messageId, formatDisputeEditor({
          snapshot: current.snapshot as Partial<RentalVerificationSnapshot>,
          draft: nego.draft!.split,
          actorLabel,
          comment: nego.draft!.comment,
        }), disputeEditorKeyboard(rentalId, nego.draft!.split, original));
        return true;
      }

      case "part": {
        ensureDraft();
        await answerCallback(params.callbackQueryId, `${parsed.part === "base" ? "🏍" : parsed.part === "equipment" ? "🧰" : "📈"} Правка части`);
        await renderEditorMessage(chatId, params.messageId, formatDisputeEditor({
          snapshot: current.snapshot as Partial<RentalVerificationSnapshot>,
          draft: nego.draft!.split,
          actorLabel,
          comment: nego.draft!.comment,
          activePart: parsed.part,
        }), adjustPartKeyboard(parsed.part as SplitPartKey, rentalId));
        return true;
      }

      case "adjust": {
        ensureDraft();
        const delta = parsed.delta || 0;
        const nextSplit = delta === 0
          ? resetSplitPart(nego.draft!.split, parsed.part as SplitPartKey, original)
          : applySplitDelta(nego.draft!.split, parsed.part as SplitPartKey, delta);
        nego = setDraftSplit(nego, nextSplit);
        if (!(await saveNego(nego))) return true;
        await answerCallback(params.callbackQueryId, delta === 0 ? "Сброшено к исходному" : "Обновлено");
        await renderEditorMessage(chatId, params.messageId, formatDisputeEditor({
          snapshot: current.snapshot as Partial<RentalVerificationSnapshot>,
          draft: nextSplit,
          actorLabel,
          comment: nego.draft!.comment,
          activePart: parsed.part,
        }), adjustPartKeyboard(parsed.part as SplitPartKey, rentalId));
        return true;
      }

      case "comment": {
        ensureDraft();
        if (!(await saveNego(nego))) return true;
        // Switch the chat into capture mode: the next plain text message
        // becomes the comment (hook in command-handler.ts → handleRentalVerifyCommentText).
        // NB task110: user_states has NO `updated_at` column (live table comes
        // from 20250721100000_create_user_states_table.sql: user_id/state/context/
        // expires_at/created_at only). Writing `updated_at` made PostgREST reject
        // the whole upsert (42703/PGRST204) and supabase-js does NOT throw on API
        // errors — the state silently never existed, the next text message fell
        // through every handler and the operator got «Неизвестная команда».
        // Payload mirrors doc/subrent setState; expires_at set explicitly (the
        // on-conflict update would otherwise keep a stale 15-min default).
        const { error: stateErr } = await supabaseAdmin.from("user_states").upsert(
          {
            user_id: chatId,
            state: `vrf_comment_${rentalId}`,
            context: { editorMessageId: params.messageId ?? null },
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          },
          { onConflict: "user_id" },
        );
        if (stateErr) {
          // Loud failure instead of a fake prompt: the capture hook would
          // never fire and the next message would die in the router.
          logger.error("[rental-verify] vrf_comment state upsert failed:", stateErr.message);
          await answerCallback(params.callbackQueryId, "⚠️ Не удалось включить режим ввода. Попробуйте ещё раз.");
          return true;
        }
        await answerCallback(params.callbackQueryId, "Напишите комментарий следующим сообщением");
        await renderEditorMessage(chatId, params.messageId, [
          `✍️ <b>Комментарий к предложению</b>`,
          ``,
          `Напишите его следующим сообщением (до 600 символов) — он уйдёт второй стороне вместе с числами.`,
          ``,
          `«cancel» — отменить ввод.`,
        ].join("\n"), [[{ text: "⬅️ К частям", callback_data: `vrfp_v_${rentalId}` }]]);
        return true;
      }

      case "send": {
        ensureDraft();
        const res = sendProposalFromDraft(nego, { chatId, role, nowIso: new Date().toISOString(), original });
        if (!res.ok) {
          await answerCallback(params.callbackQueryId, res.error || "Не удалось отправить.");
          return true;
        }
        // A proposal is a dispute being negotiated — pin the row to «disputed»
        // when it somehow isn't yet (status transitions keep the state machine).
        const extraStatus: Record<string, unknown> =
          current.status === "disputed" || current.status === "verified"
            ? {}
            : { status: "disputed", disputed_by: chatId, dispute_reason: "предложена корректировка расчёта" };
        if (!(await saveNego(res.state, extraStatus))) return true;
        // Task 118: an ADMIN proposal goes to BOTH parties (there is no single
        // «other side» for crew staff); a party proposal goes to the other party.
        const isReplace = !!nego.open && nego.open.by === chatId;
        const proposalTargets = (
          role === "admin"
            ? [current.operator_chat_id, current.owner_chat_id]
            : [otherPartyChatId(current, chatId)]
        ).filter(Boolean) as string[];
        await answerCallback(params.callbackQueryId, isReplace ? "✏️ Предложение обновлено" : "📤 Предложение отправлено");
        // Replace the editor with a «sent» stub — now WITH buttons (the boss
        // tested: after sending, buttons vanished and he could not edit again).
        await renderEditorMessage(chatId, params.messageId, [
          `📤 <b>Предложение отправлено</b> ${escapeVerifyHtml(actorLabel)}`,
          ``,
          formatDisputeEditor({
            snapshot: current.snapshot as Partial<RentalVerificationSnapshot>,
            draft: res.state.open?.split || original,
            actorLabel,
            comment: res.state.open?.comment,
          }),
          ``,
          role === "admin"
            ? `Ждём ответ оператора и владельца: ✅ согласиться / ⚠️ предложить своё / ❌ отклонить.`
            : `Ждём ответ второй стороны: ✅ согласиться / ⚠️ предложить своё / ❌ отклонить.`,
          `Числа можно поправить («✏️ Изменить») или отозвать предложение («↩️ Отозвать»).`,
        ].join("\n"), proposalSentKeyboard(rentalId));
        const proposal = res.state.open as OpenProposal;
        for (const otherChatId of [...new Set(proposalTargets)]) {
          if (otherChatId === chatId) continue;
          try {
            await sendComplexMessage(
              otherChatId,
              formatProposalMessage({
                snapshot: current.snapshot as Partial<RentalVerificationSnapshot>,
                proposal,
                proposerLabel: actorLabel,
                forChatId: otherChatId,
              }),
              proposalResponseKeyboard(rentalId),
              { parseMode: "HTML", keyboardType: "inline" },
            );
          } catch {
            /* non-fatal */
          }
        }
        // Task 118: staff watch the negotiation (plain note, deduped).
        await ccVerificationNoteToCrewStaff({
          crewSlug: current.crew_slug || null,
          rentalId,
          text: [
            `⚖️ ${escapeVerifyHtml(actorLabel)}${role === "admin" ? " (админ)" : ""} предложил(а) скорректировать расчёт по аренде ${escapeVerifyHtml((current.snapshot as any)?.bikeName || "")}:`,
            `📊 Итог оператору: ${formatRubVerify(splitTotal(original))} → <b>${formatRubVerify(splitTotal(proposal.split))}</b>`,
            proposal.comment ? `✍️ ${escapeVerifyHtml(proposal.comment)}` : "",
          ].filter(Boolean).join("\n"),
          exclude: [chatId, ...proposalTargets],
        });
        return true;
      }

      case "confirm": {
        // «Расчёт верный» right from the editor = the plain ✅ flow.
        // Clear the draft first, then reuse the state-machine confirm path.
        nego = clearDraft(nego);
        if (!(await saveNego(nego))) return true;
        await handleRentalVerifyCallback({
          data: `vrf_ok_${rentalId}`,
          chatId,
          callbackQueryId: params.callbackQueryId,
          messageId: params.messageId,
        });
        return true;
      }

      case "accept": {
        const acc = acceptOpenProposal(nego, { chatId, role });
        if (!acc.ok) {
          await answerCallback(params.callbackQueryId, acc.error || "Нельзя принять.");
          return true;
        }
        // The acceptor AGREES with the numbers — run it through the same
        // optimistic-lock confirm transition as a regular ✅.
        const confirm = applyVerificationAction(current, { action: "confirm", chatId, nowIso: new Date().toISOString() });
        if (!confirm.row) {
          await answerCallback(params.callbackQueryId, confirm.error || "Подтверждение недоступно.");
          return true;
        }
        // Narrow once — closures below (remaining-party filter) must see non-null.
        const confirmRow = confirm.row;
        const { data: written, error: upErr } = await supabaseAdmin
          .from("rental_verifications")
          .update({
            negotiation: acc.state,
            status: confirmRow.status,
            operator_confirmed_at: confirmRow.operator_confirmed_at,
            owner_confirmed_at: confirmRow.owner_confirmed_at,
            verified_at: confirmRow.verified_at,
            updated_at: new Date().toISOString(),
          })
          .eq("rental_id", rentalId)
          .eq("status", current.status)
          .select("status")
          .maybeSingle();
        if (upErr) {
          if (isMissingNegotiationError(upErr)) {
            await answerCallback(params.callbackQueryId, "Редактор недоступен — примените SQL (rental-verifications-negotiation).");
            return true;
          }
          throw upErr;
        }
        if (!written) {
          await answerCallback(params.callbackQueryId, "Не удалось сохранить — попробуйте ещё раз.");
          return true;
        }
        const proposerChatId = acc.state.agreed ? acc.state.agreed.proposedBy : null;
        if (confirm.effect === "verified") {
          await answerCallback(params.callbackQueryId, "🤝 Дил закрыт — аренда проверена!");
          const done = formatDealDoneText({
            snapshot: current.snapshot as Partial<RentalVerificationSnapshot>,
            agreedSplit: acc.state.agreed!.split,
            proposerLabel: labelFromUsersMap(usersMap, proposerChatId),
            acceptorLabel: actorLabel,
          });
          // Task 122: the deal path funnels through the SAME gamified done-DM
          // (speed / ladder / closer / next-up) + the operator piggy bank
          // grows here too — the deal IS a verified сверка.
          const dealScore = await loadOperatorVerifiedScore(current.operator_chat_id).catch(() => null);
          const { amount: dealAmount } = commissionOf({ snapshot: current.snapshot, negotiation: acc.state });
          const dealScoreTail =
            dealScore && current.operator_chat_id
              ? `\n\n🏅 Счёт ${escapeVerifyHtml(labelFromUsersMap(usersMap, current.operator_chat_id))}: <b>${formatRubVerify(dealScore.sum)}</b> (${dealScore.count} ар.) — +${formatRubVerify(dealAmount)} за эту аренду 💰`
              : "";
          const doneRecipients = [...new Set([current.operator_chat_id, current.owner_chat_id].filter(Boolean) as string[])];
          await sendVerifiedDoneDms({
            rentalId,
            crewSlug: current.crew_slug || null,
            requestedAtIso: current.requested_at,
            verifiedAtIso: confirmRow.verified_at,
            baseText: () => done + dealScoreTail,
            recipients: doneRecipients,
          });
          // Task 118: staff see the closed deal too (an admin acceptor gets no
          // DM — he pressed the button — so the note is his visibility).
          await ccVerificationNoteToCrewStaff({
            crewSlug: current.crew_slug || null,
            rentalId,
            text: done,
            exclude: [...doneRecipients, role === "admin" ? chatId : ""],
          });
          await grantVerificationAchievements({ ...current, ...confirm.row }, { speedy: isSpeedyConfirm(current) });
          await grantNegotiationAchievements({ ...current, ...confirm.row, negotiation: acc.state } as RentalVerificationRow);
        } else {
          // wait_other_party — whoever still owes a ✅ gets the nudge.
          // Task 118: with an ADMIN proposer the remaining debtor is the
          // unconfirmed PARTY (the admin never owes a confirm), so compute
          // remaining from the confirm timestamps instead of guessing the
          // proposer.
          await answerCallback(params.callbackQueryId, "✅ Согласились — ждём подтверждение второй стороны.");
          const remaining = [...new Set([current.operator_chat_id, current.owner_chat_id].filter(Boolean).map(String))]
            .filter((id) => id !== chatId)
            .filter((id) =>
              String(id) === String(current.operator_chat_id)
                ? !confirmRow.operator_confirmed_at
                : !confirmRow.owner_confirmed_at,
            );
          for (const target of remaining) {
            const nudge = [
              `✅ ${escapeVerifyHtml(actorLabel)} согласился с числами по аренде ${escapeVerifyHtml((current.snapshot as any)?.bikeName || "")}:`,
              `📊 Итог оператору: <b>${formatRubVerify(splitTotal(acc.state.agreed!.split))}</b>`,
              ``,
              `Осталось ваше подтверждение:`,
            ].join("\n");
            try {
              await sendComplexMessage(target, nudge, verificationKeyboard(rentalId), {
                parseMode: "HTML",
                keyboardType: "inline",
              });
            } catch {
              /* non-fatal */
            }
          }
          // The proposer (if not among the remaining and not the acceptor)
          // still wants to know his numbers were accepted.
          if (proposerChatId && !remaining.includes(String(proposerChatId)) && proposerChatId !== chatId) {
            try {
              await sendComplexMessage(
                proposerChatId,
                `✅ ${escapeVerifyHtml(actorLabel)} согласился с вашими числами по аренде ${escapeVerifyHtml((current.snapshot as any)?.bikeName || "")}: 📊 ${formatRubVerify(splitTotal(acc.state.agreed!.split))}. Ждём финальное подтверждение.`,
                [],
                { parseMode: "HTML" },
              );
            } catch {
              /* non-fatal */
            }
          }
        }
        return true;
      }

      case "decline": {
        const dec = declineOpenProposal(nego, { chatId, role, nowIso: new Date().toISOString() });
        if (!dec.ok) {
          await answerCallback(params.callbackQueryId, dec.error || "Нельзя отклонить.");
          return true;
        }
        if (!(await saveNego(dec.state))) return true;
        await answerCallback(params.callbackQueryId, "❌ Предложение отклонено.");
        const proposer = nego.open?.by || null;
        if (proposer) {
          try {
            await sendComplexMessage(
              proposer,
              [
                `❌ ${escapeVerifyHtml(actorLabel)} отклонил предложение по аренде ${escapeVerifyHtml((current.snapshot as any)?.bikeName || "")}.`,
                `Расчёт остаётся в статусе «спор» — предложите свои числа или сверьтесь лично; владелец может закрыть спор вручную в аналитике.`,
              ].join("\n"),
              proposalSentKeyboard(rentalId),
              { parseMode: "HTML", keyboardType: "inline" },
            );
          } catch {
            /* non-fatal */
          }
        }
        // Task 118: staff watch the negotiation (plain note, deduped).
        await ccVerificationNoteToCrewStaff({
          crewSlug: current.crew_slug || null,
          rentalId,
          text: `❌ ${escapeVerifyHtml(actorLabel)} отклонил предложение по аренде ${escapeVerifyHtml((current.snapshot as any)?.bikeName || "")} — расчёт остаётся в статусе «спор».`,
          exclude: [chatId, proposer],
        });
        return true;
      }

      case "withdraw": {
        // Task 118: the proposer takes their pending proposal back — one of
        // the buttons on the «sent» stub («↩️ Отозвать»).
        const wd = withdrawOpenProposal(nego, { chatId, role, nowIso: new Date().toISOString() });
        if (!wd.ok) {
          await answerCallback(params.callbackQueryId, wd.error || "Нельзя отозвать.");
          return true;
        }
        if (!(await saveNego(wd.state))) return true;
        await answerCallback(params.callbackQueryId, "↩️ Предложение отозвано.");
        const proposal = nego.open as OpenProposal | null;
        await renderEditorMessage(chatId, params.messageId, [
          `↩️ <b>Предложение отозвано</b> ${escapeVerifyHtml(actorLabel)}`,
          ``,
          `Расчёт остаётся в статусе «спор» — можно предложить новые числа или подтвердить как есть.`,
        ].join("\n"), disputeEditorKeyboard(rentalId, proposal?.split || original, original));
        const targets = [...new Set([current.operator_chat_id, current.owner_chat_id].filter(Boolean) as string[])];
        for (const otherChatId of targets) {
          if (otherChatId === chatId) continue;
          try {
            await sendComplexMessage(
              otherChatId,
              `↩️ ${escapeVerifyHtml(actorLabel)}${role === "admin" ? " (админ)" : ""} отозвал предложение по аренде ${escapeVerifyHtml((current.snapshot as any)?.bikeName || "")} — расчёт остаётся в статусе «спор».`,
              [],
              { parseMode: "HTML" },
            );
          } catch {
            /* non-fatal */
          }
        }
        await ccVerificationNoteToCrewStaff({
          crewSlug: current.crew_slug || null,
          rentalId,
          text: `↩️ ${escapeVerifyHtml(actorLabel)}${role === "admin" ? " (админ)" : ""} отозвал предложение по аренде ${escapeVerifyHtml((current.snapshot as any)?.bikeName || "")}.`,
          exclude: [chatId, ...targets],
        });
        return true;
      }

      case "counter": {
        // The other party wants to propose their own numbers: withdraw the
        // open proposal (history keeps it) and open the editor prefilled
        // with the counterparty's numbers.
        const fromSplit = nego.open?.split || original;
        const wasBy = nego.open?.by || null;
        nego = clearDraft(startDraft({ ...nego, open: null }, chatId, role, original, fromSplit));
        if (!(await saveNego(nego))) return true;
        if (wasBy && wasBy !== chatId) {
          try {
            await sendComplexMessage(
              wasBy,
              `⚠️ ${escapeVerifyHtml(actorLabel)} решил предложить свои числа по аренде ${escapeVerifyHtml((current.snapshot as any)?.bikeName || "")} — ждите новое предложение.`,
              [],
              { parseMode: "HTML" },
            );
          } catch {
            /* non-fatal */
          }
        }
        await answerCallback(params.callbackQueryId, "⚖️ Редактор открыт — предложите свои числа");
        await renderEditorMessage(chatId, params.messageId, formatDisputeEditor({
          snapshot: current.snapshot as Partial<RentalVerificationSnapshot>,
          draft: nego.draft!.split,
          actorLabel,
        }), disputeEditorKeyboard(rentalId, nego.draft!.split, original));
        return true;
      }
    }
    return true;
  } catch (err) {
    logger.warn(`[rental-verify] proposal callback failed for ${parsed.rentalId}:`, err);
    await answerCallback(params.callbackQueryId, "Ошибка — попробуйте ещё раз.");
    return true;
  }
}

/**
 * Text-message hook (command-handler.ts): the user is in comment-capture
 * mode after tapping «✍️ Комментарий». Returns true when the message was
 * consumed by the editor.
 */
export async function handleRentalVerifyCommentText(params: {
  userId: string;
  chatId: string;
  text: string;
}): Promise<boolean> {
  try {
    const { data: stateRow, error: stateReadErr } = await supabaseAdmin
      .from("user_states")
      .select("state, context")
      .eq("user_id", params.userId)
      .like("state", "vrf_comment_%")
      .maybeSingle();
    if (stateReadErr) {
      // NB task110: a transient read error must not push the operator's next
      // message into the generic router (that produced «Неизвестная команда»).
      // Missing table → fall through (degradation), any other blip → consume.
      logger.warn("[rental-verify] vrf_comment state read failed:", stateReadErr.message);
      return !isMissingRelationError(stateReadErr);
    }
    if (!stateRow?.state) return false;
    const rentalId = String(stateRow.state).slice("vrf_comment_".length);
    const text = String(params.text || "").trim();
    // Best-effort state cleanup regardless of outcome.
    await supabaseAdmin.from("user_states").delete().eq("user_id", params.userId).like("state", "vrf_comment_%");
    if (!rentalId) return true;

    const { data: row, error } = await supabaseAdmin
      .from("rental_verifications")
      .select("*")
      .eq("rental_id", rentalId)
      .maybeSingle();
    if (error && !isMissingRelationError(error)) throw error;
    if (!row) return true;
    const current = row as RentalVerificationRow;
    // Task 118: crew staff (admins) can also draft comments on their proposals.
    const staffChatIds = await loadCrewStaffChatIds(current.crew_slug || null);
    const role = resolveVerificationRole(current, String(params.userId), staffChatIds);
    if (!role) return true;
    const original = snapshotSplitOf(current.snapshot as Partial<RentalVerificationSnapshot>);
    let nego = parseNegotiation((current as any).negotiation);
    if (!nego.draft || nego.draft.by !== String(params.userId)) {
      const prefill = nego.open && nego.open.by === String(params.userId) ? nego.open.split : undefined;
      nego = startDraft(nego, String(params.userId), role, original, prefill);
    }
    if (text.toLowerCase() === "cancel" || text === "/cancel") {
      // Cancel the input only — keep whatever draft existed.
      const ctx = (stateRow.context || {}) as { editorMessageId?: number | null };
      await renderEditorMessage(String(params.chatId), ctx.editorMessageId ?? undefined, formatDisputeEditor({
        snapshot: current.snapshot as Partial<RentalVerificationSnapshot>,
        draft: nego.draft!.split,
        actorLabel: labelFromUsersMap(await loadUsersMap([String(params.userId)]), String(params.userId)),
        comment: nego.draft!.comment,
      }), disputeEditorKeyboard(rentalId, nego.draft!.split, original));
      return true;
    }
    nego = setDraftComment(nego, text);
    const { error: upErr } = await supabaseAdmin
      .from("rental_verifications")
      .update({ negotiation: nego, updated_at: new Date().toISOString() })
      .eq("rental_id", rentalId);
    if (upErr) {
      if (isMissingNegotiationError(upErr)) return true;
      throw upErr;
    }
    const ctx = (stateRow.context || {}) as { editorMessageId?: number | null };
    await renderEditorMessage(String(params.chatId), ctx.editorMessageId ?? undefined, formatDisputeEditor({
      snapshot: current.snapshot as Partial<RentalVerificationSnapshot>,
      draft: nego.draft!.split,
      actorLabel: labelFromUsersMap(await loadUsersMap([String(params.userId)]), String(params.userId)),
      comment: nego.draft!.comment,
    }), disputeEditorKeyboard(rentalId, nego.draft!.split, original));
    return true;
  } catch (e) {
    logger.warn("[rental-verify] comment capture failed (non-fatal):", e);
    return true; // consumed — do not let the text leak into other flows
  }
}

// ── Deal achievements (the negotiation game) ─────────────────────────────────

/**
 * Fired when a rental reaches «verified» AND the row carries an agreed
 * (corrected) split: the pair didn't just confirm — they settled a dispute.
 * deal_first / deal_5, counted from the DB truth (client-side filter, the
 * per-party set is small; the 731-shift lesson still applies — counters are
 * derived here from a bounded, indexed query, never incremented blindly).
 */
export async function grantNegotiationAchievements(row: RentalVerificationRow): Promise<void> {
  try {
    const nego = parseNegotiation((row as any).negotiation);
    if (!nego.agreed) return;
    const slug = row.crew_slug;
    if (!slug) return;
    const parties = [...new Set([row.operator_chat_id, row.owner_chat_id].filter(Boolean) as string[])];
    for (const chatId of parties) {
      const { data, error } = await supabaseAdmin
        .from("rental_verifications")
        .select("negotiation")
        .eq("status", "verified")
        .or(`operator_chat_id.eq.${chatId},owner_chat_id.eq.${chatId}`)
        .limit(500);
      if (error) {
        if (!isMissingRelationError(error) && !isMissingNegotiationError(error)) {
          logger.warn("[rental-verify] deal count query failed:", error.message);
        }
        continue;
      }
      const dealCount = (data || []).filter((r: any) => parseNegotiation(r.negotiation).agreed).length;
      const grants: Array<{ id: string; context?: Record<string, unknown> }> = [];
      if (dealCount >= 1) grants.push({ id: "deal_first", context: { dealCount } });
      if (dealCount >= 5) grants.push({ id: "deal_5", context: { dealCount } });
      for (const g of grants) {
        grantFranchizeAchievementAction({
          slug,
          userId: chatId,
          achievementId: g.id,
          source: "rental:deal",
          context: g.context,
        }).catch((e) => logger.warn(`[rental-verify] grant ${g.id} failed for ${chatId}:`, e));
      }
    }
  } catch (e) {
    logger.warn("[rental-verify] grantNegotiationAchievements failed (non-fatal):", e);
  }
}

function isSpeedyConfirm(row: RentalVerificationRow): boolean {
  const requested = Date.parse(row.requested_at || "");
  if (!Number.isFinite(requested)) return false;
  return Date.now() - requested < 3600 * 1000;
}

// ── Achievements (gamified reconciliation) ───────────────────────────────────

/**
 * Task 124 — the party's current no-problemo streak: verified rows,
 * newest-first (by verified_at; a verified row always has it set), walked
 * while the frozen snapshot says no_problemo. Old pre-task123 rows without
 * the reasonability block break the streak (unknown ≠ clean). Non-fatal.
 */
export async function loadNoProblemoStreakFor(chatId: string | null | undefined): Promise<number> {
  const viewer = chatId ? String(chatId) : "";
  if (!viewer) return 0;
  try {
    const { data, error } = await supabaseAdmin
      .from("rental_verifications")
      .select("snapshot")
      .eq("status", "verified")
      .or(`operator_chat_id.eq.${viewer},owner_chat_id.eq.${viewer}`)
      .order("verified_at", { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) return 0;
    return computeNoProblemoStreak((data || []) as StreakRow[]);
  } catch {
    return 0;
  }
}

/**
 * Fired when a rental reaches «verified». Both confirming humans get credit:
 *   • rentalsVerified counter — ABSOLUTE SET from the DB (the shift.ts
 *     «731 смены» lesson: derived values are never incremented from stale
 *     totals);
 *   • verify_first / verify_10 / verify_50 / verify_100 thresholds;
 *   • verify_streak_13 — 13 «no problemo» сверки in a row (task 124);
 *   • verify_speedy — both sides agreed within one hour of the request.
 */
export async function grantVerificationAchievements(
  row: RentalVerificationRow,
  opts: { speedy: boolean },
): Promise<void> {
  try {
    const slug = row.crew_slug;
    if (!slug) return;
    const parties = [...new Set([row.operator_chat_id, row.owner_chat_id].filter(Boolean) as string[])];
    for (const chatId of parties) {
      const { count, error } = await supabaseAdmin
        .from("rental_verifications")
        .select("rental_id", { count: "exact", head: true })
        .eq("status", "verified")
        .or(`operator_chat_id.eq.${chatId},owner_chat_id.eq.${chatId}`);
      if (error) {
        logger.warn("[rental-verify] verified count query failed:", error.message);
        continue;
      }
      const verifiedCount = count || 0;

      syncFranchizeCountersAction({
        slug,
        userId: chatId,
        counters: { rentalsVerified: verifiedCount },
        source: "rental:verified",
      }).catch((e) => logger.warn("[rental-verify] counter sync failed:", e));

      const grants: Array<{ id: string; context?: Record<string, unknown> }> = [];
      if (verifiedCount >= 1) grants.push({ id: "verify_first", context: { verifiedCount } });
      if (verifiedCount >= 10) grants.push({ id: "verify_10", context: { verifiedCount } });
      if (verifiedCount >= 50) grants.push({ id: "verify_50", context: { verifiedCount } });
      // Task 123 (boss: «verify_100 tier») — the ladder continues.
      if (verifiedCount >= 100) grants.push({ id: "verify_100", context: { verifiedCount } });
      // Task 124 (boss: «crank it to 13») — the no-problemo streak badge.
      const streak = await loadNoProblemoStreakFor(chatId);
      if (streak >= 13) grants.push({ id: "verify_streak_13", context: { streak } });
      if (opts.speedy) {
        grants.push({
          id: "verify_speedy",
          context: { minutes: Math.round((Date.now() - Date.parse(row.requested_at)) / 60000) },
        });
      }
      for (const g of grants) {
        grantFranchizeAchievementAction({
          slug,
          userId: chatId,
          achievementId: g.id,
          source: "rental:verified",
          context: g.context,
        }).catch((e) => logger.warn(`[rental-verify] grant ${g.id} failed for ${chatId}:`, e));
      }
    }
  } catch (e) {
    logger.warn("[rental-verify] grantVerificationAchievements failed (non-fatal):", e);
  }
}

// ── Batch status lookup for UI/CSV ───────────────────────────────────────────

/**
 * Map rental_id → verification status for lists. Returns an EMPTY map when
 * the table does not exist yet (SQL not applied) — callers must treat a
 * missing entry as «no verification data», not «unverified».
 */
export async function getVerificationStatusMap(rentalIds: string[]): Promise<Map<string, VerificationBrief>> {
  const map = new Map<string, VerificationBrief>();
  const ids = [...new Set((rentalIds || []).filter(Boolean))].map(String);
  if (ids.length === 0) return map;
  try {
    // Chunked: the lists can carry hundreds of ids per period.
    // Task 106: negotiation rides along so the UI can show «предложение
    // отправлено» chips and the agreed (corrected) split. Falls back to a
    // negotiation-free select while the column is not applied yet.
    // Task 114: audit:snapshot->audit rides along (PostgREST jsonb key pick —
    // avoids dragging full snapshots) so the drawer can show WHY a row is
    // almost/sus without another query.
    const COLS_WITH_NEGO = "rental_id, status, operator_chat_id, owner_chat_id, negotiation, audit:snapshot->audit";
    const COLS_PLAIN = "rental_id, status, operator_chat_id, owner_chat_id, audit:snapshot->audit";
    const CHUNK = 200;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      let rows: Array<any> | null = null;
      let selErr: any = null;
      {
        const res = await supabaseAdmin.from("rental_verifications").select(COLS_WITH_NEGO).in("rental_id", chunk);
        if (res.error && isMissingNegotiationError(res.error)) {
          const retry = await supabaseAdmin.from("rental_verifications").select(COLS_PLAIN).in("rental_id", chunk);
          rows = retry.data as any[] | null;
          selErr = retry.error;
        } else {
          rows = res.data as any[] | null;
          selErr = res.error;
        }
      }
      if (selErr) throw selErr;
      for (const row of rows || []) {
        const nego = row.negotiation !== undefined ? parseNegotiation(row.negotiation) : null;
        const audit = (row.audit ?? null) as { grade?: string; notes?: string[] } | null;
        map.set(String(row.rental_id), {
          status: row.status,
          operatorChatId: row.operator_chat_id,
          ownerChatId: row.owner_chat_id,
          ...(nego ? { proposalOpen: !!nego.open, agreedSplit: nego.agreed ? nego.agreed.split : null } : {}),
          ...(audit && typeof audit === "object" ? { audit } : {}),
        });
      }
    }
  } catch (err: any) {
    if (isMissingRelationError(err)) {
      logger.warn("[rental-verify] rental_verifications missing — badges hidden until SQL applied");
    } else {
      logger.warn("[rental-verify] getVerificationStatusMap failed:", err?.message);
    }
  }
  return map;
}
