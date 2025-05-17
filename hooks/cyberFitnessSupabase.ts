// /hooks/cyberFitnessSupabase.ts
import { supabaseAdmin } from './supabase';
import { debugLogger as logger } from '@/lib/debugLogger';
import type { UserProfile } from '@/contexts/AppContext';
import type * as Fa6Icons from 'react-icons/fa6'; // Import Fa6Icons type

export const TOKEN_ESTIMATION_FACTOR = 4; // Chars per token

export interface Perk {
  id: string;
  name: string;
  description: string;
  levelRequired: number;
}

export const PERKS_BY_LEVEL: Record<number, Perk[]> = {
  0: [ { id: "perk_auto_pr_image_swap", name: "Авто-PR для Замены Изображений", description: "Система автоматически создает PR при замене изображений.", levelRequired: 0 } ],
  1: [ { id: "perk_basic_file_fetch", name: "Базовый Захват Файлов", description: "Возможность извлекать файлы из репозитория.", levelRequired: 1 }, { id: "perk_single_file_context", name: "Понимание Контекста Одного Файла", description: "AI может работать с контекстом одного файла.", levelRequired: 1 }, { id: "perk_simple_idea_processing", name: "Обработка Простых Идей (1 файл)", description: "AI обрабатывает простые текстовые идеи, затрагивающие один файл.", levelRequired: 1 } ],
  2: [ { id: "perk_multi_file_context", name: "Многофайловый Контекст (до 5 файлов)", description: "AI может работать с контекстом до 5 файлов одновременно.", levelRequired: 2 }, { id: "perk_ai_response_parsing", name: "Парсинг Ответа AI", description: "Система разбирает ответ AI, выделяя код и файлы.", levelRequired: 2 } ],
  3: [ { id: "perk_pr_creation_new_branch", name: "Создание PR (Новая Ветка)", description: "Возможность создавать PR в новой ветке.", levelRequired: 3 }, { id: "perk_existing_branch_update", name: "Обновление Существующей Ветки", description: "Возможность обновлять существующую ветку в PR.", levelRequired: 3 }, { id: "perk_error_log_analysis", name: "Анализ Логов Ошибок (ErrorFix Flow)", description: "AI помогает анализировать логи ошибок сборки/выполнения.", levelRequired: 3 } ],
  4: [ { id: "perk_proactive_vercel_log_check", name: "Проактивная Проверка Логов Vercel", description: "Рекомендуется проверять логи Vercel для раннего обнаружения проблем.", levelRequired: 4 }, { id: "perk_fontawesome_icon_search", name: "Самостоятельный Поиск Иконок FontAwesome", description: "Возможность самостоятельно находить и интегрировать иконки FontAwesome.", levelRequired: 4 }, { id: "perk_assistant_quick_links", name: "Быстрые Ссылки АссистенTA", description: "Добавление и использование пользовательских быстрых ссылок в Ассистенте.", levelRequired: 4 } ],
  5: [ { id: "perk_image_tools_prompts_imgs", name: "Инструменты для Изображений (prompts_imgs.txt)", description: "Использование файла prompts_imgs.txt для управления изображениями и связанными промптами.", levelRequired: 5 }, { id: "perk_advanced_ai_debugging", name: "Продвинутый Дебаггинг с AI", description: "Использование AI для более глубокого анализа и исправления ошибок.", levelRequired: 5 }, { id: "perk_simple_code_auto_fix", name: "Авто-фикс простых ошибок кода", description: "AI может предлагать автоматические исправления для некоторых типов ошибок.", levelRequired: 5 } ],
  6: [ { id: "perk_data_handling_supabase_sql", name: "Работа с Данными (SQL в Supabase UI)", description: "Возможность генерировать SQL и применять его через UI Supabase.", levelRequired: 6 }, { id: "perk_full_file_tree_context", name: "Добавление Полного Дерева Файлов в Контекст", description: "Возможность добавить структуру всего проекта в контекст AI.", levelRequired: 6 } ],
  7: [ { id: "perk_supervibe_studio_access", name: "Доступ к СуперВайб Студии", description: "Полный доступ ко всем инструментам СуперВайб Студии.", levelRequired: 7 } ], 
  8: [ { id: "perk_advanced_ai_refactoring", name: "Продвинутый Рефакторинг с AI", description: "Использование AI для сложных задач рефакторинга кода.", levelRequired: 8 } ],
  9: [ { id: "perk_custom_ai_instructions_basic", name: "Кастомные Инструкции для AI (Базовый)", description: "Возможность задавать собственные системные промпты или инструкции для AI.", levelRequired: 9 } ],
  10: [ { id: "perk_deploy_own_cybervibe_guide", name: "Гайд по Развертыванию Собственного CyberVibe", description: "Доступ к документации и инструкциям по настройке и развертыванию собственного экземпляра CyberVibe.", levelRequired: 10 }, { id: "perk_bot_token_management_placeholder", name: "Управление Токенами Ботов (Заглушка)", description: "Интерфейс или инструкции для управления токенами API для ботов (например, Telegram).", levelRequired: 10 }, { id: "perk_xtr_automation_docs", name: "Документация по Созданию Собственных XTR Автоматизаций", description: "Доступ к гайдам по созданию пользовательских XTR-автоматизаций.", levelRequired: 10 }, ],
};

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Fa6Icons | string; 
  kiloVibesAward?: number;
  checkCondition: (profile: UserProfile, value?: any) | (() => boolean); 
  isQuest?: boolean;
  unlocksPerks?: Perk[] | string[]; 
}

