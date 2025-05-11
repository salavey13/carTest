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
    // Quest Achievements - their checkCondition is false as they are awarded directly
    { id: "first_fetch_completed", name: "Квест: Первая Загрузка", description: "Успешно загружены файлы из репозитория.", icon: "FaDownload", checkCondition: () => false },
    { id: "first_parse_completed", name: "Квест: Первый Парсинг", description: "Успешно разобран ответ от AI.", icon: "FaCode", checkCondition: () => false },
    { id: "first_pr_created", name: "Квест: Первый PR", description: "Успешно создан Pull Request.", icon: "FaGithub", checkCondition: () => false },
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
    return merged;
  }
  return defaultProfile;
};

export const fetchUserCyberFitnessProfile = async (userId: string): Promise<{ success: boolean; data?: CyberFitnessProfile; error?: string }> => {
  logger.log(`[CyberFitness FetchProfile ENTRY] Fetching profile for user: ${userId}`);
  if (!userId) {
    logger.warn("[CyberFitness FetchProfile] User ID is required.");
    return { success: false, error: "User ID is required." };
  }
  if (!supabaseAdmin) { 
    logger.error("[CyberFitness FetchProfile] Admin client not available.");
    return { success: false, error: "Admin client unavailable." };
  }
  
  try {
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", userId)
      .single();

    if (userError) {
        logger.error(`[CyberFitness FetchProfile] Supabase error fetching user data for ${userId}:`, userError);
        return { success: false, error: userError.message, data: getCyberFitnessProfile(null) }; 
    }
    if (!userData) {
        logger.warn(`[CyberFitness FetchProfile] User ${userId} not found in DB. Returning default profile.`);
        return { success: true, data: getCyberFitnessProfile(null) }; 
    }
    
    const profile = getCyberFitnessProfile(userData.metadata);
    logger.log(`[CyberFitness FetchProfile EXIT] Parsed CyberFitness profile for user ${userId}. Level: ${profile.level}, KiloVibes: ${profile.kiloVibes}`);
    return { success: true, data: profile };
  } catch (e: any) {
    logger.error(`[CyberFitness FetchProfile CATCH] Exception fetching profile for user ${userId}:`, e);
    return { success: false, error: e.message || "Failed to fetch CyberFitness profile.", data: getCyberFitnessProfile(null) }; 
  }
};

export const updateUserCyberFitnessProfile = async (
  userId: string,
  updates: Partial<CyberFitnessProfile>
): Promise<{ success: boolean; data?: DbUser; error?: string; newAchievements?: Achievement[] }> => {
  logger.log(`[CyberFitness UpdateProfile ENTRY] User: ${userId}, Updates:`, updates);
  if (!userId) {
    logger.warn("[CyberFitness UpdateProfile] User ID is required.");
    return { success: false, error: "User ID is required." };
  }
  
  const client = await createAuthenticatedClient(userId);
  if (!client) {
    logger.error("[CyberFitness UpdateProfile] Failed to create authenticated client.");
    return { success: false, error: "Failed to create authenticated client for profile update." };
  }

  try {
    const { data: currentUserData, error: fetchError } = await client
      .from("users")
      .select("metadata")
      .eq("user_id", userId)
      .single();

    if (fetchError) {
      logger.error(`[CyberFitness UpdateProfile] Failed to fetch current metadata for ${userId}:`, fetchError);
      throw fetchError;
    }
    if (!currentUserData) {
      logger.warn(`[CyberFitness UpdateProfile] User ${userId} not found for update.`);
      return { success: false, error: `User ${userId} not found for profile update.` };
    }

    const existingOverallMetadata = currentUserData.metadata || {};
    let existingCyberFitnessProfile = getCyberFitnessProfile(existingOverallMetadata);

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
        logger.info(`[CyberFitness UpdateProfile] User ${userId} unlocked new achievements:`, newlyUnlockedAchievements.map(a => a.name));
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
      logger.error(`[CyberFitness UpdateProfile] Error saving updated profile for ${userId}:`, updateError);
      throw updateError;
    }
    if (!updatedUser) {
      logger.warn(`[CyberFitness UpdateProfile] User ${userId} not found after update attempt.`);
      return { success: false, error: `User ${userId} not found after profile update attempt.` };
    }

    logger.log(`[CyberFitness UpdateProfile EXIT] Successfully updated profile for ${userId}. New KiloVibes: ${newCyberFitnessProfile.kiloVibes}`);
    return { success: true, data: updatedUser, newAchievements: newlyUnlockedAchievements };
  } catch (e: any) {
    logger.error(`[CyberFitness UpdateProfile CATCH] Exception for ${userId}:`, e);
    return { success: false, error: e.message || "Failed to update CyberFitness profile." };
  }
};

