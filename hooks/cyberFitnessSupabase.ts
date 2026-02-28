"use client"; 
 
import { supabaseAdmin, updateUserMetadata as genericUpdateUserMetadata, fetchUserData as genericFetchUserData } from '@/lib/supabase-server'; 
import type { Database } from "@/types/database.types";
import { logger } from "@/lib/logger";
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

export const CYBERFIT_METADATA_KEY = "cyberFitness"; 
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
    // Existing Achievements
    { id: "first_blood", name: "Первая Кровь", description: "Первая залогированная активность в CyberFitness. Добро пожаловать, Агент!", icon: "FaVial", kiloVibesAward: 10, checkCondition: (p) => (p.dailyActivityLog?.length ?? 0) > 0 || p.totalFilesExtracted > 0 || p.totalTokensProcessed > 0 || p.totalKworkRequestsSent > 0 },
    { id: "data_miner_1", name: "Добытчик Данных I", description: "Извлечено 100 файлов.", icon: "FaDatabase", kiloVibesAward: 20, checkCondition: (p) => p.totalFilesExtracted >= 100 },
    { id: "data_miner_2", name: "Добытчик Данных II", description: "Извлечено 500 файлов.", icon: "FaDatabase", kiloVibesAward: 50, checkCondition: (p) => p.totalFilesExtracted >= 500 },
    { id: "archive_master", name: "Магистр Архивов", description: "Суммарно добавлено в контекст более 2000 файлов.", icon: "FaBoxArchive", kiloVibesAward: 400, checkCondition: (p) => p.totalFilesExtracted >= 2000 },
    { id: "token_economist_1", name: "Экономист Токенов I", description: "Обработано 100,000 токенов AI.", icon: "FaCoins", kiloVibesAward: 30, checkCondition: (p) => p.totalTokensProcessed >= 100000 },
    { id: "token_economist_2", name: "Экономист Токенов II", description: "Обработано 1,000,000 токенов AI.", icon: "FaCoins", kiloVibesAward: 100, checkCondition: (p) => p.totalTokensProcessed >= 1000000 },
    { id: "context_leviathan", name: "Контекстный Левиафан", description: "Суммарно обработано более 5,000,000 токенов ИИ.", icon: "FaAngryCreative", kiloVibesAward: 500, checkCondition: (p) => p.totalTokensProcessed >= 5000000 },
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
    { id: "curious_scrollerman", name: "Любопытный Скроллермен", description: "Проявил недюжинное любопытство, изучая просторы приложения скроллом. Респект!", icon: "FaChevronDown", kiloVibesAward: 5, checkCondition: (p) => p.featuresUsed?.scrolled_like_a_maniac === true },
    
    // Quests
    { id: "initial_boot_sequence", name: "Квест: Пойман Сигнал!", description: "Успешно инициирован рабочий флоу.", icon: "FaBolt", checkCondition: () => false, isQuest: true, kiloVibesAward: 25, unlocksPerks: ["Доступ к СуперВайб Студии"] },
    { id: "first_fetch_completed", name: "Квест: Первая Загрузка", description: "Успешно загружены файлы.", icon: "FaDownload", checkCondition: () => false, isQuest: true, kiloVibesAward: 75, unlocksPerks: PERKS_BY_LEVEL[1] },
    { id: "first_parse_completed", name: "Квест: Первый Парсинг", description: "Успешно разобран ответ от AI.", icon: "FaCode", checkCondition: () => false, isQuest: true, kiloVibesAward: 150, unlocksPerks: PERKS_BY_LEVEL[2] },
    { id: "first_pr_created", name: "Квест: Первый PR", description: "Успешно создан Pull Request.", icon: "FaGithub", checkCondition: () => false, isQuest: true, kiloVibesAward: 250, unlocksPerks: PERKS_BY_LEVEL[3] },
    { id: "image-swap-mission", name: "Миссия: Битый Пиксель", description: "Заменил битую картинку как босс!", icon: "FaArrowsLeftRight", kiloVibesAward: 15, checkCondition: (p) => p.completedQuests.includes("image-swap-mission") },
    { id: "icon-swap-mission", name: "Миссия: Сапёр Иконок", description: "Обезвредил минное поле из битых иконок!", icon: "FaBomb", kiloVibesAward: 15, checkCondition: (p) => p.completedQuests.includes("icon-swap-mission") },
    { id: "video-swap-mission", name: "Миссия: Видео-Рендер", description: "Заменил видео-файл, как будто так и надо!", icon: "FaVideo", kiloVibesAward: 15, checkCondition: (p) => p.completedQuests.includes("video-swap-mission") },
    { id: "inception-swap-mission", name: "Миссия: Inception Swap", description: "Осознал 4-шаговый паттерн! Ты почти Нео.", icon: "FaInfinity", kiloVibesAward: 15, checkCondition: (p) => p.completedQuests.includes("inception-swap-mission") },
    { id: "the-fifth-door-mission", name: "Миссия: Пятая Дверь", description: "Вышел из Матрицы! Полный контроль!", icon: "FaKey", kiloVibesAward: 50, checkCondition: (p) => p.completedQuests.includes("the-fifth-door-mission") },

    // Leads Page Achievements
    { id: "leads_first_csv_upload", name: "Десантник Данных", description: "Первый успешный импорт CSV с лидами. База пополнена!", icon: "FaFileCsv", kiloVibesAward: 30, checkCondition: (p) => p.featuresUsed?.leads_first_csv_upload === true },
    { id: "leads_first_scrape_success", name: "Кибер-Паук", description: "Первый успешный сбор данных с помощью скрейпера.", icon: "FaSpider", kiloVibesAward: 25, checkCondition: (p) => p.featuresUsed?.leads_first_scrape_success === true },
    { id: "leads_ai_pipeline_used", name: "Конвейерный Магнат", description: "Использован Межгалактический Пайплайн для обработки лидов.", icon: "FaRobot", kiloVibesAward: 40, checkCondition: (p) => p.featuresUsed?.leads_ai_pipeline_used === true },
    { 
      id: "leads_filter_master", 
      name: "Магистр Фильтров", 
      description: "Продемонстрировано мастерство фильтрации: использованы все основные фильтры на дашборде лидов.", 
      icon: "FaFilterCircleDollar", 
      kiloVibesAward: 50, 
      checkCondition: (p) => 
        p.featuresUsed?.leads_filter_my_used === true &&
        p.featuresUsed?.leads_filter_support_used === true &&
        p.featuresUsed?.leads_filter_tank_used === true &&
        p.featuresUsed?.leads_filter_carry_used === true &&
        p.featuresUsed?.leads_filter_new_used === true &&
        p.featuresUsed?.leads_filter_in_progress_used === true &&
        p.featuresUsed?.leads_filter_interested_used === true
    },
    { 
      id: "leads_role_commander", 
      name: "Командир Ролей", 
      description: "Проявлены лидерские качества: лиды были назначены каждой из ролей (Танк, Кэрри, Саппорт).", 
      icon: "FaUsersGear", 
      kiloVibesAward: 60, 
      checkCondition: (p) => 
        p.featuresUsed?.lead_assigned_to_tank_ever === true &&
        p.featuresUsed?.lead_assigned_to_carry_ever === true &&
        p.featuresUsed?.lead_assigned_to_support_ever === true
    },

    // WB Landing / CyberMarkets Achievements
    { id: "wb_crew_first_launch", name: "Штаб Развернут", description: "Создан первый складской crew в WB Landing.", icon: "FaWarehouse", kiloVibesAward: 35, checkCondition: (p) => p.featuresUsed?.wb_crew_created === true },
    { id: "wb_crew_recruiter", name: "Вербовщик Синдиката", description: "Отправлено первое приглашение в складскую команду.", icon: "FaUserPlus", kiloVibesAward: 20, checkCondition: (p) => p.featuresUsed?.wb_crew_invite_sent === true },
    { id: "wb_xlsx_alchemist", name: "Алхимик XLSX", description: "Загружен XLSX-файл для аудита или миграции данных.", icon: "FaFileExcel", kiloVibesAward: 30, checkCondition: (p) => p.featuresUsed?.wb_xlsx_uploaded === true || p.featuresUsed?.wb_audit_xlsx_uploaded === true },
    { id: "wb_migrator_online", name: "Мигратор Онлайн", description: "Выполнена успешная миграция склада из файла.", icon: "FaTruckFast", kiloVibesAward: 40, checkCondition: (p) => p.featuresUsed?.wb_migration_completed === true },
    { id: "wb_audit_initiated", name: "Диагност Потерь", description: "Запущен аудит склада в WB Landing.", icon: "FaMagnifyingGlassChart", kiloVibesAward: 25, checkCondition: (p) => p.featuresUsed?.wb_audit_started === true },
    { id: "wb_audit_completed", name: "Ревизор Матрицы", description: "Аудит склада доведён до финального расчёта.", icon: "FaClipboardCheck", kiloVibesAward: 45, checkCondition: (p) => p.featuresUsed?.wb_audit_completed === true },
    { id: "wb_report_dispatcher", name: "Диспетчер Отчётов", description: "Отчёт аудита отправлен в Telegram.", icon: "FaPaperPlane", kiloVibesAward: 30, checkCondition: (p) => p.featuresUsed?.wb_audit_report_sent === true },
    { id: "wb_tip_patron", name: "Патрон Системы", description: "Отправлен TIP/поддержка архитектора на WB Landing.", icon: "FaHeart", kiloVibesAward: 20, checkCondition: (p) => p.featuresUsed?.wb_tip_sent === true },
    { id: "wb_fix_bounty", name: "Охотник за Багами", description: "Создан первый FIX/Feature bounty-запрос.", icon: "FaBug", kiloVibesAward: 35, checkCondition: (p) => p.featuresUsed?.wb_fix_request_sent === true },
    {
      id: "wb_market_orchestrator",
      name: "Оркестратор КиберМаркетов",
      description: "Собран полный WB-цикл: crew + миграция + аудит + отчёт + bounty.",
      icon: "FaCrown",
      kiloVibesAward: 120,
      checkCondition: (p) =>
        p.featuresUsed?.wb_crew_created === true &&
        p.featuresUsed?.wb_migration_completed === true &&
        p.featuresUsed?.wb_audit_completed === true &&
        p.featuresUsed?.wb_audit_report_sent === true &&
        p.featuresUsed?.wb_fix_request_sent === true,
    },
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



interface SchematicCompletionDetails {
    prerequisites: string[];
    kiloVibesAward?: number;
    unlocksPerk?: string;
    schematicName: string;
    schematicIcon: string;
}

















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