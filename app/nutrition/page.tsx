"use client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
// Icons are now rendered via VibeContentRenderer
import { useState, useEffect } from "react"; 
import Modal from "@/components/ui/Modal"; 
import { toast } from "sonner";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { useAppContext } from "@/contexts/AppContext"; 
import { 
    CyberFitnessProfile, 
    fetchUserCyberFitnessProfile, 
    getAchievementDetails,
    Achievement // For typing if we pass full achievement objects
} from "@/hooks/cyberFitnessSupabase"; 
import { debugLogger as logger } from "@/lib/debugLogger";
import Link from "next/link"; // For linking to relevant studio parts

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
  relatedAchievement?: string; // ID of an achievement this schematic helps towards or represents
  color: string; 
  shadow: string; 
}


const vibeSchematics: VibeSchematic[] = [
  {
    id: "deep_work_sprint",
    name: "Схема 'ТУРБО-МОЗГ'",
    icon: "FaBolt", 
    description: "Вруби нитро для своих идей и кода! Этот 90-минутный спринт выжмет из тебя максимум.",
    details: [
      { label: "ВЫГОДА", content: "Молниеносное завершение задач, генерация контента как из пулемета.", icon: "FaStar"},
      { label: "МЕХАНИКА", content: "2x(40 мин чистейшего фокуса + 5 мин перезарядки). Безжалостно к прокрастинации.", icon: "FaToolbox"}, // Changed from FaCogs
      { label: "АРСЕНАЛ", content: "::FaAtom className='inline text-brand-purple mr-1 align-middle':: AI-ассистент, глушители реальности (наушники), таймер-контроллер.", icon: "FaToolbox"}, 
      { label: "ТОПЛИВО", content: "Кристальная вода, эликсир зеленого чая. Сахар – ЯД для кибер-воина.", icon: "FaGlassWater"},
    ],
    prerequisites: ["level:1", "featureUsed:deep_work_logged"], // Example: requires level 1 and having logged deep work once
    outcome: "Высокая продуктивность, быстрое выполнение задач.",
    relatedAchievement: "deep_work_logged",
    color: "border-brand-orange/60 bg-dark-card/70 hover:shadow-brand-orange/30",
    shadow: "shadow-brand-orange/20"
  },
  {
    id: "skill_acquisition_module",
    name: "Схема 'VIBE-АПГРЕЙД'",
    icon: "FaLightbulb", 
    description: "Загрузи новый скилл или Vibe Perk в свою нейросеть. Стань машиной обучения.",
    details: [
      { label: "ВЫГОДА", content: "Мгновенное расширение твоего Vibe-арсенала, доминация в новой нише.", icon: "FaStar"},
      { label: "МЕХАНИКА", content: "AI объясняет суть -> Ты практикуешь как одержимый -> Интервальное вбивание в мозг.", icon: "FaToolbox"}, // Changed
      { label: "АРСЕНАЛ", content: "::FaAtom className='inline text-brand-purple mr-1 align-middle':: AI-сенсей, Anki/Quizlet, сверхсекретные туториалы.", icon: "FaBookOpen"}, 
      { label: "ТОПЛИВО", content: "Высокооктановые углеводы для процессора (гречка, овсянка, киноа).", icon: "FaBowlFood"},
    ],
    prerequisites: ["level:2", "achievement:first_parse_completed"],
    outcome: "Освоен новый навык или перк.",
    unlocksPerk: "Адаптивное Обучение",
    color: "border-brand-yellow/60 bg-dark-card/70 hover:shadow-brand-yellow/30",
    shadow: "shadow-brand-yellow/20"
  },
  {
    id: "mind_recharge_cycle",
    name: "Схема 'НЕЙРО-ДЕТОКС'",
    icon: "FaBrain", 
    description: "Перезагрузи матрицу сознания. Очисти кэш. Сгенерируй идеи, которые взорвут рынок.",
    details: [
      { label: "ВЫГОДА", content: "Сброс умственной усталости, кристальная ясность, поток гениальных идей.", icon: "FaStar"},
      { label: "МЕХАНИКА", content: "15-20 мин медитации 'Нулевой Канал' или прогулка 'Альфа-Волны'. После – 10 мин 'Взрыв Идей' фрирайтингом.", icon: "FaToolbox"}, // Changed
      { label: "АРСЕНАЛ", content: "Приложение для медитации, блокнот или цифровые скрижали.", icon: "FaBook"},
      { label: "ТОПЛИВО", content: "Эликсир травяного чая, орехи мудрости.", icon: "FaMugHot"},
    ],
    prerequisites: [], 
    outcome: "Повышенная креативность, снижение умственного напряжения.",
    color: "border-brand-cyan/60 bg-dark-card/70 hover:shadow-brand-cyan/30",
    shadow: "shadow-brand-cyan/20"
  },
  // --- NEW SCHEMATICS ---
  {
    id: "error_fix_pro",
    name: "Схема 'БАГ-ХАНТЕР ПРО'",
    icon: "FaBugSlash",
    description: "Мастерски устраняй ошибки, используя логи и контекст для точного удара по багам.",
    details: [
      { label: "ВЫГОДА", content: "Быстрое и эффективное исправление ошибок, повышение стабильности кода.", icon: "FaShieldHalved" },
      { label: "МЕХАНИКА", content: "Запускай ErrorFix Flow из Оверлея Ошибок -> Внимательно изучай логи в KWork -> Предоставляй AI максимально точный контекст (1-3 файла).", icon: "FaToolbox" },
      { label: "АРСЕНАЛ", content: "SuperVibe Studio, Оверлей Ошибок, Vercel/GitHub логи.", icon: "FaMagnifyingGlassChart" },
      { label: "ТРЕБУЕТ", content: "Перк 'Анализ Логов Ошибок', Ачивка 'Диагност'.", icon: "FaUserSecret" }
    ],
    prerequisites: ["level:4", "perk:Анализ Логов Ошибок (Lv.3 Flow)", "achievement:copy_logs_used"],
    outcome: "Точный фикс бага с минимальными итерациями AI, созданный PR.",
    relatedAchievement: "autofix_used", // Could lead to this if AI suggests and user applies autofix
    color: "border-red-500/60 bg-dark-card/70 hover:shadow-red-500/30",
    shadow: "shadow-red-500/20"
  },
  {
    id: "contextual_code_gen",
    name: "Схема 'КОНТЕКСТНЫЙ ГЕНЕЗИС'",
    icon: "FaMagicWandSparkles", // Corrected icon name
    description: "Генерируй новый код и фичи, предоставляя AI обширный и релевантный контекст.",
    details: [
      { label: "ВЫГОДА", content: "Создание сложных компонентов или новой функциональности с пониманием AI зависимостей.", icon: "FaLightbulb" },
      { label: "МЕХАНИКА", content: "Используй 'Выбрать Связанные Файлы' -> 'Добавить все файлы + дерево' -> Точно формулируй задачу для AI.", icon: "FaToolbox" },
      { label: "АРСЕНАЛ", content: "SuperVibe Studio (Экстрактор + Ассистент), системный супер-промпт.", icon: "FaSitemap" },
      { label: "ТРЕБУЕТ", content: "Ачивки 'Архитектор Контекста' и 'Меткий Стрелок'.", icon: "FaBrain" }
    ],
    prerequisites: ["level:5", "achievement:architect", "achievement:sharpshooter"],
    outcome: "Новый компонент/фича, интегрированные в проект, готовый PR.",
    unlocksPerk: "Продвинутый Рефакторинг с AI",
    relatedAchievement: "token_economist_2", // High context usually means more tokens
    color: "border-brand-blue/60 bg-dark-card/70 hover:shadow-brand-blue/30",
    shadow: "shadow-brand-blue/20"
  },
  {
    id: "pr_pipeline_master",
    name: "Схема 'КОНВЕЙЕР PR'",
    icon: "FaTasks", // Corrected icon name
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
    shadow: "shadow-brand-purple/20"
  },
  {
    id: "image_guru",
    name: "Схема 'ВИЗУАЛЬНЫЙ АЛХИМИК'",
    icon: "FaImage", // Corrected icon name
    description: "Мастерски управляй изображениями: от замены битых ссылок до генерации плейсхолдеров и загрузки новых ассетов.",
    details: [
      { label: "ВЫГОДА", content: "Всегда актуальные и рабочие изображения в проекте, эстетичный UI.", icon: "FaPalette" },
      { label: "МЕХАНИКА", content: "Используй ImageReplace Flow (Lv.1) для быстрых фиксов. Для новых картинок – Модальное Окно Картинок в Ассистенте -> prompts_imgs.txt -> AI генерит ссылки.", icon: "FaToolbox"},
      { label: "АРСЕНАЛ", content: "AutomationBuddy, StickyChat, AI Assistant (Image Tools), prompts_imgs.txt.", icon: "FaImages"},
      { label: "ТРЕБУЕТ", content: "Ачивка 'Визуальный Коннект', Перк 'Авто-PR для Замены Изображений'.", icon: "FaLink"}
    ],
    prerequisites: ["level:2", "featureUsed:image_modal_opened", "perk:Авто-PR для Замены Изображений"],
    outcome: "Обновленные или новые изображения в проекте, автоматизированные PR.",
    color: "border-pink-500/60 bg-dark-card/70 hover:shadow-pink-500/30",
    shadow: "shadow-pink-500/20"
  }
];

