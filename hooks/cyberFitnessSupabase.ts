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
  // Could add more specific daily counts here if needed, e.g., 'aiResponsesParsedToday'
}

export interface CyberFitnessProfile {
  level: number; 
  kiloVibes: number; 
  focusTimeHours: number; 
  skillsLeveled: number; // Represents count of unlockedPerks
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
    icon: string; // Should be a valid Fa6Icon key string e.g. "FaStar"
    checkCondition: (profile: CyberFitnessProfile) => boolean;
    kiloVibesAward?: number; 
    isQuest?: boolean; 
    isRepeatable?: boolean; // For achievements like "Excellent!" (can be earned multiple times)
    unlocksPerks?: string[]; // Perks unlocked by this specific achievement
}

// --- LEVEL DEFINITIONS ---
const LEVEL_THRESHOLDS_KV = [0, 100, 300, 750, 1500, 3000, 6000, 10000, 17500, 30000, 50000, 75000, 100000, 150000, 250000]; // For Levels 0-14
const COGNITIVE_OS_VERSIONS = [
    "v0.1 Genesis",         // Level 0
    "v0.2 Neural Spark",    // Level 1 (Image Swap Flow)
    "v0.3 Code Apprentice", // Level 2 (Generic Idea, Single File)
    "v0.4 Vibe Engineer",   // Level 3 (Generic Idea, Multi-File, PR Creation)
    "v0.5 Logic Architect", // Level 4 (Error Fix Flow, Basic Debugging)
    "v0.6 Context Weaver",  // Level 5 (Icon Hunt, Proactive Log Check)
    "v0.7 Matrix Surfer",   // Level 6 (Multimedia Input, Image Tools)
    "v0.8 Quantum Coder",   // Level 7 (SQL/DB Interaction)
    "v0.9 Singularity Pilot",// Level 8 (Initial steps towards independence)
    "v1.0 Ascended Node",   // Level 9
    "v1.1 Vibe Master",     // Level 10
    "v1.2 Digital Demiurge",// Level 11 (Code Scanner - conceptual)
    "v1.3 Context Commander",// Level 12 (Context Juggling - conceptual)
    "v1.4 Vibe Channeler",  // Level 13 (Flow State - conceptual)
    "vX.X Transcendent UI", // Level 14+ (Efficiency Ninja - conceptual)
];
const PERKS_BY_LEVEL: Record<number, string[]> = {
    1: ["Авто-PR для Замены Изображений (Lv.1 Flow)", "Базовый Захват Файлов", "Понимание Контекста Одного Файла"],
    2: ["Обработка Простых Идей (Lv.2 Flow)", "Многофайловый Контекст (до 5 файлов)", "Парсинг Ответа AI"],
    3: ["Создание Pull Request", "Обновление Существующей Ветки", "Анализ Логов Ошибок (Lv.3 Flow)", "Базовый Автофикс Кода"],
    4: ["Проактивная Проверка Логов Vercel", "Самостоятельный Поиск Иконок (FontAwesome)", "Быстрые Ссылки Ассистента"],
    5: ["Мультимодальный Ввод (Задачи через Аудио/Видео - заглушка)", "Доступ к Продвинутым Инструментам для Изображений", "Продвинутый Дебаггинг с AI"],
    6: ["Работа с Данными (SQL в Supabase UI)", "Полное Дерево Файлов в Контекст", "Продвинутый Рефакторинг с AI"],
    7: ["Кастомные Инструкции для AI (Заглушка)", "Пакетная Обработка Задач (Заглушка)"],
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
    { id: "prompt_engineer_1", name: "Инженер Промптов I", description: "Отправлено 10 запросов к AI.", icon: "FaPaperPlane", kiloVibesAward: 25, checkCondition: (p) => p.totalKworkRequestsSent >= 10 },
    { id: "prompt_engineer_2", name: "Инженер Промптов II", description: "Отправлено 50 запросов к AI.", icon: "FaPaperPlane", kiloVibesAward: 75, checkCondition: (p) => p.totalKworkRequestsSent >= 50 },
    { id: "prompt_engineer_3", name: "Инженер Промптов III", description: "Отправлено 200 запросов к AI.", icon: "FaPaperPlane", kiloVibesAward: 200, checkCondition: (p) => p.totalKworkRequestsSent >= 200 },
    { id: "branch_master_1", name: "Мастер Ветвления I", description: "Обновлено 5 веток.", icon: "FaCodeBranch", kiloVibesAward: 50, checkCondition: (p) => p.totalBranchesUpdated >= 5 },
    { id: "branch_master_2", name: "Мастер Ветвления II", description: "Обновлено 25 веток.", icon: "FaCodeBranch", kiloVibesAward: 150, checkCondition: (p) => p.totalBranchesUpdated >= 25 },
    { id: "pr_pioneer_1", name: "Пионер PR I", description: "Создано 3 PR.", icon: "FaGithub", kiloVibesAward: 75, checkCondition: (p) => p.totalPrsCreated >= 3 },
    { id: "pr_pioneer_2", name: "Пионер PR II", description: "Создано 10 PR.", icon: "FaGithub", kiloVibesAward: 250, checkCondition: (p) => p.totalPrsCreated >= 10 },
    { id: "code_explorer_1", name: "Исследователь Кода I", description: "Добавлено 100 файлов в запросы к AI.", icon: "FaSearchengin", kiloVibesAward: 40, checkCondition: (p) => p.totalFilesExtracted >= 100 },
    { id: "code_explorer_2", name: "Исследователь Кода II", description: "Добавлено 500 файлов в запросы к AI.", icon: "FaSearchengin", kiloVibesAward: 120, checkCondition: (p) => p.totalFilesExtracted >= 500 },
    { id: "ai_whisperer_1", name: "Заклинатель AI I", description: "Обработано 10,000 токенов AI.", icon: "FaRobot", kiloVibesAward: 30, checkCondition: (p) => p.totalTokensProcessed >= 10000 },
    { id: "ai_whisperer_2", name: "Заклинатель AI II", description: "Обработано 100,000 токенов AI.", icon: "FaRobot", kiloVibesAward: 100, checkCondition: (p) => p.totalTokensProcessed >= 100000 },
    { id: "ai_whisperer_3", name: "Заклинатель AI III", description: "Обработано 1,000,000 токенов AI. Ты почти Нео!", icon: "FaRobot", kiloVibesAward: 500, checkCondition: (p) => p.totalTokensProcessed >= 1000000 },
    
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
      description: "Продемонстрировал мастерство молниеносного мобильного ввода и навигации в стиле Mortal Kombat.", 
      icon: "FaMobileScreenButton", 
      kiloVibesAward: 75, 
      checkCondition: (p) => p.featuresUsed?.usedMobileFast === true 
    },
    { id: "autofix_used", name: "Кибер-Хирург", description: "Первое использование авто-исправления ошибок в коде.", icon: "FaUserMd", kiloVibesAward: 20, checkCondition: (p) => p.featuresUsed?.autofix_used === true }, // Assuming FaUserMd is a valid icon string

    // --- Quest Completion Achievements (Awarded directly, checkCondition is false) ---
    { id: "initial_boot_sequence", name: "Квест: Пойман Сигнал!", description: "Успешно инициирован рабочий флоу через StickyChat или URL. +25 KiloVibes", icon: "FaBolt", checkCondition: () => false, isQuest: true, unlocksPerks: ["Доступ к СуперВайб Студии"] },
    { id: "first_fetch_completed", name: "Квест: Первая Загрузка", description: "Успешно загружены файлы из репозитория. +75 KiloVibes, Доступен Уровень 1", icon: "FaDownload", checkCondition: () => false, isQuest: true, unlocksPerks: PERKS_BY_LEVEL[1] },
    { id: "first_parse_completed", name: "Квест: Первый Парсинг", description: "Успешно разобран ответ от AI. +150 KiloVibes, Доступен Уровень 2", icon: "FaCode", checkCondition: () => false, isQuest: true, unlocksPerks: PERKS_BY_LEVEL[2] },
    { id: "first_pr_created", name: "Квест: Первый PR", description: "Успешно создан Pull Request. +250 KiloVibes, Доступен Уровень 3", icon: "FaGithub", checkCondition: () => false, isQuest: true, unlocksPerks: PERKS_BY_LEVEL[3] },
    // Add more quests as they are defined in the system
];

