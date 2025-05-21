import { supabaseAdmin } from './supabase';
import { Database, Json } from '@/types/database.types';
import { logger } from '@/lib/logger';

export type UserCyberFitnessProfile = Database["public"]["Tables"]["user_cyber_fitness_profiles"]["Row"];
export type CyberFitnessMetadata = {
    level: number;
    currentKiloVibes: number;
    totalKiloVibesEarned: number;
    completedQuests: string[]; // Array of achievement IDs
    unlockedPerks: string[]; // Array of perk IDs
    dailyStreak: number;
    lastActiveDate: string; // ISO Date string
    // Maybe add weekly/monthly scores later
};

export type AchievementCategory = 
    | "GENERAL_PROGRESS" 
    | "CONTENT_CREATION" 
    | "CODE_CONTRIBUTION" 
    | "COMMUNITY_ENGAGEMENT"
    | "SYSTEM_INTERACTION"
    | "LEAD_GENERATION"
    | "STUDIO_INTERACTION";


export interface Achievement {
    id: string; // e.g., "first_pr_created"
    name: string;
    description: string;
    category: AchievementCategory;
    kiloVibesAward: number;
    icon?: string; // Fa6 Icon name (e.g., "FaCodeBranch")
    isPublic?: boolean; // Whether to show in a public list of achievements
    unlockConditions?: (profile: CyberFitnessMetadata, actionDetails?: any) => boolean; // Optional complex unlock logic
}

export interface Perk {
    id: string; // e.g., "advanced_repo_tools"
    name: string;
    description: string;
    levelRequired: number; // Level needed to unlock this perk
    icon?: string;
}


export const CYBERFIT_METADATA_KEY = 'cyberFitnessProfile_v1'; // Key for user_metadata