export const logCyberFitnessAction = async (
  userId: string,
  actionType: 'filesExtracted' | 'tokensProcessed' | 'kworkRequestSent' | 'prCreated' | 'branchUpdated' | 'featureUsed',
  countOrDetails: number | { featureName: string } 
): Promise<{ success: boolean; error?: string; newAchievements?: Achievement[] }> => {
  logger.log(`[CyberFitness LogAction ENTRY] User: ${userId}, Action: ${actionType}, Value:`, countOrDetails);
  if (!userId) {
    logger.warn("[CyberFitness LogAction] User ID is required.");
    return { success: false, error: "User ID is required." };
  }
  
  let count = 0;
  if (typeof countOrDetails === 'number') {
      count = countOrDetails;
  }
  if (count < 0 && actionType !== 'featureUsed' && actionType !== 'tokensProcessed') {
      logger.warn(`[CyberFitness LogAction] Negative count (${count}) for '${actionType}'. Correcting to 0.`);
      count = 0;
      if (typeof countOrDetails === 'number') countOrDetails = 0;
  }

  try {
    const profileResult = await fetchUserCyberFitnessProfile(userId);
    if (!profileResult.success || !profileResult.data) {
      logger.error(`[CyberFitness LogAction] Failed to fetch profile for ${userId}. Error: ${profileResult.error}`);
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
        todayEntry.prsCreated = (todayEntry.prsCreated || 0) + countOrDetails; // Update daily log
        profileUpdates.totalPrsCreated = countOrDetails; // This is an increment
    } else if (actionType === 'branchUpdated' && typeof countOrDetails === 'number') {
        todayEntry.branchesUpdated = (todayEntry.branchesUpdated || 0) + countOrDetails; // Update daily log
        profileUpdates.totalBranchesUpdated = countOrDetails; // This is an increment
    } else if (actionType === 'featureUsed' && typeof countOrDetails === 'object' && countOrDetails.featureName) {
        profileUpdates.featuresUsed![countOrDetails.featureName] = true;
    }

    dailyLog.sort((a, b) => b.date.localeCompare(a.date)); 
    if (dailyLog.length > MAX_DAILY_LOG_ENTRIES) {
      dailyLog = dailyLog.slice(0, MAX_DAILY_LOG_ENTRIES);
    }
    profileUpdates.dailyActivityLog = dailyLog;

    const updateResult = await updateUserCyberFitnessProfile(userId, profileUpdates);
    
    if (!updateResult.success) {
      logger.error(`[CyberFitness LogAction] Failed to save profile for ${userId}. Error: ${updateResult.error}`);
      return { success: false, error: updateResult.error || "Failed to save updated profile." };
    }

    logger.log(`[CyberFitness LogAction EXIT] Action logged for ${userId}. New achievements:`, updateResult.newAchievements?.map(a => a.id));
    return { success: true, newAchievements: updateResult.newAchievements };

  } catch (e: any) {
    logger.error(`[CyberFitness LogAction CATCH] Exception for ${userId}:`, e);
    return { success: false, error: e.message || "Failed to log CyberFitness action." };
  }
};

