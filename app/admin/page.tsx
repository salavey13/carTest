"use client"
import { useEffect } from "react"
import { useTelegram } from "@/hooks/useTelegram"
import { useRouter } from "next/navigation"
import { CarSubmissionForm } from "@/components/CarSubmissionForm"
import Link from "next/link"
import { motion } from "framer-motion"
import { Terminal, Zap } from "lucide-react"

export default function AdminPage() {
  const { dbUser, isAdmin } = useTelegram()
  const router = useRouter()
  const [toastMessages, setToastMessages] = useState<{ id: number; message: string; type: "success" | "error" }[]>([])
  const toastIdRef = useRef(0)

  const showToast = (message: string, type: "success" | "error") => {
    const id = toastIdRef.current++
    setToastMessages((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToastMessages((prev) => prev.filter((toast) => toast.id !== id))
    }, 3000)
  }

  useEffect(() => {
    if (dbUser && !isAdmin()) {
      showToast("Доступ запрещен: требуется статус администратора", "error")
      router.push("/")
    } else if (dbUser) {
      showToast("Добро пожаловать в панель администратора", "success")
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
          <Terminal className="h-8 w-8" /> КОНСОЛЬ АДМИНИСТРАТОРА
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-800/70 border border-[#00ff9d]/20 rounded-xl p-6 shadow-[0_0_10px_rgba(0,255,157,0.3)]"
        >
          <CarSubmissionForm />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 space-y-4 text-center"
        >
          <Link href="/shadow-fleet-admin" className="inline-block text-[#ff00ff] hover:text-[#ff00ff]/70 font-mono text-lg transition-colors">
            Портал Теневого Флота →
          </Link>
          <Link href="/" className="block text-[#00ff9d] hover:text-[#00ff9d]/70 font-mono text-lg transition-colors">
            ← Назад в Матрицу
          </Link>
        </motion.div>

        {/* Local Toaster */}
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
          <AnimatePresence>
            {toastMessages.map(({ id, message, type }) => (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-[0_0_10px_rgba(0,0,0,0.5)] font-mono text-sm ${
                  type === "success"
                    ? "bg-green-900/80 text-[#00ff9d] border-[#00ff9d]/40"
                    : "bg-red-900/80 text-red-400 border-red-400/40"
                }`}
              >
                {type === "success" ? "✓" : "✗"} {message}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
