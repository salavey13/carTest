"use client"; // Added "use client" as it uses hooks like useAppToast
import { supabaseAdmin, createAuthenticatedClient } from './supabase';
import type { Database } from "@/types/database.types";
import { debugLogger as logger } from "@/lib/debugLogger";
import { format } from 'date-fns';
// Removed useAppToast import as it's a hook and can't be used in non-component files directly.
// If toasts are needed here, they should be passed as arguments or handled by the calling component.

type DbUser = Database["public"]["Tables"]["users"]["Row"];
type UserMetadata = DbUser['metadata'];

export interface DailyActivityRecord {
  date: string; // YYYY-MM-DD
  filesExtracted: number;
  tokensProcessed: number;
  kworkRequestsSent?: number; 
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
  achievements?: string[]; 
  cognitiveOSVersion?: string;
  lastActivityTimestamp?: string;
  dailyActivityLog?: DailyActivityRecord[];
  totalFilesExtracted?: number;
  totalTokensProcessed?: number;
  totalKworkRequestsSent?: number;
  totalPrsCreated?: number;
  totalBranchesUpdated?: number;
  featuresUsed?: Record<string, boolean | number>; 
}

const CYBERFIT_METADATA_KEY = "cyberFitness";
const MAX_DAILY_LOG_ENTRIES = 7;

export interface Achievement { // Exporting Achievement type
    id: string;
    name: string;
    description: string;
    icon: string; 
    checkCondition: (profile: CyberFitnessProfile) => boolean;
}