export const QUEST_IDS = {
    INITIAL_BOOT: "initial_boot_sequence",
    FIRST_FETCH: "first_fetch_completed",
    FIRST_PARSE: "first_parse_completed",
    FIRST_PR: "first_pr_created",
    IMAGE_SWAP_MISSION: "image-swap-mission", 
    ICON_SWAP_MISSION: "icon-swap-mission", 
};

export const ALL_ACHIEVEMENTS: Achievement[] = [
    { id: QUEST_IDS.INITIAL_BOOT, name: "Квест: Пойман Сигнал!", description: "Успешно инициирован рабочий флоу. +25 KiloVibes", icon: "FaBolt", checkCondition: () => false, isQuest: true, kiloVibesAward: 25, unlocksPerks: ["Доступ к СуперВайб Студии"] },
    { id: QUEST_IDS.FIRST_FETCH, name: "Квест: Первая Загрузка", description: "Успешно загружены файлы. +75 KiloVibes", icon: "FaDownload", checkCondition: () => false, isQuest: true, kiloVibesAward: 75, unlocksPerks: PERKS_BY_LEVEL[1] },
    { id: QUEST_IDS.FIRST_PARSE, name: "Квест: Первый Парсинг", description: "Успешно разобран ответ от AI. +150 KiloVibes", icon: "FaCode", checkCondition: () => false, isQuest: true, kiloVibesAward: 150, unlocksPerks: PERKS_BY_LEVEL[2] },
    { id: QUEST_IDS.FIRST_PR, name: "Квест: Первый PR", description: "Успешно создан Pull Request. +250 KiloVibes", icon: "FaGithub", checkCondition: () => false, isQuest: true, kiloVibesAward: 250, unlocksPerks: PERKS_BY_LEVEL[3] },
    { id: QUEST_IDS.IMAGE_SWAP_MISSION, name: "Квест: Замена Картинок", description: "Заверши миссию по замене картинки. +100 KiloVibes", icon: "FaImages", checkCondition: () => false, isQuest: true, kiloVibesAward: 100 },
    { id: QUEST_IDS.ICON_SWAP_MISSION, name: "Квест: Охота за Иконками", description: "Заверши миссию по замене иконки. +120 KiloVibes", icon: "FaIcons", checkCondition: () => false, isQuest: true, kiloVibesAward: 120 },
    { id: "first_blood", name: "Первая Кровь", description: "Первое успешное действие в системе. +10 KiloVibes", icon: "FaPooStorm", kiloVibesAward: 10, checkCondition: (profile) => profile.cyberFitness.totalKworkRequestsSent === 1 },
    { id: "settings_opened", name: "Конфигуратор", description: "Заглянул в настройки. +5 KV", icon: "FaToolbox", kiloVibesAward: 5, checkCondition: (profile) => profile.cyberFitness.featuresUsed?.settings_opened === true },
    { id: "copy_logs_used", name: "Логгерхед", description: "Скопировал логи. +5 KV", icon: "FaClipboardList", kiloVibesAward: 5, checkCondition: (profile) => profile.cyberFitness.featuresUsed?.copy_logs_used === true },
    { id: "sticky_chat_opened", name: "Социальный Инженер", description: "Открыл Sticky Chat. +5 KV", icon: "FaCommentDots", kiloVibesAward: 5, checkCondition: (profile) => profile.cyberFitness.featuresUsed?.sticky_chat_opened === true },
    { id: "system_prompt_copied", name: "Промпт-Мастер", description: "Скопировал системный промпт. +10 KV", icon: "FaMagic", kiloVibesAward: 10, checkCondition: (profile) => profile.cyberFitness.featuresUsed?.system_prompt_copied === true },
    { id: "used_select_highlighted", name: "Контекстный Маг", description: "Использовал выбор связанных файлов. +15 KV", icon: "FaHighlighter", kiloVibesAward: 15, checkCondition: (profile) => profile.cyberFitness.featuresUsed?.usedSelectHighlighted === true },
    { id: "used_add_full_tree", name: "Архитектор Всего", description: "Добавил полное дерево файлов в запрос. +20 KV", icon: "FaTree", kiloVibesAward: 20, checkCondition: (profile) => profile.cyberFitness.featuresUsed?.usedAddFullTree === true },
    { id: "kwork_cleared", name: "Чистильщик", description: "Очистил поле запроса. +2 KV", icon: "FaBroom", kiloVibesAward: 2, checkCondition: (profile) => profile.cyberFitness.featuresUsed?.kwork_cleared === true },
    { id: "image_modal_opened", name: "Визуализатор", description: "Открыл модалку с картинками. +5 KV", icon: "FaImages", kiloVibesAward: 5, checkCondition: (profile) => profile.cyberFitness.featuresUsed?.image_modal_opened === true },
    { id: "scrolled_like_a_maniac", name: "Скролл-Коммандо", description: "Ты скроллишь как одержимый! +1 KV", icon: "FaAngleDoubleDown", kiloVibesAward: 1, checkCondition: (profile) => profile.cyberFitness.featuresUsed?.scrolled_like_a_maniac === true },
    { id: "request_maestro_1", name: "Маэстро Запросов I", description: "10 запросов к AI. +25 KV", icon: "FaPaperPlane", kiloVibesAward: 25, checkCondition: (profile) => profile.cyberFitness.totalKworkRequestsSent >= 10 },
    { id: "request_maestro_2", name: "Маэстро Запросов II", description: "50 запросов к AI. +100 KV", icon: "FaRocket", kiloVibesAward: 100, checkCondition: (profile) => profile.cyberFitness.totalKworkRequestsSent >= 50 },
    { id: "data_miner_1", name: "Добытчик Данных I", description: "100 файлов извлечено. +20 KV", icon: "FaDatabase", kiloVibesAward: 20, checkCondition: (profile) => profile.cyberFitness.totalFilesExtracted >= 100 },
    { id: "data_miner_2", name: "Добытчик Данных II", description: "500 файлов извлечено. +80 KV", icon: "FaServer", kiloVibesAward: 80, checkCondition: (profile) => profile.cyberFitness.totalFilesExtracted >= 500 },
    { id: "token_economist_1", name: "Токен-Экономист I", description: "100k токенов обработано. +30 KV", icon: "FaCoins", kiloVibesAward: 30, checkCondition: (profile) => profile.cyberFitness.totalTokensProcessed >= 100000 },
    { id: "token_economist_2", name: "Токен-Экономист II", description: "1M токенов обработано. +150 KV", icon: "FaLandMineOn", kiloVibesAward: 150, checkCondition: (profile) => profile.cyberFitness.totalTokensProcessed >= 1000000 },
    { id: "commit_crafter_1", name: "Коммит-Крафтер I", description: "5 PR создано. +50 KV", icon: "FaCodeCommit", kiloVibesAward: 50, checkCondition: (profile) => profile.cyberFitness.totalPrsCreated >= 5 },
    { id: "commit_crafter_2", name: "Коммит-Крафтер II", description: "25 PR создано. +200 KV", icon: "FaCodeBranch", kiloVibesAward: 200, checkCondition: (profile) => profile.cyberFitness.totalPrsCreated >= 25 },
    ...Array.from({ length: 15 }, (_, i) => i + 1).map(level => ({
        id: `level_up_${level}`,
        name: `Уровень ${level} Достигнут!`,
        description: `Ты достиг ${level}-го уровня мастерства! +${level * 10} KV.`,
        icon: 'FaAward' as keyof typeof Fa6Icons,
        kiloVibesAward: level * 10,
        checkCondition: (profile: UserProfile) => profile.cyberFitness.level >= level,
    })),
];

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  logger.log(`[CyberFitness FetchProfile ENTRY] Attempting to fetch profile for user_id: ${userId}`);
  if (!supabaseAdmin) {
    logger.error("[CyberFitness FetchProfile] Supabase admin client is not initialized.");
    return null;
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('user_id, email, app_specific_metadata, metadata, onboarded, language_code, telegram_user_id, telegram_first_name, telegram_last_name, telegram_username, telegram_photourl, created_at, updated_at')
      .eq('user_id', userId)
      .single();

    if (error) {
      logger.error(`[CyberFitness FetchProfile] Error fetching profile for ${userId}:`, error);
      return null;
    }
    if (!data) {
      logger.warn(`[CyberFitness FetchProfile] No profile found for ${userId}.`);
      return null;
    }
    
    const cf = data.metadata?.cyberFitness || {};
    const metadata = {
        ...(data.metadata || {}),
        cyberFitness: {
            level: cf.level ?? 0,
            kiloVibes: cf.kiloVibes ?? 0,
            focusTimeHours: cf.focusTimeHours ?? 0,
            skillsLeveled: cf.skillsLeveled ?? 0, 
            activeQuests: Array.isArray(cf.activeQuests) ? cf.activeQuests : [],
            completedQuests: Array.isArray(cf.completedQuests) ? cf.completedQuests : [],
            unlockedPerks: Array.isArray(cf.unlockedPerks) ? cf.unlockedPerks : [],
            cognitiveOSVersion: cf.cognitiveOSVersion ?? "v0.1 Node",
            lastActivityTimestamp: cf.lastActivityTimestamp ?? new Date().toISOString(),
            dailyActivityLog: Array.isArray(cf.dailyActivityLog) ? cf.dailyActivityLog : [],
            achievements: Array.isArray(cf.achievements) ? cf.achievements : [],
            totalFilesExtracted: cf.totalFilesExtracted ?? 0,
            totalTokensProcessed: cf.totalTokensProcessed ?? 0,
            totalKworkRequestsSent: cf.totalKworkRequestsSent ?? 0,
            totalPrsCreated: cf.totalPrsCreated ?? 0,
            totalBranchesUpdated: cf.totalBranchesUpdated ?? 0,
            featuresUsed: cf.featuresUsed || {},
        }
    };
    
    const userProfile: UserProfile = {
        ...data,
        id: data.user_id, 
        email: data.email ?? undefined,
        app_specific_metadata: data.app_specific_metadata ?? undefined,
        metadata,
        language_code: data.language_code ?? undefined,
        telegram_user_id: data.telegram_user_id ?? undefined,
        telegram_first_name: data.telegram_first_name ?? undefined,
        telegram_last_name: data.telegram_last_name ?? undefined,
        telegram_username: data.telegram_username ?? undefined,
        telegram_photourl: data.telegram_photourl ?? undefined,
    };
    logger.log(`[CyberFitness FetchProfile EXIT] Successfully parsed CyberFitness profile for user ${userId}. Level: ${userProfile.metadata.cyberFitness.level}, KiloVibes: ${userProfile.metadata.cyberFitness.kiloVibes}`);
    return userProfile;

  } catch (e) {
    logger.error(`[CyberFitness FetchProfile] Exception for user ${userId}:`, e);
    return null;
  }
}

