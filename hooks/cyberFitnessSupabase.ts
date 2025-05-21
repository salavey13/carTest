import { supabaseAdmin } from './supabase';
import { Database, Json } from '@/types/database.types';
import { logger } from '@/lib/logger';
import { format } from 'date-fns'; // Восстановлен импорт

// --- Новая структура для таблицы user_cyber_fitness_profiles ---
export type UserCyberFitnessProfileDB = Database["public"]["Tables"]["user_cyber_fitness_profiles"]["Row"];
export type CyberFitnessMetadata = {
    level: number;
    currentKiloVibes: number;
    totalKiloVibesEarned: number;
    completedQuests: string[]; 
    unlockedPerks: string[]; 
    dailyStreak: number;
    lastActiveDate: string; 
};

// --- Старая структура CyberFitnessProfile для совместимости ---
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
// -------------------------------------------------------------

export type AchievementCategory = 
    | "GENERAL_PROGRESS" 
    | "CONTENT_CREATION" 
    | "CODE_CONTRIBUTION" 
    | "COMMUNITY_ENGAGEMENT"
    | "SYSTEM_INTERACTION"
    | "LEAD_GENERATION"
    | "STUDIO_INTERACTION"
    | "TUTORIALS"; // Добавил категорию для туториалов


export interface Achievement {
    id: string; 
    name: string;
    description: string;
    category: AchievementCategory;
    kiloVibesAward: number;
    icon?: string; 
    isPublic?: boolean; 
    unlockConditions?: (profileData: CyberFitnessMetadata | CyberFitnessProfile, actionDetails?: any) => boolean; // Обновил тип для совместимости
    isQuest?: boolean; // Для старой логики квестов
    unlocksPerks?: string[]; // Для старой логики перков
    isDynamic?: boolean; // Для старой логики динамических ачивок
}

export interface Perk {
    id: string; 
    name: string;
    description: string;
    levelRequired: number; 
    icon?: string;
}


export const CYBERFIT_METADATA_KEY = 'cyberFitnessProfile_v1'; 
const MAX_DAILY_LOG_ENTRIES = 30; 