// Exporting ALL_ACHIEVEMENTS to be accessible by other modules if needed for UI, etc.
export const ALL_ACHIEVEMENTS: Achievement[] = [
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
      level: 0, // Initialize level
      kiloVibes: 0, // Initialize kiloVibes
      focusTimeHours: 0,
      skillsLeveled: 0,
      activeQuests: [],
      completedQuests: [],
      unlockedPerks: [],
      cognitiveOSVersion: "v0.1 Initializing",
      lastActivityTimestamp: new Date(0).toISOString(), // Use a very old date for initial
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
    // Ensure all fields from defaultProfile are present if missing in existingProfile
    return {
        ...defaultProfile,
        ...existingProfile,
        dailyActivityLog: Array.isArray(existingProfile.dailyActivityLog) ? existingProfile.dailyActivityLog : defaultProfile.dailyActivityLog,
        achievements: Array.isArray(existingProfile.achievements) ? existingProfile.achievements : defaultProfile.achievements,
        featuresUsed: typeof existingProfile.featuresUsed === 'object' && existingProfile.featuresUsed !== null ? existingProfile.featuresUsed : defaultProfile.featuresUsed,
        // Ensure cumulative counters are numbers
        totalFilesExtracted: typeof existingProfile.totalFilesExtracted === 'number' ? existingProfile.totalFilesExtracted : 0,
        totalTokensProcessed: typeof existingProfile.totalTokensProcessed === 'number' ? existingProfile.totalTokensProcessed : 0,
        totalKworkRequestsSent: typeof existingProfile.totalKworkRequestsSent === 'number' ? existingProfile.totalKworkRequestsSent : 0,
        totalPrsCreated: typeof existingProfile.totalPrsCreated === 'number' ? existingProfile.totalPrsCreated : 0,
        totalBranchesUpdated: typeof existingProfile.totalBranchesUpdated === 'number' ? existingProfile.totalBranchesUpdated : 0,
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
    const newCyberFitnessProfile: CyberFitnessProfile = {
      ...existingCyberFitnessProfile, // Start with the full existing profile (with defaults)
      ...updates,                   // Apply incoming updates
      lastActivityTimestamp: new Date().toISOString(), // Always update timestamp
    };

    // Specific handling for arrays and objects to ensure proper merging, not replacement
    if (updates.dailyActivityLog) newCyberFitnessProfile.dailyActivityLog = updates.dailyActivityLog; // If updates provide full log, use it
    if (updates.achievements) newCyberFitnessProfile.achievements = Array.from(new Set([...(existingCyberFitnessProfile.achievements || []), ...updates.achievements])); // Merge achievements
    if (updates.featuresUsed) newCyberFitnessProfile.featuresUsed = {...existingCyberFitnessProfile.featuresUsed, ...updates.featuresUsed};
    if (updates.activeQuests) newCyberFitnessProfile.activeQuests = Array.from(new Set([...(existingCyberFitnessProfile.activeQuests || []), ...updates.activeQuests]));
    if (updates.completedQuests) newCyberFitnessProfile.completedQuests = Array.from(new Set([...(existingCyberFitnessProfile.completedQuests || []), ...updates.completedQuests]));
    if (updates.unlockedPerks) newCyberFitnessProfile.unlockedPerks = Array.from(new Set([...(existingCyberFitnessProfile.unlockedPerks || []), ...updates.unlockedPerks]));
    
    // Ensure cumulative counters are correctly incremented if they are part of `updates`
    // (This should ideally be handled by logCyberFitnessAction, but as a safeguard:)
    if (typeof updates.totalFilesExtracted === 'number') newCyberFitnessProfile.totalFilesExtracted = (existingCyberFitnessProfile.totalFilesExtracted || 0) + updates.totalFilesExtracted;
    if (typeof updates.totalTokensProcessed === 'number') newCyberFitnessProfile.totalTokensProcessed = (existingCyberFitnessProfile.totalTokensProcessed || 0) + updates.totalTokensProcessed;
    if (typeof updates.totalKworkRequestsSent === 'number') newCyberFitnessProfile.totalKworkRequestsSent = (existingCyberFitnessProfile.totalKworkRequestsSent || 0) + updates.totalKworkRequestsSent;
    if (typeof updates.totalPrsCreated === 'number') newCyberFitnessProfile.totalPrsCreated = (existingCyberFitnessProfile.totalPrsCreated || 0) + updates.totalPrsCreated;
    if (typeof updates.totalBranchesUpdated === 'number') newCyberFitnessProfile.totalBranchesUpdated = (existingCyberFitnessProfile.totalBranchesUpdated || 0) + updates.totalBranchesUpdated;


    // Check for new achievements based on the fully merged profile
    const newlyUnlockedAchievements: Achievement[] = [];
    const currentAchievements = new Set(newCyberFitnessProfile.achievements || []);
    for (const ach of ALL_ACHIEVEMENTS) {
        if (!currentAchievements.has(ach.id) && ach.checkCondition(newCyberFitnessProfile)) {
            currentAchievements.add(ach.id);
            newlyUnlockedAchievements.push(ach);
        }
    }
    newCyberFitnessProfile.achievements = Array.from(currentAchievements); // Update achievements list

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
      .select("*, metadata") // Ensure metadata is returned
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
  countOrDetails: number | { featureName: string } 
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
    
    let currentProfile = profileResult.data; // This is a complete profile with defaults
    let dailyLog = currentProfile.dailyActivityLog ? [...currentProfile.dailyActivityLog] : [];
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    let todayEntry = dailyLog.find(entry => entry.date === todayStr);

    if (!todayEntry) {
      todayEntry = { date: todayStr, filesExtracted: 0, tokensProcessed: 0, kworkRequestsSent: 0, prsCreated: 0, branchesUpdated: 0 };
      dailyLog.push(todayEntry);
    }
    
    // Prepare updates object
    const profileUpdates: Partial<CyberFitnessProfile> = {
        featuresUsed: { ...currentProfile.featuresUsed } // Start with existing featuresUsed
    };

    // Update daily log entry
    if (actionType === 'filesExtracted' && typeof countOrDetails === 'number') todayEntry.filesExtracted = (todayEntry.filesExtracted || 0) + countOrDetails;
    else if (actionType === 'tokensProcessed' && typeof countOrDetails === 'number') todayEntry.tokensProcessed = (todayEntry.tokensProcessed || 0) + countOrDetails;
    else if (actionType === 'kworkRequestSent' && typeof countOrDetails === 'number') todayEntry.kworkRequestsSent = (todayEntry.kworkRequestsSent || 0) + countOrDetails;
    else if (actionType === 'prCreated' && typeof countOrDetails === 'number') todayEntry.prsCreated = (todayEntry.prsCreated || 0) + countOrDetails;
    else if (actionType === 'branchUpdated' && typeof countOrDetails === 'number') todayEntry.branchesUpdated = (todayEntry.branchesUpdated || 0) + countOrDetails;

    // Update cumulative counters in the profileUpdates object
    if (actionType === 'filesExtracted' && typeof countOrDetails === 'number') profileUpdates.totalFilesExtracted = countOrDetails; // Pass delta for updateUser to handle
    if (actionType === 'tokensProcessed' && typeof countOrDetails === 'number') profileUpdates.totalTokensProcessed = countOrDetails;
    if (actionType === 'kworkRequestSent' && typeof countOrDetails === 'number') profileUpdates.totalKworkRequestsSent = countOrDetails;
    if (actionType === 'prCreated' && typeof countOrDetails === 'number') profileUpdates.totalPrsCreated = countOrDetails;
    if (actionType === 'branchUpdated' && typeof countOrDetails === 'number') profileUpdates.totalBranchesUpdated = countOrDetails;
    
    if (actionType === 'featureUsed' && typeof countOrDetails === 'object' && countOrDetails.featureName) {
        profileUpdates.featuresUsed![countOrDetails.featureName] = true;
    }

    // Sort and trim dailyLog
    dailyLog.sort((a, b) => b.date.localeCompare(a.date)); // Sort by date descending
    if (dailyLog.length > MAX_DAILY_LOG_ENTRIES) {
      dailyLog = dailyLog.slice(0, MAX_DAILY_LOG_ENTRIES);
    }
    profileUpdates.dailyActivityLog = dailyLog;

    // Pass the collected updates to updateUserCyberFitnessProfile
    // It will handle merging cumulative counters correctly and achievement checking.
    const updateResult = await updateUserCyberFitnessProfile(userId, profileUpdates);
    
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

export const checkAndUnlockFeatureAchievement = async (
    userId: string,
    featureName: keyof Exclude<CyberFitnessProfile['featuresUsed'], undefined> 
): Promise<{ success: boolean; newAchievements?: Achievement[], error?: string }> => {
    if (!userId || !featureName) return { success: false, error: "User ID and feature name required."};
    logger.log(`[CyberFitness] Checking feature achievement for user ${userId}, feature: ${featureName}`);
    
    // This will fetch the profile, set the feature as used, and then updateUser... will check all achievements
    return logCyberFitnessAction(userId, 'featureUsed', { featureName });
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
    kiloVibes: (currentProfile.kiloVibes || 0) + kiloVibesAwarded, // Correctly increment KiloVibes
    completedQuests: [questId], // Pass as delta for updateUserCyberFitnessProfile to merge
    activeQuests: (currentProfile.activeQuests || []).filter(q => q !== questId), // Remove from active
  };

  if (newLevel !== undefined && newLevel > (currentProfile.level || 0)) {
    updates.level = newLevel;
    logger.log(`[CyberFitness] User ${userId} leveled up to ${newLevel}!`);
  }
  if (newPerks && newPerks.length > 0) {
    updates.unlockedPerks = newPerks; // Pass as delta for updateUserCyberFitnessProfile to merge
    logger.log(`[CyberFitness] User ${userId} unlocked perks:`, newPerks);
  }
  
  return updateUserCyberFitnessProfile(userId, updates);
};

export const setCognitiveOSVersion = async (userId: string, version: string): Promise<{ success: boolean; data?: DbUser; error?: string; newAchievements?: Achievement[] }> => {
  return updateUserCyberFitnessProfile(userId, { cognitiveOSVersion: version });
};

export const getUserCyberLevel = async (userId: string): Promise<{ success: boolean; level?: number; error?: string }> => {
  const profileResult = await fetchUserCyberFitnessProfile(userId);
  if (!profileResult.success || typeof profileResult.data?.level !== 'number') { // check data.level explicitly
    return { success: false, level: 0, error: profileResult.error || "Level not found" };
  }
  return { success: true, level: profileResult.data.level };
};

export const getAchievementDetails = (achievementId: string): Achievement | undefined => {
    return ALL_ACHIEVEMENTS.find(ach => ach.id === achievementId);
};