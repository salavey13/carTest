// app/franchize/server-actions/renter-self-service-achievements.ts
//
// 2026-09-28 — owner request: «Add some achievements for renter own rent
// creation ;) special ones for photos and odometer, kinda make it extra
// cool ;)»
//
// The classic rental badges (rental_first, rental_ideal_closure, …) reward
// the OPERATOR at closure. A renter who books through the web app flow never
// earns anything — although he does the whole prep himself now: creates the
// deal, attaches «ДО» photos, sets the start odometer. This module grants
// the renter-side badge set (catalog lives in profile-actions.ts, group
// «Аренда — самостоятельность»):
//
//   rental_self_created        «Сам себе оператор»  — first web-created rent
//   rental_self_created_3      «Свой человек»       — 3 web-created rents
//   rental_own_photos_start    «Фото до выезда»     — «ДО» photos on his rent
//   rental_own_odometer_start  «Стартовый замер»    — set the start odometer
//   rental_full_selfservice    «Полный цикл ⭐»      — all three of the above
//
// Every grant is idempotent (grantFranchizeAchievementAction skips unlocked
// ids but still bumps counters), non-fatal by contract: gamification must
// never break the checkout / upload / odometer flows it hangs on.
//
// The combo badge checks the OTHER conditions via profile counters first
// (cheap) and falls back to reading the unlocked-achievements map.

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { grantFranchizeAchievementAction } from "@/app/franchize/profile-actions";

