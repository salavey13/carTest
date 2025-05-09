"use client";
import { useAppContext } from "@/contexts/AppContext";
import { motion } from "framer-motion";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  FaBrain, FaBolt, FaChartLine, FaWandMagicSparkles,
  FaPenToSquare, 
  FaRightFromBracket, // Replaced FaSignOutAlt
  FaChevronRight, FaSpinner, 
  FaListCheck, // Replaced FaTasks
  FaShieldHalved
} from "react-icons/fa6";
import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import { toast } from "sonner";
import {
  fetchUserCyberFitnessProfile,
  CyberFitnessProfile
} from "@/hooks/cyberFitnessSupabase";
import { debugLogger } from "@/lib/debugLogger";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip as RechartsTooltip } from 'recharts';
import VibeContentRenderer from "@/components/VibeContentRenderer";
import Link from "next/link"; // Added Link for Modal

const PLACEHOLDER_AVATAR = "/placeholders/cyber-agent-avatar.png";
const DEFAULT_WEEKLY_ACTIVITY = [
  { name: 'MO', value: 0, label: 'System Idle' }, { name: 'TU', value: 0, label: 'System Idle' },
  { name: 'WE', value: 0, label: 'System Idle' }, { name: 'TH', value: 0, label: 'System Idle' },
  { name: 'FRI', value: 0, label: 'System Idle' }, { name: 'SA', value: 0, label: 'System Idle' },
  { name: 'SU', value: 0, label: 'System Idle' },
];
const CHART_COLORS = [
  'hsl(var(--brand-cyan))', 'hsl(var(--brand-pink))', 'hsl(var(--brand-yellow))',
  'hsl(var(--brand-green))', 'hsl(var(--brand-orange))', 'hsl(var(--brand-purple))',
  'hsl(var(--neon-lime))'
];