async function updateUserCyberFitnessProfile(userId: string, updates: Partial<UserProfile['metadata']['cyberFitness']>, newAchievements: string[] = []): Promise<{success: boolean, error?: string, data?: UserProfile['metadata']['cyberFitness']}> {
  logger.log(`[CyberFitness UpdateProfile ENTRY] User_id: ${userId}, Updates Summary:`, { keys: Object.keys(updates), featuresUsedUpdates: updates.featuresUsed ? Object.keys(updates.featuresUsed) : [] });
  if (!supabaseAdmin) { logger.error("[CyberFitness UpdateProfile] Supabase admin client not initialized."); return { success: false, error: "Supabase client not init."}; }

  try {
    const currentProfile = await fetchUserProfile(userId);
    if (!currentProfile) { return { success: false, error: "User profile not found for update." }; }
    
    logger.debug(`[CyberFitness UpdateProfile] Profile for ${userId} BEFORE this update cycle: Level=${currentProfile.metadata.cyberFitness.level}, KV=${currentProfile.metadata.cyberFitness.kiloVibes}, Ach=${currentProfile.metadata.cyberFitness.achievements.length}, Perks=${currentProfile.metadata.cyberFitness.unlockedPerks.length}, CompletedQuests=${currentProfile.metadata.cyberFitness.completedQuests.length}`);

    const newCyberFitnessData = { ...currentProfile.metadata.cyberFitness };

    for (const key in updates) {
        if (key === 'featuresUsed' && typeof updates.featuresUsed === 'object' && updates.featuresUsed !== null) {
            newCyberFitnessData.featuresUsed = { ...newCyberFitnessData.featuresUsed, ...updates.featuresUsed };
        } else if (key !== 'achievements' && key !== 'completedQuests' && key !== 'unlockedPerks') {
             (newCyberFitnessData as any)[key] = (updates as any)[key];
        }
    }

    if (newAchievements.length > 0) {
        const updatedAchievements = Array.from(new Set([...newCyberFitnessData.achievements, ...newAchievements]));
        newCyberFitnessData.achievements = updatedAchievements;
    }
    
    const today = new Date().toISOString().split('T')[0];
    let todayLog = newCyberFitnessData.dailyActivityLog.find(d => d.date === today);
    if (updates.dailyActivityLog && updates.dailyActivityLog.length > 0) { 
        const incomingTodayLog = updates.dailyActivityLog.find(d => d.date === today);
        if (incomingTodayLog) {
            if (todayLog) { 
                todayLog = { ...todayLog, ...incomingTodayLog };
            } else { 
                todayLog = incomingTodayLog;
                newCyberFitnessData.dailyActivityLog.push(todayLog);
            }
             newCyberFitnessData.dailyActivityLog = newCyberFitnessData.dailyActivityLog.map(d => d.date === today ? todayLog! : d);
        }
    }
    newCyberFitnessData.lastActivityTimestamp = new Date().toISOString();

    const oldLevel = newCyberFitnessData.level;
    const XP_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000, 17000, 23000, 30000, 38000, 47000, 57000]; 
    let newLevel = 0;
    for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
      if (newCyberFitnessData.kiloVibes >= XP_THRESHOLDS[i]) {
        newLevel = i;
        break;
      }
    }
    newCyberFitnessData.level = newLevel;

    if (newLevel > oldLevel) {
      logger.info(`[CyberFitness UpdateProfile] User ${userId} leveled up from ${oldLevel} to ${newLevel}! Awarding perks.`);
      newCyberFitnessData.cognitiveOSVersion = `v1.${newLevel} Node`; 
      
      const newlyUnlockedPerks: string[] = [];
      for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
          if (PERKS_BY_LEVEL[lvl]) {
              PERKS_BY_LEVEL[lvl].forEach(perk => {
                  if (!newCyberFitnessData.unlockedPerks.includes(perk.name)) { 
                      newlyUnlockedPerks.push(perk.name);
                  }
              });
          }
      }
      if (newlyUnlockedPerks.length > 0) {
          newCyberFitnessData.unlockedPerks = Array.from(new Set([...newCyberFitnessData.unlockedPerks, ...newlyUnlockedPerks]));
          logger.info(`[CyberFitness UpdateProfile] Unlocked perks for level ${newLevel}: ${newlyUnlockedPerks.join(', ')}`);
      }
      const levelUpAchId = `level_up_${newLevel}`;
      if (!newCyberFitnessData.achievements.includes(levelUpAchId)) {
          const levelUpAch = ALL_ACHIEVEMENTS.find(a => a.id === levelUpAchId);
          if (levelUpAch && typeof levelUpAch.kiloVibesAward === 'number') {
              newCyberFitnessData.achievements.push(levelUpAchId);
              logger.info(`[CyberFitness UpdateProfile] Awarded level up achievement: ${levelUpAch.name} (+${levelUpAch.kiloVibesAward} KV).`);
          }
      }
    }
    
    const finalMetadata = { ...currentProfile.metadata, cyberFitness: newCyberFitnessData };

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ metadata: finalMetadata, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (updateError) {
      logger.error(`[CyberFitness UpdateProfile] Error updating profile for ${userId}:`, updateError);
      return { success: false, error: updateError.message };
    }

    logger.log(`[CyberFitness UpdateProfile EXIT] Successfully updated profile for ${userId}. New KV: ${newCyberFitnessData.kiloVibes}, Lvl: ${newCyberFitnessData.level}, OS: ${newCyberFitnessData.cognitiveOSVersion}, CompletedQuests: ${newCyberFitnessData.completedQuests.join(', ')}`);
    return { success: true, data: newCyberFitnessData };

  } catch (e: any) {
    logger.error(`[CyberFitness UpdateProfile] Exception for user ${userId}:`, e);
    return { success: false, error: e.message };
  }
}

