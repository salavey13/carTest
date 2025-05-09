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
  FaPlus           // Add/Start Action
} from "react-icons/fa6";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts'; // Basic chart
import TopNavButtons from "@/components/TopNavButtons"; // Keep using this for core nav
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"; // Use Cards for structure
import Image from "next/image"; // For featured image

// --- Placeholder Data for Chart ---
// Simulate weekly activity data (e.g., KiloVibes generated or tasks completed)
const weeklyActivityData = [
  { name: 'MO', value: 1500 },
  { name: 'TU', value: 2800 },
  { name: 'WE', value: 2000 },
  { name: 'TH', value: 3500 },
  { name: 'FRI', value: 3100 },
  { name: 'SA', value: 4200 },
  { name: 'SU', value: 1800 },
];
const chartColors = ['#6A0DAD', '#FF00FF', '#FFA500', '#FFD700', '#00FFFF', '#39FF14', '#AEFF00']; // Colors from our theme

export default function Home() {
  const { dbUser, isAuthenticated, isLoading, error, isInTelegramContext } = useAppContext();

  useEffect(() => {
    debugLogger.log("Home component mounted (CyberFitness Theme)", { isLoading, isInTelegramContext, dbUser, error });
  }, [isLoading, isInTelegramContext, dbUser, error]);

  // --- Loading State ---
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-bg to-dark-card flex flex-col items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-16 h-16 border-4 border-t-brand-pink border-brand-pink/30 rounded-full shadow-cyber-shadow mb-4"
        />
        <p className="text-brand-pink font-orbitron text-lg animate-pulse">INITIALIZING BRAIN INTERFACE...</p>
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
        className="min-h-screen bg-gradient-to-br from-dark-bg to-red-900/50 text-red-400 font-orbitron flex flex-col items-center justify-center p-4 text-center"
      >
        <FaBolt className="text-6xl text-red-500 mb-5 animate-ping" />
        <p className="text-2xl mb-2">SYSTEM OVERLOAD</p>
        <p className="text-md text-red-300 font-mono mb-4">Error: {error.message}</p>
        <p className="text-sm text-gray-500">Attempting cognitive reboot sequence is advised.</p>
      </motion.div>
    );
  }

  // --- Main Content ---
  // Calculate some dynamic numbers for the activity card
  const totalKiloVibes = weeklyActivityData.reduce((sum, day) => sum + day.value, 0);
  const focusTimeMinutes = Math.round(totalKiloVibes / 15); // Example calculation
  const skillsLeveled = Math.floor(totalKiloVibes / 1000); // Example calculation

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-black to-dark-card text-light-text relative overflow-hidden pt-24 pb-10">
       {/* Background Effects */}
       <div className="absolute inset-0 z-0">
         <div className="absolute top-[-5%] left-[-5%] w-1/3 h-1/3 bg-brand-cyan/15 rounded-full blur-[80px] opacity-40 animate-pulse pointer-events-none" />
         <div className="absolute bottom-[-15%] right-[-15%] w-1/2 h-1/2 bg-brand-orange/15 rounded-full blur-[120px] opacity-30 animate-pulse pointer-events-none delay-1500" />
         <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]"></div>
       </div>

      <div className="relative z-10 container mx-auto px-4 space-y-8 md:space-y-12">

        {/* 1. Header Equivalent (Implicit via Header component, added greeting) */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-center md:text-left"
        >
          <h1 className="text-3xl md:text-4xl font-orbitron font-bold text-brand-cyan cyber-text glitch" data-text={`Welcome, ${dbUser?.first_name || 'Agent'}`}>
            Welcome, <span className="text-brand-pink">{dbUser?.first_name || 'Agent'}!</span>
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Ready to level up your cognitive OS?</p>
        </motion.div>

        {/* 2. Featured "Missions/Quests" Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <Card className="bg-dark-card/80 backdrop-blur-sm border border-brand-purple/30 shadow-lg overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 px-4 md:px-6">
              <div>
                <CardTitle className="text-2xl font-orbitron text-brand-yellow">Your Missions</CardTitle>
                <CardDescription className="text-muted-foreground font-mono text-xs">5 Active Quests Available</CardDescription>
              </div>
              <Link href="/selfdev/gamified" passHref legacyBehavior>
                <Button variant="outline" size="sm" className="border-brand-yellow text-brand-yellow hover:bg-brand-yellow/10 font-mono text-xs">
                  Explore All <FaArrowRight className="ml-1 h-3 w-3"/>
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {/* Image with Gradient Overlay */}
              <div className="relative aspect-[16/7] md:aspect-[16/5] w-full">
                 <Image
                    // Replace with a relevant image (e.g., brain circuits, AI interface)
                    src="https://placehold.co/1200x400/1A0A3D/00FFFF/png?text=Featured+Mission:+AI+Prompt+Mastery"
                    alt="Featured CyberFitness Mission"
                    layout="fill"
                    objectFit="cover"
                    className="opacity-70"
                  />
                  {/* Gradient overlay matching the screenshot */}
                 <div className="absolute inset-0 bg-gradient-to-r from-brand-orange/30 via-brand-pink/40 to-brand-purple/50 mix-blend-overlay"></div>
                  {/* Optional Text on Image */}
                 {/* <div className="absolute bottom-4 left-4 text-white z-10">
                    <h3 className="text-xl font-bold font-orbitron">Mission: AI Prompt Mastery</h3>
                    <p className="text-sm font-mono">Unlock advanced AI interaction skills.</p>
                  </div> */}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 3. "Activity/Vibe Output" Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
        >
          <Card className="bg-brand-pink/80 backdrop-blur-sm border border-brand-pink/50 shadow-lg text-black">
            <CardHeader className="pb-2 pt-4 px-4 md:px-6">
              <CardTitle className="text-xl font-orbitron text-black/90 font-bold">VIBE OUTPUT</CardTitle>
              {/* Main Metrics */}
              <div className="flex items-baseline justify-between gap-2 mt-2">
                  <div className="text-center">
                      <p className="text-4xl md:text-5xl font-bold text-white drop-shadow-md">{totalKiloVibes.toLocaleString()}</p>
                      <p className="text-xs font-mono uppercase tracking-wider text-black/80">KiloVibes</p>
                  </div>
                  <div className="text-right">
                      <p className="text-lg md:text-xl font-semibold text-white/90">{focusTimeMinutes} <span className="text-xs font-mono">min</span></p>
                      <p className="text-lg md:text-xl font-semibold text-white/90">{skillsLeveled} <span className="text-xs font-mono">Skills</span></p>
                  </div>
              </div>
            </CardHeader>
            <CardContent className="p-2 md:p-4">
              {/* Weekly Chart */}
              <div className="h-[100px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyActivityData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'rgba(0,0,0,0.7)' }} />
                    <YAxis hide={true} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {weeklyActivityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} opacity={0.8}/>
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 4. Prominent CTA / Bottom Nav Equivalent */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="text-center mt-8"
        >
           <Button
              size="lg"
              className="bg-gradient-to-r from-brand-green to-brand-cyan text-black hover:from-brand-cyan hover:to-brand-green font-orbitron text-xl px-12 py-6 rounded-full shadow-cyber-shadow border-2 border-transparent hover:border-white/50 transition-all duration-300 transform hover:scale-105"
              asChild
            >
              <Link href="/selfdev/gamified">
                <FaBolt className="mr-3 animate-pulse" /> Start Level Up
              </Link>
            </Button>
        </motion.div>

        {/* 5. TopNavButtons (can be placed here or rely on Header) */}
         <motion.div
           initial={{ opacity: 0}}
           animate={{ opacity: 1}}
           transition={{ duration: 0.5, delay: 0.5 }}
           className="mt-12 md:mt-16" // Add margin top
         >
          <TopNavButtons />
         </motion.div>

      </div>

      {/* Admin Icon - Keep as is, fits the theme */}
      {dbUser?.status === "admin" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 1.0 }}
          className="fixed bottom-5 right-5 z-50"
        >
          <Link href="/admin" legacyBehavior>
            <Button
              variant="ghost"
              className="bg-brand-purple/90 text-light-text hover:bg-brand-pink/90 rounded-full w-12 h-12 flex items-center justify-center shadow-cyber-shadow border-2 border-brand-cyan/60 hover:border-brand-pink transition-all"
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