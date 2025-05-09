"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { debugLogger } from "@/lib/debugLogger";
import { useAppContext } from "@/contexts/AppContext";
import { motion } from "framer-motion";
import {
  FaBrain,         // Core "Brain" icon
  FaGamepad,       // Gamification, Quests
  FaBolt,          // Speed, Efficiency, Level Up
  FaChartLine,     // Progress Tracking
  FaCodeBranch,    // Skills / Tasks
  FaUserNinja,     // Admin icon / Mastery
  FaWandMagicSparkles, // AI Magic
  FaArrowRight,    // CTA
  FaPlus,          // Add/Start Action
  FaEye,           // Vision, Seeing the Matrix
  FaUpLong,        // Level Up / Vibe Loop
  FaFire,          // Intensity / KiloVibes
  FaUsers,         // Community / Alliance
  FaGithub,        // Code / Studio
} from "react-icons/fa6";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import TopNavButtons from "@/components/TopNavButtons";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Image from "next/image";
import VibeContentRenderer from "@/components/VibeContentRenderer"; // Import the renderer

// --- Placeholder Data & Theme Colors ---
const weeklyActivityData = [ // Simulate weekly cognitive output
  { name: 'MO', value: 1500, label: 'Task Automation' },
  { name: 'TU', value: 2800, label: 'AI Prompting Lvl 2' },
  { name: 'WE', value: 2000, label: 'Content Remixing' },
  { name: 'TH', value: 3500, label: 'Code Generation' },
  { name: 'FRI', value: 3100, label: 'System Debug (Lvl 4 Prep)' },
  { name: 'SA', value: 4200, label: 'Vibe Channeling Practice' },
  { name: 'SU', value: 1800, label: 'Experimental Mindset PACT' },
];
// Use theme colors directly for Cells
const chartColors = [
    'hsl(var(--primary))',    // Pink
    'hsl(var(--secondary))',  // Cyan
    'hsl(var(--accent))',     // Orange
    'hsl(var(--chart-5))',    // Yellow/Gold
    'hsl(var(--chart-4))',    // Purple Variant
    'hsl(var(--destructive))',// Red (less frequent use)
    'hsl(var(--brand-green))' // Neon Green (from tailwind config)
];

// Variants for Framer Motion
const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.1 + 0.1, duration: 0.6, ease: "easeOut" },
  }),
};
const titleVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.1 } },
};
const buttonVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 150, damping: 15, delay: 0.5 } },
    hover: { scale: 1.08, transition: { type: "spring", stiffness: 300 }}
};


