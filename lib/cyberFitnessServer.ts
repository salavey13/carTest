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

// Import the actual database function from supabase-server
import { fetchUserData, updateUserMetadata, supabaseAdmin } from '@/lib/supabase-server';
import type { Database } from '@/types/database.types';

type DbUser = Database["public"]["Tables"]["users"]["Row"];

// Simple console logger for server-side
const logger = {
  info: (...args: any[]) => console.log('[CyberFitness]', ...args),
  warn: (...args: any[]) => console.warn('[CyberFitness]', ...args),
  error: (...args: any[]) => console.error('[CyberFitness]', ...args),
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
    // ACTUAL database fetch using the imported function
    const userData = await fetchUserData(userId);

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
    // 1. Fetch current user data
    const userData = await fetchUserData(userId);
    if (!userData) {
      return { success: false, error: `User ${userId} not found.` };
    }

    // 2. Get existing profile
    const existingProfile = getCyberFitnessProfile(userId, userData.metadata);

    // 3. Merge updates (deep merge for nested objects)
    const updatedProfile: CyberFitnessProfile = {
      ...existingProfile,
      ...updates,
      featuresUsed: {
        ...existingProfile.featuresUsed,
        ...(updates.featuresUsed || {}),
      },
      dailyActivityLog: updates.dailyActivityLog || existingProfile.dailyActivityLog,
      achievements: updates.achievements || existingProfile.achievements,
      activeQuests: updates.activeQuests || existingProfile.activeQuests,
      completedQuests: updates.completedQuests || existingProfile.completedQuests,
      unlockedPerks: updates.unlockedPerks || existingProfile.unlockedPerks,
    };

    // Handle kiloVibes as delta (additive)
    if (typeof updates.kiloVibes === 'number') {
      updatedProfile.kiloVibes = existingProfile.kiloVibes + updates.kiloVibes;
    }

    // 4. Calculate level changes
    const previousLevel = existingProfile.level;
    let newLevel = previousLevel;
    
    for (let i = LEVEL_THRESHOLDS_KV.length - 1; i >= 0; i--) {
      if (updatedProfile.kiloVibes >= LEVEL_THRESHOLDS_KV[i]) {
        newLevel = i;
        break;
      }
    }
    updatedProfile.level = newLevel;
    
    if (newLevel > previousLevel) {
      updatedProfile.cognitiveOSVersion = COGNITIVE_OS_VERSIONS[newLevel] || `v${newLevel}.0`;
    }

    // 5. Save to database via metadata
    const currentMetadata = (userData.metadata as Record<string, any>) || {};
    const newMetadata = {
      ...currentMetadata,
      [CYBERFIT_METADATA_KEY]: updatedProfile,
    };

    const result = await updateUserMetadata(userId, newMetadata);

    if (!result.success) {
      logger.error(`[UpdateProfile] Failed to update metadata for ${userId}: ${result.error}`);
      return { success: false, error: result.error || "Failed to update profile." };
    }

    logger.info(`[UpdateProfile] Profile updated for ${userId}. Level: ${updatedProfile.level}, KV: ${updatedProfile.kiloVibes}`);
    return { success: true, data: result.data, newAchievements: [] };

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
  const updates: Partial<CyberFitnessProfile> = {};

  if (actionType === 'filesExtracted' && typeof countOrDetails === 'number') {
    kiloVibesDelta = countOrDetails * 0.1;
    updates.totalFilesExtracted = countOrDetails;
  } else if (actionType === 'tokensProcessed' && typeof countOrDetails === 'number') {
    kiloVibesDelta = countOrDetails * 0.001;
    updates.totalTokensProcessed = countOrDetails;
  } else if (actionType === 'kworkRequestSent' && typeof countOrDetails === 'number') {
    kiloVibesDelta = countOrDetails * 5;
    updates.totalKworkRequestsSent = countOrDetails;
  } else if (actionType === 'prCreated' && typeof countOrDetails === 'number') {
    kiloVibesDelta = countOrDetails * 50;
    updates.totalPrsCreated = countOrDetails;
  } else if (actionType === 'branchUpdated' && typeof countOrDetails === 'number') {
    kiloVibesDelta = countOrDetails * 20;
    updates.totalBranchesUpdated = countOrDetails;
  } else if (actionType === 'featureUsed' && typeof countOrDetails === 'object' && 'featureName' in countOrDetails) {
    kiloVibesDelta = 5;
    updates.featuresUsed = {
      [countOrDetails.featureName]: countOrDetails.featureValue ?? true,
    };
  } else if (actionType === 'focusTimeAdded' && typeof countOrDetails === 'object' && 'minutes' in countOrDetails) {
    kiloVibesDelta = countOrDetails.minutes * 0.5;
    updates.focusTimeHours = countOrDetails.minutes / 60;
  }

  updates.kiloVibes = kiloVibesDelta;
  updates.lastActivityTimestamp = new Date().toISOString();

  logger.info(`[LogAction] Action '${actionType}' for ${userId}. KV Delta: ${kiloVibesDelta}`);

  const result = await updateUserCyberFitnessProfile(userId, updates);
  return { 
    success: result.success, 
    error: result.error,
    newAchievements: result.newAchievements 
  };
};


export const isQuestUnlocked = (questId: string, completedQuests: string[] | undefined, questOrder: string[]): boolean => {
  if (!questId || !questOrder || !Array.isArray(questOrder)) return false;
  if (!completedQuests) completedQuests = [];
  const questIndex = questOrder.indexOf(questId);
  if (questIndex === -1) return false;
  if (questIndex === 0) return true;
  const previousQuestId = questOrder[questIndex - 1];
  return completedQuests.includes(previousQuestId);
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

  const profileResult = await fetchUserCyberFitnessProfile(userId);
  if (!profileResult.success || !profileResult.data) {
    return { success: false, error: "Failed to fetch profile." };
  }

  const currentKV = profileResult.data.kiloVibes;
  if (currentKV < amount) {
    return { success: false, error: "Insufficient KiloVibes balance." };
  }

  // Deduct KV (negative delta)
  const result = await updateUserCyberFitnessProfile(userId, { 
    kiloVibes: -amount 
  });

  if (!result.success) {
    return { success: false, error: result.error || "Failed to deduct KiloVibes." };
  }

  const newBalance = currentKV - amount;
  return { success: true, newBalance };
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
    completedQuests: [...currentProfile.completedQuests, tutorialQuestId],
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

/**
 * Checks and unlocks a feature-based achievement
 * Server action - can be called from client components
 */
export const checkAndUnlockFeatureAchievement = async (
  userId: string,
  featureName: string,
  featureValue: string | number | boolean = true
): Promise<{ success: boolean; newAchievements?: Achievement[]; error?: string }> => {
  if (!userId || !featureName) {
    logger.warn("[CheckFeatureAchievement] User ID and feature name required.");
    return { success: false, error: "User ID and feature name required." };
  }

  const details: { featureName: string; featureValue?: string | number | boolean } = {
    featureName: String(featureName),
    featureValue: featureValue
  };

  const result = await logCyberFitnessAction(userId, 'featureUsed', details);
  return result;
};