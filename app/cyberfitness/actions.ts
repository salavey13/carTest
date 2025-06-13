"use server";

import { supabaseAdmin } from '@/hooks/supabase'; 
import { updateUserMetadata as genericUpdateUserMetadata, fetchUserData as genericFetchUserData } from '@/hooks/supabase'; 
import type { Database } from "@/types/database.types";
import { debugLogger as logger } from "@/lib/debugLogger";
import { format } from 'date-fns';
import { 
    CyberFitnessProfile,
    Achievement,
    QUEST_ORDER,
    LEVEL_THRESHOLDS_KV,
    COGNITIVE_OS_VERSIONS,
    PERKS_BY_LEVEL,
    ALL_ACHIEVEMENTS,
    CYBERFIT_METADATA_KEY,
    MAX_DAILY_LOG_ENTRIES,
    getAchievementDetails
} from '@/hooks/cyberFitnessSupabase'; // Importing types and client-safe constants/helpers

type DbUser = Database["public"]["Tables"]["users"]["Row"];
type UserMetadata = DbUser['metadata'];

const getDefaultCyberFitnessProfile = (): CyberFitnessProfile => ({
    level: 0, kiloVibes: 0, focusTimeHours: 0, skillsLeveled: 0,
    activeQuests: [QUEST_ORDER[0]], 
    completedQuests: [], unlockedPerks: [],
    cognitiveOSVersion: COGNITIVE_OS_VERSIONS[0], lastActivityTimestamp: new Date(0).toISOString(), 
    dailyActivityLog: [], achievements: [],
    totalFilesExtracted: 0, totalTokensProcessed: 0, totalKworkRequestsSent: 0,
    totalPrsCreated: 0, totalBranchesUpdated: 0, featuresUsed: {},
});

const getCyberFitnessProfile = (userId: string | null, metadata: UserMetadata | null | undefined): CyberFitnessProfile => {
  const defaultProfile = getDefaultCyberFitnessProfile();
  let finalProfile = { ...defaultProfile }; 

  if (metadata && typeof metadata === 'object' && metadata[CYBERFIT_METADATA_KEY] && typeof metadata[CYBERFIT_METADATA_KEY] === 'object') {
    const existingProfile = metadata[CYBERFIT_METADATA_KEY] as Partial<CyberFitnessProfile>;
    finalProfile = {
        ...defaultProfile, 
        ...existingProfile, 
        dailyActivityLog: Array.isArray(existingProfile.dailyActivityLog) ? existingProfile.dailyActivityLog.map(log => ({ 
            date: log.date,
            filesExtracted: log.filesExtracted || 0,
            tokensProcessed: log.tokensProcessed || 0,
            kworkRequestsSent: log.kworkRequestsSent || 0,
            prsCreated: log.prsCreated || 0,
            branchesUpdated: log.branchesUpdated || 0,
            focusTimeMinutes: log.focusTimeMinutes || 0,
        })) : defaultProfile.dailyActivityLog,
        achievements: Array.isArray(existingProfile.achievements) ? existingProfile.achievements : defaultProfile.achievements,
        activeQuests: Array.isArray(existingProfile.activeQuests) ? existingProfile.activeQuests : defaultProfile.activeQuests,
        completedQuests: Array.isArray(existingProfile.completedQuests) ? existingProfile.completedQuests : defaultProfile.completedQuests, 
        unlockedPerks: Array.isArray(existingProfile.unlockedPerks) ? existingProfile.unlockedPerks : defaultProfile.unlockedPerks,
        featuresUsed: typeof existingProfile.featuresUsed === 'object' && existingProfile.featuresUsed !== null ? existingProfile.featuresUsed : defaultProfile.featuresUsed,
        level: typeof existingProfile.level === 'number' && !isNaN(existingProfile.level) ? existingProfile.level : defaultProfile.level,
        kiloVibes: typeof existingProfile.kiloVibes === 'number' && !isNaN(existingProfile.kiloVibes) ? existingProfile.kiloVibes : defaultProfile.kiloVibes,
        focusTimeHours: typeof existingProfile.focusTimeHours === 'number' && !isNaN(existingProfile.focusTimeHours) ? existingProfile.focusTimeHours : defaultProfile.focusTimeHours,
        totalFilesExtracted: typeof existingProfile.totalFilesExtracted === 'number' ? existingProfile.totalFilesExtracted : defaultProfile.totalFilesExtracted,
        totalTokensProcessed: typeof existingProfile.totalTokensProcessed === 'number' ? existingProfile.totalTokensProcessed : defaultProfile.totalTokensProcessed,
        totalKworkRequestsSent: typeof existingProfile.totalKworkRequestsSent === 'number' ? existingProfile.totalKworkRequestsSent : defaultProfile.totalKworkRequestsSent,
        totalPrsCreated: typeof existingProfile.totalPrsCreated === 'number' ? existingProfile.totalPrsCreated : defaultProfile.totalPrsCreated,
        totalBranchesUpdated: typeof existingProfile.totalBranchesUpdated === 'number' ? existingProfile.totalBranchesUpdated : defaultProfile.totalBranchesUpdated,
    };
     if (finalProfile.activeQuests.length === 0 && finalProfile.completedQuests.length === 0 && QUEST_ORDER.length > 0) {
        finalProfile.activeQuests = [QUEST_ORDER[0]];
    }
  }
  
  const currentLevel = finalProfile.level || 0;
  finalProfile.cognitiveOSVersion = COGNITIVE_OS_VERSIONS[currentLevel] || COGNITIVE_OS_VERSIONS[COGNITIVE_OS_VERSIONS.length -1] || defaultProfile.cognitiveOSVersion;
  finalProfile.skillsLeveled = new Set(finalProfile.unlockedPerks || []).size; 

  return finalProfile;
};