const getDefaultCyberFitnessProfile = (): CyberFitnessProfile => ({
    level: 0, kiloVibes: 0, focusTimeHours: 0, skillsLeveled: 0,
    activeQuests: [], completedQuests: [], unlockedPerks: [],
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
  // Ensure cognitiveOSVersion is valid or default based on current level
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
  logger.log(`[CyberFitness UpdateProfile ENTRY] User: ${userId}, Updates:`, JSON.stringify(updates).substring(0, 500) + "..."); // Log truncated updates
  if (!userId) {
    logger.warn("[CyberFitness UpdateProfile] User ID is missing. Cannot update profile.");
    return { success: false, error: "User ID is required." };
  }

  const isTrueMockSession = process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true' && MOCK_USER_ID_NUM !== null && userId === MOCK_USER_ID_NUM.toString();
  logger.debug(`[CyberFitness UpdateProfile] isTrueMockSession: ${isTrueMockSession}`);

  try {
    const userData = await genericFetchUserData(userId); 
    if (!userData && !isTrueMockSession) { 
        logger.error(`[CyberFitness UpdateProfile] User ${userId} not found via genericFetchUserData. Cannot update profile.`);
        return { success: false, error: `User ${userId} not found.` };
    }
   
    const existingOverallMetadata = userData?.metadata || {};
    let existingCyberFitnessProfile = getCyberFitnessProfile(userId, existingOverallMetadata);
    logger.debug(`[CyberFitness UpdateProfile] Fetched existing profile for ${userId}. Achievements before: ${existingCyberFitnessProfile.achievements.length}, KiloVibes before: ${existingCyberFitnessProfile.kiloVibes}, Level before: ${existingCyberFitnessProfile.level}`);

    const newCyberFitnessProfile: CyberFitnessProfile = {
      ...existingCyberFitnessProfile, 
      lastActivityTimestamp: new Date().toISOString(), 
    };

    if (updates.kiloVibes !== undefined && typeof updates.kiloVibes === 'number') {
        newCyberFitnessProfile.kiloVibes = (newCyberFitnessProfile.kiloVibes || 0) + updates.kiloVibes; 
    }
    if (updates.focusTimeHours !== undefined && typeof updates.focusTimeHours === 'number') {
        newCyberFitnessProfile.focusTimeHours = (newCyberFitnessProfile.focusTimeHours || 0) + updates.focusTimeHours; 
    }
    if (updates.activeQuests && Array.isArray(updates.activeQuests)) newCyberFitnessProfile.activeQuests = Array.from(new Set([...(newCyberFitnessProfile.activeQuests || []), ...updates.activeQuests]));
    if (updates.completedQuests && Array.isArray(updates.completedQuests)) {
        newCyberFitnessProfile.completedQuests = Array.from(new Set([...(newCyberFitnessProfile.completedQuests || []), ...updates.completedQuests]));
        newCyberFitnessProfile.activeQuests = (newCyberFitnessProfile.activeQuests || []).filter(q => !updates.completedQuests!.includes(q));
    }
    if (updates.unlockedPerks && Array.isArray(updates.unlockedPerks)) newCyberFitnessProfile.unlockedPerks = Array.from(new Set([...(newCyberFitnessProfile.unlockedPerks || []), ...updates.unlockedPerks]));
    
    if (updates.dailyActivityLog && Array.isArray(updates.dailyActivityLog)) newCyberFitnessProfile.dailyActivityLog = updates.dailyActivityLog; 
    if (updates.featuresUsed && typeof updates.featuresUsed === 'object') {
        newCyberFitnessProfile.featuresUsed = {...(newCyberFitnessProfile.featuresUsed || {}), ...updates.featuresUsed};
    }
    
    if (typeof updates.totalFilesExtracted === 'number') newCyberFitnessProfile.totalFilesExtracted = (newCyberFitnessProfile.totalFilesExtracted || 0) + updates.totalFilesExtracted;
    if (typeof updates.totalTokensProcessed === 'number') newCyberFitnessProfile.totalTokensProcessed = (newCyberFitnessProfile.totalTokensProcessed || 0) + updates.totalTokensProcessed;
    if (typeof updates.totalKworkRequestsSent === 'number') newCyberFitnessProfile.totalKworkRequestsSent = (newCyberFitnessProfile.totalKworkRequestsSent || 0) + updates.totalKworkRequestsSent;
    if (typeof updates.totalPrsCreated === 'number') newCyberFitnessProfile.totalPrsCreated = (newCyberFitnessProfile.totalPrsCreated || 0) + updates.totalPrsCreated;
    if (typeof updates.totalBranchesUpdated === 'number') newCyberFitnessProfile.totalBranchesUpdated = (newCyberFitnessProfile.totalBranchesUpdated || 0) + updates.totalBranchesUpdated;
    
    // --- Leveling Logic ---
    const previousLevel = newCyberFitnessProfile.level;
    let newLevelCandidate = previousLevel;

    // Determine level based on KiloVibes first
    for (let i = LEVEL_THRESHOLDS_KV.length - 1; i >= 0; i--) {
        if (newCyberFitnessProfile.kiloVibes >= LEVEL_THRESHOLDS_KV[i]) {
            newLevelCandidate = i;
            break;
        }
    }
     // If a specific level was passed in `updates` (e.g., from quest completion), ensure it's respected if higher
     if (updates.level !== undefined && typeof updates.level === 'number' && updates.level > newLevelCandidate) {
        newLevelCandidate = updates.level;
        logger.info(`[CyberFitness UpdateProfile] Explicit level update to ${newLevelCandidate} from quest/direct call.`);
    }
    
    let newlyUnlockedAchievements: Achievement[] = [];
    let currentAchievementsSet = new Set(newCyberFitnessProfile.achievements || []);

    if (newLevelCandidate > previousLevel) {
        logger.info(`[CyberFitness UpdateProfile] LEVEL UP! User ${userId} from ${previousLevel} to ${newLevelCandidate}.`);
        newCyberFitnessProfile.level = newLevelCandidate;
        newCyberFitnessProfile.cognitiveOSVersion = COGNITIVE_OS_VERSIONS[newLevelCandidate] || `v${newLevelCandidate}.0 Custom Elite`;
        
        const kvAwardForLevel = (newLevelCandidate - previousLevel) * 50; // Reduced per-level KV, quests/achievements give more
        if (kvAwardForLevel > 0) {
            newCyberFitnessProfile.kiloVibes += kvAwardForLevel;
            logger.info(`[CyberFitness UpdateProfile] Awarded ${kvAwardForLevel} KiloVibes for reaching level ${newLevelCandidate}. New total: ${newCyberFitnessProfile.kiloVibes}`);
        }

        let perksActuallyAddedThisUpdate: string[] = [];
        for (let lvl = previousLevel + 1; lvl <= newLevelCandidate; lvl++) {
            if (PERKS_BY_LEVEL[lvl]) {
                const perksForThisLevel = PERKS_BY_LEVEL[lvl];
                const existingPerksSet = new Set(newCyberFitnessProfile.unlockedPerks || []);
                perksForThisLevel.forEach(perk => {
                    if (!existingPerksSet.has(perk)) {
                        newCyberFitnessProfile.unlockedPerks.push(perk);
                        existingPerksSet.add(perk); // Keep track for current update cycle
                        perksActuallyAddedThisUpdate.push(perk);
                        logger.info(`[CyberFitness UpdateProfile] Unlocked perk: "${perk}" for level ${lvl}.`);
                    }
                });
            }
            // Dynamic Level Up Achievement
            const levelUpAchievementId = `level_up_${lvl}`;
            if (!currentAchievementsSet.has(levelUpAchievementId)) {
                 const levelUpAch: Achievement = {
                     id: levelUpAchievementId,
                     name: `Достигнут Уровень ${lvl}!`,
                     description: `Ты достиг ${lvl}-го уровня КиберФитнеса! Новые перки и возможности открыты.`,
                     icon: 'FaStar', 
                     checkCondition: () => true, 
                     kiloVibesAward: 25 * lvl // Smaller bonus for level up, main KV from actions/quests
                 };
                 currentAchievementsSet.add(levelUpAch.id);
                 newlyUnlockedAchievements.push(levelUpAch);
                 if (levelUpAch.kiloVibesAward) {
                     newCyberFitnessProfile.kiloVibes += levelUpAch.kiloVibesAward;
                 }
                 logger.info(`[CyberFitness UpdateProfile] Unlocked dynamic achievement: '${levelUpAch.name}' (Lvl ${lvl})`);
            }
        }
        if(perksActuallyAddedThisUpdate.length > 0){
            logger.info(`[CyberFitness UpdateProfile] Total new perks unlocked in this update: ${perksActuallyAddedThisUpdate.join(', ')}`);
        }
        newCyberFitnessProfile.skillsLeveled = newCyberFitnessProfile.unlockedPerks.length;
    }
    // If specific perks were passed in `updates`, merge them too
    if (updates.unlockedPerks && Array.isArray(updates.unlockedPerks)) {
        const existingPerksSet = new Set(newCyberFitnessProfile.unlockedPerks || []);
        updates.unlockedPerks.forEach(perk => {
            if (!existingPerksSet.has(perk)) {
                newCyberFitnessProfile.unlockedPerks.push(perk);
                existingPerksSet.add(perk);
                 logger.info(`[CyberFitness UpdateProfile] Unlocked specific perk from updates: "${perk}".`);
            }
        });
        newCyberFitnessProfile.skillsLeveled = newCyberFitnessProfile.unlockedPerks.length;
    }
    // --- End Leveling Logic ---
    if (updates.cognitiveOSVersion && typeof updates.cognitiveOSVersion === 'string' && updates.cognitiveOSVersion !== newCyberFitnessProfile.cognitiveOSVersion) {
        // If OS version was explicitly passed in updates (e.g. from a specific quest reward), override the level-based one.
        newCyberFitnessProfile.cognitiveOSVersion = updates.cognitiveOSVersion;
        logger.info(`[CyberFitness UpdateProfile] CognitiveOSVersion explicitly set to: ${updates.cognitiveOSVersion}`);
    }


    // --- Achievement Check (after KiloVibes and totals are updated, including from leveling) ---
    for (const ach of ALL_ACHIEVEMENTS) {
        if (!ach.isQuest && !currentAchievementsSet.has(ach.id) && ach.checkCondition(newCyberFitnessProfile)) { 
            currentAchievementsSet.add(ach.id); 
            newlyUnlockedAchievements.push(ach);
            if (ach.kiloVibesAward && typeof ach.kiloVibesAward === 'number') { 
                newCyberFitnessProfile.kiloVibes += ach.kiloVibesAward;
                logger.debug(`[CyberFitness UpdateProfile] Awarded ${ach.kiloVibesAward} KiloVibes for standard achievement '${ach.name}'. New total: ${newCyberFitnessProfile.kiloVibes}`);
            }
        }
    }
    newCyberFitnessProfile.achievements = Array.from(currentAchievementsSet);
    logger.debug(`[CyberFitness UpdateProfile] Achievements for ${userId} after evaluation: ${newCyberFitnessProfile.achievements.join(', ')}. KiloVibes after all awards: ${newCyberFitnessProfile.kiloVibes}`);

    if (newlyUnlockedAchievements.length > 0) {
        logger.info(`[CyberFitness UpdateProfile] User ${userId} unlocked new achievements (including dynamic level ups):`, newlyUnlockedAchievements.map(a => `${a.name} (+${a.kiloVibesAward || 0}KV)`));
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

    logger.log(`[CyberFitness UpdateProfile EXIT] Successfully updated profile for ${userId}. New KiloVibes: ${newCyberFitnessProfile.kiloVibes}, Level: ${newCyberFitnessProfile.level}`);
    return { success: true, data: updatedUser, newAchievements: newlyUnlockedAchievements };
  } catch (e: any) {
    logger.error(`[CyberFitness UpdateProfile CATCH] Exception for ${userId}:`, e);
    const errorMessage = (e instanceof Error ? e.message : String(e)) || "Failed to update CyberFitness profile.";
    return { success: false, error: errorMessage, newAchievements: [] };
  }
};

export const logCyberFitnessAction = async (
  userId: string,
  actionType: 'filesExtracted' | 'tokensProcessed' | 'kworkRequestSent' | 'prCreated' | 'branchUpdated' | 'featureUsed' | 'focusTimeAdded', // Added focusTimeAdded
  countOrDetails: number | { featureName: string } | { minutes: number } // Added minutes for focusTime
): Promise<{ success: boolean; error?: string; newAchievements?: Achievement[] }> => {
  logger.log(`[CyberFitness LogAction ENTRY] User: ${userId}, Action: ${actionType}, Value:`, countOrDetails);
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
       logger.warn(`[CyberFitness LogAction] Invalid countOrDetails for 'featureUsed'. Expected {featureName: string}. Received:`, countOrDetails);
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
    logger.debug(`[CyberFitness LogAction] Current profile for ${userId} before logging ${actionType}: KiloVibes=${currentProfile.kiloVibes}, totalFilesExtracted=${currentProfile.totalFilesExtracted}`);

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
        todayEntry.kworkRequestsSent += countOrDetails; 
        profileUpdates.totalKworkRequestsSent = countOrDetails; 
    } else if (actionType === 'prCreated' && typeof countOrDetails === 'number') {
        todayEntry.prsCreated += countOrDetails;
        profileUpdates.totalPrsCreated = countOrDetails; 
    } else if (actionType === 'branchUpdated' && typeof countOrDetails === 'number') {
        todayEntry.branchesUpdated += countOrDetails;
        profileUpdates.totalBranchesUpdated = countOrDetails; 
    } else if (actionType === 'featureUsed' && typeof countOrDetails === 'object' && 'featureName' in countOrDetails) {
        const featureName = countOrDetails.featureName;
        if (typeof featureName === 'string' && !profileUpdates.featuresUsed![featureName]) { 
             profileUpdates.featuresUsed![featureName] = true;
             logger.debug(`[CyberFitness LogAction] Feature '${featureName}' marked as used for user ${userId}.`);
        } else if (typeof featureName === 'string') {
            logger.debug(`[CyberFitness LogAction] Feature '${featureName}' was already marked for user ${userId}. No change to featuresUsed.`);
        } else {
            logger.warn(`[CyberFitness LogAction] Invalid featureName in countOrDetails for 'featureUsed':`, countOrDetails);
        }
    } else if (actionType === 'focusTimeAdded' && typeof countOrDetails === 'object' && 'minutes' in countOrDetails) {
        const minutes = countOrDetails.minutes;
        if (typeof minutes === 'number' && minutes > 0) {
            profileUpdates.focusTimeHours = minutes / 60; // This will add to existing in updateUserCyberFitnessProfile
            // Could also add to daily log if needed:
            // todayEntry.focusMinutes = (todayEntry.focusMinutes || 0) + minutes;
            logger.debug(`[CyberFitness LogAction] Logged ${minutes} minutes of focus time for user ${userId}.`);
        } else {
            logger.warn(`[CyberFitness LogAction] Invalid minutes for 'focusTimeAdded':`, minutes);
        }
    }


    dailyLog.sort((a, b) => b.date.localeCompare(a.date)); 
    if (dailyLog.length > MAX_DAILY_LOG_ENTRIES) {
      dailyLog = dailyLog.slice(0, MAX_DAILY_LOG_ENTRIES);
    }
    profileUpdates.dailyActivityLog = dailyLog;

    logger.debug(`[CyberFitness LogAction] Profile updates prepared for ${userId}:`, JSON.stringify(profileUpdates).substring(0,300) + "...");
    const updateResult = await updateUserCyberFitnessProfile(userId, profileUpdates);
    
    if (!updateResult.success) {
      logger.error(`[CyberFitness LogAction] Failed to save profile for ${userId} after logging ${actionType}. Error: ${updateResult.error}`);
      return { success: false, error: updateResult.error || "Failed to save updated profile." };
    }

    const finalKiloVibes = updateResult.data?.metadata?.[CYBERFIT_METADATA_KEY]?.kiloVibes; 
    logger.log(`[CyberFitness LogAction EXIT] Action '${actionType}' logged for ${userId}. Final KiloVibes: ${finalKiloVibes ?? 'N/A'}. New achievements:`, updateResult.newAchievements?.map(a => a.id));
    return { success: true, newAchievements: updateResult.newAchievements };

  } catch (e: any) {
    logger.error(`[CyberFitness LogAction CATCH] Exception for ${userId} logging ${actionType}:`, e);
    return { success: false, error: e.message || "Failed to log CyberFitness action." };
  }
};

