"use client"; 
import { supabaseAdmin } from './supabase'; 
import { updateUserMetadata as genericUpdateUserMetadata, fetchUserData as genericFetchUserData } from './supabase'; 
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

const CYBERFIT_METADATA_KEY = "cyberFitness";
const MAX_DAILY_LOG_ENTRIES = 30; 

export interface Achievement { 
    id: string;
    name: string;
    description: string;
    icon: string; 
    checkCondition: (profile: CyberFitnessProfile) => boolean;
    kiloVibesAward?: number; 
    isQuest?: boolean; 
    isRepeatable?: boolean; 
    unlocksPerks?: string[]; 
}

// --- LEVEL DEFINITIONS ---
const LEVEL_THRESHOLDS_KV = [0, 50, 150, 400, 800, 1500, 2800, 5000, 8000, 12000, 17000, 23000, 30000, 40000, 50000]; 
const COGNITIVE_OS_VERSIONS = [
    "v0.1 Genesis", "v0.2 Neural Spark", "v0.3 Code Apprentice", "v0.4 Vibe Engineer", 
    "v0.5 Logic Architect", "v0.6 Context Weaver", "v0.7 Matrix Surfer", "v0.8 Quantum Coder", 
    "v0.9 Singularity Pilot", "v1.0 Ascended Node", "v1.1 Vibe Master", "v1.2 Digital Demiurge",
    "v1.3 Context Commander", "v1.4 Vibe Channeler", "vX.X Transcendent UI", 
];
const PERKS_BY_LEVEL: Record<number, string[]> = {
    1: ["Авто-PR для Замены Изображений", "Базовый Захват Файлов", "Понимание Контекста Одного Файла"],
    2: ["Обработка Простых Идей (1 файл)", "Многофайловый Контекст (до 5 файлов)", "Парсинг Ответа AI"],
    3: ["Создание PR (Новая Ветка)", "Обновление Существующей Ветки", "Анализ Логов Ошибок (ErrorFix Flow)"],
    4: ["Проактивная Проверка Логов Vercel", "Самостоятельный Поиск Иконок FontAwesome", "Быстрые Ссылки АссистенTA"],
    5: ["Инструменты для Изображений (prompts_imgs.txt)", "Продвинутый Дебаггинг с AI", "Авто-фикс простых ошибок кода"],
    6: ["Работа с Данными (SQL в Supabase UI)", "Добавление Полного Дерева Файлов в Контекст"],
    7: ["Продвинутый Рефакторинг с AI", "Кастомные Инструкции для AI (Базовый)"],
    8: ["Гайд по Развертыванию Собственного CyberVibe", "Управление Токенами Ботов (Заглушка)"],
    9: ["Документация по Созданию Собственных XTR Автоматизаций"],
    10: ["Полная Кастомизация Системного Промпта AI", "Бета-Доступ к Новым Фичам Платформы"],
    11: ["Интеграция с Внешними API (Продвинутый)", "Автоматический Code Review (Заглушка)"],
    12: ["Менторство Новых Агентов (Программа Скоро)", "Влияние на Roadmap Платформы"],
    13: ["Режим 'Потока' - Улучшенная Концентрация (Пассивный Перк)", "Генерация Сложных Архитектур с AI"],
    14: ["Мастер Эффективности - Оптимизация Затрат Токенов (Пассивный)", "Создание ИИ-Агентов для Задач (Заглушка)"]
};
// --- END LEVEL DEFINITIONS ---