// --- Achievements Definitions ---
export const ALL_ACHIEVEMENTS: Achievement[] = [
    // General Progress
    { id: 'profile_completed', name: 'Личность Установлена', description: 'Заполнил свой профиль полностью.', category: 'GENERAL_PROGRESS', kiloVibesAward: 50, icon: 'FaUserCheck', isPublic: true },
    { id: 'first_login_telegram', name: 'Вход через Телепорт', description: 'Первый успешный вход через Telegram.', category: 'GENERAL_PROGRESS', kiloVibesAward: 25, icon: 'FaTelegram', isPublic: true },
    
    // Content Creation (Placeholder examples)
    { id: 'first_article_published', name: 'Первопечатник', description: 'Опубликовал свою первую статью.', category: 'CONTENT_CREATION', kiloVibesAward: 100, icon: 'FaFeatherAlt', isPublic: true },

    // Code Contribution (More relevant to repo-xml)
    { id: 'initial_boot_sequence', name: 'Пойман Сигнал', description: 'Успешно запустил процесс анализа репозитория в SUPERVIBE Studio.', category: 'CODE_CONTRIBUTION', kiloVibesAward: 20, icon: 'FaSatelliteDish', isPublic: true },
    { id: 'first_fetch_completed', name: 'Сканер Активирован', description: 'Успешно извлек файлы из репозитория.', category: 'CODE_CONTRIBUTION', kiloVibesAward: 50, icon: 'FaDownload', isPublic: true },
    { id: 'first_parse_completed', name: 'Код Расшифрован', description: 'Успешно разобрал ответ AI и проанализировал файлы.', category: 'CODE_CONTRIBUTION', kiloVibesAward: 75, icon: 'FaCodeCompare', isPublic: true },
    { id: 'first_pr_created', name: 'Коммит в Матрицу', description: 'Создал свой первый Pull Request через SUPERVIBE Studio.', category: 'CODE_CONTRIBUTION', kiloVibesAward: 150, icon: 'FaCodeBranch', isPublic: true },
    { id: 'branch_updated', name: 'Ветвь Эволюции', description: 'Обновил существующую ветку через SUPERVIBE Studio.', category: 'CODE_CONTRIBUTION', kiloVibesAward: 70, icon: 'FaCodeCommit', isPublic: true },
    { id: 'pr_merged_by_ai_assist', name: 'Ассимиляция Успешна', description: 'Твой PR, созданный с помощью AI, был успешно смержен.', category: 'CODE_CONTRIBUTION', kiloVibesAward: 250, icon: 'FaCheckDouble', isPublic: true },
    { id: 'usedSelectHighlighted', name: 'Фокус Мастера', description: 'Использовал функцию выбора связанных файлов.', category: 'CODE_CONTRIBUTION', kiloVibesAward: 30, icon: 'FaHighlighter', isPublic: true },
    { id: 'usedAddFullTree', name: 'Архивариус Кода', description: 'Добавил полное дерево файлов в запрос.', category: 'CODE_CONTRIBUTION', kiloVibesAward: 25, icon: 'FaFolderTree', isPublic: true },
    { id: 'kwork_cleared', name: 'Чистый Холст', description: 'Очистил поле запроса.', category: 'CODE_CONTRIBUTION', kiloVibesAward: 10, icon: 'FaEraser', isPublic: true },
    { id: 'system_prompt_copied', name: 'Завет Архитектора', description: 'Скопировал системный промпт.', category: 'CODE_CONTRIBUTION', kiloVibesAward: 15, icon: 'FaClipboardCheck', isPublic: true },
    { id: 'settings_opened', name: 'Взгляд под Капот', description: 'Открыл настройки SUPERVIBE Studio.', category: 'CODE_CONTRIBUTION', kiloVibesAward: 10, icon: 'FaCog', isPublic: true },

    // Lead Generation
    { id: 'leads_first_scrape_success', name: 'Зонд-Первопроходец', description: 'Успешно использовал Кибер-Скрейпер для сбора данных.', category: 'LEAD_GENERATION', kiloVibesAward: 75, icon: 'FaSatelliteDish', isPublic: true },
    { id: 'leads_first_csv_upload', name: 'Десантник Данных', description: 'Успешно загрузил первый CSV с лидами в Supabase.', category: 'LEAD_GENERATION', kiloVibesAward: 150, icon: 'FaCloudArrowUp', isPublic: true },
    { id: 'leads_ai_pipeline_used', name: 'Межгалактический Конвейер', description: 'Использовал "Межгалактический промпт" для полной обработки лидов.', category: 'LEAD_GENERATION', kiloVibesAward: 100, icon: 'FaMeteor', isPublic: true },

    // System Interaction / Studio Usage
    { id: 'sticky_chat_opened', name: 'Вызов Xuinity', description: 'Впервые открыл чат-ассистента Xuinity.', category: 'STUDIO_INTERACTION', kiloVibesAward: 20, icon: 'FaCommentDots', isPublic: true },
    { id: 'copy_logs_used', name: 'Лог-Мастер', description: 'Впервые скопировал системные логи.', category: 'STUDIO_INTERACTION', kiloVibesAward: 25, icon: 'FaClipboardList', isPublic: true },
    { id: 'image_replace_initiated', name: 'Визуальный Твик', description: 'Инициировал замену изображения через Xuinity.', category: 'STUDIO_INTERACTION', kiloVibesAward: 40, icon: 'FaImages', isPublic: true },
    { id: 'icon_replace_initiated', name: 'Символист', description: 'Инициировал замену иконки через Xuinity.', category: 'STUDIO_INTERACTION', kiloVibesAward: 40, icon: 'FaIcons', isPublic: true },
    { id: 'idea_sent_to_studio', name: 'Искра Вдохновения', description: 'Отправил идею в SUPERVIBE Studio через Xuinity.', category: 'STUDIO_INTERACTION', kiloVibesAward: 50, icon: 'FaLightbulb', isPublic: true },
    { id: 'scrolled_like_a_maniac', name: 'Скролл-Коммандос', description: 'Проскроллил страницу как настоящий исследователь глубин!', category: 'SYSTEM_INTERACTION', kiloVibesAward: 15, icon: 'FaAngleDoubleDown', isPublic: false },
];


