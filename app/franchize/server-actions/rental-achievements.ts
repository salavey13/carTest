// app/franchize/server-actions/rental-achievements.ts
//
// FIX (iter4): rental closure achievements — grants badges to the operator
// who closed a rental (or the operator who originally processed it when the
// closure is done by an admin/owner).
//
// Mirrors the shift streak pattern (profile-actions.ts getCatalogBySlug +
// grantFranchizeAchievementAction) but the trigger source is the rental
// closure flow in app/rentals/actions.ts (confirmVehicleReturn).
//
// Badges granted here:
//   rental_first          — first ever closure by this operator
//   rental_streak_3       — 3 closures in a row (no failed/aborted in between)
//   rental_streak_10      — 10 closures in a row
//   rental_ideal_closure  — closure that met the "ideal" criteria
//   rental_ideal_streak_5 — 5 ideal closures in a row
//   rental_odometer_pro   — captured final odometer for 25+ closures
//   rental_monthly_plan   — 20+ closures in the current month
//
// All grants are idempotent — if the badge is already unlocked the helper
// skips the insert but still updates the counters (so the counters persist).

import { supabaseAdmin } from "@/lib/supabase-server";
import { privateSchema } from "@/lib/private-secrets";
import { logger } from "@/lib/logger";
import { grantFranchizeAchievementAction, syncFranchizeCountersAction } from "@/app/franchize/profile-actions";

type SupabaseSchemaClient = {
  schema: (schema: string) => {
    from: (table: string) => any;
  };
};

function privateS() {
  return (supabaseAdmin as unknown as SupabaseSchemaClient).schema("private");
}

// Resolve the operator who should receive credit for this closure.
// Priority:
//   1. contract.created_by_operator_chat_id  (the operator who created the
//      contract — most accurate, set by the /doc-manual flow)
//   2. rentals.created_by_operator_chat_id  (fallback if contract artefact
//      missing or older rental)
//   3. actingUser (last-ditch fallback: the person who clicked the button)
async function resolveOperatorForRental(
  rentalId: string,
  actingUserId: string,
): Promise<{ operatorId: string | null; slug: string | null }> {
  try {
    const { data: rental } = await supabaseAdmin
      .from("rentals")
      .select("crew_id, created_by_operator_chat_id, vehicle:cars!inner(make, model, crew_id)")
      .eq("rental_id", rentalId)
      .maybeSingle();

    if (!rental) {
      logger.warn("[rental-achievements] rental not found", { rentalId });
      return { operatorId: actingUserId, slug: null };
    }

    // Try contract artefact first (preferred source per iter2 fix)
    let contractOperator: string | null = null;
    try {
      const { data: artefact } = await privateS()
        .from("rental_contract_artefacts")
        .select("created_by_operator_chat_id, crew:crews!inner(slug)")
        .eq("rental_id", rentalId)
        .maybeSingle();
      if (artefact?.created_by_operator_chat_id) {
        contractOperator = String(artefact.created_by_operator_chat_id);
      }
      const slug = (artefact as any)?.crew?.slug || null;
      if (contractOperator && slug) {
        return { operatorId: contractOperator, slug };
      }
    } catch (e) {
      // fall through to rental fallback
    }

    // Fallback to rentals.created_by_operator_chat_id
    const rentalOp = rental.created_by_operator_chat_id || actingUserId;
    const crewId = rental.crew_id;
    let slug: string | null = null;
    if (crewId) {
      const { data: crew } = await supabaseAdmin
        .from("crews")
        .select("slug")
        .eq("id", crewId)
        .maybeSingle();
      slug = crew?.slug || null;
    }
    return { operatorId: rentalOp, slug };
  } catch (e) {
    logger.error("[rental-achievements] resolveOperatorForRental failed", e);
    return { operatorId: actingUserId, slug: null };
  }
}

// Count the operator's recent closures (last N rows in event log) so we can
// detect streaks + monthly totals.
async function countRecentClosures(
  operatorId: string,
  opts: { sinceDays?: number } = {},
): Promise<{ totalAllTime: number; totalThisMonth: number; consecutiveCurrentStreak: number }> {
  const sinceDays = opts.sinceDays ?? 365;
  const sinceIso = new Date(Date.now() - sinceDays * 86400_000).toISOString();

  // Pull recent return_confirmed events for rentals this operator closed.
  // We use the events table — `created_by` is the acting user.
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("created_by, created_at, type")
    .eq("type", "return_confirmed")
    .eq("created_by", operatorId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });

  if (error || !data) {
    logger.warn("[rental-achievements] countRecentClosures query failed", error);
    return { totalAllTime: 0, totalThisMonth: 0, consecutiveCurrentStreak: 0 };
  }

  const totalAllTime = data.length;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const totalThisMonth = data.filter((e: any) => e.created_at >= monthStart).length;

  // Streak: consecutive day-closures with no gap > 2 days between them.
  // (Treat the operator as "in a streak" as long as closures are within 48h
  // of each other — generous, since rentals can be 1-2 per day.)
  // Sort ascending by date, walk backwards counting.
  const sorted = (data as any[]).slice().sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  let streak = sorted.length > 0 ? 1 : 0;
  for (let i = sorted.length - 2; i >= 0; i--) {
    const prev = new Date(sorted[i + 1].created_at).getTime();
    const cur = new Date(sorted[i].created_at).getTime();
    const gapHours = (prev - cur) / 3_600_000;
    if (gapHours <= 48) streak++;
    else break;
  }

  return { totalAllTime, totalThisMonth, consecutiveCurrentStreak: streak };
}

