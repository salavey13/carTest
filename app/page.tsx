"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { debugLogger as logger } from "@/lib/debugLogger";
import { useAppContext } from "@/contexts/AppContext";
import { motion } from "framer-motion";
import { FaSpinner } from "react-icons/fa6"; 
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip as RechartsTooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Image from "next/image";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import {
  fetchUserCyberFitnessProfile,
  CyberFitnessProfile,
  DailyActivityRecord, 
} from "@/hooks/cyberFitnessSupabase";
import { format, startOfWeek, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';

const CHART_COLORS = [
  'hsl(var(--brand-purple))', 'hsl(var(--brand-pink))', 'hsl(var(--brand-cyan))',
  'hsl(var(--brand-blue))', 'hsl(var(--brand-yellow))', 'hsl(var(--brand-green))',
  'hsl(var(--brand-orange))'
];

const DEFAULT_WEEKLY_ACTIVITY_TEMPLATE: Array<DailyActivityRecord & { name: string; value: number; label: string }> = 
  Array.from({ length: 7 }).map((_, i) => {
   const dayOfWeek = startOfWeek(new Date(), { weekStartsOn: 1 }); 
   const date = addDays(dayOfWeek, i);
   return {
     name: format(date, 'EEE', { locale: ru }).substring(0, 2).toUpperCase(), 
     value: 0, 
     label: '0 VP', 
     date: format(date, 'yyyy-MM-dd'), 
     filesExtracted: 0, tokensProcessed: 0, kworkRequestsSent: 0,
     prsCreated: 0, branchesUpdated: 0, focusTimeMinutes: 0,
   };
});

const PLACEHOLDER_AVATAR = "/placeholders/cyber-agent-avatar.png";
const FEATURED_QUEST_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250510_035401-e6d0b2d8-9f28-4516-a5c7-fe729b31f736.jpg"; // Consider localizing alt text if needed

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: "easeOut" } },
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length && payload[0].payload) {
    const data: DailyActivityRecord & { value: number } = payload[0].payload; 
    return (
      <div className="bg-dark-card/95 backdrop-blur-sm text-light-text p-3 rounded-lg border border-brand-purple/50 shadow-xl text-xs font-mono">
        <p className="font-bold text-brand-cyan mb-1.5">День: {label} ({format(new Date(data.date + "T00:00:00Z"), 'dd MMM', {locale: ru})})</p>
        <p className="mb-1"><VibeContentRenderer content="::FaBolt::" /> <span className="font-semibold">Vibe Points:</span> {data.value.toFixed(0)}</p>
        <div className="space-y-0.5 mt-1 border-t border-brand-purple/20 pt-1">
            {data.focusTimeMinutes > 0 && <p><VibeContentRenderer content="::FaBrain::" /> Фокус: {data.focusTimeMinutes} мин</p>}
            {data.kworkRequestsSent > 0 && <p><VibeContentRenderer content="::FaPaperPlane::" /> AI Запросы: {data.kworkRequestsSent}</p>}
            {data.filesExtracted > 0 && <p><VibeContentRenderer content="::FaDownload::" /> Файлов в контекст: {data.filesExtracted}</p>}
            {data.tokensProcessed > 0 && <p><VibeContentRenderer content="::FaRobot::" /> Токенов AI: {data.tokensProcessed.toLocaleString()}</p>}
            {data.prsCreated > 0 && <p><VibeContentRenderer content="::FaGithub::" /> PR создано: {data.prsCreated}</p>}
            {data.branchesUpdated > 0 && <p><VibeContentRenderer content="::FaCodeBranch::" /> Веток обновлено: {data.branchesUpdated}</p>}
        </div>
      </div>
    );
  }
  return null;
};

