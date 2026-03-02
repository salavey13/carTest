"use server"; 
 
import { supabaseAdmin, updateUserMetadata as genericUpdateUserMetadata, fetchUserData as genericFetchUserData } from '@/lib/supabase-server'; 
import type { Database } from "@/types/database.types";
import { logger } from "@/lib/logger";
import { format } from 'date-fns';

export const logCyberFitnessAction = async (
  userId: string,
  actionType: 'filesExtracted' | 'tokensProcessed' | 'kworkRequestSent' | 'prCreated' | 'branchUpdated' | 'featureUsed' | 'focusTimeAdded',
  countOrDetails: number | { featureName: string; featureValue?: string | number | boolean } | { minutes: number }
): Promise<{ success: boolean; error?: string; newAchievements?: Achievement[] }> => {
  if (!userId) {
    logger.warn("[CyberFitness LogAction] User ID (string) is missing.");
    return { success: false, error: "User ID is required." };
  }

  let kiloVibesDelta = 0;
  let featureKey: string | null = null;
  let featureVal: string | number | boolean | null = null;

  if (actionType === 'filesExtracted' && typeof countOrDetails === 'number') {
    kiloVibesDelta = countOrDetails * 0.1;
    featureKey = 'totalFilesExtracted';
    featureVal = countOrDetails;
  }
  else if (actionType === 'tokensProcessed' && typeof countOrDetails === 'number') {
    kiloVibesDelta = countOrDetails * 0.001;
    featureKey = 'lastTokensCount';
    featureVal = countOrDetails;
  }
  else if (actionType === 'kworkRequestSent' && typeof countOrDetails === 'number') {
    kiloVibesDelta = countOrDetails * 5;
    featureKey = 'totalKworkRequests';
    featureVal = countOrDetails;
  }
  else if (actionType === 'prCreated' && typeof countOrDetails === 'number') {
    kiloVibesDelta = countOrDetails * 50;
    featureKey = 'lastPrTs';
    featureVal = new Date().toISOString();
  }
  else if (actionType === 'branchUpdated' && typeof countOrDetails === 'number') {
    kiloVibesDelta = countOrDetails * 20;
    featureKey = 'lastBranchUpdateTs';
    featureVal = new Date().toISOString();
  }
  else if (actionType === 'featureUsed' && typeof countOrDetails === 'object' && 'featureName' in countOrDetails) {
    kiloVibesDelta = 5;
    featureKey = countOrDetails.featureName;
    featureVal = countOrDetails.featureValue ?? true;
  }
  else if (actionType === 'focusTimeAdded' && typeof countOrDetails === 'object' && 'minutes' in countOrDetails) {
    kiloVibesDelta = countOrDetails.minutes * 0.5;
    featureKey = 'lastFocusMinutes';
    featureVal = countOrDetails.minutes;
  }

  try {
    const { data: newMetadata, error: rpcError } = await supabaseAdmin.rpc('update_user_cyber_stats', {
      p_user_id: userId,
      p_kv_delta: kiloVibesDelta,
      p_gv_delta: 0,
      p_new_achievement: null,
      p_feature_key: featureKey,
      p_feature_val: featureVal
    });

    if (rpcError) throw rpcError;

    const profileAfterRpc = getCyberFitnessProfile(userId, newMetadata);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const updatedDailyLog = [...(profileAfterRpc.dailyActivityLog || [])];

    const existingEntryIndex = updatedDailyLog.findIndex((entry) => entry.date === todayStr);
    const entry = existingEntryIndex >= 0
      ? { ...updatedDailyLog[existingEntryIndex] }
      : {
          date: todayStr,
          filesExtracted: 0,
          tokensProcessed: 0,
          kworkRequestsSent: 0,
          prsCreated: 0,
          branchesUpdated: 0,
          focusTimeMinutes: 0,
        };

    const profileUpdates: Partial<CyberFitnessProfile> & { dynamicAchievementsToAdd?: Achievement[] } = {
      lastActivityTimestamp: new Date().toISOString(),
    };

    if (actionType === 'filesExtracted' && typeof countOrDetails === 'number') {
      entry.filesExtracted += countOrDetails;
      profileUpdates.totalFilesExtracted = countOrDetails;
    } else if (actionType === 'tokensProcessed' && typeof countOrDetails === 'number') {
      entry.tokensProcessed += countOrDetails;
      profileUpdates.totalTokensProcessed = countOrDetails;
    } else if (actionType === 'kworkRequestSent' && typeof countOrDetails === 'number') {
      entry.kworkRequestsSent += countOrDetails;
      profileUpdates.totalKworkRequestsSent = countOrDetails;
    } else if (actionType === 'prCreated' && typeof countOrDetails === 'number') {
      entry.prsCreated += countOrDetails;
      profileUpdates.totalPrsCreated = countOrDetails;
    } else if (actionType === 'branchUpdated' && typeof countOrDetails === 'number') {
      entry.branchesUpdated += countOrDetails;
      profileUpdates.totalBranchesUpdated = countOrDetails;
    } else if (actionType === 'focusTimeAdded' && typeof countOrDetails === 'object' && 'minutes' in countOrDetails) {
      entry.focusTimeMinutes = (entry.focusTimeMinutes || 0) + countOrDetails.minutes;
      profileUpdates.focusTimeHours = countOrDetails.minutes / 60;
    }

    if (existingEntryIndex >= 0) {
      updatedDailyLog[existingEntryIndex] = entry;
    } else {
      updatedDailyLog.push(entry);
    }

    const normalizedDailyLog = updatedDailyLog
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-MAX_DAILY_LOG_ENTRIES);

    profileUpdates.dailyActivityLog = normalizedDailyLog;

    const updateResult = await updateUserCyberFitnessProfile(userId, profileUpdates);
    if (!updateResult.success) {
      logger.error(`[CyberFitness LogAction] Failed to persist daily/totals after RPC for ${userId}: ${updateResult.error}`);
      return { success: false, error: updateResult.error || 'Failed to persist daily activity updates.' };
    }

    logger.info(`[CyberFitness LogAction EXIT] Action '${actionType}' logged for ${userId}. KV Delta: ${kiloVibesDelta}`);
    return { success: true, newAchievements: updateResult.newAchievements || [] };

  } catch (e: any) {
    logger.error(`[CyberFitness LogAction CATCH] Exception for ${userId}:`, e);
    return { success: false, error: e.message || "RPC Update Failed" };
  }
};

