import { supabaseAdmin, supabaseAnon, createAuthenticatedClient } from './supabase'; // Предполагаем, что основной supabase.ts в том же каталоге
import type { Database } from "@/types/database.types";
import { debugLogger as logger } from "@/lib/debugLogger"; // Используем debugLogger для консистентности

type DbUser = Database["public"]["Tables"]["users"]["Row"];
type UserMetadata = DbUser['metadata'];

// --- CyberFitness Specific Metadata Structure (within user.metadata) ---
export interface CyberFitnessProfile {
  level?: number;                   // Current CyberDev Level (0-15+)
  kiloVibes?: number;               // Total "KiloVibes" or XP
  focusTimeHours?: number;          // Total accumulated focus time
  skillsLeveled?: number;           // Number of distinct skills/perks leveled up
  activeQuests?: string[];          // IDs or names of active quests
  completedQuests?: string[];       // IDs or names of completed quests
  unlockedPerks?: string[];         // List of unlocked Vibe Perks
  cognitiveOSVersion?: string;      // e.g., "v2.0 CyberVice Edition"
  lastActivityTimestamp?: string;   // ISO string of last recorded activity
  weeklyActivity?: { day: string; value: number; label?: string }[]; // For the chart on homepage
  // Add more CyberFitness related fields as needed
}

const CYBERFIT_METADATA_KEY = "cyberFitness"; // Key to store all cyberfitness data under

// --- Helper to safely get and update nested metadata ---
const getCyberFitnessProfile = (metadata: UserMetadata | null | undefined): CyberFitnessProfile => {
  if (metadata && typeof metadata === 'object' && metadata[CYBERFIT_METADATA_KEY] && typeof metadata[CYBERFIT_METADATA_KEY] === 'object') {
    return metadata[CYBERFIT_METADATA_KEY] as CyberFitnessProfile;
  }
  return {};
};

// --- Fetch Full CyberFitness Profile ---
export const fetchUserCyberFitnessProfile = async (userId: string): Promise<{ success: boolean; data?: CyberFitnessProfile; error?: string }> => {
  if (!userId) return { success: false, error: "User ID is required." };
  if (!supabaseAdmin) { // Use admin client for reading full user data initially
    logger.error("Admin client not available for fetchUserCyberFitnessProfile.");
    return { success: false, error: "Admin client unavailable." };
  }
  logger.log(`[CyberFitness] Fetching profile for user ${userId}`);
  try {
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", userId)
      .single();

    if (userError) throw userError;
    if (!userData) return { success: false, error: "User not found." };
    
    const profile = getCyberFitnessProfile(userData.metadata);
    logger.log(`[CyberFitness] Profile for user ${userId}:`, profile);
    return { success: true, data: profile };
  } catch (e: any) {
    logger.error(`[CyberFitness] Error fetching profile for user ${userId}:`, e);
    return { success: false, error: e.message || "Failed to fetch CyberFitness profile." };
  }
};