export const fetchUserCyberFitnessProfile = async (userId: string): Promise<{ success: boolean; data?: CyberFitnessProfile; error?: string }> => {
  logger.log(`[CyberFitness FetchProfile ENTRY] Attempting to fetch profile for user_id: ${userId}`);
  if (!userId) {
    logger.warn("[CyberFitness FetchProfile] User ID (string) is missing. Cannot fetch profile.");
    return { success: false, error: "User ID (string) is required.", data: getDefaultCyberFitnessProfile() };
  }
  
  try {
    const userData = await genericFetchUserData(userId); 

    if (!userData) {
        logger.warn(`[CyberFitness FetchProfile] User ${userId} not found via genericFetchUserData. Returning default profile. Will create metadata on first update.`);
        return { success: false, error: `User ${userId} not found.`, data: getCyberFitnessProfile(userId, null) };
    }
    
    const profile = getCyberFitnessProfile(userId, userData.metadata); 
    if (!userData.metadata || !userData.metadata[CYBERFIT_METADATA_KEY]) {
        logger.info(`[CyberFitness FetchProfile] User ${userId} found, but no CyberFitness metadata yet. Returning default. Will create on first update.`);
    } else {
        logger.log(`[CyberFitness FetchProfile EXIT] Successfully parsed CyberFitness profile for user ${userId}. Level: ${profile.level}, KiloVibes: ${profile.kiloVibes}, CompletedQuests: ${profile.completedQuests.join(', ')}`);
    }
    return { success: true, data: profile };
  } catch (e: any) {
    logger.error(`[CyberFitness FetchProfile CATCH] Exception fetching profile for user ${userId}:`, e);
    return { success: false, error: e.message || "Failed to fetch CyberFitness profile.", data: getCyberFitnessProfile(userId, null) }; 
  }
};

