"use client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState, useEffect, useCallback } from "react"; 
import Modal from "@/components/ui/Modal"; 
import { toast } from "sonner";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { useAppContext } from "@/contexts/AppContext"; 
import { 
    CyberFitnessProfile, 
    fetchUserCyberFitnessProfile, 
    getAchievementDetails, 
    logSchematicCompleted, 
    Achievement 
} from "@/hooks/cyberFitnessSupabase"; 
import { debugLogger as logger } from "@/lib/debugLogger";
import Link from "next/link"; 

interface SchematicDetail {
  label: string; 
  content: string; 
  icon?: string; 
}

interface VibeSchematic {
  id: string;
  name: string;
  icon: string; 
  description: string;
  details: SchematicDetail[];
  prerequisites: string[]; 
  outcome: string;
  unlocksPerk?: string;
  relatedAchievement?: string; 
  color: string; 
  shadow: string; 
  kiloVibesAwardOnCompletion?: number; 
  completionAchievementIcon?: string; 
}

const vibeSchematics: VibeSchematic[] = [
  {
    id: "deep_work_sprint",
    name: "Схема 'ТУРБО-МОЗГ'",
    icon: "FaBolt", 
    description: "Вруби нитро для своих идей и кода! Этот 90-минутный спринт выжмет из тебя максимум.",
    details: [
      { label: "ВЫГОДА", content: "Молниеносное завершение задач, генерация контента как из пулемета.", icon: "FaStar"},
      { label: "МЕХАНИКА", content: "2x(40 мин чистейшего фокуса + 5 мин перезарядки). Безжалостно к прокрастинации.", icon: "FaToolbox"},
      { label: "АРСЕНАЛ", content: "::FaAtom className='inline text-brand-purple mr-1 align-middle':: AI-ассистент, глушители реальности (наушники), таймер-контроллер.", icon: "FaToolbox"}, 
      { label: "ТОПЛИВО", content: "Кристальная вода, эликсир зеленого чая. Сахар – ЯД для кибер-воина.", icon: "FaGlassWater"},
    ],
    prerequisites: ["level:1", "featureUsed:deep_work_logged"],
    outcome: "Высокая продуктивность, быстрое выполнение задач.",
    relatedAchievement: "deep_work_logged",
    color: "border-brand-orange/60 bg-dark-card/70 hover:shadow-brand-orange/30",
    shadow: "shadow-brand-orange/20",
    kiloVibesAwardOnCompletion: 75,
  },
  {
    id: "skill_acquisition_module",
    name: "Схема 'VIBE-АПГРЕЙД'",
    icon: "FaLightbulb", 
    description: "Загрузи новый скилл или Vibe Perk в свою нейросеть. Стань машиной обучения.",
    details: [
      { label: "ВЫГОДА", content: "Мгновенное расширение твоего Vibe-арсенала, доминация в новой нише.", icon: "FaStar"},
      { label: "МЕХАНИКА", content: "AI объясняет суть -> Ты практикуешь как одержимый -> Интервальное вбивание в мозг.", icon: "FaToolbox"},
      { label: "АРСЕНАЛ", content: "::FaAtom className='inline text-brand-purple mr-1 align-middle':: AI-сенсей, Anki/Quizlet, сверхсекретные туториалы.", icon: "FaBookOpen"}, 
      { label: "ТОПЛИВО", content: "Высокооктановые углеводы для процессора (гречка, овсянка, киноа).", icon: "FaBowlFood"},
    ],
    prerequisites: ["level:2", "achievement:first_parse_completed"],
    outcome: "Освоен новый навык или перк.",
    unlocksPerk: "Адаптивное Обучение",
    color: "border-brand-yellow/60 bg-dark-card/70 hover:shadow-brand-yellow/30",
    shadow: "shadow-brand-yellow/20",
    kiloVibesAwardOnCompletion: 100,
  },
  {
    id: "mind_recharge_cycle",
    name: "Схема 'НЕЙРО-ДЕТОКС'",
    icon: "FaBrain", 
    description: "Перезагрузи матрицу сознания. Очисти кэш. Сгенерируй идеи, которые взорвут рынок.",
    details: [
      { label: "ВЫГОДА", content: "Сброс умственной усталости, кристальная ясность, поток гениальных идей.", icon: "FaStar"},
      { label: "МЕХАНИКА", content: "15-20 мин медитации 'Нулевой Канал' или прогулка 'Альфа-Волны'. После – 10 мин 'Взрыв Идей' фрирайтингом.", icon: "FaToolbox"},
      { label: "АРСЕНАЛ", content: "Приложение для медитации, блокнот или цифровые скрижали.", icon: "FaBook"},
      { label: "ТОПЛИВО", content: "Эликсир травяного чая, орехи мудрости.", icon: "FaMugHot"},
    ],
    prerequisites: [], 
    outcome: "Повышенная креативность, снижение умственного напряжения.",
    color: "border-brand-cyan/60 bg-dark-card/70 hover:shadow-brand-cyan/30",
    shadow: "shadow-brand-cyan/20",
    kiloVibesAwardOnCompletion: 30,
  },
  {
    id: "error_fix_pro",
    name: "Схема 'БАГ-ХАНТЕР ПРО'",
    icon: "FaBugSlash",
    description: "Мастерски устраняй ошибки, используя логи и контекст для точного удара по багам. Совет: Оверлей ошибок (Ctrl+Shift+E) покажет детали!",
    details: [
      { label: "ВЫГОДА", content: "Быстрое и эффективное исправление ошибок, повышение стабильности кода.", icon: "FaShieldHalved" },
      { label: "МЕХАНИКА", content: "Запускай ErrorFix Flow из Оверлея Ошибок -> Внимательно изучай логи в KWork -> Предоставляй AI максимально точный контекст (1-3 файла).", icon: "FaToolbox" },
      { label: "АРСЕНАЛ", content: "SuperVibe Studio, Оверлей Ошибок, Vercel/GitHub логи.", icon: "FaMagnifyingGlassChart" },
      { label: "ТРЕБУЕТ", content: "Перк 'Анализ Логов Ошибок', Ачивка 'Диагност'.", icon: "FaUserSecret" }
    ],
    prerequisites: ["level:4", "perk:Анализ Логов Ошибок (Lv.3 Flow)", "achievement:copy_logs_used"],
    outcome: "Точный фикс бага с минимальными итерациями AI, созданный PR.",
    relatedAchievement: "autofix_used", 
    color: "border-red-500/60 bg-dark-card/70 hover:shadow-red-500/30",
    shadow: "shadow-red-500/20",
    kiloVibesAwardOnCompletion: 150,
  },
  {
    id: "contextual_code_gen",
    name: "Схема 'КОНТЕКСТНЫЙ ГЕНЕЗИС'",
    icon: "FaMagicWandSparkles", 
    description: "Генерируй новый код и фичи, предоставляя AI обширный и релевантный контекст. Используй StickyChat (::FaCommentDots::) для быстрого добавления файлов.",
    details: [
      { label: "ВЫГОДА", content: "Создание сложных компонентов или новой функциональности с пониманием AI зависимостей.", icon: "FaLightbulb" },
      { label: "МЕХАНИКА", content: "Используй 'Выбрать Связанные Файлы' -> 'Добавить все файлы + дерево' -> Точно формулируй задачу для AI.", icon: "FaToolbox" },
      { label: "АРСЕНАЛ", content: "SuperVibe Studio (Экстрактор + Ассистент), системный супер-промпт.", icon: "FaSitemap" },
      { label: "ТРЕБУЕТ", content: "Ачивки 'Архитектор Контекста' и 'Меткий Стрелок'.", icon: "FaBrain" }
    ],
    prerequisites: ["level:5", "achievement:architect", "achievement:sharpshooter"],
    outcome: "Новый компонент/фича, интегрированные в проект, готовый PR.",
    unlocksPerk: "Продвинутый Рефакторинг с AI",
    relatedAchievement: "token_economist_2", 
    color: "border-brand-blue/60 bg-dark-card/70 hover:shadow-brand-blue/30",
    shadow: "shadow-brand-blue/20",
    kiloVibesAwardOnCompletion: 200,
  },
  {
    id: "pr_pipeline_master",
    name: "Схема 'КОНВЕЙЕР PR'",
    icon: "FaTasks", 
    description: "Оптимизируй процесс от идеи до смердженного PR, используя весь арсенал студии.",
    details: [
      { label: "ВЫГОДА", content: "Максимально быстрый и качественный деплой изменений.", icon: "FaRocket" },
      { label: "МЕХАНИКА", content: "Fetch -> Select -> KWork -> AI -> Parse -> Validate -> Fix -> PR -> (Опционально) Review/Approve -> Merge.", icon: "FaToolbox" },
      { label: "АРСЕНАЛ", content: "Все инструменты SuperVibe Studio, GitHub Actions (для авто-мерджа).", icon: "FaGears" },
      { label: "ТРЕБУЕТ", content: "Уровень 5+, все основные квесты выполнены.", icon: "FaUserGraduate" }
    ],
    prerequisites: ["level:5", "quest:first_pr_created"],
    outcome: "Регулярный поток качественных изменений, влитых в основную ветку.",
    relatedAchievement: "commit_crafter_2",
    color: "border-brand-purple/60 bg-dark-card/70 hover:shadow-brand-purple/30",
    shadow: "shadow-brand-purple/20",
    kiloVibesAwardOnCompletion: 250,
  },
  {
    id: "image_guru",
    name: "Схема 'ВИЗУАЛЬНЫЙ АЛХИМИК'",
    icon: "FaImage", 
    description: "Мастерски управляй изображениями: от замены битых ссылок до генерации плейсхолдеров и загрузки новых ассетов. Этот флоу уже автоматизирован через StickyChat!",
    details: [
      { label: "ВЫГОДА", content: "Всегда актуальные и рабочие изображения в проекте, эстетичный UI.", icon: "FaPalette" },
      { label: "МЕХАНИКА", content: "Введи URL битой картинки в StickyChat -> Выбери 'Заменить Картинку' -> Загрузи новую или вставь URL -> Студия создаст авто-PR.", icon: "FaToolbox"},
      { label: "АРСЕНАЛ", content: "StickyChat (ImageReplaceTool), AI Assistant (Image Upload), prompts_imgs.txt.", icon: "FaImages"},
      { label: "ТРЕБУЕТ", content: "Ачивка 'Визуальный Коннект', Перк 'Авто-PR для Замены Изображений'.", icon: "FaLink"}
    ],
    prerequisites: ["level:2", "featureUsed:image_modal_opened", "perk:Авто-PR для Замены Изображений"],
    outcome: "Обновленные или новые изображения в проекте, автоматизированные PR.",
    color: "border-pink-500/60 bg-dark-card/70 hover:shadow-pink-500/30",
    shadow: "shadow-pink-500/20",
    kiloVibesAwardOnCompletion: 60,
    completionAchievementIcon: "FaAward", 
  },
  { 
    id: "icon_fixer_pro",
    name: "Схема 'ЛОВЕЦ ИКОНОК ПРО'",
    icon: "FaCrosshairs", 
    description: "Найди и исправь пропавшие или некорректные иконки FontAwesome. Совет: Используй StickyChat (::FaCommentDots::) для быстрого доступа к файлам, если нужно править код вручную, или Оверлей Ошибок для логов.",
    details: [
      { label: "АНАЛИЗ", content: "Скопируй логи (ачивка 'Диагност') из консоли браузера или Оверлея Ошибок (Ctrl+Shift+E) -> Найди предупреждение VCR об `<неизвестной_иконке>`.", icon: "FaClipboardList"},
      { label: "ПОИСК", content: "Используй ::FaSearch className='inline':: FontAwesome Search (перк 'Самостоятельный Поиск Иконок FontAwesome') для подбора корректного имени.", icon: "FaSearch"},
      { label: "ЗАМЕНА", content: "Внеси правку в код вручную или через 'Magic Swap' / 'Search/Replace' в AI Assistant (фича 'settings_opened' для доступа к этим инструментам).", icon: "FaTools"}
    ],
    prerequisites: ["level:4", "achievement:copy_logs_used", "perk:Самостоятельный Поиск Иконок FontAwesome", "featureUsed:settings_opened"],
    outcome: "Все иконки на месте, UI сияет! + Чистая консоль.",
    color: "border-teal-500/60 bg-dark-card/70 hover:shadow-teal-500/30", 
    shadow: "shadow-teal-500/20",
    kiloVibesAwardOnCompletion: 70,
    completionAchievementIcon: "FaLightbulb" 
  }
];

