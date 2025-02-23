"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useTelegram } from "@/hooks/useTelegram"
import { sendTelegramInvoice } from "@/app/actions"
import { createInvoice, getUserSubscription } from "@/hooks/supabase"
import { motion, AnimatePresence } from "framer-motion"

const SUBSCRIPTIONS = [
  {
    id: 1,
    name: "Базовый",
    price: 13,
    features: ["Доступ к стандартным автомобилям", "Базовая поддержка"],
    color: "from-blue-600 to-cyan-400",
  },
  {
    id: 2,
    name: "Продвинутый",
    price: 69,
    features: ["Доступ к премиум-автомобилям", "Приоритетная поддержка", "Бесплатные апгрейды"],
    color: "from-purple-600 to-pink-500",
  },
  {
    id: 3,
    name: "VIP",
    price: 420,
    features: ["Доступ ко всем автомобилям", "Круглосуточная поддержка", "Персональный менеджер"],
    color: "from-amber-500 to-red-600",
  },
]

export default function BuySubscription() {
  const { user, isInTelegramContext } = useTelegram()
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSubscription, setHasSubscription] = useState<boolean>(false)
  const [toastMessages, setToastMessages] = useState<{ id: number; message: string; type: "success" | "error" }[]>([])
  const toastIdRef = useRef(0)

  // Local toaster function
  const showToast = (message: string, type: "success" | "error") => {
    const id = toastIdRef.current++
    setToastMessages((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToastMessages((prev) => prev.filter((toast) => toast.id !== id))
    }, 3000)
  }

  // Check subscription status
  useEffect(() => {
    const checkSubscription = async () => {
      if (user) {
        try {
          const subscriptionId = await getUserSubscription(user.id.toString())
          setHasSubscription(!!subscriptionId)
          showToast(subscriptionId ? "У вас уже есть подписка" : "Подписка не найдена", "success")
        } catch (err) {
          setError("Ошибка проверки подписки: " + (err instanceof Error ? err.message : "Неизвестная ошибка"))
          showToast("Ошибка проверки подписки", "error")
        }
      } else {
        showToast("Пользователь не авторизован", "error")
      }
    }
    checkSubscription()
  }, [user])

  const handlePurchase = async () => {
    if (!user) {
      setError("Вы должны быть авторизованы в Telegram для покупки.")
      showToast("Авторизуйтесь в Telegram", "error")
      return
    }

    if (hasSubscription) {
      setError("У вас уже есть активная подписка.")
      showToast("Подписка уже активна", "error")
      return
    }

    if (!selectedSubscription) {
      setError("Пожалуйста, выберите абонемент.")
      showToast("Выберите абонемент", "error")
      return
    }

    setLoading(true)
    setError(null)

    if (!isInTelegramContext) {
      setSuccess(true)
      setError("Демо-режим: Счет создан успешно!")
      showToast("Демо: Счет создан успешно!", "success")
      setLoading(false)
      return
    }

    try {
      const metadata = {
        type: "subscription",
        subscription_id: selectedSubscription.id,
        subscription_name: selectedSubscription.name,
        subscription_price_stars: selectedSubscription.price,
      }

      const payload = `subscription_${user.id}_${Date.now()}`
      showToast("Создание счета...", "success")
      await createInvoice("subscription", payload, user.id.toString(), selectedSubscription.price, metadata)

      showToast("Отправка счета в Telegram...", "success")
      const response = await sendTelegramInvoice(
        user.id.toString(),
        `${selectedSubscription.name} Абонемент`,
        "Разблокируйте премиум-функции с этим абонементом!",
        payload,
        selectedSubscription.price,
        undefined,
        undefined // No image for subscription
      )

      if (!response.success) {
        throw new Error(response.error || "Не удалось отправить счет")
      }

      setSuccess(true)
      showToast("Счет успешно отправлен в Telegram!", "success")
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Неизвестная ошибка"
      setError("Ошибка при покупке: " + errMsg)
      showToast("Ошибка при покупке: " + errMsg, "error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-950 text-[#00ff9d] pt-20 pb-12 relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-48 h-48 bg-[#00ff9d]/10 rounded-full blur-3xl opacity-20 pointer-events-none" />
      <div className="container mx-auto px-4 py-8">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-bold text-center mb-8 font-['Orbitron'] text-[#00ff9d] drop-shadow-[0_0_10px_rgba(0,255,157,0.5)]"
        >
          КУПИТЬ АБОНЕМЕНТ
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-6 text-[#ff00ff] font-mono text-lg"
        >
          {hasSubscription
            ? "Добро пожаловать в элиту! Ваш премиум статус активен."
            : "Разблокируйте кибер-привилегии с абонементом!"}
        </motion.p>

        {!hasSubscription && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {SUBSCRIPTIONS.map((sub) => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: sub.id * 0.2 }}
                whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(0,255,157,0.4)" }}
              >
                <Card className={`bg-gray-800/70 border-[#00ff9d]/20 rounded-lg p-6 shadow-lg bg-gradient-to-br ${sub.color}`}>
                  <CardHeader>
                    <CardTitle className="text-[#00ff9d] font-mono text-2xl">{sub.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold mb-4 font-mono text-white">{sub.price} XTR</p>
                    <ul className="space-y-2 mb-6">
                      {sub.features.map((feature, index) => (
                        <li key={index} className="font-mono text-sm text-gray-300 flex items-center gap-2">
                          <span className="text-[#00ff9d]">▶</span> {feature}
                        </li>
                      ))}
                    </ul>
                    <RadioGroup onValueChange={() => setSelectedSubscription(sub)}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value={sub.id.toString()} id={`sub-${sub.id}`} className="text-[#00ff9d] border-[#00ff9d]" />
                        <Label htmlFor={`sub-${sub.id}`} className="font-mono text-[#00ff9d] cursor-pointer">
                          Выбрать
                        </Label>
                      </div>
                    </RadioGroup>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {!hasSubscription && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-8 text-center"
          >
            <Button
              onClick={handlePurchase}
              disabled={!selectedSubscription || loading}
              className="bg-[#ff00ff]/90 text-black hover:bg-[#ff00ff]/70 font-mono text-lg px-10 py-4 rounded-lg shadow-[0_0_10px_rgba(255,0,255,0.5)] transition-all"
            >
              {loading ? "Обработка..." : "КУПИТЬ"}
            </Button>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-sm font-mono mt-2 bg-red-900/10 px-4 py-2 rounded-md"
              >
                {error}
              </motion.p>
            )}
          </motion.div>
        )}

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