export const checkAndUnlockFeatureAchievement = async (
    userId: string,
    featureName: keyof Exclude<CyberFitnessProfile['featuresUsed'], undefined> | string,
    featureValue: string | number | boolean = true 
): Promise<{ success: boolean; newAchievements?: Achievement[], error?: string }> => {
    if (!userId || !featureName) {
        logger.warn("[CyberFitness CheckFeatureAchievement] User ID (string) and feature name required. Aborting.");
        return { success: false, error: "User ID (string) and feature name required."};
    }
    const details: { featureName: string; featureValue?: string | number | boolean } = { 
        featureName: String(featureName),
        featureValue: featureValue 
    };
    
    const result = await logCyberFitnessAction(userId, 'featureUsed', details); 
    return result;
};

export const markTutorialAsCompleted = async (
  userId: string,
  tutorialQuestId: string 
): Promise<{ success: boolean; error?: string; newAchievements?: Achievement[], kiloVibesAwarded?: number }> => {
  if (!userId || !tutorialQuestId) {
    logger.warn("[CyberFitness MarkTutorial] User ID (string) and Tutorial ID required.");
    return { success: false, error: "User ID (string) and Tutorial ID required." };
  }

  const profileResult = await fetchUserCyberFitnessProfile(userId);
  if (!profileResult.success || !profileResult.data) {
    logger.error(`[CyberFitness MarkTutorial] Failed to fetch profile for ${userId}. Error: ${profileResult.error}`);
    return { success: false, error: profileResult.error || "Не удалось загрузить профиль Агента." };
  }
  const currentProfile = profileResult.data;

  if (currentProfile.completedQuests.includes(tutorialQuestId)) {
    logger.info(`[CyberFitness MarkTutorial] Tutorial ${tutorialQuestId} already completed by user ${userId}.`);
    return { success: true, kiloVibesAwarded: 0 };
  }
  
  const KILOVIEBES_PER_TUTORIAL = 15; 
  const questDefinition = ALL_ACHIEVEMENTS.find(ach => ach.id === tutorialQuestId);
  const actualKiloVibesAward = questDefinition?.kiloVibesAward ?? KILOVIEBES_PER_TUTORIAL;

  const updates: Partial<CyberFitnessProfile> = {
    kiloVibes: actualKiloVibesAward,
    completedQuests: [tutorialQuestId],
  };

  const updateResult = await updateUserCyberFitnessProfile(userId, updates);

  if (!updateResult.success) {
    logger.error(`[CyberFitness MarkTutorial] Failed to update profile for ${userId} after completing tutorial ${tutorialQuestId}. Error: ${updateResult.error}`);
    return { success: false, error: updateResult.error || "Ошибка сохранения прогресса туториала." };
  }

  return { 
    success: true, 
    newAchievements: updateResult.newAchievements,
    kiloVibesAwarded: actualKiloVibesAward
  };
};

