"use client"; 
import { supabaseAdmin, createAuthenticatedClient } from './supabase'; // createAuthenticatedClient might still be needed elsewhere, keeping import for now
import type { Database } from "@/types/database.types";
import { debugLogger as logger } from "@/lib/debugLogger";
import { format } from 'date-fns';

type DbUser = Database["public"]["Tables"]["users"]["Row"];
type UserMetadata = DbUser['metadata'];

const MOCK_USER_ID_STR_ENV = process.env.NEXT_PUBLIC_MOCK_USER_ID || "413553377";
let MOCK_USER_ID_NUM: number | null = null;
if (process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true') {
    const parsedId = parseInt(MOCK_USER_ID_STR_ENV, 10);
    if (!isNaN(parsedId)) {
        MOCK_USER_ID_NUM = parsedId;
    } else {
        logger.error(`[CyberFitness] Invalid NEXT_PUBLIC_MOCK_USER_ID: "${MOCK_USER_ID_STR_ENV}". Must be a number.`);
    }
}

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
  focusTimeHours?: number; // Made optional as it might not always be tracked/present
  skillsLeveled?: number; // Made optional
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
    kiloVibesAward?: number; 
}

export const ALL_ACHIEVEMENTS: Achievement[] = [
    // --- General Achievements ---
    { id: "first_blood", name: "Первая Кровь", description: "Первая залогированная активность в CyberFitness.", icon: "FaVial", kiloVibesAward: 10, checkCondition: (p) => (p.dailyActivityLog?.length ?? 0) > 0 || (p.totalFilesExtracted ?? 0) > 0 || (p.totalTokensProcessed ?? 0) > 0 || (p.totalKworkRequestsSent ?? 0) > 0 },
    { id: "prompt_engineer_1", name: "Инженер Промптов I", description: "Отправлено 10 запросов к AI.", icon: "FaPaperPlane", kiloVibesAward: 50, checkCondition: (p) => (p.totalKworkRequestsSent ?? 0) >= 10 },
    { id: "branch_master_1", name: "Мастер Ветвления I", description: "Обновлено 5 веток.", icon: "FaCodeBranch", kiloVibesAward: 75, checkCondition: (p) => (p.totalBranchesUpdated ?? 0) >= 5 },
    { id: "pr_pioneer_1", name: "Пионер Pull Request'ов I", description: "Создано 3 PR.", icon: "FaGithub", kiloVibesAward: 100, checkCondition: (p) => (p.totalPrsCreated ?? 0) >= 3 },
    { id: "architect", name: "Архитектор Контекста", description: "Использована функция 'Добавить все файлы + дерево'.", icon: "FaTree", kiloVibesAward: 30, checkCondition: (p) => p.featuresUsed?.usedAddFullTree === true },
    { id: "sharpshooter", name: "Меткий Стрелок", description: "Использована функция 'Выбрать Связанные Файлы'.", icon: "FaCrosshairs", kiloVibesAward: 30, checkCondition: (p) => p.featuresUsed?.usedSelectHighlighted === true },
    { id: "code_explorer_1", name: "Исследователь Кода I", description: "Добавлено 100 файлов в запросы к AI.", icon: "FaSearchengin", kiloVibesAward: 50, checkCondition: (p) => (p.totalFilesExtracted ?? 0) >= 100 },
    { id: "ai_whisperer_1", name: "Заклинатель AI I", description: "Обработано 10,000 токенов AI.", icon: "FaRobot", kiloVibesAward: 50, checkCondition: (p) => (p.totalTokensProcessed ?? 0) >= 10000 },
    { id: "kwork_context_pro_10", name: "Профи Контекста KWork (10+)", description: "Добавлено 10+ файлов в KWork за один раз.", icon: "FaPlus", kiloVibesAward: 50, checkCondition: (p) => (p.featuresUsed?.added10PlusFilesToKworkOnce === true )},
    { id: "kwork_context_pro_20", name: "Гуру Контекста KWork (20+)", description: "Добавлено 20+ файлов в KWork за один раз.", icon: "FaPlus", kiloVibesAward: 100, checkCondition: (p) => (p.featuresUsed?.added20PlusFilesToKworkOnce === true )},
    
    // --- Feature Usage Achievements ---
    { id: "sticky_chat_opened", name: "Первый Контакт с XUINITY", description: "Первое открытие StickyChat для быстрой помощи.", icon: "FaCommentDots", kiloVibesAward: 10, checkCondition: (p) => p.featuresUsed?.sticky_chat_opened === true },
    { id: "settings_opened", name: "Калибровка Систем", description: "Первое открытие настроек Экстрактора/Ассистента.", icon: "FaGears", kiloVibesAward: 10, checkCondition: (p) => p.featuresUsed?.settings_opened === true },
    { id: "kwork_cleared", name: "Чистый Лист", description: "Использована функция 'Очистить все' в поле запроса KWork.", icon: "FaBroom", kiloVibesAward: 5, checkCondition: (p) => p.featuresUsed?.kwork_cleared === true },
    { id: "system_prompt_copied", name: "Шепот Мастера", description: "Системный промпт скопирован для передачи AI.", icon: "FaScroll", kiloVibesAward: 15, checkCondition: (p) => p.featuresUsed?.system_prompt_copied === true },
    { id: "image_modal_opened", name: "Визуальный Коннект", description: "Открыто модальное окно для работы с изображениями в AI Assistant.", icon: "FaImages", kiloVibesAward: 15, checkCondition: (p) => p.featuresUsed?.image_modal_opened === true },

    // --- Quest Achievements - their checkCondition is false as they are awarded directly ---
    { id: "initial_boot_sequence", name: "Квест: Пойман Сигнал!", description: "Успешно инициирован рабочий флоу через StickyChat или URL. +25 KiloVibes", icon: "FaBolt", checkCondition: () => false },
    { id: "first_fetch_completed", name: "Квест: Первая Загрузка", description: "Успешно загружены файлы из репозитория. +75 KiloVibes", icon: "FaDownload", checkCondition: () => false },
    { id: "first_parse_completed", name: "Квест: Первый Парсинг", description: "Успешно разобран ответ от AI. +150 KiloVibes", icon: "FaCode", checkCondition: () => false },
    { id: "first_pr_created", name: "Квест: Первый PR", description: "Успешно создан Pull Request. +250 KiloVibes", icon: "FaGithub", checkCondition: () => false },
];

