"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { debugLogger as logger } from "@/lib/debugLogger";
import { useAppContext } from "@/contexts/AppContext";
import { motion } from "framer-motion";
import {
  FaBrain, FaGamepad, FaBolt, FaChartLine, FaUserNinja,
  FaArrowRight, FaEye, FaUpLong, FaFire, FaGithub,
} from "react-icons/fa6";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts'; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Image from "next/image";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import {
  fetchUserCyberFitnessProfile,
  CyberFitnessProfile,
} from "@/hooks/cyberFitnessSupabase"; 
import { format } from 'date-fns'; 
import { ru } from 'date-fns/locale'; 

const DEFAULT_WEEKLY_ACTIVITY = [
  { name: 'MO', value: 0, label: 'System Idle' }, { name: 'TU', value: 0, label: 'System Idle' },
  { name: 'WE', value: 0, label: 'System Idle' }, { name: 'TH', value: 0, label: 'System Idle' },
  { name: 'FRI', value: 0, label: 'System Idle' }, { name: 'SA', value: 0, label: 'System Idle' },
  { name: 'SU', value: 0, label: 'System Idle' },
];
const CHART_COLORS = [ 
  'hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))',
  'hsl(var(--chart-5))', 'hsl(var(--chart-4))', 'hsl(var(--brand-green))', 
  'hsl(var(--brand-orange))' 
];
const PLACEHOLDER_AVATAR = "/placeholders/cyber-agent-avatar.png"; 
const FEATURED_QUEST_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250510_035401-e6d0b2d8-9f28-4516-a5c7-fe729b31f736.jpg"; 

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: "easeOut" } },
};

