"use server";

// Server actions for CyberFitness
// This file can ONLY be imported by server components or called from client components
// via server actions (async functions exported from this file)

import type { CyberFitnessProfile, Achievement } from '@/types/cyberFitness';
import {
  CYBERFIT_METADATA_KEY,
  MAX_DAILY_LOG_ENTRIES,
  ALL_ACHIEVEMENTS,
  QUEST_ORDER,
  LEVEL_THRESHOLDS_KV,
  COGNITIVE_OS_VERSIONS,
  PERKS_BY_LEVEL
} from '@/types/cyberFitness';
import { getCyberFitnessProfile, getDefaultCyberFitnessProfile } from './cyberFitnessShared';

// Simple console logger for server-side
const logger = {
  info: (...args: any[]) => console.log('[CyberFitness]', ...args),
  warn: (...args: any[]) => console.warn('[CyberFitness]', ...args),
  error: (...args: any[]) => console.error('[CyberFitness]', ...args),
};

// Type for database user (adjust based on your actual DB types)
type DbUser = {
  user_id: string;
  metadata?: Record<string, any> | null;
};

// Mock/placeholder for supabaseAdmin - replace with your actual implementation
// This would typically import from your supabase-server.ts file
const getSupabaseAdmin = () => {
  // Return your supabase admin client here
  throw new Error("Supabase admin client not configured - implement in your project");
};

/**
 * Fetches a user's CyberFitness profile from the database
 * Server action - can be called from client components
 */
export const fetchUserCyberFitnessProfile = async (
  userId: string
): Promise<{ success: boolean; data?: CyberFitnessProfile; error?: string }> => {
  logger.info(`[FetchProfile] Attempting to fetch profile for user_id: ${userId}`);

  if (!userId) {
    logger.warn("[FetchProfile] User ID is missing.");
    return {
      success: false,
      error: "User ID is required.",
      data: getDefaultCyberFitnessProfile()
    };
  }

  try {
    // Replace this with your actual database fetch
    // const userData = await fetchUserData(userId);
    // For now, return default profile
    const userData: DbUser | null = null;

    if (!userData) {
      logger.warn(`[FetchProfile] User ${userId} not found. Returning default profile.`);
      return {
        success: false,
        error: `User ${userId} not found.`,
        data: getCyberFitnessProfile(userId, null)
      };
    }

    const profile = getCyberFitnessProfile(userId, userData.metadata);

    logger.info(`[FetchProfile] Successfully parsed profile for user ${userId}. Level: ${profile.level}, KV: ${profile.kiloVibes}`);
    return { success: true, data: profile };

  } catch (e: any) {
    logger.error(`[FetchProfile] Exception for user ${userId}:`, e);
    return {
      success: false,
      error: e.message || "Failed to fetch profile.",
      data: getCyberFitnessProfile(userId, null)
    };
  }
};

/**
 * Updates a user's CyberFitness profile
 * Server action - can be called from client components
 */
export const updateUserCyberFitnessProfile = async (
  userId: string,
  updates: Partial<CyberFitnessProfile> & { dynamicAchievementsToAdd?: Achievement[] }
): Promise<{ success: boolean; data?: DbUser; error?: string; newAchievements?: Achievement[] }> => {
  logger.info(`[UpdateProfile] User_id: ${userId}, Updates:`, Object.keys(updates));

  if (!userId) {
    logger.warn("[UpdateProfile] User ID is missing.");
    return { success: false, error: "User ID is required." };
  }

  try {
    // Replace with your actual implementation
    // 1. Fetch current user data
    // 2. Get existing profile via getCyberFitnessProfile()
    // 3. Merge updates
    // 4. Calculate level changes, achievements, etc.
    // 5. Save to database

    // Placeholder implementation
    logger.info(`[UpdateProfile] Profile update for ${userId} would be processed here.`);
    return { success: true, newAchievements: [] };

  } catch (e: any) {
    logger.error(`[UpdateProfile] Exception for ${userId}:`, e);
    return { success: false, error: e.message || "Failed to update profile." };
  }
};

/**
 * Logs a CyberFitness action for a user
 * Server action - can be called from client components
 */