// --- Perks Definitions ---
export const PERKS_BY_LEVEL: Record<number, Perk[]> = {
    1: [ { id: 'basic_repo_fetch', name: 'Базовый Анализ Репо', description: 'Возможность извлекать файлы из GitHub репозиториев.', levelRequired: 1, icon: 'FaDownload' } ],
    2: [ { id: 'ai_code_parser', name: 'AI Парсер Кода', description: 'Разблокирует возможность парсить ответы AI и применять изменения.', levelRequired: 2, icon: 'FaCodeCompare' } ],
    3: [ { id: 'pr_creation_tool', name: 'Авто-PR Генератор', description: 'Позволяет создавать PR в GitHub через SUPERVIBE Studio.', levelRequired: 3, icon: 'FaGithub' } ],
    // Add more levels and perks
};

// --- XP to Level ---
// Simplified: Each level requires N * 100 KiloVibes more than the previous, starting with 200 for level 2.
export const KILOVIBES_PER_LEVEL = (level: number): number => {
    if (level <= 1) return 0;
    if (level === 2) return 200;
    return KILOVIBES_PER_LEVEL(level - 1) + (level -1) * 150; // Increased scaling
};


export const getCyberFitnessProfile = async (userId: string): Promise<{ data: UserCyberFitnessProfile | null; error: any }> => {
    if (!supabaseAdmin) {
        logger.error('Supabase admin client not initialized in getCyberFitnessProfile');
        return { data: null, error: 'Supabase admin client not initialized' };
    }
    try {
        const { data, error } = await supabaseAdmin
            .from('user_cyber_fitness_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116: single row not found
            logger.error(`Error fetching CyberFitness profile for ${userId}:`, error);
        }
        return { data, error: error && error.code !== 'PGRST116' ? error : null };
    } catch (e: any) {
        logger.error(`Exception fetching CyberFitness profile for ${userId}:`, e);
        return { data: null, error: e };
    }
};

export const createNewCyberFitnessProfile = async (userId: string): Promise<{ data: UserCyberFitnessProfile | null; error: any; newAchievements?: Achievement[] }> => {
    if (!supabaseAdmin) {
        logger.error('Supabase admin client not initialized in createNewCyberFitnessProfile');
        return { data: null, error: 'Supabase admin client not initialized' };
    }
    const initialMetadata: CyberFitnessMetadata = {
        level: 1,
        currentKiloVibes: 0,
        totalKiloVibesEarned: 0,
        completedQuests: [],
        unlockedPerks: PERKS_BY_LEVEL[1]?.map(p => p.id) || [], // Perks for level 1
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
        logger.info(`[CyberFitness] New profile created for user ${userId}. Level 1, ${initialMetadata.currentKiloVibes} KiloVibes.`);
        return { data, error: null, newAchievements: [] }; // No achievements on creation typically, but can be extended
    } catch (e: any) {
        logger.error(`Exception creating new CyberFitness profile for ${userId}:`, e);
        return { data: null, error: e, newAchievements: [] };
    }
};


