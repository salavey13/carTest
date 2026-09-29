// app/franchize/server-actions/storage-achievements.ts
//
// 2026-09-29 — boss nuance 4: «Polish notifications, achievements, etc.
// related to winter storage, keep quality bar up».
//
// Winter storage used to be a gamification dead zone: a renter booking the
// web flow earns badges (renter-self-service-achievements.ts), an operator
// closing rents earns badges (rental-achievements.ts), but the owner who
// hands his bike over for a 7-month season earned nothing. This module
// grants the storage-side set (catalog lives in profile-actions.ts, group
// «Зимнее хранение»):
//
//   storage_first_request   «Зимовщик»        — first own storage request
//   storage_season_started  «На приколе»      — bike accepted into storage
//   storage_owner_photos    «Хроника сезона»  — owner added фотофиксация himself
//
// Same contract as the renter self-service module: every grant is idempotent
// (grantFranchizeAchievementAction skips unlocked ids but bumps counters)
// and NON-FATAL — gamification must never break the checkout or the tracking
// actions it hangs on.

import { logger } from "@/lib/logger";
import { grantFranchizeAchievementAction } from "@/app/franchize/profile-actions";

async function tryGrantStorageAchievement(params: {
  slug: string;
  userId: string | null | undefined;
  achievementId: string;
  source: string;
  context: Record<string, unknown>;
  incrementCounters?: Record<string, number>;
}): Promise<void> {
  const userId = params.userId == null ? "" : String(params.userId).trim();
  if (!userId || !/^\d+$/.test(userId)) return; // anonymous web checkout / unclaimed row
  try {
    const r = await grantFranchizeAchievementAction({
      slug: params.slug,
      userId,
      achievementId: params.achievementId,
      source: params.source,
      context: params.context,
      incrementCounters: params.incrementCounters,
    });
    if (!r.success) {
      logger.warn("[storage-achievements] grant failed (non-fatal)", {
        achievementId: params.achievementId,
        userId,
        error: r.error,
      });
    }
  } catch (e) {
    logger.warn("[storage-achievements] grant threw (non-fatal)", {
      achievementId: params.achievementId,
      userId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/** 1. Own storage request created (checkout persist block, owner known). */
export function grantStorageRequestCreated(params: {
  userId: string | null | undefined;
  slug: string;
  orderId: string | number;
  bikeId?: string | null;
}): Promise<void> {
  return tryGrantStorageAchievement({
    slug: params.slug,
    userId: params.userId,
    achievementId: "storage_first_request",
    source: "storage:web_created",
    context: { orderId: String(params.orderId), bikeId: params.bikeId ?? undefined },
    incrementCounters: { storageRequestsCreated: 1 },
  });
}

/** 2. Bike accepted into storage (status move → in_storage, owner known). */
export function grantStorageSeasonStarted(params: {
  userId: string | null | undefined;
  slug: string;
  bikeId: string;
}): Promise<void> {
  return tryGrantStorageAchievement({
    slug: params.slug,
    userId: params.userId,
    achievementId: "storage_season_started",
    source: "storage:accepted",
    context: { bikeId: params.bikeId },
  });
}

/** 3. The OWNER (not staff) added фотофиксация photos to his own bike. */
export function grantStorageOwnerPhotos(params: {
  userId: string | null | undefined;
  slug: string;
  bikeId: string;
}): Promise<void> {
  return tryGrantStorageAchievement({
    slug: params.slug,
    userId: params.userId,
    achievementId: "storage_owner_photos",
    source: "storage:owner_photos",
    context: { bikeId: params.bikeId },
    incrementCounters: { storageOwnerPhotoDrops: 1 },
  });
}