export const logCyberFitnessAction = async (
  userId: string,
  actionType: 'filesExtracted' | 'tokensProcessed' | 'kworkRequestSent' | 'prCreated' | 'branchUpdated' | 'featureUsed' | 'focusTimeAdded',
  countOrDetails: number | { featureName: string; featureValue?: string | number | boolean } | { minutes: number }
): Promise<{ success: boolean; error?: string; newAchievements?: Achievement[] }> => {
  if (!userId) {
    logger.warn("[LogAction] User ID is missing.");
    return { success: false, error: "User ID is required." };
  }

  // Calculate KiloVibes delta based on action type
  let kiloVibesDelta = 0;

  if (actionType === 'filesExtracted' && typeof countOrDetails === 'number') {
    kiloVibesDelta = countOrDetails * 0.1;
  } else if (actionType === 'tokensProcessed' && typeof countOrDetails === 'number') {
    kiloVibesDelta = countOrDetails * 0.001;
  } else if (actionType === 'kworkRequestSent' && typeof countOrDetails === 'number') {
    kiloVibesDelta = countOrDetails * 5;
  } else if (actionType === 'prCreated' && typeof countOrDetails === 'number') {
    kiloVibesDelta = countOrDetails * 50;
  } else if (actionType === 'branchUpdated' && typeof countOrDetails === 'number') {
    kiloVibesDelta = countOrDetails * 20;
  } else if (actionType === 'featureUsed' && typeof countOrDetails === 'object' && 'featureName' in countOrDetails) {
    kiloVibesDelta = 5;
  } else if (actionType === 'focusTimeAdded' && typeof countOrDetails === 'object' && 'minutes' in countOrDetails) {
    kiloVibesDelta = countOrDetails.minutes * 0.5;
  }

  logger.info(`[LogAction] Action '${actionType}' for ${userId}. KV Delta: ${kiloVibesDelta}`);

  // Replace with actual implementation
  return { success: true };
};

/**
 * Gets the user's current CyberFitness level
 * Server action - can be called from client components
 */
export const getUserCyberLevel = async (
  userId: string
): Promise<{ success: boolean; level?: number; error?: string }> => {
  if (!userId) {
    return { success: false, level: 0, error: "User ID is required." };
  }

  const profileResult = await fetchUserCyberFitnessProfile(userId);
  if (!profileResult.success || typeof profileResult.data?.level !== 'number') {
    return { success: false, level: 0, error: profileResult.error || "Failed to get level" };
  }

  return { success: true, level: profileResult.data.level };
};

/**
 * Spends KiloVibes for a user
 * Server action - can be called from client components
 */
export async function spendKiloVibes(
  userId: string,
  amount: number,
  reason: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  logger.info(`[spendKiloVibes] Spending ${amount} KV for user ${userId}. Reason: ${reason}`);

  if (!userId || !amount || amount <= 0) {
    return { success: false, error: "Invalid user ID or amount." };
  }

  // Replace with actual database transaction
  // This would use a database function to atomically deduct KV

  return { success: true, newBalance: 0 };
}

/**
 * Marks a tutorial as completed
 * Server action - can be called from client components
 */
export const markTutorialAsCompleted = async (
  userId: string,
  tutorialQuestId: string
): Promise<{ success: boolean; error?: string; newAchievements?: Achievement[]; kiloVibesAwarded?: number }> => {
  if (!userId || !tutorialQuestId) {
    return { success: false, error: "User ID and Tutorial ID required." };
  }

  const profileResult = await fetchUserCyberFitnessProfile(userId);
  if (!profileResult.success || !profileResult.data) {
    return { success: false, error: profileResult.error || "Failed to load profile." };
  }

  const currentProfile = profileResult.data;

  if (currentProfile.completedQuests.includes(tutorialQuestId)) {
    logger.info(`[MarkTutorial] Tutorial ${tutorialQuestId} already completed by ${userId}.`);
    return { success: true, kiloVibesAwarded: 0 };
  }

  const KILOVIBES_PER_TUTORIAL = 15;
  const questDefinition = ALL_ACHIEVEMENTS.find(ach => ach.id === tutorialQuestId);
  const actualKiloVibesAward = questDefinition?.kiloVibesAward ?? KILOVIBES_PER_TUTORIAL;

  const updateResult = await updateUserCyberFitnessProfile(userId, {
    kiloVibes: actualKiloVibesAward,
    completedQuests: [tutorialQuestId],
  });

  if (!updateResult.success) {
    return { success: false, error: updateResult.error || "Failed to save progress." };
  }

  return {
    success: true,
    newAchievements: updateResult.newAchievements,
    kiloVibesAwarded: actualKiloVibesAward
  };
};

/**
 * Sets the CognitiveOS version for a user
 * Server action - can be called from client components
 */
export const setCognitiveOSVersion = async (
  userId: string,
  version: string
): Promise<{ success: boolean; error?: string }> => {
  if (!userId || typeof version !== 'string') {
    return { success: false, error: "User ID and version string required." };
  }

  const result = await updateUserCyberFitnessProfile(userId, { cognitiveOSVersion: version });
  return { success: result.success, error: result.error };
};