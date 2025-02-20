"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabaseAnon } from "@/hooks/supabase"
import SemanticSearch from "@/components/SemanticSearch"

export default function RentCar() {
  const [selectedCar, setSelectedCar] = useState(null)
  const [rentDays, setRentDays] = useState(1)
  const [cars, setCars] = useState([])

  // Fetch cars from Supabase
  useEffect(() => {
    const fetchCars = async () => {
      const { data, error } = await supabaseAnon.from("cars").select("*")
      if (error) {
        console.error("Ошибка при загрузке автомобилей:", error)
      } else {
        setCars(data || [])
      }
    }
    fetchCars()
  }, [])

  const handleRent = () => {
    if (selectedCar) {
      alert(`Вы арендовали ${selectedCar.make} ${selectedCar.model} на ${rentDays} дней за ${selectedCar.daily_price * rentDays} ₽`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 pt-20">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 font-sans text-blue-900">Аренда китайских автомобилей</h1>

        {/* SemanticSearch Component */}
        <div className="mb-8">
          <SemanticSearch />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="bg-white border-gray-300">
            <CardHeader>
              <CardTitle className="text-blue-900 font-sans">Выберите автомобиль</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                onValueChange={(value) => setSelectedCar(cars.find((car) => car.id === value))}
              >
                <SelectTrigger className="bg-gray-50 border-gray-300 text-gray-900 font-sans">
                  <SelectValue placeholder="Выберите модель" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  {cars.map((car) => (
                    <SelectItem key={car.id} value={car.id} className="text-gray-900 font-sans">
                      {car.make} {car.model} - {car.daily_price} ₽/день
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
                  onChange={(e) => setRentDays(Number.parseInt(e.target.value))}
                  className="bg-gray-50 border-gray-300 text-gray-900 font-sans mt-1"
                />
              </div>
              <Button
                onClick={handleRent}
                disabled={!selectedCar}
                className="w-full mt-4 bg-blue-600 text-white hover:bg-blue-700 font-sans"
              >
                Арендовать
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-300">
            <CardHeader>
              <CardTitle className="text-blue-900 font-sans">Информация об автомобиле</CardTitle>
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
                  <p className="text-gray-700 font-sans">{selectedCar.daily_price} ₽/день</p>
                  <p className="text-gray-700 font-sans mt-4">Итого: {selectedCar.daily_price * rentDays} ₽</p>
                </>
              ) : (
                <p className="text-center text-gray-700 font-sans">Выберите автомобиль для просмотра информации</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