export const isQuestUnlocked = (questId: string, completedQuests: string[] | undefined, questOrder: string[]): boolean => {
  const questIndex = questOrder.indexOf(questId);
  if (questIndex === -1) {
    logger.warn(`[isQuestUnlocked] Quest ID "${questId}" not found in QUEST_ORDER. Assuming locked.`);
    return false; 
  }
  if (questIndex === 0) return true; 

  const previousQuestId = questOrder[questIndex - 1];
  const isUnlocked = !!completedQuests?.includes(previousQuestId);
  return isUnlocked;
};

export const setCognitiveOSVersion = async (userId: string, version: string): Promise<{ success: boolean; data?: DbUser; error?: string; newAchievements?: Achievement[] }> => {
  if (!userId || typeof version !== 'string') {
      logger.warn("[CyberFitness OSVersion] User ID (string) or version string is invalid. Aborting.");
      return { success: false, error: "User ID (string) and valid version string required." };
  }
  return updateUserCyberFitnessProfile(userId, { cognitiveOSVersion: version }); 
};

export const getUserCyberLevel = async (userId: string): Promise<{ success: boolean; level?: number; error?: string }> => {
   if (!userId) {
    logger.warn("[CyberFitness GetLevel] User ID (string) is missing. Cannot get level.");
    return { success: false, level: 0, error: "User ID (string) is required." };
  }
  const profileResult = await fetchUserCyberFitnessProfile(userId); 
  if (!profileResult.success || typeof profileResult.data?.level !== 'number') { 
    logger.warn(`[CyberFitness GetLevel] Failed to get level for ${userId}. Success: ${profileResult.success}, Error: ${profileResult.error}, Level: ${profileResult.data?.level}`);
    return { success: false, level: 0, error: profileResult.error || "Level not found or profile fetch failed" };
  }
  return { success: true, level: profileResult.data.level };
};

/**
 * NEW: Spends KiloVibes for a user for a specific purchase.
 * This is a transactional function. It will deduct KV and log the transaction.
 * THIS IS NOW REFACTORED TO USE THE DATABASE FUNCTION.
 */
export async function spendKiloVibes(
  userId: string, 
  amount: number, 
  reason: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  logger.info(`[spendKiloVibes] Calling DB function to spend ${amount} KV for user ${userId}. Reason: ${reason}`);
  if (!userId || !amount || amount <= 0) {
    return { success: false, error: "Invalid user ID or amount provided." };
  }

  // Use a negative adjustment for spending
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
    // The message from the DB function is now the error message
    return { success: false, error: result.message };
  }

  logger.info(`[spendKiloVibes] Successfully spent ${amount} KV for user ${userId}. New balance: ${result.new_balance.toFixed(2)}. Reason: ${reason}`);

  return { success: true, newBalance: result.new_balance };
}