// --- Achievements Definitions (новый формат) ---
export const ALL_ACHIEVEMENTS: Achievement[] = [
    // GENERAL_PROGRESS
    { id: 'profile_completed', name: 'Личность Установлена', description: 'Заполнил свой профиль полностью.', category: 'GENERAL_PROGRESS', kiloVibesAward: 50, icon: 'FaUserCheck', isPublic: true },
    { id: 'first_login_telegram', name: 'Вход через Телепорт', description: 'Первый успешный вход через Telegram.', category: 'GENERAL_PROGRESS', kiloVibesAward: 25, icon: 'FaTelegram', isPublic: true },
    
    // CONTENT_CREATION
    { id: 'first_article_published', name: 'Первопечатник', description: 'Опубликовал свою первую статью.', category: 'CONTENT_CREATION', kiloVibesAward: 100, icon: 'FaFeatherAlt', isPublic: true },

    // CODE_CONTRIBUTION
    { id: 'initial_boot_sequence', name: 'Пойман Сигнал!', description: 'Успешно запустил процесс анализа репозитория в SUPERVIBE Studio.', category: 'CODE_CONTRIBUTION', kiloVibesAward: 20, icon: 'FaSatelliteDish', isPublic: true, isQuest: true, unlocksPerks: ["Доступ к СуперВайб Студии"] },
    { id: 'first_fetch_completed', name: 'Сканер Активирован!', description: 'Успешно извлек файлы из репозитория.', category: 'CODE_CONTRIBUTION', kiloVibesAward: 50, icon: 'FaDownload', isPublic: true, isQuest: true },
    { id: 'first_parse_completed', name: 'Код Расшифрован!', description: 'Успешно разобрал ответ AI и проанализировал файлы.', category: 'CODE_CONTRIBUTION', kiloVibesAward: 75, icon: 'FaCodeCompare', isPublic: true, isQuest: true },
    { id: 'first_pr_created', name: 'Коммит в Матрицу!', description: 'Создал свой первый Pull Request через SUPERVIBE Studio.', category: 'CODE_CONTRIBUTION', kiloVibesAward: 150, icon: 'FaCodeBranch', isPublic: true, isQuest: true },
    { id: 'branch_updated', name: 'Ветвь Эволюции', description: 'Обновил существующую ветку через SUPERVIBE Studio.', category: 'CODE_CONTRIBUTION', kiloVibesAward: 70, icon: 'FaCodeCommit', isPublic: true },
    { id: 'pr_merged_by_ai_assist', name: 'Ассимиляция Успешна', description: 'Твой PR, созданный с помощью AI, был успешно смержен.', category: 'CODE_CONTRIBUTION', kiloVibesAward: 250, icon: 'FaCheckDouble', isPublic: true },
    { id: 'usedSelectHighlighted', name: 'Фокус Мастера', description: 'Использовал функцию выбора связанных файлов.', category: 'CODE_CONTRIBUTION', kiloVibesAward: 30, icon: 'FaHighlighter', isPublic: true },
    { id: 'usedAddFullTree', name: 'Архивариус Кода', description: 'Добавил полное дерево файлов в запрос.', category: 'CODE_CONTRIBUTION', kiloVibesAward: 25, icon: 'FaFolderTree', isPublic: true },
    { id: 'kwork_cleared', name: 'Чистый Холст', description: 'Очистил поле запроса Kwork.', category: 'CODE_CONTRIBUTION', kiloVibesAward: 10, icon: 'FaEraser', isPublic: true },
    { id: 'system_prompt_copied', name: 'Завет Архитектора', description: 'Скопировал системный промпт.', category: 'CODE_CONTRIBUTION', kiloVibesAward: 15, icon: 'FaClipboardCheck', isPublic: true },
    { id: 'settings_opened', name: 'Взгляд под Капот', description: 'Открыл настройки SUPERVIBE Studio.', category: 'CODE_CONTRIBUTION', kiloVibesAward: 10, icon: 'FaCog', isPublic: true },
    
    // DATA MINING (из старых, адаптировано)
    { id: "data_miner_1", name: "Добытчик Данных I", description: "Извлечено 100 файлов.", icon: "FaDatabase", kiloVibesAward: 20, category: "CODE_CONTRIBUTION", unlockConditions: (p) => (p as CyberFitnessProfile).totalFilesExtracted >= 100 },
    { id: "data_miner_2", name: "Добытчик Данных II", description: "Извлечено 500 файлов.", icon: "FaDatabase", kiloVibesAward: 50, category: "CODE_CONTRIBUTION", unlockConditions: (p) => (p as CyberFitnessProfile).totalFilesExtracted >= 500 },
    { id: "archive_master", name: "Магистр Архивов", description: "Суммарно добавлено в контекст более 2000 файлов.", icon: "FaBoxArchive", kiloVibesAward: 400, category: "CODE_CONTRIBUTION", unlockConditions: (p) => (p as CyberFitnessProfile).totalFilesExtracted >= 2000 },
    { id: "token_economist_1", name: "Экономист Токенов I", description: "Обработано 100,000 токенов AI.", icon: "FaCoins", kiloVibesAward: 30, category: "CODE_CONTRIBUTION", unlockConditions: (p) => (p as CyberFitnessProfile).totalTokensProcessed >= 100000 },
    { id: "token_economist_2", name: "Экономист Токенов II", description: "Обработано 1,000,000 токенов AI.", icon: "FaCoins", kiloVibesAward: 100, category: "CODE_CONTRIBUTION", unlockConditions: (p) => (p as CyberFitnessProfile).totalTokensProcessed >= 1000000 },
    { id: "context_leviathan", name: "Контекстный Левиафан", description: "Суммарно обработано более 5,000,000 токенов ИИ.", icon: "FaKraken", kiloVibesAward: 500, category: "CODE_CONTRIBUTION", unlockConditions: (p) => (p as CyberFitnessProfile).totalTokensProcessed >= 5000000 },
    { id: "request_maestro_1", name: "Маэстро Запросов I", description: "Отправлено 25 запросов к AI.", icon: "FaPaperPlane", kiloVibesAward: 30, category: "CODE_CONTRIBUTION", unlockConditions: (p) => (p as CyberFitnessProfile).totalKworkRequestsSent >= 25 },
    { id: "request_maestro_2", name: "Маэстро Запросов II", description: "Отправлено 100 запросов к AI.", icon: "FaPaperPlane", kiloVibesAward: 100, category: "CODE_CONTRIBUTION", unlockConditions: (p) => (p as CyberFitnessProfile).totalKworkRequestsSent >= 100 },
    { id: "commit_crafter_1", name: "Ремесленник Коммитов I", description: "Создано/обновлено 10 веток/PR.", icon: "FaCodeCommit", kiloVibesAward: 50, category: "CODE_CONTRIBUTION", unlockConditions: (p) => ((p as CyberFitnessProfile).totalPrsCreated + (p as CyberFitnessProfile).totalBranchesUpdated) >= 10 },
    { id: "commit_crafter_2", name: "Ремесленник Коммитов II", description: "Создано/обновлено 50 веток/PR.", icon: "FaCodeCommit", kiloVibesAward: 150, category: "CODE_CONTRIBUTION", unlockConditions: (p) => ((p as CyberFitnessProfile).totalPrsCreated + (p as CyberFitnessProfile).totalBranchesUpdated) >= 50 },
    
    // LEAD_GENERATION
    { id: 'leads_first_scrape_success', name: 'Зонд-Первопроходец', description: 'Успешно использовал Кибер-Скрейпер для сбора данных.', category: 'LEAD_GENERATION', kiloVibesAward: 75, icon: 'FaSatelliteDish', isPublic: true },
    { id: 'leads_first_csv_upload', name: 'Десантник Данных', description: 'Успешно загрузил первый CSV с лидами в Supabase.', category: 'LEAD_GENERATION', kiloVibesAward: 150, icon: 'FaCloudArrowUp', isPublic: true },
    { id: 'leads_ai_pipeline_used', name: 'Межгалактический Конвейер', description: 'Использовал "Межгалактический промпт" для полной обработки лидов.', category: 'LEAD_GENERATION', kiloVibesAward: 100, icon: 'FaMeteor', isPublic: true },

    // STUDIO_INTERACTION & SYSTEM_INTERACTION
    { id: 'sticky_chat_opened', name: 'Вызов Xuinity', description: 'Впервые открыл чат-ассистента Xuinity.', category: 'STUDIO_INTERACTION', kiloVibesAward: 20, icon: 'FaCommentDots', isPublic: true },
    { id: 'copy_logs_used', name: 'Лог-Мастер', description: 'Впервые скопировал системные логи.', category: 'STUDIO_INTERACTION', kiloVibesAward: 25, icon: 'FaClipboardList', isPublic: true },
    { id: 'image_replace_initiated', name: 'Визуальный Твик', description: 'Инициировал замену изображения через Xuinity.', category: 'STUDIO_INTERACTION', kiloVibesAward: 40, icon: 'FaImages', isPublic: true },
    { id: 'icon_replace_initiated', name: 'Символист', description: 'Инициировал замену иконки через Xuinity.', category: 'STUDIO_INTERACTION', kiloVibesAward: 40, icon: 'FaIcons', isPublic: true },
    { id: 'idea_sent_to_studio', name: 'Искра Вдохновения', description: 'Отправил идею в SUPERVIBE Studio через Xuinity.', category: 'STUDIO_INTERACTION', kiloVibesAward: 50, icon: 'FaLightbulb', isPublic: true },
    { id: 'scrolled_like_a_maniac', name: 'Скролл-Коммандос', description: 'Проскроллил страницу как настоящий исследователь глубин!', category: 'SYSTEM_INTERACTION', kiloVibesAward: 15, icon: 'FaAngleDoubleDown', isPublic: false },
    { id: "deep_work_logged", name: "Погружение в Матрицу", description: "Залогировано первое время глубокой работы.", icon: "FaBrain", kiloVibesAward: 20, category: 'SYSTEM_INTERACTION', unlockConditions: (p) => (p as CyberFitnessProfile).focusTimeHours > 0},

    // TUTORIALS / QUESTS (из старой логики, адаптировано)
    { id: "image-swap-mission", name: "Миссия: Битый Пиксель", description: "Заменил битую картинку как босс!", icon: "FaExchangeAlt", kiloVibesAward: 15, category: 'TUTORIALS', isQuest: true, unlockConditions: (p) => (p as CyberFitnessProfile).completedQuests.includes("image-swap-mission") },
    { id: "icon-swap-mission", name: "Миссия: Сапёр Иконок", description: "Обезвредил минное поле из битых иконок!", icon: "FaBomb", kiloVibesAward: 15, category: 'TUTORIALS', isQuest: true, unlockConditions: (p) => (p as CyberFitnessProfile).completedQuests.includes("icon-swap-mission") },
    { id: "video-swap-mission", name: "Миссия: Видео-Рендер", description: "Заменил видео-файл, как будто так и надо!", icon: "FaVideo", kiloVibesAward: 15, category: 'TUTORIALS', isQuest: true, unlockConditions: (p) => (p as CyberFitnessProfile).completedQuests.includes("video-swap-mission") },
    { id: "inception-swap-mission", name: "Миссия: Inception Swap", description: "Осознал 4-шаговый паттерн! Ты почти Нео.", icon: "FaInfinity", kiloVibesAward: 15, category: 'TUTORIALS', isQuest: true, unlockConditions: (p) => (p as CyberFitnessProfile).completedQuests.includes("inception-swap-mission") },
    { id: "the-fifth-door-mission", name: "Миссия: Пятая Дверь", description: "Вышел из Матрицы! Полный контроль!", icon: "FaKey", kiloVibesAward: 50, category: 'TUTORIALS', isQuest: true, unlockConditions: (p) => (p as CyberFitnessProfile).completedQuests.includes("the-fifth-door-mission") },
];