type ActionType = 'filesExtracted' | 'tokensProcessed' | 'kworkRequestSent' | 'prCreated' | 'branchUpdated' | 'focusTimeLogged';
interface LogActionResult {
  success: boolean;
  error?: string;
  newKiloVibes?: number;
  newLevel?: number;
  newAchievements?: Achievement[];
}

export async function logCyberFitnessAction(
  userId: string,
  action: ActionType,
  value: number = 1 
): Promise<LogActionResult> {
  logger.log(`[CyberFitness LogAction ENTRY] User_id: ${userId}, Action: ${action}, Value: ${value}`);
  
  const profile = await fetchUserProfile(userId);
  if (!profile) return { success: false, error: "User profile not found for logging action." };

  const updates: Partial<UserProfile['metadata']['cyberFitness']> = { featuresUsed: { ...profile.metadata.cyberFitness.featuresUsed } };
  let kvAward = 0;
  const today = new Date().toISOString().split('T')[0];
  let dailyLogEntry = profile.metadata.cyberFitness.dailyActivityLog.find(d => d.date === today) || 
                      { date: today, filesExtracted: 0, tokensProcessed: 0, kworkRequestsSent: 0, prsCreated: 0, branchesUpdated: 0, focusTimeMinutes: 0 };
  
  const initialAchievements = new Set(profile.metadata.cyberFitness.achievements);

  switch (action) {
    case 'filesExtracted':
      updates.totalFilesExtracted = (profile.metadata.cyberFitness.totalFilesExtracted || 0) + value;
      dailyLogEntry.filesExtracted = (dailyLogEntry.filesExtracted || 0) + value;
      kvAward = value * 0.1; 
      if (value >= 20 && !profile.metadata.cyberFitness.featuresUsed?.added20PlusFilesToKworkOnce) { (updates.featuresUsed as any).added20PlusFilesToKworkOnce = true; kvAward += 10; }
      else if (value >= 10 && !profile.metadata.cyberFitness.featuresUsed?.added10PlusFilesToKworkOnce) { (updates.featuresUsed as any).added10PlusFilesToKworkOnce = true; kvAward += 5; }
      break;
    case 'tokensProcessed':
      updates.totalTokensProcessed = (profile.metadata.cyberFitness.totalTokensProcessed || 0) + value;
      dailyLogEntry.tokensProcessed = (dailyLogEntry.tokensProcessed || 0) + value;
      kvAward = value * 0.001; 
      break;
    case 'kworkRequestSent':
      updates.totalKworkRequestsSent = (profile.metadata.cyberFitness.totalKworkRequestsSent || 0) + value;
      dailyLogEntry.kworkRequestsSent = (dailyLogEntry.kworkRequestsSent || 0) + value;
      kvAward = value * 2; 
      break;
    case 'prCreated':
      updates.totalPrsCreated = (profile.metadata.cyberFitness.totalPrsCreated || 0) + value;
      dailyLogEntry.prsCreated = (dailyLogEntry.prsCreated || 0) + value;
      kvAward = value * 25; 
      break;
    case 'branchUpdated':
      updates.totalBranchesUpdated = (profile.metadata.cyberFitness.totalBranchesUpdated || 0) + value;
      dailyLogEntry.branchesUpdated = (dailyLogEntry.branchesUpdated || 0) + value;
      kvAward = value * 5; 
      break;
    case 'focusTimeLogged': 
        updates.focusTimeHours = (profile.metadata.cyberFitness.focusTimeHours || 0) + (value / 60);
        dailyLogEntry.focusTimeMinutes = (dailyLogEntry.focusTimeMinutes || 0) + value;
        kvAward = (value / 60) * 10; 
        if (!profile.metadata.cyberFitness.featuresUsed?.deep_work_logged && value >= 60) { 
             (updates.featuresUsed as any).deep_work_logged = true; kvAward += 50;
        }
        break;
  }
  
  updates.kiloVibes = (profile.metadata.cyberFitness.kiloVibes || 0) + kvAward;
  updates.kiloVibes = parseFloat(updates.kiloVibes.toFixed(4)); 
  
  const existingDailyLogIndex = profile.metadata.cyberFitness.dailyActivityLog.findIndex(d => d.date === today);
  if (existingDailyLogIndex !== -1) {
      updates.dailyActivityLog = [...profile.metadata.cyberFitness.dailyActivityLog];
      updates.dailyActivityLog[existingDailyLogIndex] = dailyLogEntry;
  } else {
      updates.dailyActivityLog = [...profile.metadata.cyberFitness.dailyActivityLog, dailyLogEntry];
  }

  const tempUpdatedProfileForCheck: UserProfile = {
      ...profile,
      metadata: {
          ...profile.metadata,
          cyberFitness: {
              ...profile.metadata.cyberFitness,
              ...updates, 
          }
      }
  };
  
  const awardedAchievements: Achievement[] = [];
  ALL_ACHIEVEMENTS.forEach(ach => {
    if (!ach.isQuest && !initialAchievements.has(ach.id) && ach.checkCondition(tempUpdatedProfileForCheck, value)) {
      if (ach.kiloVibesAward) {
        updates.kiloVibes = (updates.kiloVibes || 0) + ach.kiloVibesAward;
      }
      awardedAchievements.push(ach);
    }
  });
  
  if (awardedAchievements.length > 0) {
    logger.info(`[CyberFitness LogAction] User ${userId} unlocked new achievements: ${awardedAchievements.map(a=>a.name).join(', ')}`);
  }
  
  const updateResult = await updateUserCyberFitnessProfile(userId, updates, awardedAchievements.map(a => a.id));

  if (!updateResult.success || !updateResult.data) {
    return { success: false, error: updateResult.error || "Failed to update profile after logging action." };
  }
  
  logger.log(`[CyberFitness LogAction EXIT] Action '${action}' logged for ${userId}. Final KV: ${updateResult.data.kiloVibes}. New ach: ${awardedAchievements.length}`);
  return { 
    success: true, 
    newKiloVibes: updateResult.data.kiloVibes, 
    newLevel: updateResult.data.level,
    newAchievements: awardedAchievements
  };
}

