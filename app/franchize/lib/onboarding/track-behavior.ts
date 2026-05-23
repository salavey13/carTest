/**
 * track-behavior.ts
 * =================
 * Client-side behavioral signal tracker for progressive enrichment.
 *
 * This module provides functions that VipBikeRentalClient (and other
 * franchise pages) call to accumulate micro-signals from user interactions.
 * These signals are persisted to metadata.behavior_signals via a server action.
 *
 * WHY THIS MATTERS:
 *   Survey answers capture INTENT AT ONE MOMENT.
 *   Behavioral signals capture EVOLVING INTENT over time.
 *
 *   A user who answered "sport" but has viewed electro bikes 7 times
 *   and never looked at sport bikes should gradually shift toward
 *   electro segment. The normalizer handles this.
 *
 * DESIGN:
 *   - Signals are tracked client-side and batched to the server
 *   - Debounced to avoid hammering the API on every click
 *   - Uses a server action to persist to metadata.behavior_signals
 *   - The normalizer reads behavior_signals at runtime (not cached)
 *   - Also handles experience_lock writeback for anti-thrashing
 *
 * USAGE in VipBikeRentalClient:
 *   const tracker = useBehaviorTracker();
 *   // On electro showcase view:
 *   tracker.trackViewCategory("electro");
 *   // On map interaction:
 *   tracker.trackMapOpen();
 *   // On buy click:
 *   tracker.trackBuyClick("surron-s1");
 *   // After resolving a new experience:
 *   tracker.persistExperienceLock(profile, experience);
 */

"use client";

import { useCallback, useRef } from "react";
import { useAppContext } from "@/contexts/AppContext";
import type { BehaviorSignals, VipBikeUserProfile, VipBikeExperienceConfig } from "./experience-types";
import { SCANNED_QR_MODELS_CAP } from "./experience-types";
import type { ExperienceLockState } from "./resolve-experience";
import { computeExperienceLockUpdate } from "./resolve-experience";

// ─────────────────────────────────────────────────────
// Server action for persisting behavior signals
// ─────────────────────────────────────────────────────

/**
 * Server action that merges new behavior signals into the user's metadata.
 * Uses atomic increment to avoid race conditions.
 *
 * NOTE: This is a placeholder — implement as a real server action
 * in app/franchize/actions.ts that does:
 *
 *   1. Read current metadata.behavior_signals
 *   2. Merge new counts (increment, don't replace)
 *   3. Cap scannedQrModels to SCANNED_QR_MODELS_CAP entries
 *   4. Write back with updated lastActiveAt
 */
async function persistBehaviorSignals(
  userId: string,
  delta: Partial<BehaviorSignals>,
): Promise<{ success: boolean }> {
  try {
    const response = await fetch("/api/franchize/behavior-signals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, delta }),
    });
    return { success: response.ok };
  } catch {
    return { success: false };
  }
}

/**
 * Server action that persists the updated experience_lock.
 * Called by the component after resolving a new experience.
 */
async function persistExperienceLockAction(
  userId: string,
  lockState: ExperienceLockState,
): Promise<{ success: boolean }> {
  try {
    const response = await fetch("/api/franchize/experience-lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, experience_lock: lockState }),
    });
    return { success: response.ok };
  } catch {
    return { success: false };
  }
}

// ─────────────────────────────────────────────────────
// Debounced batch persister
// ─────────────────────────────────────────────────────

/**
 * Accumulates behavior deltas and flushes them to the server
 * after a debounce period (500ms). This prevents hammering
 * the API when the user rapidly clicks through items.
 */
class BehaviorBatcher {
  private pending: Partial<BehaviorSignals> = {};
  private timer: ReturnType<typeof setTimeout> | null = null;
  private userId: string;
  private debounceMs: number;

  constructor(userId: string, debounceMs = 500) {
    this.userId = userId;
    this.debounceMs = debounceMs;
  }

  add(delta: Partial<BehaviorSignals>): void {
    // Merge numeric deltas (increment)
    for (const [key, value] of Object.entries(delta)) {
      if (typeof value === "number") {
        const current = (this.pending as Record<string, unknown>)[key] as number | undefined;
        (this.pending as Record<string, unknown>)[key] = (current ?? 0) + value;
      } else if (typeof value === "string") {
        // String fields: update to latest value (e.g., lastActiveAt)
        (this.pending as Record<string, unknown>)[key] = value;
      } else if (Array.isArray(value)) {
        // Array fields: append (e.g., scannedQrModels)
        const current = (this.pending as Record<string, unknown>)[key] as string[] | undefined;
        const merged = [...(current ?? []), ...value];
        // Cap to prevent unbounded growth
        (this.pending as Record<string, unknown>)[key] = merged.slice(-SCANNED_QR_MODELS_CAP);
      }
    }

    // Always update lastActiveAt
    this.pending.lastActiveAt = new Date().toISOString();

    // Debounce flush
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.debounceMs);
  }

  async flush(): Promise<void> {
    if (Object.keys(this.pending).length === 0) return;

    const batch = { ...this.pending };
    this.pending = {};
    this.timer = null;

    await persistBehaviorSignals(this.userId, batch);
  }

  /** Call on page unload to flush any pending signals */
  destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.flush();
    }
  }
}