// --- Perks Definitions ---
export const PERKS_BY_LEVEL: Record<number, Perk[]> = {
    1: [ { id: 'basic_repo_fetch', name: 'Базовый Анализ Репо', description: 'Возможность извлекать файлы из GitHub репозиториев.', levelRequired: 1, icon: 'FaDownload' },
         { id: 'auto_pr_image_swap', name: 'Авто-PR для Замены Изображений', description: 'Автоматическое создание PR при замене изображений через Xuinity.', levelRequired: 1, icon: 'FaMagic' },
       ],
    2: [ { id: 'ai_code_parser', name: 'AI Парсер Кода', description: 'Разблокирует возможность парсить ответы AI и применять изменения.', levelRequired: 2, icon: 'FaCodeCompare' },
         { id: 'multi_file_context_5', name: 'Многофайловый Контекст (до 5 файлов)', description: 'Позволяет включать до 5 файлов в контекст для AI.', levelRequired: 2, icon: 'FaCopy' },
       ],
    3: [ { id: 'pr_creation_tool', name: 'Авто-PR Генератор (Новая Ветка)', description: 'Позволяет создавать PR в GitHub на новой ветке через SUPERVIBE Studio.', levelRequired: 3, icon: 'FaGithub' },
         { id: 'branch_update_tool', name: 'Обновление Ветки', description: 'Позволяет обновлять существующую ветку в GitHub.', levelRequired: 3, icon: 'FaCodeBranch' },
         { id: 'error_fix_flow', name: 'Анализ Логов Ошибок (ErrorFix Flow)', description: 'Разблокирует флоу для автоматического анализа и исправления ошибок по логам.', levelRequired: 3, icon: 'FaBugSlash' },
       ],
    // Добавлены остальные перки из старого PERKS_BY_LEVEL для полноты
    4: [ { id: 'vercel_log_check', name: 'Проактивная Проверка Логов Vercel', description: 'Автоматическая проверка логов Vercel на наличие ошибок.', levelRequired: 4, icon: 'FaCloudBolt' },
         { id: 'fa_icon_search', name: 'Самостоятельный Поиск Иконок FontAwesome', description: 'Ассистент помогает находить подходящие иконки FontAwesome.', levelRequired: 4, icon: 'FaSearchPlus' },
       ],
    5: [ { id: 'image_tools_prompts', name: 'Инструменты для Изображений (prompts_imgs.txt)', description: 'Доступ к специальным промптам для работы с изображениями.', levelRequired: 5, icon: 'FaImage' },
         { id: 'advanced_ai_debugging', name: 'Продвинутый Дебаггинг с AI', description: 'Улучшенные возможности AI для отладки кода.', levelRequired: 5, icon: 'FaMicroscope' },
       ],
     6: [ { id: 'data_ops_supabase', name: 'Работа с Данными (SQL в Supabase UI)', description: 'Помощь AI в формировании SQL запросов для Supabase.', levelRequired: 6, icon: 'FaDatabase' },
          { id: 'full_tree_context', name: 'Добавление Полного Дерева Файлов в Контекст', description: 'Возможность добавить все дерево файлов проекта в качестве контекста для AI.', levelRequired: 6, icon: 'FaFolderTree' }
        ],
     7: [ { id: 'advanced_ai_refactoring', name: 'Продвинутый Рефакторинг с AI', description: 'Использование AI для сложного рефакторинга кода.', levelRequired: 7, icon: 'FaRecycle' },
          { id: 'custom_ai_instructions_basic', name: 'Кастомные Инструкции для AI (Базовый)', description: 'Возможность задавать базовые кастомные инструкции для AI.', levelRequired: 7, icon: 'FaScroll' }
        ],
     8: [ { id: 'deploy_own_cybervibe_guide', name: 'Гайд по Развертыванию Собственного CyberVibe', description: 'Доступ к документации по развертыванию своей версии платформы.', levelRequired: 8, icon: 'FaBookOpenReader' },
          { id: 'bot_token_management_stub', name: 'Управление Токенами Ботов (Заглушка)', description: 'Интерфейс для управления токенами ботов (в разработке).', levelRequired: 8, icon: 'FaKey' }
        ],
     9: [ { id: 'xtr_automation_docs', name: 'Документация по Созданию Собственных XTR Автоматизаций', description: 'Гайды по созданию собственных скриптов автоматизации XTR.', levelRequired: 9, icon: 'FaFileCode' } ],
    10: [ { id: 'full_system_prompt_customization', name: 'Полная Кастомизация Системного Промпта AI', description: 'Возможность полностью изменять системный промпт для AI.', levelRequired: 10, icon: 'FaUserEdit' },
           { id: 'beta_access_new_features', name: 'Бета-Доступ к Новым Фичам Платформы', description: 'Ранний доступ к новым функциям платформы.', levelRequired: 10, icon: 'FaFlaskVial' }
         ],
    11: [ { id: 'advanced_api_integration', name: 'Интеграция с Внешними API (Продвинутый)', description: 'Инструменты для сложной интеграции с внешними API.', levelRequired: 11, icon: 'FaLink' },
           { id: 'auto_code_review_stub', name: 'Автоматический Code Review (Заглушка)', description: 'Система автоматического ревью кода (в разработке).', levelRequired: 11, icon: 'FaCodePullRequest' }
         ],
    12: [ { id: 'new_agent_mentorship_soon', name: 'Менторство Новых Агентов (Программа Скоро)', description: 'Возможность стать ментором для новых пользователей (скоро).', levelRequired: 12, icon: 'FaUsersRays' },
           { id: 'platform_roadmap_influence', name: 'Влияние на Roadmap Платформы', description: 'Участие в формировании планов развития платформы.', levelRequired: 12, icon: 'FaMapSigns' }
         ],
    13: [ { id: 'flow_state_concentration', name: "Режим 'Потока' - Улучшенная Концентрация (Пассивный Перк)", description: 'Пассивное улучшение концентрации при работе в студии.', levelRequired: 13, icon: 'FaBrain' },
           { id: 'complex_architecture_generation_ai', name: 'Генерация Сложных Архитектур с AI', description: 'Помощь AI в проектировании сложных архитектур приложений.', levelRequired: 13, icon: 'FaDraftingCompass' }
         ],
    14: [ { id: 'token_cost_optimization_mastery', name: 'Мастер Эффективности - Оптимизация Затрат Токенов (Пассивный)', description: 'Пассивное улучшение эффективности использования токенов AI.', levelRequired: 14, icon: 'FaPiggyBank' },
           { id: 'ai_agent_creation_stub', name: 'Создание ИИ-Агентов для Задач (Заглушка)', description: 'Инструменты для создания кастомных AI-агентов (в разработке).', levelRequired: 14, icon: 'FaUserAstronaut' }
         ],
    15: [ { id: 'code_multiverse_architect', name: 'Архитектор Мультивселенной Кода (Пассивный)', description: 'Высший уровень понимания и управления кодовой базой.', levelRequired: 15, icon: 'FaInfinity' } ],
    16: [ { id: 'cyber_guru_mentorship', name: 'Кибер-гуру (Программа менторства продвинутого уровня)', description: 'Возможность вести продвинутые программы менторства.', levelRequired: 16, icon: 'FaChalkboardUser' } ]
};

