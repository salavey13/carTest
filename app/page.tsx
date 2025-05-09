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
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts'; // Tooltip removed from imports
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Image from "next/image";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import {
  fetchUserCyberFitnessProfile,
  CyberFitnessProfile,
} from "@/hooks/cyberFitnessSupabase"; 

// --- Constants & Config - Moved outside the component ---
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
const FEATURED_QUEST_IMAGE = "/placeholders/cyber-brain-network.jpg"; 

// --- Framer Motion Variants - Moved outside the component ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: "easeOut" } },
};
const bottomNavVariants = {
    hidden: { y: 100, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 120, damping: 25, delay: 0.5 } },
};

export default function Home() {
  const { user: telegramUser, dbUser, isAuthenticated, isLoading: appLoading, error: appContextError } = useAppContext(); 
  const userName = dbUser?.first_name || telegramUser?.first_name || 'Agent';

  const [cyberProfile, setCyberProfile] = useState<CyberFitnessProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);

  useEffect(() => {
    logger.log("Home: Mount | App Loading:", appLoading, "| User:", dbUser ? dbUser.id : "None");
    const loadProfile = async () => {
      if (dbUser?.id) {
        logger.log(`Home: Fetching CyberFitness profile for ${dbUser.id}`);
        setProfileLoading(true);
        const result = await fetchUserCyberFitnessProfile(dbUser.id);
        if (result.success && result.data) {
          setCyberProfile(result.data);
          logger.log("Home: CyberFitness profile loaded:", result.data);
        } else {
          logger.warn(`Home: Failed to load CyberFitness profile for ${dbUser.id}. Error: ${result.error}. Initializing default.`);
          setCyberProfile({ level: 0, kiloVibes: 0, weeklyActivity: [...DEFAULT_WEEKLY_ACTIVITY], cognitiveOSVersion: "v0.1 Alpha" });
        }
        setProfileLoading(false);
      } else if (!appLoading) { 
        setProfileLoading(false);
        setCyberProfile({ level: 0, kiloVibes: 0, weeklyActivity: [...DEFAULT_WEEKLY_ACTIVITY], cognitiveOSVersion: "v0.1 Guest Mode"});
        logger.log("Home: No dbUser ID, using default/guest CyberFitness profile.");
      }
    };

    if (!appLoading) loadProfile();

  }, [dbUser, appLoading]);

  const isLoading = appLoading || profileLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-bg to-dark-card flex flex-col items-center justify-center p-4 text-center">
        <motion.div
          animate={{ rotate: [0, 360, 0], scale: [1, 1.2, 1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="loading-spinner-cyber w-24 h-24 mb-6" 
        />
        <p className="text-brand-cyan font-orbitron text-xl animate-pulse tracking-widest">
          {appLoading ? "CONNECTING TO CYBERVIBE GRID..." : "DECRYPTING COGNITIVE DATA..."}
        </p>
        <p className="text-muted-foreground text-sm font-mono animate-pulse mt-1">Please wait, Agent...</p>
      </div>
    );
  }

  if (appContextError) { 
    return (
      <motion.div
        initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-gradient-to-br from-dark-bg via-black to-red-900/70 text-red-300 font-orbitron flex flex-col items-center justify-center p-6 text-center"
      >
        <FaBolt className="text-8xl text-red-500 mb-6 animate-ping opacity-80"/>
        <p className="text-4xl mb-3 uppercase text-shadow-neon">CRITICAL SYSTEM FAILURE</p>
        <p className="text-lg text-red-200 font-mono mb-6">ERROR PAYLOAD: {appContextError.message}</p>
        <p className="text-md text-gray-400 font-mono">The CyberVibe core has encountered an anomaly. Your cognitive link may be unstable.</p>
        <Button variant="destructive" className="mt-8 font-mono text-lg px-6 py-3" onClick={() => window.location.reload()}>
          ATTEMPT HARD REBOOT
        </Button>
      </motion.div>
    );
  }

  const displayWeeklyActivity = cyberProfile?.weeklyActivity && cyberProfile.weeklyActivity.length > 0
                                  ? cyberProfile.weeklyActivity
                                  : DEFAULT_WEEKLY_ACTIVITY;
  const totalKiloVibes = cyberProfile?.kiloVibes || 0;
  const focusTimeHours = cyberProfile?.focusTimeHours || 0;
  const skillsLeveled = cyberProfile?.skillsLeveled || 0;
  const currentLevel = cyberProfile?.level || 0;
  const cognitiveOSVersion = cyberProfile?.cognitiveOSVersion || "v0.1 Alpha";
  const nextLevelTarget = (currentLevel + 1) * 1000;

  return ( 
    <div className="homepage-wrapper">
       <div className="homepage-bg-effects-container">
         <div className="homepage-bg-pulse-fast" />
         <div className="homepage-bg-pulse-slow" />
         <div className="absolute inset-0 bg-grid-pattern opacity-[0.04] animate-[drift_30s_linear_infinite]"></div>
       </div>

      <motion.div
        variants={containerVariants} initial="hidden" animate="visible"
        className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 space-y-5 md:space-y-8"
      >
        {/* 1. Top Bar / Greeting */}
        <motion.div variants={itemVariants} className="flex justify-between items-center">
          <div>
            <h1 className="text-xl sm:text-2xl font-orbitron font-bold text-brand-cyan cyber-text" data-text={`Agent: ${userName}`}>
              Agent: <span className="text-brand-pink glitch" data-text={userName}>{userName}</span>
            </h1>
            <p className="text-muted-foreground font-mono text-xs sm:text-sm mt-0.5">
              Cognitive OS {cognitiveOSVersion} | Level: <span className="text-brand-yellow font-semibold">{currentLevel}</span>
            </p>
          </div>
          <Link href="/profile" className="transition-transform duration-200 hover:scale-110">
            <Image
              src={dbUser?.avatar_url || telegramUser?.photo_url || PLACEHOLDER_AVATAR}
              alt={`${userName}'s Cybernetic Avatar`}
              width={52} height={52}
              className="avatar-cyber w-11 h-11 sm:w-13 sm:h-13"
              priority
            />
          </Link>
        </motion.div>

        {/* 2. Featured "Quests/Missions" Section */}
        <motion.div variants={itemVariants}>
          <Card className="featured-quest-card group">
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-3 px-4 md:px-5">
              <div>
                <CardTitle className="text-lg sm:text-xl font-orbitron text-brand-yellow">Priority Directives</CardTitle>
                <CardDescription className="text-muted-foreground font-mono text-xs">Current Level {currentLevel}+ Challenges</CardDescription>
              </div>
              <Button asChild variant="outline" size="xs" className="border-brand-yellow text-brand-yellow hover:bg-brand-yellow/10 hover:text-white font-mono text-xs px-2 py-1 h-auto group-hover:border-brand-pink group-hover:text-brand-pink">
                <Link href="/selfdev/gamified">
                  All Directives <FaArrowRight className="ml-1 h-2.5 w-2.5 group-hover:animate-[wiggle_0.5s_ease-in-out_infinite] group-hover:text-glow-effect"/>
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Link href="/selfdev/gamified#levelup_fitness" className="block relative aspect-[16/5] sm:aspect-[16/4.5] w-full">
                 <Image
                    src={FEATURED_QUEST_IMAGE}
                    alt="Featured Quest: Enhance Cognitive Matrix"
                    layout="fill" objectFit="cover"
                    className="opacity-50 group-hover:opacity-70 group-hover:scale-105 transition-all duration-400 ease-in-out"
                    priority
                  />
                 <div className="featured-quest-image-overlay"></div>
                 <div className="absolute bottom-2 left-3 sm:bottom-3 sm:left-4 text-white z-10 p-1">
                    <h3 className="text-md sm:text-lg font-bold font-orbitron text-shadow-[0_0_8px_theme(colors.brand-cyan)]">
                      <VibeContentRenderer content="<FaGamepad className='inline text-brand-pink/90 mr-2 text-2xl sm:text-3xl'/>INITIATE: CyberDev OS Training Program" />
                    </h3>
                    <p className="text-xs sm:text-sm font-mono text-gray-300">
                      <VibeContentRenderer content="Your journey from Level 0: <FaEye className='inline mx-0.5'/> See the Code, <FaBolt className='inline mx-0.5'/> Become the Vibe." />
                    </p>
                  </div>
                 <div className="absolute top-2 right-3 sm:top-3 sm:right-4 text-white z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <FaArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-brand-pink animate-[pulse_1.5s_infinite]"/>
                 </div>
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        {/* 3. "Activity/Vibe Output" Section */}
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
                  <div className="text-right space-y-0">
                      <p className="text-sm sm:text-md font-semibold text-white/95 leading-tight">{focusTimeHours} <span className="text-2xs font-mono">hrs</span></p>
                      <p className="text-2xs font-mono uppercase text-black/85">Deep Work</p>
                      <p className="text-sm sm:text-md font-semibold text-white/95 leading-tight">{skillsLeveled} <span className="text-2xs font-mono">Perks</span></p>
                       <p className="text-2xs font-mono uppercase text-black/85">Unlocked</p>
                  </div>
              </div>
            </CardHeader>
            <CardContent className="px-1 pb-2 pt-0 md:px-2 md:pb-3">
              <div className="h-[70px] sm:h-[90px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={displayWeeklyActivity} margin={{ top: 10, right: 5, left: 5, bottom: 0 }}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'rgba(0,0,0,0.85)', fontWeight: 700 }} dy={4}/>
                    <YAxis hide={true} domain={[0, 'dataMax + 500']} />
                    {/* Tooltip is commented out as per previous step to isolate the build error */}
                    <Bar dataKey="value" radius={[2, 2, 0, 0]} barSize={18} minPointSize={2}>
                      {displayWeeklyActivity.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} fillOpacity={0.85}/>
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bottom Navigation */}
        <motion.div
            variants={bottomNavVariants} initial="hidden" animate="visible"
            className="bottom-nav-cyber" 
          >
            <div className="container mx-auto flex justify-around items-center max-w-xs sm:max-w-sm">
              {[
                { href: "/", icon: FaBrain, label: "OS Home", color: "text-brand-pink" },
                { href: "/selfdev/gamified", icon: FaUpLong, label: "LevelUp", color: "text-brand-green" },
                { href: "/repo-xml", icon: FaGithub, label: "Studio", isCentral: true, centralColor: "from-brand-orange to-brand-yellow"},
                { href: "/p-plan", icon: FaChartLine, label: "VibePlan", color: "text-brand-cyan" },
                { href: "/profile", icon: FaUserNinja, label: "AgentOS", color: "text-brand-yellow" },
              ].map(item => (
                 item.isCentral ? (
                    <Button asChild size="icon" className={`bottom-nav-item-central bg-gradient-to-br ${item.centralColor}`} key={item.label}>
                        <Link href={item.href}>
                            <item.icon className="w-6 h-6 sm:w-7 sm:h-7"/>
                        </Link>
                    </Button>
                 ) : (
                    <Button asChild variant="ghost" className={`bottom-nav-item ${item.color}`} key={item.label}>
                        <Link href={item.href}>
                            <item.icon className="w-5 h-5 sm:w-6 sm:h-6 mb-0.5" />
                            <span className="text-[0.6rem] sm:text-xs font-orbitron tracking-tighter leading-none">{item.label}</span>
                        </Link>
                    </Button>
                 )
              ))}
            </div>
        </motion.div>

        {/* Admin Icon */}
        {dbUser?.status === "admin" && (
          <motion.div
            initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1, type: "spring", stiffness: 100 }}
            className="fixed bottom-20 md:bottom-24 right-3 sm:right-4 z-50"
          >
             <Button
                asChild
                variant="outline" 
                size="icon"
                className="bg-dark-card/80 border-brand-red/70 text-brand-red hover:bg-brand-red/20 hover:text-white rounded-full w-10 h-10 sm:w-11 sm:h-11 shadow-lg backdrop-blur-sm"
                aria-label="Admin Override Terminal"
              >
               <Link href="/admin">
                 <FaUserNinja className="h-5 w-5 sm:h-6 sm:h-6" />
               </Link>
             </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}