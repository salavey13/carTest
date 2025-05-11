"use client"; 
import { supabaseAdmin, createAuthenticatedClient } from './supabase';
import type { Database } from "@/types/database.types";
import { debugLogger as logger } from "@/lib/debugLogger";
import { format } from 'date-fns';

type DbUser = Database["public"]["Tables"]["users"]["Row"];
type UserMetadata = DbUser['metadata'];

export interface DailyActivityRecord {
  date: string; 
  filesExtracted: number;
  tokensProcessed: number;
  kworkRequestsSent?: number; 
  prsCreated?: number;
  branchesUpdated?: number;
}

export interface CyberFitnessProfile {
  level: number; 
  kiloVibes: number; 
  focusTimeHours: number; 
  skillsLeveled: number; 
  activeQuests: string[]; 
  completedQuests: string[]; 
  unlockedPerks: string[]; 
  achievements: string[]; 
  cognitiveOSVersion: string; 
  lastActivityTimestamp: string; 
  dailyActivityLog: DailyActivityRecord[];
  totalFilesExtracted: number; 
  totalTokensProcessed: number; 
  totalKworkRequestsSent: number; 
  totalPrsCreated: number; 
  totalBranchesUpdated: number; 
  featuresUsed: Record<string, boolean | number>; 
}

const CYBERFIT_METADATA_KEY = "cyberFitness";
const MAX_DAILY_LOG_ENTRIES = 7;

export interface Achievement { 
    id: string;
    name: string;
    description: string;
    icon: string; 
    checkCondition: (profile: CyberFitnessProfile) => boolean;
}

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
      level: 0, kiloVibes: 0, focusTimeHours: 0, skillsLeveled: 0,
      activeQuests: [], completedQuests: [], unlockedPerks: [],
      cognitiveOSVersion: "v0.1 Genesis", lastActivityTimestamp: new Date(0).toISOString(), 
      dailyActivityLog: [], achievements: [],
      totalFilesExtracted: 0, totalTokensProcessed: 0, totalKworkRequestsSent: 0,
      totalPrsCreated: 0, totalBranchesUpdated: 0, featuresUsed: {},
  };

  if (metadata && typeof metadata === 'object' && metadata[CYBERFIT_METADATA_KEY] && typeof metadata[CYBERFIT_METADATA_KEY] === 'object') {
    const existingProfile = metadata[CYBERFIT_METADATA_KEY] as Partial<CyberFitnessProfile>;
    logger.debug("[CyberFitness getProfile] Raw existing profile from metadata:", existingProfile);
    const merged = {
        ...defaultProfile, ...existingProfile,
        dailyActivityLog: Array.isArray(existingProfile.dailyActivityLog) ? existingProfile.dailyActivityLog : defaultProfile.dailyActivityLog,
        achievements: Array.isArray(existingProfile.achievements) ? existingProfile.achievements : defaultProfile.achievements,
        activeQuests: Array.isArray(existingProfile.activeQuests) ? existingProfile.activeQuests : defaultProfile.activeQuests,
        completedQuests: Array.isArray(existingProfile.completedQuests) ? existingProfile.completedQuests : defaultProfile.completedQuests,
        unlockedPerks: Array.isArray(existingProfile.unlockedPerks) ? existingProfile.unlockedPerks : defaultProfile.unlockedPerks,
        featuresUsed: typeof existingProfile.featuresUsed === 'object' && existingProfile.featuresUsed !== null ? existingProfile.featuresUsed : defaultProfile.featuresUsed,
        level: typeof existingProfile.level === 'number' ? existingProfile.level : defaultProfile.level,
        kiloVibes: typeof existingProfile.kiloVibes === 'number' ? existingProfile.kiloVibes : defaultProfile.kiloVibes,
        focusTimeHours: typeof existingProfile.focusTimeHours === 'number' ? existingProfile.focusTimeHours : defaultProfile.focusTimeHours,
        skillsLeveled: typeof existingProfile.skillsLeveled === 'number' ? existingProfile.skillsLeveled : defaultProfile.skillsLeveled,
        totalFilesExtracted: typeof existingProfile.totalFilesExtracted === 'number' ? existingProfile.totalFilesExtracted : defaultProfile.totalFilesExtracted,
        totalTokensProcessed: typeof existingProfile.totalTokensProcessed === 'number' ? existingProfile.totalTokensProcessed : defaultProfile.totalTokensProcessed,
        totalKworkRequestsSent: typeof existingProfile.totalKworkRequestsSent === 'number' ? existingProfile.totalKworkRequestsSent : defaultProfile.totalKworkRequestsSent,
        totalPrsCreated: typeof existingProfile.totalPrsCreated === 'number' ? existingProfile.totalPrsCreated : defaultProfile.totalPrsCreated,
        totalBranchesUpdated: typeof existingProfile.totalBranchesUpdated === 'number' ? existingProfile.totalBranchesUpdated : defaultProfile.totalBranchesUpdated,
        cognitiveOSVersion: typeof existingProfile.cognitiveOSVersion === 'string' ? existingProfile.cognitiveOSVersion : defaultProfile.cognitiveOSVersion,
        lastActivityTimestamp: typeof existingProfile.lastActivityTimestamp === 'string' ? existingProfile.lastActivityTimestamp : defaultProfile.lastActivityTimestamp,
    };
    logger.debug("[CyberFitness getProfile] Merged profile with defaults:", merged);
    return merged;
  }
  logger.debug("[CyberFitness getProfile] No existing profile found, returning default:", defaultProfile);
  return defaultProfile;
};

