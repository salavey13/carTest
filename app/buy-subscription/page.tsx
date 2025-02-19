// app/buy-subscription/page.tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useTelegram } from "@/hooks/useTelegram"
import { sendTelegramInvoice } from "@/app/actions"

const SUBSCRIPTIONS = [
  { id: 1, name: "БАЗОВЫЙ", price: 13, features: ["ДОСТУП_К_СТАНДАРТНЫМ_МАШИНАМ", "БАЗОВАЯ_ТЕХПОДЕРЖКА"] },
  {
    id: 2,
    name: "ПРОДВИНУТЫЙ",
    price: 69,
    features: ["ДОСТУП_К_ПРЕМИУМ_МАШИНАМ", "ПРИОРИТЕТНАЯ_ТЕХПОДДЕРЖКА", "БЕСПЛАТНЫЕ_АПГРЕЙДЫ"],
  },
  {
    id: 3,
    name: "VIP",
    price: 420,
    features: ["ДОСТУП_КО_ВСЕМ_МАШИНАМ", "КРУГЛОСУТОЧНАЯ_ПОДДЕРЖКА", "ПЕРСОНАЛЬНЫЙ_МЕНЕДЖЕР"],
  },
]

export default function BuySubscription() {
  const { user, isAuthenticated } = useTelegram()
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePurchase = async () => {
    if (!isAuthenticated || !user) {
      setError("You must be logged in to purchase a subscription.")
      return
    }

    if (!selectedSubscription) {
      setError("Please select a subscription.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const payload = `subscription_${user.id}_${Date.now()}`
      const response = await sendTelegramInvoice(
        process.env.SUPABASE_JWT_SECRET!,
        user.id.toString(),
        `${selectedSubscription.name} Subscription`,
        "Unlock premium features with this subscription!",
        payload,
        selectedSubscription.price,
      )

      if (!response.success) {
        throw new Error(response.error || "Failed to send invoice")
      }

      setSuccess(true)
    } catch (err) {
      console.error("Error during purchase:", err)
      setError("An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-[#00ff9d] pt-20">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 font-mono">КУПИТЬ_АБОНЕМЕНТ//</h1>
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        {success && (
          <p className="text-green-500 text-center mb-4">🎉 Invoice sent successfully! Complete payment in Telegram.</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {SUBSCRIPTIONS.map((sub) => (
            <Card key={sub.id} className="bg-black/50 border-[#00ff9d]/20">
              <CardHeader>
                <CardTitle className="text-[#00ff9d] font-mono">{sub.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold mb-4 font-mono">{sub.price} XTR</p>
                <ul className="list-disc list-inside mb-4">
                  {sub.features.map((feature, index) => (
                    <li key={index} className="font-mono">
                      {feature}
                    </li>
                  ))}
                </ul>
                <RadioGroup onValueChange={() => setSelectedSubscription(sub)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={sub.id.toString()} id={`sub-${sub.id}`} />
                    <Label htmlFor={`sub-${sub.id}`} className="font-mono">
                      ВЫБРАТЬ
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
            className="bg-[#ff00ff] text-black hover:bg-[#ff00ff]/80 font-mono text-lg px-8 py-4"
          >
            {loading ? "Processing..." : "КУПИТЬ_АБОНЕМЕНТ//"}
          </Button>
        </div>
      </div>
    </div>
  )
}

