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
} from "@/hooks/cyberFitnessSupabase"; 
import { debugLogger as logger } from "@/lib/debugLogger";
import Link from "next/link"; 
import { cn } from "@/lib/utils";

// --- КОМПОНЕНТЫ-ПОМОЩНИКИ ДЛЯ ГАЙДА ---
const ScreenshotPlaceholder = ({ text, className }: { text: string, className?: string }) => (
  <div className={cn(
    "flex items-center justify-center text-center p-8 my-4 border-2 border-dashed border-brand-purple/50 bg-brand-purple/10 rounded-lg text-brand-purple/80 font-mono text-sm shadow-inner",
    className
  )}>
    [ЗДЕСЬ БУДЕТ СКРИНШОТ: {text}]
  </div>
);

const PseudoCodeBlock = ({ children }: { children: React.ReactNode }) => (
  <div className="my-4 p-4 bg-black/50 border border-gray-700 rounded-lg shadow-lg">
    <pre><code className="font-mono text-sm text-brand-lime whitespace-pre-wrap">{children}</code></pre>
  </div>
);
// ------------------------------------

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
  // --- ТВОИ ОРИГИНАЛЬНЫЕ СХЕМЫ (хорошие вещи сохранены) ---
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
  // --- НОВАЯ СХЕМА-ССЫЛКА НА ГАЙДЫ ---
  {
    id: "creator_kitchen_access",
    name: "Рецепт 'НЕЙРО-КУХНЯ'",
    icon: "FaUserGraduate",
    description: "Открой доступ к священным знаниям! Этот рецепт научит тебя не просто следовать схемам, а СОЗДАВАТЬ свои собственные вайбы с нуля, используя силу Джинна.",
    details: [
        { label: "ЧТО ЭТО", content: "Продвинутый гайд по созданию Telegram-команд и целых веб-компонентов с помощью AI-ассистента.", icon: "FaInfoCircle" },
        { label: "МЕХАНИКА", content: "Читай гайды ниже -> Пробуй повторить ритуал -> Получай KiloVibes за первые успехи!", icon: "FaToolbox" },
        { label: "АРСЕНАЛ", content: "Твой мозг, OneSitePlsBot, SuperVibe Studio.", icon: "FaBrain" },
    ],
    prerequisites: ["level:5", "achievement:commit_crafter_2"],
    outcome: "Способность генерировать новые команды бота и веб-страницы.",
    unlocksPerk: "AI-Командир",
    color: "border-fuchsia-500/60 bg-dark-card/70 hover:shadow-fuchsia-500/30",
    shadow: "shadow-fuchsia-500/20",
    kiloVibesAwardOnCompletion: 500,
  },
  // ... (тут могли бы быть остальные твои оригинальные схемы)
];