/**
 * Task 117 — ONE scan of the operator's completed closures, counting every
 * documentation-driven stat the badges need (boss: «идеальная» аренда это
 * когда пробег до/после и фото до/после на месте — отдельные ачивки):
 *   • ideal      — odometer BEFORE > 0 AND odometer after > 0 AND photos
 *                  before > 0 AND photos after > 0 (the boss's definition —
 *                  documentation completeness, deposit/damage no longer gate);
 *   • odoFull    — both odometer readings present;
 *   • photosFull — both photo sets present;
 *   • odoCaptured— odometer_after present (legacy counter meaning kept).
 * ABSOLUTE values — consumed by syncFranchizeCountersAction (the «731 смены»
 * lesson: derived counters are SET from the source of truth, never
 * incremented from stale totals).
 */
interface OperatorClosureStats {
  ideal: number;
  odoFull: number;
  photosFull: number;
  odoCaptured: number;
}

const odoOk = (v: unknown) => typeof v === "number" && v > 0;

async function countOperatorClosureStats(operatorId: string): Promise<OperatorClosureStats> {
  const empty = { ideal: 0, odoFull: 0, photosFull: 0, odoCaptured: 0 };
  const { data, error } = await supabaseAdmin
    .from("rentals")
    .select("rental_id, metadata, status, start_photo_count, end_photo_count")
    .eq("status", "completed")
    .eq("created_by_operator_chat_id", operatorId)
    .limit(1000);

  if (error || !data) {
    logger.warn("[rental-achievements] countOperatorClosureStats query failed", error);
    return empty;
  }

  const stats = { ...empty };
  for (const r of data as any[]) {
    const meta = (r.metadata || {}) as any;
    const odoBefore = odoOk(meta?.odometer_before);
    const odoAfter = odoOk(meta?.odometer_after);
    const photosBefore = Number(r.start_photo_count) > 0;
    const photosAfter = Number(r.end_photo_count) > 0;
    if (odoAfter) stats.odoCaptured += 1;
    if (odoBefore && odoAfter) stats.odoFull += 1;
    if (photosBefore && photosAfter) stats.photosFull += 1;
    if (odoBefore && odoAfter && photosBefore && photosAfter) stats.ideal += 1;
  }
  return stats;
}

export interface GrantRentalClosureAchievementsParams {
  rentalId: string;
  actingUserId: string;
  closureData?: {
    odometerAfter?: number | null;
    /** Task 117: the full documentation picture (ideal = both odo + both photos). */
    odometerBefore?: number | null;
    startPhotoCount?: number | null;
    endPhotoCount?: number | null;
    depositReturned?: boolean | null;
    damageLevel?: "none" | "light" | "heavy" | null;
  };
}

/**
 * Task 117 — the boss redefined the game: «идеальная» аренда = пробег ДО/ПОСЛЕ
 * и фото ДО/ПОСЛЕ на месте. Documentation completeness is the whole check —
 * deposit/damage no longer gate the badge (they stay in the verification
 * audit, where money lives). This runs at the moment of closure, when all
 * four facts are already persisted → authoritative per-closure check.
 */
function isIdealClosure(closure: {
  odometerAfter?: number | null;
  odometerBefore?: number | null;
  startPhotoCount?: number | null;
  endPhotoCount?: number | null;
}): boolean {
  const odoBefore = typeof closure.odometerBefore === "number" && closure.odometerBefore > 0;
  const odoAfter = typeof closure.odometerAfter === "number" && closure.odometerAfter > 0;
  const photosBefore = Number(closure.startPhotoCount) > 0;
  const photosAfter = Number(closure.endPhotoCount) > 0;
  return odoBefore && odoAfter && photosBefore && photosAfter;
}

