"use client";
import { useAppContext } from "@/contexts/AppContext";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox"; 
import { Label } from "@/components/ui/label";     
import AnimatedHeader from "@/components/AnimatedHeader";
import { FaSpinner, FaLock } from "react-icons/fa6"; 

import { useState, useEffect, useCallback } from "react"; 
import Modal from "@/components/ui/Modal"; 
import { toast } from "sonner";
import {
  fetchUserCyberFitnessProfile,
  CyberFitnessProfile,
  getAchievementDetails,
  Achievement,
  ALL_ACHIEVEMENTS, 
  checkAndUnlockFeatureAchievement, 
} from "@/hooks/cyberFitnessSupabase";
import { debugLogger as logger } from "@/lib/debugLogger";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip as RechartsTooltip } from 'recharts';
import VibeContentRenderer from "@/components/VibeContentRenderer";
import Link from "next/link";
import { format, startOfWeek, addDays } from 'date-fns'; 
import { ru } from 'date-fns/locale'; 
import { cn } from "@/lib/utils";

const PLACEHOLDER_AVATAR = "/placeholders/cyber-agent-avatar.png";

interface DailyActivityRecordForChart {
  date: string;
  filesExtracted: number;
  tokensProcessed: number;
  kworkRequestsSent: number;
  prsCreated: number;
  branchesUpdated: number;
  focusTimeMinutes?: number;
  value: number; 
  name: string; 
  label: string; 
}

const DEFAULT_WEEKLY_ACTIVITY_TEMPLATE: Array<DailyActivityRecordForChart> = Array.from({ length: 7 }).map((_, i) => {
    const dayOfWeek = startOfWeek(new Date(), { weekStartsOn: 1 }); 
    const date = addDays(dayOfWeek, i);
    return {
      name: format(date, 'EE', { locale: ru }).toUpperCase().substring(0, 2),
      value: 0,
      label: '0 VP', 
      date: format(date, 'yyyy-MM-dd'), 
      filesExtracted: 0,
      tokensProcessed: 0,
      kworkRequestsSent: 0,
      prsCreated: 0,
      branchesUpdated: 0,
      focusTimeMinutes: 0,
    };
});

const CHART_COLORS = [
  'hsl(var(--brand-cyan))', 'hsl(var(--brand-pink))', 'hsl(var(--brand-yellow))',
  'hsl(var(--brand-green))', 'hsl(var(--brand-orange))', 'hsl(var(--brand-purple))',
  'hsl(var(--neon-lime))'
];

const CustomTooltipContent = ({ active, payload, label }: any) => {
    if (active && payload && payload.length && payload[0].payload) {
      const data: DailyActivityRecordForChart = payload[0].payload; 
      return (
        <div className="bg-dark-card/95 backdrop-blur-sm text-light-text p-3 rounded-lg border border-brand-purple/50 shadow-xl text-xs font-mono max-w-[200px] sm:max-w-xs">
          <p className="font-bold text-brand-cyan mb-1.5">День: {label} <span className="text-muted-foreground text-2xs">({format(new Date(data.date + "T00:00:00Z"), 'dd MMM', {locale: ru})})</span></p>
          <p className="mb-1"><VibeContentRenderer content="::FaBolt::" /> <span className="font-semibold">Vibe Points:</span> {data.value.toFixed(0)}</p>
          
          {(data.focusTimeMinutes || 0) > 0 || (data.kworkRequestsSent || 0) > 0 || (data.filesExtracted || 0) > 0 || (data.tokensProcessed || 0) > 0 || (data.prsCreated || 0) > 0 || (data.branchesUpdated || 0) > 0 ? (
              <div className="space-y-0.5 mt-1 border-t border-brand-purple/20 pt-1">
                  {(data.focusTimeMinutes || 0) > 0 && <p><VibeContentRenderer content="::FaBrain className='text-pink-400'::" /> Фокус: {data.focusTimeMinutes} мин</p>}
                  {(data.kworkRequestsSent || 0) > 0 && <p><VibeContentRenderer content="::FaPaperPlane className='text-cyan-400'::" /> AI Запросы: {data.kworkRequestsSent}</p>}
                  {(data.filesExtracted || 0) > 0 && <p><VibeContentRenderer content="::FaDownload className='text-green-400'::" /> Файлов в контекст: {data.filesExtracted}</p>}
                  {(data.tokensProcessed || 0) > 0 && <p><VibeContentRenderer content="::FaRobot className='text-purple-400'::" /> Токенов AI: {data.tokensProcessed.toLocaleString()}</p>}
                  {(data.prsCreated || 0) > 0 && <p><VibeContentRenderer content="::FaGithub className='text-gray-300'::" /> PR создано: {data.prsCreated}</p>}
                  {(data.branchesUpdated || 0) > 0 && <p><VibeContentRenderer content="::FaCodeBranch className='text-orange-400'::" /> Веток обновлено: {data.branchesUpdated}</p>}
              </div>
          ) : (
              <p className="text-muted-foreground text-2xs italic mt-1">Нет детальной активности за этот день.</p>
          )}
        </div>
      );
    }
    return null;
  };