export default function Home() {
  const appContext = useAppContext(); 
  const { user: telegramUser, dbUser, isLoading: appLoading, error: appContextError } = appContext; // Removed isAuthenticating
  
  const [cyberProfile, setCyberProfile] = useState<CyberFitnessProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadProfile = async () => {
      logger.log(`[HomePage] loadProfile triggered. appLoading: ${appLoading}, dbUser.id: ${dbUser?.id}`);
      if (appLoading) { 
        logger.log(`[HomePage] AppContext is still loading. Waiting to fetch profile.`);
        setProfileLoading(true);
        return;
      }

      // At this point, appLoading is false. We can now check dbUser.
      if (dbUser?.id) {
        setProfileLoading(true);
        logger.log(`[HomePage] Context fully loaded, dbUser.id available. Fetching profile for user ${dbUser.id}`);
        const result = await fetchUserCyberFitnessProfile(dbUser.id);
        if (result.success && result.data) {
          setCyberProfile(result.data);
          logger.log(`[HomePage] Profile loaded for ${dbUser.id}:`, result.data);
        } else {
          logger.warn(`[HomePage] Failed to load profile for ${dbUser.id}. Error: ${result.error}. Defaulting.`);
          setCyberProfile({ level: 0, kiloVibes: 0, focusTimeHours: 0, skillsLeveled: 0, activeQuests: [], completedQuests: [], unlockedPerks: [], achievements: [], cognitiveOSVersion: "v0.1 Alpha Error", lastActivityTimestamp: new Date(0).toISOString(), dailyActivityLog: [], totalFilesExtracted: 0, totalTokensProcessed: 0, totalKworkRequestsSent: 0, totalPrsCreated: 0, totalBranchesUpdated: 0, featuresUsed: {} });
        }
        setProfileLoading(false);
      } else { 
        logger.log(`[HomePage] Context fully loaded, but no dbUser.id. Using guest profile.`);
        setCyberProfile({ level: 0, kiloVibes: 0, focusTimeHours: 0, skillsLeveled: 0, activeQuests: [], completedQuests: [], unlockedPerks: [], achievements: [], cognitiveOSVersion: "v0.1 Guest Mode", lastActivityTimestamp: new Date(0).toISOString(), dailyActivityLog: [], totalFilesExtracted: 0, totalTokensProcessed: 0, totalKworkRequestsSent: 0, totalPrsCreated: 0, totalBranchesUpdated: 0, featuresUsed: {} });
        setProfileLoading(false);
      }
    };

    loadProfile();

  }, [dbUser, appLoading]); 

  const isLoadingDisplay = appLoading || profileLoading; 

  const userName = cyberProfile?.cognitiveOSVersion?.includes("Guest")
    ? 'Agent' 
    : dbUser?.first_name || telegramUser?.first_name || 'Agent';
  
  const currentLevel = cyberProfile?.level ?? 0;
  const cognitiveOSVersion = cyberProfile?.cognitiveOSVersion || (isLoadingDisplay ? "Загрузка ОС..." : "v0.1 Alpha");


  if (isLoadingDisplay && !cyberProfile) { 
      return (
         <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 text-center">
            <FaBrain className="text-5xl text-brand-pink animate-pulse mb-6" />
            <p className="text-brand-pink font-orbitron text-xl animate-pulse tracking-widest">
              ЗАГРУЗКА ИНТЕРФЕЙСА АГЕНТА...
            </p>
         </div>
      );
  }
  if (appContextError) { 
      return (
         <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 text-center">
            <FaUserNinja className="text-5xl text-red-500 mb-6" />
            <p className="text-red-500 font-orbitron text-xl">
              Ошибка загрузки контекста: {appContextError.message}
            </p>
         </div>
      );
  }

  const chartReadyWeeklyActivity = (cyberProfile?.dailyActivityLog && cyberProfile.dailyActivityLog.length > 0 
    ? cyberProfile.dailyActivityLog.map(d => ({ name: format(new Date(d.date + "T00:00:00Z"), 'EEE', {locale: ru}).substring(0,2).toUpperCase(), value: d.kworkRequestsSent || 0, label: `${d.kworkRequestsSent || 0} req` }))
    : DEFAULT_WEEKLY_ACTIVITY
  ).slice(-7); 

  const totalKiloVibes = cyberProfile?.kiloVibes || 0;
  const focusTimeHours = cyberProfile?.focusTimeHours || 0;
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
            <h1 className="text-xl sm:text-2xl font-orbitron font-bold text-brand-cyan cyber-text" data-text={`Agent: ${userName}`}>Agent: <span className="text-brand-pink glitch" data-text={userName}>{userName}</span></h1>
            <p className="text-muted-foreground font-mono text-xs sm:text-sm mt-0.5">Cognitive OS {cognitiveOSVersion} | Level: <span className="text-brand-yellow font-semibold">{currentLevel}</span></p>
          </div>
          <Link href="/profile" className="transition-transform duration-200 hover:scale-110">
            <Image src={dbUser?.avatar_url || telegramUser?.photo_url || PLACEHOLDER_AVATAR} alt={`${userName}'s Cybernetic Avatar`} width={52} height={52} className="avatar-cyber w-11 h-11 sm:w-13 sm:h-13" priority />
          </Link>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card className="featured-quest-card group">
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-3 px-4 md:px-5">
              <div>
                <CardTitle className="text-lg sm:text-xl font-orbitron text-brand-yellow">Priority Directives</CardTitle>
                <CardDescription className="text-muted-foreground font-mono text-xs">Current Level {currentLevel}+ Challenges</CardDescription>
              </div>
              <Button asChild variant="outline" size="xs" className="border-brand-yellow text-brand-yellow hover:bg-brand-yellow/10 hover:text-white font-mono text-xs px-2 py-1 h-auto group-hover:border-brand-pink group-hover:text-brand-pink">
                <Link href="/selfdev/gamified">All Directives <FaArrowRight className="ml-1 h-2.5 w-2.5 group-hover:animate-[wiggle_0.5s_ease-in-out_infinite]"/></Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Link href="/selfdev/gamified#levelup_fitness" className="block relative aspect-[16/5] sm:aspect-[16/4.5] w-full">
                 <Image src={FEATURED_QUEST_IMAGE} alt="Featured Quest: Enhance Cognitive Matrix" fill sizes="(max-width: 640px) 100vw, 50vw" style={{ objectFit: 'cover' }} className="opacity-50 group-hover:opacity-70 group-hover:scale-105 transition-all duration-400 ease-in-out" priority />
                 <div className="featured-quest-image-overlay"></div>
                 <div className="absolute bottom-2 left-3 sm:bottom-3 sm:left-4 text-white z-10 p-1">
                    <h3 className="text-md sm:text-lg font-bold font-orbitron text-shadow-[0_0_8px_theme(colors.brand-cyan)]">
                      <VibeContentRenderer content="::FaGamepad className='inline text-brand-pink/90 mr-2 text-2xl sm:text-3xl align-middle'::INITIATE: CyberDev OS Training Program" />
                    </h3>
                    <div className="text-xs sm:text-sm font-mono text-gray-300">
                        <span>Your journey from Level 0:&nbsp;</span>
                        <VibeContentRenderer content="::FaEye className='inline mx-0.5 align-middle'::" />
                        <span>&nbsp;See the Code,&nbsp;</span>
                        <VibeContentRenderer content="::FaBolt className='inline mx-0.5 align-middle'::" />
                        <span>&nbsp;Become the Vibe.</span>
                    </div>
                  </div>
                 <div className="absolute top-2 right-3 sm:top-3 sm:right-4 text-white z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <FaArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-brand-pink animate-[pulse_1.5s_infinite]"/>
                 </div>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card className="activity-card-cyber">
            <CardHeader className="pb-1 pt-3 px-4 md:px-5">
              <CardTitle className="text-md sm:text-lg font-orbitron text-black/95 font-bold uppercase tracking-wider flex items-center">
                <FaFire className="inline mr-1.5 text-orange-300/90 drop-shadow-sm"/>Cognitive Throughput <span className="text-xs ml-auto text-black/70">(Weekly Cycle)</span>
              </CardTitle>
              <div className="flex items-end justify-between gap-2 mt-1">
                  <div>
                      <p className="text-3xl sm:text-4xl font-bold text-white drop-shadow-md leading-none">{totalKiloVibes.toLocaleString()}</p>
                      <p className="text-2xs sm:text-xs font-mono uppercase tracking-wider text-black/85 font-semibold">KiloVibes</p>
                  </div>
                  <div className="text-right"> 
                      <p className="text-sm sm:text-md font-semibold text-white/95 leading-tight mb-0.5">{focusTimeHours} <span className="text-2xs font-mono">hrs</span></p>
                      <p className="text-2xs font-mono uppercase text-black/85 mb-1">Deep Work</p>
                      <p className="text-sm sm:text-md font-semibold text-white/95 leading-tight mb-0.5">{skillsLeveled} <span className="text-2xs font-mono">Perks</span></p>
                       <p className="text-2xs font-mono uppercase text-black/85">Unlocked</p>
                  </div>
              </div>
            </CardHeader>
            <CardContent className="px-1 pb-2 pt-2 md:px-2 md:pb-3"> 
              <div className="h-[70px] sm:h-[90px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartReadyWeeklyActivity} margin={{ top: 10, right: 5, left: 5, bottom: 0 }}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'rgba(0,0,0,0.85)', fontWeight: 700 }} dy={4}/>
                    <YAxis hide={true} domain={[0, 'dataMax + 500']} />
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
             <Button asChild variant="outline" size="icon" className="bg-dark-card/80 border-brand-red/70 text-brand-red hover:bg-brand-red/20 hover:text-white rounded-full w-10 h-10 sm:w-11 sm:h-11 shadow-lg backdrop-blur-sm" aria-label="Admin Override Terminal">
               <Link href="/admin"><FaUserNinja className="h-5 w-5 sm:h-6 sm:h-6" /></Link>
             </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}