export default function VibeSchematicsPage() {
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<CyberFitnessProfile | null>(null);
  const { dbUser } = useAppContext();

  useEffect(() => {
    if (dbUser?.user_id) {
      fetchUserCyberFitnessProfile(dbUser.user_id).then(result => {
        if (result.success && result.data) {
          setCurrentUserProfile(result.data);
        } else {
          logger.warn("Failed to fetch user profile for schematics page.");
        }
      });
    }
  }, [dbUser]);
  
  const handleAction = (actionName: string, schematicId?: string) => {
    if (schematicId) {
        toast.info(`Активация схемы "${vibeSchematics.find(s=>s.id === schematicId)?.name || schematicId}" в разработке.`);
    } else {
        toast.info(`Функция "${actionName}" в разработке в лаборатории CyberVibe.`);
    }
  };

  const checkPrerequisites = (schematic: VibeSchematic): { met: boolean; missing: string[] } => {
    if (!currentUserProfile) return { met: false, missing: ["Загрузка профиля..."] }; 

    const missingPrerequisites: string[] = [];
    let allMet = true;

    schematic.prerequisites.forEach(prereq => {
      const [type, value] = prereq.split(':');
      let currentMet = false;
      if (type === 'level' && currentUserProfile.level >= parseInt(value, 10)) {
        currentMet = true;
      } else if (type === 'achievement' && currentUserProfile.achievements.includes(value)) {
        currentMet = true;
      } else if (type === 'perk' && currentUserProfile.unlockedPerks.includes(value)) {
        currentMet = true;
      } else if (type === 'featureUsed' && currentUserProfile.featuresUsed[value]) {
        currentMet = true;
      }
      
      if (!currentMet) {
        allMet = false;
        if (type === 'level') missingPrerequisites.push(`Требуется Уровень ${value}`);
        else if (type === 'achievement') {
            const ach = getAchievementDetails(value); 
            missingPrerequisites.push(`Нужно достижение: "${ach?.name || value}"`);
        }
        else if (type === 'perk') missingPrerequisites.push(`Нужен перк: "${value}"`);
        else missingPrerequisites.push(`Требование: ${prereq}`);
      }
    });
    return { met: allMet, missing: missingPrerequisites };
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
            {vibeSchematics.map(schematic => {
              const prereqStatus = currentUserProfile ? checkPrerequisites(schematic) : { met: false, missing: ["Профиль не загружен"]};
              const status = schematic.prerequisites.length === 0 || !currentUserProfile ? 'available' : (prereqStatus.met ? 'available' : 'locked'); // Assume available if profile not loaded yet

              return (
              <motion.section 
                key={schematic.id} 
                className={`p-4 md:p-5 rounded-lg border ${schematic.color} shadow-lg ${schematic.shadow} transition-all duration-300 hover:scale-[1.015] hover:shadow-xl hover:${schematic.shadow.replace('/20','/40')} ${status === 'locked' ? 'opacity-50 grayscale-[50%]' : ''}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + vibeSchematics.indexOf(schematic) * 0.1 }}
              >
                <div className="flex justify-between items-start mb-2">
                    <h2 className="text-xl md:text-2xl font-orbitron mb-1 flex items-center gap-2">
                        <VibeContentRenderer content={`::${schematic.icon}::`} /> 
                        <span className="ml-1">{schematic.name}</span>
                    </h2>
                    {status === 'locked' ? (
                        <span className="text-xs bg-destructive/80 text-destructive-foreground px-2 py-0.5 rounded-full font-mono" title={prereqStatus.missing.join('\n')}>ЗАБЛОКИРОВАНО</span>
                    ) : status === 'available' ? (
                        <span className="text-xs bg-brand-green/80 text-black px-2 py-0.5 rounded-full font-mono font-semibold">ДОСТУПНО</span>
                    ): (
                        <span className="text-xs bg-muted/80 text-muted-foreground px-2 py-0.5 rounded-full font-mono">ЗАГРУЗКА...</span>
                    )}
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
                    {schematic.relatedAchievement && getAchievementDetails(schematic.relatedAchievement) && (
                        <p className="text-xs font-mono"><strong className="text-neon-lime">Связано с Ачивкой:</strong> <Link href="/profile#achievements" className="hover:underline">{getAchievementDetails(schematic.relatedAchievement)?.name}</Link></p>
                    )}
                </div>
                 {status === 'available' && (
                    <Button 
                        size="sm" 
                        className="mt-4 w-full bg-gradient-to-r from-brand-cyan to-brand-blue text-white hover:brightness-110 font-orbitron text-sm py-2"
                        onClick={() => handleAction(`Запуск схемы: ${schematic.name}`, schematic.id)}
                    >
                       <VibeContentRenderer content="::FaBolt::" /> <span className="ml-2">АКТИВИРОВАТЬ СХЕМУ</span>
                    </Button>
                 )}
              </motion.section>
            )})}
            
            <section className="flex flex-col sm:flex-row gap-4 justify-center pt-8 border-t border-brand-green/30 mt-8">
              <Button onClick={() => { setIsSaveModalOpen(true); }} className="bg-gradient-to-r from-brand-green to-neon-lime text-black hover:brightness-110 font-orbitron flex-1 py-3 text-base transform hover:scale-105 transition-all shadow-lg hover:shadow-brand-green/40 flex items-center justify-center">
                <VibeContentRenderer content="::FaFloppyDisk className='mr-2.5 align-middle text-lg'::" /> <span className="ml-2">СОХРАНИТЬ МОЙ СТЕК!</span>
              </Button>
              <Button onClick={() => { setIsSuggestModalOpen(true); }} variant="outline" className="border-brand-cyan text-brand-cyan hover:bg-brand-cyan/20 hover:text-white font-orbitron flex-1 py-3 text-base transform hover:scale-105 transition-all shadow-lg hover:shadow-brand-cyan/30 flex items-center justify-center">
                <VibeContentRenderer content="::FaCirclePlus className='mr-2.5 align-middle text-lg'::" /> <span className="ml-2">ПРЕДЛОЖИТЬ СХЕМУ</span>
              </Button>
              <Button onClick={() => { setIsLogModalOpen(true); }} variant="outline" className="border-brand-purple text-brand-purple hover:bg-brand-purple/20 hover:text-white font-orbitron flex-1 py-3 text-base transform hover:scale-105 transition-all shadow-lg hover:shadow-brand-purple/30 flex items-center justify-center">
                <VibeContentRenderer content="::FaListCheck className='mr-2.5 align-middle text-lg'::" /> <span className="ml-2">ЛОГИРОВАТЬ АКТИВНОСТЬ</span>
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
        onConfirm={() => { handleAction("Сохранить Стек Схем"); setIsSaveModalOpen(false); }}
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
        onConfirm={() => { handleAction("Предложить Схему Вайба"); setIsSuggestModalOpen(false); }}
        dialogClassName="bg-dark-card border-brand-cyan text-light-text"
        titleClassName="text-brand-cyan"
        confirmButtonClassName="bg-brand-cyan hover:bg-brand-cyan/80 text-black"
        cancelButtonClassName="text-muted-foreground hover:bg-muted/50"
      >
        <p className="font-mono text-sm text-muted-foreground">Есть идея для новой кибернетической схемы? Опишите ее здесь! Ваш вклад поможет расширить арсенал CyberVibe. В разработке...</p>
      </Modal>
      <Modal 
        isOpen={isLogModalOpen} 
        onClose={() => setIsLogModalOpen(false)} 
        title="Логирование Когнитивной Активности" 
        confirmText="Записать в Лог" 
        onConfirm={() => { handleAction("Залогировать Активность"); setIsLogModalOpen(false); }}
        dialogClassName="bg-dark-card border-brand-purple text-light-text"
        titleClassName="text-brand-purple"
        confirmButtonClassName="bg-brand-purple hover:bg-brand-purple/80 text-black"
        cancelButtonClassName="text-muted-foreground hover:bg-muted/50"
        >
        <p className="font-mono text-sm text-muted-foreground">Отметьте завершение схемы, чтобы отслеживать свой прогресс и KiloVibes. Интеграция с CyberFitness Dashboard скоро...</p>
      </Modal>
    </div>
  );
}