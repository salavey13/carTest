"use server";

import { supabaseAdmin } from '@/hooks/supabase';
import { fetchUserData as genericFetchUserData } from '@/hooks/supabase';
import type { Database } from "@/types/database.types";
import { debugLogger as logger } from "@/lib/debugLogger";

// These types and constants are safe to be on the server
type DbUser = Database["public"]["Tables"]["users"]["Row"];
type UserMetadata = DbUser['metadata'];

export interface DailyActivityRecord {
  date: string; 
  filesExtracted: number;
  tokensProcessed: number;
  kworkRequestsSent: number; 
  prsCreated: number;
  branchesUpdated: number;
  focusTimeMinutes?: number; 
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
  featuresUsed: Record<string, boolean | number | string>; 
}

export const CYBERFIT_METADATA_KEY = "cyberFitness"; 
const QUEST_ORDER: string[] = [ "initial_boot_sequence", "first_fetch_completed", "first_parse_completed", "first_pr_created" ];
const LEVEL_THRESHOLDS_KV = [0, 50, 150, 400, 800, 1500, 2800, 5000, 8000, 12000, 17000, 23000, 30000, 40000, 50000, 75000, 100000]; 
const COGNITIVE_OS_VERSIONS = [
    "v0.1 Genesis", "v0.2 Neural Spark", "v0.3 Code Apprentice", "v0.4 Vibe Engineer", 
    "v0.5 Logic Architect", "v0.6 Context Weaver", "v0.7 Matrix Surfer", "v0.8 Quantum Coder", 
    "v0.9 Singularity Pilot", "v1.0 Ascended Node", "v1.1 Vibe Master", "v1.2 Digital Demiurge",
    "v1.3 Context Commander", "v1.4 Vibe Channeler", "v1.5 Nexus Oracle", "v1.6 Reality Shaper", "vX.X Transcendent UI", 
]; 

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
        // Ensure nested objects and arrays are correctly initialized to prevent errors
        dailyActivityLog: Array.isArray(existingProfile.dailyActivityLog) ? existingProfile.dailyActivityLog : [],
        achievements: Array.isArray(existingProfile.achievements) ? existingProfile.achievements : [],
        activeQuests: Array.isArray(existingProfile.activeQuests) ? existingProfile.activeQuests : [],
        completedQuests: Array.isArray(existingProfile.completedQuests) ? existingProfile.completedQuests : [], 
        unlockedPerks: Array.isArray(existingProfile.unlockedPerks) ? existingProfile.unlockedPerks : [],
        featuresUsed: typeof existingProfile.featuresUsed === 'object' && existingProfile.featuresUsed !== null ? existingProfile.featuresUsed : {},
    };
  }
  
  const currentLevel = finalProfile.level || 0;
  finalProfile.cognitiveOSVersion = COGNITIVE_OS_VERSIONS[currentLevel] || COGNITIVE_OS_VERSIONS[COGNITIVE_OS_VERSIONS.length -1] || defaultProfile.cognitiveOSVersion;
  finalProfile.skillsLeveled = new Set(finalProfile.unlockedPerks || []).size; 

  return finalProfile;
};

// This is the new, safe, server-side function
export const fetchUserCyberFitnessProfile = async (userId: string): Promise<{ success: boolean; data?: CyberFitnessProfile; error?: string }> => {
  logger.log(`[CyberFitness Server Action] Fetching profile for user_id: ${userId}`);
  if (!userId) {
    return { success: false, error: "User ID is required.", data: getDefaultCyberFitnessProfile() };
  }
  
  try {
    const userData = await genericFetchUserData(userId); 

    if (!userData) {
        logger.warn(`[CyberFitness Server Action] User ${userId} not found. Returning default profile.`);
        return { success: false, error: `User ${userId} not found.`, data: getCyberFitnessProfile(userId, null) };
    }
    
    const profile = getCyberFitnessProfile(userId, userData.metadata); 
    logger.log(`[CyberFitness Server Action] Successfully parsed profile for user ${userId}. Level: ${profile.level}`);
    return { success: true, data: profile };
  } catch (e: any) {
    logger.error(`[CyberFitness Server Action] Exception fetching profile for user ${userId}:`, e);
    return { success: false, error: e.message || "Failed to fetch profile.", data: getCyberFitnessProfile(userId, null) }; 
  }
};