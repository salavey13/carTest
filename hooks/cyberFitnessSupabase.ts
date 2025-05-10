import { supabaseAdmin, createAuthenticatedClient } from './supabase';
import type { Database } from "@/types/database.types";
import { debugLogger as logger } from "@/lib/debugLogger";
import { format } from 'date-fns';
import { useAppToast } from '@/hooks/useAppToast'; // For displaying achievement toasts

type DbUser = Database["public"]["Tables"]["users"]["Row"];
type UserMetadata = DbUser['metadata'];

export interface DailyActivityRecord {
  date: string; // YYYY-MM-DD
  filesExtracted: number;   // Files added to KWork
  tokensProcessed: number;  // Tokens from AI response
  kworkRequestsSent?: number; // Number of "Copy to KWork & Go to AI"
  prsCreated?: number;
  branchesUpdated?: number;
}

export interface CyberFitnessProfile {
  level?: number;
  kiloVibes?: number;
  focusTimeHours?: number;
  skillsLeveled?: number;
  activeQuests?: string[];
  completedQuests?: string[];
  unlockedPerks?: string[];
  achievements?: string[]; // Array of achievement IDs/names
  cognitiveOSVersion?: string;
  lastActivityTimestamp?: string;
  dailyActivityLog?: DailyActivityRecord[];
  // Cumulative counters for achievements
  totalFilesExtracted?: number;
  totalTokensProcessed?: number;
  totalKworkRequestsSent?: number;
  totalPrsCreated?: number;
  totalBranchesUpdated?: number;
  featuresUsed?: Record<string, boolean | number>; // e.g., { usedAddFullTree: true, usedSelectHighlighted: 5 }
}

const CYBERFIT_METADATA_KEY = "cyberFitness";
const MAX_DAILY_LOG_ENTRIES = 7;

interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string; // Icon name (e.g., "FaMedal")
    checkCondition: (profile: CyberFitnessProfile) => boolean;
}

const ALL_ACHIEVEMENTS: Achievement[] = [
    { id: "first_blood", name: "Первая Кровь", description: "Первая залогированная активность в CyberFitness.", icon: "FaVial", checkCondition: (p) => (p.dailyActivityLog?.length ?? 0) > 0 || (p.totalFilesExtracted ?? 0) > 0 || (p.totalTokensProcessed ?? 0) > 0 || (p.totalKworkRequestsSent ?? 0) > 0 },
    { id: "prompt_engineer_1", name: "Инженер Промптов I", description: "Отправлено 10 запросов к AI.", icon: "FaPaperPlane", checkCondition: (p) => (p.totalKworkRequestsSent ?? 0) >= 10 },
    { id: "branch_master_1", name: "Мастер Ветвления I", description: "Обновлено 5 веток.", icon: "FaCodeBranch", checkCondition: (p) => (p.totalBranchesUpdated ?? 0) >= 5 },
    { id: "pr_pioneer_1", name: "Пионер Pull Request'ов I", description: "Создано 3 PR.", icon: "FaGithub", checkCondition: (p) => (p.totalPrsCreated ?? 0) >= 3 },
    { id: "architect", name: "Архитектор Контекста", description: "Использована функция 'Добавить все файлы + дерево'.", icon: "FaTree", checkCondition: (p) => p.featuresUsed?.usedAddFullTree === true },
    { id: "sharpshooter", name: "Меткий Стрелок", description: "Использована функция 'Выбрать Связанные Файлы'.", icon: "FaCrosshairs", checkCondition: (p) => p.featuresUsed?.usedSelectHighlighted === true },
    { id: "code_explorer_1", name: "Исследователь Кода I", description: "Добавлено 100 файлов в запросы к AI.", icon: "FaSearchengin", checkCondition: (p) => (p.totalFilesExtracted ?? 0) >= 100 },
    { id: "ai_whisperer_1", name: "Заклинатель AI I", description: "Обработано 10,000 токенов AI.", icon: "FaRobot", checkCondition: (p) => (p.totalTokensProcessed ?? 0) >= 10000 },
];