export default function VibeNutritionPage() {
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<CyberFitnessProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [activatingSchematicId, setActivatingSchematicId] = useState<string | null>(null);
  const { dbUser, addToast } = useAppContext();

  // ... (весь твой оригинальный JS-код для работы со схемами: fetchProfile, handleActivateSchematic, checkPrerequisites, handleFakeDoorAction)
    const fetchProfile = useCallback(async () => {
    if (dbUser?.user_id) {
      setIsLoadingProfile(true);
      logger.debug("[VibeNutritionPage] fetchProfile: Fetching...");
      try {
        const result = await fetchUserCyberFitnessProfile(dbUser.user_id);
        if (result.success && result.data) {
          setCurrentUserProfile(result.data);
          logger.debug("[VibeNutritionPage] fetchProfile: Success.", { level: result.data.level, kv: result.data.kiloVibes });
        } else {
          logger.warn("[VibeNutritionPage] fetchProfile: Failed.", { error: result.error });
          toast.error("Ошибка загрузки профиля Агента. Попробуйте снова.");
        }
      } catch (error) {
        logger.error("[VibeNutritionPage] fetchProfile: Exception.", error);
        toast.error("Критическая ошибка при загрузке профиля.");
      } finally {
        setIsLoadingProfile(false);
        logger.debug("[VibeNutritionPage] fetchProfile: Finished.");
      }
    } else {
        setCurrentUserProfile(null); 
        setIsLoadingProfile(false);
        if (dbUser === null) { 
             logger.info("[VibeNutritionPage] No authenticated user. Schematics unavailable.");
        }
    }
    }, [dbUser?.user_id]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);
  
    const handleActivateSchematic = useCallback(async (schematic: VibeSchematic) => {
        if (!dbUser?.user_id) {
            toast.error("Профиль Агента не авторизован. Попробуйте обновить страницу.");
            return; 
        }
        if (activatingSchematicId) {
            return; 
        }

        setActivatingSchematicId(schematic.id);
        const activationToastId = toast.loading(`Активация схемы "${schematic.name}"...`);

        try {
            const result = await logSchematicCompleted(dbUser.user_id, schematic.id, {
                prerequisites: schematic.prerequisites,
                kiloVibesAward: schematic.kiloVibesAwardOnCompletion,
                unlocksPerk: schematic.unlocksPerk,
                schematicName: schematic.name, 
                schematicIcon: schematic.completionAchievementIcon || schematic.icon 
            });

            if (result.success) {
                if (result.alreadyCompleted) {
                    toast.success(`Схема "${schematic.name}" уже была освоена ранее.`, { id: activationToastId });
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
                    
                    addToast(message, "success", 7000, { id: activationToastId, description: rewardDescription });
                    await fetchProfile(); 
                }
            } else {
                toast.error(result.error || `Ошибка активации схемы "${schematic.name}".`, { id: activationToastId, duration: 6000 });
            }
        } catch (error: any) {
            toast.error(`Критическая ошибка: ${error.message || 'Неизвестно'}`, { id: activationToastId, duration: 6000 });
        } finally {
            setActivatingSchematicId(null); 
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
            <VibeContentRenderer content="::FaSeedling className='text-6xl text-brand-green mx-auto mb-4 drop-shadow-[0_0_15px_theme(colors.brand-green)] animate-pulse'::" />
            <CardTitle className="text-3xl md:text-4xl font-orbitron font-bold text-brand-green cyber-text glitch" data-text="КИБЕР-ПИТАНИЕ">
              КИБЕР-ПИТАНИЕ
            </CardTitle>
            <CardDescription className="text-muted-foreground font-mono mt-1 text-sm md:text-base">
              Чертежи и Рецепты для Прокачки твоего Цифрового "Я".
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-8 p-6 md:p-8">
            {/* --- БЛОК С ОРИГИНАЛЬНЫМИ СХЕМАМИ --- */}
            {!isLoadingProfile && currentUserProfile && vibeSchematics.map(schematic => {
              const prereqStatus = checkPrerequisites(schematic, currentUserProfile);
              const isCompleted = currentUserProfile.featuresUsed[`schematic_completed_${schematic.id}`] === true;
              const canActivate = prereqStatus.met && !isCompleted;
              const isActivatingThis = activatingSchematicId === schematic.id;
              let statusLabel = isCompleted ? "ОСВОЕНО" : canActivate ? "ДОСТУПНО" : "ЗАБЛОКИРОВАНО";

              return (
              <motion.section 
                key={schematic.id} 
                className={`p-4 md:p-5 rounded-lg border ${schematic.color} shadow-lg ${schematic.shadow} transition-all duration-300 hover:scale-[1.015] hover:shadow-xl ${(isCompleted || !canActivate) ? 'opacity-60 grayscale-[30%]' : ''}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + vibeSchematics.indexOf(schematic) * 0.1 }}
              >
                  {/* ... здесь вся твоя оригинальная логика отображения карточки схемы, я ее не трогаю ... */}
                    <div className="flex justify-between items-start mb-2">
                        <h2 className="text-xl md:text-2xl font-orbitron mb-1 flex items-center gap-2">
                            <VibeContentRenderer content={`::${schematic.icon}::`} /> 
                            <span className="ml-1">{schematic.name}</span>
                            {isCompleted && <VibeContentRenderer content="::FaCheckCircle className='text-brand-green ml-2 text-lg'::" />}
                        </h2>
                        <span className={cn(`text-xs px-2 py-0.5 rounded-full font-mono font-semibold`, isCompleted ? "bg-brand-green/90 text-black" : canActivate ? "bg-brand-cyan/80 text-black" : "bg-destructive/80 text-destructive-foreground")} title={!canActivate ? prereqStatus.missing.join('\n') : ""}>
                            {statusLabel}
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3 font-mono whitespace-pre-line">{schematic.description}</p>
                    
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
              </motion.section>
              )
            })}

            {/* --- НОВЫЙ БЛОК: РЕЦЕПТЫ ДЛЯ ТВОРЦА --- */}
            <div id="neuro-kitchen" className="pt-8 mt-8 border-t-4 border-dashed border-fuchsia-500/50">
                <Card className="bg-black/40 border-2 border-fuchsia-500/70 shadow-2xl shadow-fuchsia-500/30">
                    <CardHeader className="text-center">
                        <VibeContentRenderer content="::FaBrainCircuit className='text-6xl text-fuchsia-400 mx-auto mb-4'::" />
                        <CardTitle className="text-3xl font-orbitron text-fuchsia-400">Нейро-Кухня</CardTitle>
                        <CardDescription className="font-mono text-fuchsia-200/70">От Потребления к Созиданию: Готовим Свои Вайбы</CardDescription>
                    </CardHeader>
                    <CardContent className="prose prose-invert max-w-none prose-strong:text-brand-yellow prose-a:text-brand-blue prose-a:no-underline hover:prose-a:underline prose-headings:font-orbitron prose-headings:text-brand-pink">

                        <p>Ты научился следовать рецептам. Теперь пришло время стать шеф-поваром. Эти гайды — твои первые уроки на Нейро-Кухне. Начнём с простого блюда, потом перейдём к высокой кухне.</p>
                        
                        <hr className="border-fuchsia-500/20 my-6"/>

                        <h4><VibeContentRenderer content="РЕЦЕПТ 1: Шишки (Создание Текстового Голема) ::FaCommentDots::" /></h4>
                        <p><strong>Суть:</strong> Создаём новую команду для Telegram-бота, не прикасаясь к коду напрямую.</p>
                        <ol className="list-decimal list-inside space-y-3 pl-4">
                          <li>
                            <strong>Замысел (Промпт):</strong> Говоришь Джинну (`OneSitePlsBot`): "Бро, хочу команду `/wisdom`, чтобы отвечала случайной мудростью. Сделай по аналогии с `/profile`".
                            <ScreenshotPlaceholder text="Твой текстовый промпт боту в Telegram." />
                          </li>
                          <li>
                            <strong>Ингредиенты (Контекст):</strong> Скармливаешь Джинну священные свитки, чтобы он прочухал вайб:
                            <PseudoCodeBlock>
{`// Показываешь ему эти файлы:
// - Главный портал (telegramWebhook/route.ts)
// - Главный шаман (commands/command-handler.ts)
// - Пример ритуала (commands/profile.ts)
// - Свиток с заклинанием отправки (actions.ts)`}
                            </PseudoCodeBlock>
                          </li>
                          <li>
                            <strong>Магия (Ответ AI):</strong> Джинн выдаёт тебе Markdown с псевдокодом для новой команды.
                             <PseudoCodeBlock>
{`// Вот что ты получишь:
// 1. Код для НОВОГО файла 'wisdom.ts'
function ритуал_мудрости(...) {
  отправить_случайную_цитату();
}

// 2. ИЗМЕНЕНИЯ для файла 'command-handler.ts'
else if (команда == "/wisdom") {
  ритуал_мудрости(...);
}`}
                            </PseudoCodeBlock>
                          </li>
                          <li>
                            <strong>Материализация (SuperVibe Studio):</strong> Копируешь ответ Джинна, идешь в <Link href="/repo-xml"><strong>SuperVibe Studio</strong></Link>, вставляешь и жмёшь "Создать request".
                            <div className="p-3 my-4 bg-yellow-900/40 border-l-4 border-brand-yellow rounded-md">
                                <VibeContentRenderer content="<strong>::FaExclamationTriangle:: Секретный Хак:</strong> Студия создаст PR с комментом `chore: Update image`, который GitHub Actions одобрит и смерджит АВТОМАТИЧЕСКИ. Твоя команда в проде. Без шума и пыли."/>
                            </div>
                          </li>
                        </ol>

                        <hr className="border-fuchsia-500/20 my-6"/>

                        <h4><VibeContentRenderer content="РЕЦЕПТ 2: Цветочки (Выращивание Цифрового Сада) ::FaLeaf::" /></h4>
                        <p><strong>Суть:</strong> То же самое, но круче. Создаём видимые вещи — компоненты и страницы для веб-приложения.</p>
                        <p>Процесс абсолютно тот же, что и с ботом, но на шаге №2 ты даешь Джинну другие ингредиенты (контекст):</p>
                         <PseudoCodeBlock>
{`// Для создания нового цветка (компонента),
// ты показываешь Джинну:

// - Пример похожего цветка (например, /components/ui/Button.tsx)
// - Место, где он будет расти (например, /app/profile/page.tsx)
// - И говоришь: "Сделай мне новый компонент 'КарточкаПрофиля'
//   по образу и подобию вот этого, и вставь его сюда".`}
                        </PseudoCodeBlock>
                        <p>Джинн сгенерирует тебе код для нового файла компонента и покажет, как его "посадить" (импортировать и использовать) на нужной странице. А дальше — знакомый ритуал через <Link href="/repo-xml">SuperVibe Studio</Link> и авто-мёрдж.</p>
                        
                        <hr className="border-fuchsia-500/20 my-6"/>

                        <h4><VibeContentRenderer content="РЕЦЕПТ 3: Нектар Богов (Работа с Базой Данных) ::FaDatabase::" /></h4>
                        <p><strong>Суть:</strong> Когда твоему цветку или голему нужно что-то запомнить или взять из вселенской кладовой (Supabase).</p>
                        <p>Это высший пилотаж, но принцип тот же. Вместо того чтобы писать SQL-заклинания, ты говоришь Джинну:</p>
                        <div className="p-3 my-4 bg-cyan-900/40 border-l-4 border-brand-cyan rounded-md">
                            <VibeContentRenderer content="«Бро, мне нужна новая таблица в базе для хранения мудрых цитат. Там должны быть поля: `id`, `text` и `author`. Создай для меня SQL-файл для этого.»"/>
                        </div>
                        <p>Джинн поймет эту "тарабарщину" и сгенерирует нужный SQL. А дальше... ты уже знаешь. <strong className="text-brand-green">Просто продолжай пыхтеть и творить.</strong></p>

                    </CardContent>
                </Card>
            </div>
            
            {/* --- ОРИГИНАЛЬНЫЕ КНОПКИ Fake Door --- */}
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

      {/* --- ОРИГИНАЛЬНЫЕ МОДАЛЬНЫЕ ОКНА --- */}
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