export const ALL_ACHIEVEMENTS: Achievement[] = [
    // --- General Activity & Usage Milestones ---
    { id: "first_blood", name: "Первая Кровь", description: "Первая залогированная активность в CyberFitness. Добро пожаловать, Агент!", icon: "FaVial", kiloVibesAward: 10, checkCondition: (p) => (p.dailyActivityLog?.length ?? 0) > 0 || p.totalFilesExtracted > 0 || p.totalTokensProcessed > 0 || p.totalKworkRequestsSent > 0 },
    { id: "data_miner_1", name: "Добытчик Данных I", description: "Извлечено 100 файлов.", icon: "FaDatabase", kiloVibesAward: 20, checkCondition: (p) => p.totalFilesExtracted >= 100 },
    { id: "data_miner_2", name: "Добытчик Данных II", description: "Извлечено 500 файлов.", icon: "FaDatabase", kiloVibesAward: 50, checkCondition: (p) => p.totalFilesExtracted >= 500 },
    { id: "token_economist_1", name: "Экономист Токенов I", description: "Обработано 100,000 токенов AI.", icon: "FaCoins", kiloVibesAward: 30, checkCondition: (p) => p.totalTokensProcessed >= 100000 },
    { id: "token_economist_2", name: "Экономист Токенов II", description: "Обработано 1,000,000 токенов AI.", icon: "FaCoins", kiloVibesAward: 100, checkCondition: (p) => p.totalTokensProcessed >= 1000000 },
    { id: "request_maestro_1", name: "Маэстро Запросов I", description: "Отправлено 25 запросов к AI.", icon: "FaPaperPlane", kiloVibesAward: 30, checkCondition: (p) => p.totalKworkRequestsSent >= 25 },
    { id: "request_maestro_2", name: "Маэстро Запросов II", description: "Отправлено 100 запросов к AI.", icon: "FaPaperPlane", kiloVibesAward: 100, checkCondition: (p) => p.totalKworkRequestsSent >= 100 },
    { id: "commit_crafter_1", name: "Ремесленник Коммитов I", description: "Создано/обновлено 10 веток/PR.", icon: "FaCodeCommit", kiloVibesAward: 50, checkCondition: (p) => (p.totalPrsCreated + p.totalBranchesUpdated) >= 10 },
    { id: "commit_crafter_2", name: "Ремесленник Коммитов II", description: "Создано/обновлено 50 веток/PR.", icon: "FaCodeCommit", kiloVibesAward: 150, checkCondition: (p) => (p.totalPrsCreated + p.totalBranchesUpdated) >= 50 },
    
    // --- Feature Usage Achievements (Single Unlock) ---
    { id: "architect", name: "Архитектор Контекста", description: "Использована функция 'Добавить все файлы + дерево'.", icon: "FaTree", kiloVibesAward: 30, checkCondition: (p) => p.featuresUsed?.usedAddFullTree === true },
    { id: "sharpshooter", name: "Меткий Стрелок", description: "Использована функция 'Выбрать Связанные Файлы'.", icon: "FaCrosshairs", kiloVibesAward: 30, checkCondition: (p) => p.featuresUsed?.usedSelectHighlighted === true },
    { id: "kwork_context_pro_10", name: "Профи Контекста (10+)", description: "Добавлено 10+ файлов в KWork за один раз.", icon: "FaPlus", kiloVibesAward: 50, checkCondition: (p) => p.featuresUsed?.added10PlusFilesToKworkOnce === true },
    { id: "kwork_context_pro_20", name: "Гуру Контекста (20+)", description: "Добавлено 20+ файлов в KWork за один раз.", icon: "FaPlus", kiloVibesAward: 100, checkCondition: (p) => p.featuresUsed?.added20PlusFilesToKworkOnce === true },
    { id: "sticky_chat_opened", name: "Первый Контакт с XUINITY", description: "Первое открытие StickyChat для быстрой помощи.", icon: "FaCommentDots", kiloVibesAward: 10, checkCondition: (p) => p.featuresUsed?.sticky_chat_opened === true },
    { id: "settings_opened", name: "Калибровка Систем", description: "Первое открытие настроек Экстрактора/Ассистента.", icon: "FaGears", kiloVibesAward: 10, checkCondition: (p) => p.featuresUsed?.settings_opened === true },
    { id: "kwork_cleared", name: "Чистый Лист", description: "Использована функция 'Очистить все' в поле запроса KWork.", icon: "FaBroom", kiloVibesAward: 5, checkCondition: (p) => p.featuresUsed?.kwork_cleared === true },
    { id: "system_prompt_copied", name: "Шепот Мастера", description: "Системный промпт скопирован для передачи AI.", icon: "FaScroll", kiloVibesAward: 15, checkCondition: (p) => p.featuresUsed?.system_prompt_copied === true },
    { id: "image_modal_opened", name: "Визуальный Коннект", description: "Открыто модальное окно для работы с изображениями в AI Assistant.", icon: "FaImages", kiloVibesAward: 15, checkCondition: (p) => p.featuresUsed?.image_modal_opened === true },
    { id: "copy_logs_used", name: "Диагност", description: "Логи скопированы для анализа.", icon: "FaClipboardList", kiloVibesAward: 5, checkCondition: (p) => p.featuresUsed?.copy_logs_used === true },
    { 
      id: "two_finger_fu", 
      name: "Кунг-фу Двух Пальцев", 
      description: "Продемонстрировал мастерство молниеносного мобильного ввода и навигации.", 
      icon: "FaMobileScreenButton", 
      kiloVibesAward: 75, 
      checkCondition: (p) => p.featuresUsed?.usedMobileFast === true 
    },
    { id: "autofix_used", name: "Кибер-Хирург", description: "Первое использование авто-исправления ошибок в коде.", icon: "FaUserMd", kiloVibesAward: 20, checkCondition: (p) => p.featuresUsed?.autofix_used === true },
    { id: "deep_work_logged", name: "Погружение в Матрицу", description: "Залогировано первое время глубокой работы.", icon: "FaBrain", kiloVibesAward: 20, checkCondition: (p) => (p.focusTimeHours || 0) > 0},


    // --- Quest Completion Achievements (Awarded directly, checkCondition is false) ---
    { id: "initial_boot_sequence", name: "Квест: Пойман Сигнал!", description: "Успешно инициирован рабочий флоу. +25 KiloVibes", icon: "FaBolt", checkCondition: () => false, isQuest: true, unlocksPerks: ["Доступ к СуперВайб Студии"] },
    { id: "first_fetch_completed", name: "Квест: Первая Загрузка", description: "Успешно загружены файлы. +75 KiloVibes", icon: "FaDownload", checkCondition: () => false, isQuest: true, unlocksPerks: PERKS_BY_LEVEL[1] },
    { id: "first_parse_completed", name: "Квест: Первый Парсинг", description: "Успешно разобран ответ от AI. +150 KiloVibes", icon: "FaCode", checkCondition: () => false, isQuest: true, unlocksPerks: PERKS_BY_LEVEL[2] },
    { id: "first_pr_created", name: "Квест: Первый PR", description: "Успешно создан Pull Request. +250 KiloVibes", icon: "FaGithub", checkCondition: () => false, isQuest: true, unlocksPerks: PERKS_BY_LEVEL[3] },
];