export default function Home() {
  const { dbUser, isAuthenticated, isLoading, error, isInTelegramContext } = useAppContext();
  const userName = dbUser?.first_name || 'Agent'; // Use Agent as default

  useEffect(() => {
    debugLogger.log("Home component mounted (CyberFitness Training Program)", { isLoading, dbUser, error });
  }, [isLoading, dbUser, error]);

  // --- Loading State ---
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-bg to-dark-card flex flex-col items-center justify-center p-4">
        <motion.div
          animate={{ rotate: [0, 360], scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          className="w-20 h-20 border-4 border-t-brand-cyan border-brand-cyan/30 rounded-full shadow-[0_0_20px_theme(colors.brand-cyan)] mb-5"
        />
        <p className="text-brand-cyan font-orbitron text-lg animate-pulse tracking-widest">SYNAPSES FIRING...</p>
        <p className="text-muted-foreground text-xs font-mono animate-pulse">Loading Cognitive Enhancements...</p>
      </div>
    );
  }

  // --- Error State ---
  if (error) {
    debugLogger.error("Error in Home component (CyberFitness Theme):", error);
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-screen bg-gradient-to-br from-dark-bg via-black to-red-900/60 text-red-400 font-orbitron flex flex-col items-center justify-center p-6 text-center"
      >
        <FaBolt className="text-7xl text-red-500 mb-6 animate-ping opacity-75"/>
        <p className="text-3xl mb-3 uppercase text-shadow-neon">KERNEL PANIC</p>
        <p className="text-lg text-red-300 font-mono mb-5">Error: {error.message}</p>
        <p className="text-md text-gray-500 font-mono">Matrix connection unstable. Cognitive reboot sequence initiated.</p>
        <Button variant="destructive" className="mt-6 font-mono" onClick={() => window.location.reload()}>
          FORCE REBOOT
        </Button>
      </motion.div>
    );
  }

  // --- Main Content ---
  const totalKiloVibes = weeklyActivityData.reduce((sum, day) => sum + day.value, 0);
  // Example dynamic metrics based on KiloVibes
  const focusTimeHours = Math.round(totalKiloVibes / 1000); // Arbitrary calculation
  const skillsLeveled = Math.floor(totalKiloVibes / 2500); // Arbitrary calculation
  const currentLevel = dbUser?.metadata?.cyber_level || 0; // Example: Get level from user data

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-black to-dark-card text-light-text relative overflow-hidden pt-20 pb-10">
       {/* Background Effects */}
       <div className="absolute inset-0 z-0 overflow-hidden">
         <div className="absolute top-[-10%] left-[-10%] w-1/2 h-1/2 bg-brand-purple/25 rounded-full blur-[120px] opacity-40 animate-pulse pointer-events-none" />
         <div className="absolute bottom-[-20%] right-[-20%] w-2/3 h-2/3 bg-brand-pink/20 rounded-full blur-[150px] opacity-35 animate-pulse pointer-events-none delay-2000" />
         <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] animate-[drift_25s_linear_infinite]"></div>
       </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 space-y-6 md:space-y-10">

        {/* 1. Top Bar / Greeting */}
        <motion.div
          variants={titleVariants} initial="hidden" animate="visible"
          className="flex justify-between items-center"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-orbitron font-bold text-brand-cyan cyber-text" data-text={`Agent: ${userName}`}>
              Agent: <span className="text-brand-pink glitch" data-text={userName}>{userName}</span>
            </h1>
            <p className="text-muted-foreground font-mono text-xs sm:text-sm mt-1">Cognitive OS v2.0 | Level: <span className="text-brand-yellow">{currentLevel}</span></p>
          </div>
          {/* Optional: User avatar like in the screenshot */}
          <Link href="/profile">
            <Image
              src={dbUser?.avatar_url || user?.photo_url || "/placeholders/avatar.png"}
              alt={`${userName}'s Avatar`}
              width={48}
              height={48}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-brand-pink/70 shadow-lg hover:border-brand-cyan transition-colors cursor-pointer"
            />
          </Link>
        </motion.div>

        {/* 2. Featured "Quests/Missions" Section */}
        <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={0}>
          <Card className="bg-dark-card/85 backdrop-blur-sm border border-brand-purple/40 shadow-xl overflow-hidden hover:shadow-brand-purple/30 hover:border-brand-purple/60 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4 md:px-6">
              <div>
                <CardTitle className="text-xl sm:text-2xl font-orbitron text-brand-yellow">Active Quests</CardTitle>
                <CardDescription className="text-muted-foreground font-mono text-xs">Level {currentLevel}+ Challenges Available</CardDescription>
              </div>
              <Link href="/selfdev/gamified" passHref legacyBehavior>
                <Button variant="outline" size="sm" className="border-brand-yellow text-brand-yellow hover:bg-brand-yellow/10 hover:text-white font-mono text-xs">
                  View All <FaArrowRight className="ml-1.5 h-3 w-3"/>
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {/* Image Placeholder - Replace with dynamic/relevant quest image */}
              <Link href="/selfdev/gamified" className="block relative aspect-[16/6] w-full group">
                 <Image
                    src="https://placehold.co/1200x450/0D0221/FF00FF/png?text=Quest:+Master+CyberVibe+Studio+(Lvl+1-5)" // More relevant placeholder
                    alt="Featured CyberFitness Quest"
                    layout="fill"
                    objectFit="cover"
                    className="opacity-60 group-hover:opacity-80 transition-opacity duration-300"
                  />
                 <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none"></div>
                 <div className="absolute bottom-3 left-4 md:bottom-4 md:left-6 text-white z-10 transition-transform duration-300 group-hover:translate-y-[-4px]">
                    <h3 className="text-lg sm:text-xl font-bold font-orbitron text-shadow-neon">Start Your Ascension</h3>
                    <p className="text-xs sm:text-sm font-mono text-gray-300">Begin with Level 0 → 1: The Image Swap</p>
                  </div>
                 <div className="absolute top-3 right-4 md:top-4 md:right-6 text-white z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <FaArrowRight className="w-5 h-5 text-brand-pink animate-pulse"/>
                 </div>
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        {/* 3. "Activity/Vibe Output" Section */}
        <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={1}>
          {/* Apply the bright pink bg and specific styling from screenshot */}
          <Card className="bg-gradient-to-br from-brand-pink via-pink-600 to-purple-600 backdrop-blur-sm border border-brand-pink/60 shadow-lg text-black rounded-xl md:rounded-2xl">
            <CardHeader className="pb-2 pt-4 px-4 md:px-6">
              <CardTitle className="text-lg sm:text-xl font-orbitron text-black/95 font-bold uppercase tracking-wider">Cognitive Output</CardTitle>
              {/* Main Metrics */}
              <div className="flex items-end justify-between gap-2 mt-1 sm:mt-2">
                  <div>
                      <p className="text-4xl sm:text-5xl font-bold text-white drop-shadow-md leading-none">{totalKiloVibes.toLocaleString()}</p>
                      <p className="text-xs sm:text-sm font-mono uppercase tracking-wider text-black/80 font-semibold">KiloVibes <span className="hidden sm:inline">Generated</span></p>
                  </div>
                  <div className="text-right space-y-0">
                      <p className="text-md sm:text-lg font-semibold text-white/95 leading-tight">{focusTimeHours} <span className="text-xs font-mono">hrs</span></p>
                      <p className="text-xs font-mono uppercase text-black/80">Focus Time</p>
                      <p className="text-md sm:text-lg font-semibold text-white/95 leading-tight">{skillsLeveled} <span className="text-xs font-mono">Skills</span></p>
                       <p className="text-xs font-mono uppercase text-black/80">Leveled Up</p>
                  </div>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-3 pt-1 md:px-4 md:pb-4">
              {/* Weekly Chart */}
              <div className="h-[80px] sm:h-[100px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyActivityData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                    {/* Customize axis ticks to match screenshot */}
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'rgba(0,0,0,0.8)', fontWeight: 600 }} dy={5}/>
                    <YAxis hide={true} domain={[0, 'dataMax + 500']} />{/* Add domain for better scaling */}
                    <Bar dataKey="value" radius={[3, 3, 0, 0]} barSize={20}>
                      {weeklyActivityData.map((entry, index) => (
                        // Use theme colors for bars, slightly transparent
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} fillOpacity={0.75}/>
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 4. Bottom Nav / Main Actions (Inspired by Screenshot) */}
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="fixed bottom-0 left-0 right-0 bg-dark-bg/90 backdrop-blur-md border-t border-brand-purple/30 z-30 p-2 shadow-2xl shadow-black" // Adjusted padding
            // Or use sticky positioning if preferred: className="sticky bottom-0 z-30 ..."
          >
            <div className="container mx-auto flex justify-around items-center max-w-md">
              <Link href="/" passHref legacyBehavior>
                <Button variant="ghost" className="flex flex-col items-center h-auto px-2 py-1 text-brand-pink hover:bg-brand-pink/10 rounded-md">
                  <FaBrain className="w-5 h-5 mb-0.5" />
                  <span className="text-xs font-mono">Dashboard</span>
                </Button>
              </Link>
              <Link href="/selfdev/gamified" passHref legacyBehavior>
                <Button variant="ghost" className="flex flex-col items-center h-auto px-2 py-1 text-light-text hover:bg-light-text/10 rounded-md">
                  <FaCodeBranch className="w-5 h-5 mb-0.5" />
                  <span className="text-xs font-mono">Level Up</span>
                </Button>
              </Link>
              {/* Central Action Button */}
              <Link href="/repo-xml" passHref legacyBehavior>
                  <Button size="icon" className="bg-gradient-to-br from-brand-orange to-brand-yellow text-black rounded-full w-14 h-14 shadow-lg transform hover:scale-110 transition-transform -translate-y-2 border-2 border-dark-bg">
                      <FaPlus className="w-6 h-6"/>
                  </Button>
              </Link>
              <Link href="/p-plan" passHref legacyBehavior> {/* Example link */}
                <Button variant="ghost" className="flex flex-col items-center h-auto px-2 py-1 text-light-text hover:bg-light-text/10 rounded-md">
                  <FaChartLine className="w-5 h-5 mb-0.5" />
                  <span className="text-xs font-mono">Stats</span>
                </Button>
              </Link>
              <Link href="/profile" passHref legacyBehavior>
                <Button variant="ghost" className="flex flex-col items-center h-auto px-2 py-1 text-light-text hover:bg-light-text/10 rounded-md">
                  <FaUserNinja className="w-5 h-5 mb-0.5" />
                  <span className="text-xs font-mono">Profile</span>
                </Button>
              </Link>
            </div>
        </motion.div>

        {/* Spacer to prevent content overlap with fixed bottom nav */}
         <div className="h-20"></div> {/* Adjust height based on the bottom nav height */}

      </div>

      {/* Admin Icon - Adjusted position slightly due to bottom nav */}
      {dbUser?.status === "admin" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 1.0 }}
          className="fixed bottom-24 right-5 z-50" // Moved up
        >
           {/* Tooltip can be added back here if needed */}
           <Link href="/admin" legacyBehavior>
             <Button
               variant="ghost"
               className="bg-brand-purple/80 text-light-text hover:bg-brand-pink/90 rounded-full w-12 h-12 flex items-center justify-center shadow-cyber-shadow border-2 border-brand-cyan/60 hover:border-brand-pink transition-all"
               aria-label="Admin Control Deck"
             >
               <FaUserNinja className="h-6 w-6" />
             </Button>
           </Link>
        </motion.div>
      )}
    </div>
  );
}