// ─────────────────────────────────────────────────────────────────────────────
// Crew-slug resolution — walk vehicle → cars.crew_id → crews.slug with a
// rental.crew_id shortcut (the trg_rentals_set_crew_id trigger normally fills
// it; the vehicle fallback covers rows where it has not fired). Returns null →
// caller skips granting (non-fatal).
// ─────────────────────────────────────────────────────────────────────────────
export async function resolveCrewSlugForRental(rentalId: string): Promise<string | null> {
  try {
    const { data: rental } = await supabaseAdmin
      .from("rentals")
      .select("crew_id, vehicle_id")
      .eq("rental_id", rentalId)
      .maybeSingle();
    if (!rental) return null;

    if (rental.crew_id) {
      const { data: crew } = await supabaseAdmin
        .from("crews")
        .select("slug")
        .eq("id", rental.crew_id)
        .maybeSingle();
      if (crew?.slug) return String(crew.slug);
    }
    if (!rental.vehicle_id) return null;

    const { data: car } = await supabaseAdmin
      .from("cars")
      .select("crew_id")
      .eq("id", rental.vehicle_id)
      .maybeSingle();
    if (!car?.crew_id) return null;

    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("slug")
      .eq("id", car.crew_id)
      .maybeSingle();
    return crew?.slug ? String(crew.slug) : null;
  } catch (e) {
    logger.warn("[renter-self-service-achievements] resolveCrewSlugForRental failed (non-fatal)", {
      rentalId,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile counters + unlocked-ids read (single users.metadata read).
// ─────────────────────────────────────────────────────────────────────────────
async function readProfileState(slug: string, userId: string): Promise<{
  unlocked: Set<string>;
  counters: Record<string, unknown>;
}> {
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("metadata")
    .eq("user_id", userId)
    .maybeSingle();
  const metadata = (user?.metadata || {}) as Record<string, any>;
  const profile = (metadata.franchizeProfiles || {})[slug] || {};
  const achievements = (profile.achievements || {}) as Record<string, unknown>;
  const unlocked = new Set(
    Object.entries(achievements)
      .filter(([, v]) => v != null)
      .map(([k]) => k),
  );
  return { unlocked, counters: (profile.counters || {}) as Record<string, unknown> };
}

async function tryGrant(params: {
  slug: string;
  userId: string;
  achievementId: string;
  source: string;
  rentalId: string;
  incrementCounters?: Record<string, number>;
  granted: string[];
  errors: string[];
}): Promise<void> {
  try {
    const r = await grantFranchizeAchievementAction({
      slug: params.slug,
      userId: params.userId,
      achievementId: params.achievementId,
      source: params.source,
      context: { rentalId: params.rentalId },
      incrementCounters: params.incrementCounters,
    });
    if (!r.success) {
      params.errors.push(`${params.achievementId}: ${r.error || "grant failed"}`);
    } else if (!r.alreadyUnlocked) {
      params.granted.push(params.achievementId);
    }
  } catch (e) {
    params.errors.push(
      `${params.achievementId}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

// Counter keys → badge ids (kept in one place for the combo check).
const COMBO_PARTS = [
  { counter: "webRentsCreated", badge: "rental_self_created" },
  { counter: "selfServiceStartPhotos", badge: "rental_own_photos_start" },
  { counter: "selfServiceStartOdometer", badge: "rental_own_odometer_start" },
] as const;

/** All three base conditions met (badge unlocked OR counter ≥ 1)? */
async function comboReady(
  slug: string,
  userId: string,
  justUnlocked: Set<string>,
): Promise<boolean> {
  const { unlocked, counters } = await readProfileState(slug, userId);
  for (const part of COMBO_PARTS) {
    const badgeUnlocked = unlocked.has(part.badge) || justUnlocked.has(part.badge);
    const counterValue = Number(counters[part.counter]) || 0;
    if (!badgeUnlocked && counterValue < 1) return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Web rent created (checkout webhook, renter = buyer)
// ─────────────────────────────────────────────────────────────────────────────
export async function grantRenterWebRentCreated(params: {
  userId: string;
  slug: string;
  rentalId: string;
}): Promise<{ granted: string[]; errors: string[] }> {
  const granted: string[] = [];
  const errors: string[] = [];
  const { userId, slug, rentalId } = params;
  if (!userId || !slug || !rentalId) return { granted, errors };

  try {
    const { counters } = await readProfileState(slug, userId);
    const created = (Number(counters.webRentsCreated) || 0) + 1;

    await tryGrant({
      slug,
      userId,
      achievementId: "rental_self_created",
      source: "rental:web_created",
      rentalId,
      incrementCounters: { webRentsCreated: 1 },
      granted,
      errors,
    });

    if (created >= 3) {
      await tryGrant({
        slug,
        userId,
        achievementId: "rental_self_created_3",
        source: "rental:web_created",
        rentalId,
        granted,
        errors,
      });
    }

    // Combo: rent-created + (photos) + (odometer) already true?
    const justUnlocked = new Set(granted);
    if (await comboReady(slug, userId, justUnlocked)) {
      await tryGrant({
        slug,
        userId,
        achievementId: "rental_full_selfservice",
        source: "rental:web_created",
        rentalId,
        granted,
        errors,
      });
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  if (granted.length > 0 || errors.length > 0) {
    logger.info("[renter-self-service-achievements] web rent created", {
      userId, slug, rentalId, granted, errors,
    });
  }
  return { granted, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Start odometer set by the RENTER (rental-odometer API, field:"start")
// ─────────────────────────────────────────────────────────────────────────────
export async function grantRenterStartOdometer(params: {
  userId: string;
  rentalId: string;
}): Promise<{ granted: string[]; errors: string[] }> {
  const granted: string[] = [];
  const errors: string[] = [];
  const { userId, rentalId } = params;
  if (!userId || !rentalId) return { granted, errors };

  try {
    const slug = await resolveCrewSlugForRental(rentalId);
    if (!slug) return { granted, errors };

    await tryGrant({
      slug,
      userId,
      achievementId: "rental_own_odometer_start",
      source: "rental:odometer_before_set",
      rentalId,
      incrementCounters: { selfServiceStartOdometer: 1 },
      granted,
      errors,
    });

    const justUnlocked = new Set(granted);
    if (await comboReady(slug, userId, justUnlocked)) {
      await tryGrant({
        slug,
        userId,
        achievementId: "rental_full_selfservice",
        source: "rental:odometer_before_set",
        rentalId,
        granted,
        errors,
      });
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  if (granted.length > 0 || errors.length > 0) {
    logger.info("[renter-self-service-achievements] start odometer", {
      userId, rentalId, granted, errors,
    });
  }
  return { granted, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. «ДО» photos uploaded by the RENTER to his rental + the crew-side
//    rental_photo_master catalog badge (10 rentals with photos — the trigger
//    «rental:photo_uploaded» existed in the catalog with NO grant site).
// ─────────────────────────────────────────────────────────────────────────────
export async function grantRentalPhotoAchievements(params: {
  userId: string;
  rentalId: string;
  isRenter: boolean;
  photoType: "start" | "end";
}): Promise<{ granted: string[]; errors: string[] }> {
  const granted: string[] = [];
  const errors: string[] = [];
  const { userId, rentalId, isRenter, photoType } = params;
  if (!userId || !rentalId) return { granted, errors };

  try {
    const slug = await resolveCrewSlugForRental(rentalId);
    if (!slug) return { granted, errors };

    // renter-specific «ДО» badge
    if (isRenter && photoType === "start") {
      await tryGrant({
        slug,
        userId,
        achievementId: "rental_own_photos_start",
        source: "rental:photo_uploaded",
        rentalId,
        incrementCounters: { selfServiceStartPhotos: 1 },
        granted,
        errors,
      });
    }

    // rental_photo_master — DISTINCT rentals with ANY photo from this user
    // (boss R1 #5: the badge means «фото для 10 аренд», not 10 rows — without
    // the dedupe five start + five end shots on ONE rental unlocked it).
    const { data: rentalIds } = await supabaseAdmin
      .from("rental_photos")
      .select("rental_id")
      .eq("uploaded_by", userId);
    const distinctRentals = new Set((rentalIds ?? []).map((r: { rental_id: string | null }) => r.rental_id).filter(Boolean));
    if (distinctRentals.size >= 10) {
      await tryGrant({
        slug,
        userId,
        achievementId: "rental_photo_master",
        source: "rental:photo_uploaded",
        rentalId,
        granted,
        errors,
      });
    }

    // Combo check for the renter path (photos + rent-created + odometer).
    if (isRenter && photoType === "start") {
      const justUnlocked = new Set(granted);
      if (await comboReady(slug, userId, justUnlocked)) {
        await tryGrant({
          slug,
          userId,
          achievementId: "rental_full_selfservice",
          source: "rental:photo_uploaded",
          rentalId,
          granted,
          errors,
        });
      }
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  if (granted.length > 0 || errors.length > 0) {
    logger.info("[renter-self-service-achievements] photos", {
      userId, rentalId, isRenter, photoType, granted, errors,
    });
  }
  return { granted, errors };
}