export async function checkAndUnlockFeatureAchievement(
  userId: string,
  featureKey: keyof UserProfile['metadata']['cyberFitness']['featuresUsed'],
  value: any = true 
): Promise<{success: boolean, error?: string, newAchievements?: Achievement[]}> {
  logger.log(`[CyberFitness CheckFeatureAchievement ENTRY] User_id: ${userId}, Feature: ${featureKey}, Value: ${value}`);
  const profile = await fetchUserProfile(userId);
  if (!profile) { return { success: false, error: "User profile not found for feature achievement check." }; }

  const featureUsedUpdate = { ...profile.metadata.cyberFitness.featuresUsed, [featureKey]: value };
  const updates: Partial<UserProfile['metadata']['cyberFitness']> = { featuresUsed: featureUsedUpdate };
  let kvChange = 0;
  const awardedAchievements: Achievement[] = [];

  ALL_ACHIEVEMENTS.forEach(ach => {
      const isNewlyUnlocked = !profile.metadata.cyberFitness.achievements.includes(ach.id);
      const tempProfileForCheck: UserProfile = {...profile, metadata: {...profile.metadata, cyberFitness: {...profile.metadata.cyberFitness, featuresUsed: featureUsedUpdate }}};

      if (!ach.isQuest && isNewlyUnlocked && ach.checkCondition(tempProfileForCheck, value)) {
          const achievement = ALL_ACHIEVEMENTS.find(a => a.id === ach.id);
          if (achievement) { 
              if (achievement.kiloVibesAward) {
                  kvChange += achievement.kiloVibesAward;
              }
              awardedAchievements.push(achievement);
              logger.info(`[CyberFitness CheckFeatureAchievement] User ${userId} unlocked new achievement from feature ${String(featureKey)}: ${achievement.name}`);
          } else {
              logger.warn(`[CyberFitness CheckFeatureAchievement] Achievement with ID '${ach.id}' not found in ALL_ACHIEVEMENTS. Skipping.`);
          }
      }
  });
  
  if (kvChange > 0) {
      updates.kiloVibes = (profile.metadata.cyberFitness.kiloVibes || 0) + kvChange;
  }
  const alreadySet = profile.metadata.cyberFitness.featuresUsed && profile.metadata.cyberFitness.featuresUsed[featureKey] === value;
  
  if (alreadySet && awardedAchievements.length === 0) {
       logger.debug(`[CyberFitness LogAction] Feature '${String(featureKey)}' was already set to ${value} for user ${userId}. No change to featuresUsed, KV unchanged for this action.`);
       return { success: true, newAchievements: [] }; 
  }

  const updateResult = await updateUserCyberFitnessProfile(userId, updates, awardedAchievements.map(a => a.id));

  if (!updateResult.success) {
    return { success: false, error: updateResult.error || "Failed to update profile after feature achievement check." };
  }
  logger.log(`[CyberFitness CheckFeatureAchievement EXIT] Logged feature '${String(featureKey)}'. New ach: ${awardedAchievements.length}`);
  return { success: true, newAchievements: awardedAchievements };
}