const getDefaultCyberFitnessProfile = (): CyberFitnessProfile => ({
    level: 0, kiloVibes: 0, focusTimeHours: 0, skillsLeveled: 0,
    activeQuests: ["initial_boot_sequence"], 
    completedQuests: [], unlockedPerks: [],
    cognitiveOSVersion: COGNITIVE_OS_VERSIONS[0], lastActivityTimestamp: new Date(0).toISOString(), 
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
        skillsLeveled: Array.isArray(existingProfile.unlockedPerks) ? existingProfile.unlockedPerks.length : (typeof existingProfile.skillsLeveled === 'number' ? existingProfile.skillsLeveled : defaultProfile.skillsLeveled),
        totalFilesExtracted: typeof existingProfile.totalFilesExtracted === 'number' ? existingProfile.totalFilesExtracted : defaultProfile.totalFilesExtracted,
        totalTokensProcessed: typeof existingProfile.totalTokensProcessed === 'number' ? existingProfile.totalTokensProcessed : defaultProfile.totalTokensProcessed,
        totalKworkRequestsSent: typeof existingProfile.totalKworkRequestsSent === 'number' ? existingProfile.totalKworkRequestsSent : defaultProfile.totalKworkRequestsSent,
        totalPrsCreated: typeof existingProfile.totalPrsCreated === 'number' ? existingProfile.totalPrsCreated : defaultProfile.totalPrsCreated,
        totalBranchesUpdated: typeof existingProfile.totalBranchesUpdated === 'number' ? existingProfile.totalBranchesUpdated : defaultProfile.totalBranchesUpdated,
        cognitiveOSVersion: typeof existingProfile.cognitiveOSVersion === 'string' && existingProfile.cognitiveOSVersion ? existingProfile.cognitiveOSVersion : (COGNITIVE_OS_VERSIONS[existingProfile.level || 0] || defaultProfile.cognitiveOSVersion),
        lastActivityTimestamp: typeof existingProfile.lastActivityTimestamp === 'string' ? existingProfile.lastActivityTimestamp : defaultProfile.lastActivityTimestamp,
    };
  }
  
  const currentLevel = finalProfile.level || 0;
  finalProfile.cognitiveOSVersion = COGNITIVE_OS_VERSIONS[currentLevel] || COGNITIVE_OS_VERSIONS[COGNITIVE_OS_VERSIONS.length -1] || defaultProfile.cognitiveOSVersion;
  finalProfile.skillsLeveled = finalProfile.unlockedPerks.length;

  return finalProfile;
};