// Helper to get default profile structure
const getDefaultCyberFitnessProfile = (): CyberFitnessProfile => ({
    level: 0, kiloVibes: 0, focusTimeHours: 0, skillsLeveled: 0,
    activeQuests: [], completedQuests: [], unlockedPerks: [],
    cognitiveOSVersion: "v0.1 Genesis", lastActivityTimestamp: new Date(0).toISOString(), 
    dailyActivityLog: [], achievements: [],
    totalFilesExtracted: 0, totalTokensProcessed: 0, totalKworkRequestsSent: 0,
    totalPrsCreated: 0, totalBranchesUpdated: 0, featuresUsed: {},
});


const getCyberFitnessProfile = (userId: string | null, metadata: UserMetadata | null | undefined): CyberFitnessProfile => {
  const defaultProfile = getDefaultCyberFitnessProfile();
  let finalProfile = defaultProfile;

  if (metadata && typeof metadata === 'object' && metadata[CYBERFIT_METADATA_KEY] && typeof metadata[CYBERFIT_METADATA_KEY] === 'object') {
    const existingProfile = metadata[CYBERFIT_METADATA_KEY] as Partial<CyberFitnessProfile>;
    // Merge defaults with existing, ensuring type safety and handling missing fields
    finalProfile = {
        ...defaultProfile,
        ...existingProfile,
        // Ensure arrays and objects are correctly initialized if missing/null in saved data
        dailyActivityLog: Array.isArray(existingProfile.dailyActivityLog) ? existingProfile.dailyActivityLog : defaultProfile.dailyActivityLog,
        achievements: Array.isArray(existingProfile.achievements) ? existingProfile.achievements : defaultProfile.achievements,
        activeQuests: Array.isArray(existingProfile.activeQuests) ? existingProfile.activeQuests : defaultProfile.activeQuests,
        completedQuests: Array.isArray(existingProfile.completedQuests) ? existingProfile.completedQuests : defaultProfile.completedQuests,
        unlockedPerks: Array.isArray(existingProfile.unlockedPerks) ? existingProfile.unlockedPerks : defaultProfile.unlockedPerks,
        featuresUsed: typeof existingProfile.featuresUsed === 'object' && existingProfile.featuresUsed !== null ? existingProfile.featuresUsed : defaultProfile.featuresUsed,
        // Ensure numbers default to 0 if undefined/null
        level: typeof existingProfile.level === 'number' ? existingProfile.level : defaultProfile.level,
        kiloVibes: typeof existingProfile.kiloVibes === 'number' ? existingProfile.kiloVibes : defaultProfile.kiloVibes,
        focusTimeHours: typeof existingProfile.focusTimeHours === 'number' ? existingProfile.focusTimeHours : defaultProfile.focusTimeHours,
        skillsLeveled: typeof existingProfile.skillsLeveled === 'number' ? existingProfile.skillsLeveled : defaultProfile.skillsLeveled,
        totalFilesExtracted: typeof existingProfile.totalFilesExtracted === 'number' ? existingProfile.totalFilesExtracted : defaultProfile.totalFilesExtracted,
        totalTokensProcessed: typeof existingProfile.totalTokensProcessed === 'number' ? existingProfile.totalTokensProcessed : defaultProfile.totalTokensProcessed,
        totalKworkRequestsSent: typeof existingProfile.totalKworkRequestsSent === 'number' ? existingProfile.totalKworkRequestsSent : defaultProfile.totalKworkRequestsSent,
        totalPrsCreated: typeof existingProfile.totalPrsCreated === 'number' ? existingProfile.totalPrsCreated : defaultProfile.totalPrsCreated,
        totalBranchesUpdated: typeof existingProfile.totalBranchesUpdated === 'number' ? existingProfile.totalBranchesUpdated : defaultProfile.totalBranchesUpdated,
        // Ensure strings default correctly
        cognitiveOSVersion: typeof existingProfile.cognitiveOSVersion === 'string' ? existingProfile.cognitiveOSVersion : defaultProfile.cognitiveOSVersion,
        lastActivityTimestamp: typeof existingProfile.lastActivityTimestamp === 'string' ? existingProfile.lastActivityTimestamp : defaultProfile.lastActivityTimestamp,
    };
  }
  
  // If it's the mock user, reset achievements and completedQuests for "fresh session" feel *after* merging
  if (userId && MOCK_USER_ID_NUM !== null && userId === MOCK_USER_ID_NUM.toString()) {
      logger.debug(`[CyberFitness getProfile] Mock user (${userId}) detected. Resetting achievements and completedQuests for this fetch.`);
      finalProfile.achievements = [];
      finalProfile.completedQuests = [];
      // Note: Active quests & perks might persist if they were updated previously in the DB metadata
  }

  return finalProfile;
};