export const updateUserCyberFitnessProfile = async (
  userId: string,
  updates: Partial<CyberFitnessProfile> & { dynamicAchievementsToAdd?: Achievement[] } 
): Promise<{ success: boolean; data?: DbUser; error?: string; newAchievements?: Achievement[] }> => {
  logger.log(`[CyberFitness UpdateProfile ENTRY] User_id: ${userId}, Updates Summary:`, {
      keys: Object.keys(updates),
      kiloVibesDelta: updates.kiloVibes,
  });

  if (!userId) {
    logger.warn("[CyberFitness UpdateProfile] User ID (string) is missing. Cannot update profile.");
    return { success: false, error: "User ID (string) is required." };
  }

  try {
    const userData = await genericFetchUserData(userId); 
    if (!userData) { 
        logger.error(`[CyberFitness UpdateProfile] User ${userId} not found. Cannot update profile.`);
        return { success: false, error: `User ${userId} not found.` };
    }
   
    const existingOverallMetadata = userData.metadata || {};
    let existingProfile = getCyberFitnessProfile(userId, existingOverallMetadata);
    
    // Create a mutable copy to calculate changes
    const newProfile = JSON.parse(JSON.stringify(existingProfile)) as CyberFitnessProfile;
    
    let totalKvAdjustment = 0;
    const newlyUnlockedAchievements: Achievement[] = [];
    const currentAchievementsSet = new Set(newProfile.achievements || []);

    if (typeof updates.kiloVibes === 'number') {
        totalKvAdjustment += updates.kiloVibes;
    }
    if (typeof updates.focusTimeHours === 'number') {
        newProfile.focusTimeHours += updates.focusTimeHours;
    }
    // ... (rest of the logic for updating totals) ...
    if (typeof updates.totalFilesExtracted === 'number') newProfile.totalFilesExtracted += updates.totalFilesExtracted;
    if (typeof updates.totalTokensProcessed === 'number') newProfile.totalTokensProcessed += updates.totalTokensProcessed;
    if (typeof updates.totalKworkRequestsSent === 'number') newProfile.totalKworkRequestsSent += updates.totalKworkRequestsSent;
    if (typeof updates.totalPrsCreated === 'number') newProfile.totalPrsCreated += updates.totalPrsCreated;
    if (typeof updates.totalBranchesUpdated === 'number') newProfile.totalBranchesUpdated += updates.totalBranchesUpdated;
    
    if (updates.featuresUsed) {
        newProfile.featuresUsed = { ...newProfile.featuresUsed, ...updates.featuresUsed };
    }
    
    if (updates.completedQuests) {
        const completedQuestsSet = new Set(newProfile.completedQuests || []);
        updates.completedQuests.forEach(questId => {
            if (!completedQuestsSet.has(questId)) {
                completedQuestsSet.add(questId);
                const achDef = ALL_ACHIEVEMENTS.find(a => a.id === questId);
                if (achDef && !currentAchievementsSet.has(questId)) {
                    currentAchievementsSet.add(questId);
                    newlyUnlockedAchievements.push(achDef);
                    if (achDef.kiloVibesAward) totalKvAdjustment += achDef.kiloVibesAward;
                    if (achDef.unlocksPerks) newProfile.unlockedPerks.push(...achDef.unlocksPerks);
                }
            }
        });
        newProfile.completedQuests = Array.from(completedQuestsSet);
        newProfile.activeQuests = (newProfile.activeQuests || []).filter(q => !completedQuestsSet.has(q));
        const lastCompletedIndex = QUEST_ORDER.indexOf(updates.completedQuests[updates.completedQuests.length - 1]);
        if (lastCompletedIndex !== -1 && lastCompletedIndex + 1 < QUEST_ORDER.length) {
            const nextQuestId = QUEST_ORDER[lastCompletedIndex + 1];
            if (!completedQuestsSet.has(nextQuestId) && !newProfile.activeQuests.includes(nextQuestId)) {
                newProfile.activeQuests.push(nextQuestId);
            }
        }
    }
    
    const allAchievementsToCheck = [...ALL_ACHIEVEMENTS, ...(updates.dynamicAchievementsToAdd || [])];
    for (const ach of allAchievementsToCheck) {
        if (!ach.isQuest && !currentAchievementsSet.has(ach.id) && ach.checkCondition(newProfile)) {
            currentAchievementsSet.add(ach.id);
            newlyUnlockedAchievements.push(ach);
            if (ach.kiloVibesAward) totalKvAdjustment += ach.kiloVibesAward;
            if (ach.unlocksPerks) newProfile.unlockedPerks.push(...ach.unlocksPerks);
        }
    }
    newProfile.unlockedPerks = [...new Set(newProfile.unlockedPerks)];

    const potentialKv = existingProfile.kiloVibes + totalKvAdjustment;
    const previousLevel = existingProfile.level;
    let newLevelCandidate = previousLevel;
    for (let i = LEVEL_THRESHOLDS_KV.length - 1; i >= 0; i--) {
        if (potentialKv >= LEVEL_THRESHOLDS_KV[i]) {
            newLevelCandidate = i;
            break;
        }
    }
    
    if (newLevelCandidate > previousLevel) {
        for (let lvl = previousLevel + 1; lvl <= newLevelCandidate; lvl++) {
            const levelUpAchievementId = `level_up_${lvl}`;
            if (!currentAchievementsSet.has(levelUpAchievementId)) {
                const levelUpAch: Achievement = {
                    id: levelUpAchievementId, name: `Достигнут Уровень ${lvl}!`,
                    description: `Вы достигли ${lvl}-го уровня КиберФитнеса!`,
                    icon: 'FaStar', checkCondition: () => true, kiloVibesAward: 25 * lvl, isDynamic: true,
                };
                currentAchievementsSet.add(levelUpAch.id);
                newlyUnlockedAchievements.push(levelUpAch);
                if (levelUpAch.kiloVibesAward) totalKvAdjustment += levelUpAch.kiloVibesAward;
            }
            if (PERKS_BY_LEVEL[lvl]) {
                newProfile.unlockedPerks.push(...PERKS_BY_LEVEL[lvl]);
            }
        }
        newProfile.unlockedPerks = [...new Set(newProfile.unlockedPerks)];
    }

    newProfile.level = newLevelCandidate;
    newProfile.achievements = Array.from(currentAchievementsSet);
    newProfile.skillsLeveled = new Set(newProfile.unlockedPerks).size;
    newProfile.cognitiveOSVersion = COGNITIVE_OS_VERSIONS[newLevelCandidate] || `v${newLevelCandidate}.0 Custom Elite`;
    newProfile.lastActivityTimestamp = new Date().toISOString();

    if (totalKvAdjustment !== 0) {
        logger.info(`[CyberFitness UpdateProfile] Calling RPC to adjust KV by ${totalKvAdjustment} for user ${userId}.`);
        const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('adjust_kilovibes', {
            p_user_id: userId,
            p_kv_adjustment: totalKvAdjustment
        });

        if (rpcError || !rpcData || !rpcData[0].success) {
            const errorMessage = rpcError?.message || rpcData?.[0]?.message || "RPC call failed";
            logger.error(`[CyberFitness UpdateProfile] KV adjustment RPC failed for user ${userId}:`, errorMessage);
            return { success: false, error: `Failed to adjust KiloVibes: ${errorMessage}` };
        }
        newProfile.kiloVibes = rpcData[0].new_balance;
        logger.info(`[CyberFitness UpdateProfile] KV updated via RPC. New balance: ${rpcData[0].new_balance}`);
    } else {
        newProfile.kiloVibes = existingProfile.kiloVibes;
    }
    
    const newOverallMetadata: UserMetadata = {
      ...existingOverallMetadata, 
      [CYBERFIT_METADATA_KEY]: newProfile, 
    };
        
    const { success: updateSuccess, data: updatedUser, error: updateError } = await genericUpdateUserMetadata(userId, newOverallMetadata); 

    if (!updateSuccess || !updatedUser) {
      logger.error(`[CyberFitness UpdateProfile] Error saving final updated profile for ${userId}:`, updateError);
      return { success: false, error: updateError || "Failed to save updated profile metadata." };
    }

    logger.log(`[CyberFitness UpdateProfile EXIT] Successfully updated profile for ${userId}. New KV: ${newProfile.kiloVibes}, Lvl: ${newProfile.level}`);
    return { success: true, data: updatedUser, newAchievements: newlyUnlockedAchievements };
  } catch (e: any) {
    logger.error(`[CyberFitness UpdateProfile CATCH] Exception for ${userId}:`, e);
    return { success: false, error: e.message || "Failed to update profile." };
  }
};