const getCyberFitnessProfile = (metadata: UserMetadata | null | undefined): CyberFitnessProfile => {
  const defaultProfile: CyberFitnessProfile = { 
      dailyActivityLog: [], 
      achievements: [],
      totalFilesExtracted: 0,
      totalTokensProcessed: 0,
      totalKworkRequestsSent: 0,
      totalPrsCreated: 0,
      totalBranchesUpdated: 0,
      featuresUsed: {},
  };
  if (metadata && typeof metadata === 'object' && metadata[CYBERFIT_METADATA_KEY] && typeof metadata[CYBERFIT_METADATA_KEY] === 'object') {
    const existingProfile = metadata[CYBERFIT_METADATA_KEY] as Partial<CyberFitnessProfile>;
    return {
        ...defaultProfile,
        ...existingProfile,
        dailyActivityLog: Array.isArray(existingProfile.dailyActivityLog) ? existingProfile.dailyActivityLog : [],
        achievements: Array.isArray(existingProfile.achievements) ? existingProfile.achievements : [],
        featuresUsed: typeof existingProfile.featuresUsed === 'object' ? existingProfile.featuresUsed : {},
    };
  }
  return defaultProfile;
};

export const fetchUserCyberFitnessProfile = async (userId: string): Promise<{ success: boolean; data?: CyberFitnessProfile; error?: string }> => {
  if (!userId) return { success: false, error: "User ID is required." };
  if (!supabaseAdmin) { 
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

export const updateUserCyberFitnessProfile = async (
  userId: string,
  updates: Partial<CyberFitnessProfile>
): Promise<{ success: boolean; data?: DbUser; error?: string; newAchievements?: Achievement[] }> => {
  if (!userId) return { success: false, error: "User ID is required." };
  
  const client = await createAuthenticatedClient(userId);
  if (!client) return { success: false, error: "Failed to create authenticated client for profile update." };

  logger.log(`[CyberFitness] Attempting to update profile for user ${userId} with:`, updates);

  try {
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

    const existingOverallMetadata = currentUserData.metadata || {};
    let existingCyberFitnessProfile = getCyberFitnessProfile(existingOverallMetadata);

    // Merge updates into the cyberFitness profile
    // Make sure to handle cumulative counters correctly if they are part of `updates`
    const newCyberFitnessProfile: CyberFitnessProfile = {
      ...existingCyberFitnessProfile,
      ...updates, // This will overwrite arrays like dailyActivityLog and achievements if they are in updates
      lastActivityTimestamp: new Date().toISOString(),
    };

    // Ensure arrays are not overwritten if only partial updates for them are intended
    if (updates.dailyActivityLog) newCyberFitnessProfile.dailyActivityLog = updates.dailyActivityLog;
    if (updates.achievements) newCyberFitnessProfile.achievements = updates.achievements;
    if (updates.featuresUsed) newCyberFitnessProfile.featuresUsed = {...existingCyberFitnessProfile.featuresUsed, ...updates.featuresUsed};


    // Check for new achievements
    const newlyUnlockedAchievements: Achievement[] = [];
    for (const ach of ALL_ACHIEVEMENTS) {
        if (!newCyberFitnessProfile.achievements?.includes(ach.id) && ach.checkCondition(newCyberFitnessProfile)) {
            newCyberFitnessProfile.achievements = [...(newCyberFitnessProfile.achievements || []), ach.id];
            newlyUnlockedAchievements.push(ach);
        }
    }
    if (newlyUnlockedAchievements.length > 0) {
        logger.info(`[CyberFitness] User ${userId} unlocked new achievements:`, newlyUnlockedAchievements.map(a => a.name));
    }

    const newOverallMetadata: UserMetadata = {
      ...existingOverallMetadata,
      [CYBERFIT_METADATA_KEY]: newCyberFitnessProfile,
    };

    const { data: updatedUser, error: updateError } = await client
      .from("users")
      .update({ metadata: newOverallMetadata, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .select("*, metadata")
      .single();

    if (updateError) {
      logger.error(`[CyberFitness] Error updating profile for user ${userId}:`, updateError);
      throw updateError;
    }
    if (!updatedUser) {
      return { success: false, error: `User ${userId} not found after profile update attempt.` };
    }

    logger.log(`[CyberFitness] Successfully updated profile for user ${userId}. New profile:`, updatedUser.metadata?.[CYBERFIT_METADATA_KEY]);
    return { success: true, data: updatedUser, newAchievements: newlyUnlockedAchievements };
  } catch (e: any) {
    logger.error(`[CyberFitness] Exception during profile update for user ${userId}:`, e);
    return { success: false, error: e.message || "Failed to update CyberFitness profile." };
  }
};

export const logCyberFitnessAction = async (
  userId: string,
  actionType: 'filesExtracted' | 'tokensProcessed' | 'kworkRequestSent' | 'prCreated' | 'branchUpdated' | 'featureUsed',
  countOrDetails: number | { featureName: string } // count for most, details for featureUsed
): Promise<{ success: boolean; error?: string; newAchievements?: Achievement[] }> => {
  if (!userId) return { success: false, error: "User ID is required." };
  
  let count = 0;
  if (typeof countOrDetails === 'number') {
      count = countOrDetails;
  }
  if (count < 0 && actionType !== 'featureUsed') return { success: false, error: "Count must be non-negative." };

  logger.log(`[CyberFitness] Logging action for user ${userId}: ${actionType}, value:`, countOrDetails);

  try {
    const profileResult = await fetchUserCyberFitnessProfile(userId);
    if (!profileResult.success || !profileResult.data) {
      return { success: false, error: profileResult.error || "Failed to fetch current profile." };
    }
    
    let currentProfile = profileResult.data;
    let dailyLog = currentProfile.dailyActivityLog ? [...currentProfile.dailyActivityLog] : [];
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    let todayEntry = dailyLog.find(entry => entry.date === todayStr);

    if (!todayEntry) {
      todayEntry = { date: todayStr, filesExtracted: 0, tokensProcessed: 0, kworkRequestsSent: 0, prsCreated: 0, branchesUpdated: 0 };
      dailyLog.push(todayEntry);
    }
    
    // Update daily log
    if (actionType === 'filesExtracted' && typeof countOrDetails === 'number') todayEntry.filesExtracted = (todayEntry.filesExtracted || 0) + countOrDetails;
    else if (actionType === 'tokensProcessed' && typeof countOrDetails === 'number') todayEntry.tokensProcessed = (todayEntry.tokensProcessed || 0) + countOrDetails;
    else if (actionType === 'kworkRequestSent' && typeof countOrDetails === 'number') todayEntry.kworkRequestsSent = (todayEntry.kworkRequestsSent || 0) + countOrDetails;
    else if (actionType === 'prCreated' && typeof countOrDetails === 'number') todayEntry.prsCreated = (todayEntry.prsCreated || 0) + countOrDetails;
    else if (actionType === 'branchUpdated' && typeof countOrDetails === 'number') todayEntry.branchesUpdated = (todayEntry.branchesUpdated || 0) + countOrDetails;

    // Update cumulative counters in the profile root
    currentProfile.totalFilesExtracted = (currentProfile.totalFilesExtracted || 0) + (actionType === 'filesExtracted' && typeof countOrDetails === 'number' ? countOrDetails : 0);
    currentProfile.totalTokensProcessed = (currentProfile.totalTokensProcessed || 0) + (actionType === 'tokensProcessed' && typeof countOrDetails === 'number' ? countOrDetails : 0);
    currentProfile.totalKworkRequestsSent = (currentProfile.totalKworkRequestsSent || 0) + (actionType === 'kworkRequestSent' && typeof countOrDetails === 'number' ? countOrDetails : 0);
    currentProfile.totalPrsCreated = (currentProfile.totalPrsCreated || 0) + (actionType === 'prCreated' && typeof countOrDetails === 'number' ? countOrDetails : 0);
    currentProfile.totalBranchesUpdated = (currentProfile.totalBranchesUpdated || 0) + (actionType === 'branchUpdated' && typeof countOrDetails === 'number' ? countOrDetails : 0);
    
    if (actionType === 'featureUsed' && typeof countOrDetails === 'object' && countOrDetails.featureName) {
        currentProfile.featuresUsed = { ...currentProfile.featuresUsed, [countOrDetails.featureName]: true };
    }


    dailyLog.sort((a, b) => b.date.localeCompare(a.date));
    if (dailyLog.length > MAX_DAILY_LOG_ENTRIES) {
      dailyLog = dailyLog.slice(0, MAX_DAILY_LOG_ENTRIES);
    }
    currentProfile.dailyActivityLog = dailyLog;

    // Pass the fully updated profile to updateUserCyberFitnessProfile
    // It will handle merging and achievement checking internally.
    const updateResult = await updateUserCyberFitnessProfile(userId, currentProfile);
    
    if (!updateResult.success) {
      return { success: false, error: updateResult.error || "Failed to save updated profile." };
    }

    logger.log(`[CyberFitness] Action logged successfully for user ${userId}.`);
    return { success: true, newAchievements: updateResult.newAchievements };

  } catch (e: any) {
    logger.error(`[CyberFitness] Exception logging action for user ${userId}:`, e);
    return { success: false, error: e.message || "Failed to log CyberFitness action." };
  }
};

// Function to be called after specific UI interactions that might unlock achievements
export const checkAndUnlockFeatureAchievement = async (
    userId: string,
    featureName: keyof Exclude<CyberFitnessProfile['featuresUsed'], undefined> // e.g., 'usedAddFullTree'
): Promise<{ success: boolean; newAchievements?: Achievement[], error?: string }> => {
    if (!userId || !featureName) return { success: false, error: "User ID and feature name required."};
    logger.log(`[CyberFitness] Checking feature achievement for user ${userId}, feature: ${featureName}`);
    
    const profileResult = await fetchUserCyberFitnessProfile(userId);
    if (!profileResult.success || !profileResult.data) {
        return { success: false, error: profileResult.error || "Failed to fetch profile for achievement check." };
    }
    let currentProfile = profileResult.data;
    currentProfile.featuresUsed = { ...currentProfile.featuresUsed, [featureName]: true };

    // updateUserCyberFitnessProfile will internally call checkAndUnlockAchievements
    const updateResult = await updateUserCyberFitnessProfile(userId, { featuresUsed: currentProfile.featuresUsed });

    if (!updateResult.success) {
        return { success: false, error: updateResult.error || "Failed to update profile after feature use." };
    }
    return { success: true, newAchievements: updateResult.newAchievements };
};


export const completeQuestAndUpdateProfile = async (
  userId: string,
  questId: string,
  kiloVibesAwarded: number,
  newLevel?: number, 
  newPerks?: string[] 
): Promise<{ success: boolean; data?: DbUser; error?: string; newAchievements?: Achievement[] }> => {
  logger.log(`[CyberFitness] User ${userId} completed quest ${questId}, awarded ${kiloVibesAwarded} KiloVibes.`);

  const currentProfileResult = await fetchUserCyberFitnessProfile(userId);
  if (!currentProfileResult.success || !currentProfileResult.data) {
    return { success: false, error: currentProfileResult.error || "Failed to fetch current profile before quest completion." };
  }
  const currentProfile = currentProfileResult.data;

  const updates: Partial<CyberFitnessProfile> = {
    kiloVibes: (currentProfile.kiloVibes || 0) + kiloVibesAwarded,
    completedQuests: Array.from(new Set([...(currentProfile.completedQuests || []), questId])),
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

export const setCognitiveOSVersion = async (userId: string, version: string): Promise<{ success: boolean; data?: DbUser; error?: string; newAchievements?: Achievement[] }> => {
  return updateUserCyberFitnessProfile(userId, { cognitiveOSVersion: version });
};

export const getUserCyberLevel = async (userId: string): Promise<{ success: boolean; level?: number; error?: string }> => {
  const profileResult = await fetchUserCyberFitnessProfile(userId);
  if (!profileResult.success || !profileResult.data?.level) { // check data.level explicitly
    return { success: false, level: 0, error: profileResult.error || "Level not found" };
  }
  return { success: true, level: profileResult.data.level };
};

// Expose ALL_ACHIEVEMENTS for UI to map achievement IDs to details
export const getAchievementDetails = (achievementId: string): Achievement | undefined => {
    return ALL_ACHIEVEMENTS.find(ach => ach.id === achievementId);
};