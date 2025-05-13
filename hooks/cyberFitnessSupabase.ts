"use client"; 
import { supabaseAdmin } from './supabase'; 
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
  focusTimeHours?: number; 
  skillsLeveled?: number; 
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
    { 
      id: "two_finger_fu", 
      name: "Кунг-фу Двух Пальцев", 
      description: "Продемонстрировал мастерство молниеносного мобильного ввода и навигации в стиле Mortal Kombat.", 
      icon: "FaMobileScreenButton", 
      kiloVibesAward: 75, 
      checkCondition: () => false 
    },

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
    finalProfile = {
        ...defaultProfile,
        ...existingProfile,
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
  }
  return finalProfile;
};

export const fetchUserCyberFitnessProfile = async (userId: string): Promise<{ success: boolean; data?: CyberFitnessProfile; error?: string }> => {
  logger.log(`[CyberFitness FetchProfile ENTRY] Fetching profile for user: ${userId}`);
  if (!userId) {
    logger.warn("[CyberFitness FetchProfile] User ID is required.");
    return { success: false, error: "User ID is required.", data: getDefaultCyberFitnessProfile() };
  }
  if (!supabaseAdmin) { 
    logger.error("[CyberFitness FetchProfile] Admin client not available.");
    return { success: false, error: "Admin client unavailable.", data: getDefaultCyberFitnessProfile() }; 
  }
  
  try {
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", userId)
      .maybeSingle(); 

    if (userError) {
        logger.error(`[CyberFitness FetchProfile] Supabase error fetching user data for ${userId}:`, userError);
        return { success: false, error: userError.message, data: getCyberFitnessProfile(userId, null) }; 
    }
    
    const profile = getCyberFitnessProfile(userId, userData?.metadata); 
    if (!userData) {
        logger.warn(`[CyberFitness FetchProfile] User ${userId} not found in DB. Returning default profile. Will create metadata on first update.`);
    } else if (!userData.metadata || !userData.metadata[CYBERFIT_METADATA_KEY]) {
        logger.info(`[CyberFitness FetchProfile] User ${userId} found, but no CyberFitness metadata yet. Returning default. Will create on first update.`);
    } else {
        logger.log(`[CyberFitness FetchProfile EXIT] Parsed CyberFitness profile for user ${userId}. Level: ${profile.level}, KiloVibes: ${profile.kiloVibes}`);
    }
    return { success: true, data: profile };
  } catch (e: any) {
    logger.error(`[CyberFitness FetchProfile CATCH] Exception fetching profile for user ${userId}:`, e);
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
  if (!supabaseAdmin) {
    logger.error("[CyberFitness UpdateProfile] Admin client is not available.");
    return { success: false, error: "Admin client is not available for profile update." };
  }

  const isTrueMockSession = process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true' && MOCK_USER_ID_NUM !== null && userId === MOCK_USER_ID_NUM.toString();
  logger.debug(`[CyberFitness UpdateProfile] isTrueMockSession: ${isTrueMockSession} (NEXT_PUBLIC_USE_MOCK_USER: ${process.env.NEXT_PUBLIC_USE_MOCK_USER}, MOCK_USER_ID_NUM: ${MOCK_USER_ID_NUM}, userId: ${userId})`);

  try {
    const { data: currentUserData, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", userId)
      .maybeSingle(); 

    if (fetchError) {
      logger.error(`[CyberFitness UpdateProfile] Failed to fetch current metadata for ${userId} using admin client:`, fetchError);
      throw fetchError; 
    }
   
    const existingOverallMetadata = currentUserData?.metadata || {};
    let existingCyberFitnessProfile = getCyberFitnessProfile(userId, existingOverallMetadata);
    logger.debug(`[CyberFitness UpdateProfile] Fetched existing profile for ${userId}. Achievements before this update: ${(existingCyberFitnessProfile.achievements || []).join(', ')}`);


    const newCyberFitnessProfile: CyberFitnessProfile = {
      ...existingCyberFitnessProfile, 
      lastActivityTimestamp: new Date().toISOString(), 
    };

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

    if (updates.activeQuests && Array.isArray(updates.activeQuests)) newCyberFitnessProfile.activeQuests = Array.from(new Set([...(newCyberFitnessProfile.activeQuests || []), ...updates.activeQuests]));
    if (updates.completedQuests && Array.isArray(updates.completedQuests)) {
        newCyberFitnessProfile.completedQuests = Array.from(new Set([...(newCyberFitnessProfile.completedQuests || []), ...updates.completedQuests]));
        newCyberFitnessProfile.activeQuests = (newCyberFitnessProfile.activeQuests || []).filter(q => !updates.completedQuests!.includes(q));
    }
    if (updates.unlockedPerks && Array.isArray(updates.unlockedPerks)) newCyberFitnessProfile.unlockedPerks = Array.from(new Set([...(newCyberFitnessProfile.unlockedPerks || []), ...updates.unlockedPerks]));
    
    if (updates.cognitiveOSVersion && typeof updates.cognitiveOSVersion === 'string') newCyberFitnessProfile.cognitiveOSVersion = updates.cognitiveOSVersion;
    if (updates.dailyActivityLog && Array.isArray(updates.dailyActivityLog)) newCyberFitnessProfile.dailyActivityLog = updates.dailyActivityLog; 
    if (updates.featuresUsed && typeof updates.featuresUsed === 'object') newCyberFitnessProfile.featuresUsed = {...newCyberFitnessProfile.featuresUsed, ...updates.featuresUsed};
    
    if (typeof updates.totalFilesExtracted === 'number') newCyberFitnessProfile.totalFilesExtracted = (newCyberFitnessProfile.totalFilesExtracted || 0) + updates.totalFilesExtracted;
    if (typeof updates.totalTokensProcessed === 'number') newCyberFitnessProfile.totalTokensProcessed = (newCyberFitnessProfile.totalTokensProcessed || 0) + updates.totalTokensProcessed;
    if (typeof updates.totalKworkRequestsSent === 'number') newCyberFitnessProfile.totalKworkRequestsSent = (newCyberFitnessProfile.totalKworkRequestsSent || 0) + updates.totalKworkRequestsSent;
    if (typeof updates.totalPrsCreated === 'number') newCyberFitnessProfile.totalPrsCreated = (newCyberFitnessProfile.totalPrsCreated || 0) + updates.totalPrsCreated;
    if (typeof updates.totalBranchesUpdated === 'number') newCyberFitnessProfile.totalBranchesUpdated = (newCyberFitnessProfile.totalBranchesUpdated || 0) + updates.totalBranchesUpdated;
    
    const newlyUnlockedAchievements: Achievement[] = [];
    let currentAchievementsSet = new Set(newCyberFitnessProfile.achievements || []); // Operate on potentially already existing achievements

    for (const ach of ALL_ACHIEVEMENTS) {
        if (!currentAchievementsSet.has(ach.id) && ach.checkCondition(newCyberFitnessProfile)) {
            currentAchievementsSet.add(ach.id); 
            newlyUnlockedAchievements.push(ach);
            if (ach.kiloVibesAward && typeof ach.kiloVibesAward === 'number') { 
                newCyberFitnessProfile.kiloVibes = (newCyberFitnessProfile.kiloVibes || 0) + ach.kiloVibesAward;
            }
        }
    }
    newCyberFitnessProfile.achievements = Array.from(currentAchievementsSet);
    logger.debug(`[CyberFitness UpdateProfile] Achievements for ${userId} after evaluation: ${newCyberFitnessProfile.achievements.join(', ')}`);


    if (newlyUnlockedAchievements.length > 0) {
        logger.info(`[CyberFitness UpdateProfile] User ${userId} unlocked new achievements:`, newlyUnlockedAchievements.map(a => `${a.name} (+${a.kiloVibesAward || 0}KV)`));
    }

    const newOverallMetadata: UserMetadata = {
      ...existingOverallMetadata, 
      [CYBERFIT_METADATA_KEY]: newCyberFitnessProfile, 
    };
        
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from("users")
      .update({ metadata: newOverallMetadata, updated_at: new Date().toISOString() }) 
      .eq("user_id", userId)
      .select("*, metadata") 
      .single(); 

    if (updateError) {
      logger.error(`[CyberFitness UpdateProfile] Error saving updated profile for ${userId} using admin client:`, updateError);
      throw updateError; 
    }
    if (!updatedUser) {
      logger.error(`[CyberFitness UpdateProfile] User ${userId} not found after update attempt (should not happen if user was fetched or created).`);
      return { success: false, error: `User ${userId} not found after profile update attempt.` };
    }

    logger.log(`[CyberFitness UpdateProfile EXIT] Successfully updated profile for ${userId}. New KiloVibes: ${newCyberFitnessProfile.kiloVibes}, Level: ${newCyberFitnessProfile.level}`);
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
      if (count < 0 && actionType !== 'tokensProcessed') { 
         logger.warn(`[CyberFitness LogAction] Negative count (${count}) for '${actionType}'. Correcting to 0.`);
         count = 0;
         countOrDetails = 0; 
      }
  } else if (actionType !== 'featureUsed') {
       logger.warn(`[CyberFitness LogAction] Invalid countOrDetails type for action '${actionType}'. Expected number.`);
       return { success: false, error: `Invalid data for action ${actionType}.` };
  }

  try {
    const profileResult = await fetchUserCyberFitnessProfile(userId);
    if (!profileResult.data) { 
      logger.error(`[CyberFitness LogAction] Failed to get profile data for ${userId}. Error: ${profileResult.error}`);
      return { success: false, error: profileResult.error || "Failed to get current profile data." };
    }
    
    let currentProfile = profileResult.data; 

    let dailyLog = currentProfile.dailyActivityLog ? [...currentProfile.dailyActivityLog] : [];
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    let todayEntry = dailyLog.find(entry => entry.date === todayStr);

    if (!todayEntry) {
      todayEntry = { date: todayStr, filesExtracted: 0, tokensProcessed: 0, kworkRequestsSent: 0, prsCreated: 0, branchesUpdated: 0 };
      dailyLog.push(todayEntry);
    } else {
       todayEntry.filesExtracted = todayEntry.filesExtracted || 0;
       todayEntry.tokensProcessed = todayEntry.tokensProcessed || 0;
       todayEntry.kworkRequestsSent = todayEntry.kworkRequestsSent || 0;
       todayEntry.prsCreated = todayEntry.prsCreated || 0;
       todayEntry.branchesUpdated = todayEntry.branchesUpdated || 0;
    }
    
    const profileUpdates: Partial<CyberFitnessProfile> = {
        featuresUsed: { ...(currentProfile.featuresUsed || {}) } 
    };

    if (actionType === 'filesExtracted' && typeof countOrDetails === 'number') {
        todayEntry.filesExtracted += countOrDetails;
        profileUpdates.totalFilesExtracted = countOrDetails; 
        if (countOrDetails >= 20 && !currentProfile.featuresUsed?.added20PlusFilesToKworkOnce) {
             profileUpdates.featuresUsed!.added20PlusFilesToKworkOnce = true; 
        } else if (countOrDetails >= 10 && !currentProfile.featuresUsed?.added10PlusFilesToKworkOnce) {
            profileUpdates.featuresUsed!.added10PlusFilesToKworkOnce = true;
        }
    } else if (actionType === 'tokensProcessed' && typeof countOrDetails === 'number') {
        todayEntry.tokensProcessed += countOrDetails;
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
        const featureName = countOrDetails.featureName;
        profileUpdates.featuresUsed![featureName] = true;
    }

    dailyLog.sort((a, b) => b.date.localeCompare(a.date)); 
    if (dailyLog.length > MAX_DAILY_LOG_ENTRIES) {
      dailyLog = dailyLog.slice(0, MAX_DAILY_LOG_ENTRIES);
    }
    profileUpdates.dailyActivityLog = dailyLog;

    const updateResult = await updateUserCyberFitnessProfile(userId, profileUpdates);
    
    if (!updateResult.success) {
      logger.error(`[CyberFitness LogAction] Failed to save profile for ${userId} after logging ${actionType}. Error: ${updateResult.error}`);
      return { success: false, error: updateResult.error || "Failed to save updated profile." };
    }

    logger.log(`[CyberFitness LogAction EXIT] Action '${actionType}' logged for ${userId}. New achievements:`, updateResult.newAchievements?.map(a => a.id));
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

  const isTrueMockSession = process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true' && MOCK_USER_ID_NUM !== null && userId === MOCK_USER_ID_NUM.toString();

  const currentProfileResult = await fetchUserCyberFitnessProfile(userId);
  if (!currentProfileResult.success || !currentProfileResult.data) {
    logger.error(`[CyberFitness QuestComplete] Failed to fetch profile for ${userId}. Error: ${currentProfileResult.error}`);
    return { success: false, error: currentProfileResult.error || "Failed to fetch current profile before quest completion." };
  }
  const currentProfile = currentProfileResult.data;

  if (!isTrueMockSession && currentProfile.completedQuests?.includes(questId)) {
    logger.info(`[CyberFitness QuestComplete] Quest ${questId} already completed by user ${userId}. Checking for new perks only.`);
    let shouldUpdateForPerksOnly = false;
    const updatesForPerks: Partial<CyberFitnessProfile> = {};
    if (newPerks && Array.isArray(newPerks) && newPerks.length > 0) {
        const existingPerksSet = new Set(currentProfile.unlockedPerks || []);
        const uniqueNewPerks = newPerks.filter(p => !existingPerksSet.has(p));
        if (uniqueNewPerks.length > 0) {
            updatesForPerks.unlockedPerks = uniqueNewPerks; 
            shouldUpdateForPerksOnly = true;
            logger.log(`[CyberFitness QuestComplete] User ${userId} unlocking new perks for already completed quest:`, uniqueNewPerks);
        }
    }
    if (shouldUpdateForPerksOnly) {
        return updateUserCyberFitnessProfile(userId, updatesForPerks); 
    }
    return { success: true, data: undefined, newAchievements: [] }; 
  }

  const updates: Partial<CyberFitnessProfile> = {
    kiloVibes: kiloVibesAwarded > 0 ? kiloVibesAwarded : 0, 
    completedQuests: [questId], 
  };

  if (newLevel !== undefined && typeof newLevel === 'number' && newLevel > (currentProfile.level || 0)) {
    updates.level = newLevel; 
    logger.log(`[CyberFitness QuestComplete] User ${userId} leveled up to ${newLevel}!`);
  } else if (newLevel !== undefined) {
    logger.log(`[CyberFitness QuestComplete] User ${userId} (Lvl ${currentProfile.level || 0}) completed quest for Lvl ${newLevel}. Level not changed as it's not higher.`);
  }

  if (newPerks && Array.isArray(newPerks) && newPerks.length > 0) {
    updates.unlockedPerks = newPerks; 
    logger.log(`[CyberFitness QuestComplete] User ${userId} granted perks:`, newPerks);
  }
  
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
  if (!profileResult.success || typeof profileResult.data?.level !== 'number') { 
    logger.warn(`[CyberFitness GetLevel] Failed to get level for ${userId}. Success: ${profileResult.success}, Error: ${profileResult.error}, Level: ${profileResult.data?.level}`);
    return { success: false, level: 0, error: profileResult.error || "Level not found or profile fetch failed" };
  }
  logger.log(`[CyberFitness GetLevel EXIT] Level for ${userId} is ${profileResult.data.level}`);
  return { success: true, level: profileResult.data.level };
};

export const getAchievementDetails = (achievementId: string): Achievement | undefined => {
    if (!achievementId) return undefined;
    return ALL_ACHIEVEMENTS.find(ach => ach.id === achievementId);
};