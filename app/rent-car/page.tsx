"use client"
import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { createInvoice, supabaseAnon, getUserSubscription } from "@/hooks/supabase"
import { sendTelegramInvoice } from "@/app/actions"
import { useTelegram } from "@/hooks/useTelegram"
import { getTelegramUser } from "@/lib/telegram"
import SemanticSearch from "@/components/SemanticSearch"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight, Crown, AlertTriangle } from "lucide-react"

const YUAN_TO_STARS_RATE = 0.1 // 1 Yuan = 0.1 Stars
const AUTO_INCREMENT_INTERVAL = 3000 // 3 seconds
const REENGAGE_DELAY = 2000 // 2 seconds after interaction

export default function RentCar() {
  const { user: tgUser, isInTelegramContext, dbUser } = useTelegram()
  const [selectedCar, setSelectedCar] = useState(null)
  const [rentDays, setRentDays] = useState(1)
  const [cars, setCars] = useState([])
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [hasSubscription, setHasSubscription] = useState<boolean>(false)
  const [isCarouselEngaged, setIsCarouselEngaged] = useState(false)
  const [toastMessages, setToastMessages] = useState<{ id: number; message: string; type: "success" | "error" }[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const toastIdRef = useRef(0)

  // Local toaster function
  const showToast = (message: string, type: "success" | "error") => {
    const id = toastIdRef.current++
    setToastMessages((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToastMessages((prev) => prev.filter((toast) => toast.id !== id))
    }, 3000) // Toast disappears after 3 seconds
  }

  // Fetch cars
  useEffect(() => {
    const fetchCars = async () => {
      const { data, error } = await supabaseAnon.from("cars").select("*")
      if (error) {
        console.error("Ошибка при загрузке автомобилей:", error)
        showToast("Не удалось загрузить список автомобилей", "error")
      } else {
        setCars(data || [])
        setSelectedCar(null) // No default selection initially
        setLoading(false)
      }
    }
    fetchCars()
  }, [])

  // Check subscription status
  useEffect(() => {
    const checkSubscription = async () => {
      if (dbUser?.user_id) {
        const subscriptionId = await getUserSubscription(dbUser.user_id)
        setHasSubscription(!!subscriptionId)
      }
    }
    checkSubscription()
  }, [dbUser])

  // Telegram context validation with fallback
  useEffect(() => {
    const webAppUser = getTelegramUser()
    if (!webAppUser && typeof window !== "undefined" && !(window as any).Telegram?.WebApp) {
      setError("Эта функция доступна только через Telegram, но вы можете протестировать в демо-режиме.")
    }
  }, [])

  // Auto-increment carousel
  useEffect(() => {
    if (!isCarouselEngaged && cars.length > 0) {
      timerRef.current = setInterval(() => {
        setCarouselIndex((prev) => (prev === cars.length - 1 ? 0 : prev + 1))
      }, AUTO_INCREMENT_INTERVAL)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isCarouselEngaged, cars.length])

  const handleCarouselEngage = () => {
    if (!isCarouselEngaged) {
      setIsCarouselEngaged(true)
      if (timerRef.current) clearInterval(timerRef.current)
      setTimeout(() => {
        if (isCarouselEngaged && cars.length > 0) {
          timerRef.current = setInterval(() => {
            setCarouselIndex((prev) => (prev === cars.length - 1 ? 0 : prev + 1))
          }, AUTO_INCREMENT_INTERVAL)
        }
      }, REENGAGE_DELAY)
    }
    setSelectedCar(cars[carouselIndex])
  }

  const handleCarouselPrev = () => {
    setCarouselIndex((prev) => (prev === 0 ? cars.length - 1 : prev - 1))
    handleCarouselEngage()
  }

  const handleCarouselNext = () => {
    setCarouselIndex((prev) => (prev === cars.length - 1 ? 0 : prev + 1))
    handleCarouselEngage()
  }

  const handleRent = async () => {
    console.log("Rent button clicked", { selectedCar, tgUser, isInTelegramContext }) // Debug log
    if (!selectedCar) {
      setError("Выберите автомобиль для аренды.")
      showToast("Выберите автомобиль для аренды", "error")
      return
    }

    setInvoiceLoading(true)
    setError(null)
    setSuccess(false)

    if (!tgUser || !isInTelegramContext) {
      setError("Для аренды необходимо авторизоваться в Telegram.")
      showToast("Для аренды необходимо авторизоваться в Telegram", "error")
      setInvoiceLoading(false)
      return
    }

    try {
      const totalPriceYuan = selectedCar.daily_price * rentDays
      const totalPriceStars = Math.round(totalPriceYuan * YUAN_TO_STARS_RATE)
      const finalPrice = hasSubscription ? Math.round(totalPriceStars * 0.9) : totalPriceStars

      const metadata = {
        type: "car_rental",
        car_id: selectedCar.id,
        car_make: selectedCar.make,
        car_model: selectedCar.model,
        days: rentDays,
        price_yuan: totalPriceYuan,
        price_stars: finalPrice,
        is_subscriber: hasSubscription,
        original_price: totalPriceStars,
        discount_applied: hasSubscription ? "10%" : "0%",
        image_url: selectedCar.image_url,
      }

      const invoiceId = `car_rental_${selectedCar.id}_${tgUser.id}_${Date.now()}`
      console.log("Creating invoice:", { invoiceId, metadata }) // Debug log
      await createInvoice("car_rental", invoiceId, tgUser.id.toString(), finalPrice, metadata)

      const description = hasSubscription
        ? `Премиум-аренда на ${rentDays} дней\nЦена со скидкой: ${finalPrice} XTR (${totalPriceYuan} ¥)\nСкидка подписчика: 10%`
        : `Аренда на ${rentDays} дней\nЦена: ${finalPrice} XTR (${totalPriceYuan} ¥)`

      console.log("Sending Telegram invoice:", { description, finalPrice }) // Debug log
      const response = await sendTelegramInvoice(
        tgUser.id.toString(),
        `Аренда ${selectedCar.make} ${selectedCar.model}`,
        description,
        invoiceId,
        finalPrice,
        undefined,
        selectedCar.image_url
      )

      console.log("Telegram invoice response:", response) // Debug log
      if (!response.success) throw new Error(response.error || "Не удалось создать счет")
      setSuccess(true)
      showToast(
        hasSubscription
          ? "🌟 Счет создан! Проверьте Telegram для оплаты премиум-аренды."
          : "🎉 Счет создан! Проверьте Telegram для оплаты.",
        "success"
      )
    } catch (err) {
      console.error("Ошибка при создании счета:", err)
      setError("Не удалось создать счет. Попробуйте позже.")
      showToast("Ошибка при создании счета", "error")
    } finally {
      setInvoiceLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-950 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-t-[#00ff9d] border-[#00ff9d]/20 rounded-full"
        />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-950 text-[#00ff9d] pt-20 pb-12"
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="absolute top-0 left-0 w-48 h-48 bg-[#00ff9d]/10 rounded-full blur-3xl opacity-20 pointer-events-none" />

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-5xl font-bold text-center mb-10 font-mono tracking-wide text-[#00ff9d] drop-shadow-[0_0_10px_rgba(0,255,157,0.3)] flex items-center justify-center gap-2"
        >
          АРЕНДА КИБЕР-МАШИН {hasSubscription && <Badge className="bg-purple-600"><Crown className="h-4 w-4" /> Премиум</Badge>}
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 max-w-xl mx-auto"
        >
          <SemanticSearch />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 z-10 relative">
          {/* Carousel Section */}
          <motion.div
            initial={{ x: -50 }}
            animate={{ x: 0 }}
            transition={{ type: "spring", stiffness: 100 }}
            className="bg-gray-800/70 border border-[#00ff9d]/20 rounded-xl p-6 shadow-lg"
          >
            <h2 className="text-xl md:text-2xl font-mono mb-6 text-[#00ff9d]/90">ВЫБОР МАШИНЫ</h2>
            <div className="relative cursor-pointer" onClick={handleCarouselEngage}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={carouselIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center justify-center"
                >
                  {cars[carouselIndex] && (
                    <div className="text-center">
                      <Image
                        src={cars[carouselIndex].image_url || "/placeholder.svg"}
                        alt={`${cars[carouselIndex].make} ${cars[carouselIndex].model}`}
                        width={200}
                        height={150}
                        className="mx-auto rounded-lg border border-[#00ff9d]/20 shadow-md"
                      />
                      <p className="mt-4 font-mono text-lg">
                        {cars[carouselIndex].make} {cars[carouselIndex].model}
                      </p>
                      <p className="font-mono text-sm text-[#00ff9d]/80">
                        {cars[carouselIndex].daily_price}¥/день
                      </p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
              <Button
                size="icon"
                variant="ghost"
                className="absolute left-2 top-1/2 -translate-y-1/2 text-[#00ff9d]/60 hover:text-[#00ff9d] hover:bg-gray-700/50"
                onClick={(e) => { e.stopPropagation(); handleCarouselPrev(); }}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#00ff9d]/60 hover:text-[#00ff9d] hover:bg-gray-700/50"
                onClick={(e) => { e.stopPropagation(); handleCarouselNext(); }}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>
            <div className="mt-6">
              <label className="text-sm font-mono text-[#00ff9d]/80">КОЛИЧЕСТВО ДНЕЙ</label>
              <Input
                type="number"
                min="1"
                value={rentDays}
                onChange={(e) => setRentDays(Math.max(1, Number(e.target.value)))}
                className="w-full bg-gray-900/80 border-[#00ff9d]/30 text-[#00ff9d] font-mono p-3 rounded-lg mt-2 focus:ring-[#00ff9d]/60"
              />
            </div>
          </motion.div>

          {/* Car Info & Rent Button */}
          <motion.div
            initial={{ x: 50 }}
            animate={{ x: 0 }}
            transition={{ type: "spring", stiffness: 100, delay: 0.1 }}
            className="bg-gray-800/70 border border-[#00ff9d]/20 rounded-xl p-6 shadow-lg"
          >
            <h2 className="text-xl md:text-2xl font-mono mb-6 text-[#00ff9d]/90">ИНФО О МАШИНЕ</h2>
            <AnimatePresence mode="wait">
              {isCarouselEngaged && selectedCar ? (
                <motion.div
                  key={selectedCar.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <motion.div
                    className="relative h-48 md:h-64 w-full rounded-xl overflow-hidden border border-[#00ff9d]/20 shadow-md"
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <Image
                      src={selectedCar.image_url || "/placeholder.svg"}
                      alt={`${selectedCar.make} ${selectedCar.model}`}
                      fill
                      className="object-cover"
                    />
                  </motion.div>

                  <div className="text-center space-y-3">
                    <p className="font-mono text-xl md:text-2xl">
                      {selectedCar.make} {selectedCar.model}
                    </p>
                    <p className="font-mono text-lg md:text-xl text-[#00ff9d]/80">
                      {selectedCar.daily_price}¥/день
                    </p>
                    <p className="font-mono text-xl md:text-2xl mt-4">
                      ИТОГО: {selectedCar.daily_price * rentDays}¥ (
                      {hasSubscription ? (
                        <span className="text-purple-400">
                          {Math.round(selectedCar.daily_price * rentDays * YUAN_TO_STARS_RATE * 0.9)} XTR (10% скидка)
                        </span>
                      ) : (
                        `${Math.round(selectedCar.daily_price * rentDays * YUAN_TO_STARS_RATE)} XTR`
                      )})
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Button
                      onClick={handleRent}
                      disabled={invoiceLoading}
                      className={`w-full ${
                        hasSubscription
                          ? "bg-gradient-to-r from-purple-600 to-[#ff00ff]"
                          : "bg-[#ff00ff]/90"
                      } text-black hover:opacity-80 font-mono py-3 rounded-lg transition-all shadow-[0_0_10px_rgba(255,0,255,0.3)] hover:shadow-[0_0_15px_rgba(255,0,255,0.5)]`}
                    >
                      {invoiceLoading ? "Обработка..." : hasSubscription ? "АРЕНДОВАТЬ СО СКИДКОЙ" : "АРЕНДОВАТЬ"}
                    </Button>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-400 text-sm font-mono flex items-center justify-center gap-1 bg-red-900/10 px-2 py-1 rounded-md"
                      >
                        <AlertTriangle className="h-4 w-4" /> {error}
                      </motion.p>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  className="text-center font-mono text-[#00ff9d]/50"
                >
                  КЛИКНИТЕ НА КАРУСЕЛЬ ДЛЯ ВЫБОРА
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

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

        {success && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[#00ff9d] text-center mt-6 bg-green-900/10 px-4 py-2 rounded-lg shadow-md"
          >
            {hasSubscription
              ? "🌟 Счет создан! Проверьте Telegram для оплаты премиум-аренды."
              : "🎉 Счет создан! Проверьте Telegram для оплаты."}
          </motion.p>
        )}
      </div>
    </motion.div>
  )
}