export const updateUserCyberFitnessProfile = async (
    userId: string,
    updates: {
        kiloVibesEarned?: number;
        completedQuests?: string[]; // Array of achievement IDs to add
        actionCounts?: Record<string, number>; // e.g. { commits: 1, linesChanged: 100 }
    }
): Promise<{ success: boolean; error?: string | null; data?: UserCyberFitnessProfile | null; newAchievements?: Achievement[] }> => {
    if (!supabaseAdmin) {
        logger.error('Supabase admin client not initialized in updateUserCyberFitnessProfile');
        return { success: false, error: 'Supabase admin client not initialized' };
    }

    try {
        let { data: profile, error: fetchError } = await getCyberFitnessProfile(userId);

        if (fetchError && fetchError.code !== 'PGRST116' && fetchError.message !== "JSON object requested, multiple (or no) rows returned") { // PGRST116 means no row found, which is fine, we'll create one.
             logger.error(`[CyberFitness Update] Error fetching profile for user ${userId} before update:`, fetchError);
             return { success: false, error: `Fetch error: ${fetchError.message}` };
        }
        if (!profile) {
            const creationResult = await createNewCyberFitnessProfile(userId);
            if (creationResult.error || !creationResult.data) {
                logger.error(`[CyberFitness Update] Failed to create new profile for user ${userId} during update:`, creationResult.error);
                return { success: false, error: `Creation error: ${creationResult.error?.message || 'Unknown'}` };
            }
            profile = creationResult.data;
        }
        
        let metadata = (profile.metadata as unknown as CyberFitnessMetadata | null);
        if (!metadata || typeof metadata.level === 'undefined') { // Check for incomplete metadata
            logger.warn(`[CyberFitness Update] Metadata for user ${userId} is missing or incomplete. Re-initializing.`);
            metadata = {
                level: 1, currentKiloVibes: 0, totalKiloVibesEarned: 0,
                completedQuests: [], unlockedPerks: PERKS_BY_LEVEL[1]?.map(p => p.id) || [],
                dailyStreak: 0, lastActiveDate: new Date().toISOString().split('T')[0],
            };
        }


        const awardedAchievements: Achievement[] = [];

        // Update KiloVibes
        if (updates.kiloVibesEarned && updates.kiloVibesEarned > 0) {
            metadata.currentKiloVibes += updates.kiloVibesEarned;
            metadata.totalKiloVibesEarned += updates.kiloVibesEarned;
        }

        // Add completed quests (achievements)
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
        
        // Level up check
        let currentLevelThreshold = KILOVIBES_PER_LEVEL(metadata.level + 1);
        while (metadata.totalKiloVibesEarned >= currentLevelThreshold && currentLevelThreshold > 0) { // currentLevelThreshold > 0 to prevent infinite loop if KILOVIBES_PER_LEVEL is misconfigured
            metadata.level++;
            logger.info(`[CyberFitness] User ${userId} leveled up to Level ${metadata.level}!`);
            // Unlock perks for the new level
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
             if (currentLevelThreshold <= KILOVIBES_PER_LEVEL(metadata.level)) { // Safety break if KILOVIBES_PER_LEVEL doesn't increase
                logger.error(`[CyberFitness] KiloVibes threshold calculation error for level ${metadata.level + 1}. Breaking level-up loop.`);
                break;
            }
        }

        // Update last active date and potentially streak (simplified)
        const today = new Date().toISOString().split('T')[0];
        if (metadata.lastActiveDate !== today) {
            // Basic daily streak logic (can be more complex)
            const yesterday = new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0];
            if (metadata.lastActiveDate === yesterday) {
                metadata.dailyStreak = (metadata.dailyStreak || 0) + 1;
            } else {
                metadata.dailyStreak = 1; // Reset if not consecutive
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
    featureId: string // This is the achievement ID
): Promise<{ success: boolean; error?: string | null; newAchievements?: Achievement[] }> => {
    const achievementToUnlock = ALL_ACHIEVEMENTS.find(ach => ach.id === featureId);
    if (!achievementToUnlock) {
        logger.warn(`[CyberFitness CheckUnlock] Achievement ID "${featureId}" not found in ALL_ACHIEVEMENTS.`);
        return { success: false, error: "Achievement definition not found." };
    }

    // Fetch current profile to check if already unlocked
    const { data: profile, error: fetchError } = await getCyberFitnessProfile(userId);
    if (fetchError) {
        logger.error(`[CyberFitness CheckUnlock] Error fetching profile for ${userId} before checking achievement ${featureId}:`, fetchError);
        // Decide if this should prevent unlocking or if we should proceed assuming it's not unlocked
        // For now, let's proceed, updateUserCyberFitnessProfile will handle profile creation if needed.
    }
    
    const metadata = profile?.metadata as unknown as CyberFitnessMetadata | null;
    if (metadata?.completedQuests?.includes(featureId)) {
        logger.info(`[CyberFitness CheckUnlock] User ${userId} already unlocked achievement: '${achievementToUnlock.name}'. No update needed.`);
        return { success: true, newAchievements: [] }; // Already unlocked
    }
    
    // If not unlocked, update the profile (this will add the quest and KiloVibes)
    logger.info(`[CyberFitness CheckUnlock] Attempting to unlock achievement '${achievementToUnlock.name}' for user ${userId}.`);
    return updateUserCyberFitnessProfile(userId, { completedQuests: [featureId] });
};


export const logCyberFitnessAction = async (
    userId: string,
    actionType: string, // e.g., 'commitMade', 'fileFetched', 'aiResponseParsed'
    kiloVibesValue: number = 10 // Default KiloVibes for a generic action
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