export const fetchUserCyberFitnessProfile = async (userId: string): Promise<{ success: boolean; data?: CyberFitnessProfile; error?: string }> => {
  if (!userId) return { success: false, error: "User ID is required." };
  if (!supabaseAdmin) { 
    logger.error("[CyberFitness] Admin client not available for fetchUserCyberFitnessProfile.");
    return { success: false, error: "Admin client unavailable." };
  }
  logger.log(`[CyberFitness] Fetching profile for user ${userId}`);
  try {
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", userId)
      .single();

    if (userError) {
        logger.error(`[CyberFitness] Error fetching user data for ${userId} from DB:`, userError);
        throw userError;
    }
    if (!userData) {
        logger.warn(`[CyberFitness] User ${userId} not found in DB.`);
        return { success: false, error: "User not found." };
    }
    logger.debug(`[CyberFitness] Raw user metadata for ${userId}:`, userData.metadata);
    
    const profile = getCyberFitnessProfile(userData.metadata);
    logger.log(`[CyberFitness] Parsed CyberFitness profile for user ${userId}:`, profile);
    return { success: true, data: profile };
  } catch (e: any) {
    logger.error(`[CyberFitness] Exception fetching profile for user ${userId}:`, e);
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

  logger.log(`[CyberFitness Update] Attempting to update profile for user ${userId} with:`, updates);

  try {
    const { data: currentUserData, error: fetchError } = await client
      .from("users")
      .select("metadata")
      .eq("user_id", userId)
      .single();

    if (fetchError) {
      logger.error(`[CyberFitness Update] Failed to fetch current user metadata for ${userId}:`, fetchError);
      throw fetchError;
    }
    if (!currentUserData) {
      logger.warn(`[CyberFitness Update] User ${userId} not found for profile update.`);
      return { success: false, error: `User ${userId} not found for profile update.` };
    }

    const existingOverallMetadata = currentUserData.metadata || {};
    logger.debug(`[CyberFitness Update] Existing overall metadata for ${userId}:`, existingOverallMetadata);
    let existingCyberFitnessProfile = getCyberFitnessProfile(existingOverallMetadata);
    logger.debug(`[CyberFitness Update] Parsed existing CyberFitnessProfile for ${userId}:`, existingCyberFitnessProfile);


    const newCyberFitnessProfile: CyberFitnessProfile = {
      ...existingCyberFitnessProfile, 
      lastActivityTimestamp: new Date().toISOString(), 
    };

    if (updates.level !== undefined) newCyberFitnessProfile.level = updates.level;
    if (updates.kiloVibes !== undefined) newCyberFitnessProfile.kiloVibes = (existingCyberFitnessProfile.kiloVibes || 0) + updates.kiloVibes; 
    if (updates.focusTimeHours !== undefined) newCyberFitnessProfile.focusTimeHours = (existingCyberFitnessProfile.focusTimeHours || 0) + updates.focusTimeHours; 
    if (updates.skillsLeveled !== undefined) newCyberFitnessProfile.skillsLeveled = (existingCyberFitnessProfile.skillsLeveled || 0) + updates.skillsLeveled; 

    if (updates.activeQuests) newCyberFitnessProfile.activeQuests = Array.from(new Set([...(existingCyberFitnessProfile.activeQuests || []), ...updates.activeQuests]));
    if (updates.completedQuests) newCyberFitnessProfile.completedQuests = Array.from(new Set([...(existingCyberFitnessProfile.completedQuests || []), ...updates.completedQuests]));
    if (updates.unlockedPerks) newCyberFitnessProfile.unlockedPerks = Array.from(new Set([...(existingCyberFitnessProfile.unlockedPerks || []), ...updates.unlockedPerks]));
    if (updates.cognitiveOSVersion) newCyberFitnessProfile.cognitiveOSVersion = updates.cognitiveOSVersion;
    if (updates.dailyActivityLog) newCyberFitnessProfile.dailyActivityLog = updates.dailyActivityLog; 
    if (updates.featuresUsed) newCyberFitnessProfile.featuresUsed = {...existingCyberFitnessProfile.featuresUsed, ...updates.featuresUsed};
    
    if (typeof updates.totalFilesExtracted === 'number') newCyberFitnessProfile.totalFilesExtracted = (existingCyberFitnessProfile.totalFilesExtracted || 0) + updates.totalFilesExtracted;
    if (typeof updates.totalTokensProcessed === 'number') newCyberFitnessProfile.totalTokensProcessed = (existingCyberFitnessProfile.totalTokensProcessed || 0) + updates.totalTokensProcessed;
    if (typeof updates.totalKworkRequestsSent === 'number') newCyberFitnessProfile.totalKworkRequestsSent = (existingCyberFitnessProfile.totalKworkRequestsSent || 0) + updates.totalKworkRequestsSent;
    if (typeof updates.totalPrsCreated === 'number') newCyberFitnessProfile.totalPrsCreated = (existingCyberFitnessProfile.totalPrsCreated || 0) + updates.totalPrsCreated;
    if (typeof updates.totalBranchesUpdated === 'number') newCyberFitnessProfile.totalBranchesUpdated = (existingCyberFitnessProfile.totalBranchesUpdated || 0) + updates.totalBranchesUpdated;
    
    logger.debug(`[CyberFitness Update] Calculated new cumulative totals for ${userId}:`, {
        totalFilesExtracted: newCyberFitnessProfile.totalFilesExtracted,
        totalTokensProcessed: newCyberFitnessProfile.totalTokensProcessed,
        totalKworkRequestsSent: newCyberFitnessProfile.totalKworkRequestsSent,
    });

    const newlyUnlockedAchievements: Achievement[] = [];
    const currentAchievements = new Set(newCyberFitnessProfile.achievements || []);
    for (const ach of ALL_ACHIEVEMENTS) {
        if (!currentAchievements.has(ach.id) && ach.checkCondition(newCyberFitnessProfile)) {
            currentAchievements.add(ach.id);
            newlyUnlockedAchievements.push(ach);
        }
    }
    newCyberFitnessProfile.achievements = Array.from(currentAchievements);

    if (newlyUnlockedAchievements.length > 0) {
        logger.info(`[CyberFitness Update] User ${userId} unlocked new achievements:`, newlyUnlockedAchievements.map(a => a.name));
    }
    logger.debug(`[CyberFitness Update] Final new CyberFitnessProfile before saving for ${userId}:`, newCyberFitnessProfile);

    const newOverallMetadata: UserMetadata = {
      ...existingOverallMetadata,
      [CYBERFIT_METADATA_KEY]: newCyberFitnessProfile,
    };
    logger.debug(`[CyberFitness Update] Final overall metadata to be saved for ${userId}:`, newOverallMetadata);


    const { data: updatedUser, error: updateError } = await client
      .from("users")
      .update({ metadata: newOverallMetadata, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .select("*, metadata") 
      .single();

    if (updateError) {
      logger.error(`[CyberFitness Update] Error saving updated profile for user ${userId}:`, updateError);
      throw updateError;
    }
    if (!updatedUser) {
      logger.warn(`[CyberFitness Update] User ${userId} not found after profile update attempt.`);
      return { success: false, error: `User ${userId} not found after profile update attempt.` };
    }

    logger.log(`[CyberFitness Update] Successfully updated profile for user ${userId}. Saved profile in DB:`, updatedUser.metadata?.[CYBERFIT_METADATA_KEY]);
    return { success: true, data: updatedUser, newAchievements: newlyUnlockedAchievements };
  } catch (e: any) {
    logger.error(`[CyberFitness Update] Exception during profile update for user ${userId}:`, e);
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
  if (count < 0 && actionType !== 'featureUsed' && actionType !== 'tokensProcessed') {
      logger.warn(`[CyberFitness LogAction] Negative count (${count}) provided for action '${actionType}'. Correcting to 0.`);
      count = 0; // Correct negative counts for non-token actions
      if (typeof countOrDetails === 'number') countOrDetails = 0; // Update countOrDetails as well if it was the source
  }

  logger.log(`[CyberFitness LogAction] Logging action for user ${userId}: ${actionType}, value:`, countOrDetails);

  try {
    const profileResult = await fetchUserCyberFitnessProfile(userId);
    if (!profileResult.success || !profileResult.data) {
      logger.error(`[CyberFitness LogAction] Failed to fetch current profile for user ${userId}. Error: ${profileResult.error}`);
      return { success: false, error: profileResult.error || "Failed to fetch current profile." };
    }
    
    let currentProfile = profileResult.data; 
    logger.debug(`[CyberFitness LogAction] Current profile for user ${userId} before update:`, JSON.parse(JSON.stringify(currentProfile))); // Deep copy for logging

    let dailyLog = currentProfile.dailyActivityLog ? [...currentProfile.dailyActivityLog] : [];
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    let todayEntry = dailyLog.find(entry => entry.date === todayStr);

    if (!todayEntry) {
      todayEntry = { date: todayStr, filesExtracted: 0, tokensProcessed: 0, kworkRequestsSent: 0, prsCreated: 0, branchesUpdated: 0 };
      dailyLog.push(todayEntry);
      logger.debug(`[CyberFitness LogAction] Created new daily log entry for ${todayStr} for user ${userId}.`);
    }
    
    const profileUpdates: Partial<CyberFitnessProfile> = {
        featuresUsed: { ...currentProfile.featuresUsed } 
    };

    if (actionType === 'filesExtracted' && typeof countOrDetails === 'number') {
        todayEntry.filesExtracted = (todayEntry.filesExtracted || 0) + countOrDetails;
        profileUpdates.totalFilesExtracted = countOrDetails;
    } else if (actionType === 'tokensProcessed' && typeof countOrDetails === 'number') {
        todayEntry.tokensProcessed = (todayEntry.tokensProcessed || 0) + countOrDetails;
        profileUpdates.totalTokensProcessed = countOrDetails;
    } else if (actionType === 'kworkRequestSent' && typeof countOrDetails === 'number') {
        todayEntry.kworkRequestsSent = (todayEntry.kworkRequestsSent || 0) + countOrDetails;
        profileUpdates.totalKworkRequestsSent = countOrDetails;
    } else if (actionType === 'prCreated' && typeof countOrDetails === 'number') {
        todayEntry.prsCreated = (todayEntry.prsCreated || 0) + countOrDetails;
        profileUpdates.totalPrsCreated = countOrDetails;
    } else if (actionType === 'branchUpdated' && typeof countOrDetails === 'number') {
        todayEntry.branchesUpdated = (todayEntry.branchesUpdated || 0) + countOrDetails;
        profileUpdates.totalBranchesUpdated = countOrDetails;
    } else if (actionType === 'featureUsed' && typeof countOrDetails === 'object' && countOrDetails.featureName) {
        profileUpdates.featuresUsed![countOrDetails.featureName] = true;
    }
    logger.debug(`[CyberFitness LogAction] Today's entry for ${userId} after update:`, todayEntry);
    logger.debug(`[CyberFitness LogAction] Profile updates to be passed for ${userId}:`, profileUpdates);


    dailyLog.sort((a, b) => b.date.localeCompare(a.date)); 
    if (dailyLog.length > MAX_DAILY_LOG_ENTRIES) {
      dailyLog = dailyLog.slice(0, MAX_DAILY_LOG_ENTRIES);
    }
    profileUpdates.dailyActivityLog = dailyLog;

    const updateResult = await updateUserCyberFitnessProfile(userId, profileUpdates);
    
    if (!updateResult.success) {
      logger.error(`[CyberFitness LogAction] Failed to save updated profile for user ${userId}. Error: ${updateResult.error}`);
      return { success: false, error: updateResult.error || "Failed to save updated profile." };
    }

    logger.log(`[CyberFitness LogAction] Action logged successfully for user ${userId}. New achievements:`, updateResult.newAchievements?.map(a => a.id));
    return { success: true, newAchievements: updateResult.newAchievements };

  } catch (e: any) {
    logger.error(`[CyberFitness LogAction] Exception logging action for user ${userId}:`, e);
    return { success: false, error: e.message || "Failed to log CyberFitness action." };
  }
};

export const checkAndUnlockFeatureAchievement = async (
    userId: string,
    featureName: keyof Exclude<CyberFitnessProfile['featuresUsed'], undefined> 
): Promise<{ success: boolean; newAchievements?: Achievement[], error?: string }> => {
    if (!userId || !featureName) return { success: false, error: "User ID and feature name required."};
    logger.log(`[CyberFitness] Checking feature achievement for user ${userId}, feature: ${featureName}`);
    return logCyberFitnessAction(userId, 'featureUsed', { featureName });
};

export const completeQuestAndUpdateProfile = async (
  userId: string,
  questId: string,
  kiloVibesAwarded: number,
  newLevel?: number, 
  newPerks?: string[] 
): Promise<{ success: boolean; data?: DbUser; error?: string; newAchievements?: Achievement[] }> => {
  logger.log(`[CyberFitness QuestComplete] User ${userId} completed quest ${questId}, awarded ${kiloVibesAwarded} KiloVibes.`);

  const currentProfileResult = await fetchUserCyberFitnessProfile(userId);
  if (!currentProfileResult.success || !currentProfileResult.data) {
    logger.error(`[CyberFitness QuestComplete] Failed to fetch current profile for ${userId} before quest completion. Error: ${currentProfileResult.error}`);
    return { success: false, error: currentProfileResult.error || "Failed to fetch current profile before quest completion." };
  }
  const currentProfile = currentProfileResult.data;

  const updates: Partial<CyberFitnessProfile> = {
    kiloVibes: kiloVibesAwarded, 
    completedQuests: [questId], 
    activeQuests: (currentProfile.activeQuests || []).filter(q => q !== questId), 
  };

  if (newLevel !== undefined && newLevel > (currentProfile.level || 0)) {
    updates.level = newLevel; 
    logger.log(`[CyberFitness QuestComplete] User ${userId} leveled up to ${newLevel}!`);
  }
  if (newPerks && newPerks.length > 0) {
    updates.unlockedPerks = newPerks; 
    logger.log(`[CyberFitness QuestComplete] User ${userId} unlocked perks:`, newPerks);
  }
  logger.debug(`[CyberFitness QuestComplete] Profile updates for ${userId}:`, updates);
  return updateUserCyberFitnessProfile(userId, updates);
};

export const setCognitiveOSVersion = async (userId: string, version: string): Promise<{ success: boolean; data?: DbUser; error?: string; newAchievements?: Achievement[] }> => {
  logger.log(`[CyberFitness OSVersion] Setting Cognitive OS version for ${userId} to: ${version}`);
  return updateUserCyberFitnessProfile(userId, { cognitiveOSVersion: version });
};

export const getUserCyberLevel = async (userId: string): Promise<{ success: boolean; level?: number; error?: string }> => {
  const profileResult = await fetchUserCyberFitnessProfile(userId);
  if (!profileResult.success || typeof profileResult.data?.level !== 'number') { 
    logger.warn(`[CyberFitness GetLevel] Failed to get level for ${userId}. Error: ${profileResult.error}`);
    return { success: false, level: 0, error: profileResult.error || "Level not found" };
  }
  logger.debug(`[CyberFitness GetLevel] Level for ${userId} is ${profileResult.data.level}`);
  return { success: true, level: profileResult.data.level };
};

export const getAchievementDetails = (achievementId: string): Achievement | undefined => {
    return ALL_ACHIEVEMENTS.find(ach => ach.id === achievementId);
};