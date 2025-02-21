"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createInvoice, supabaseAnon, getUserSubscription } from "@/hooks/supabase"
import { sendTelegramInvoice } from "@/app/actions"
import { useTelegram } from "@/hooks/useTelegram"
import { getTelegramUser } from "@/lib/telegram"
import SemanticSearch from "@/components/SemanticSearch"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Crown } from 'lucide-react'

const YUAN_TO_STARS_RATE = 0.1 // 1 Yuan = 0.1 Stars

export default function RentCar() {
  const { user: tgUser, isInTelegramContext } = useTelegram()
  const [selectedCar, setSelectedCar] = useState(null)
  const [rentDays, setRentDays] = useState(1)
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [hasSubscription, setHasSubscription] = useState<boolean>(false)

  // Check subscription status
  useEffect(() => {
    const checkSubscription = async () => {
      if (tgUser) {
        const subscriptionId = await getUserSubscription(tgUser.id.toString())
        setHasSubscription(!!subscriptionId)
      }
    }
    checkSubscription()
  }, [tgUser])

  // Check if we're in Telegram context on mount
  useEffect(() => {
    const webAppUser = getTelegramUser()
    if (!webAppUser && typeof window !== "undefined" && !(window as any).Telegram?.WebApp) {
      setError("Эта функция доступна только через Telegram.")
    }
  }, [])

  useEffect(() => {
    const fetchCars = async () => {
      const { data, error } = await supabaseAnon.from("cars").select("*")
      if (error) {
        console.error("Ошибка при загрузке автомобилей:", error)
        toast.error("Не удалось загрузить список автомобилей")
      } else {
        setCars(data || [])
      }
    }
    fetchCars()
  }, [])

  const getWelcomeMessage = () => {
    if (hasSubscription) {
      return "Добро пожаловать в премиум-сервис аренды автомобилей! Мы ценим ваше доверие."
    }
    return "Добро пожаловать! Попробуйте наш сервис аренды автомобилей. Станьте подписчиком для доступа к премиум-функциям."
  }

  const getSuccessMessage = () => {
    if (hasSubscription) {
      return "🌟 Спасибо за ваш выбор! Ваш премиум-статус позволяет вам пользоваться дополнительными преимуществами. Счет создан, проверьте Telegram."
    }
    return "🎉 Спасибо за интерес к нашему сервису! Счет создан, проверьте Telegram. Станьте подписчиком для доступа к премиум-функциям!"
  }

  const handleRent = async () => {
    if (!selectedCar) return

    const webAppUser = getTelegramUser()
    if (!webAppUser) {
      setError("Вы должны быть авторизованы в Telegram для аренды автомобиля.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const totalPriceYuan = selectedCar.daily_price * rentDays
      const totalPriceStars = Math.round(totalPriceYuan * YUAN_TO_STARS_RATE)

      // Apply subscriber discount if applicable
      const finalPrice = hasSubscription ? Math.round(totalPriceStars * 0.9) : totalPriceStars

      // Create metadata for the invoice
      const metadata = {
        car_id: selectedCar.id,
        car_make: selectedCar.make,
        car_model: selectedCar.model,
        days: rentDays,
        price_yuan: totalPriceYuan,
        price_stars: finalPrice,
        is_subscriber: hasSubscription,
        original_price: totalPriceStars,
        discount_applied: hasSubscription ? "10%" : "0%"
      }

      // Create invoice in Supabase first
      const invoiceId = `car_rental_${selectedCar.id}_${webAppUser.id}_${Date.now()}`
      await createInvoice(invoiceId, webAppUser.id.toString(), finalPrice, metadata)

      // Prepare description with subscription status
      const description = hasSubscription
        ? `Премиум-аренда на ${rentDays} дней\nЦена со скидкой: ${finalPrice} XTR (${totalPriceYuan} ¥)\nПрименена скидка подписчика: 10%`
        : `Аренда на ${rentDays} дней\nЦена: ${finalPrice} XTR (${totalPriceYuan} ¥)`

      // Send Telegram invoice
      const response = await sendTelegramInvoice(
        webAppUser.id.toString(),
        `Аренда ${selectedCar.make} ${selectedCar.model}`,
        description,
        invoiceId,
        finalPrice,
      )

      if (!response.success) {
        throw new Error(response.error || "Не удалось создать счет")
      }

      setSuccess(true)
      toast.success(getSuccessMessage())
    } catch (err) {
      console.error("Ошибка при создании счета:", err)
      setError("Произошла ошибка при создании счета.")
      toast.error("Не удалось создать счет. Попробуйте позже.")
    } finally {
      setLoading(false)
    }
  }

  // Early return if not in Telegram context
  if (!isInTelegramContext && !getTelegramUser()) {
    return (
      <div className="min-h-screen bg-gray-100 text-gray-900 pt-20">
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-center text-red-600">Доступ ограничен</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center">
                Эта функция доступна только через Telegram. Пожалуйста, откройте приложение через Telegram.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 pt-20">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <h1 className="text-4xl font-bold text-center font-sans text-blue-900">Аренда китайских автомобилей</h1>
          {hasSubscription && (
            <Badge variant="premium" className="ml-2">
              <Crown className="w-4 h-4 mr-1" />
              Premium
            </Badge>
          )}
        </div>

        <p className="text-center text-gray-600 mb-8">{getWelcomeMessage()}</p>

        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        {success && (
          <p className="text-green-500 text-center mb-4">{getSuccessMessage()}</p>
        )}

        <div className="mb-8">
          <SemanticSearch />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="bg-white border-gray-300">
            <CardHeader>
              <CardTitle className="text-blue-900 font-sans">
                {hasSubscription ? "Премиум выбор автомобиля" : "Выберите автомобиль"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select onValueChange={(value) => setSelectedCar(cars.find((car) => car.id === value))}>
                <SelectTrigger className="bg-gray-50 border-gray-300 text-gray-900 font-sans">
                  <SelectValue placeholder="Выберите модель" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  {cars.map((car) => (
                    <SelectItem key={car.id} value={car.id} className="text-gray-900 font-sans">
                      {car.make} {car.model} - {car.daily_price} ¥/день (
                      {Math.round(car.daily_price * YUAN_TO_STARS_RATE)} XTR)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="mt-4">
                <label className="text-sm font-sans text-gray-700">Количество дней</label>
                <Input
                  type="number"
                  min="1"
                  value={rentDays}
                  onChange={(e) => setRentDays(Number.parseInt(e.target.value) || 1)}
                  className="bg-gray-50 border-gray-300 text-gray-900 font-sans mt-1"
                />
              </div>
              <Button
                onClick={handleRent}
                disabled={!selectedCar || loading}
                className={`w-full mt-4 ${
                  hasSubscription 
                    ? "bg-gradient-to-r from-purple-600 to-blue-600" 
                    : "bg-blue-600"
                } text-white hover:opacity-90 font-sans`}
              >
                {loading ? "Обработка..." : hasSubscription ? "Арендовать со скидкой" : "Арендовать"}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-300">
            <CardHeader>
              <CardTitle className="text-blue-900 font-sans">
                {hasSubscription ? "Премиум информация" : "Информация об автомобиле"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedCar ? (
                <>
                  <Image
                    src={selectedCar.image_url || "/placeholder.svg"}
                    alt={`${selectedCar.make} ${selectedCar.model}`}
                    width={200}
                    height={200}
                    className="mx-auto mb-4 rounded"
                  />
                  <p className="text-gray-700 font-sans">
                    {selectedCar.make} {selectedCar.model}
                  </p>
                  <p className="text-gray-700 font-sans">
                    {selectedCar.daily_price} ¥/день ({Math.round(selectedCar.daily_price * YUAN_TO_STARS_RATE)} XTR)
                  </p>
                  <p className="text-gray-700 font-sans mt-4">
                    Итого: {selectedCar.daily_price * rentDays} ¥ (
                    {hasSubscription 
                      ? <span className="text-purple-600 font-semibold">
                          {Math.round(selectedCar.daily_price * rentDays * YUAN_TO_STARS_RATE * 0.9)} XTR (скидка 10%)
                        </span>
                      : `${Math.round(selectedCar.daily_price * rentDays * YUAN_TO_STARS_RATE)} XTR`
                    })
                  </p>
                  {!hasSubscription && (
                    <p className="text-sm text-gray-500 mt-2">
                      💡 Подписчики получают 10% скидку на все аренды!
                    </p>
                  )}
                </>
              ) : (
                <p className="text-center text-gray-700 font-sans">
                  {hasSubscription 
                    ? "Выберите автомобиль для просмотра премиум информации" 
                    : "Выберите автомобиль для просмотра информации"}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