export async function spendKiloVibes(
  userId: string, 
  amount: number, 
  reason: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  logger.info(`[spendKiloVibes] Calling DB function to spend ${amount} KV for user ${userId}. Reason: ${reason}`);
  if (!userId || !amount || amount <= 0) {
    return { success: false, error: "Invalid user ID or amount provided." };
  }

  const adjustment = -Math.abs(amount);

  const { data, error } = await supabaseAdmin.rpc('adjust_kilovibes', {
      p_user_id: userId,
      p_kv_adjustment: adjustment,
  });

  if (error) {
    logger.error(`[spendKiloVibes] RPC call failed for user ${userId}:`, error);
    return { success: false, error: "Database transaction failed." };
  }
  
  const result = data[0];

  if (!result.success) {
    logger.warn(`[spendKiloVibes] DB function returned failure for user ${userId}: ${result.message}`);
    return { success: false, error: result.message };
  }

  logger.info(`[spendKiloVibes] Successfully spent ${amount} KV for user ${userId}. New balance: ${result.new_balance.toFixed(2)}. Reason: ${reason}`);

  return { success: true, newBalance: result.new_balance };
}

export async function addKiloVibes(
  userId: string, 
  amount: number, 
  reason: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  logger.info(`[addKiloVibes] Calling DB function to ADD ${amount} KV for user ${userId}. Reason: ${reason}`);
  if (!userId || !amount || amount <= 0) {
    return { success: false, error: "Invalid user ID or amount provided." };
  }

  const adjustment = Math.abs(amount);

  const { data, error } = await supabaseAdmin.rpc('adjust_kilovibes', {
      p_user_id: userId,
      p_kv_adjustment: adjustment,
  });

  if (error) {
    logger.error(`[addKiloVibes] RPC call failed for user ${userId}:`, error);
    return { success: false, error: "Database transaction failed." };
  }
  
  const result = data[0];

  if (!result.success) {
    logger.warn(`[addKiloVibes] DB function returned failure for user ${userId}: ${result.message}`);
    return { success: false, error: result.message };
  }

  logger.info(`[addKiloVibes] Successfully added ${amount} KV for user ${userId}. New balance: ${result.new_balance.toFixed(2)}. Reason: ${reason}`);

  return { success: true, newBalance: result.new_balance };
}

