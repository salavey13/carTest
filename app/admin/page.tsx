"use client"
import { useEffect } from "react"
import { useTelegram } from "@/hooks/useTelegram"
import { useRouter } from "next/navigation"
import { CarSubmissionForm } from "@/components/CarSubmissionForm"
import Link from "next/link"
import { motion } from "framer-motion"
import { Zap, Car } from "lucide-react"
import { toast } from "sonner"

export default function AdminPage() {
  const { dbUser, isAdmin } = useTelegram()
  const router = useRouter()

  useEffect(() => {
    if (dbUser && !isAdmin()) {
      toast.error("У вас нет прав доступа. Возвращаемся на главную...")
      router.push("/")
    } else if (dbUser) {
      toast.success("Добро пожаловать в Центр Управления!")
    }
  }, [dbUser, isAdmin, router])

  if (!dbUser || !isAdmin()) {
    return <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-950" />
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-950 text-[#00ff9d] relative overflow-hidden"
    >
      {/* Cyber Grid Background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none select-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEwIDB2MjBNMCAxMGgyME0xMCAyMFYwTTAgMTBoMjAiIHN0cm9rZT0iIzAwZmY5ZCIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9zdmc+')] bg-repeat" />

      <div className="pt-20 relative container mx-auto px-4">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl sm:text-3xl md:text-5xl font-bold text-center font-['Orbitron'] text-[#00ff9d] mb-8 drop-shadow-[0_0_15px_rgba(0,255,157,0.5)] flex items-center justify-center gap-2"
        >
          <Car className="h-8 w-8 animate-pulse" /> ЦЕНТР УПРАВЛЕНИЯ
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-800/70 border border-[#00ff9d]/20 rounded-xl p-6 shadow-[0_0_10px_rgba(0,255,157,0.3)]"
        >
          <p className="text-[#ff00ff] font-mono text-center mb-4">
            Добавляйте новые машины в наш флот!
          </p>
          <CarSubmissionForm />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 space-y-4 text-center"
        >
          <Link
            href="/shadow-fleet-admin"
            className="inline-block text-[#ff00ff] hover:text-[#ff00ff]/70 font-mono text-lg transition-colors"
          >
            Управление Теневым Флотом →
          </Link>
          <Link href="/" className="block text-[#00ff9d] hover:text-[#00ff9d]/70 font-mono text-lg transition-colors">
            ← Вернуться на главную
          </Link>
        </motion.div>

        {/* Admin Power Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="fixed bottom-4 right-4 z-50"
        >
          <Button
            onClick={() => toast.success("Система активна, вы в деле!")}
            className="bg-[#ff00ff]/90 text-black hover:bg-[#ff00ff]/70 rounded-full w-12 h-12 flex items-center justify-center shadow-[0_0_10px_rgba(255,0,255,0.5)] transition-all"
          >
            <Zap className="h-6 w-6" />
          </Button>
        </motion.div>
      </div>
    </motion.div>
  )
}