export async function grantRentalClosureAchievements(
  params: GrantRentalClosureAchievementsParams,
): Promise<{ granted: string[]; errors: string[] }> {
  const { rentalId, actingUserId, closureData } = params;
  const granted: string[] = [];
  const errors: string[] = [];

  const { operatorId, slug } = await resolveOperatorForRental(rentalId, actingUserId);
  if (!operatorId || !slug) {
    errors.push("could not resolve operator/slug");
    return { granted, errors };
  }

  const stats = await countRecentClosures(operatorId, { sinceDays: 365 });
  const isIdeal = isIdealClosure(closureData || {});
  const hasOdoAfter = closureData?.odometerAfter != null;
  const odoFull = isOdoFull(closureData);
  const photosFull = isPhotosFull(closureData);

  // Task 117 COUNTER FIX — the «731 смены» bug again, rental edition.
  // tryGrant passed {rentalsClosed: 1} to EVERY badge grant, so a closure
  // unlocking 3-4 badges inflated rentalsClosed ×3-4 (grantAchievementOnce
  // applies the counter delta on every call, even alreadyUnlocked).
  // Per the established philosophy, profile counters are DERIVED values:
  // SET them once from the source of truth, then grant badges with NO
  // counter deltas. Absolute scan includes the current closure (it is
  // already persisted when this runs).
  try {
    const { count, error } = await supabaseAdmin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("type", "return_confirmed")
      .eq("created_by", operatorId);
    if (error) throw error;
    const docStats = await countOperatorClosureStats(operatorId);
    await syncFranchizeCountersAction({
      slug,
      userId: operatorId,
      counters: {
        rentalsClosed: count || 0,
        idealClosures: docStats.ideal,
        odometerCaptured: docStats.odoCaptured,
        odometerFullClosures: docStats.odoFull,
        photosFullClosures: docStats.photosFull,
      },
      source: "rental:return_confirmed",
    });
  } catch (syncErr) {
    errors.push(`counter sync: ${syncErr instanceof Error ? syncErr.message : String(syncErr)}`);
  }

  // Helper to attempt grant + collect result (NO counter deltas — see above).
  const tryGrant = async (id: string, ctx?: Record<string, unknown>) => {
    try {
      const r = await grantFranchizeAchievementAction({
        slug,
        userId: operatorId,
        achievementId: id,
        source: "rental:return_confirmed",
        context: { rentalId, ...(ctx || {}) },
      });
      if (!r.success) {
        errors.push(`${id}: ${r.error || "grant failed"}`);
      } else if (!r.alreadyUnlocked) {
        granted.push(id);
      }
    } catch (e) {
      errors.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // rental_first — first closure
  if (stats.totalAllTime === 0) {
    await tryGrant("rental_first", { closure: closureData });
  }

  // rental_streak_3 — 3 closures in a row
  // (current closure is +1, so previous streak should be 2 for this badge)
  if (stats.consecutiveCurrentStreak + 1 >= 3) {
    await tryGrant("rental_streak_3", { streak: stats.consecutiveCurrentStreak + 1 });
  }

  // rental_streak_10
  if (stats.consecutiveCurrentStreak + 1 >= 10) {
    await tryGrant("rental_streak_10", { streak: stats.consecutiveCurrentStreak + 1 });
  }

  // Task 117: separate achievements for documented rentals
  // rental_odometer_full — пробег до/после на месте
  if (odoFull) {
    await tryGrant("rental_odometer_full", { closure: closureData });
  }
  // rental_photo_full — фото до/после на месте
  if (photosFull) {
    await tryGrant("rental_photo_full", { closure: closureData });
  }

  // rental_ideal_closure — this single closure was ideal (odo both + photos both)
  if (isIdeal) {
    await tryGrant("rental_ideal_closure", { closure: closureData });
  }

  // rental_ideal_streak_5 — 5 ideal closures in a row
  // We don't keep a strict streak counter for ideal closures (would need
  // an extra column). Instead: count total ideal closures so far; grant at 5.
  // Task 117: the absolute scan already includes THIS closure.
  if (isIdeal) {
    const docStats = await countOperatorClosureStats(operatorId);
    if (docStats.ideal >= 5) {
      await tryGrant("rental_ideal_streak_5", { totalIdeal: docStats.ideal });
    }
    // rental_ideal_10 — ten documented-ideal closures (the «игра» milestone)
    if (docStats.ideal >= 10) {
      await tryGrant("rental_ideal_10", { totalIdeal: docStats.ideal });
    }
  }

  // rental_odometer_pro — captured final odometer 25+ times (absolute truth)
  if (hasOdoAfter) {
    const docStats = await countOperatorClosureStats(operatorId);
    if (docStats.odoCaptured >= 25) {
      await tryGrant("rental_odometer_pro", { closuresWithOdometer: docStats.odoCaptured });
    }
  }

  // rental_monthly_plan — 20+ closures this month
  if (stats.totalThisMonth + 1 >= 20) {
    await tryGrant("rental_monthly_plan", { month: new Date().toISOString().slice(0, 7) });
  }

  logger.info("[rental-achievements] grantRentalClosureAchievements", {
    rentalId, operatorId, slug, granted, errors, isIdeal, odoFull, photosFull, stats,
  });

  return { granted, errors };
}

/** Both odometer readings present (before AND after). */
function isOdoFull(closure: GrantRentalClosureAchievementsParams["closureData"]): boolean {
  return (
    typeof closure?.odometerBefore === "number" && closure.odometerBefore > 0 &&
    typeof closure?.odometerAfter === "number" && closure.odometerAfter > 0
  );
}

/** Both photo sets present (before AND after). */
function isPhotosFull(closure: GrantRentalClosureAchievementsParams["closureData"]): boolean {
  return Number(closure?.startPhotoCount) > 0 && Number(closure?.endPhotoCount) > 0;
}