export const KILOVIBES_PER_LEVEL = (level: number): number => {
    if (level <= 1) return 0;
    if (level === 2) return 200;
    return KILOVIBES_PER_LEVEL(level - 1) + (level -1) * 150; 
};

// --- Восстановленные константы и функции для совместимости ---
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

export const getDefaultCyberFitnessProfile = (): CyberFitnessProfile => ({
    level: 0, kiloVibes: 0, focusTimeHours: 0, skillsLeveled: 0,
    activeQuests: QUEST_ORDER.length > 0 ? [QUEST_ORDER[0]] : [], 
    completedQuests: [], unlockedPerks: [],
    cognitiveOSVersion: COGNITIVE_OS_VERSIONS[0], lastActivityTimestamp: new Date(0).toISOString(), 
    dailyActivityLog: [], achievements: [],
    totalFilesExtracted: 0, totalTokensProcessed: 0, totalKworkRequestsSent: 0,
    totalPrsCreated: 0, totalBranchesUpdated: 0, featuresUsed: {},
});
// -------------------------------------------------------------


export const getCyberFitnessProfileData = async (userId: string): Promise<{ data: UserCyberFitnessProfileDB | null; error: any }> => {
    if (!supabaseAdmin) {
        logger.error('Supabase admin client not initialized in getCyberFitnessProfileData');
        return { data: null, error: 'Supabase admin client not initialized' };
    }
    try {
        const { data, error } = await supabaseAdmin
            .from('user_cyber_fitness_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (error && error.code !== 'PGRST116') { 
            logger.error(`Error fetching CyberFitness profile for ${userId}:`, error);
        }
        return { data, error: error && error.code !== 'PGRST116' ? error : null };
    } catch (e: any) {
        logger.error(`Exception fetching CyberFitness profile for ${userId}:`, e);
        return { data: null, error: e };
    }
};