export default function VibeSchematicsPage() {
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
    
  const [currentUserProfile, setCurrentUserProfile] = useState<CyberFitnessProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [activatingSchematicId, setActivatingSchematicId] = useState<string | null>(null);

  const { dbUser, addToast } = useAppContext();

  const fetchProfile = useCallback(async () => {
    if (dbUser?.user_id) {
      setIsLoadingProfile(true);
      try {
        const result = await fetchUserCyberFitnessProfile(dbUser.user_id);
        if (result.success && result.data) {
          setCurrentUserProfile(result.data);
        } else {
          logger.warn("[VibeSchematicsPage] Failed to fetch user profile.", { error: result.error });
          toast.error("Ошибка загрузки профиля Агента. Попробуйте снова."); // Toast on explicit failure
        }
      } catch (error) {
        logger.error("[VibeSchematicsPage] Exception fetching profile:", error);
        toast.error("Критическая ошибка при загрузке профиля.");
      } finally {
        setIsLoadingProfile(false);
      }
    } else {
        setCurrentUserProfile(null); 
        setIsLoadingProfile(false);
        if (dbUser === null) { // Only show if we know there's no user, not just initially undefined
             logger.info("[VibeSchematicsPage] No authenticated user. Schematics unavailable.");
        }
    }
  }, [dbUser?.user_id]); // Switched dbUser to dbUser.user_id

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);
  
  const handleActivateSchematic = useCallback(async (schematic: VibeSchematic) => {
    if (!dbUser?.user_id) {
        toast.error("Профиль Агента не авторизован. Попробуйте обновить страницу.");
        return; // No need to reset activatingSchematicId if it wasn't set
    }
    if (activatingSchematicId) return; // Already processing one

    setActivatingSchematicId(schematic.id);
    const activationToastId = toast.loading(`Активация схемы "${schematic.name}"...`);
    logger.log(`[VibeSchematicsPage] Attempting to activate schematic: ${schematic.id} for user ${dbUser.user_id}`);

    try {
        const result = await logSchematicCompleted(dbUser.user_id, schematic.id, {
            prerequisites: schematic.prerequisites,
            kiloVibesAward: schematic.kiloVibesAwardOnCompletion,
            unlocksPerk: schematic.unlocksPerk,
            schematicName: schematic.name, 
            schematicIcon: schematic.completionAchievementIcon || schematic.icon 
        });
        logger.log(`[VibeSchematicsPage] Result for schematic ${schematic.id}:`, result);

        if (result.success) {
            if (result.alreadyCompleted) {
                toast.success(`Схема "${schematic.name}" уже была освоена ранее. Так держать, Агент!`, { id: activationToastId });
            } else {
                let message = `Схема "${schematic.name}" успешно освоена!`;
                if (result.kiloVibesAwarded && result.kiloVibesAwarded > 0) {
                    message += ` +${result.kiloVibesAwarded.toLocaleString()} KiloVibes!`;
                }
                let rewardDescription = "";
                const rewards: string[] = [];
                if (result.newPerks && result.newPerks.length > 0) { rewards.push(...result.newPerks.map(p => `Перк: ${p}`)); }
                if (result.newAchievements && result.newAchievements.length > 0) { rewards.push(...result.newAchievements.map(a => `Ачивка: ${a.name}`)); }
                rewardDescription = rewards.length > 0 ? `Разблокировано: ${rewards.join(', ')}` : "Продолжайте в том же духе!";
                
                addToast(message, "success", 7000, { id: activationToastId, description: rewardDescription }); // Use addToast from context
                await fetchProfile(); 
            }
        } else {
            toast.error(result.error || `Ошибка активации схемы "${schematic.name}".`, { id: activationToastId, duration: 6000 });
        }
    } catch (error: any) {
        logger.error(`[VibeSchematicsPage] Critical error activating schematic ${schematic.id}:`, error);
        toast.error(`Критическая ошибка: ${error.message || 'Неизвестно'}`, { id: activationToastId, duration: 6000 });
    } finally {
        setActivatingSchematicId(null); // Reset loading state here
    }
  }, [dbUser?.user_id, activatingSchematicId, fetchProfile, addToast]);

  const checkPrerequisites = useCallback((schematic: VibeSchematic, profile: CyberFitnessProfile | null): { met: boolean; missing: string[] } => {
    if (!profile) return { met: false, missing: ["Загрузка профиля..."] }; 
    const missingPrerequisites: string[] = [];
    let allMet = true;
    if (!schematic.prerequisites || schematic.prerequisites.length === 0) return { met: true, missing: [] }; 

    schematic.prerequisites.forEach(prereq => {
      const [type, value] = prereq.split(':');
      let currentMet = false;
      if (type === 'level' && profile.level >= parseInt(value, 10)) currentMet = true;
      else if (type === 'achievement' && profile.achievements.includes(value)) currentMet = true;
      else if (type === 'perk' && profile.unlockedPerks.includes(value)) currentMet = true;
      else if (type === 'featureUsed' && profile.featuresUsed[value]) currentMet = true;
      else if (type === 'quest' && profile.completedQuests.includes(value)) currentMet = true;
      
      if (!currentMet) {
        allMet = false;
        const achievementDetail = (type === 'achievement' || type === 'quest') ? getAchievementDetails(value) : null;
        const perkDetail = (type === 'perk') ? value : null; 
        if (type === 'level') missingPrerequisites.push(`Требуется Уровень ${value}`);
        else if (achievementDetail) missingPrerequisites.push(`${type === 'quest' ? 'Квест' : 'Достижение'}: "${achievementDetail.name || value}"`);
        else if (perkDetail) missingPrerequisites.push(`Перк: "${perkDetail}"`);
        else missingPrerequisites.push(`Условие: ${prereq}`); 
      }
    });
    return { met: allMet, missing: missingPrerequisites };
  }, []); 

  const handleFakeDoorAction = (actionName: string) => {
    toast.info(`Функция "${actionName}" в разработке в лаборатории CyberVibe.`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-black to-dark-card text-light-text p-4 pt-24 pb-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto max-w-3xl"
      >
        <Card className="bg-dark-card/90 backdrop-blur-xl border border-brand-green/60 shadow-2xl shadow-green-glow">
          <CardHeader className="text-center p-6 md:p-8 border-b border-brand-green/40">
            <VibeContentRenderer content="::FaTools className='text-6xl text-brand-green mx-auto mb-4 drop-shadow-[0_0_15px_theme(colors.brand-green)] animate-pulse'::" />
            <CardTitle className="text-3xl md:text-4xl font-orbitron font-bold text-brand-green cyber-text glitch" data-text="СХЕМЫ ВАЙБА">
              СХЕМЫ ВАЙБА
            </CardTitle>
            <CardDescription className="text-muted-foreground font-mono mt-1 text-sm md:text-base">
              Кибер-Чертежи для Активации Твоего Потенциала и Профита. Комбинируй навыки!
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-8 p-6 md:p-8">
            {isLoadingProfile && (
                <div className="text-center py-10">
                    <VibeContentRenderer content="::FaSpinner className='animate-spin text-4xl text-brand-green mx-auto'::" />
                    <p className="mt-2 font-mono text-muted-foreground">Загрузка данных Агента...</p>
                </div>
            )}
            {!isLoadingProfile && !currentUserProfile && dbUser && ( // Profile fetch failed for logged in user
                 <div className="text-center py-10">
                    <VibeContentRenderer content="::FaExclamationTriangle className='text-4xl text-brand-red mx-auto'::" />
                    <p className="mt-2 font-mono text-muted-foreground">Не удалось загрузить профиль Агента. Попробуйте обновить страницу.</p>
                     <Button onClick={fetchProfile} variant="outline" className="mt-4 border-brand-yellow text-brand-yellow hover:bg-brand-yellow/10">
                        Повторить Загрузку
                    </Button>
                </div>
            )}
            {!isLoadingProfile && !dbUser && ( // No user logged in
                 <div className="text-center py-10">
                    <VibeContentRenderer content="::FaUserSecret className='text-4xl text-brand-blue mx-auto'::" />
                    <p className="mt-2 font-mono text-muted-foreground">Для доступа к Схемам Вайба необходима Авторизация.</p>
                     <Button asChild className="mt-4 bg-brand-cyan text-black hover:bg-brand-cyan/80">
                        <Link href="/auth">Войти в Систему</Link>
                    </Button>
                </div>
            )}

            {!isLoadingProfile && currentUserProfile && vibeSchematics.map(schematic => {
              const prereqStatus = checkPrerequisites(schematic, currentUserProfile);
              const isCompleted = currentUserProfile.featuresUsed[`schematic_completed_${schematic.id}`] === true;
              const canActivate = prereqStatus.met && !isCompleted;
              const isActivatingThis = activatingSchematicId === schematic.id;

              let statusLabel = "ЗАГРУЗКА...";
              let statusColor = "bg-muted/80 text-muted-foreground";
              if (isCompleted) { statusLabel = "ОСВОЕНО"; statusColor = "bg-brand-green/90 text-black"; }
              else if (prereqStatus.met) { statusLabel = "ДОСТУПНО"; statusColor = "bg-brand-cyan/80 text-black"; }
              else { statusLabel = "ЗАБЛОКИРОВАНО"; statusColor = "bg-destructive/80 text-destructive-foreground"; }
              
              return (
              <motion.section 
                key={schematic.id} 
                className={`p-4 md:p-5 rounded-lg border ${schematic.color} shadow-lg ${schematic.shadow} transition-all duration-300 hover:scale-[1.015] hover:shadow-xl hover:${schematic.shadow.replace('/20','/40')} ${(isCompleted || (!prereqStatus.met && !isCompleted)) ? 'opacity-60 grayscale-[30%]' : ''} ${isCompleted ? 'border-brand-green-500 ring-2 ring-brand-green-500/80' : ''}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + vibeSchematics.indexOf(schematic) * 0.1 }}
              >
                <div className="flex justify-between items-start mb-2">
                    <h2 className="text-xl md:text-2xl font-orbitron mb-1 flex items-center gap-2">
                        <VibeContentRenderer content={`::${schematic.icon}::`} /> 
                        <span className="ml-1">{schematic.name}</span>
                        {isCompleted && <VibeContentRenderer content="::FaCheckCircle className='text-brand-green ml-2 text-lg'::" />}
                    </h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-semibold ${statusColor}`} title={!prereqStatus.met ? prereqStatus.missing.join('\n') : (isCompleted ? "Эта схема уже освоена" : "Готово к активации")}>
                        {statusLabel}
                    </span>
                </div>
                <p className="text-sm text-muted-foreground mb-3 font-mono">{schematic.description}</p>
                
                {schematic.details.map((detail, index) => (
                    <div key={index} className="mb-2.5">
                        <h4 className="text-xs font-semibold text-brand-purple uppercase tracking-wider mb-0.5 flex items-center">
                            {detail.icon && <VibeContentRenderer content={`::${detail.icon} className='mr-1.5 text-brand-purple/70 text-sm'::`} />}
                            {detail.label}:
                        </h4>
                        <div className="text-xs text-gray-300 font-mono pl-1">
                             <VibeContentRenderer content={detail.content} className="prose prose-xs prose-invert text-gray-300 prose-strong:text-brand-yellow prose-em:text-brand-cyan prose-a:text-brand-blue"/>
                        </div>
                    </div>
                  ))}
                <div className="mt-3 pt-2 border-t border-gray-700/50 space-y-1">
                    <p className="text-xs font-mono"><strong className="text-brand-green">Результат:</strong> <VibeContentRenderer content={schematic.outcome} /></p>
                    {schematic.unlocksPerk && <p className="text-xs font-mono"><strong className="text-brand-yellow">Открывает Перк:</strong> {schematic.unlocksPerk}</p>}
                    {schematic.kiloVibesAwardOnCompletion && <p className="text-xs font-mono"><strong className="text-brand-pink">Награда за освоение:</strong> {schematic.kiloVibesAwardOnCompletion.toLocaleString()} KiloVibes</p>}
                    {schematic.relatedAchievement && getAchievementDetails(schematic.relatedAchievement) && (
                        <p className="text-xs font-mono"><strong className="text-neon-lime">Связано с Ачивкой:</strong> <Link href="/profile#achievements" className="hover:underline">{getAchievementDetails(schematic.relatedAchievement)?.name}</Link></p>
                    )}
                </div>
                 
                {!isCompleted && (
                    <Button 
                        size="sm" 
                        className={`mt-4 w-full font-orbitron text-sm py-2 ${canActivate ? 'bg-gradient-to-r from-brand-cyan to-brand-blue text-white hover:brightness-110' : 'bg-muted text-muted-foreground hover:bg-muted cursor-not-allowed'}`}
                        onClick={() => handleActivateSchematic(schematic)}
                        disabled={!canActivate || isActivatingThis}
                    >
                       {isActivatingThis ? <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2'::" /> : <VibeContentRenderer content="::FaBolt::" />}
                       <span className="ml-1">{isActivatingThis ? "АКТИВАЦИЯ..." : "ОСВОИТЬ СХЕМУ"}</span>
                    </Button>
                 )}
                 {isCompleted && (
                     <Button 
                        size="sm" 
                        variant="outline"
                        className="mt-4 w-full font-orbitron text-sm py-2 border-brand-green text-brand-green hover:bg-brand-green/10 cursor-default"
                        disabled
                    >
                       <VibeContentRenderer content="::FaCheckCircle::" /> <span className="ml-2">СХЕМА ОСВОЕНА</span>
                    </Button>
                 )}
              </motion.section>
            )})}
            
            <section className="flex flex-col sm:flex-row gap-4 justify-center pt-8 border-t border-brand-green/30 mt-8">
              <Button onClick={() => setIsSaveModalOpen(true)} className="bg-gradient-to-r from-brand-green to-neon-lime text-black hover:brightness-110 font-orbitron flex-1 py-3 text-base transform hover:scale-105 transition-all shadow-lg hover:shadow-brand-green/40 flex items-center justify-center">
                <VibeContentRenderer content="::FaFloppyDisk className='mr-2.5 align-middle text-lg'::" /> <span className="ml-2">СОХРАНИТЬ МОЙ СТЕК!</span>
              </Button>
              <Button onClick={() => setIsSuggestModalOpen(true)} variant="outline" className="border-brand-cyan text-brand-cyan hover:bg-brand-cyan/20 hover:text-white font-orbitron flex-1 py-3 text-base transform hover:scale-105 transition-all shadow-lg hover:shadow-brand-cyan/30 flex items-center justify-center">
                <VibeContentRenderer content="::FaCirclePlus className='mr-2.5 align-middle text-lg'::" /> <span className="ml-2">ПРЕДЛОЖИТЬ СХЕМУ</span>
              </Button>
            </section>
          </CardContent>
        </Card>
      </motion.div>

      <Modal 
        isOpen={isSaveModalOpen} 
        onClose={() => setIsSaveModalOpen(false)} 
        title="Сохранение Стека Схем" 
        confirmText="Сохранить в Нейробанк" 
        onConfirm={() => { handleFakeDoorAction("Сохранить Стек Схем"); setIsSaveModalOpen(false); }}
        dialogClassName="bg-dark-card border-brand-green text-light-text"
        titleClassName="text-brand-green"
        confirmButtonClassName="bg-brand-green hover:bg-brand-green/80 text-black"
        cancelButtonClassName="text-muted-foreground hover:bg-muted/50"
      >
        <p className="font-mono text-sm text-muted-foreground">Эта функция позволит сохранить текущий набор активных схем в вашем личном профиле Агента. В разработке...</p>
      </Modal>
      <Modal 
        isOpen={isSuggestModalOpen} 
        onClose={() => setIsSuggestModalOpen(false)} 
        title="Предложение Новой Схемы Вайба" 
        confirmText="Отправить Предложение" 
        onConfirm={() => { handleFakeDoorAction("Предложить Схему Вайба"); setIsSuggestModalOpen(false); }}
        dialogClassName="bg-dark-card border-brand-cyan text-light-text"
        titleClassName="text-brand-cyan"
        confirmButtonClassName="bg-brand-cyan hover:bg-brand-cyan/80 text-black"
        cancelButtonClassName="text-muted-foreground hover:bg-muted/50"
      >
        <p className="font-mono text-sm text-muted-foreground">Есть идея для новой кибернетической схемы? Опишите ее здесь! Ваш вклад поможет расширить арсенал CyberVibe. В разработке...</p>
      </Modal>
    </div>
  );
}