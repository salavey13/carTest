"use client"
import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { debugLogger } from "@/lib/debugLogger"
import { useAppContext } from "@/contexts/AppContext"
import { motion } from "framer-motion"
import { Car, CreditCard, MapPin, Zap } from "lucide-react"

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
          className="w-12 h-12 border-4 border-t-[#00ff9d] border-[#00ff9d]/20 rounded-full shadow-[0_0_10px_rgba(0,255,157,0.5)]"
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-950 text-[#00ff9d] relative overflow-hidden">
      {/* Glare Effect */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-[#00ff9d]/10 rounded-full blur-3xl opacity-20 pointer-events-none" />

      {/* Main Hero Section */}
      <motion.main
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="pt-24 relative min-h-[60vh] flex items-center justify-center"
      >
        <div className="relative container mx-auto px-4 text-center z-10">
          <motion.h2
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, type: "spring", stiffness: 100 }}
            className="text-5xl sm:text-6xl md:text-8xl font-bold font-['Orbitron'] text-[#00ff9d] mb-8 drop-shadow-[0_0_15px_rgba(0,255,157,0.5)]"
          >
            ChinaCarRent
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-[#ff00ff] text-md sm:text-xl md:text-2xl font-mono mb-10 tracking-wide"
          >
            Аренда китайских кибер-каров в России. Скорость. Надежность. Будущее.
          </motion.p>
          <div className="flex flex-wrap justify-center gap-4 md:gap-6">
            <motion.div whileHover={{ scale: 1.05, rotate: 2 }} transition={{ type: "spring", stiffness: 300 }}>
              <Button className="bg-[#00ff9d]/90 text-black hover:bg-[#00ff9d]/70 font-mono text-lg px-8 py-6 rounded-lg shadow-[0_0_10px_rgba(0,255,157,0.5)]">
                <Link href="/rent-car">Арендовать</Link>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05, rotate: -2 }} transition={{ type: "spring", stiffness: 300 }}>
              <Button className="bg-[#ff00ff]/90 text-black hover:bg-[#ff00ff]/70 font-mono text-lg px-8 py-6 rounded-lg shadow-[0_0_10px_rgba(255,0,255,0.5)]">
                <Link href="/buy-subscription">Абонемент</Link>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05, rotate: 2 }} transition={{ type: "spring", stiffness: 300 }}>
              <Button className="bg-[#FFD93D]/90 text-black hover:bg-[#FFD93D]/70 font-mono text-lg px-8 py-6 rounded-lg shadow-[0_0_10px_rgba(255,217,61,0.5)]">
                <Link href="/supercar-test">Тест</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.main>

      {/* Features Section {
              title: "Отслеживание",
              icon: <MapPin className="h-10 w-10 text-[#FFD93D]" />,
              description: "Мониторинг в реальном времени",
            },*/}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="container mx-auto px-4 py-16"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: "Удобная оплата",
              icon: <CreditCard className="h-10 w-10 text-[#00ff9d]" />,
              description: "Карта, наличные или Telegram invoice",
            },
            {
              title: "Доставка",
              icon: <Car className="h-10 w-10 text-[#ff00ff]" />,
              description: "Кибер-кар прямо к вашему порогу",
            },
            
          ].map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 + index * 0.2 }}
              whileHover={{ scale: 1.03, boxShadow: "0 0 15px rgba(0,255,157,0.3)" }}
              className="bg-gray-800/70 border border-[#00ff9d]/20 rounded-lg p-6 transition-all"
            >
              <div className="mb-4">{feature.icon}</div>
              <h3 className="text-[#00ff9d] font-mono text-xl mb-2">{feature.title}</h3>
              <p className="text-gray-300 font-mono text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Admin Icon */}
      {dbUser?.status === "admin" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 1 }}
          className="fixed bottom-4 right-4 z-50"
        >
          <Link href="/admin">
            <Button
              variant="ghost"
              className="bg-[#ff00ff]/90 text-black hover:bg-[#ff00ff]/70 rounded-full w-12 h-12 flex items-center justify-center shadow-[0_0_10px_rgba(255,0,255,0.5)]"
            >
              <Zap className="h-6 w-6" />
            </Button>
          </Link>
        </motion.div>
      )}
    </div>
  )
}