export const fetchUserCyberFitnessProfile = async (userId: string): Promise<{ success: boolean; data?: CyberFitnessProfile; error?: string }> => {
  logger.log(`[CyberFitness FetchProfile ENTRY] Attempting to fetch profile for user: ${userId}`);
  if (!userId) {
    logger.warn("[CyberFitness FetchProfile] User ID is missing. Cannot fetch profile.");
    return { success: false, error: "User ID is required.", data: getDefaultCyberFitnessProfile() };
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
        logger.log(`[CyberFitness FetchProfile EXIT] Successfully parsed CyberFitness profile for user ${userId}. Level: ${profile.level}, KiloVibes: ${profile.kiloVibes}`);
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
  logger.log(`[CyberFitness UpdateProfile ENTRY] User: ${userId}, Updates Summary:`, {
      keys: Object.keys(updates),
      kiloVibesDelta: updates.kiloVibes,
      levelUpdate: updates.level,
      totalFilesExtractedDelta: updates.totalFilesExtracted,
      totalTokensProcessedDelta: updates.totalTokensProcessed,
      totalKworkRequestsSentDelta: updates.totalKworkRequestsSent,
      totalPrsCreatedDelta: updates.totalPrsCreated,
      totalBranchesUpdatedDelta: updates.totalBranchesUpdated,
      featuresUsedUpdates: updates.featuresUsed ? Object.keys(updates.featuresUsed) : [],
      completedQuests: updates.completedQuests,
      unlockedPerks: updates.unlockedPerks
  });

  if (!userId) {
    logger.warn("[CyberFitness UpdateProfile] User ID is missing. Cannot update profile.");
    return { success: false, error: "User ID is required." };
  }

  const isTrueMockSession = process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true' && MOCK_USER_ID_NUM !== null && userId === MOCK_USER_ID_NUM.toString();

  try {
    const userData = await genericFetchUserData(userId); 
    if (!userData && !isTrueMockSession) { 
        logger.error(`[CyberFitness UpdateProfile] User ${userId} not found via genericFetchUserData. Cannot update profile.`);
        return { success: false, error: `User ${userId} not found.` };
    }
   
    const existingOverallMetadata = userData?.metadata || {};
    let existingCyberFitnessProfile = getCyberFitnessProfile(userId, existingOverallMetadata);
    logger.debug(`[CyberFitness UpdateProfile] Profile for ${userId} BEFORE this update cycle: Level=${existingCyberFitnessProfile.level}, KV=${existingCyberFitnessProfile.kiloVibes}, Ach=${existingCyberFitnessProfile.achievements.length}, Perks=${existingCyberFitnessProfile.unlockedPerks.length}`);

    const newCyberFitnessProfile: CyberFitnessProfile = {
      ...existingCyberFitnessProfile, 
      lastActivityTimestamp: new Date().toISOString(), 
    };

    // Apply direct updates from 'updates' object
    if (updates.kiloVibes !== undefined && typeof updates.kiloVibes === 'number') {
        newCyberFitnessProfile.kiloVibes += updates.kiloVibes; 
    }
    if (updates.focusTimeHours !== undefined && typeof updates.focusTimeHours === 'number') {
        newCyberFitnessProfile.focusTimeHours += updates.focusTimeHours; 
    }
    if (updates.activeQuests && Array.isArray(updates.activeQuests)) {
        newCyberFitnessProfile.activeQuests = Array.from(new Set([...newCyberFitnessProfile.activeQuests, ...updates.activeQuests]));
    }
    if (updates.completedQuests && Array.isArray(updates.completedQuests)) {
        newCyberFitnessProfile.completedQuests = Array.from(new Set([...newCyberFitnessProfile.completedQuests, ...updates.completedQuests]));
        newCyberFitnessProfile.activeQuests = newCyberFitnessProfile.activeQuests.filter(q => !updates.completedQuests!.includes(q));
    }
    if (updates.unlockedPerks && Array.isArray(updates.unlockedPerks)) {
        newCyberFitnessProfile.unlockedPerks = Array.from(new Set([...newCyberFitnessProfile.unlockedPerks, ...updates.unlockedPerks]));
    }
    
    if (updates.dailyActivityLog && Array.isArray(updates.dailyActivityLog)) newCyberFitnessProfile.dailyActivityLog = updates.dailyActivityLog; 
    if (updates.featuresUsed && typeof updates.featuresUsed === 'object') {
        newCyberFitnessProfile.featuresUsed = {...newCyberFitnessProfile.featuresUsed, ...updates.featuresUsed};
    }
    
    // These are deltas from logCyberFitnessAction
    if (typeof updates.totalFilesExtracted === 'number') newCyberFitnessProfile.totalFilesExtracted += updates.totalFilesExtracted;
    if (typeof updates.totalTokensProcessed === 'number') newCyberFitnessProfile.totalTokensProcessed += updates.totalTokensProcessed;
    if (typeof updates.totalKworkRequestsSent === 'number') newCyberFitnessProfile.totalKworkRequestsSent += updates.totalKworkRequestsSent;
    if (typeof updates.totalPrsCreated === 'number') newCyberFitnessProfile.totalPrsCreated += updates.totalPrsCreated;
    if (typeof updates.totalBranchesUpdated === 'number') newCyberFitnessProfile.totalBranchesUpdated += updates.totalBranchesUpdated;
    
    // --- Leveling Logic ---
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
        logger.info(`[CyberFitness UpdateProfile] Explicit level update to ${newLevelCandidate} (was ${previousLevel} based on KV).`);
    }
    
    let newlyUnlockedAchievements: Achievement[] = [];
    let currentAchievementsSet = new Set(newCyberFitnessProfile.achievements || []);

    if (newLevelCandidate > previousLevel) {
        logger.info(`[CyberFitness UpdateProfile] LEVEL UP! User ${userId} from ${previousLevel} to ${newLevelCandidate}.`);
        newCyberFitnessProfile.level = newLevelCandidate;
        newCyberFitnessProfile.cognitiveOSVersion = COGNITIVE_OS_VERSIONS[newLevelCandidate] || `v${newLevelCandidate}.0 Custom Elite`;
        
        const kvAwardForLevel = (newLevelCandidate - previousLevel) * 50; 
        if (kvAwardForLevel > 0) {
            newCyberFitnessProfile.kiloVibes += kvAwardForLevel;
            logger.info(`[CyberFitness UpdateProfile] Awarded ${kvAwardForLevel} KiloVibes for reaching level ${newLevelCandidate}. New total: ${newCyberFitnessProfile.kiloVibes}`);
        }

        let perksActuallyAddedThisUpdateSet = new Set<string>();
        for (let lvl = previousLevel + 1; lvl <= newLevelCandidate; lvl++) {
            if (PERKS_BY_LEVEL[lvl]) {
                const perksForThisLevel = PERKS_BY_LEVEL[lvl];
                const existingPerksSet = new Set(newCyberFitnessProfile.unlockedPerks || []);
                perksForThisLevel.forEach(perk => {
                    if (!existingPerksSet.has(perk)) {
                        newCyberFitnessProfile.unlockedPerks.push(perk);
                        existingPerksSet.add(perk); 
                        perksActuallyAddedThisUpdateSet.add(perk);
                    }
                });
            }
            // Dynamic Level Up Achievement
            const levelUpAchievementId = `level_up_${lvl}`;
            if (!currentAchievementsSet.has(levelUpAchievementId)) {
                 const levelUpAch: Achievement = {
                     id: levelUpAchievementId, name: `Достигнут Уровень ${lvl}!`,
                     description: `Вы достигли ${lvl}-го уровня КиберФитнеса! Новые перки и возможности открыты.`,
                     icon: 'FaStar', checkCondition: () => true, kiloVibesAward: 25 * lvl 
                 };
                 currentAchievementsSet.add(levelUpAch.id);
                 newlyUnlockedAchievements.push(levelUpAch);
                 if (levelUpAch.kiloVibesAward) newCyberFitnessProfile.kiloVibes += levelUpAch.kiloVibesAward;
                 logger.info(`[CyberFitness UpdateProfile] Unlocked dynamic achievement: '${levelUpAch.name}' (Lvl ${lvl})`);
            }
        }
        if(perksActuallyAddedThisUpdateSet.size > 0){
            logger.info(`[CyberFitness UpdateProfile] Total new perks unlocked from leveling: ${Array.from(perksActuallyAddedThisUpdateSet).join(', ')}`);
        }
    }
    // Merge perks from direct updates if any, ensuring uniqueness
    if (updates.unlockedPerks && Array.isArray(updates.unlockedPerks)) {
        const existingPerksSet = new Set(newCyberFitnessProfile.unlockedPerks || []);
        updates.unlockedPerks.forEach(perk => {
            if (!existingPerksSet.has(perk)) {
                newCyberFitnessProfile.unlockedPerks.push(perk);
                existingPerksSet.add(perk);
                logger.info(`[CyberFitness UpdateProfile] Unlocked specific perk from 'updates' object: "${perk}".`);
            }
        });
    }
    newCyberFitnessProfile.skillsLeveled = newCyberFitnessProfile.unlockedPerks.length;
    
    // If OS version was explicitly passed in updates, it overrides the level-based one
    if (updates.cognitiveOSVersion && typeof updates.cognitiveOSVersion === 'string' && updates.cognitiveOSVersion !== newCyberFitnessProfile.cognitiveOSVersion) {
        newCyberFitnessProfile.cognitiveOSVersion = updates.cognitiveOSVersion;
        logger.info(`[CyberFitness UpdateProfile] CognitiveOSVersion explicitly set to: ${updates.cognitiveOSVersion}`);
    }
    // --- End Leveling Logic ---


    // --- Achievement Check (after KiloVibes and totals are updated, including from leveling) ---
    for (const ach of ALL_ACHIEVEMENTS) {
        if (!ach.isQuest && !currentAchievementsSet.has(ach.id) && ach.checkCondition(newCyberFitnessProfile)) { 
            currentAchievementsSet.add(ach.id); 
            newlyUnlockedAchievements.push(ach);
            if (ach.kiloVibesAward && typeof ach.kiloVibesAward === 'number') { 
                newCyberFitnessProfile.kiloVibes += ach.kiloVibesAward;
                logger.debug(`[CyberFitness UpdateProfile] Awarded ${ach.kiloVibesAward} KV for std achievement '${ach.name}'. New total KV: ${newCyberFitnessProfile.kiloVibes}`);
            }
            if(ach.unlocksPerks && ach.unlocksPerks.length > 0){
                const existingPerksSet = new Set(newCyberFitnessProfile.unlockedPerks || []);
                ach.unlocksPerks.forEach(perk => {
                    if(!existingPerksSet.has(perk)){
                        newCyberFitnessProfile.unlockedPerks.push(perk);
                        existingPerksSet.add(perk);
                        logger.info(`[CyberFitness UpdateProfile] Perk "${perk}" unlocked by achievement "${ach.name}".`);
                    }
                });
                newCyberFitnessProfile.skillsLeveled = newCyberFitnessProfile.unlockedPerks.length;
            }
        }
    }
    newCyberFitnessProfile.achievements = Array.from(currentAchievementsSet);
    logger.debug(`[CyberFitness UpdateProfile] Achievements for ${userId} after ALL evaluations: ${newCyberFitnessProfile.achievements.join(', ')}. KiloVibes after ALL awards: ${newCyberFitnessProfile.kiloVibes}`);

    if (newlyUnlockedAchievements.length > 0) {
        logger.info(`[CyberFitness UpdateProfile] User ${userId} unlocked new achievements (incl. dynamic level ups):`, newlyUnlockedAchievements.map(a => `${a.name} (${a.id}, +${a.kiloVibesAward || 0}KV)`));
    }
    // --- End Achievement Check ---

    const newOverallMetadata: UserMetadata = {
      ...existingOverallMetadata, 
      [CYBERFIT_METADATA_KEY]: newCyberFitnessProfile, 
    };
        
    const { success: updateSuccess, data: updatedUser, error: updateError } = await genericUpdateUserMetadata(userId, newOverallMetadata);

    if (!updateSuccess || !updatedUser) {
      logger.error(`[CyberFitness UpdateProfile] Error saving updated profile for ${userId} using genericUpdateUserMetadata:`, updateError);
      throw new Error(updateError || `Failed to update metadata for user ${userId} via genericUpdateUserMetadata`);
    }

    logger.log(`[CyberFitness UpdateProfile EXIT] Successfully updated profile for ${userId}. New KV: ${newCyberFitnessProfile.kiloVibes}, Lvl: ${newCyberFitnessProfile.level}, OS: ${newCyberFitnessProfile.cognitiveOSVersion}`);
    return { success: true, data: updatedUser, newAchievements: newlyUnlockedAchievements };
  } catch (e: any) {
    logger.error(`[CyberFitness UpdateProfile CATCH] Exception for ${userId}:`, e);
    const errorMessage = (e instanceof Error ? e.message : String(e)) || "Failed to update CyberFitness profile.";
    return { success: false, error: errorMessage, newAchievements: [] };
  }
};