export const fetchUserCyberFitnessProfile = async (userId: string): Promise<{ success: boolean; data?: CyberFitnessProfile; error?: string }> => {
  logger.log(`[CyberFitness FetchProfile ENTRY] Fetching profile for user: ${userId}`);
  if (!userId) {
    logger.warn("[CyberFitness FetchProfile] User ID is required.");
    return { success: false, error: "User ID is required." };
  }
  if (!supabaseAdmin) { 
    logger.error("[CyberFitness FetchProfile] Admin client not available.");
    // Return default profile structure on failure to ensure UI doesn't break
    return { success: false, error: "Admin client unavailable.", data: getCyberFitnessProfile(userId, null) }; 
  }
  
  try {
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", userId)
      .maybeSingle(); // Use maybeSingle to handle user not found gracefully

    if (userError) {
        logger.error(`[CyberFitness FetchProfile] Supabase error fetching user data for ${userId}:`, userError);
        // Return default profile even on DB error
        return { success: false, error: userError.message, data: getCyberFitnessProfile(userId, null) }; 
    }
    
    const profile = getCyberFitnessProfile(userId, userData?.metadata); // Pass potential null metadata safely
    if (!userData) {
        logger.warn(`[CyberFitness FetchProfile] User ${userId} not found in DB. Returning default profile.`);
    } else {
        logger.log(`[CyberFitness FetchProfile EXIT] Parsed CyberFitness profile for user ${userId}. Level: ${profile.level}, KiloVibes: ${profile.kiloVibes}`);
    }
    return { success: true, data: profile };
  } catch (e: any) {
    logger.error(`[CyberFitness FetchProfile CATCH] Exception fetching profile for user ${userId}:`, e);
    // Return default profile on exception
    return { success: false, error: e.message || "Failed to fetch CyberFitness profile.", data: getCyberFitnessProfile(userId, null) }; 
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
  // Use supabaseAdmin consistently as requested and identified as needed
  if (!supabaseAdmin) {
    logger.error("[CyberFitness UpdateProfile] Admin client is not available.");
    return { success: false, error: "Admin client is not available for profile update." };
  }

  const isMockCurrentSession = MOCK_USER_ID_NUM !== null && userId === MOCK_USER_ID_NUM.toString();

  try {
    // Fetch current metadata using supabaseAdmin
    const { data: currentUserData, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", userId)
      .maybeSingle(); // Use maybeSingle

    if (fetchError) {
      logger.error(`[CyberFitness UpdateProfile] Failed to fetch current metadata for ${userId} using admin client:`, fetchError);
      throw fetchError; // Re-throw DB errors
    }
    // User not found is not necessarily an error here, might be first update - proceed cautiously
    // if (!currentUserData) {
    //   logger.warn(`[CyberFitness UpdateProfile] User ${userId} not found for update.`);
    //   return { success: false, error: `User ${userId} not found for profile update.` };
    // }

    const existingOverallMetadata = currentUserData?.metadata || {};
    // Pass userId to getCyberFitnessProfile to handle mock user specifics if needed during initial parse
    let existingCyberFitnessProfile = getCyberFitnessProfile(userId, existingOverallMetadata);

    // Start building the new profile based on the existing one
    const newCyberFitnessProfile: CyberFitnessProfile = {
      ...existingCyberFitnessProfile, 
      lastActivityTimestamp: new Date().toISOString(), 
    };

    // Apply updates safely, checking types and adding totals correctly
    if (updates.level !== undefined && typeof updates.level === 'number') newCyberFitnessProfile.level = updates.level;
    if (updates.kiloVibes !== undefined && typeof updates.kiloVibes === 'number') {
        newCyberFitnessProfile.kiloVibes = (newCyberFitnessProfile.kiloVibes || 0) + updates.kiloVibes; 
    }
    if (updates.focusTimeHours !== undefined && typeof updates.focusTimeHours === 'number') {
        newCyberFitnessProfile.focusTimeHours = (newCyberFitnessProfile.focusTimeHours || 0) + updates.focusTimeHours; 
    }
    if (updates.skillsLeveled !== undefined && typeof updates.skillsLeveled === 'number') {
        newCyberFitnessProfile.skillsLeveled = (newCyberFitnessProfile.skillsLeveled || 0) + updates.skillsLeveled; 
    }

    // Merge arrays using Sets for uniqueness
    if (updates.activeQuests && Array.isArray(updates.activeQuests)) newCyberFitnessProfile.activeQuests = Array.from(new Set([...(newCyberFitnessProfile.activeQuests || []), ...updates.activeQuests]));
    if (updates.completedQuests && Array.isArray(updates.completedQuests)) {
        newCyberFitnessProfile.completedQuests = Array.from(new Set([...(newCyberFitnessProfile.completedQuests || []), ...updates.completedQuests]));
        // Remove completed quests from active quests
        newCyberFitnessProfile.activeQuests = (newCyberFitnessProfile.activeQuests || []).filter(q => !updates.completedQuests!.includes(q));
    }
    if (updates.unlockedPerks && Array.isArray(updates.unlockedPerks)) newCyberFitnessProfile.unlockedPerks = Array.from(new Set([...(newCyberFitnessProfile.unlockedPerks || []), ...updates.unlockedPerks]));
    
    if (updates.cognitiveOSVersion && typeof updates.cognitiveOSVersion === 'string') newCyberFitnessProfile.cognitiveOSVersion = updates.cognitiveOSVersion;
    // Overwrite daily log if provided, otherwise keep existing
    if (updates.dailyActivityLog && Array.isArray(updates.dailyActivityLog)) newCyberFitnessProfile.dailyActivityLog = updates.dailyActivityLog; 
    // Merge featuresUsed object
    if (updates.featuresUsed && typeof updates.featuresUsed === 'object') newCyberFitnessProfile.featuresUsed = {...newCyberFitnessProfile.featuresUsed, ...updates.featuresUsed};
    
    // Increment total counters safely
    if (typeof updates.totalFilesExtracted === 'number') newCyberFitnessProfile.totalFilesExtracted = (newCyberFitnessProfile.totalFilesExtracted || 0) + updates.totalFilesExtracted;
    if (typeof updates.totalTokensProcessed === 'number') newCyberFitnessProfile.totalTokensProcessed = (newCyberFitnessProfile.totalTokensProcessed || 0) + updates.totalTokensProcessed;
    if (typeof updates.totalKworkRequestsSent === 'number') newCyberFitnessProfile.totalKworkRequestsSent = (newCyberFitnessProfile.totalKworkRequestsSent || 0) + updates.totalKworkRequestsSent;
    if (typeof updates.totalPrsCreated === 'number') newCyberFitnessProfile.totalPrsCreated = (newCyberFitnessProfile.totalPrsCreated || 0) + updates.totalPrsCreated;
    if (typeof updates.totalBranchesUpdated === 'number') newCyberFitnessProfile.totalBranchesUpdated = (newCyberFitnessProfile.totalBranchesUpdated || 0) + updates.totalBranchesUpdated;
    
    // --- Achievement Calculation ---
    const newlyUnlockedAchievements: Achievement[] = [];
    // For mock user, start with an empty set of achievements for this "session" check.
    // For real users, use their *current* achievements from the profile *before* adding new ones.
    let currentAchievementsSet = new Set(isMockCurrentSession ? [] : (newCyberFitnessProfile.achievements || [])); 

    for (const ach of ALL_ACHIEVEMENTS) {
        // Check if achievement is NOT already in the set AND its condition is met by the *newly updated profile*
        if (!currentAchievementsSet.has(ach.id) && ach.checkCondition(newCyberFitnessProfile)) {
            currentAchievementsSet.add(ach.id); // Add to the set for this update cycle
            newlyUnlockedAchievements.push(ach);
            if (ach.kiloVibesAward && typeof ach.kiloVibesAward === 'number') { 
                newCyberFitnessProfile.kiloVibes = (newCyberFitnessProfile.kiloVibes || 0) + ach.kiloVibesAward;
            }
        }
    }
    // Update the achievements array in the profile *after* checking all conditions
    newCyberFitnessProfile.achievements = Array.from(currentAchievementsSet);
    // --- End Achievement Calculation ---

    if (newlyUnlockedAchievements.length > 0) {
        logger.info(`[CyberFitness UpdateProfile] User ${userId} unlocked new achievements:`, newlyUnlockedAchievements.map(a => `${a.name} (+${a.kiloVibesAward || 0}KV)`));
    }

    // Prepare the complete metadata object to save
    const newOverallMetadata: UserMetadata = {
      ...existingOverallMetadata, // Preserve other metadata fields if they exist
      [CYBERFIT_METADATA_KEY]: newCyberFitnessProfile, // Save the entire updated profile
    };
        
    // Save the updated metadata using supabaseAdmin
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from("users")
      .update({ metadata: newOverallMetadata, updated_at: new Date().toISOString() }) 
      .eq("user_id", userId)
      .select("*, metadata") // Select the updated user data
      .single(); // Expect a single user row back

    if (updateError) {
      logger.error(`[CyberFitness UpdateProfile] Error saving updated profile for ${userId} using admin client:`, updateError);
      // Handle specific errors if needed, e.g., RLS issues if policies are misconfigured even for admin
      throw updateError; // Re-throw DB errors
    }
    if (!updatedUser) {
      // This case might happen if the user was deleted between the fetch and update, though unlikely.
      logger.error(`[CyberFitness UpdateProfile] User ${userId} not found after update attempt.`);
      return { success: false, error: `User ${userId} not found after profile update attempt.` };
    }

    logger.log(`[CyberFitness UpdateProfile EXIT] Successfully updated profile for ${userId}. New KiloVibes: ${newCyberFitnessProfile.kiloVibes}, Level: ${newCyberFitnessProfile.level}`);
    // Return the updated user data and any new achievements
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
  
  // Validate count for non-feature actions
  let count = 0;
  if (typeof countOrDetails === 'number') {
      count = countOrDetails;
      if (count < 0 && actionType !== 'tokensProcessed') { // Allow negative token counts? Maybe not. Let's restrict.
         logger.warn(`[CyberFitness LogAction] Negative count (${count}) for '${actionType}'. Correcting to 0.`);
         count = 0;
         countOrDetails = 0; // Update the original variable too
      }
  } else if (actionType !== 'featureUsed') {
       logger.warn(`[CyberFitness LogAction] Invalid countOrDetails type for action '${actionType}'. Expected number.`);
       return { success: false, error: `Invalid data for action ${actionType}.` };
  }


  try {
    // Fetch the current profile first (uses admin client internally)
    const profileResult = await fetchUserCyberFitnessProfile(userId);
    // Ensure profile data exists, even if fetch had minor issues (like user not found initially)
    if (!profileResult.data) {
      logger.error(`[CyberFitness LogAction] Failed to get profile data for ${userId}. Error: ${profileResult.error}`);
      return { success: false, error: profileResult.error || "Failed to get current profile data." };
    }
    
    let currentProfile = profileResult.data; 

    // --- Daily Log Update ---
    let dailyLog = currentProfile.dailyActivityLog ? [...currentProfile.dailyActivityLog] : [];
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    let todayEntry = dailyLog.find(entry => entry.date === todayStr);

    if (!todayEntry) {
      // If no entry for today, create a new one and add it
      todayEntry = { date: todayStr, filesExtracted: 0, tokensProcessed: 0, kworkRequestsSent: 0, prsCreated: 0, branchesUpdated: 0 };
      dailyLog.push(todayEntry);
    } else {
      // Ensure all keys exist in the found entry, defaulting to 0 if missing
       todayEntry.filesExtracted = todayEntry.filesExtracted || 0;
       todayEntry.tokensProcessed = todayEntry.tokensProcessed || 0;
       todayEntry.kworkRequestsSent = todayEntry.kworkRequestsSent || 0;
       todayEntry.prsCreated = todayEntry.prsCreated || 0;
       todayEntry.branchesUpdated = todayEntry.branchesUpdated || 0;
    }
    // --- End Daily Log Update ---

    // Prepare updates object for updateUserCyberFitnessProfile
    // Initialize featuresUsed from current profile to avoid overwriting unrelated features
    const profileUpdates: Partial<CyberFitnessProfile> = {
        featuresUsed: { ...(currentProfile.featuresUsed || {}) } 
    };
    let awardedKiloVibesForAction = 0; // Track KV specifically for this action (mostly for features)

    // Update daily log entry AND prepare total counters for the update
    if (actionType === 'filesExtracted' && typeof countOrDetails === 'number') {
        todayEntry.filesExtracted += countOrDetails;
        profileUpdates.totalFilesExtracted = countOrDetails; // Send the delta to updateUser...
        // Check related feature achievements based on *this specific action's count*
        if (countOrDetails >= 20 && !currentProfile.featuresUsed?.added20PlusFilesToKworkOnce) {
             profileUpdates.featuresUsed!.added20PlusFilesToKworkOnce = true; 
             // KV award is handled by the achievement check in updateUser...
        } else if (countOrDetails >= 10 && !currentProfile.featuresUsed?.added10PlusFilesToKworkOnce) {
            profileUpdates.featuresUsed!.added10PlusFilesToKworkOnce = true;
             // KV award is handled by the achievement check in updateUser...
        }
    } else if (actionType === 'tokensProcessed' && typeof countOrDetails === 'number') {
        todayEntry.tokensProcessed += countOrDetails;
        profileUpdates.totalTokensProcessed = countOrDetails; // Send delta
    } else if (actionType === 'kworkRequestSent' && typeof countOrDetails === 'number') {
        todayEntry.kworkRequestsSent = (todayEntry.kworkRequestsSent || 0) + countOrDetails; // Update today's entry directly
        profileUpdates.totalKworkRequestsSent = countOrDetails; // Send delta
    } else if (actionType === 'prCreated' && typeof countOrDetails === 'number') {
        todayEntry.prsCreated = (todayEntry.prsCreated || 0) + countOrDetails;
        profileUpdates.totalPrsCreated = countOrDetails; // Send delta
    } else if (actionType === 'branchUpdated' && typeof countOrDetails === 'number') {
        todayEntry.branchesUpdated = (todayEntry.branchesUpdated || 0) + countOrDetails;
        profileUpdates.totalBranchesUpdated = countOrDetails; // Send delta
    } else if (actionType === 'featureUsed' && typeof countOrDetails === 'object' && countOrDetails.featureName) {
        const featureName = countOrDetails.featureName;
        // Mark the feature as used in the updates payload regardless of whether it was used before.
        // updateUserCyberFitnessProfile will handle the logic of awarding KV/achievements only once.
        profileUpdates.featuresUsed![featureName] = true;
        // // Optional: Award KV here directly if feature achievements don't grant KV?
        // const featureAch = ALL_ACHIEVEMENTS.find(a => a.id === featureName);
        // if (featureAch && !currentProfile.featuresUsed?.[featureName] && featureAch.kiloVibesAward) {
        //      awardedKiloVibesForAction += featureAch.kiloVibesAward;
        // }
    }

    // Only include KV update if specifically awarded by this action (currently only potential for features)
    if(awardedKiloVibesForAction > 0) {
        profileUpdates.kiloVibes = awardedKiloVibesForAction; // Pass the direct KV award delta
    }

    // Sort daily log and trim if needed
    dailyLog.sort((a, b) => b.date.localeCompare(a.date)); 
    if (dailyLog.length > MAX_DAILY_LOG_ENTRIES) {
      dailyLog = dailyLog.slice(0, MAX_DAILY_LOG_ENTRIES);
    }
    profileUpdates.dailyActivityLog = dailyLog; // Pass the updated daily log array

    // Call the centralized update function (now using admin client)
    const updateResult = await updateUserCyberFitnessProfile(userId, profileUpdates);
    
    if (!updateResult.success) {
      logger.error(`[CyberFitness LogAction] Failed to save profile for ${userId} after logging ${actionType}. Error: ${updateResult.error}`);
      return { success: false, error: updateResult.error || "Failed to save updated profile." };
    }

    logger.log(`[CyberFitness LogAction EXIT] Action '${actionType}' logged for ${userId}. New achievements:`, updateResult.newAchievements?.map(a => a.id));
    // Return success and any newly unlocked achievements from the update function
    return { success: true, newAchievements: updateResult.newAchievements };

  } catch (e: any) {
    logger.error(`[CyberFitness LogAction CATCH] Exception for ${userId} logging ${actionType}:`, e);
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
    // Simply call logCyberFitnessAction, which handles the update and achievement checks
    const result = await logCyberFitnessAction(userId, 'featureUsed', { featureName });
    logger.log(`[CyberFitness CheckFeatureAchievement EXIT] Result for ${featureName}: Success: ${result.success}, New achievements: ${result.newAchievements?.map(a=>a.id) ?? 'None'}`);
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

  const isMockCurrentSession = MOCK_USER_ID_NUM !== null && userId === MOCK_USER_ID_NUM.toString();

  // Fetch current profile first to check if quest is already completed (for non-mock users)
  const currentProfileResult = await fetchUserCyberFitnessProfile(userId);
  if (!currentProfileResult.success || !currentProfileResult.data) {
    logger.error(`[CyberFitness QuestComplete] Failed to fetch profile for ${userId}. Error: ${currentProfileResult.error}`);
    return { success: false, error: currentProfileResult.error || "Failed to fetch current profile before quest completion." };
  }
  const currentProfile = currentProfileResult.data;

  // For real users, if quest already completed, skip KV/level/completion logic, only update perks if new ones are provided
  if (!isMockCurrentSession && currentProfile.completedQuests?.includes(questId)) {
    logger.info(`[CyberFitness QuestComplete] Quest ${questId} already completed by user ${userId}. Checking for new perks only.`);
    let shouldUpdateForPerksOnly = false;
    const updatesForPerks: Partial<CyberFitnessProfile> = {};
    if (newPerks && Array.isArray(newPerks) && newPerks.length > 0) {
        const existingPerksSet = new Set(currentProfile.unlockedPerks || []);
        const uniqueNewPerks = newPerks.filter(p => !existingPerksSet.has(p));
        if (uniqueNewPerks.length > 0) {
            // Prepare only the perks update
            updatesForPerks.unlockedPerks = uniqueNewPerks; // Pass only the *new* unique perks to merge logic in updateUser...
            shouldUpdateForPerksOnly = true;
            logger.log(`[CyberFitness QuestComplete] User ${userId} unlocking new perks for already completed quest:`, uniqueNewPerks);
        }
    }
    // If there are new perks to add, call the update function
    if (shouldUpdateForPerksOnly) {
        // updateUserCyberFitnessProfile handles merging the new perks correctly
        return updateUserCyberFitnessProfile(userId, updatesForPerks); 
    }
    // If no new perks, just return success without updating DB
    return { success: true, data: undefined, newAchievements: [] }; 
  }

  // --- Prepare updates for quest completion (for mock users or first-time completion for real users) ---
  const updates: Partial<CyberFitnessProfile> = {
    kiloVibes: kiloVibesAwarded > 0 ? kiloVibesAwarded : 0, // Ensure non-negative KV award
    completedQuests: [questId], // Pass questId to be added to completed set
    // We don't need to explicitly remove from activeQuests here, updateUser... handles it
  };

  // Handle level up
  if (newLevel !== undefined && typeof newLevel === 'number' && newLevel > (currentProfile.level || 0)) {
    updates.level = newLevel; 
    logger.log(`[CyberFitness QuestComplete] User ${userId} leveled up to ${newLevel}!`);
  } else if (newLevel !== undefined) {
    logger.log(`[CyberFitness QuestComplete] User ${userId} (Lvl ${currentProfile.level || 0}) completed quest for Lvl ${newLevel}. Level not changed as it's not higher.`);
  }

  // Handle perks update - pass only new perks to merge logic
  if (newPerks && Array.isArray(newPerks) && newPerks.length > 0) {
    updates.unlockedPerks = newPerks; // Pass the array of perks to be merged/added
    logger.log(`[CyberFitness QuestComplete] User ${userId} granted perks:`, newPerks);
  }
  
  // Call the centralized update function
  const result = await updateUserCyberFitnessProfile(userId, updates);
  logger.log(`[CyberFitness QuestComplete EXIT] Update result for quest ${questId}: Success: ${result.success}, New achievements: ${result.newAchievements?.map(a=>a.id) ?? 'None'}`);
  return result;
};

export const setCognitiveOSVersion = async (userId: string, version: string): Promise<{ success: boolean; data?: DbUser; error?: string; newAchievements?: Achievement[] }> => {
  logger.log(`[CyberFitness OSVersion] Setting Cognitive OS version for ${userId} to: ${version}`);
  if (!userId || typeof version !== 'string') {
      return { success: false, error: "User ID and valid version string required." };
  }
  return updateUserCyberFitnessProfile(userId, { cognitiveOSVersion: version });
};

export const getUserCyberLevel = async (userId: string): Promise<{ success: boolean; level?: number; error?: string }> => {
  logger.log(`[CyberFitness GetLevel ENTRY] Getting level for user: ${userId}`);
  const profileResult = await fetchUserCyberFitnessProfile(userId);
  // Check success flag and if level exists and is a number
  if (!profileResult.success || typeof profileResult.data?.level !== 'number') { 
    logger.warn(`[CyberFitness GetLevel] Failed to get level for ${userId}. Success: ${profileResult.success}, Error: ${profileResult.error}, Level: ${profileResult.data?.level}`);
    // Return level 0 as a fallback if profile data is missing/incomplete
    return { success: false, level: 0, error: profileResult.error || "Level not found or profile fetch failed" };
  }
  logger.log(`[CyberFitness GetLevel EXIT] Level for ${userId} is ${profileResult.data.level}`);
  return { success: true, level: profileResult.data.level };
};

export const getAchievementDetails = (achievementId: string): Achievement | undefined => {
    if (!achievementId) return undefined;
    return ALL_ACHIEVEMENTS.find(ach => ach.id === achievementId);
};