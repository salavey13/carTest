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
let MOCK_USER_ID_FOR_DB_STR: string | null = null; 
if (process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true') {
    const parsedId = parseInt(MOCK_USER_ID_STR_ENV, 10);
    if (!isNaN(parsedId)) {
        MOCK_USER_ID_NUM = parsedId;
        MOCK_USER_ID_FOR_DB_STR = MOCK_USER_ID_STR_ENV; 
    } else {
        logger.error(`[CyberFitness] Invalid NEXT_PUBLIC_MOCK_USER_ID: "${MOCK_USER_ID_STR_ENV}". Must be a number string.`);
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

export const CYBERFIT_METADATA_KEY = "cyberFitness"; // EXPORT ADDED
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
    isDynamic?: boolean; 
}

export const QUEST_ORDER: string[] = [ 
    "image-swap-mission",
    "icon-swap-mission",
    "video-swap-mission",
    "inception-swap-mission",
    "the-fifth-door-mission"
];

const LEVEL_THRESHOLDS_KV = [0, 50, 150, 400, 800, 1500, 2800, 5000, 8000, 12000, 17000, 23000, 30000, 40000, 50000, 75000, 100000]; 
const COGNITIVE_OS_VERSIONS = [
    "v0.1 Genesis", "v0.2 Neural Spark", "v0.3 Code Apprentice", "v0.4 Vibe Engineer", 
    "v0.5 Logic Architect", "v0.6 Context Weaver", "v0.7 Matrix Surfer", "v0.8 Quantum Coder", 
    "v0.9 Singularity Pilot", "v1.0 Ascended Node", "v1.1 Vibe Master", "v1.2 Digital Demiurge",
    "v1.3 Context Commander", "v1.4 Vibe Channeler", "v1.5 Nexus Oracle", "v1.6 Reality Shaper", "vX.X Transcendent UI", 
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
    14: ["Мастер Эффективности - Оптимизация Затрат Токенов (Пассивный)", "Создание ИИ-Агентов для Задач (Заглушка)"],
    15: ["Архитектор Мультивселенной Кода (Пассивный)"],
    16: ["Кибер-гуру (Программа менторства продвинутого уровня)"]
};

export const ALL_ACHIEVEMENTS: Achievement[] = [
    { id: "first_blood", name: "Первая Кровь", description: "Первая залогированная активность в CyberFitness. Добро пожаловать, Агент!", icon: "FaVial", kiloVibesAward: 10, checkCondition: (p) => (p.dailyActivityLog?.length ?? 0) > 0 || p.totalFilesExtracted > 0 || p.totalTokensProcessed > 0 || p.totalKworkRequestsSent > 0 },
    { id: "data_miner_1", name: "Добытчик Данных I", description: "Извлечено 100 файлов.", icon: "FaDatabase", kiloVibesAward: 20, checkCondition: (p) => p.totalFilesExtracted >= 100 },
    { id: "data_miner_2", name: "Добытчик Данных II", description: "Извлечено 500 файлов.", icon: "FaDatabase", kiloVibesAward: 50, checkCondition: (p) => p.totalFilesExtracted >= 500 },
    { id: "archive_master", name: "Магистр Архивов", description: "Суммарно добавлено в контекст более 2000 файлов.", icon: "FaBoxArchive", kiloVibesAward: 400, checkCondition: (p) => p.totalFilesExtracted >= 2000 },
    { id: "token_economist_1", name: "Экономист Токенов I", description: "Обработано 100,000 токенов AI.", icon: "FaCoins", kiloVibesAward: 30, checkCondition: (p) => p.totalTokensProcessed >= 100000 },
    { id: "token_economist_2", name: "Экономист Токенов II", description: "Обработано 1,000,000 токенов AI.", icon: "FaCoins", kiloVibesAward: 100, checkCondition: (p) => p.totalTokensProcessed >= 1000000 },
    { id: "context_leviathan", name: "Контекстный Левиафан", description: "Суммарно обработано более 5,000,000 токенов ИИ.", icon: "FaKraken", kiloVibesAward: 500, checkCondition: (p) => p.totalTokensProcessed >= 5000000 },
    { id: "request_maestro_1", name: "Маэстро Запросов I", description: "Отправлено 25 запросов к AI.", icon: "FaPaperPlane", kiloVibesAward: 30, checkCondition: (p) => p.totalKworkRequestsSent >= 25 },
    { id: "request_maestro_2", name: "Маэстро Запросов II", description: "Отправлено 100 запросов к AI.", icon: "FaPaperPlane", kiloVibesAward: 100, checkCondition: (p) => p.totalKworkRequestsSent >= 100 },
    { id: "commit_crafter_1", name: "Ремесленник Коммитов I", description: "Создано/обновлено 10 веток/PR.", icon: "FaCodeCommit", kiloVibesAward: 50, checkCondition: (p) => (p.totalPrsCreated + p.totalBranchesUpdated) >= 10 },
    { id: "commit_crafter_2", name: "Ремесленник Коммитов II", description: "Создано/обновлено 50 веток/PR.", icon: "FaCodeCommit", kiloVibesAward: 150, checkCondition: (p) => (p.totalPrsCreated + p.totalBranchesUpdated) >= 50 },
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
    { id: "two_finger_fu", name: "Кунг-фу Двух Пальцев", description: "Продемонстрировал мастерство молниеносного мобильного ввода и навигации.", icon: "FaMobileScreenButton", kiloVibesAward: 75, checkCondition: (p) => p.featuresUsed?.usedMobileFast === true },
    { id: "autofix_used", name: "Кибер-Хирург", description: "Первое использование авто-исправления ошибок в коде.", icon: "FaUserDoctor", kiloVibesAward: 20, checkCondition: (p) => p.featuresUsed?.autofix_used === true },
    { id: "deep_work_logged", name: "Погружение в Матрицу", description: "Залогировано первое время глубокой работы.", icon: "FaBrain", kiloVibesAward: 20, checkCondition: (p) => (p.focusTimeHours || 0) > 0},
    { id: "integration_github_connected", name: "GitHub Синхронизирован", description: "Интеграция с GitHub подтверждена.", icon: "FaGithub", kiloVibesAward: 25, checkCondition: (p) => p.featuresUsed?.integration_github_connected === true },
    { id: "integration_vercel_connected", name: "Vercel Подключен", description: "Интеграция с Vercel подтверждена.", icon: "FaBolt", kiloVibesAward: 25, checkCondition: (p) => p.featuresUsed?.integration_vercel_connected === true },
    { id: "integration_supabase_connected", name: "Supabase Интегрирован", description: "Интеграция с Supabase подтверждена.", icon: "FaDatabase", kiloVibesAward: 25, checkCondition: (p) => p.featuresUsed?.integration_supabase_connected === true },
    { id: "integration_aistudio_connected", name: "AI Studio Активен", description: "Интеграция с AI Studio (OpenAI/Gemini/Claude) подтверждена.", icon: "FaRobot", kiloVibesAward: 25, checkCondition: (p) => p.featuresUsed?.integration_aistudio_connected === true },
    { id: "curious_scrollerman", name: "Любопытный Скроллермен", description: "Проявил недюжинное любопытство, изучая просторы приложения скроллом. Респект!", icon: "FaAngleDoubleDown", kiloVibesAward: 5, checkCondition: (p) => p.featuresUsed?.scrolled_like_a_maniac === true },
    { id: "initial_boot_sequence", name: "Квест: Пойман Сигнал!", description: "Успешно инициирован рабочий флоу.", icon: "FaBolt", checkCondition: () => false, isQuest: true, kiloVibesAward: 25, unlocksPerks: ["Доступ к СуперВайб Студии"] },
    { id: "first_fetch_completed", name: "Квест: Первая Загрузка", description: "Успешно загружены файлы.", icon: "FaDownload", checkCondition: () => false, isQuest: true, kiloVibesAward: 75, unlocksPerks: PERKS_BY_LEVEL[1] },
    { id: "first_parse_completed", name: "Квест: Первый Парсинг", description: "Успешно разобран ответ от AI.", icon: "FaCode", checkCondition: () => false, isQuest: true, kiloVibesAward: 150, unlocksPerks: PERKS_BY_LEVEL[2] },
    { id: "first_pr_created", name: "Квест: Первый PR", description: "Успешно создан Pull Request.", icon: "FaGithub", checkCondition: () => false, isQuest: true, kiloVibesAward: 250, unlocksPerks: PERKS_BY_LEVEL[3] },
    { id: "image-swap-mission", name: "Миссия: Битый Пиксель", description: "Заменил битую картинку как босс!", icon: "FaExchangeAlt", kiloVibesAward: 15, checkCondition: (p) => p.completedQuests.includes("image-swap-mission") },
    { id: "icon-swap-mission", name: "Миссия: Сапёр Иконок", description: "Обезвредил минное поле из битых иконок!", icon: "FaBomb", kiloVibesAward: 15, checkCondition: (p) => p.completedQuests.includes("icon-swap-mission") },
    { id: "video-swap-mission", name: "Миссия: Видео-Рендер", description: "Заменил видео-файл, как будто так и надо!", icon: "FaVideo", kiloVibesAward: 15, checkCondition: (p) => p.completedQuests.includes("video-swap-mission") },
    { id: "inception-swap-mission", name: "Миссия: Inception Swap", description: "Осознал 4-шаговый паттерн! Ты почти Нео.", icon: "FaInfinity", kiloVibesAward: 15, checkCondition: (p) => p.completedQuests.includes("inception-swap-mission") },
    { id: "the-fifth-door-mission", name: "Миссия: Пятая Дверь", description: "Вышел из Матрицы! Полный контроль!", icon: "FaKey", kiloVibesAward: 50, checkCondition: (p) => p.completedQuests.includes("the-fifth-door-mission") },
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

interface SchematicCompletionDetails {
    prerequisites: string[];
    kiloVibesAward?: number;
    unlocksPerk?: string;
    schematicName: string;
    schematicIcon: string;
}

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
    logger.log(`[CyberFitness SchematicComplete ENTRY] User_id: ${userId}, Schematic: ${schematicId}, Details:`, details);
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
        
        logger.log(`[CyberFitness SchematicComplete EXIT] Schematic ${schematicId} completed by ${userId}. KV Awarded: ${awardedKV}. Perks: ${newPerksUnlocked.join(',')}. New Ach count: ${updateResult.newAchievements?.length}`);
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

export const updateUserCyberFitnessProfile = async (
  userId: string,
  updates: Partial<CyberFitnessProfile> & { dynamicAchievementsToAdd?: Achievement[] } 
): Promise<{ success: boolean; data?: DbUser; error?: string; newAchievements?: Achievement[] }> => {
  logger.log(`[CyberFitness UpdateProfile ENTRY] User_id: ${userId}, Updates Summary:`, {
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
    
    logger.debug(`[CyberFitness UpdateProfile] User: ${userId}.
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
                        newCyberFitnessProfile.skillsLeveled = new Set(newCyberFitnessProfile.unlockedPerks || []).size;
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
                    newCyberFitnessProfile.skillsLeveled = new Set(newCyberFitnessProfile.unlockedPerks || []).size;
                }
            }
        });
    }

    for (const ach of ALL_ACHIEVEMENTS) {
        if (!ach.isQuest && !currentAchievementsSet.has(ach.id) && ach.checkCondition(newCyberFitnessProfile)) { 
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
                newCyberFitnessProfile.skillsLeveled = new Set(newCyberFitnessProfile.unlockedPerks || []).size;
            }
        }
    }
    newCyberFitnessProfile.achievements = Array.from(currentAchievementsSet);
    
    if (newlyUnlockedAchievements.length > 0) {
        logger.info(`[CyberFitness UpdateProfile] User ${userId} unlocked new achievements (incl. dynamic):`, newlyUnlockedAchievements.map(a => `${a.name} (${a.id}, +${a.kiloVibesAward || 0}KV)`));
    }
    
    logger.debug(`[CyberFitness UpdateProfile] User: ${userId}.
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
  if (!userId) {
    logger.warn("[CyberFitness LogAction] User ID (string) is missing. Cannot log action.");
    return { success: false, error: "User ID (string) is required." };
  }
  
  if (actionType === 'featureUsed') {
      if (typeof countOrDetails !== 'object' || countOrDetails === null || !('featureName' in countOrDetails) || typeof (countOrDetails as any).featureName !== 'string') {
          logger.warn(`[CyberFitness LogAction] Invalid countOrDetails for 'featureUsed'. Expected {featureName: string, featureValue?: any}. Received:`, countOrDetails);
          return { success: false, error: `Invalid data for action ${actionType}. Expected {featureName: string}.` };
      }
  } else if (actionType === 'focusTimeAdded') {
      if (typeof countOrDetails !== 'object' || countOrDetails === null || !('minutes'in countOrDetails) || typeof (countOrDetails as any).minutes !== 'number') {
          logger.warn(`[CyberFitness LogAction] Invalid countOrDetails for 'focusTimeAdded'. Expected {minutes: number}. Received:`, countOrDetails);
          return { success: false, error: `Invalid data for action ${actionType}. Expected {minutes: number}.` };
      }
  } else if (typeof countOrDetails !== 'number') {
      logger.warn(`[CyberFitness LogAction] Action '${actionType}' expects a numeric count. Received:`, countOrDetails);
      return { success: false, error: `Action '${actionType}' expects a numeric count.` };
  }

  try {
    const profileResult = await fetchUserCyberFitnessProfile(userId); 
    if (!profileResult.success && !profileResult.data?.hasOwnProperty('level')) { 
      logger.error(`[CyberFitness LogAction] Failed to get profile data for ${userId} and no default profile returned. Error: ${profileResult.error}`);
      return { success: false, error: profileResult.error || "Failed to get current profile data." };
    }
    
    let currentProfile = profileResult.data || getDefaultCyberFitnessProfile(); 

    let dailyLog = currentProfile.dailyActivityLog ? [...currentProfile.dailyActivityLog] : [];
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    let todayEntry = dailyLog.find(entry => entry.date === todayStr);

    if (!todayEntry) {
      todayEntry = { date: todayStr, filesExtracted: 0, tokensProcessed: 0, kworkRequestsSent: 0, prsCreated: 0, branchesUpdated: 0, focusTimeMinutes: 0 };
      dailyLog.push(todayEntry);
    } else { 
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
        let count = countOrDetails;
        if (count < 0) { logger.warn(`[CF LogAction] Negative filesExtracted count (${count}). Correcting to 0.`); count = 0; }
        todayEntry.filesExtracted += count;
        profileUpdates.totalFilesExtracted = count; 
        kiloVibesFromAction += count * 0.1; 
        if (count >= 20 && !currentProfile.featuresUsed?.added20PlusFilesToKworkOnce) {
             profileUpdates.featuresUsed!.added20PlusFilesToKworkOnce = true; 
        } else if (count >= 10 && !currentProfile.featuresUsed?.added10PlusFilesToKworkOnce) {
            profileUpdates.featuresUsed!.added10PlusFilesToKworkOnce = true;
        }
    } else if (actionType === 'tokensProcessed' && typeof countOrDetails === 'number') {
        let tokenCount = countOrDetails;
        if (tokenCount < 0) {
            logger.warn(`[CF LogAction] Negative tokensProcessed count (${tokenCount}). Correcting to 0.`);
            tokenCount = 0;
        }
        todayEntry.tokensProcessed += tokenCount; 
        profileUpdates.totalTokensProcessed = tokenCount; 
        kiloVibesFromAction += tokenCount * 0.001; 
    } else if (actionType === 'kworkRequestSent' && typeof countOrDetails === 'number') {
        let count = countOrDetails;
        if (count < 0) { logger.warn(`[CF LogAction] Negative kworkRequestSent count (${count}). Correcting to 0.`); count = 0; }
        todayEntry.kworkRequestsSent += count; 
        profileUpdates.totalKworkRequestsSent = count; 
        kiloVibesFromAction += count * 5; 
    } else if (actionType === 'prCreated' && typeof countOrDetails === 'number') {
        let count = countOrDetails;
        if (count <= 0) { logger.warn(`[CF LogAction] Non-positive prCreated count (${count}). Correcting to 1.`); count = 1; }
        else if (count !== 1) { logger.warn(`[CF LogAction] Unusual prCreated count (${count}). Using provided count for KiloVibes and totals, but daily log will sum correctly.`);}
        todayEntry.prsCreated += count; 
        profileUpdates.totalPrsCreated = count; 
        kiloVibesFromAction += count * 50; 
    } else if (actionType === 'branchUpdated' && typeof countOrDetails === 'number') {
        let count = countOrDetails;
        if (count <= 0) { logger.warn(`[CF LogAction] Non-positive branchUpdated count (${count}). Correcting to 1.`); count = 1; }
        else if (count !== 1) { logger.warn(`[CF LogAction] Unusual branchUpdated count (${count}). Using provided count for KiloVibes and totals, but daily log will sum correctly.`);}
        todayEntry.branchesUpdated += count; 
        profileUpdates.totalBranchesUpdated = count; 
        kiloVibesFromAction += count * 20; 
    } else if (actionType === 'featureUsed' && typeof countOrDetails === 'object' && 'featureName' in countOrDetails) {
        const featureDetails = countOrDetails as { featureName: string; featureValue?: string | number | boolean };
        const featureName = featureDetails.featureName;
        const featureValue = featureDetails.featureValue !== undefined ? featureDetails.featureValue : true;

        if (currentProfile.featuresUsed?.[featureName] !== featureValue) { 
             profileUpdates.featuresUsed![featureName] = featureValue;
             if (featureValue === true && !currentProfile.featuresUsed?.[featureName]) { 
                 kiloVibesFromAction += 5; 
             }
        }
    } else if (actionType === 'focusTimeAdded' && typeof countOrDetails === 'object' && 'minutes' in countOrDetails) {
        const focusDetails = countOrDetails as { minutes: number };
        const minutes = focusDetails.minutes;
        if (minutes > 0) {
            profileUpdates.focusTimeHours = minutes / 60; 
            todayEntry.focusTimeMinutes = (todayEntry.focusTimeMinutes || 0) + minutes;
            kiloVibesFromAction += minutes * 0.5; 
        } else if (minutes < 0) {
            logger.warn(`[CyberFitness LogAction] Negative minutes for 'focusTimeAdded': ${minutes}. Ignoring.`);
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

    logger.warn(`[CyberFitness getAchievementDetails] Achievement with ID "${achievementId}" not found in ALL_ACHIEVEMENTS or dynamic patterns.`);
    return undefined;
};

export const TOKEN_ESTIMATION_FACTOR = 4;

export { PERKS_BY_LEVEL };