"use client"
import { useEffect, useState } from "react"
import { useTelegram } from "@/hooks/useTelegram"
import { useRouter } from "next/navigation"
import { CarSubmissionForm } from "@/components/CarSubmissionForm"
import Link from "next/link"
import { motion } from "framer-motion"
import { Car, Zap } from "lucide-react"
import { toast } from "sonner"

export default function AdminPage() {
  const { dbUser, isAdmin } = useTelegram()
  const router = useRouter()
  const [isAdminChecked, setIsAdminChecked] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (dbUser) {
      const adminStatus = isAdmin()
      setIsAdminChecked(adminStatus)
      setIsLoading(false)

      if (adminStatus) {
        toast.success("Добро пожаловать в Центр Управления, командир!")
      } else {
        toast.error("Доступ запрещен. Перенаправляем на главную...")
        router.push("/")
      }
    }
  }, [dbUser, isAdmin, router])

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

  if (!isAdminChecked) {
    return null // Router will handle redirect
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-950 text-[#00ff9d] relative overflow-hidden"
    >
      {/* Neon Grid Background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none select-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEwIDB2MjBNMCAxMGgyME0xMCAyMFYwTTAgMTBoMjAiIHN0cm9rZT0iIzAwZmY5ZCIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9zdmc+')] bg-repeat" />

      <div className="pt-20 relative container mx-auto px-4">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl sm:text-3xl md:text-5xl font-bold text-center font-['Orbitron'] text-[#00ff9d] mb-8 drop-shadow-[0_0_15px_rgba(0,255,157,0.8)] flex items-center justify-center gap-3"
        >
          <Car className="h-10 w-10 animate-pulse" /> ЦЕНТР УПРАВЛЕНИЯ
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-800/70 border border-[#00ff9d]/30 rounded-xl p-6 shadow-[0_0_15px_rgba(0,255,157,0.4)]"
        >
          <p className="text-[#ff00ff] font-mono text-center mb-6 text-lg">
            Управляй флотом — добавляй новые кибер-машины!
          </p>
          <CarSubmissionForm ownerId={dbUser.id} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 space-y-6 text-center"
        >
          <Link
            href="/shadow-fleet-admin"
            className="inline-block text-[#ff00ff] hover:text-[#ff00ff]/80 font-mono text-lg tracking-wide transition-colors"
          >
            Управление Теневым Флотом →
          </Link>
          <Link
            href="/"
            className="block text-[#00ff9d] hover:text-[#00ff9d]/80 font-mono text-lg tracking-wide transition-colors"
          >
            ← Назад в Матрицу
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="fixed bottom-4 right-4 z-50"
        >
          <button
            onClick={() => toast.success("Система на полной мощности, командир!")}
            className="bg-[#ff00ff]/90 text-black hover:bg-[#ff00ff]/70 rounded-full w-14 h-14 flex items-center justify-center shadow-[0_0_12px_rgba(255,0,255,0.6)] transition-all hover:shadow-[0_0_20px_rgba(255,0,255,0.8)]"
          >
            <Zap className="h-7 w-7" />
          </button>
        </motion.div>
      </div>
    </motion.div>
  )
}
