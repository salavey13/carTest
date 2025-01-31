"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

const SUBSCRIPTIONS = [
  { id: 1, name: "БАЗОВЫЙ", price: 1000, features: ["ДОСТУП_К_СТАНДАРТНЫМ_МАШИНАМ", "БАЗОВАЯ_ТЕХПОДДЕРЖКА"] },
  {
    id: 2,
    name: "ПРОДВИНУТЫЙ",
    price: 2000,
    features: ["ДОСТУП_К_ПРЕМИУМ_МАШИНАМ", "ПРИОРИТЕТНАЯ_ТЕХПОДДЕРЖКА", "БЕСПЛАТНЫЕ_АПГРЕЙДЫ"],
  },
  {
    id: 3,
    name: "VIP",
    price: 5000,
    features: ["ДОСТУП_КО_ВСЕМ_МАШИНАМ", "КРУГЛОСУТОЧНАЯ_ПОДДЕРЖКА", "ПЕРСОНАЛЬНЫЙ_МЕНЕДЖЕР"],
  },
]

export default function BuySubscription() {
  const [selectedSubscription, setSelectedSubscription] = useState(null)

  const handlePurchase = () => {
    if (selectedSubscription) {
      alert(`Вы приобрели абонемент ${selectedSubscription.name} за ${selectedSubscription.price}¥`)
    }
  }

  return (
    <div className="min-h-screen bg-black text-[#00ff9d] pt-20">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 font-mono">КУПИТЬ_АБОНЕМЕНТ//</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {SUBSCRIPTIONS.map((sub) => (
            <Card key={sub.id} className="bg-black/50 border-[#00ff9d]/20">
              <CardHeader>
                <CardTitle className="text-[#00ff9d] font-mono">{sub.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold mb-4 font-mono">{sub.price}¥</p>
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
            disabled={!selectedSubscription}
            className="bg-[#ff00ff] text-black hover:bg-[#ff00ff]/80 font-mono text-lg px-8 py-4"
          >
            КУПИТЬ_АБОНЕМЕНТ//
          </Button>
        </div>
      </div>
    </div>
  )
}