// --- Update CyberFitness Profile Data ---
// This function will merge new data with existing cyberFitness data,
// and then merge that with the overall user metadata.
export const updateUserCyberFitnessProfile = async (
  userId: string,
  updates: Partial<CyberFitnessProfile>
): Promise<{ success: boolean; data?: DbUser; error?: string }> => {
  if (!userId) return { success: false, error: "User ID is required." };
  
  const client = await createAuthenticatedClient(userId);
  if (!client) return { success: false, error: "Failed to create authenticated client for profile update." };

  logger.log(`[CyberFitness] Attempting to update profile for user ${userId} with:`, updates);

  try {
    // 1. Fetch current user data, including all metadata
    const { data: currentUserData, error: fetchError } = await client
      .from("users")
      .select("metadata")
      .eq("user_id", userId)
      .single();

    if (fetchError) {
      logger.error(`[CyberFitness] Failed to fetch current user metadata for ${userId}:`, fetchError);
      throw fetchError;
    }
    if (!currentUserData) {
      return { success: false, error: `User ${userId} not found for profile update.` };
    }

    // 2. Safely get existing cyberFitness profile or initialize if not present
    const existingOverallMetadata = currentUserData.metadata || {};
    const existingCyberFitnessProfile = getCyberFitnessProfile(existingOverallMetadata);

    // 3. Merge updates into the cyberFitness profile
    const updatedCyberFitnessProfile: CyberFitnessProfile = {
      ...existingCyberFitnessProfile,
      ...updates,
      lastActivityTimestamp: new Date().toISOString(), // Always update last activity
    };

    // 4. Construct the new overall metadata object
    const newOverallMetadata: UserMetadata = {
      ...existingOverallMetadata, // Preserve other metadata
      [CYBERFIT_METADATA_KEY]: updatedCyberFitnessProfile, // Place updated cyberFitness data under its key
    };

    // 5. Update the user with the new combined metadata
    const { data: updatedUser, error: updateError } = await client
      .from("users")
      .update({ metadata: newOverallMetadata, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .select("*, metadata") // Select all fields including the updated metadata
      .single();

    if (updateError) {
      logger.error(`[CyberFitness] Error updating profile for user ${userId}:`, updateError);
      throw updateError;
    }
    if (!updatedUser) {
      return { success: false, error: `User ${userId} not found after profile update attempt.` };
    }

    logger.log(`[CyberFitness] Successfully updated profile for user ${userId}. New profile:`, updatedUser.metadata?.[CYBERFIT_METADATA_KEY]);
    return { success: true, data: updatedUser };
  } catch (e: any) {
    logger.error(`[CyberFitness] Exception during profile update for user ${userId}:`, e);
    return { success: false, error: e.message || "Failed to update CyberFitness profile." };
  }
};

// --- Example: Log Quest Completion & Update KiloVibes/Level ---
export const completeQuestAndUpdateProfile = async (
  userId: string,
  questId: string,
  kiloVibesAwarded: number,
  newLevel?: number, // Optional: if completing a quest also levels up
  newPerks?: string[] // Optional: new perks unlocked
): Promise<{ success: boolean; data?: DbUser; error?: string }> => {
  logger.log(`[CyberFitness] User ${userId} completed quest ${questId}, awarded ${kiloVibesAwarded} KiloVibes.`);

  // Fetch current profile to increment values correctly
  const currentProfileResult = await fetchUserCyberFitnessProfile(userId);
  if (!currentProfileResult.success || !currentProfileResult.data) {
    return { success: false, error: currentProfileResult.error || "Failed to fetch current profile before quest completion." };
  }
  const currentProfile = currentProfileResult.data;

  const updates: Partial<CyberFitnessProfile> = {
    kiloVibes: (currentProfile.kiloVibes || 0) + kiloVibesAwarded,
    completedQuests: Array.from(new Set([...(currentProfile.completedQuests || []), questId])),
    // Remove from active if it was there
    activeQuests: (currentProfile.activeQuests || []).filter(q => q !== questId),
  };

  if (newLevel !== undefined && newLevel > (currentProfile.level || 0)) {
    updates.level = newLevel;
    logger.log(`[CyberFitness] User ${userId} leveled up to ${newLevel}!`);
  }
  if (newPerks && newPerks.length > 0) {
    updates.unlockedPerks = Array.from(new Set([...(currentProfile.unlockedPerks || []), ...newPerks]));
    logger.log(`[CyberFitness] User ${userId} unlocked perks:`, newPerks);
  }
  
  return updateUserCyberFitnessProfile(userId, updates);
};

// --- Function to update weekly activity data ---
// This would likely be called more granularly, e.g., after each significant action
export const logCyberFitnessActivity = async (
  userId: string,
  activityValue: number, // e.g., KiloVibes for the day or task
  activityLabel?: string // Optional label for the activity
): Promise<{ success: boolean; data?: DbUser; error?: string }> => {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(); // MO, TU, etc.
  
  const currentProfileResult = await fetchUserCyberFitnessProfile(userId);
   if (!currentProfileResult.success || !currentProfileResult.data) {
    return { success: false, error: currentProfileResult.error || "Failed to fetch current profile before logging activity." };
  }
  const currentProfile = currentProfileResult.data;
  
  let weeklyActivity = [...(currentProfile.weeklyActivity || [])];
  const todayIndex = weeklyActivity.findIndex(item => item.day === today);

  if (todayIndex > -1) {
    weeklyActivity[todayIndex].value += activityValue;
    if(activityLabel) weeklyActivity[todayIndex].label = activityLabel; // Update label if provided
  } else {
    // If no entry for today, or to reset weekly, you might need more complex logic here
    // For simplicity, this example adds/updates today.
    // A more robust system might prune old entries or ensure only last 7 days are kept.
    weeklyActivity.push({ day: today, value: activityValue, label: activityLabel });
    // Simple way to keep it to ~7 entries, by removing the oldest if > 7
    if(weeklyActivity.length > 7) weeklyActivity.shift();
  }
  
  const updates: Partial<CyberFitnessProfile> = { weeklyActivity };
  return updateUserCyberFitnessProfile(userId, updates);
};


// --- Update Cognitive OS Version (Example of a specific update) ---
export const setCognitiveOSVersion = async (userId: string, version: string): Promise<{ success: boolean; data?: DbUser; error?: string }> => {
  return updateUserCyberFitnessProfile(userId, { cognitiveOSVersion: version });
};

// --- Fetch user's current CyberDev Level ---
export const getUserCyberLevel = async (userId: string): Promise<{ success: boolean; level?: number; error?: string }> => {
  const profileResult = await fetchUserCyberFitnessProfile(userId);
  if (!profileResult.success) {
    return { success: false, error: profileResult.error };
  }
  return { success: true, level: profileResult.data?.level || 0 };
};

// Add more functions as needed:
// - Functions to start/add quests
// - Functions to update specific skills or perks
// - Functions to get leaderboard data (if you implement that)