"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const CARS = [
  { id: 1, name: "КИБЕР_СПОРТКАР", price: 1000, image: "/placeholder.svg?height=200&width=200" },
  { id: 2, name: "НЕЙРО_СЕДАН", price: 500, image: "/placeholder.svg?height=200&width=200" },
  { id: 3, name: "КВАНТОВЫЙ_ВНЕДОРОЖНИК", price: 750, image: "/placeholder.svg?height=200&width=200" },
]

export default function RentCar() {
  const [selectedCar, setSelectedCar] = useState(null)
  const [rentDays, setRentDays] = useState(1)

  const handleRent = () => {
    if (selectedCar) {
      alert(`Вы арендовали ${selectedCar.name} на ${rentDays} дней за ${selectedCar.price * rentDays}¥`)
    }
  }

  return (
    <div className="min-h-screen bg-black text-[#00ff9d] pt-20">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 font-mono">АРЕНДА_КИБЕР-МАШИНЫ//</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="bg-black/50 border-[#00ff9d]/20">
            <CardHeader>
              <CardTitle className="text-[#00ff9d] font-mono">ВЫБЕРИТЕ_МАШИНУ//</CardTitle>
            </CardHeader>
            <CardContent>
              <Select onValueChange={(value) => setSelectedCar(CARS.find((car) => car.id === Number.parseInt(value)))}>
                <SelectTrigger className="bg-black/30 border-[#00ff9d]/30 text-[#00ff9d] font-mono">
                  <SelectValue placeholder="ВЫБЕРИТЕ_МОДЕЛЬ//" />
                </SelectTrigger>
                <SelectContent className="bg-black border-[#00ff9d]/20">
                  {CARS.map((car) => (
                    <SelectItem key={car.id} value={car.id.toString()} className="text-[#00ff9d] font-mono">
                      {car.name} - {car.price}¥/день
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-4">
                <label className="text-sm font-mono">КОЛИЧЕСТВО_ДНЕЙ//</label>
                <Input
                  type="number"
                  min="1"
                  value={rentDays}
                  onChange={(e) => setRentDays(Number.parseInt(e.target.value))}
                  className="bg-black/30 border-[#00ff9d]/30 text-[#00ff9d] font-mono mt-1"
                />
              </div>
              <Button
                onClick={handleRent}
                disabled={!selectedCar}
                className="w-full mt-4 bg-[#ff00ff] text-black hover:bg-[#ff00ff]/80 font-mono"
              >
                АРЕНДОВАТЬ//
              </Button>
            </CardContent>
          </Card>
          <Card className="bg-black/50 border-[#00ff9d]/20">
            <CardHeader>
              <CardTitle className="text-[#00ff9d] font-mono">ИНФО_О_МАШИНЕ//</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedCar ? (
                <>
                  <Image
                    src={selectedCar.image || "/placeholder.svg"}
                    alt={selectedCar.name}
                    width={200}
                    height={200}
                    className="mx-auto mb-4"
                  />
                  <p className="text-center font-mono">{selectedCar.name}</p>
                  <p className="text-center font-mono">{selectedCar.price}¥/день</p>
                  <p className="text-center font-mono mt-4">ИТОГО: {selectedCar.price * rentDays}¥</p>
                </>
              ) : (
                <p className="text-center font-mono">ВЫБЕРИТЕ_МАШИНУ_ДЛЯ_ПРОСМОТРА_ИНФО//</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