export async function completeQuestAndUpdateProfile(
  userId: string,
  questId: string,
  kiloVibesAward: number, 
  levelToPotentiallyUnlock?: number, 
  perksToAward?: Perk[] | string[] 
): Promise<{success: boolean, error?: string, data?: UserProfile['metadata'], newAchievements?: Achievement[]}> {
  logger.log(`[CyberFitness CompleteQuest ENTRY] User_id: ${userId}, QuestId: ${questId}`);
  const profile = await fetchUserProfile(userId);
  if (!profile) { return { success: false, error: "User profile not found for quest completion." }; }

  const quest = ALL_ACHIEVEMENTS.find(q => q.id === questId && q.isQuest);
  if (!quest) {
    logger.warn(`[CyberFitness CompleteQuest] Quest with ID '${questId}' not found or is not a quest in ALL_ACHIEVEMENTS. Aborting.`);
    return { success: false, error: `Quest ${questId} not found.`, newAchievements: [] };
  }
  
  if (profile.metadata.cyberFitness.completedQuests.includes(questId)) {
    logger.info(`[CyberFitness CompleteQuest] Quest '${questId}' already completed by user ${userId}. No changes made.`);
    return { success: true, data: profile.metadata, newAchievements: [] }; 
  }

  const updates: Partial<UserProfile['metadata']['cyberFitness']> = {
    kiloVibes: (profile.metadata.cyberFitness.kiloVibes || 0) + (quest.kiloVibesAward || kiloVibesAward || 0),
    completedQuests: Array.from(new Set([...profile.metadata.cyberFitness.completedQuests, questId])),
    activeQuests: profile.metadata.cyberFitness.activeQuests.filter(aqId => aqId !== questId),
    unlockedPerks: [...profile.metadata.cyberFitness.unlockedPerks],
  };

  const questPerkNames: string[] = [];
  if (quest.unlocksPerks) {
    quest.unlocksPerks.forEach(perkOrId => {
        const perkName = typeof perkOrId === 'string' ? perkOrId : perkOrId.name;
        if (!updates.unlockedPerks?.includes(perkName)) {
            questPerkNames.push(perkName);
        }
    });
  }
  if (perksToAward) {
      perksToAward.forEach(perkOrId => {
          const perkName = typeof perkOrId === 'string' ? perkOrId : perkOrId.name;
          if (!updates.unlockedPerks?.includes(perkName) && !questPerkNames.includes(perkName)) {
              questPerkNames.push(perkName);
          }
      });
  }

  if (questPerkNames.length > 0) {
      updates.unlockedPerks = Array.from(new Set([...updates.unlockedPerks!, ...questPerkNames]));
      logger.info(`[CyberFitness CompleteQuest] Unlocked perks from quest ${questId}: ${questPerkNames.join(', ')}`);
  }
  
  if (levelToPotentiallyUnlock !== undefined && profile.metadata.cyberFitness.level < levelToPotentiallyUnlock) {
      updates.level = levelToPotentiallyUnlock;
  }
  
  const updateResult = await updateUserCyberFitnessProfile(userId, updates, [questId]);

  if (!updateResult.success) {
    return { success: false, error: updateResult.error || "Failed to update profile after quest completion.", newAchievements: [] };
  }
  logger.log(`[CyberFitness CompleteQuest EXIT] Quest '${questId}' completed for user ${userId}.`);
  return { success: true, data: updateResult.data ? { ...profile.metadata, cyberFitness: updateResult.data } : profile.metadata, newAchievements: [quest] };
}