export const createNewCyberFitnessProfileDB = async (userId: string): Promise<{ data: UserCyberFitnessProfileDB | null; error: any; newAchievements?: Achievement[] }> => {
    if (!supabaseAdmin) {
        logger.error('Supabase admin client not initialized in createNewCyberFitnessProfileDB');
        return { data: null, error: 'Supabase admin client not initialized' };
    }
    const initialMetadata: CyberFitnessMetadata = {
        level: 1,
        currentKiloVibes: 0,
        totalKiloVibesEarned: 0,
        completedQuests: [],
        unlockedPerks: PERKS_BY_LEVEL[1]?.map(p => p.id) || [], 
        dailyStreak: 0,
        lastActiveDate: new Date().toISOString().split('T')[0],
    };

    try {
        const { data, error } = await supabaseAdmin
            .from('user_cyber_fitness_profiles')
            .insert({
                user_id: userId,
                metadata: initialMetadata as unknown as Json,
            })
            .select()
            .single();

        if (error) {
            logger.error(`Error creating new CyberFitness profile for ${userId}:`, error);
            return { data: null, error, newAchievements: [] };
        }
        logger.info(`[CyberFitness] New DB profile created for user ${userId}. Level 1, ${initialMetadata.currentKiloVibes} KiloVibes.`);
        return { data, error: null, newAchievements: [] };
    } catch (e: any) {
        logger.error(`Exception creating new CyberFitness profile for ${userId}:`, e);
        return { data: null, error: e, newAchievements: [] };
    }
};


