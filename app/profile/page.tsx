"use client";
import { useAppContext } from "@/contexts/AppContext";
import { motion } from "framer-motion";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  FaBrain, FaBolt, FaChartLine, FaWandMagicSparkles,
  FaPenToSquare, 
  FaRightFromBracket,
  FaChevronRight, FaSpinner, 
  FaListCheck, 
  FaShieldHalved, FaStar, FaMedal, FaPaperPlane, FaCodeBranch, FaGithub, FaTree, FaCrosshairs, FaSearchengin, FaRobot, FaVial, FaPlus, FaDownload, FaCode,
  FaCommentDots, FaGears, FaBroom, FaScroll, FaImages, FaKiwiBird, FaMobileScreenButton
} from "react-icons/fa6";
import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal"; // Ensure this is correctly styled or uses ShadCN Dialog
import { toast } from "sonner";
import {
  fetchUserCyberFitnessProfile,
  CyberFitnessProfile,
  getAchievementDetails,
  Achievement,
  ALL_ACHIEVEMENTS 
} from "@/hooks/cyberFitnessSupabase";
import { debugLogger as logger } from "@/lib/debugLogger";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip as RechartsTooltip } from 'recharts';
import VibeContentRenderer from "@/components/VibeContentRenderer";
import Link from "next/link";
import { format } from 'date-fns'; 
import { ru } from 'date-fns/locale'; 
import { cn } from "@/lib/utils";

const PLACEHOLDER_AVATAR = "/placeholders/cyber-agent-avatar.png";
const DEFAULT_WEEKLY_ACTIVITY = Array.from({ length: 7 }).map((_, i) => {
    const day = format(new Date(new Date().setDate(new Date().getDate() - 6 + i)), 'EE', { locale: ru });
    return { name: day.toUpperCase(), value: 0, label: 'System Idle', filesExtracted: 0, tokensProcessed: 0 };
});
const CHART_COLORS = [
  'hsl(var(--brand-cyan))', 'hsl(var(--brand-pink))', 'hsl(var(--brand-yellow))',
  'hsl(var(--brand-green))', 'hsl(var(--brand-orange))', 'hsl(var(--brand-purple))',
  'hsl(var(--neon-lime))'
];

const getAchievementIconComponent = (iconName: string | undefined): React.ReactNode => {
    if (!iconName) return <FaMedal className="text-brand-yellow" />;
    const iconsMap: Record<string, React.ReactElement> = {
        "FaVial": <FaVial className="text-brand-green" />,
        "FaPaperPlane": <FaPaperPlane className="text-brand-cyan" />,
        "FaCodeBranch": <FaCodeBranch className="text-brand-purple" />,
        "FaGithub": <FaGithub className="text-light-text" />, 
        "FaTree": <FaTree className="text-brand-green" />,
        "FaCrosshairs": <FaCrosshairs className="text-red-500" />, 
        "FaSearchengin": <FaSearchengin className="text-brand-blue" />,
        "FaRobot": <FaRobot className="text-brand-pink" />,
        "FaStar": <FaStar className="text-brand-yellow" />,
        "FaPlus": <FaPlus className="text-neon-lime" />, 
        "FaBolt": <FaBolt className="text-orange-500" />, 
        "FaDownload": <FaDownload className="text-blue-400" />,
        "FaCode": <FaCode className="text-purple-400" />,
        "FaCommentDots": <FaCommentDots className="text-teal-400" />,
        "FaGears": <FaGears className="text-gray-400" />,
        "FaBroom": <FaBroom className="text-orange-400" />,
        "FaScroll": <FaScroll className="text-yellow-600" />,
        "FaImages": <FaImages className="text-indigo-400" />,
        "FaKiwiBird": <FaKiwiBird className="text-lime-500" />,
        "FaMobileScreenButton": <FaMobileScreenButton className="text-brand-cyan" />,
    };
    return iconsMap[iconName] || <FaMedal className="text-brand-yellow" />; // Default icon
};