export const checkAndUnlockFeatureAchievement = async (
    userId: string,
    featureName: keyof Exclude<CyberFitnessProfile['featuresUsed'], undefined> 
): Promise<{ success: boolean; newAchievements?: Achievement[], error?: string }> => {
    logger.log(`[CyberFitness CheckFeatureAchievement ENTRY] User: ${userId}, Feature: ${featureName}`);
    if (!userId || !featureName) {
        logger.warn("[CyberFitness CheckFeatureAchievement] User ID and feature name required.");
        return { success: false, error: "User ID and feature name required."};
    }
    const result = await logCyberFitnessAction(userId, 'featureUsed', { featureName });
    logger.log(`[CyberFitness CheckFeatureAchievement EXIT] Result for ${featureName}:`, result.success, "New achievements:", result.newAchievements?.map(a=>a.id));
    return result;
};

export const completeQuestAndUpdateProfile = async (
  userId: string,
  questId: string,
  kiloVibesAwarded: number,
  newLevel?: number, 
  newPerks?: string[] 
): Promise<{ success: boolean; data?: DbUser; error?: string; newAchievements?: Achievement[] }> => {
  logger.log(`[CyberFitness QuestComplete ENTRY] User: ${userId}, Quest: ${questId}, KiloVibes: ${kiloVibesAwarded}, Lvl?: ${newLevel}, Perks?:`, newPerks);

  const currentProfileResult = await fetchUserCyberFitnessProfile(userId);
  if (!currentProfileResult.success || !currentProfileResult.data) {
    logger.error(`[CyberFitness QuestComplete] Failed to fetch profile for ${userId}. Error: ${currentProfileResult.error}`);
    return { success: false, error: currentProfileResult.error || "Failed to fetch current profile before quest completion." };
  }
  const currentProfile = currentProfileResult.data;

  const updates: Partial<CyberFitnessProfile> = {
    kiloVibes: kiloVibesAwarded, 
    completedQuests: [questId], 
    activeQuests: (currentProfile.activeQuests || []).filter(q => q !== questId), 
  };

  // Only update level if newLevel is higher than current level
  if (newLevel !== undefined && newLevel > (currentProfile.level || 0)) {
    updates.level = newLevel; 
    logger.log(`[CyberFitness QuestComplete] User ${userId} leveled up to ${newLevel}!`);
  } else if (newLevel !== undefined) {
    logger.log(`[CyberFitness QuestComplete] User ${userId} (Lvl ${currentProfile.level}) completed quest for Lvl ${newLevel}. Level not changed as it's not higher.`);
  }

  if (newPerks && newPerks.length > 0) {
    updates.unlockedPerks = newPerks; 
    logger.log(`[CyberFitness QuestComplete] User ${userId} unlocked perks:`, newPerks);
  }
  const result = await updateUserCyberFitnessProfile(userId, updates);
  logger.log(`[CyberFitness QuestComplete EXIT] Update result for ${questId}:`, result.success, "New achievements:", result.newAchievements?.map(a=>a.id));
  return result;
};

export const setCognitiveOSVersion = async (userId: string, version: string): Promise<{ success: boolean; data?: DbUser; error?: string; newAchievements?: Achievement[] }> => {
  logger.log(`[CyberFitness OSVersion] Setting Cognitive OS version for ${userId} to: ${version}`);
  return updateUserCyberFitnessProfile(userId, { cognitiveOSVersion: version });
};

export const getUserCyberLevel = async (userId: string): Promise<{ success: boolean; level?: number; error?: string }> => {
  logger.log(`[CyberFitness GetLevel ENTRY] Getting level for user: ${userId}`);
  const profileResult = await fetchUserCyberFitnessProfile(userId);
  if (!profileResult.success || typeof profileResult.data?.level !== 'number') { 
    logger.warn(`[CyberFitness GetLevel] Failed to get level for ${userId}. Error: ${profileResult.error}`);
    return { success: false, level: 0, error: profileResult.error || "Level not found" };
  }
  logger.log(`[CyberFitness GetLevel EXIT] Level for ${userId} is ${profileResult.data.level}`);
  return { success: true, level: profileResult.data.level };
};

export const getAchievementDetails = (achievementId: string): Achievement | undefined => {
    return ALL_ACHIEVEMENTS.find(ach => ach.id === achievementId);
};