const getDefaultCyberFitnessProfile = (): CyberFitnessProfile => ({ 
    level: 0, kiloVibes: 0, focusTimeHours: 0, skillsLeveled: 0,
    activeQuests: ["initial_boot_sequence"], completedQuests: [], unlockedPerks: [],
    cognitiveOSVersion: "v0.1 Error/Guest", lastActivityTimestamp: new Date(0).toISOString(), 
    dailyActivityLog: [], achievements: [],
    totalFilesExtracted: 0, totalTokensProcessed: 0, totalKworkRequestsSent: 0,
    totalPrsCreated: 0, totalBranchesUpdated: 0, featuresUsed: {},
});

export default function ProfilePage() {
  const appContext = useAppContext();
  const { user: telegramUser, dbUser, isLoading: appLoading, isAuthenticating, error: appContextError } = appContext; 

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPerksModalOpen, setIsPerksModalOpen] = useState(false);
  const [isAchievementsModalOpen, setIsAchievementsModalOpen] = useState(false);

  const [cyberProfile, setCyberProfile] = useState<CyberFitnessProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);

  const [integrations, setIntegrations] = useState({
    github: false,
    vercel: false,
    supabase: false,
    aistudio: false, 
  });

  const userName = dbUser?.first_name || telegramUser?.first_name || 'Agent';
  const avatarUrl = dbUser?.avatar_url || telegramUser?.photo_url || PLACEHOLDER_AVATAR;

  const fetchProfileData = useCallback(async () => {
    if (appLoading || isAuthenticating) {
      setProfileLoading(true); 
      return;
    }
    setProfileLoading(true); 
    try {
        if (appContextError) {
          logger.error(`[ProfilePage] Error from AppContext: ${appContextError.message}. Defaulting.`);
           setCyberProfile(getDefaultCyberFitnessProfile()); 
           setIntegrations({ github: false, vercel: false, supabase: false, aistudio: false });
        } else if (dbUser?.user_id) {
          const result = await fetchUserCyberFitnessProfile(dbUser.user_id);
          if (result.success && result.data) {
            setCyberProfile(result.data);
            setIntegrations({ 
              github: result.data.featuresUsed?.integration_github_connected === true,
              vercel: result.data.featuresUsed?.integration_vercel_connected === true,
              supabase: result.data.featuresUsed?.integration_supabase_connected === true,
              aistudio: result.data.featuresUsed?.integration_aistudio_connected === true, 
            });
          } else {
            logger.warn(`[ProfilePage] Failed to load profile for ${dbUser.user_id}. Error: ${result.error}. Defaulting.`);
            setCyberProfile(getDefaultCyberFitnessProfile());
            setIntegrations({ github: false, vercel: false, supabase: false, aistudio: false });
          }
        } else {
          logger.info("[ProfilePage] No dbUser.user_id, using guest profile.");
          setCyberProfile(getDefaultCyberFitnessProfile());
          setIntegrations({ github: false, vercel: false, supabase: false, aistudio: false });
        }
    } catch(e: any) {
       logger.error(`[ProfilePage] Exception during profile loading:`, e);
       setCyberProfile(getDefaultCyberFitnessProfile());
       setIntegrations({ github: false, vercel: false, supabase: false, aistudio: false });
    } finally {
      setProfileLoading(false); 
    }
  }, [dbUser?.user_id, appLoading, isAuthenticating, appContextError]); 

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]); 

  const handleIntegrationChange = useCallback(async (integrationKey: keyof typeof integrations, isChecked: boolean) => {
    if (!dbUser?.user_id) { 
        toast.error("Профиль пользователя не загружен для обновления интеграций.");
        return;
    }

    const featureName = `integration_${integrationKey}_connected`; 
    logger.debug(`[ProfilePage] handleIntegrationChange: key='${integrationKey}', featureName='${featureName}', checked=${isChecked}`);

    setIntegrations(prev => ({ ...prev, [integrationKey]: isChecked }));
    const operationToastId = toast.loading(`${isChecked ? "Отметка" : "Снятие отметки"} интеграции с ${integrationKey}...`);
    
    const result = await checkAndUnlockFeatureAchievement(dbUser.user_id, featureName, isChecked);
    
    if (result.error) {
        toast.error(`Ошибка обновления статуса для ${integrationKey}: ${result.error}`, { id: operationToastId });
        setIntegrations(prev => ({ ...prev, [integrationKey]: !isChecked })); 
    } else {
        toast.success(`Интеграция с ${integrationKey} ${isChecked ? "отмечена" : "снята"}!`, { id: operationToastId });
        if (isChecked && result.newAchievements?.length) {
             result.newAchievements.forEach(ach => {
                 toast.info(`🏆 Ачивка: ${ach.name}!`, { description: ach.description, duration: 5000 });
            });
        }
        await fetchProfileData();
    }
  }, [dbUser?.user_id, fetchProfileData]);

  const isLoadingDisplay = appLoading || isAuthenticating || profileLoading;

  if (isLoadingDisplay && !cyberProfile) { 
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-4 text-center">
        <FaSpinner className="text-6xl text-brand-cyan animate-spin mb-8" />
        <h1 className="text-2xl font-orbitron text-brand-cyan animate-pulse tracking-wider">
          ДЕШИФРОВКА ПРОФИЛЯ АГЕНТА...
        </h1>
      </div>
    );
  }

  const safeCyberProfile = cyberProfile ?? getDefaultCyberFitnessProfile();

  const currentLevel = safeCyberProfile.level;
  const kiloVibes = safeCyberProfile.kiloVibes;
  const cognitiveOS = safeCyberProfile.cognitiveOSVersion;
  const unlockedPerks = safeCyberProfile.unlockedPerks;
  const userAchievements = safeCyberProfile.achievements; 
  const focusTime = parseFloat((safeCyberProfile.focusTimeHours || 0).toFixed(1));
  
  const displayWeeklyActivity: DailyActivityRecordForChart[] = DEFAULT_WEEKLY_ACTIVITY_TEMPLATE.map(templateDay => {
    const logEntry = safeCyberProfile.dailyActivityLog?.find(log => log.date === templateDay.date);
    if (logEntry) {
        const vibePoints = 
            (logEntry.filesExtracted * 0.1) +       
            (logEntry.tokensProcessed * 0.001) +   
            (logEntry.kworkRequestsSent * 5) +      
            (logEntry.prsCreated * 50) +           
            (logEntry.branchesUpdated * 20) +      
            ((logEntry.focusTimeMinutes || 0) * 0.5); 
        return {
            ...templateDay,
            value: vibePoints, 
            label: `${vibePoints.toFixed(0)} VP`,
            filesExtracted: logEntry.filesExtracted,
            tokensProcessed: logEntry.tokensProcessed,
            kworkRequestsSent: logEntry.kworkRequestsSent,
            prsCreated: logEntry.prsCreated,
            branchesUpdated: logEntry.branchesUpdated,
            focusTimeMinutes: logEntry.focusTimeMinutes || 0,
        };
    }
    return templateDay; 
});

  const stats = [
    { label: "KiloVibes", value: kiloVibes.toLocaleString(), icon: "::FaBolt className='text-brand-yellow text-3xl'::", tooltip: "Общее количество очков энергии Агента." },
    { label: "Deep Work (ч)", value: focusTime.toLocaleString(), icon: "::FaBrain className='text-brand-pink text-3xl'::", tooltip: "Суммарное время глубокой сфокусированной работы." },
    { label: "Достижения", value: userAchievements.length, icon: "::FaStar className='text-neon-lime text-3xl'::", tooltip: "Количество разблокированных уникальных достижений." },
    { label: "AI Запросы", value: safeCyberProfile.totalKworkRequestsSent.toLocaleString(), icon: "::FaPaperPlane className='text-brand-cyan text-3xl'::", tooltip: "Всего отправлено запросов к AI ассистентам." },
    { label: "PR Создано", value: safeCyberProfile.totalPrsCreated.toLocaleString(), icon: "::FaGithub className='text-light-text text-3xl'::", tooltip: "Всего создано Pull Request'ов через студию." },
    { label: "Веток Обновлено", value: safeCyberProfile.totalBranchesUpdated.toLocaleString(), icon: "::FaCodeBranch className='text-brand-purple text-3xl'::", tooltip: "Всего обновлено веток в репозиториях." },
    { label: "Файлов в Контекст", value: safeCyberProfile.totalFilesExtracted.toLocaleString(), icon: "::FaDownload className='text-brand-green text-3xl'::", tooltip: "Всего файлов добавлено в контекст для AI." },
    { label: "Токенов AI", value: (safeCyberProfile.totalTokensProcessed).toLocaleString(), icon: "::FaRobot className='text-brand-pink text-3xl'::", tooltip: "Примерное количество токенов, обработанных AI на основе ваших запросов." },
  ];

  const handleLogout = () => {
    toast.info("Функция выхода из системы в разработке. CyberVibe OS тебя не отпустит так просто!");
  };
  
  const handleFakeDoorClick = (featureName: string) => {
    toast.info(`Функция "${featureName}" находится в активной разработке и скоро будет доступна!`);
  };

  const allPossibleNonDynamicAchievements = ALL_ACHIEVEMENTS.filter(ach => !ach.isQuest && !ach.isDynamic);
  
  const allUnlockedAchievementDetails = userAchievements
    .map(id => getAchievementDetails(id))
    .filter((ach): ach is Achievement => !!ach);

  const allDisplayableAchievements = [...allPossibleNonDynamicAchievements];
  allUnlockedAchievementDetails.forEach(unlockedAch => {
      if (unlockedAch.isDynamic && !allDisplayableAchievements.find(dispAch => dispAch.id === unlockedAch.id)) {
          allDisplayableAchievements.push(unlockedAch);
      }
  });
  
  const integrationItems = [
    {id: "github" as keyof typeof integrations, label: "GitHub (Токен для PR/веток)", icon: "FaGithub"},
    {id: "vercel" as keyof typeof integrations, label: "Vercel (Деплой проектов)", icon: "FaBolt"},
    {id: "supabase" as keyof typeof integrations, label: "Supabase (База данных & Auth)", icon: "FaDatabase"},
    {id: "aistudio" as keyof typeof integrations, label: "AI Studio (OpenAI/Gemini/Claude)", icon: "FaRobot"}, 
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-black to-dark-card text-light-text p-4 pb-16">
      <AnimatedHeader avatarUrl={avatarUrl} username={userName} />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }} // Added delay to sync with header animation
        className="container mx-auto max-w-3xl" 
      >
        <Card className="bg-dark-card/90 backdrop-blur-xl border border-brand-purple/60 shadow-2xl shadow-purple-glow">
          <CardHeader className="text-center p-6 md:p-8 border-b border-brand-purple/40">
            <div className="mt-3 text-sm font-mono text-brand-yellow">
              Level: {currentLevel} | Cognitive OS: {cognitiveOS}
            </div>
             {dbUser?.subscription_id && dbUser.subscription_id !== "cyber_initiate_free_demo" && (
                <div className="mt-2 text-xs font-mono text-brand-green">
                    Активный план: <span className="font-semibold">{dbUser.subscription_id}</span>
                </div>
            )}
          </CardHeader>

          <CardContent className="space-y-8 p-6 md:p-8">
            <section>
              <h2 className="text-2xl font-orbitron text-brand-pink mb-4 flex items-center gap-2"> 
                <VibeContentRenderer content="::FaChartLine::" />Кибер-Метрики Агента
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {stats.map((stat) => (
                  <Card key={stat.label} className="bg-dark-bg/80 p-3 sm:p-4 text-center border border-brand-cyan/40 hover:shadow-brand-cyan/30 hover:shadow-lg transition-all duration-300 rounded-lg hover:border-brand-cyan/70 hover:-translate-y-1 cursor-help" title={stat.tooltip}>
                    <div className="mb-1.5 sm:mb-2 mx-auto text-2xl sm:text-3xl"><VibeContentRenderer content={stat.icon} /></div>
                    <p className="text-xl sm:text-2xl font-orbitron font-bold text-light-text">{stat.value}</p>
                    <p className="text-xs text-muted-foreground font-mono uppercase tracking-tight leading-tight">{stat.label}</p>
                  </Card>
                ))}
              </div>
            </section>

            <section>
                <h2 className="text-2xl font-orbitron text-brand-green mb-4 flex items-center gap-2"> 
                    <VibeContentRenderer content="::FaListCheck::" />Недельная Активность (Vibe Points)
                </h2>
                <Card className="bg-dark-bg/80 p-4 border border-brand-green/40 rounded-lg shadow-md">
                    <div className="h-[150px] w-full"> 
                        <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={displayWeeklyActivity} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}> 
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} dy={5}/>
                            <YAxis hide={true} domain={[0, 'dataMax + 20']} />
                            <RechartsTooltip
                                cursor={{ fill: 'hsla(var(--brand-purple), 0.15)' }}
                                content={<CustomTooltipContent />}
                            />
                            <Bar dataKey="value" radius={[3, 3, 0, 0]} barSize={20} minPointSize={3}>
                            {displayWeeklyActivity.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} fillOpacity={0.9} className="transition-opacity duration-200 hover:opacity-100" />
                            ))}
                            </Bar>
                        </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </section>

            <section>
              <h2 className="text-2xl font-orbitron text-brand-yellow mb-4 flex items-center gap-2"> 
                <VibeContentRenderer content="::FaWandMagicSparkles::" />Разблокированные Перки ({unlockedPerks.length})
              </h2>
              <div className="p-4 bg-dark-bg/80 rounded-lg border border-brand-yellow/40 space-y-2 shadow-md">
                {unlockedPerks.length > 0 ? (
                  unlockedPerks.slice(0, 5).map((perk, index) => ( 
                    <div key={index} className="flex items-center text-sm text-light-text font-mono">
                      <VibeContentRenderer content="::FaBolt className='text-brand-yellow mr-2 text-xs'::" /> {perk}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground font-mono">Нет активных перков. Время прокачиваться, Агент!</p>
                )}
                {(unlockedPerks.length > 5 || unlockedPerks.length === 0) && (
                  <Button variant="link" size="sm" className="text-brand-yellow p-0 h-auto font-mono text-xs hover:text-yellow-300 mt-1" onClick={() => setIsPerksModalOpen(true)}>
                    {unlockedPerks.length > 5 ? `Показать все (${unlockedPerks.length})` : "Узнать о Перках"} <VibeContentRenderer content="::FaChevronRight className='ml-1 w-3 h-3'::" />
                  </Button>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-orbitron text-neon-lime mb-4 flex items-center gap-2"> 
                <VibeContentRenderer content="::FaStar::" />Достижения Агента ({userAchievements.length} / {allDisplayableAchievements.length})
              </h2>
              <div className="p-4 bg-dark-bg/80 rounded-lg border border-neon-lime/40 space-y-2 shadow-md">
                {allDisplayableAchievements.length > 0 ? (
                  allDisplayableAchievements.slice(0,5).map((ach) => { 
                    const isUnlocked = userAchievements.includes(ach.id);
                    return (
                      <div key={ach.id} 
                           className={cn("flex items-center text-sm font-mono transition-opacity", isUnlocked ? "text-light-text" : "text-muted-foreground opacity-60")} 
                           title={ach.description + (isUnlocked ? " (Разблокировано)" : " (Заблокировано)")}
                      >
                         <span className={cn("mr-2 w-4 h-4 flex items-center justify-center", isUnlocked ? "" : "filter grayscale")}>
                             <VibeContentRenderer content={`::${ach.icon || 'FaMedal'}::`} />
                         </span>
                         <span>{ach.name}</span>
                         {!isUnlocked && <FaLock className="ml-auto text-xs text-gray-500" />}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground font-mono">Список достижений загружается...</p>
                )}
                 <Button variant="link" size="sm" className="text-neon-lime p-0 h-auto font-mono text-xs hover:text-lime-300 mt-1" onClick={() => setIsAchievementsModalOpen(true)}>
                    {`Все Достижения (${userAchievements.length}/${allDisplayableAchievements.length})`} <VibeContentRenderer content="::FaChevronRight className='ml-1 w-3 h-3'::" />
                 </Button>
              </div>
            </section>

            <section>
                <h2 className="text-2xl font-orbitron text-brand-blue mb-4 flex items-center gap-2"> 
                    <VibeContentRenderer content="::FaPlug::" /> Мои Интеграции
                </h2>
                <Card className="bg-dark-bg/70 border-brand-blue/30 p-4 space-y-3">
                    <p className="text-xs text-muted-foreground font-mono mb-3">Отметьте сервисы, с которыми вы успешно настроили интеграцию или имеете аккаунт для работы в CyberVibe Studio.</p>
                    {integrationItems.map(item => (
                        <div key={item.id} className="flex items-center space-x-2">
                            <Checkbox 
                                id={`integration-${item.id}`} 
                                checked={integrations[item.id]}
                                onCheckedChange={(checked) => handleIntegrationChange(item.id, !!checked)}
                                className="data-[state=checked]:bg-brand-blue data-[state=checked]:border-brand-blue border-muted-foreground"
                            />
                            <Label htmlFor={`integration-${item.id}`} className="text-sm font-mono text-light-text flex items-center gap-2 cursor-pointer">
                                <VibeContentRenderer content={`::${item.icon}::`} /> {item.label}
                            </Label>
                        </div>
                    ))}
                </Card>
            </section>

            <section>
                <h2 className="text-2xl font-orbitron text-brand-purple mb-4 flex items-center gap-2"> 
                    <VibeContentRenderer content="::FaGears::" /> Системные Модули (Скоро)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Card className="bg-dark-bg/70 border-brand-purple/30 hover:border-brand-purple/60 transition-colors">
                        <CardHeader>
                            <CardTitle className="text-brand-purple text-lg font-orbitron flex items-center gap-2"><VibeContentRenderer content="::FaUserAstronaut::" /> Мои XTR Автоматизации</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground font-mono mb-3">Создание и управление кастомными сценариями автоматизации CyberVibe.</p>
                             <Button variant="outline" className="border-brand-purple/50 text-brand-purple/80 hover:bg-brand-purple/10 hover:text-brand-purple w-full text-xs" onClick={() => handleFakeDoorClick("Конструктор XTR")}>Конструктор XTR (WIP)</Button>
                        </CardContent>
                    </Card>
                     <Card className="bg-dark-bg/70 border-brand-purple/30 hover:border-brand-purple/60 transition-colors">
                        <CardHeader>
                            <CardTitle className="text-brand-purple text-lg font-orbitron flex items-center gap-2"><VibeContentRenderer content="::FaChartPie::" /> Статистика Продуктивности</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground font-mono mb-3">Детальные графики вашей активности, эффективности и прогресса по скиллам.</p>
                            <Button variant="outline" className="border-brand-purple/50 text-brand-purple/80 hover:bg-brand-purple/10 hover:text-brand-purple w-full text-xs" onClick={() => handleFakeDoorClick("Дашборд Продуктивности")}>Открыть Дашборд (WIP)</Button>
                        </CardContent>
                    </Card>
                </div>
            </section>

            <section className="flex flex-col sm:flex-row gap-4 mt-8">
              <Button 
                onClick={() => setIsEditModalOpen(true)}
                className="flex-1 bg-brand-cyan text-black hover:bg-brand-cyan/80 font-orbitron shadow-lg hover:shadow-brand-cyan/50 transition-all py-3 text-base flex items-center justify-center"
              >
                <VibeContentRenderer content="::FaPenToSquare::" /><span className="ml-2">Изменить Профиль</span>
              </Button>
              <Button 
                onClick={handleLogout}
                variant="outline" 
                className="flex-1 border-brand-red text-brand-red hover:bg-brand-red/20 hover:text-white font-orbitron shadow-lg hover:shadow-brand-red/50 transition-all py-3 text-base flex items-center justify-center"
              >
                <VibeContentRenderer content="::FaRightFromBracket::" /><span className="ml-2">Деавторизация</span>
              </Button>
            </section>
          </CardContent>
        </Card>
      </motion.div>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Редактирование Профиля Агента"
        confirmText="Сохранить Изменения"
        onConfirm={() => {
          handleFakeDoorClick("Сохранение изменений профиля");
          setIsEditModalOpen(false);
        }}
        dialogClassName="bg-dark-card border-brand-purple text-light-text"
        titleClassName="text-brand-cyan"
        confirmButtonClassName="bg-brand-green hover:bg-brand-green/80 text-black"
        cancelButtonClassName="text-muted-foreground hover:bg-muted/50"
      >
        <p className="font-mono text-sm text-muted-foreground">Здесь будет форма для изменения вашего отображаемого имени, аватара, и других настроек CyberFitness.</p>
        <p className="mt-2 text-xs text-brand-yellow font-mono">Интерфейс модификации личности временно недоступен...</p> 
      </Modal>

      <Modal
        isOpen={isPerksModalOpen}
        onClose={() => setIsPerksModalOpen(false)}
        title="Арсенал Перков"
        showConfirmButton={false}
        cancelText="Закрыть Капсулу"
        dialogClassName="bg-dark-card border-brand-yellow text-light-text"
        titleClassName="text-brand-yellow"
        cancelButtonClassName="text-muted-foreground hover:bg-muted/50"
      >
        <div className="max-h-72 overflow-y-auto simple-scrollbar pr-2">
            {unlockedPerks.length > 0 ? (
                <ul className="list-none space-y-2.5">
                {unlockedPerks.map((perk, index) => (
                    <li key={index} className="flex items-center p-3 bg-dark-bg/70 rounded-md border border-brand-purple/60 shadow-sm hover:border-brand-purple transition-colors">
                        <VibeContentRenderer content="::FaShieldHalved className='text-brand-purple mr-3 text-xl flex-shrink-0'::" />
                        <span className="text-sm">{perk}</span>
                    </li>
                ))}
                </ul>
            ) : (
                <p className="font-mono text-sm text-muted-foreground p-4 text-center">Банк перков пуст. Отправляйся в <Link href="/selfdev/gamified" className="text-brand-green hover:underline font-semibold" onClick={() => setIsPerksModalOpen(false)}>CyberDev OS</Link> за апгрейдами!</p>
            )}
        </div>
        <p className="mt-4 text-xs text-brand-yellow font-mono text-center">Синхронизация с банком перков завершена...</p> 
      </Modal>

      <Modal
        isOpen={isAchievementsModalOpen}
        onClose={() => setIsAchievementsModalOpen(false)}
        title={`Зал Славы Агента (${userAchievements.length}/${allDisplayableAchievements.length})`}
        showConfirmButton={false}
        cancelText="Закрыть Витрину"
        dialogClassName="bg-dark-card border-neon-lime text-light-text"
        titleClassName="text-neon-lime"
        cancelButtonClassName="text-muted-foreground hover:bg-muted/50"
      >
        <div className="max-h-96 overflow-y-auto simple-scrollbar pr-2 space-y-3">
            {allDisplayableAchievements.length > 0 ? (
                allDisplayableAchievements
                  .sort((a,b) => { 
                      const aUnlocked = userAchievements.includes(a.id);
                      const bUnlocked = userAchievements.includes(b.id);
                      if (aUnlocked && !bUnlocked) return -1;
                      if (!aUnlocked && bUnlocked) return 1;
                      return a.name.localeCompare(b.name);
                  })
                  .map((achievement) => {
                    const isUnlocked = userAchievements.includes(achievement.id);
                    return (
                        <div key={achievement.id} className={cn(
                            "p-3.5 bg-dark-bg/70 border rounded-lg transform transition-all duration-200 ease-out",
                            isUnlocked ? "border-neon-lime/60 hover:scale-[1.02] hover:shadow-md hover:shadow-neon-lime/30" : "border-muted/30 opacity-60 grayscale-[70%]"
                            )}
                        >
                            <div className="flex items-center mb-1">
                                <span className={cn("text-2xl mr-3")}>
                                    <VibeContentRenderer content={`::${achievement.icon || 'FaMedal'} className='${isUnlocked ? '' : 'opacity-50'}'::`} />
                                </span>
                                <h4 className={cn("text-md font-orbitron font-semibold", isUnlocked ? "text-neon-lime" : "text-muted-foreground")}>{achievement.name}</h4>
                                {!isUnlocked && <FaLock className="ml-auto text-xs text-gray-500" />}
                            </div>
                            <p className="text-xs text-muted-foreground font-mono ml-9">{achievement.description}</p>
                             {achievement.kiloVibesAward && isUnlocked && (
                                <p className="text-xs text-brand-yellow font-mono ml-9 mt-1">+ {achievement.kiloVibesAward.toLocaleString()} KiloVibes</p>
                             )}
                        </div>
                    );
                })
            ) : (
                 <p className="font-mono text-sm text-muted-foreground text-center py-4">Список достижений пуст.</p>
            )}
        </div>
         <p className="mt-3 text-xs text-brand-yellow font-mono text-center">Каждая строка кода, каждый коммит — шаг к величию...</p> 
      </Modal>
    </div>
  );
}