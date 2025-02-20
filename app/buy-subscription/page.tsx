"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useTelegram } from "@/hooks/useTelegram"
import { sendTelegramInvoice } from "@/app/actions"

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

  const handlePurchase = async () => {
    if (!isInTelegramContext || !user) {
      setError("Вы должны быть авторизованы в Telegram для покупки абонемента.")
      return
    }

    if (!selectedSubscription) {
      setError("Пожалуйста, выберите абонемент.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const payload = `subscription_${user.id}_${Date.now()}`
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
      setError("Произошла непредвиденная ошибка.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 pt-20">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 font-sans text-blue-900">Купить абонемент</h1>
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        {success && (
          <p className="text-green-500 text-center mb-4">🎉 Счет успешно отправлен! Завершите оплату в Telegram.</p>
        )}
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
        <div className="mt-8 text-center">
          <Button
            onClick={handlePurchase}
            disabled={!selectedSubscription || loading}
            className="bg-blue-600 text-white hover:bg-blue-700 font-sans text-lg px-8 py-4"
          >
            {loading ? "Обработка..." : "Купить абонемент"}
          </Button>
        </div>
      </div>
    </div>
  )
}

