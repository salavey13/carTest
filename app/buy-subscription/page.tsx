"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useTelegram } from "@/hooks/useTelegram"
import { sendTelegramInvoice } from "@/app/actions"
import { createInvoice, getUserSubscription } from "@/hooks/supabase"

const SUBSCRIPTIONS = [
  { id: 1, name: "Базовый", price: 13, features: ["Доступ к стандартным автомобилям", "Базовая поддержка"] },
  {
    id: 2,
    name: "Продвинутый",
    price: 69,
    features: ["Доступ к премиум-автомобилям", "Приоритетная поддержка", "Бесплатные апгрейды"],
  },
  {
    id: 3,
    name: "VIP",
    price: 420,
    features: ["Доступ ко всем автомобилям", "Круглосуточная поддержка", "Персональный менеджер"],
  },
]

export default function BuySubscription() {
  const { user, isInTelegramContext } = useTelegram()
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSubscription, setHasSubscription] = useState<boolean>(false)

  // Check subscription status
  useEffect(() => {
    const checkSubscription = async () => {
      if (user) {
        const subscriptionId = await getUserSubscription(user.id.toString())
        setHasSubscription(!!subscriptionId)
      }
    }
    checkSubscription()
  }, [user])

  const getWelcomeMessage = () => {
    if (hasSubscription) {
      return "Добро пожаловать в премиум-сервис аренды автомобилей! Мы ценим ваше доверие, спасибо за подписку, вы уже PRO;)"
    }
    return "Добро пожаловать! Попробуйте наш сервис аренды автомобилей. Станьте подписчиком для доступа к премиум-функциям."
  }

  const handlePurchase = async () => {
    if (!user) {
      setError("Вы должны быть авторизованы в Telegram для покупки абонемента.")
      return
    }

    if (hasSubscription) {
      setError("У вас уже есть активная подписка.")
      return
    }

    if (!selectedSubscription) {
      setError("Пожалуйста, выберите абонемент.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      

      // Create metadata for the invoice
      const metadata = {
        type: "subscription",
        subscription_id: selectedSubscription.id,
        subscription_name: selectedSubscription.name,
        subscription_price_stars: selectedSubscription.price
      }

      const payload = `subscription_${user.id}_${Date.now()}`
      // Create invoice in Supabase first
      await createInvoice("subscription", payload, user.id.toString(), selectedSubscription.price, metadata)

      const response = await sendTelegramInvoice(
        user.id.toString(),
        `${selectedSubscription.name} Абонемент`,
        "Разблокируйте премиум-функции с этим абонементом!",
        payload,
        selectedSubscription.price,
      )

      if (!response.success) {
        throw new Error(response.error || "Не удалось отправить счет")
      }

      setSuccess(true)
    } catch (err) {
      console.error("Ошибка при покупке:", err)
      setError("Произошла непредвиденная ошибка. " + err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 pt-20">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 font-sans text-blue-900">Купить абонемент</h1>
        <p className="text-center mb-6">{getWelcomeMessage()}</p>
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        {success && (
          <p className="text-green-500 text-center mb-4">🎉 Счет успешно отправлен! Завершите оплату в Telegram.</p>
        )}
        {!hasSubscription && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {SUBSCRIPTIONS.map((sub) => (
              <Card key={sub.id} className="bg-white border-gray-300">
                <CardHeader>
                  <CardTitle className="text-blue-900 font-sans">{sub.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold mb-4 font-sans">{sub.price} XTR</p>
                  <ul className="list-disc list-inside mb-4">
                    {sub.features.map((feature, index) => (
                      <li key={index} className="font-sans text-gray-700">
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <RadioGroup onValueChange={() => setSelectedSubscription(sub)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value={sub.id.toString()} id={`sub-${sub.id}`} />
                      <Label htmlFor={`sub-${sub.id}`} className="font-sans text-gray-900">
                        Выбрать
                      </Label>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {!hasSubscription && (
          <div className="mt-8 text-center">
            <Button
              onClick={handlePurchase}
              disabled={!selectedSubscription || loading}
              className="bg-blue-600 text-white hover:bg-blue-700 font-sans text-lg px-8 py-4"
            >
              {loading ? "Обработка..." : "Купить абонемент"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

