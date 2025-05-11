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
  FaCommentDots, FaGears, FaBroom, FaScroll, FaImages, FaKiwiBird 
} from "react-icons/fa6";
import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import { toast } from "sonner";
import {
  fetchUserCyberFitnessProfile,
  CyberFitnessProfile,
  getAchievementDetails,
  Achievement 
} from "@/hooks/cyberFitnessSupabase";
import { debugLogger as logger } from "@/lib/debugLogger";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip as RechartsTooltip } from 'recharts';
import VibeContentRenderer from "@/components/VibeContentRenderer";
import Link from "next/link";
import { format } from 'date-fns'; 
import { ru } from 'date-fns/locale'; 

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
    };
    return iconsMap[iconName] || <FaMedal className="text-brand-yellow" />;
};

export default function ProfilePage() {
  const appContext = useAppContext();
  const { user: telegramUser, dbUser, isLoading: appLoading } = appContext; 
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
      logger.log(`[ProfilePage] loadProfile triggered. appLoading: ${appLoading}, dbUser.id: ${dbUser?.id}`);
      if (appLoading) {
        logger.log(`[ProfilePage] AppContext is still loading. Waiting to fetch profile.`);
        setProfileLoading(true);
        return;
      }

      if (dbUser?.id) {
        setProfileLoading(true);
        logger.log(`[ProfilePage] Context fully loaded, dbUser.id available. Fetching profile for user ${dbUser.id}`);
        const result = await fetchUserCyberFitnessProfile(dbUser.id);
        if (result.success && result.data) {
          setCyberProfile(result.data);
          logger.log("[ProfilePage] CyberFitness profile loaded:", result.data);
        } else {
          logger.warn(`[ProfilePage] Failed to load CyberFitness profile for ${dbUser.id}. Error: ${result.error}. Initializing default.`);
          setCyberProfile({ 
            level: 0, kiloVibes: 0, cognitiveOSVersion: "v0.1 Alpha Error", 
            unlockedPerks: [], activeQuests: [], achievements: [],
            dailyActivityLog: [], totalFilesExtracted: 0, totalTokensProcessed: 0,
            totalKworkRequestsSent: 0, totalPrsCreated: 0, totalBranchesUpdated: 0,
            featuresUsed: {}
          });
        }
        setProfileLoading(false);
      } else { 
        logger.log(`[ProfilePage] Context fully loaded, but no dbUser.id. Using guest profile.`);
        setCyberProfile({ 
            level: 0, kiloVibes: 0, cognitiveOSVersion: "v0.1 Guest Mode", 
            unlockedPerks: ["Basic Interface"], activeQuests: ["Explore CyberVibe Studio"], 
            achievements: [], dailyActivityLog: [], totalFilesExtracted: 0, totalTokensProcessed: 0,
            totalKworkRequestsSent: 0, totalPrsCreated: 0, totalBranchesUpdated: 0,
            featuresUsed: {}
        });
        setProfileLoading(false);
      }
    };

    loadProfile();
  }, [dbUser, appLoading]); 

  const isLoadingDisplay = appLoading || profileLoading;


  if (isLoadingDisplay) {
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-4 text-center">
        <FaSpinner className="text-5xl text-brand-cyan animate-spin mb-6" />
        <p className="text-brand-cyan font-orbitron text-xl animate-pulse tracking-widest">
          ДЕШИФРОВКА ПРОФИЛЯ АГЕНТА...
        </p>
      </div>
    );
  }

  const currentLevel = cyberProfile?.level || 0;
  const kiloVibes = cyberProfile?.kiloVibes || 0;
  const cognitiveOS = cyberProfile?.cognitiveOSVersion || "v1.0 Genesis";
  const unlockedPerks = cyberProfile?.unlockedPerks || ["Core Systems Online"];
  const achievements = cyberProfile?.achievements || [];
  const focusTime = cyberProfile?.focusTimeHours || 0;
  
  const displayWeeklyActivity = cyberProfile?.dailyActivityLog && cyberProfile.dailyActivityLog.length > 0
    ? cyberProfile.dailyActivityLog.map(log => {
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
    { label: "KiloVibes", value: kiloVibes.toLocaleString(), icon: <FaBolt className="text-brand-yellow" /> },
    { label: "Deep Work (ч)", value: focusTime, icon: <FaBrain className="text-brand-pink" /> },
    { label: "Достижений", value: achievements.length, icon: <FaStar className="text-neon-lime" /> },
    { label: "Запросов к AI", value: cyberProfile?.totalKworkRequestsSent || 0, icon: <FaPaperPlane className="text-brand-cyan" /> },
    { label: "PR Создано", value: cyberProfile?.totalPrsCreated || 0, icon: <FaGithub className="text-light-text" /> },
    { label: "Веток Обновлено", value: cyberProfile?.totalBranchesUpdated || 0, icon: <FaCodeBranch className="text-brand-purple" /> },
    { label: "Извлечено Файлов (в KWork)", value: cyberProfile?.totalFilesExtracted || 0, icon: <FaPlus className="text-brand-green" /> },
    { label: "Токенов AI (обработано)", value: (cyberProfile?.totalTokensProcessed || 0).toLocaleString(), icon: <FaRobot className="text-brand-pink" /> },
  ];

  const handleLogout = () => {
    toast.info("Функция выхода из системы в разработке.");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg to-dark-card text-light-text p-4 pt-24 pb-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto max-w-2xl"
      >
        <Card className="bg-dark-card/90 backdrop-blur-md border border-brand-purple/50 shadow-xl">
          <CardHeader className="text-center p-6 border-b border-brand-purple/30">
            <div className="relative w-28 h-28 mx-auto mb-4 rounded-full overflow-hidden border-4 border-brand-pink shadow-[0_0_15px_theme(colors.brand-pink)]">
              <Image
                src={avatarUrl}
                alt={`${userName}'s Cybernetic Avatar`}
                layout="fill"
                objectFit="cover"
                className="transform hover:scale-110 transition-transform duration-300"
                priority
              />
            </div>
            <CardTitle className="text-3xl font-orbitron font-bold text-brand-cyan cyber-text glitch" data-text={userName}>
              {userName}
            </CardTitle>
            <CardDescription className="text-muted-foreground font-mono text-sm">
              @{userHandle}
            </CardDescription>
            <div className="mt-2 text-xs font-mono text-brand-yellow">
              Level: {currentLevel} | Cognitive OS: {cognitiveOS}
            </div>
          </CardHeader>

          <CardContent className="space-y-6 p-6">
            <section>
              <h2 className="text-xl font-orbitron text-brand-pink mb-3 flex items-center">
                <FaChartLine className="mr-2"/>Кибер-Метрики Агента
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {stats.map((stat) => (
                  <Card key={stat.label} className="bg-dark-bg/70 p-3 text-center border border-brand-cyan/30 hover:shadow-brand-cyan/20 hover:shadow-md transition-shadow rounded-lg">
                    <div className="text-2xl mb-1 mx-auto">{stat.icon}</div>
                    <p className="text-xl font-orbitron font-bold text-light-text">{stat.value}</p>
                    <p className="text-[0.6rem] text-muted-foreground font-mono uppercase leading-tight">{stat.label}</p>
                  </Card>
                ))}
              </div>
            </section>

            <section>
                <h2 className="text-xl font-orbitron text-brand-green mb-3 flex items-center">
                    <FaListCheck className="mr-2" />Недельная Активность (Vibe Points)
                </h2>
                <Card className="bg-dark-bg/70 p-3 border border-brand-green/30 rounded-lg">
                    <div className="h-[120px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={displayWeeklyActivity} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} dy={5}/>
                            <YAxis hide={true} domain={[0, 'dataMax + 100']} />
                            <RechartsTooltip
                                cursor={{ fill: 'hsla(var(--brand-purple), 0.1)' }}
                                contentStyle={{
                                    backgroundColor: 'rgba(13, 2, 33, 0.85)',
                                    borderColor: 'hsl(var(--brand-purple))',
                                    borderRadius: '0.5rem',
                                    color: 'hsl(var(--light-text))',
                                    fontSize: '0.75rem',
                                    fontFamily: 'monospace',
                                }}
                                itemStyle={{ color: 'hsl(var(--brand-yellow))' }}
                                labelStyle={{ color: 'hsl(var(--brand-cyan))', fontWeight: 'bold' }}
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
                            <Bar dataKey="value" radius={[3, 3, 0, 0]} barSize={20} minPointSize={3}>
                            {displayWeeklyActivity.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} fillOpacity={0.9}/>
                            ))}
                            </Bar>
                        </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </section>

            <section>
              <h2 className="text-xl font-orbitron text-brand-yellow mb-3 flex items-center">
                <FaWandMagicSparkles className="mr-2"/>Разблокированные Перки
              </h2>
              <div className="p-4 bg-dark-bg/70 rounded-lg border border-brand-yellow/30 space-y-2">
                {unlockedPerks.length > 0 ? (
                  unlockedPerks.slice(0, 3).map((perk, index) => (
                    <div key={index} className="flex items-center text-sm text-light-text font-mono">
                      <FaBolt className="text-brand-yellow mr-2 text-xs" /> {perk}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground font-mono">Нет активных перков. Время прокачиваться!</p>
                )}
                {(unlockedPerks.length > 3 || unlockedPerks.length === 0) && (
                  <Button variant="link" size="sm" className="text-brand-yellow p-0 h-auto font-mono text-xs" onClick={() => setIsPerksModalOpen(true)}>
                    {unlockedPerks.length > 3 ? `Показать все (${unlockedPerks.length})` : "Узнать о Перках"} <FaChevronRight className="ml-1 w-3 h-3"/>
                  </Button>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-orbitron text-neon-lime mb-3 flex items-center">
                <FaStar className="mr-2"/>Достижения Агента
              </h2>
              <div className="p-4 bg-dark-bg/70 rounded-lg border border-neon-lime/30 space-y-2">
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
                  <p className="text-sm text-muted-foreground font-mono">Зал славы пока пуст. Верши великие дела!</p>
                )}
                {(achievements.length > 3 || achievements.length === 0) && (
                   <Button variant="link" size="sm" className="text-neon-lime p-0 h-auto font-mono text-xs" onClick={() => setIsAchievementsModalOpen(true)}>
                     {achievements.length > 3 ? `Показать все (${achievements.length})` : "Мои Достижения"} <FaChevronRight className="ml-1 w-3 h-3"/>
                   </Button>
                )}
              </div>
            </section>

            <section className="flex flex-col sm:flex-row gap-3 mt-6">
              <Button 
                onClick={() => setIsEditModalOpen(true)}
                className="flex-1 bg-brand-cyan text-black hover:bg-brand-cyan/80 font-orbitron shadow-md hover:shadow-brand-cyan/40 transition-all"
              >
                <FaPenToSquare className="mr-2" /> Изменить Профиль Агента
              </Button>
              <Button 
                onClick={handleLogout}
                variant="outline" 
                className="flex-1 border-brand-red text-brand-red hover:bg-brand-red/20 hover:text-white font-orbitron shadow-md hover:shadow-brand-red/40 transition-all"
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
      >
        <div className="max-h-60 overflow-y-auto simple-scrollbar pr-2">
            {unlockedPerks.length > 0 ? (
                <ul className="list-none space-y-2">
                {unlockedPerks.map((perk, index) => (
                    <li key={index} className="flex items-center p-2 bg-dark-bg rounded-md border border-brand-purple/50">
                        <FaShieldHalved className="text-brand-purple mr-3 text-lg"/>
                        <VibeContentRenderer content={perk} />
                    </li>
                ))}
                </ul>
            ) : (
                <p className="font-mono text-sm text-muted-foreground">Банк перков пуст. Отправляйся в <Link href="/selfdev/gamified" className="text-brand-green hover:underline" onClick={() => setIsPerksModalOpen(false)}>CyberDev OS</Link> за апгрейдами!</p>
            )}
        </div>
        <p className="mt-3 text-xs text-brand-yellow font-mono animate-pulse">Синхронизация с банком перков...</p>
      </Modal>

      <Modal
        isOpen={isAchievementsModalOpen}
        onClose={() => setIsAchievementsModalOpen(false)}
        title="Зал Славы Агента"
        showConfirmButton={false}
        cancelText="Закрыть Витрину"
      >
        <div className="max-h-80 overflow-y-auto simple-scrollbar pr-2 space-y-3">
            {achievements.length > 0 ? (
                achievements.map((achId) => {
                    const achievement = getAchievementDetails(achId);
                    if (!achievement) return <div key={achId} className="p-3 bg-dark-bg/70 border border-muted rounded-lg text-sm text-muted-foreground">Неизвестное достижение: {achId}</div>;
                    return (
                        <div key={achievement.id} className="p-3 bg-dark-bg/70 border border-neon-lime/50 rounded-lg transform hover:scale-[1.02] transition-transform">
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