export default function ProfilePage() {
  const appContext = useAppContext();
  const { user: telegramUser, dbUser, isLoading: appLoading, isAuthenticating, error: appContextError } = appContext; 
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPerksModalOpen, setIsPerksModalOpen] = useState(false);
  const [isAchievementsModalOpen, setIsAchievementsModalOpen] = useState(false);

  const [cyberProfile, setCyberProfile] = useState<CyberFitnessProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);

  const userName = dbUser?.first_name || telegramUser?.first_name || 'Agent';
  const userHandle = dbUser?.username || telegramUser?.username || 'cyberspace_operative';
  const avatarUrl = dbUser?.avatar_url || telegramUser?.photo_url || PLACEHOLDER_AVATAR;

  useEffect(() => {
    const loadProfile = async () => {
      logger.log(`[ProfilePage] loadProfile triggered. appLoading: ${appLoading}, isAuthenticating: ${isAuthenticating}, dbUser.user_id: ${dbUser?.user_id}, appContextError: ${appContextError?.message}`);
      
      if (appLoading || isAuthenticating) {
        logger.log(`[ProfilePage] AppContext is still loading or authenticating. Waiting to fetch profile.`);
        setProfileLoading(true);
        return;
      }

      if (appContextError) {
          logger.error(`[ProfilePage] Error from AppContext: ${appContextError.message}. Displaying guest profile / error state.`);
          setCyberProfile({ 
            level: 0, kiloVibes: 0, cognitiveOSVersion: "v0.1 System Error", 
            focusTimeHours: 0, skillsLeveled: 0, lastActivityTimestamp: new Date(0).toISOString(),
            unlockedPerks: [], activeQuests:[], completedQuests: [], achievements: [],
            dailyActivityLog: [], totalFilesExtracted: 0, totalTokensProcessed: 0,
            totalKworkRequestsSent: 0, totalPrsCreated: 0, totalBranchesUpdated: 0,
            featuresUsed: {}
          });
          setProfileLoading(false);
          return;
      }

      if (dbUser?.user_id) { 
        setProfileLoading(true); 
        logger.log(`[ProfilePage] Context fully loaded and authenticated (dbUser.user_id: ${dbUser.user_id}). Fetching CyberFitness profile...`);
        const result = await fetchUserCyberFitnessProfile(dbUser.user_id); 
        if (result.success && result.data) {
          setCyberProfile(result.data);
          logger.log("[ProfilePage] CyberFitness profile loaded successfully:", result.data);
        } else {
          logger.warn(`[ProfilePage] Failed to load CyberFitness profile for ${dbUser.user_id}. Error: ${result.error}. Initializing default profile state.`);
          setCyberProfile({ 
            level: 0, kiloVibes: 0, cognitiveOSVersion: "v0.1 Alpha Error", 
            focusTimeHours: 0, skillsLeveled: 0, lastActivityTimestamp: new Date(0).toISOString(),
            unlockedPerks: [], activeQuests: [], completedQuests: [], achievements: [],
            dailyActivityLog: [], totalFilesExtracted: 0, totalTokensProcessed: 0,
            totalKworkRequestsSent: 0, totalPrsCreated: 0, totalBranchesUpdated: 0,
            featuresUsed: {}
          });
        }
        setProfileLoading(false);
      } else { 
        logger.log(`[ProfilePage] Context loaded, auth attempt complete, but no dbUser.user_id. Likely unauthenticated or MOCK_USER disabled & no TG data. Using guest profile.`);
        setCyberProfile({ 
            level: 0, kiloVibes: 0, cognitiveOSVersion: "v0.1 Guest Mode", 
            focusTimeHours: 0, skillsLeveled: 0, lastActivityTimestamp: new Date(0).toISOString(),
            unlockedPerks: ["Basic Interface"], activeQuests: ["Explore CyberVibe Studio"], completedQuests: [],
            achievements: [], dailyActivityLog: [], totalFilesExtracted: 0, totalTokensProcessed: 0,
            totalKworkRequestsSent: 0, totalPrsCreated: 0, totalBranchesUpdated: 0,
            featuresUsed: {}
        });
        setProfileLoading(false);
      }
    };

    loadProfile();
  }, [dbUser, appLoading, isAuthenticating, appContextError]); 

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

  const safeCyberProfile = cyberProfile ?? { 
      level: 0, kiloVibes: 0, cognitiveOSVersion: "v0.1 Error/Guest", 
      focusTimeHours: 0, skillsLeveled: 0, lastActivityTimestamp: new Date(0).toISOString(),
      unlockedPerks: [], activeQuests: [], completedQuests: [], achievements: [],
      dailyActivityLog: [], totalFilesExtracted: 0, totalTokensProcessed: 0,
      totalKworkRequestsSent: 0, totalPrsCreated: 0, totalBranchesUpdated: 0,
      featuresUsed: {}
  };

  const currentLevel = safeCyberProfile.level;
  const kiloVibes = safeCyberProfile.kiloVibes;
  const cognitiveOS = safeCyberProfile.cognitiveOSVersion;
  const unlockedPerks = safeCyberProfile.unlockedPerks;
  const achievements = safeCyberProfile.achievements;
  const focusTime = safeCyberProfile.focusTimeHours || 0;
  
  const displayWeeklyActivity = safeCyberProfile.dailyActivityLog && safeCyberProfile.dailyActivityLog.length > 0
    ? safeCyberProfile.dailyActivityLog.map(log => {
        const date = new Date(log.date + "T00:00:00Z"); 
        return {
            name: format(date, 'EE', { locale: ru }).toUpperCase(),
            value: (log.filesExtracted * 50) + (log.tokensProcessed * 0.1) + (log.kworkRequestsSent || 0) * 10 + (log.prsCreated || 0) * 200 + (log.branchesUpdated || 0) * 100,
            label: `${log.filesExtracted}f, ${log.tokensProcessed}t, ${log.kworkRequestsSent || 0}req`,
            filesExtracted: log.filesExtracted,
            tokensProcessed: log.tokensProcessed,
            kworkRequestsSent: log.kworkRequestsSent || 0,
            prsCreated: log.prsCreated || 0,
            branchesUpdated: log.branchesUpdated || 0,
        };
      }).slice(-7) 
    : DEFAULT_WEEKLY_ACTIVITY;

  const stats = [
    { label: "KiloVibes", value: kiloVibes.toLocaleString(), icon: <FaBolt className="text-brand-yellow text-3xl" /> },
    { label: "Deep Work (ч)", value: focusTime, icon: <FaBrain className="text-brand-pink text-3xl" /> },
    { label: "Достижений", value: achievements.length, icon: <FaStar className="text-neon-lime text-3xl" /> },
    { label: "Запросов к AI", value: safeCyberProfile.totalKworkRequestsSent, icon: <FaPaperPlane className="text-brand-cyan text-3xl" /> },
    { label: "PR Создано", value: safeCyberProfile.totalPrsCreated, icon: <FaGithub className="text-light-text text-3xl" /> },
    { label: "Веток Обновлено", value: safeCyberProfile.totalBranchesUpdated, icon: <FaCodeBranch className="text-brand-purple text-3xl" /> },
    { label: "Извлечено Файлов", value: safeCyberProfile.totalFilesExtracted, icon: <FaPlus className="text-brand-green text-3xl" /> },
    { label: "Токенов AI", value: (safeCyberProfile.totalTokensProcessed).toLocaleString(), icon: <FaRobot className="text-brand-pink text-3xl" /> },
  ];

  const handleLogout = () => {
    toast.info("Функция выхода из системы в разработке. CyberVibe OS тебя не отпустит так просто!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-black to-dark-card text-light-text p-4 pt-24 pb-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto max-w-3xl" 
      >
        <Card className="bg-dark-card/90 backdrop-blur-xl border border-brand-purple/60 shadow-2xl shadow-purple-glow">
          <CardHeader className="text-center p-6 md:p-8 border-b border-brand-purple/40">
            <div className="relative w-32 h-32 md:w-36 md:h-36 mx-auto mb-5 rounded-full overflow-hidden border-4 border-brand-pink shadow-[0_0_20px_rgba(var(--brand-pink-rgb),0.7)] transition-all duration-300 hover:shadow-[0_0_30px_rgba(var(--brand-pink-rgb),0.9)] hover:scale-105">
              <Image
                src={avatarUrl}
                alt={`${userName}'s Cybernetic Avatar`}
                fill 
                style={{objectFit:"cover"}} 
                className="transform hover:scale-110 transition-transform duration-300"
                priority
                sizes="(max-width: 768px) 128px, 144px"
              />
            </div>
            <CardTitle className="text-4xl font-orbitron font-bold text-brand-cyan cyber-text glitch" data-text={userName.toUpperCase()}>
              {userName.toUpperCase()}
            </CardTitle>
            <CardDescription className="text-muted-foreground font-mono text-md mt-1">
              @{userHandle}
            </CardDescription>
            <div className="mt-3 text-sm font-mono text-brand-yellow text-shadow-sm shadow-yellow-500/50">
              Level: {currentLevel} | Cognitive OS: {cognitiveOS}
            </div>
          </CardHeader>

          <CardContent className="space-y-8 p-6 md:p-8">
            <section>
              <h2 className="text-2xl font-orbitron text-brand-pink mb-4 flex items-center gap-2 text-shadow-neon">
                <FaChartLine />Кибер-Метрики Агента
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {stats.map((stat) => (
                  <Card key={stat.label} className="bg-dark-bg/80 p-4 text-center border border-brand-cyan/40 hover:shadow-brand-cyan/30 hover:shadow-lg transition-all duration-300 rounded-lg hover:border-brand-cyan/70 hover:-translate-y-1">
                    <div className="mb-2 mx-auto">{stat.icon}</div>
                    <p className="text-2xl font-orbitron font-bold text-light-text">{stat.value}</p>
                    <p className="text-xs text-muted-foreground font-mono uppercase tracking-tight leading-tight">{stat.label}</p>
                  </Card>
                ))}
              </div>
            </section>

            <section>
                <h2 className="text-2xl font-orbitron text-brand-green mb-4 flex items-center gap-2 text-shadow-neon">
                    <FaListCheck />Недельная Активность (Vibe Points)
                </h2>
                <Card className="bg-dark-bg/80 p-4 border border-brand-green/40 rounded-lg shadow-md">
                    <div className="h-[150px] w-full"> 
                        <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={displayWeeklyActivity} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}> 
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} dy={5}/>
                            <YAxis hide={true} domain={[0, 'dataMax + 100']} />
                            <RechartsTooltip
                                cursor={{ fill: 'hsla(var(--brand-purple), 0.15)' }}
                                contentStyle={{
                                    backgroundColor: 'hsla(var(--dark-card-rgb), 0.9)', 
                                    borderColor: 'hsl(var(--brand-purple))',
                                    borderRadius: '0.5rem',
                                    color: 'hsl(var(--light-text))',
                                    fontSize: '0.8rem', 
                                    fontFamily: 'monospace',
                                    boxShadow: '0 0 10px hsla(var(--brand-purple), 0.3)'
                                }}
                                itemStyle={{ color: 'hsl(var(--brand-yellow))' }}
                                labelStyle={{ color: 'hsl(var(--brand-cyan))', fontWeight: 'bold', marginBottom: '4px' }}
                                formatter={(value: number, name, props) => {
                                    const payload = props.payload as typeof displayWeeklyActivity[0];
                                    const details = [];
                                    if (payload.filesExtracted > 0) details.push(`${payload.filesExtracted}f`);
                                    if (payload.tokensProcessed > 0) details.push(`${payload.tokensProcessed}t`);
                                    if (payload.kworkRequestsSent > 0) details.push(`${payload.kworkRequestsSent}req`);
                                    if (payload.prsCreated > 0) details.push(`${payload.prsCreated}PR`);
                                    if (payload.branchesUpdated > 0) details.push(`${payload.branchesUpdated}Br`);
                                    return [`${value.toFixed(0)} VP`, details.join(', ') || 'Простой'];
                                }}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={25} minPointSize={3}>
                            {displayWeeklyActivity.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} className="transition-opacity duration-200 hover:opacity-80" />
                            ))}
                            </Bar>
                        </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </section>

            <section>
              <h2 className="text-2xl font-orbitron text-brand-yellow mb-4 flex items-center gap-2 text-shadow-neon">
                <FaWandMagicSparkles />Разблокированные Перки
              </h2>
              <div className="p-4 bg-dark-bg/80 rounded-lg border border-brand-yellow/40 space-y-2 shadow-md">
                {unlockedPerks.length > 0 ? (
                  unlockedPerks.slice(0, 3).map((perk, index) => (
                    <div key={index} className="flex items-center text-sm text-light-text font-mono">
                      <FaBolt className="text-brand-yellow mr-2 text-xs" /> {perk}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground font-mono">Нет активных перков. Время прокачиваться, Агент!</p>
                )}
                {(unlockedPerks.length > 3 || unlockedPerks.length === 0) && (
                  <Button variant="link" size="sm" className="text-brand-yellow p-0 h-auto font-mono text-xs hover:text-yellow-300" onClick={() => setIsPerksModalOpen(true)}>
                    {unlockedPerks.length > 3 ? `Показать все (${unlockedPerks.length})` : "Узнать о Перках"} <FaChevronRight className="ml-1 w-3 h-3"/>
                  </Button>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-orbitron text-neon-lime mb-4 flex items-center gap-2 text-shadow-neon">
                <FaStar />Достижения Агента
              </h2>
              <div className="p-4 bg-dark-bg/80 rounded-lg border border-neon-lime/40 space-y-2 shadow-md">
                {achievements.length > 0 ? (
                  achievements.slice(0, 3).map((achId) => {
                    const achievement = getAchievementDetails(achId);
                    return (
                      <div key={achId} className="flex items-center text-sm text-light-text font-mono" title={achievement?.description}>
                        {getAchievementIconComponent(achievement?.icon)} <span className="ml-2">{achievement?.name || achId}</span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground font-mono">Зал славы пока пуст. Верши великие дела, Кибер-Воин!</p>
                )}
                {(achievements.length > 3 || achievements.length === 0) && (
                   <Button variant="link" size="sm" className="text-neon-lime p-0 h-auto font-mono text-xs hover:text-lime-300" onClick={() => setIsAchievementsModalOpen(true)}>
                     {achievements.length > 3 ? `Показать все (${achievements.length})` : "Мои Достижения"} <FaChevronRight className="ml-1 w-3 h-3"/>
                   </Button>
                )}
              </div>
            </section>

            <section className="flex flex-col sm:flex-row gap-4 mt-8">
              <Button 
                onClick={() => setIsEditModalOpen(true)}
                className="flex-1 bg-brand-cyan text-black hover:bg-brand-cyan/80 font-orbitron shadow-lg hover:shadow-brand-cyan/50 transition-all py-3 text-base"
              >
                <FaPenToSquare className="mr-2" /> Изменить Профиль
              </Button>
              <Button 
                onClick={handleLogout}
                variant="outline" 
                className="flex-1 border-brand-red text-brand-red hover:bg-brand-red/20 hover:text-white font-orbitron shadow-lg hover:shadow-brand-red/50 transition-all py-3 text-base"
              >
                <FaRightFromBracket className="mr-2" /> Деавторизация
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
          toast.info("Функция редактирования профиля в разработке.");
          setIsEditModalOpen(false);
        }}
        dialogClassName="bg-dark-card border-brand-purple text-light-text"
        titleClassName="text-brand-cyan"
        confirmButtonClassName="bg-brand-green hover:bg-brand-green/80 text-black"
        cancelButtonClassName="text-muted-foreground hover:bg-muted/50"
      >
        <p className="font-mono text-sm text-muted-foreground">Здесь будет форма для изменения вашего отображаемого имени, аватара, и других настроек CyberFitness.</p>
        <p className="mt-2 text-xs text-brand-yellow font-mono animate-pulse">Интерфейс модификации личности временно недоступен...</p>
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
                        <FaShieldHalved className="text-brand-purple mr-3 text-xl flex-shrink-0"/>
                        <VibeContentRenderer content={perk} className="text-sm" />
                    </li>
                ))}
                </ul>
            ) : (
                <p className="font-mono text-sm text-muted-foreground p-4 text-center">Банк перков пуст. Отправляйся в <Link href="/selfdev/gamified" className="text-brand-green hover:underline font-semibold" onClick={() => setIsPerksModalOpen(false)}>CyberDev OS</Link> за апгрейдами!</p>
            )}
        </div>
        <p className="mt-4 text-xs text-brand-yellow font-mono animate-pulse text-center">Синхронизация с банком перков завершена...</p>
      </Modal>

      <Modal
        isOpen={isAchievementsModalOpen}
        onClose={() => setIsAchievementsModalOpen(false)}
        title="Зал Славы Агента"
        showConfirmButton={false}
        cancelText="Закрыть Витрину"
        dialogClassName="bg-dark-card border-neon-lime text-light-text"
        titleClassName="text-neon-lime"
        cancelButtonClassName="text-muted-foreground hover:bg-muted/50"
      >
        <div className="max-h-96 overflow-y-auto simple-scrollbar pr-2 space-y-3">
            {achievements.length > 0 ? (
                achievements.map((achId) => {
                    const achievement = getAchievementDetails(achId);
                    if (!achievement) return <div key={achId} className="p-3 bg-dark-bg/70 border border-muted rounded-lg text-sm text-muted-foreground">Неизвестное достижение: {achId}</div>;
                    return (
                        <div key={achievement.id} className="p-3.5 bg-dark-bg/70 border border-neon-lime/60 rounded-lg transform hover:scale-[1.02] transition-transform duration-200 ease-out hover:shadow-md hover:shadow-neon-lime/30">
                            <div className="flex items-center mb-1">
                                <span className="text-2xl mr-3">{getAchievementIconComponent(achievement.icon)}</span>
                                <h4 className="text-md font-orbitron font-semibold text-neon-lime">{achievement.name}</h4>
                            </div>
                            <p className="text-xs text-muted-foreground font-mono ml-9">{achievement.description}</p>
                        </div>
                    );
                })
            ) : (
                 <p className="font-mono text-sm text-muted-foreground text-center py-4">Твой путь к легенде только начался! Завершай задачи, используй инструменты CyberVibe Studio, и этот зал наполнится твоими трофеями!</p>
            )}
        </div>
         <p className="mt-3 text-xs text-brand-yellow font-mono animate-pulse text-center">Каждая строка кода, каждый коммит — шаг к величию...</p>
      </Modal>
    </div>
  );
}