export async function checkAndUnlockAchievement(
  userId: string,
  achievementId: string,
  value?: any 
): Promise<{success: boolean, error?: string, newAchievements?: Achievement[]}> {
    logger.log(`[CyberFitness CheckUnlockAchievement ENTRY] User_id: ${userId}, AchievementId: ${achievementId}`);
    const profile = await fetchUserProfile(userId);
    if (!profile) { return { success: false, error: "User profile not found for achievement check." }; }

    if (profile.metadata.cyberFitness.achievements.includes(achievementId)) {
        logger.info(`[CyberFitness CheckUnlockAchievement] Achievement '${achievementId}' already unlocked by user ${userId}.`);
        return { success: true, newAchievements: [] };
    }

    const achievement = ALL_ACHIEVEMENTS.find(ach => ach.id === achievementId);
    if (!achievement) {
        logger.warn(`[CyberFitness CheckUnlockAchievement] Achievement with ID '${achievementId}' not found in ALL_ACHIEVEMENTS. Aborting.`);
        return { success: false, error: `Achievement ${achievementId} not found.`, newAchievements: [] };
    }
    
    if (achievement.isQuest) { 
        logger.warn(`[CyberFitness CheckUnlockAchievement] Attempted to unlock quest '${achievementId}' via generic achievement check. Use completeQuestAndUpdateProfile instead.`);
        return { success: false, error: `Cannot unlock quest '${achievementId}' this way.`, newAchievements: [] };
    }

    if (achievement.checkCondition(profile, value)) {
        const updates: Partial<UserProfile['metadata']['cyberFitness']> = {};
        if (achievement.kiloVibesAward) {
            updates.kiloVibes = (profile.metadata.cyberFitness.kiloVibes || 0) + achievement.kiloVibesAward;
        }
        
        const updateResult = await updateUserCyberFitnessProfile(userId, updates, [achievementId]);
        if (!updateResult.success) {
            return { success: false, error: updateResult.error || "Failed to update profile after unlocking achievement." };
        }
        logger.log(`[CyberFitness CheckUnlockAchievement EXIT] Achievement '${achievementId}' unlocked for user ${userId}.`);
        return { success: true, newAchievements: [achievement] };
    } else {
        logger.info(`[CyberFitness CheckUnlockAchievement] Condition for achievement '${achievementId}' not met for user ${userId}.`);
        return { success: true, newAchievements: [] }; 
    }
}