// ─────────────────────────────────────────────────────
// React hook: useBehaviorTracker
// ─────────────────────────────────────────────────────

/**
 * Hook that provides behavior tracking methods for the current user.
 *
 * Usage:
 *   const tracker = useBehaviorTracker();
 *
 *   // Track category view (e.g., when user scrolls to electro showcase)
 *   tracker.trackViewCategory("electro");
 *
 *   // Track map interaction
 *   tracker.trackMapOpen();
 *
 *   // Track buy intent (e.g., clicked "Buy" or "Configure")
 *   tracker.trackBuyClick();
 *
 *   // Track rent intent (e.g., clicked "Rent" or "Book")
 *   tracker.trackRentClick();
 *
 *   // Track QR scan (from physical world → digital)
 *   tracker.trackQrScan("surron-s1");
 *
 *   // Track time on section (e.g., invest section dwell time)
 *   tracker.trackSectionDwell("investSection", 45); // 45 seconds
 *
 *   // After resolving a new experience (anti-thrashing writeback)
 *   tracker.persistExperienceLock(profile, newExperience);
 */
export function useBehaviorTracker() {
  const { dbUser } = useAppContext();
  const batcherRef = useRef<BehaviorBatcher | null>(null);

  // Initialize batcher for authenticated users
  if (dbUser && !batcherRef.current) {
    batcherRef.current = new BehaviorBatcher(dbUser.id ?? "");
  }

  const trackViewCategory = useCallback((category: "electro" | "sport" | "retro") => {
    if (!batcherRef.current) return;

    const key = category === "electro"
      ? "viewedElectroCount"
      : category === "sport"
        ? "viewedSportCount"
        : "viewedRetroCount";

    batcherRef.current.add({ [key]: 1 } as Partial<BehaviorSignals>);
  }, []);

  const trackMapOpen = useCallback(() => {
    batcherRef.current?.add({
      openedMapCount: 1,
      lastMapInteractionAt: new Date().toISOString(),
    });
  }, []);

  const trackBuyClick = useCallback((_modelId?: string) => {
    batcherRef.current?.add({
      buyIntentClickCount: 1,
      lastBuyInteractionAt: new Date().toISOString(),
    });
  }, []);

  const trackRentClick = useCallback(() => {
    batcherRef.current?.add({
      rentIntentClickCount: 1,
      lastRentInteractionAt: new Date().toISOString(),
    });
  }, []);

  const trackQrScan = useCallback((modelId: string) => {
    batcherRef.current?.add({
      scannedQrModels: [modelId], // Batcher caps at SCANNED_QR_MODELS_CAP
    });
  }, []);

  const trackSectionDwell = useCallback((sectionId: string, seconds: number) => {
    if (!batcherRef.current) return;

    if (sectionId === "investSection") {
      batcherRef.current.add({
        investSectionViewSeconds: seconds,
      });
    }
    // Add more section-specific dwell tracking as needed
  }, []);

  /**
   * Persists the updated experience_lock after a new experience is resolved.
   * This is the C2 fix: the component calls this to write back the lock state.
   *
   * Uses computeExperienceLockUpdate from resolve-experience.ts to compute
   * the lock update from raw profile signals (not derived preset names).
   */
  const persistExperienceLock = useCallback((
    profile: VipBikeUserProfile,
    experience: VipBikeExperienceConfig,
  ) => {
    if (!dbUser?.id) return;

    const previousLock = (dbUser.metadata as { experience_lock?: ExperienceLockState } | undefined)
      ?.experience_lock;
    const lockUpdate = computeExperienceLockUpdate(profile, experience, previousLock);
    persistExperienceLockAction(dbUser.id, lockUpdate);
  }, [dbUser]);

  return {
    trackViewCategory,
    trackMapOpen,
    trackBuyClick,
    trackRentClick,
    trackQrScan,
    trackSectionDwell,
    persistExperienceLock,
  };
}