export const logCyberFitnessAction = async (
  userId: string,
  actionType: 'filesExtracted' | 'tokensProcessed' | 'kworkRequestSent' | 'prCreated' | 'branchUpdated' | 'featureUsed' | 'focusTimeAdded',
  countOrDetails: number | { featureName: string; featureValue?: string | number | boolean } | { minutes: number } 
): Promise<{ success: boolean; error?: string; newAchievements?: Achievement[] }> => {
  logger.log(`[CyberFitness LogAction ENTRY] User: ${userId}, Action: ${actionType}, Value/Details:`, countOrDetails);
  if (!userId) {
    logger.warn("[CyberFitness LogAction] User ID is missing. Cannot log action.");
    return { success: false, error: "User ID is required." };
  }
  
  if (typeof countOrDetails === 'number') {
      if (countOrDetails < 0 && actionType !== 'tokensProcessed') { 
         logger.warn(`[CyberFitness LogAction] Negative count (${countOrDetails}) for '${actionType}'. Correcting to 0.`);
         countOrDetails = 0; 
      }
  } else if (actionType === 'featureUsed' && (typeof countOrDetails !== 'object' || !('featureName' in countOrDetails))) {
       logger.warn(`[CyberFitness LogAction] Invalid countOrDetails for 'featureUsed'. Expected {featureName: string, featureValue?: any}. Received:`, countOrDetails);
       return { success: false, error: `Invalid data for action ${actionType}.` };
  } else if (actionType === 'focusTimeAdded' && (typeof countOrDetails !== 'object' || !('minutes' in countOrDetails) || typeof countOrDetails.minutes !== 'number')) {
      logger.warn(`[CyberFitness LogAction] Invalid countOrDetails for 'focusTimeAdded'. Expected {minutes: number}. Received:`, countOrDetails);
      return { success: false, error: `Invalid data for action ${actionType}.` };
  }

  try {
    const profileResult = await fetchUserCyberFitnessProfile(userId);
    if (!profileResult.success && !profileResult.data?.hasOwnProperty('level')) { 
      logger.error(`[CyberFitness LogAction] Failed to get profile data for ${userId} and no default profile returned. Error: ${profileResult.error}`);
      return { success: false, error: profileResult.error || "Failed to get current profile data." };
    }
    
    let currentProfile = profileResult.data || getDefaultCyberFitnessProfile(); 
    // logger.debug(`[CyberFitness LogAction] Current profile for ${userId} before logging ${actionType}: KV=${currentProfile.kiloVibes}, Lvl=${currentProfile.level}`);

    let dailyLog = currentProfile.dailyActivityLog ? [...currentProfile.dailyActivityLog] : [];
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    let todayEntry = dailyLog.find(entry => entry.date === todayStr);

    if (!todayEntry) {
      todayEntry = { date: todayStr, filesExtracted: 0, tokensProcessed: 0, kworkRequestsSent: 0, prsCreated: 0, branchesUpdated: 0, focusTimeMinutes: 0 };
      dailyLog.push(todayEntry);
    } else { // Ensure all fields are initialized for an existing day entry
       todayEntry.filesExtracted = todayEntry.filesExtracted || 0;
       todayEntry.tokensProcessed = todayEntry.tokensProcessed || 0;
       todayEntry.kworkRequestsSent = todayEntry.kworkRequestsSent || 0;
       todayEntry.prsCreated = todayEntry.prsCreated || 0;
       todayEntry.branchesUpdated = todayEntry.branchesUpdated || 0;
       todayEntry.focusTimeMinutes = todayEntry.focusTimeMinutes || 0;
    }
    
    const profileUpdates: Partial<CyberFitnessProfile> = {
        featuresUsed: { ...(currentProfile.featuresUsed || {}) } 
    };
    let kiloVibesFromAction = 0;

    if (actionType === 'filesExtracted' && typeof countOrDetails === 'number') {
        todayEntry.filesExtracted += countOrDetails;
        profileUpdates.totalFilesExtracted = countOrDetails; 
        kiloVibesFromAction += countOrDetails * 0.1; 
        if (countOrDetails >= 20 && !currentProfile.featuresUsed?.added20PlusFilesToKworkOnce) {
             profileUpdates.featuresUsed!.added20PlusFilesToKworkOnce = true; 
        } else if (countOrDetails >= 10 && !currentProfile.featuresUsed?.added10PlusFilesToKworkOnce) {
            profileUpdates.featuresUsed!.added10PlusFilesToKworkOnce = true;
        }
    } else if (actionType === 'tokensProcessed' && typeof countOrDetails === 'number') {
        todayEntry.tokensProcessed += countOrDetails;
        profileUpdates.totalTokensProcessed = countOrDetails; 
        kiloVibesFromAction += countOrDetails * 0.001; 
    } else if (actionType === 'kworkRequestSent' && typeof countOrDetails === 'number') {
        todayEntry.kworkRequestsSent += countOrDetails; 
        profileUpdates.totalKworkRequestsSent = countOrDetails; 
        kiloVibesFromAction += countOrDetails * 5; 
    } else if (actionType === 'prCreated' && typeof countOrDetails === 'number') {
        todayEntry.prsCreated += countOrDetails;
        profileUpdates.totalPrsCreated = countOrDetails; 
        kiloVibesFromAction += countOrDetails * 50; 
    } else if (actionType === 'branchUpdated' && typeof countOrDetails === 'number') {
        todayEntry.branchesUpdated += countOrDetails;
        profileUpdates.totalBranchesUpdated = countOrDetails; 
        kiloVibesFromAction += countOrDetails * 20; 
    } else if (actionType === 'featureUsed' && typeof countOrDetails === 'object' && 'featureName' in countOrDetails) {
        const featureName = countOrDetails.featureName;
        const featureValue = countOrDetails.featureValue !== undefined ? countOrDetails.featureValue : true;
        if (typeof featureName === 'string' && profileUpdates.featuresUsed![featureName] !== featureValue) { 
             profileUpdates.featuresUsed![featureName] = featureValue;
             if (featureValue === true && !existingCyberFitnessProfile.featuresUsed?.[featureName]) {
                 kiloVibesFromAction += 5; 
             }
             logger.debug(`[CyberFitness LogAction] Feature '${featureName}' usage updated to ${featureValue} for user ${userId}.`);
        } else if (typeof featureName === 'string') {
            // logger.debug(`[CyberFitness LogAction] Feature '${featureName}' was already set to ${featureValue} for user ${userId}. No change to featuresUsed.`);
        } else {
            logger.warn(`[CyberFitness LogAction] Invalid featureName in countOrDetails for 'featureUsed':`, countOrDetails);
        }
    } else if (actionType === 'focusTimeAdded' && typeof countOrDetails === 'object' && 'minutes' in countOrDetails) {
        const minutes = countOrDetails.minutes;
        if (typeof minutes === 'number' && minutes > 0) {
            profileUpdates.focusTimeHours = minutes / 60; 
            todayEntry.focusTimeMinutes = (todayEntry.focusTimeMinutes || 0) + minutes;
            kiloVibesFromAction += minutes * 0.5; 
            logger.debug(`[CyberFitness LogAction] Logged ${minutes} minutes of focus time for user ${userId}.`);
        } else {
            logger.warn(`[CyberFitness LogAction] Invalid minutes for 'focusTimeAdded':`, minutes);
        }
    }

    if (kiloVibesFromAction > 0) {
        profileUpdates.kiloVibes = kiloVibesFromAction;
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

    const finalKiloVibes = updateResult.data?.metadata?.[CYBERFIT_METADATA_KEY]?.kiloVibes; 
    logger.log(`[CyberFitness LogAction EXIT] Action '${actionType}' logged for ${userId}. Final KV: ${finalKiloVibes ?? 'N/A'}. New ach: ${updateResult.newAchievements?.length || 0}`);
    return { success: true, newAchievements: updateResult.newAchievements };

  } catch (e: any) {
    logger.error(`[CyberFitness LogAction CATCH] Exception for ${userId} logging ${actionType}:`, e);
    return { success: false, error: e.message || "Failed to log CyberFitness action." };
  }
};

export const checkAndUnlockFeatureAchievement = async (
    userId: string,
    featureName: keyof Exclude<CyberFitnessProfile['featuresUsed'], undefined> | string,
    featureValue?: string | number | boolean 
): Promise<{ success: boolean; newAchievements?: Achievement[], error?: string }> => {
    logger.log(`[CyberFitness CheckFeatureAchievement ENTRY] User: ${userId}, Feature: ${featureName}, Value: ${featureValue}`);
    if (!userId || !featureName) {
        logger.warn("[CyberFitness CheckFeatureAchievement] User ID and feature name required. Aborting.");
        return { success: false, error: "User ID and feature name required."};
    }
    const details: { featureName: string; featureValue?: string | number | boolean } = { featureName: String(featureName) };
    if (featureValue !== undefined) {
        details.featureValue = featureValue;
    }
    const result = await logCyberFitnessAction(userId, 'featureUsed', details); 
    if(result.success){
        logger.log(`[CyberFitness CheckFeatureAchievement EXIT] Logged feature '${featureName}'. New ach: ${result.newAchievements?.length || 0}`);
    } else {
        logger.warn(`[CyberFitness CheckFeatureAchievement EXIT] Failed to log feature '${featureName}'. Error: ${result.error}`);
    }
    return result;
};

export const completeQuestAndUpdateProfile = async (
  userId: string,
  questId: string,
  kiloVibesAwarded: number,
  newLevel?: number, 
  newPerksFromQuest?: string[] // Renamed for clarity
): Promise<{ success: boolean; data?: DbUser; error?: string; newAchievements?: Achievement[] }> => {
  logger.log(`[CyberFitness QuestComplete ENTRY] User: ${userId}, Quest: ${questId}, KV: ${kiloVibesAwarded}, TargetLvl?: ${newLevel}, QuestPerks?:`, newPerksFromQuest);
   if (!userId) {
    logger.warn("[CyberFitness QuestComplete] User ID is missing. Cannot complete quest.");
    return { success: false, error: "User ID is required." };
  }

  const isTrueMockSession = process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true' && MOCK_USER_ID_NUM !== null && userId === MOCK_USER_ID_NUM.toString();

  const currentProfileResult = await fetchUserCyberFitnessProfile(userId);
  if (!currentProfileResult.success && !currentProfileResult.data?.hasOwnProperty('level')) {
    logger.error(`[CyberFitness QuestComplete] Failed to fetch profile for ${userId}. Error: ${currentProfileResult.error}`);
    return { success: false, error: currentProfileResult.error || "Failed to fetch current profile before quest completion." };
  }
  const currentProfile = currentProfileResult.data || getDefaultCyberFitnessProfile();
  // logger.debug(`[CyberFitness QuestComplete] Current profile for ${userId}: QuestsDone=${currentProfile.completedQuests.join(',')}, KV=${currentProfile.kiloVibes}`);

  const questDefinition = ALL_ACHIEVEMENTS.find(ach => ach.id === questId && ach.isQuest);
  if (!questDefinition) {
      logger.warn(`[CyberFitness QuestComplete] Quest ID "${questId}" not found or not marked as a quest in ALL_ACHIEVEMENTS.`);
  }

  const effectivePerksToAward = newPerksFromQuest || questDefinition?.unlocksPerks || [];

  if (!isTrueMockSession && currentProfile.completedQuests?.includes(questId)) {
    logger.info(`[CyberFitness QuestComplete] Quest ${questId} already completed by user ${userId}. Checking for new perks from this call only.`);
    let shouldUpdateForPerksOnly = false;
    const updatesForPerks: Partial<CyberFitnessProfile> = {};
    
    if (effectivePerksToAward.length > 0) {
        const existingPerksSet = new Set(currentProfile.unlockedPerks || []);
        const uniqueNewPerksFromThisCall = effectivePerksToAward.filter(p => !existingPerksSet.has(p));
        if (uniqueNewPerksFromThisCall.length > 0) {
            updatesForPerks.unlockedPerks = uniqueNewPerksFromThisCall; 
            shouldUpdateForPerksOnly = true;
            logger.log(`[CyberFitness QuestComplete] User ${userId} unlocking new perks for already completed quest ${questId}:`, uniqueNewPerksFromThisCall);
        }
    }
    if (shouldUpdateForPerksOnly) {
        // If quest already complete but new perks are being awarded (e.g. retroactive), still give KV if any.
        if (kiloVibesAwarded > 0) updatesForPerks.kiloVibes = kiloVibesAwarded; 
        if (newLevel !== undefined) updatesForPerks.level = newLevel; // Allow level override if specified
        return updateUserCyberFitnessProfile(userId, updatesForPerks); 
    }
    logger.log(`[CyberFitness QuestComplete] Quest ${questId} already done and no new perks from this call for user ${userId}. No update needed.`);
    return { success: true, data: undefined, newAchievements: [] }; 
  }

  const updates: Partial<CyberFitnessProfile> = {
    kiloVibes: kiloVibesAwarded > 0 ? kiloVibesAwarded : 0, 
    completedQuests: [questId], 
    activeQuests: currentProfile.activeQuests.filter(aq => aq !== questId), // Remove from active
  };
  logger.debug(`[CyberFitness QuestComplete] Initial updates for quest ${questId}: KiloVibes delta = ${updates.kiloVibes}`);

  if (newLevel !== undefined) updates.level = newLevel; 
  if (effectivePerksToAward.length > 0) updates.unlockedPerks = effectivePerksToAward; 
  
  const result = await updateUserCyberFitnessProfile(userId, updates);
  const finalKiloVibes = result.data?.metadata?.[CYBERFIT_METADATA_KEY]?.kiloVibes;
  logger.log(`[CyberFitness QuestComplete EXIT] Update result for quest ${questId}: Success: ${result.success}. Final KV: ${finalKiloVibes ?? 'N/A'}. New ach: ${result.newAchievements?.length || 0}`);
  return result;
};

export const setCognitiveOSVersion = async (userId: string, version: string): Promise<{ success: boolean; data?: DbUser; error?: string; newAchievements?: Achievement[] }> => {
  logger.log(`[CyberFitness OSVersion] Setting Cognitive OS version for ${userId} to: ${version}`);
  if (!userId || typeof version !== 'string') {
      logger.warn("[CyberFitness OSVersion] User ID or version string is invalid. Aborting.");
      return { success: false, error: "User ID and valid version string required." };
  }
  return updateUserCyberFitnessProfile(userId, { cognitiveOSVersion: version });
};

export const getUserCyberLevel = async (userId: string): Promise<{ success: boolean; level?: number; error?: string }> => {
  logger.log(`[CyberFitness GetLevel ENTRY] Getting level for user: ${userId}`);
   if (!userId) {
    logger.warn("[CyberFitness GetLevel] User ID is missing. Cannot get level.");
    return { success: false, level: 0, error: "User ID is required." };
  }
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
    let achievement = ALL_ACHIEVEMENTS.find(ach => ach.id === achievementId);
    if (achievement) return achievement;

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
                    kiloVibesAward: 0 
                };
            }
        }
    }
    logger.warn(`[CyberFitness getAchievementDetails] Achievement with ID "${achievementId}" not found in ALL_ACHIEVEMENTS or dynamic patterns.`);
    return undefined;
};

export const TOKEN_ESTIMATION_FACTOR = 4; // Characters per token (rough estimate)