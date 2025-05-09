// /app/page.tsx
"use client";

"use client"
import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { debugLogger } from "@/lib/debugLogger"
import { useAppContext } from "@/contexts/AppContext"
import { motion } from "framer-motion"
import { FaAppleAlt, FaChartLine, FaDumbbell, FaRunning, FaUsers } from "react-icons/fa" 
import { FaHeartPulse } from "react-icons/fa6"
import TopNavButtons from "@/components/TopNavButtons" // Import the new component

export default function Home() {
  const { dbUser, isAuthenticated, isLoading, error, isInTelegramContext } = useAppContext()

  useEffect(() => {
    debugLogger.log("Home component mounted", { isLoading, isInTelegramContext, dbUser, error })
  }, [isLoading, isInTelegramContext, dbUser, error])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-950 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-t-brand-green border-brand-green/20 rounded-full shadow-[0_0_10px_rgba(0,255,157,0.5)]"
        />
      </div>
    )
  }

  if (error) {
    debugLogger.error("Error in Home component:", error)
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-950 text-red-400 font-mono flex items-center justify-center"
      >
        Ошибка: {error.message}
      </motion.div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-950 text-brand-green relative overflow-hidden">
      {/* Glare Effect */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-brand-green/10 rounded-full blur-3xl opacity-20 pointer-events-none" />

      {/* Main Hero Section */}
      <motion.main
        initial={{ opacity: 0, y: 20 }} // Adjusted initial y for a smoother entry
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="pt-24 relative flex flex-col items-center justify-center" // min-h-[60vh] removed to allow content to define height
      >
        <div className="relative container mx-auto px-4 text-center z-10">
          <motion.h2
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, type: "spring", stiffness: 100 }}
            className="text-5xl sm:text-6xl md:text-7xl font-bold font-['Orbitron'] text-brand-green mb-4 drop-shadow-[0_0_15px_rgba(0,255,157,0.5)]" // Reduced md size slightly
          >
            Fit10min <span className="text-brand-pink">PREMIUM</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }} // Adjusted initial y
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }} // Adjusted delay
            className="text-brand-blue text-md sm:text-lg md:text-xl font-mono mb-8 tracking-wide" // Reduced font sizes
          >
            10 минут в день для твоей лучшей формы. Тренировки, питание, мотивация.
          </motion.p>
          
          {/* Top Navigation Buttons */}
          <TopNavButtons />

          {/* Original CTA buttons - can be kept or removed based on preference */}
          {/* 
          <div className="flex flex-wrap justify-center gap-3 md:gap-4 mt-6">
            <motion.div whileHover={{ scale: 1.05, rotate: 1 }} transition={{ type: "spring", stiffness: 300 }}>
              <Button size="lg" className="bg-brand-green/90 text-black hover:bg-brand-green/70 font-mono text-base px-6 py-3 rounded-lg shadow-[0_0_8px_rgba(0,255,157,0.4)]">
                <Link href="/start-training">Начать тренировку</Link>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05, rotate: -1 }} transition={{ type: "spring", stiffness: 300 }}>
              <Button size="lg" className="bg-brand-pink/90 text-black hover:bg-brand-pink/70 font-mono text-base px-6 py-3 rounded-lg shadow-[0_0_8px_rgba(255,0,122,0.4)]">
                <Link href="/nutrition">Питание</Link>
              </Button>
            </motion.div>
          </div>
          */}
        </div>
      </motion.main>

      {/* Features Section */}
      <motion.div
        initial={{ opacity: 0, y: 30 }} // Adjusted initial y
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5 }} // Adjusted delay
        className="container mx-auto px-4 py-12" // Reduced py
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6"> {/* Reduced gap */}
          {[
            {
              title: "Быстрые тренировки",
              icon: <FaRunning className="h-8 w-8 text-brand-green" />, // Reduced icon size
              description: "Эффективные 10-минутные комплексы на каждый день.",
            },
            {
              title: "Планы питания",
              icon: <FaAppleAlt className="h-8 w-8 text-brand-pink" />, // Reduced icon size
              description: "Индивидуальные рекомендации для достижения твоих целей.",
            },
            {
              title: "Отслеживание прогресса",
              icon: <FaChartLine className="h-8 w-8 text-brand-blue" />, // Reduced icon size
              description: "Визуализируй свои достижения и оставайся мотивированным.",
            },
          ].map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 15 }} // Adjusted initial y
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 + index * 0.15 }} // Adjusted delay
              whileHover={{ scale: 1.03, boxShadow: "0 0 12px rgba(0,255,157,0.25)" }} // Adjusted shadow
              className="bg-gray-800/70 border border-brand-green/20 rounded-lg p-5 transition-all" // Reduced padding
            >
              <div className="mb-3">{feature.icon}</div> {/* Reduced margin */}
              <h3 className="text-brand-green font-mono text-lg mb-1.5">{feature.title}</h3> {/* Reduced font size and margin */}
              <p className="text-gray-300 font-mono text-xs">{feature.description}</p> {/* Reduced font size */}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Admin Icon */}
      {dbUser?.status === "admin" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }} // Adjusted delay
          className="fixed bottom-4 right-4 z-50"
        >
          <Link href="/admin" legacyBehavior>
            <Button
              variant="ghost"
              className="bg-brand-purple/90 text-black hover:bg-brand-purple/70 rounded-full w-10 h-10 flex items-center justify-center shadow-[0_0_8px_rgba(157,0,255,0.4)]" // Reduced size and shadow
            >
              <FaDumbbell className="h-5 w-5" /> {/* Reduced icon size */}
            </Button>
          </Link>
        </motion.div>
      )}
    </div>
  )
}