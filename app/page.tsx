"use client";

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button" // Explicit import
import { debugLogger } from "@/lib/debugLogger"
import { useAppContext } from "@/contexts/AppContext"
import { motion } from "framer-motion"
// Updated icons for "CyberFitness for Brain" theme
import { 
  FaBrain,         // Core "Brain" icon
  FaGamepad,       // Gamification
  FaBolt,          // Speed, Efficiency, Level Up
  FaRocket,        // Acceleration, Jumpstart
  FaCode,          // Skill: Coding, System Interaction
  FaPalette,       // Skill: Design, Creativity (Can be used for AI Art prompts too)
  FaMicrophone,    // Skill: Communication, Voice Input
  FaUserNinja,     // Admin icon or metaphor for mastery
  FaWandMagicSparkles // AI Magic, effortless creation
} from "react-icons/fa6" 
import TopNavButtons from "@/components/TopNavButtons" 

export default function Home() {
  const { dbUser, isAuthenticated, isLoading, error, isInTelegramContext } = useAppContext()

  useEffect(() => {
    debugLogger.log("Home component mounted (CyberVice Theme)", { isLoading, isInTelegramContext, dbUser, error })
  }, [isLoading, isInTelegramContext, dbUser, error])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-bg to-dark-card flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-16 h-16 border-4 border-t-brand-pink border-brand-pink/30 rounded-full shadow-cyber-shadow"
        />
        <p className="ml-4 text-brand-pink font-orbitron animate-pulse">LOADING CYBERVICE OS...</p>
      </div>
    )
  }

  if (error) {
    debugLogger.error("Error in Home component (CyberVice Theme):", error)
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-screen bg-gradient-to-br from-dark-bg to-red-900/50 text-red-400 font-orbitron flex flex-col items-center justify-center p-4"
      >
        <FaBolt className="text-5xl text-red-500 mb-4 animate-ping"/>
        <p className="text-xl">SYSTEM ERROR: {error.message}</p>
        <p className="text-sm text-gray-500 mt-2">REBOOTING MATRIX INTERFACE RECOMMENDED.</p>
      </motion.div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-black to-dark-card text-light-text relative overflow-hidden">
      {/* Enhanced Glare/Grid Effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-1/2 h-1/2 bg-brand-purple/20 rounded-full blur-[100px] opacity-30 animate-pulse pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-1/2 h-1/2 bg-brand-pink/20 rounded-full blur-[100px] opacity-30 animate-pulse pointer-events-none delay-1000" />
        <div className="absolute inset-0 bg-grid-pattern-pink opacity-[0.02] animate-[drift_20s_linear_infinite]"></div>
      </div>
      
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        className="pt-24 pb-12 relative flex flex-col items-center justify-center"
      >
        <div className="relative container mx-auto px-4 text-center z-10">
          <motion.div // CyberFitness Icon
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1, type: "spring", stiffness: 120 }}
            className="mb-6"
          >
            <FaBrain className="inline-block text-7xl sm:text-8xl text-brand-pink animate-neon-flicker drop-shadow-[0_0_20px_theme(colors.brand-pink)]" />
          </motion.div>

          <motion.h1 // Changed from h2 to h1 for semantic correctness on homepage
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2, type: "spring", stiffness: 110 }}
            className="text-5xl sm:text-6xl md:text-7xl font-bold font-orbitron text-brand-cyan mb-5 cyber-text glitch"
            data-text="CYBERFIT BRAIN"
          >
            CYBERFIT <span className="text-brand-pink glitch" data-text="BRAIN">BRAIN</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="text-brand-yellow text-md sm:text-lg md:text-xl font-mono mb-10 tracking-wider max-w-2xl mx-auto text-shadow-neon"
          >
            Прокачай свой <strong className="text-brand-pink">мозг-процессор</strong>. Открой <strong className="text-brand-green">новые скиллы</strong>. Достигай <strong className="text-brand-cyan">целей с AI-ускорением</strong>. Это твой <strong className="text-brand-purple">CyberVibe Level Up</strong>.
          </motion.p>
          
          <TopNavButtons />
        </div>
      </motion.main>

      {/* Features Section - Themed for CyberFitness */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.6 }}
        className="container mx-auto px-4 py-10 md:py-16"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {[
            {
              title: "AI-Ускоренные Задачи",
              icon: <FaWandMagicSparkles className="h-8 w-8 text-brand-pink" />,
              description: "Осваивай новые навыки, от написания промптов до кодинга, с AI-ассистентом.",
              link: "/selfdev/gamified", // Link to the new page
            },
            {
              title: "Система Уровней (Level Up)",
              icon: <FaBolt className="h-8 w-8 text-brand-yellow" />,
              description: "Проходи 'квесты', открывай 'перки' и наблюдай за ростом своего 'Bandwidth'.",
              link: "/selfdev/gamified#levelup_fitness",
            },
            {
              title: "Геймификация Жизни",
              icon: <FaGamepad className="h-8 w-8 text-brand-cyan" />,
              description: "Преврати рутину в увлекательную игру с четкими целями и измеримым прогрессом.",
              link: "/selfdev/gamified#gamify",
            },
          ].map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 + index * 0.2 }}
              whileHover={{ 
                scale: 1.04, 
                boxShadow: "0 0 20px theme(colors.brand-purple / 40%), 0 0 10px theme(colors.brand-pink / 30%)" 
              }}
              className="bg-dark-card/80 border border-brand-purple/40 rounded-xl p-6 transition-all duration-300 ease-out cursor-pointer"
              onClick={() => feature.link && (window.location.href = feature.link)} // Simple navigation for now
            >
              <Link href={feature.link || "#"} className="block">
                <div className="mb-4 text-3xl">{feature.icon}</div>
                <h3 className="text-brand-green font-orbitron text-xl mb-2">{feature.title}</h3>
                <p className="text-gray-300 font-mono text-sm leading-relaxed">{feature.description}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* CTA to Gamified Page */}
      <motion.section 
        className="py-12 md:py-20 text-center"
        initial={{ opacity:0 }}
        animate={{ opacity:1 }}
        transition={{ delay: 1.2, duration: 0.8}}
      >
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-orbitron text-brand-yellow mb-6 cyber-text" data-text="Готов к Апгрейду?">
            Готов к Апгрейду?
          </h2>
          <p className="text-gray-300 font-mono md:text-lg mb-8 max-w-xl mx-auto">
            Перестань быть зрителем в своей жизни. Стань <strong className="text-brand-pink">активным игроком</strong>. <strong className="text-brand-cyan">CyberDev OS</strong> ждет твоей активации.
          </p>
          <motion.div whileHover={{ scale: 1.08 }} transition={{ type: "spring", stiffness: 250 }}>
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-brand-pink to-brand-purple text-white hover:from-brand-purple hover:to-brand-pink font-orbitron text-lg px-10 py-4 rounded-lg shadow-cyber-shadow border-2 border-transparent hover:border-brand-cyan transition-all duration-300"
              asChild
            >
              <Link href="/selfdev/gamified">Запустить CyberDev OS</Link>
            </Button>
          </motion.div>
        </div>
      </motion.section>

      {/* Admin Icon - Themed */}
      {dbUser?.status === "admin" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.5 }}
          className="fixed bottom-5 right-5 z-50"
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/admin" legacyBehavior>
                  <Button
                    variant="ghost"
                    className="bg-brand-purple/80 text-light-text hover:bg-brand-pink/90 rounded-full w-12 h-12 flex items-center justify-center shadow-cyber-shadow border-2 border-brand-cyan/50 hover:border-brand-pink transition-all"
                    aria-label="Admin Panel"
                  >
                    <FaUserNinja className="h-6 w-6" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="left" className="bg-dark-card border-brand-purple text-light-text">
                <p>Admin Control Deck</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </motion.div>
      )}
    </div>
  )
}