export default function Home() {
  const appContext = useAppContext();
  const { user: telegramUser, dbUser, isLoading: appLoading, error: appContextError, isAuthenticating } = appContext;

  const [cyberProfile, setCyberProfile] = useState<CyberFitnessProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadProfile = async () => {
      if (appLoading || isAuthenticating) {
        setProfileLoading(true); 
        return;
      }
      setProfileLoading(true); 
      try {
          if (appContextError) {
            logger.error(`[HomePage] Error from AppContext: ${appContextError.message}. Defaulting.`);
             setCyberProfile({ level: 0, kiloVibes: 0, focusTimeHours: 0, skillsLeveled: 0, activeQuests: ["investigate_anomaly"], completedQuests: [], unlockedPerks: [], achievements: [], cognitiveOSVersion: "v0.1 Системная Аномалия", lastActivityTimestamp: new Date(0).toISOString(), dailyActivityLog: [], totalFilesExtracted: 0, totalTokensProcessed: 0, totalKworkRequestsSent: 0, totalPrsCreated: 0, totalBranchesUpdated: 0, featuresUsed: {} });
          } else if (dbUser?.user_id) {
            const result = await fetchUserCyberFitnessProfile(dbUser.user_id);
            if (result.success && result.data) {
              setCyberProfile(result.data);
            } else {
              logger.warn(`[HomePage] Failed to load profile for ${dbUser.user_id}. Error: ${result.error}. Defaulting.`);
              setCyberProfile({ level: 0, kiloVibes: 0, focusTimeHours: 0, skillsLeveled: 0, activeQuests: [], completedQuests: [], unlockedPerks: [], achievements: [], cognitiveOSVersion: "v0.1 Альфа Ошибка", lastActivityTimestamp: new Date(0).toISOString(), dailyActivityLog: [], totalFilesExtracted: 0, totalTokensProcessed: 0, totalKworkRequestsSent: 0, totalPrsCreated: 0, totalBranchesUpdated: 0, featuresUsed: {} });
            }
          } else {
            setCyberProfile({ level: 0, kiloVibes: 0, focusTimeHours: 0, skillsLeveled: 0, activeQuests: ["initial_boot_sequence"], completedQuests: [], unlockedPerks: ["Базовый Интерфейс"], achievements: [], cognitiveOSVersion: "v0.1 Гостевой Режим", lastActivityTimestamp: new Date(0).toISOString(), dailyActivityLog: [], totalFilesExtracted: 0, totalTokensProcessed: 0, totalKworkRequestsSent: 0, totalPrsCreated: 0, totalBranchesUpdated: 0, featuresUsed: {} });
          }
      } catch(e: any) {
         logger.error(`[HomePage] Exception during profile loading:`, e);
         setCyberProfile({ level: 0, kiloVibes: 0, focusTimeHours: 0, skillsLeveled: 0, activeQuests: ["investigate_anomaly"], completedQuests: [], unlockedPerks: [], achievements: [], cognitiveOSVersion: "v0.1 Ошибка Загрузки", lastActivityTimestamp: new Date(0).toISOString(), dailyActivityLog: [], totalFilesExtracted: 0, totalTokensProcessed: 0, totalKworkRequestsSent: 0, totalPrsCreated: 0, totalBranchesUpdated: 0, featuresUsed: {} });
      } finally {
        setProfileLoading(false); 
      }
    };
    loadProfile();
  }, [dbUser, appLoading, isAuthenticating, appContextError]); 

  const isLoading = (appLoading || isAuthenticating || profileLoading);

  let userNameDisplay = 'Агент';
  let osVersionDisplay = "Загрузка ОС...";
  let currentLevel = 0;

  if (!isLoading) { 
    if (appContextError || cyberProfile?.cognitiveOSVersion?.includes("Аномалия") || cyberProfile?.cognitiveOSVersion?.includes("Ошибка") || cyberProfile?.cognitiveOSVersion?.includes("Exception")) { // Assuming Load Exception is in Russian
      userNameDisplay = 'Агент (Аномалия)';
      osVersionDisplay = cyberProfile?.cognitiveOSVersion || "v0.1 Системная Аномалия";
    } else if (dbUser?.user_id && cyberProfile) {
      userNameDisplay = dbUser.first_name || telegramUser?.first_name || 'Агент';
      osVersionDisplay = cyberProfile.cognitiveOSVersion || "v0.1 Подключено";
      currentLevel = cyberProfile.level;
    } else { 
      userNameDisplay = 'Агент';
      osVersionDisplay = cyberProfile?.cognitiveOSVersion || "v0.1 Гостевой Режим";
    }
  } else if (cyberProfile) { 
      userNameDisplay = 'Агент';
      osVersionDisplay = cyberProfile.cognitiveOSVersion || "v0.1 Синхронизация...";
      currentLevel = cyberProfile.level;
  }

  if (isLoading && !cyberProfile) { 
      return (
         <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-4 text-center"> 
            <FaSpinner className="text-5xl text-brand-pink animate-spin mb-6" />
            <p className="text-brand-pink font-orbitron text-xl animate-pulse tracking-widest">
              ЗАГРУЗКА ИНТЕРФЕЙСА АГЕНТА...
            </p>
         </div>
      );
  }

  const chartReadyWeeklyActivity = DEFAULT_WEEKLY_ACTIVITY_TEMPLATE.map(templateDay => {
    const logEntry = cyberProfile?.dailyActivityLog?.find(
      log => log.date === templateDay.date
    );
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

  const totalKiloVibes = cyberProfile?.kiloVibes || 0;
  const focusTimeHours = parseFloat((cyberProfile?.focusTimeHours || 0).toFixed(1));
  const skillsLeveled = cyberProfile?.skillsLeveled || 0;

  return (
    <div className="homepage-wrapper">
       <div className="homepage-bg-effects-container">
         <div className="homepage-bg-pulse-fast" />
         <div className="homepage-bg-pulse-slow" />
         <div className="absolute inset-0 bg-grid-pattern opacity-[0.04] animate-[drift_30s_linear_infinite]"></div>
       </div>
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 space-y-5 md:space-y-8">
        <motion.div variants={itemVariants} className="flex justify-between items-center">
          <div>
            <h1 className="text-xl sm:text-2xl font-orbitron font-bold text-brand-cyan cyber-text" data-text={`Агент: ${userNameDisplay}`}>Агент: <span className="text-brand-pink glitch" data-text={userNameDisplay}>{userNameDisplay}</span></h1>
            <p className="text-muted-foreground font-mono text-xs sm:text-sm mt-0.5">Когнитивная ОС {osVersionDisplay} | Уровень: <span className="text-brand-yellow font-semibold">{currentLevel}</span></p>
          </div>
          <Link href="/profile" className="transition-transform duration-200 hover:scale-110">
            <Image src={dbUser?.avatar_url || telegramUser?.photo_url || PLACEHOLDER_AVATAR} alt={`Кибер-аватар агента ${userNameDisplay}`} width={52} height={52} className="avatar-cyber w-11 h-11 sm:w-13 sm:h-13" priority />
          </Link>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card className="featured-quest-card group">
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-3 px-4 md:px-5">
              <div>
                <CardTitle className="text-lg sm:text-xl font-orbitron text-brand-yellow">Приоритетные Директивы</CardTitle>
                <CardDescription className="text-muted-foreground font-mono text-xs">Задачи для уровня {currentLevel}+</CardDescription>
              </div>
              <Button asChild variant="outline" size="xs" className="border-brand-yellow text-brand-yellow hover:bg-brand-yellow/10 hover:text-white font-mono text-xs px-2 py-1 h-auto group-hover:border-brand-pink group-hover:text-brand-pink">
                <Link href="/selfdev/gamified" className="flex items-center">
                    Все Директивы <VibeContentRenderer content="::FaArrowRight className='ml-1 h-2.5 w-2.5 group-hover:animate-[wiggle_0.5s_ease-in-out_infinite]'::" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Link href="/selfdev/gamified#levelup_fitness" className="block relative aspect-[16/5] sm:aspect-[16/4.5] w-full">
                 <Image src={FEATURED_QUEST_IMAGE} alt="Главный Квест: Усиление Когнитивной Матрицы" fill sizes="(max-width: 640px) 100vw, 50vw" style={{ objectFit: 'cover' }} className="opacity-50 group-hover:opacity-70 group-hover:scale-105 transition-all duration-400 ease-in-out" priority />
                 <div className="featured-quest-image-overlay"></div>
                 <div className="absolute bottom-2 left-3 sm:bottom-3 sm:left-4 text-white z-10 p-1">
                    <h3 className="text-md sm:text-lg font-bold font-orbitron text-shadow-[0_0_8px_theme(colors.brand-cyan)]">
                      <VibeContentRenderer content="::FaGamepad className='inline text-brand-pink/90 mr-2 text-2xl sm:text-3xl align-middle'::ЗАПУСК: Тренировочная Программа CyberDev OS" />
                    </h3>
                    <div className="text-xs sm:text-sm font-mono text-gray-300">
                        <span>Твой путь с Уровня 0:&nbsp;</span>
                        <VibeContentRenderer content="::FaEye className='inline mx-0.5 align-middle'::" />
                        <span>&nbsp;Увидь Код,&nbsp;</span>
                        <VibeContentRenderer content="::FaBolt className='inline mx-0.5 align-middle'::" />
                        <span>&nbsp;Стань Вайбом.</span>
                    </div>
                  </div>
                 <div className="absolute top-2 right-3 sm:top-3 sm:right-4 text-white z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <VibeContentRenderer content="::FaArrowRight className='w-4 h-4 sm:w-5 sm:h-5 text-brand-pink animate-[pulse_1.5s_infinite]'::" />
                 </div>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card className="activity-card-cyber">
            <CardHeader className="pb-1 pt-3 px-4 md:px-5">
              <CardTitle className="text-md sm:text-lg font-orbitron text-black/95 font-bold uppercase tracking-wider flex items-center">
                <VibeContentRenderer content="::FaFire className='inline mr-1.5 text-orange-300/90 drop-shadow-sm'::" />Когнитивная Мощность <span className="text-xs ml-auto text-black/70">(Недельный Цикл)</span>
              </CardTitle>
              <div className="flex items-end justify-between gap-2 mt-1">
                  <div>
                      <p className="text-3xl sm:text-4xl font-bold text-white drop-shadow-md leading-none">{totalKiloVibes.toLocaleString()}</p>
                      <p className="text-2xs sm:text-xs font-mono uppercase tracking-wider text-black/85 font-semibold">КилоВайбы</p>
                  </div>
                  <div className="text-right">
                      <p className="text-sm sm:text-md font-semibold text-white/95 leading-tight mb-0.5">{focusTimeHours} <span className="text-2xs font-mono">ч.</span></p>
                      <p className="text-2xs font-mono uppercase text-black/85 mb-1">Глубокая Работа</p>
                      <p className="text-sm sm:text-md font-semibold text-white/95 leading-tight mb-0.5">{skillsLeveled} <span className="text-2xs font-mono">Перков</span></p>
                       <p className="text-2xs font-mono uppercase text-black/85">Разблокировано</p>
                  </div>
              </div>
            </CardHeader>
            <CardContent className="px-1 pb-2 pt-2 md:px-2 md:pb-3">
              <div className="h-[70px] sm:h-[90px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartReadyWeeklyActivity} margin={{ top: 10, right: 5, left: 5, bottom: 0 }}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'rgba(0,0,0,0.85)', fontWeight: 700 }} dy={4}/>
                    <YAxis hide={true} domain={[0, 'dataMax + 20']} /> 
                    <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}/>
                    <Bar dataKey="value" radius={[2, 2, 0, 0]} barSize={18} minPointSize={2}>
                      {chartReadyWeeklyActivity.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} fillOpacity={0.85}/>
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        {dbUser?.status === "admin" && (
          <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1, type: "spring", stiffness: 100 }} className="fixed bottom-20 md:bottom-24 right-3 sm:right-4 z-50">
             <Button asChild variant="outline" size="icon" className="bg-dark-card/80 border-destructive/70 text-destructive hover:bg-destructive/20 hover:text-white rounded-full w-10 h-10 sm:w-11 sm:h-11 shadow-lg backdrop-blur-sm" aria-label="Терминал Администратора">
               <Link href="/admin"><VibeContentRenderer content="::FaUserNinja className='h-5 w-5 sm:h-6 sm:h-6'::" /></Link>
             </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}