export default function ProfilePage() {
  const { user: telegramUser, dbUser, isLoading: appLoading } = useAppContext();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPerksModalOpen, setIsPerksModalOpen] = useState(false);

  const [cyberProfile, setCyberProfile] = useState<CyberFitnessProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);

  const userName = dbUser?.first_name || telegramUser?.first_name || 'Agent';
  const userHandle = dbUser?.username || telegramUser?.username || 'cyberspace_operative';
  const avatarUrl = dbUser?.avatar_url || telegramUser?.photo_url || PLACEHOLDER_AVATAR;

  useEffect(() => {
    const loadProfile = async () => {
      if (dbUser?.id) {
        debugLogger.log(`[ProfilePage] Fetching CyberFitness profile for ${dbUser.id}`);
        setProfileLoading(true);
        const result = await fetchUserCyberFitnessProfile(dbUser.id);
        if (result.success && result.data) {
          setCyberProfile(result.data);
          debugLogger.log("[ProfilePage] CyberFitness profile loaded:", result.data);
        } else {
          debugLogger.warn(`[ProfilePage] Failed to load CyberFitness profile for ${dbUser.id}. Error: ${result.error}. Initializing default.`);
          setCyberProfile({ level: 0, kiloVibes: 0, weeklyActivity: [...DEFAULT_WEEKLY_ACTIVITY], cognitiveOSVersion: "v0.1 Alpha", unlockedPerks: [], activeQuests: [] });
        }
        setProfileLoading(false);
      } else if (!appLoading) { // Only if auth is done and no user
        debugLogger.log("[ProfilePage] No dbUser ID, using default/guest CyberFitness profile.");
        setCyberProfile({ level: 0, kiloVibes: 0, weeklyActivity: [...DEFAULT_WEEKLY_ACTIVITY], cognitiveOSVersion: "v0.1 Guest Mode", unlockedPerks: ["Basic Interface"], activeQuests: ["Explore CyberVibe Studio"] });
        setProfileLoading(false);
      }
    };

    if (!appLoading) loadProfile();
  }, [dbUser, appLoading]);

  const isLoading = appLoading || profileLoading;

  if (isLoading) {
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
  const focusTime = cyberProfile?.focusTimeHours || 0;
  const skillsLeveled = cyberProfile?.skillsLeveled || unlockedPerks.length;
  const displayWeeklyActivity = cyberProfile?.weeklyActivity && cyberProfile.weeklyActivity.length > 0
                                  ? cyberProfile.weeklyActivity
                                  : DEFAULT_WEEKLY_ACTIVITY;

  const stats = [
    { label: "KiloVibes", value: kiloVibes.toLocaleString(), icon: <FaBolt className="text-brand-yellow" /> },
    { label: "Deep Work (ч)", value: focusTime, icon: <FaBrain className="text-brand-pink" /> },
    { label: "Перков", value: skillsLeveled, icon: <FaWandMagicSparkles className="text-brand-green" /> },
  ];

  const handleLogout = () => {
    toast.info("Функция выхода из системы в разработке.");
    // Future: supabase.auth.signOut();
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
            {/* CyberFitness Stats Section */}
            <section>
              <h2 className="text-xl font-orbitron text-brand-pink mb-3 flex items-center">
                <FaChartLine className="mr-2"/>Кибер-Метрики
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {stats.map((stat) => (
                  <Card key={stat.label} className="bg-dark-bg/70 p-4 text-center border border-brand-cyan/30 hover:shadow-brand-cyan/20 hover:shadow-md transition-shadow rounded-lg">
                    <div className="text-3xl mb-1 mx-auto">{stat.icon}</div>
                    <p className="text-2xl font-orbitron font-bold text-light-text">{stat.value}</p>
                    <p className="text-xs text-muted-foreground font-mono uppercase">{stat.label}</p>
                  </Card>
                ))}
              </div>
            </section>

            {/* Weekly Activity Chart */}
            <section>
                <h2 className="text-xl font-orbitron text-brand-green mb-3 flex items-center">
                    <FaListCheck className="mr-2" />Недельная Активность (KiloVibes) {/* Replaced FaTasks */}
                </h2>
                <Card className="bg-dark-bg/70 p-3 border border-brand-green/30 rounded-lg">
                    <div className="h-[120px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={displayWeeklyActivity} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} dy={5}/>
                            <YAxis hide={true} domain={[0, 'dataMax + 100']} />
                            <RechartsTooltip
                                cursor={{ fill: 'hsla(var(--brand-purple), 0.1)' }} /* Corrected: --brand-purple-hsl to --brand-purple */
                                contentStyle={{
                                    backgroundColor: 'rgba(13, 2, 33, 0.85)', /* Use var(--dark-bg-rgb) if possible or keep as is */
                                    borderColor: 'hsl(var(--brand-purple))',
                                    borderRadius: '0.5rem',
                                    color: 'hsl(var(--light-text))',
                                    fontSize: '0.75rem',
                                    fontFamily: 'monospace',
                                }}
                                itemStyle={{ color: 'hsl(var(--brand-yellow))' }}
                                labelStyle={{ color: 'hsl(var(--brand-cyan))', fontWeight: 'bold' }}
                                formatter={(value: number, name, props) => [`${value} KV`, props.payload.label || 'Активность']}
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

            {/* Unlocked Perks Section */}
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
                {unlockedPerks.length > 3 && (
                  <Button variant="link" size="sm" className="text-brand-yellow p-0 h-auto font-mono text-xs" onClick={() => setIsPerksModalOpen(true)}>
                    Показать все ({unlockedPerks.length}) <FaChevronRight className="ml-1 w-3 h-3"/>
                  </Button>
                )}
                 {unlockedPerks.length === 0 && (
                     <Button variant="link" size="sm" className="text-brand-yellow p-0 h-auto font-mono text-xs" onClick={() => setIsPerksModalOpen(true)}>
                        Узнать о Перках <FaChevronRight className="ml-1 w-3 h-3"/>
                    </Button>
                 )}
              </div>
            </section>

            {/* Actions Section */}
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
                <FaRightFromBracket className="mr-2" /> Деавторизация {/* Replaced FaSignOutAlt */}
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
    </div>
  );
}