export const updateUserCyberFitnessProfile = async (
    userId: string,
    updates: {
        kiloVibesEarned?: number;
        completedQuests?: string[]; 
        actionCounts?: Record<string, number>; 
    }
): Promise<{ success: boolean; error?: string | null; data?: UserCyberFitnessProfileDB | null; newAchievements?: Achievement[] }> => {
    if (!supabaseAdmin) {
        logger.error('Supabase admin client not initialized in updateUserCyberFitnessProfile');
        return { success: false, error: 'Supabase admin client not initialized' };
    }

    try {
        let { data: profile, error: fetchError } = await getCyberFitnessProfileData(userId);

        if (fetchError && fetchError.code !== 'PGRST116' && fetchError.message !== "JSON object requested, multiple (or no) rows returned") {
             logger.error(`[CyberFitness Update] Error fetching profile for user ${userId} before update:`, fetchError);
             return { success: false, error: `Fetch error: ${fetchError.message}` };
        }
        if (!profile) {
            const creationResult = await createNewCyberFitnessProfileDB(userId);
            if (creationResult.error || !creationResult.data) {
                logger.error(`[CyberFitness Update] Failed to create new profile for user ${userId} during update:`, creationResult.error);
                return { success: false, error: `Creation error: ${creationResult.error?.message || 'Unknown'}` };
            }
            profile = creationResult.data;
        }
        
        let metadata = (profile.metadata as unknown as CyberFitnessMetadata | null);
        if (!metadata || typeof metadata.level === 'undefined') { 
            logger.warn(`[CyberFitness Update] Metadata for user ${userId} is missing or incomplete. Re-initializing.`);
            metadata = {
                level: 1, currentKiloVibes: 0, totalKiloVibesEarned: 0,
                completedQuests: [], unlockedPerks: PERKS_BY_LEVEL[1]?.map(p => p.id) || [],
                dailyStreak: 0, lastActiveDate: new Date().toISOString().split('T')[0],
            };
        }

        const awardedAchievements: Achievement[] = [];

        if (updates.kiloVibesEarned && updates.kiloVibesEarned > 0) {
            metadata.currentKiloVibes += updates.kiloVibesEarned;
            metadata.totalKiloVibesEarned += updates.kiloVibesEarned;
        }

        if (updates.completedQuests) {
            updates.completedQuests.forEach(questId => {
                if (!metadata.completedQuests.includes(questId)) {
                    metadata.completedQuests.push(questId);
                    const achievement = ALL_ACHIEVEMENTS.find(ach => ach.id === questId);
                    if (achievement) {
                        metadata.currentKiloVibes += achievement.kiloVibesAward;
                        metadata.totalKiloVibesEarned += achievement.kiloVibesAward;
                        awardedAchievements.push(achievement);
                        logger.info(`[CyberFitness] User ${userId} unlocked achievement: '${achievement.name}' (+${achievement.kiloVibesAward} KiloVibes).`);
                    }
                }
            });
        }
        
        let currentLevelThreshold = KILOVIBES_PER_LEVEL(metadata.level + 1);
        while (metadata.totalKiloVibesEarned >= currentLevelThreshold && currentLevelThreshold > 0) { 
            metadata.level++;
            logger.info(`[CyberFitness] User ${userId} leveled up to Level ${metadata.level}!`);
            const newPerks = PERKS_BY_LEVEL[metadata.level];
            if (newPerks) {
                newPerks.forEach(perk => {
                    if (!metadata.unlockedPerks.includes(perk.id)) {
                        metadata.unlockedPerks.push(perk.id);
                        logger.info(`[CyberFitness] User ${userId} unlocked perk: '${perk.name}'.`);
                    }
                });
            }
            currentLevelThreshold = KILOVIBES_PER_LEVEL(metadata.level + 1);
             if (currentLevelThreshold <= KILOVIBES_PER_LEVEL(metadata.level)) { 
                logger.error(`[CyberFitness] KiloVibes threshold calculation error for level ${metadata.level + 1}. Breaking level-up loop.`);
                break;
            }
        }

        const today = new Date().toISOString().split('T')[0];
        if (metadata.lastActiveDate !== today) {
            const yesterday = new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0];
            if (metadata.lastActiveDate === yesterday) {
                metadata.dailyStreak = (metadata.dailyStreak || 0) + 1;
            } else {
                metadata.dailyStreak = 1; 
            }
            metadata.lastActiveDate = today;
        }

        const { data: updatedProfile, error: updateError } = await supabaseAdmin
            .from('user_cyber_fitness_profiles')
            .update({ metadata: metadata as unknown as Json, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .select()
            .single();

        if (updateError) {
            logger.error(`[CyberFitness Update] Error updating profile for user ${userId}:`, updateError);
            return { success: false, error: updateError.message, newAchievements: awardedAchievements };
        }
        logger.info(`[CyberFitness] Profile updated for user ${userId}. Level: ${metadata.level}, KiloVibes: ${metadata.currentKiloVibes}.`);
        return { success: true, data: updatedProfile, newAchievements: awardedAchievements };

    } catch (e: any) {
        logger.error(`[CyberFitness Update] Exception for user ${userId}:`, e);
        return { success: false, error: e.message || 'Unknown exception' };
    }
};


export const checkAndUnlockFeatureAchievement = async (
    userId: string,
    featureId: string 
): Promise<{ success: boolean; error?: string | null; newAchievements?: Achievement[] }> => {
    const achievementToUnlock = ALL_ACHIEVEMENTS.find(ach => ach.id === featureId);
    if (!achievementToUnlock) {
        logger.warn(`[CyberFitness CheckUnlock] Achievement ID "${featureId}" not found in ALL_ACHIEVEMENTS.`);
        return { success: false, error: "Achievement definition not found." };
    }

    const { data: profile, error: fetchError } = await getCyberFitnessProfileData(userId);
    if (fetchError) {
        logger.error(`[CyberFitness CheckUnlock] Error fetching profile for ${userId} before checking achievement ${featureId}:`, fetchError);
    }
    
    const metadata = profile?.metadata as unknown as CyberFitnessMetadata | null;
    if (metadata?.completedQuests?.includes(featureId)) {
        logger.info(`[CyberFitness CheckUnlock] User ${userId} already unlocked achievement: '${achievementToUnlock.name}'. No update needed.`);
        return { success: true, newAchievements: [] }; 
    }
    
    logger.info(`[CyberFitness CheckUnlock] Attempting to unlock achievement '${achievementToUnlock.name}' for user ${userId}.`);
    return updateUserCyberFitnessProfile(userId, { completedQuests: [featureId] });
};


export const logCyberFitnessAction = async (
    userId: string,
    actionType: string, 
    kiloVibesValue: number = 10 
): Promise<{ success: boolean; error?: string | null; newAchievements?: Achievement[] }> => {
    logger.info(`[CyberFitness Action] User ${userId} performed action: ${actionType}, KiloVibes: ${kiloVibesValue}`);
    return updateUserCyberFitnessProfile(userId, { kiloVibesEarned: kiloVibesValue });
};


export const getUnlockedPerks = (profileMetadata: CyberFitnessMetadata | null): Perk[] => {
    if (!profileMetadata || !profileMetadata.unlockedPerks) return [];
    
    const userPerks: Perk[] = [];
    for (const levelKey in PERKS_BY_LEVEL) {
        const level = parseInt(levelKey);
        if (profileMetadata.level >= level) {
            PERKS_BY_LEVEL[level].forEach(perkDef => {
                if (profileMetadata.unlockedPerks.includes(perkDef.id) && !userPerks.find(up => up.id === perkDef.id)) {
                    userPerks.push(perkDef);
                }
            });
        }
    }
    return userPerks;
};

export const hasPerk = (profileMetadata: CyberFitnessMetadata | null, perkId: string): boolean => {
    if (!profileMetadata || !profileMetadata.unlockedPerks) return false;
    return profileMetadata.unlockedPerks.includes(perkId);
};

// --- Восстановленные функции для совместимости со старым кодом ---
export const fetchUserCyberFitnessProfile = async (userId: string): Promise<{ success: boolean; data?: CyberFitnessProfile; error?: string }> => {
  logger.log(`[CyberFitness FetchProfileCompat ENTRY] User_id: ${userId}`);
  if (!userId) {
    return { success: false, error: "User ID required.", data: getDefaultCyberFitnessProfile() };
  }
  
  const { data: newProfileData, error: newProfileError } = await getCyberFitnessProfileData(userId);
  if (newProfileError) {
    logger.warn(`[CyberFitness FetchProfileCompat] Error fetching new profile for ${userId}: ${newProfileError.message}. Returning default.`);
    return { success: false, error: newProfileError.message, data: getDefaultCyberFitnessProfile() };
  }

  if (newProfileData && newProfileData.metadata) {
    const metadata = newProfileData.metadata as unknown as CyberFitnessMetadata;
    // Адаптация к старому формату CyberFitnessProfile
    const adaptedProfile: CyberFitnessProfile = {
        level: metadata.level,
        kiloVibes: metadata.currentKiloVibes, // или totalKiloVibesEarned в зависимости от того, что означало kiloVibes
        focusTimeHours: 0, // Это поле отсутствует в новой структуре,需要补充或者设定默认值
        skillsLeveled: metadata.unlockedPerks.length,
        activeQuests: [], // Логика активных квестов была другой, сейчас все в completedQuests
        completedQuests: metadata.completedQuests,
        unlockedPerks: metadata.unlockedPerks,
        achievements: metadata.completedQuests, // Предполагаем, что completedQuests это и есть ачивки
        cognitiveOSVersion: COGNITIVE_OS_VERSIONS[metadata.level] || COGNITIVE_OS_VERSIONS[0],
        lastActivityTimestamp: metadata.lastActiveDate, // Формат может отличаться, если ранее был полный timestamp
        dailyActivityLog: [], // Старая детальная логика логов убрана из новой структуры метаданных
        totalFilesExtracted: 0, // Эти поля отсутствуют, нужна адаптация или значения по умолчанию
        totalTokensProcessed: 0,
        totalKworkRequestsSent: 0,
        totalPrsCreated: 0,
        totalBranchesUpdated: 0,
        featuresUsed: {}, // Это поле также требует адаптации, если использовалось
    };
    logger.log(`[CyberFitness FetchProfileCompat] Successfully adapted new profile to old format for user ${userId}.`);
    return { success: true, data: adaptedProfile };
  } else {
     logger.info(`[CyberFitness FetchProfileCompat] No CyberFitnessDB profile for user ${userId}. Returning default.`);
     return { success: true, data: getDefaultCyberFitnessProfile() }; // Возвращаем дефолтный старый профиль
  }
};

interface SchematicCompletionDetails {
    prerequisites: string[];
    kiloVibesAward?: number;
    unlocksPerk?: string; // ID перка из нового списка PERKS_BY_LEVEL
    schematicName: string;
    schematicIcon: string;
}

export const logSchematicCompleted = async (
    userId: string,
    schematicId: string, // Это теперь ID ачивки
    details: SchematicCompletionDetails 
): Promise<{ 
    success: boolean; 
    error?: string; 
    alreadyCompleted?: boolean; 
    newAchievements?: Achievement[]; 
    newPerks?: string[]; // Массив ID новых перков
    kiloVibesAwarded?: number;
}> => {
    logger.log(`[CyberFitness SchematicCompleteCompat ENTRY] User_id: ${userId}, SchematicID (AchievementID): ${schematicId}`);
    
    // Используем новую функцию для разблокировки ачивки
    const result = await checkAndUnlockFeatureAchievement(userId, schematicId);
    
    if (!result.success) {
        return { success: false, error: result.error || "Ошибка при разблокировке ачивки-схемы." };
    }

    // Проверяем, была ли ачивка уже разблокирована до этого вызова
    // Это немного сложнее, т.к. checkAndUnlockFeatureAchievement не возвращает directly 'alreadyCompleted'
    // Но если newAchievements пуст, значит она уже была.
    const alreadyCompleted = !result.newAchievements || result.newAchievements.length === 0;
    if (alreadyCompleted) {
         logger.info(`[CyberFitness SchematicCompleteCompat] Schematic/Achievement ${schematicId} already completed by user ${userId}.`);
    }
    
    // Логика перков, если они определены в details (хотя лучше это делать через ALL_ACHIEVEMENTS)
    let newPerksUnlocked: string[] = [];
    if (details.unlocksPerk) {
        // Тут нужно обновить профиль, чтобы добавить перк, если он не был добавлен через ачивку
        // Это усложняет, так как updateUserCyberFitnessProfile может быть вызван дважды
        // Идеально, если `unlocksPerks` будет частью определения ачивки в ALL_ACHIEVEMENTS
        // Пока пропустим прямое добавление перка здесь, полагаясь на систему ачивок.
        logger.warn(`[CyberFitness SchematicCompleteCompat] 'unlocksPerk' в details является устаревшим. Перки должны открываться через ALL_ACHIEVEMENTS.`);
    }


    return { 
        success: true, 
        alreadyCompleted,
        newAchievements: result.newAchievements,
        newPerks: newPerksUnlocked, 
        kiloVibesAwarded: result.newAchievements?.find(a => a.id === schematicId)?.kiloVibesAward || 0
    };
};

export const markTutorialAsCompleted = async (
  userId: string,
  tutorialQuestId: string // Это ID ачивки
): Promise<{ success: boolean; error?: string; newAchievements?: Achievement[], kiloVibesAwarded?: number }> => {
  logger.log(`[CyberFitness MarkTutorialCompat ENTRY] User_id: ${userId}, TutorialQuestID (AchievementID): ${tutorialQuestId}`);
  
  const result = await checkAndUnlockFeatureAchievement(userId, tutorialQuestId);

  if (!result.success) {
    return { success: false, error: result.error || "Ошибка при завершении туториала." };
  }
  
  return { 
    success: true, 
    newAchievements: result.newAchievements,
    kiloVibesAwarded: result.newAchievements?.find(a => a.id === tutorialQuestId)?.kiloVibesAward || 0
  };
};

export const isQuestUnlocked = (questId: string, completedQuests: string[] | undefined, questOrder: string[]): boolean => {
  const questIndex = questOrder.indexOf(questId);
  if (questIndex === -1) {
    logger.warn(`[isQuestUnlockedCompat] Quest ID "${questId}" not found in QUEST_ORDER. Assuming locked.`);
    return false; 
  }
  if (questIndex === 0) return true; 

  const previousQuestId = questOrder[questIndex - 1];
  const isUnlocked = !!completedQuests?.includes(previousQuestId);
  return isUnlocked;
};

export const setCognitiveOSVersion = async (userId: string, version: string): Promise<{ success: boolean; data?: UserCyberFitnessProfileDB; error?: string; newAchievements?: Achievement[] }> => {
  // Эта функция становится менее актуальной, т.к. OS версия теперь вычисляется по уровню.
  // Можно либо оставить ее для прямого переопределения (не рекомендуется), либо удалить.
  // Пока оставим как заглушку, возвращающую успех.
  logger.warn(`[CyberFitness setCognitiveOSVersionCompat] Вызвана устаревшая функция. Версия ОС теперь зависит от уровня.`);
  const {data: profile, error} = await getCyberFitnessProfileData(userId);
  return { success: !error, data: profile, error: error?.message, newAchievements: [] };
};

export const getUserCyberLevel = async (userId: string): Promise<{ success: boolean; level?: number; error?: string }> => {
   const { data: profile, error } = await getCyberFitnessProfileData(userId);
   if (error || !profile || !profile.metadata) {
     return { success: false, level: 0, error: error?.message || "Profile not found or metadata missing" };
   }
   const metadata = profile.metadata as unknown as CyberFitnessMetadata;
   return { success: true, level: metadata.level };
};

export const getAchievementDetails = (achievementId: string): Achievement | undefined => {
    if (!achievementId) return undefined;
    let achievement = ALL_ACHIEVEMENTS.find(ach => ach.id === achievementId);
    
    // Логика для динамических ачивок из старой системы (если нужна)
    if (!achievement) {
        if (achievementId.startsWith("level_up_")) {
            const levelMatch = achievementId.match(/^level_up_(\d+)$/);
            if (levelMatch && levelMatch[1]) {
                const level = parseInt(levelMatch[1], 10);
                return {
                    id: achievementId, name: `Достигнут Уровень ${level}!`,
                    description: `Вы достигли ${level}-го уровня КиберФитнеса. Новые перки и возможности открыты.`,
                    icon: 'FaStar', kiloVibesAward: 25 * level, category: "GENERAL_PROGRESS", isDynamic: true,
                };
            }
        }
        if (achievementId.startsWith("mastered_schematic_")) {
            const schematicNamePartFromId = achievementId.substring("mastered_schematic_".length).replace(/_/g, ' ');
            return {
                id: achievementId, name: `Схема '${schematicNamePartFromId}' Освоена!`, 
                description: `Вы успешно применили и освоили схему '${schematicNamePartFromId}'.`,
                icon: 'FaTasks', kiloVibesAward: Math.round((50) * 0.2) + 5, // Примерное значение
                category: "TUTORIALS", isDynamic: true,
            };
        }
    }
    if (!achievement) {
      logger.warn(`[CyberFitness getAchievementDetailsCompat] Achievement ID "${achievementId}" not found.`);
    }
    return achievement;
};

export const TOKEN_ESTIMATION_FACTOR = 4; // Остается как есть, если где-то используется