export const logCyberFitnessAction = async (
    userId: string,
    actionType: 'filesExtracted' | 'tokensProcessed' | 'kworkRequestSent' | 'prCreated' | 'branchUpdated' | 'featureUsed' | 'focusTimeAdded',
    countOrDetails: number | { featureName: string; featureValue?: string | number | boolean } | { minutes: number } 
  ): Promise<{ success: boolean; error?: string; newAchievements?: Achievement[] }> => {
    // This function now correctly calls the refactored updateUserCyberFitnessProfile
    // which handles KV adjustments via RPC.
    if (!userId) {
        return { success: false, error: "User ID is required." };
    }
    
    // ... validation logic for countOrDetails ...
  
    try {
      const profileResult = await fetchUserCyberFitnessProfile(userId); 
      if (!profileResult.success && !profileResult.data?.hasOwnProperty('level')) { 
        return { success: false, error: profileResult.error || "Failed to get current profile data." };
      }
      
      let currentProfile = profileResult.data || getDefaultCyberFitnessProfile(); 
      let dailyLog = currentProfile.dailyActivityLog ? [...currentProfile.dailyActivityLog] : [];
      // ... logic for updating daily log ...
      
      const profileUpdates: Partial<CyberFitnessProfile> = {};
      let kiloVibesFromAction = 0;
  
      if (actionType === 'filesExtracted' && typeof countOrDetails === 'number') {
          profileUpdates.totalFilesExtracted = countOrDetails; 
          kiloVibesFromAction += countOrDetails * 0.1; 
      } else if (actionType === 'tokensProcessed' && typeof countOrDetails === 'number') {
          profileUpdates.totalTokensProcessed = countOrDetails; 
          kiloVibesFromAction += countOrDetails * 0.001; 
      } else if (actionType === 'kworkRequestSent' && typeof countOrDetails === 'number') {
          profileUpdates.totalKworkRequestsSent = countOrDetails; 
          kiloVibesFromAction += countOrDetails * 5; 
      } // ... and so on for other actions
  
      if (kiloVibesFromAction > 0) {
          profileUpdates.kiloVibes = kiloVibesFromAction;
      }
      // ... more logic for features, etc.
  
      const updateResult = await updateUserCyberFitnessProfile(userId, profileUpdates); 
      
      return { success: updateResult.success, newAchievements: updateResult.newAchievements, error: updateResult.error };
  
    } catch (e: any) {
      logger.error(`[CyberFitness LogAction CATCH] Exception for ${userId} logging ${actionType}:`, e);
      return { success: false, error: e.message || "Failed to log CyberFitness action." };
    }
  };

export const markTutorialAsCompleted = async (
    userId: string,
    tutorialQuestId: string 
  ): Promise<{ success: boolean; error?: string; newAchievements?: Achievement[], kiloVibesAwarded?: number }> => {
    if (!userId || !tutorialQuestId) {
      return { success: false, error: "User ID (string) and Tutorial ID required." };
    }
    
    const questDefinition = ALL_ACHIEVEMENTS.find(ach => ach.id === tutorialQuestId);
    const actualKiloVibesAward = questDefinition?.kiloVibesAward ?? 15;
  
    const updates: Partial<CyberFitnessProfile> = {
      kiloVibes: actualKiloVibesAward,
      completedQuests: [tutorialQuestId],
    };
  
    const updateResult = await updateUserCyberFitnessProfile(userId, updates);
  
    if (!updateResult.success) {
      return { success: false, error: updateResult.error || "Ошибка сохранения прогресса туториала." };
    }
  
    return { 
      success: true, 
      newAchievements: updateResult.newAchievements,
      kiloVibesAwarded: actualKiloVibesAward
    };
  };