export const updateUserCyberFitnessProfile = async (
  userId: string,
  updates: Partial<CyberFitnessProfile> & { dynamicAchievementsToAdd?: Achievement[] } 
): Promise<{ success: boolean; data?: DbUser; error?: string; newAchievements?: Achievement[] }> => {
  logger.info(`[CyberFitness UpdateProfile ENTRY] User_id: ${userId}, Updates Summary:`, {
      keys: Object.keys(updates),
      kiloVibesDelta: updates.kiloVibes,
      levelUpdate: updates.level,
      featuresUsedUpdates: updates.featuresUsed ? Object.keys(updates.featuresUsed) : [],
      dynamicAchievementsToAdd: updates.dynamicAchievementsToAdd?.map(a => a.id),
      completedQuestsUpdate: updates.completedQuests,
  });

  if (!userId) {
    logger.warn("[CyberFitness UpdateProfile] User ID (string) is missing. Cannot update profile.");
    return { success: false, error: "User ID (string) is required." };
  }

  const isTrueMockSession = process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true' && MOCK_USER_ID_FOR_DB_STR !== null && userId === MOCK_USER_ID_FOR_DB_STR;

  try {
    const userData = await genericFetchUserData(userId); 
    if (!userData && !isTrueMockSession) { 
        logger.error(`[CyberFitness UpdateProfile] User ${userId} not found via genericFetchUserData. Cannot update profile.`);
        return { success: false, error: `User ${userId} not found.` };
    }
   
    const existingOverallMetadata = userData?.metadata || {};
    let existingCyberFitnessProfileData = getCyberFitnessProfile(userId, existingOverallMetadata);
    
    logger.info(`[CyberFitness UpdateProfile] User: ${userId}.
    Existing Profile (from DB read):
      Level: ${existingCyberFitnessProfileData.level}, KV: ${existingCyberFitnessProfileData.kiloVibes},
      Total Files: ${existingCyberFitnessProfileData.totalFilesExtracted}, Total Tokens: ${existingCyberFitnessProfileData.totalTokensProcessed},
      Total KWorks: ${existingCyberFitnessProfileData.totalKworkRequestsSent}, Total PRs: ${existingCyberFitnessProfileData.totalPrsCreated}, Total Branches: ${existingCyberFitnessProfileData.totalBranchesUpdated}.
    Incoming Updates (Deltas for this action):
      KV Delta: ${updates.kiloVibes ?? 0}, Files Delta: ${updates.totalFilesExtracted ?? 0}, Tokens Delta: ${updates.totalTokensProcessed ?? 0},
      KWorks Delta: ${updates.totalKworkRequestsSent ?? 0}, PRs Delta: ${updates.totalPrsCreated ?? 0}, Branches Delta: ${updates.totalBranchesUpdated ?? 0}.`);

    const newCyberFitnessProfile: CyberFitnessProfile = {
      ...existingCyberFitnessProfileData, 
      lastActivityTimestamp: new Date().toISOString(), 
    };

    if (updates.kiloVibes !== undefined && typeof updates.kiloVibes === 'number') {
        newCyberFitnessProfile.kiloVibes += updates.kiloVibes; 
    }
    if (updates.focusTimeHours !== undefined && typeof updates.focusTimeHours === 'number') {
        newCyberFitnessProfile.focusTimeHours = (existingCyberFitnessProfileData.focusTimeHours || 0) + updates.focusTimeHours; 
    }
    if (updates.activeQuests && Array.isArray(updates.activeQuests)) {
        const activeQuestsSet = new Set(newCyberFitnessProfile.activeQuests || []);
        updates.activeQuests.forEach(q => activeQuestsSet.add(q));
        newCyberFitnessProfile.activeQuests = Array.from(activeQuestsSet);
    }
    
    let currentAchievementsSet = new Set(newCyberFitnessProfile.achievements || []);
    let newlyUnlockedAchievements: Achievement[] = [];

    if (updates.completedQuests && Array.isArray(updates.completedQuests)) {
        const completedQuestsSet = new Set(newCyberFitnessProfile.completedQuests || []);
        updates.completedQuests.forEach(questId => {
            if (!completedQuestsSet.has(questId)) { 
                completedQuestsSet.add(questId);

                const achDef = ALL_ACHIEVEMENTS.find(a => a.id === questId);
                if (achDef && !currentAchievementsSet.has(questId)) {
                    currentAchievementsSet.add(questId);
                    newlyUnlockedAchievements.push(achDef);
                    if (achDef.kiloVibesAward) {
                        newCyberFitnessProfile.kiloVibes += achDef.kiloVibesAward;
                    }
                    if (achDef.unlocksPerks) {
                        const existingPerksSet = new Set(newCyberFitnessProfile.unlockedPerks || []);
                        achDef.unlocksPerks.forEach(perk => {
                            if (!existingPerksSet.has(perk)) {
                                newCyberFitnessProfile.unlockedPerks.push(perk);
                            }
                        });
                    }
                }
            }
        });
        newCyberFitnessProfile.completedQuests = Array.from(completedQuestsSet);
        
        newCyberFitnessProfile.activeQuests = (newCyberFitnessProfile.activeQuests || []).filter(q => !completedQuestsSet.has(q));

        const lastNewlyCompletedQuestId = updates.completedQuests.find(qId => !existingCyberFitnessProfileData.completedQuests.includes(qId));
        if (lastNewlyCompletedQuestId) {
            const lastCompletedIndex = QUEST_ORDER.indexOf(lastNewlyCompletedQuestId);
            if (lastCompletedIndex !== -1 && lastCompletedIndex + 1 < QUEST_ORDER.length) {
                const nextQuestId = QUEST_ORDER[lastCompletedIndex + 1];
                if (!completedQuestsSet.has(nextQuestId) && !(newCyberFitnessProfile.activeQuests || []).includes(nextQuestId)) {
                    newCyberFitnessProfile.activeQuests = [...(newCyberFitnessProfile.activeQuests || []), nextQuestId];
                }
            }
        }
    }
    
    if (newCyberFitnessProfile.activeQuests.length === 0 && newCyberFitnessProfile.completedQuests.length < QUEST_ORDER.length) {
        for (const questId of QUEST_ORDER) {
            if (!newCyberFitnessProfile.completedQuests.includes(questId)) {
                newCyberFitnessProfile.activeQuests.push(questId);
                break; 
            }
        }
    }

    if (updates.unlockedPerks && Array.isArray(updates.unlockedPerks)) {
        const perksToAddSet = new Set(updates.unlockedPerks);
        const existingPerksSet = new Set(newCyberFitnessProfile.unlockedPerks || []);
        perksToAddSet.forEach(perk => existingPerksSet.add(perk));
        newCyberFitnessProfile.unlockedPerks = Array.from(existingPerksSet);
    }
    
    if (updates.dailyActivityLog && Array.isArray(updates.dailyActivityLog)) newCyberFitnessProfile.dailyActivityLog = updates.dailyActivityLog; 
    if (updates.featuresUsed && typeof updates.featuresUsed === 'object') {
        newCyberFitnessProfile.featuresUsed = {...newCyberFitnessProfile.featuresUsed, ...updates.featuresUsed};
    }
    
    if (typeof updates.totalFilesExtracted === 'number') newCyberFitnessProfile.totalFilesExtracted = (existingCyberFitnessProfileData.totalFilesExtracted || 0) + updates.totalFilesExtracted;
    if (typeof updates.totalTokensProcessed === 'number') newCyberFitnessProfile.totalTokensProcessed = (existingCyberFitnessProfileData.totalTokensProcessed || 0) + updates.totalTokensProcessed;
    if (typeof updates.totalKworkRequestsSent === 'number') newCyberFitnessProfile.totalKworkRequestsSent = (existingCyberFitnessProfileData.totalKworkRequestsSent || 0) + updates.totalKworkRequestsSent;
    if (typeof updates.totalPrsCreated === 'number') newCyberFitnessProfile.totalPrsCreated = (existingCyberFitnessProfileData.totalPrsCreated || 0) + updates.totalPrsCreated;
    if (typeof updates.totalBranchesUpdated === 'number') newCyberFitnessProfile.totalBranchesUpdated = (existingCyberFitnessProfileData.totalBranchesUpdated || 0) + updates.totalBranchesUpdated;
    
    const previousLevel = newCyberFitnessProfile.level; 
    let newLevelCandidate = previousLevel;

    for (let i = LEVEL_THRESHOLDS_KV.length - 1; i >= 0; i--) {
        if (newCyberFitnessProfile.kiloVibes >= LEVEL_THRESHOLDS_KV[i]) {
            newLevelCandidate = i;
            break;
        }
    }
    if (updates.level !== undefined && typeof updates.level === 'number' && updates.level > newLevelCandidate) {
        newLevelCandidate = updates.level; 
    }
    
    if (newLevelCandidate > previousLevel) {
        newCyberFitnessProfile.level = newLevelCandidate;
        newCyberFitnessProfile.cognitiveOSVersion = COGNITIVE_OS_VERSIONS[newLevelCandidate] || `v${newLevelCandidate}.0 Custom Elite`;
        
        const kvAwardForLevel = (newLevelCandidate - previousLevel) * 50; 
        if (kvAwardForLevel > 0) {
            newCyberFitnessProfile.kiloVibes += kvAwardForLevel;
        }

        for (let lvl = previousLevel + 1; lvl <= newLevelCandidate; lvl++) {
            if (PERKS_BY_LEVEL[lvl]) {
                const perksForThisLevel = PERKS_BY_LEVEL[lvl];
                const existingPerksSet = new Set(newCyberFitnessProfile.unlockedPerks || []);
                perksForThisLevel.forEach(perk => {
                    if (!existingPerksSet.has(perk)) {
                        newCyberFitnessProfile.unlockedPerks.push(perk);
                        existingPerksSet.add(perk); 
                    }
                });
            }
            const levelUpAchievementId = `level_up_${lvl}`;
            if (!currentAchievementsSet.has(levelUpAchievementId)) {
                 const levelUpAch: Achievement = {
                     id: levelUpAchievementId, name: `Достигнут Уровень ${lvl}!`,
                     description: `Вы достигли ${lvl}-го уровня КиберФитнеса! Новые перки и возможности открыты.`,
                     icon: 'FaStar', checkCondition: () => true, kiloVibesAward: 25 * lvl, isDynamic: true,
                 };
                 currentAchievementsSet.add(levelUpAch.id);
                 newlyUnlockedAchievements.push(levelUpAch);
                 if (levelUpAch.kiloVibesAward) newCyberFitnessProfile.kiloVibes += levelUpAch.kiloVibesAward;
            }
        }
    }
    if (updates.unlockedPerks && Array.isArray(updates.unlockedPerks)) {
        const perksToAddSet = new Set(updates.unlockedPerks);
        const existingPerksSet = new Set(newCyberFitnessProfile.unlockedPerks || []);
        perksToAddSet.forEach(perk => {
            if (!existingPerksSet.has(perk)) {
                newCyberFitnessProfile.unlockedPerks.push(perk); 
            }
        });
    }
    newCyberFitnessProfile.skillsLeveled = new Set(newCyberFitnessProfile.unlockedPerks || []).size; 
    
    if (updates.cognitiveOSVersion && typeof updates.cognitiveOSVersion === 'string' && updates.cognitiveOSVersion !== newCyberFitnessProfile.cognitiveOSVersion) {
        newCyberFitnessProfile.cognitiveOSVersion = updates.cognitiveOSVersion;
    }

    if (updates.dynamicAchievementsToAdd && Array.isArray(updates.dynamicAchievementsToAdd)) {
        updates.dynamicAchievementsToAdd.forEach(dynamicAch => {
            if (!currentAchievementsSet.has(dynamicAch.id)) {
                currentAchievementsSet.add(dynamicAch.id);
                newlyUnlockedAchievements.push(dynamicAch);
                if (dynamicAch.kiloVibesAward) {
                    newCyberFitnessProfile.kiloVibes += dynamicAch.kiloVibesAward;
                }
                 if(dynamicAch.unlocksPerks && dynamicAch.unlocksPerks.length > 0){
                    const existingPerksSet = new Set(newCyberFitnessProfile.unlockedPerks || []);
                    dynamicAch.unlocksPerks.forEach(perk => {
                        if(!existingPerksSet.has(perk)){
                            newCyberFitnessProfile.unlockedPerks.push(perk);
                            existingPerksSet.add(perk);
                        }
                    });
                }
            }
        });
    }
    newCyberFitnessProfile.skillsLeveled = new Set(newCyberFitnessProfile.unlockedPerks || []).size;

    for (const ach of ALL_ACHIEVEMENTS) {
        if (!ach.isQuest && !ach.isDynamic && !currentAchievementsSet.has(ach.id) && ach.checkCondition(newCyberFitnessProfile)) { 
            currentAchievementsSet.add(ach.id); 
            newlyUnlockedAchievements.push(ach);
            if (ach.kiloVibesAward && typeof ach.kiloVibesAward === 'number') { 
                newCyberFitnessProfile.kiloVibes += ach.kiloVibesAward;
            }
            if(ach.unlocksPerks && ach.unlocksPerks.length > 0){
                const existingPerksSet = new Set(newCyberFitnessProfile.unlockedPerks || []);
                ach.unlocksPerks.forEach(perk => {
                    if(!existingPerksSet.has(perk)){
                        newCyberFitnessProfile.unlockedPerks.push(perk);
                        existingPerksSet.add(perk);
                    }
                });
            }
        }
    }
    newCyberFitnessProfile.achievements = Array.from(currentAchievementsSet);
    newCyberFitnessProfile.skillsLeveled = new Set(newCyberFitnessProfile.unlockedPerks || []).size; 
    
    if (newlyUnlockedAchievements.length > 0) {
        logger.info(`[CyberFitness UpdateProfile] User ${userId} unlocked new achievements (incl. dynamic):`, newlyUnlockedAchievements.map(a => `${a.name} (${a.id}, +${a.kiloVibesAward || 0}KV)`));
    }
    
    logger.info(`[CyberFitness UpdateProfile] User: ${userId}.
    Final Profile Values (Calculated, before save):
      Level: ${newCyberFitnessProfile.level}, KV: ${newCyberFitnessProfile.kiloVibes},
      Total Files: ${newCyberFitnessProfile.totalFilesExtracted}, Total Tokens: ${newCyberFitnessProfile.totalTokensProcessed},
      Total KWorks: ${newCyberFitnessProfile.totalKworkRequestsSent}, Total PRs: ${newCyberFitnessProfile.totalPrsCreated}, Total Branches: ${newCyberFitnessProfile.totalBranchesUpdated}.`);

    const newOverallMetadata: UserMetadata = {
      ...existingOverallMetadata, 
      [CYBERFIT_METADATA_KEY]: newCyberFitnessProfile, 
    };
        
    const { success: updateSuccess, data: updatedUser, error: updateError } = await genericUpdateUserMetadata(userId, newOverallMetadata); 

    if (!updateSuccess || !updatedUser) {
      logger.error(`[CyberFitness UpdateProfile] Error saving updated profile for ${userId} using genericUpdateUserMetadata:`, updateError);
      throw new Error(updateError || `Failed to update metadata for user ${userId} via genericUpdateUserMetadata`);
    }

    logger.info(`[CyberFitness UpdateProfile EXIT] Successfully updated profile for ${userId}. New KV: ${newCyberFitnessProfile.kiloVibes}, Lvl: ${newCyberFitnessProfile.level}, OS: ${newCyberFitnessProfile.cognitiveOSVersion}`);
    return { success: true, data: updatedUser, newAchievements: newlyUnlockedAchievements };
  } catch (e: any) {
    logger.error(`[CyberFitness UpdateProfile CATCH] Exception for ${userId}:`, e);
    const errorMessage = (e instanceof Error ? e.message : String(e)) || "Failed to update CyberFitness profile.";
    return { success: false, error: errorMessage, newAchievements: [] };
  }
};