export const checkAndUnlockFeatureAchievement = async (
    userId: string,
    featureName: keyof Exclude<CyberFitnessProfile['featuresUsed'], undefined> | string 
): Promise<{ success: boolean; newAchievements?: Achievement[], error?: string }> => {
    logger.log(`[CyberFitness CheckFeatureAchievement ENTRY] User: ${userId}, Feature: ${featureName}`);
    if (!userId || !featureName) {
        logger.warn("[CyberFitness CheckFeatureAchievement] User ID and feature name required. Aborting.");
        return { success: false, error: "User ID and feature name required."};
    }
    const result = await logCyberFitnessAction(userId, 'featureUsed', { featureName: String(featureName) }); 
    if(result.success){
        logger.log(`[CyberFitness CheckFeatureAchievement EXIT] Successfully logged feature '${featureName}'. New achievements: ${result.newAchievements?.map(a=>a.id) ?? 'None'}`);
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
  newPerks?: string[] 
): Promise<{ success: boolean; data?: DbUser; error?: string; newAchievements?: Achievement[] }> => {
  logger.log(`[CyberFitness QuestComplete ENTRY] User: ${userId}, Quest: ${questId}, KiloVibes: ${kiloVibesAwarded}, Lvl?: ${newLevel}, Perks?:`, newPerks);
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
  logger.debug(`[CyberFitness QuestComplete] Current profile for ${userId}: QuestsDone=${currentProfile.completedQuests.join(',')}, KiloVibes=${currentProfile.kiloVibes}`);

  const questDefinition = ALL_ACHIEVEMENTS.find(ach => ach.id === questId && ach.isQuest);
  if (!questDefinition) {
      logger.warn(`[CyberFitness QuestComplete] Quest ID "${questId}" not found or not marked as a quest in ALL_ACHIEVEMENTS. Cannot process completion.`);
      // Still allow KV and level/perk updates if provided, but log a warning.
  }


  if (!isTrueMockSession && currentProfile.completedQuests?.includes(questId)) {
    logger.info(`[CyberFitness QuestComplete] Quest ${questId} already completed by user ${userId}. Checking for new perks only from this call.`);
    let shouldUpdateForPerksOnly = false;
    const updatesForPerks: Partial<CyberFitnessProfile> = {};
    const perksFromThisQuestCall = newPerks || questDefinition?.unlocksPerks || [];

    if (perksFromThisQuestCall.length > 0) {
        const existingPerksSet = new Set(currentProfile.unlockedPerks || []);
        const uniqueNewPerksFromThisCall = perksFromThisQuestCall.filter(p => !existingPerksSet.has(p));
        if (uniqueNewPerksFromThisCall.length > 0) {
            updatesForPerks.unlockedPerks = uniqueNewPerksFromThisCall; 
            shouldUpdateForPerksOnly = true;
            logger.log(`[CyberFitness QuestComplete] User ${userId} unlocking new perks for already completed quest ${questId}:`, uniqueNewPerksFromThisCall);
        }
    }
    if (shouldUpdateForPerksOnly) {
        // Award KiloVibes if provided, even if quest is a repeat but new perks are given
        if (kiloVibesAwarded > 0) updatesForPerks.kiloVibes = kiloVibesAwarded;
        return updateUserCyberFitnessProfile(userId, updatesForPerks); 
    }
    logger.log(`[CyberFitness QuestComplete] Quest ${questId} already done and no new perks from this call for user ${userId}. No update needed.`);
    return { success: true, data: undefined, newAchievements: [] }; 
  }

  const updates: Partial<CyberFitnessProfile> = {
    kiloVibes: kiloVibesAwarded > 0 ? kiloVibesAwarded : 0, 
    completedQuests: [questId], 
  };
  logger.debug(`[CyberFitness QuestComplete] Initial updates for quest ${questId}: KiloVibes delta = ${updates.kiloVibes}`);

  if (newLevel !== undefined) updates.level = newLevel; // Pass to updateUser... for central handling

  const perksToAward = newPerks || questDefinition?.unlocksPerks;
  if (perksToAward) updates.unlockedPerks = perksToAward; 
  
  const result = await updateUserCyberFitnessProfile(userId, updates);
  const finalKiloVibes = result.data?.metadata?.[CYBERFIT_METADATA_KEY]?.kiloVibes;
  logger.log(`[CyberFitness QuestComplete EXIT] Update result for quest ${questId}: Success: ${result.success}. Final KiloVibes: ${finalKiloVibes ?? 'N/A'}. New achievements: ${result.newAchievements?.map(a=>a.id) ?? 'None'}`);
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