// Shared pure functions for CyberFitness
// This file has NO directive - can be imported by both server and client code
// Contains only pure functions with no side effects (no database calls, no API calls)

import type { CyberFitnessProfile, Achievement, UserMetadata } from '@/types/cyberFitness';
import {
  CYBERFIT_METADATA_KEY,
  QUEST_ORDER,
  COGNITIVE_OS_VERSIONS,
  ALL_ACHIEVEMENTS
} from '@/types/cyberFitness';

/**
 * Returns the default CyberFitness profile structure
 * Pure function - no side effects
 */
export const getDefaultCyberFitnessProfile = (): CyberFitnessProfile => ({
  level: 0,
  kiloVibes: 0,
  focusTimeHours: 0,
  skillsLeveled: 0,
  activeQuests: [QUEST_ORDER[0]],
  completedQuests: [],
  unlockedPerks: [],
  cognitiveOSVersion: COGNITIVE_OS_VERSIONS[0],
  lastActivityTimestamp: new Date(0).toISOString(),
  dailyActivityLog: [],
  achievements: [],
  totalFilesExtracted: 0,
  totalTokensProcessed: 0,
  totalKworkRequestsSent: 0,
  totalPrsCreated: 0,
  totalBranchesUpdated: 0,
  featuresUsed: {},
});

/**
 * Parses and merges user metadata into a CyberFitnessProfile
 * Pure function - no side effects
 *
 * @param userId - The user ID (can be null for guest/default profiles)
 * @param metadata - The user's metadata object from the database
 * @returns A complete CyberFitnessProfile
 */
export const getCyberFitnessProfile = (
  userId: string | null,
  metadata: UserMetadata | null | undefined
): CyberFitnessProfile => {
  const defaultProfile = getDefaultCyberFitnessProfile();
  let finalProfile = { ...defaultProfile };

  if (metadata && typeof metadata === 'object' && metadata[CYBERFIT_METADATA_KEY] && typeof metadata[CYBERFIT_METADATA_KEY] === 'object') {
    const existingProfile = metadata[CYBERFIT_METADATA_KEY] as Partial<CyberFitnessProfile>;
    finalProfile = {
      ...defaultProfile,
      ...existingProfile,
      dailyActivityLog: Array.isArray(existingProfile.dailyActivityLog)
        ? existingProfile.dailyActivityLog.map(log => ({
            date: log.date,
            filesExtracted: log.filesExtracted || 0,
            tokensProcessed: log.tokensProcessed || 0,
            kworkRequestsSent: log.kworkRequestsSent || 0,
            prsCreated: log.prsCreated || 0,
            branchesUpdated: log.branchesUpdated || 0,
            focusTimeMinutes: log.focusTimeMinutes || 0,
          }))
        : defaultProfile.dailyActivityLog,
      achievements: Array.isArray(existingProfile.achievements)
        ? existingProfile.achievements
        : defaultProfile.achievements,
      activeQuests: Array.isArray(existingProfile.activeQuests)
        ? existingProfile.activeQuests
        : defaultProfile.activeQuests,
      completedQuests: Array.isArray(existingProfile.completedQuests)
        ? existingProfile.completedQuests
        : defaultProfile.completedQuests,
      unlockedPerks: Array.isArray(existingProfile.unlockedPerks)
        ? existingProfile.unlockedPerks
        : defaultProfile.unlockedPerks,
      featuresUsed: typeof existingProfile.featuresUsed === 'object' && existingProfile.featuresUsed !== null
        ? existingProfile.featuresUsed
        : defaultProfile.featuresUsed,
      level: typeof existingProfile.level === 'number' && !isNaN(existingProfile.level)
        ? existingProfile.level
        : defaultProfile.level,
      kiloVibes: typeof existingProfile.kiloVibes === 'number' && !isNaN(existingProfile.kiloVibes)
        ? existingProfile.kiloVibes
        : defaultProfile.kiloVibes,
      focusTimeHours: typeof existingProfile.focusTimeHours === 'number' && !isNaN(existingProfile.focusTimeHours)
        ? existingProfile.focusTimeHours
        : defaultProfile.focusTimeHours,
      totalFilesExtracted: typeof existingProfile.totalFilesExtracted === 'number'
        ? existingProfile.totalFilesExtracted
        : defaultProfile.totalFilesExtracted,
      totalTokensProcessed: typeof existingProfile.totalTokensProcessed === 'number'
        ? existingProfile.totalTokensProcessed
        : defaultProfile.totalTokensProcessed,
      totalKworkRequestsSent: typeof existingProfile.totalKworkRequestsSent === 'number'
        ? existingProfile.totalKworkRequestsSent
        : defaultProfile.totalKworkRequestsSent,
      totalPrsCreated: typeof existingProfile.totalPrsCreated === 'number'
        ? existingProfile.totalPrsCreated
        : defaultProfile.totalPrsCreated,
      totalBranchesUpdated: typeof existingProfile.totalBranchesUpdated === 'number'
        ? existingProfile.totalBranchesUpdated
        : defaultProfile.totalBranchesUpdated,
    };

    if (finalProfile.activeQuests.length === 0 && finalProfile.completedQuests.length === 0 && QUEST_ORDER.length > 0) {
      finalProfile.activeQuests = [QUEST_ORDER[0]];
    }
  }

  const currentLevel = finalProfile.level || 0;
  finalProfile.cognitiveOSVersion = COGNITIVE_OS_VERSIONS[currentLevel] || COGNITIVE_OS_VERSIONS[COGNITIVE_OS_VERSIONS.length - 1] || defaultProfile.cognitiveOSVersion;
  finalProfile.skillsLeveled = new Set(finalProfile.unlockedPerks || []).size;

  return finalProfile;
};