export const logSchematicCompleted = async (
    userId: string,
    schematicId: string,
    details: SchematicCompletionDetails
): Promise<{ 
    success: boolean; 
    error?: string; 
    alreadyCompleted?: boolean; 
    newAchievements?: Achievement[]; 
    newPerks?: string[];
    kiloVibesAwarded?: number;
}> => {
    logger.info(`[CyberFitness SchematicComplete ENTRY] User_id: ${userId}, Schematic: ${schematicId}, Details:`, details);
    if (!userId || !schematicId) {
        logger.warn("[CyberFitness SchematicComplete] User ID (string) and Schematic ID required.");
        return { success: false, error: "User ID (string) and Schematic ID required." };
    }

    try {
        const profileResult = await fetchUserCyberFitnessProfile(userId);
        if (!profileResult.success || !profileResult.data) {
            logger.error(`[CyberFitness SchematicComplete] Failed to fetch profile for ${userId}. Error: ${profileResult.error}`);
            return { success: false, error: profileResult.error || "Не удалось загрузить профиль Агента." };
        }
        const currentProfile = profileResult.data;

        const completedFeatureKey = `schematic_completed_${schematicId}`;
        if (currentProfile.featuresUsed[completedFeatureKey] === true) {
            logger.info(`[CyberFitness SchematicComplete] Schematic ${schematicId} already completed by user ${userId}.`);
            return { success: true, alreadyCompleted: true };
        }

        let allPrerequisitesMet = true;
        const missingPrerequisitesDisplay: string[] = [];
        if (details.prerequisites && details.prerequisites.length > 0) {
            details.prerequisites.forEach(prereq => {
                const [type, value] = prereq.split(':');
                let currentMet = false;
                if (type === 'level' && currentProfile.level >= parseInt(value, 10)) currentMet = true;
                else if (type === 'achievement' && currentProfile.achievements.includes(value)) currentMet = true;
                else if (type === 'perk' && currentProfile.unlockedPerks.includes(value)) currentMet = true;
                else if (type === 'featureUsed' && currentProfile.featuresUsed[value]) currentMet = true;
                else if (type === 'quest' && currentProfile.completedQuests.includes(value)) currentMet = true;
                
                if (!currentMet) {
                    allPrerequisitesMet = false;
                    const achDetail = (type === 'achievement' || type === 'quest') ? getAchievementDetails(value) : null;
                    if (type === 'level') missingPrerequisitesDisplay.push(`Ур. ${value}`);
                    else if (achDetail) missingPrerequisitesDisplay.push(achDetail.name);
                    else missingPrerequisitesDisplay.push(value); 
                }
            });
        }

        if (!allPrerequisitesMet) {
            const errorMsg = `Требования не выполнены: ${missingPrerequisitesDisplay.join(', ')}.`;
            logger.warn(`[CyberFitness SchematicComplete] Prerequisites not met for ${schematicId}. Missing: ${missingPrerequisitesDisplay.join(', ')}`);
            return { success: false, error: errorMsg };
        }

        const profileUpdates: Partial<CyberFitnessProfile> & { dynamicAchievementsToAdd?: Achievement[] } = {
            featuresUsed: { ...currentProfile.featuresUsed, [completedFeatureKey]: true },
            dynamicAchievementsToAdd: []
        };
        let awardedKV = 0;
        let newPerksUnlocked: string[] = [];

        if (details.kiloVibesAward && details.kiloVibesAward > 0) {
            profileUpdates.kiloVibes = details.kiloVibesAward;
            awardedKV = details.kiloVibesAward;
        }

        if (details.unlocksPerk && !currentProfile.unlockedPerks.includes(details.unlocksPerk)) {
            profileUpdates.unlockedPerks = [details.unlocksPerk]; 
            newPerksUnlocked.push(details.unlocksPerk);
        }
        
        const masteredAchievementId = `mastered_schematic_${schematicId}`;
        const masteredAchievement: Achievement = {
            id: masteredAchievementId,
            name: `Схема '${details.schematicName}' Освоена!`,
            description: `Вы успешно применили и освоили схему '${details.schematicName}'.`,
            icon: details.schematicIcon,
            kiloVibesAward: Math.round((details.kiloVibesAward || 50) * 0.2) + 5, 
            checkCondition: () => true, 
            isDynamic: true,
        };
        profileUpdates.dynamicAchievementsToAdd!.push(masteredAchievement);

        const updateResult = await updateUserCyberFitnessProfile(userId, profileUpdates); 
        if (!updateResult.success) {
            logger.error(`[CyberFitness SchematicComplete] Failed to update profile for ${userId} after schematic ${schematicId} completion. Error: ${updateResult.error}`);
            return { success: false, error: updateResult.error || "Ошибка сохранения прогресса схемы." };
        }
        
        logger.info(`[CyberFitness SchematicComplete EXIT] Schematic ${schematicId} completed by ${userId}. KV Awarded: ${awardedKV}. Perks: ${newPerksUnlocked.join(',')}. New Ach count: ${updateResult.newAchievements?.length}`);
        return { 
            success: true, 
            newAchievements: updateResult.newAchievements,
            newPerks: newPerksUnlocked, 
            kiloVibesAwarded: awardedKV
        };

    } catch (e: any) {
        logger.error(`[CyberFitness SchematicComplete CATCH] Exception for ${userId}, schematic ${schematicId}:`, e);
        return { success: false, error: e.message || "Неожиданная ошибка при освоении схемы." };
    }
};

export const fetchUserCyberFitnessProfile = async (userId: string): Promise<{ success: boolean; data?: CyberFitnessProfile; error?: string }> => {
  logger.info(`[CyberFitness FetchProfile ENTRY] Attempting to fetch profile for user_id: ${userId}`);
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
        logger.info(`[CyberFitness FetchProfile EXIT] Successfully parsed CyberFitness profile for user ${userId}. Level: ${profile.level}, KiloVibes: ${profile.kiloVibes}, CompletedQuests: ${profile.completedQuests.join(', ')}`);
    }
    return { success: true, data: profile };
  } catch (e: any) {
    logger.error(`[CyberFitness FetchProfile CATCH] Exception fetching profile for user ${userId}:`, e);
    return { success: false, error: e.message || "Failed to fetch CyberFitness profile.", data: getCyberFitnessProfile(userId, null) }; 
  }
};