/**
 * Gets achievement details by ID
 * Pure function - no side effects
 */
export const getAchievementDetails = (achievementId: string): Achievement | undefined => {
  if (!achievementId) return undefined;

  const achievement = ALL_ACHIEVEMENTS.find(ach => ach.id === achievementId);
  if (achievement) return achievement;

  // Dynamic achievement patterns
  if (achievementId.startsWith("level_up_")) {
    const levelMatch = achievementId.match(/^level_up_(\d+)$/);
    if (levelMatch && levelMatch[1]) {
      const level = parseInt(levelMatch[1], 10);
      if (!isNaN(level)) {
        return {
          id: achievementId,
          name: `Достигнут Уровень ${level}!`,
          description: `Вы достигли ${level}-го уровня КиберФитнеса. Новые перки и возможности открыты.`,
          icon: 'FaStar',
          checkCondition: () => true,
          kiloVibesAward: 0,
          isDynamic: true,
        };
      }
    }
  }

  if (achievementId.startsWith("mastered_schematic_")) {
    const schematicNamePartFromId = achievementId.substring("mastered_schematic_".length).replace(/_/g, ' ');
    return {
      id: achievementId,
      name: `Схема '${schematicNamePartFromId}' Освоена!`,
      description: `Вы успешно применили и освоили схему '${schematicNamePartFromId}'.`,
      icon: 'FaTasks',
      checkCondition: () => true,
      kiloVibesAward: 0,
      isDynamic: true,
    };
  }

  return undefined;
};

/**
 * Checks if a quest is unlocked based on completed quests
 * Pure function - no side effects
 */
export const isQuestUnlocked = (
  questId: string,
  completedQuests: string[] | undefined,
  questOrder: string[]
): boolean => {
  const questIndex = questOrder.indexOf(questId);
  if (questIndex === -1) return false;
  if (questIndex === 0) return true;

  const previousQuestId = questOrder[questIndex - 1];
  return !!completedQuests?.includes(previousQuestId);
};

export const TOKEN_ESTIMATION_FACTOR = 4;