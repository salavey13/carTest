"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { fetchCarById, fetchCars } from "@/hooks/supabase"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Car {
  id: string
  make: string
  model: string
  daily_price: number
  image_url: string
  specs?: {
    version?: string
    electric?: boolean
    color?: string
    theme?: string
    horsepower?: number
    torque?: string
    acceleration?: string
    topSpeed?: string
  }
}

export default function RentCarPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [car, setCar] = useState<Car | null>(null)
  const [cars, setCars] = useState<Car[]>([])
  const [selectedCar, setSelectedCar] = useState<Car | null>(null)
  const [rentDays, setRentDays] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const [carData, allCars] = await Promise.all([fetchCarById(params.id), fetchCars()])
        if (!carData) {
          router.push("/not-found")
          return
        }
        setCar(carData)
        setSelectedCar(carData)
        setCars(allCars || [])
      } catch (error) {
        console.error("Error loading car data:", error)
        router.push("/not-found")
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [params.id, router])

  const specs = selectedCar?.specs || {
    version: "v12",
    electric: false,
    color: "Cyber Blue",
    theme: "cyber",
    horsepower: 900,
    torque: "750Nm",
    acceleration: "2.9s 0-100км/ч",
    topSpeed: "340км/ч",
  }

  const handleRent = () => {
    if (selectedCar) {
      alert(`Арендовано: ${selectedCar.make} ${selectedCar.model} на ${rentDays} дней`);
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
        {/* Glare Effect */}
        <div className="absolute top-0 left-0 w-48 h-48 bg-[#00ff9d]/10 rounded-full blur-3xl opacity-20 pointer-events-none" />

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-5xl font-bold text-center mb-10 font-mono tracking-wide text-[#00ff9d] drop-shadow-[0_0_10px_rgba(0,255,157,0.3)]"
        >
          АРЕНДА КИБЕР-МАШИНЫ
        </motion.h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 z-10 relative">
          {/* Car Selection & Rent Form */}
          <motion.div
            initial={{ x: -50 }}
            animate={{ x: 0 }}
            transition={{ type: "spring", stiffness: 100 }}
            className="bg-gray-800/70 border border-[#00ff9d]/20 rounded-xl p-6 shadow-lg"
          >
            <h2 className="text-xl md:text-2xl font-mono mb-6 text-[#00ff9d]/90">ВЫБОР МАШИНЫ</h2>
            <div className="space-y-6">
              <Select
                value={selectedCar?.id}
                onValueChange={(id) => setSelectedCar(cars.find((c) => c.id === id) || null)}
              >
                <SelectTrigger className="w-full bg-gray-900/80 border-[#00ff9d]/30 text-[#00ff9d] font-mono rounded-lg p-3">
                  <SelectValue placeholder="Выберите машину" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-[#00ff9d]/30 text-[#00ff9d] font-mono">
                  {cars.map((car) => (
                    <SelectItem key={car.id} value={car.id}>
                      {car.make} {car.model} - {car.daily_price}¥/день
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div>
                <label className="text-sm font-mono text-[#00ff9d]/80">КОЛИЧЕСТВО ДНЕЙ</label>
                <Input
                  type="number"
                  min="1"
                  value={rentDays}
                  onChange={(e) => setRentDays(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-gray-900/80 border-[#00ff9d]/30 text-[#00ff9d] font-mono p-3 rounded-lg mt-2 focus:ring-[#00ff9d]/60"
                />
              </div>
            </div>
          </motion.div>

          {/* Car Info */}
          <motion.div
            initial={{ x: 50 }}
            animate={{ x: 0 }}
            transition={{ type: "spring", stiffness: 100, delay: 0.1 }}
            className="bg-gray-800/70 border border-[#00ff9d]/20 rounded-xl p-6 shadow-lg"
          >
            <h2 className="text-xl md:text-2xl font-mono mb-6 text-[#00ff9d]/90">ИНФО О МАШИНЕ</h2>
            <AnimatePresence mode="wait">
              {selectedCar ? (
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
                      ИТОГО: {selectedCar.daily_price * rentDays}¥
                    </p>
                  </div>

                  <Button
                    onClick={handleRent}
                    className="w-full bg-[#ff00ff]/90 text-black hover:bg-[#ff00ff]/70 font-mono py-3 rounded-lg transition-all shadow-[0_0_10px_rgba(255,0,255,0.3)] hover:shadow-[0_0_15px_rgba(255,0,255,0.5)]"
                  >
                    АРЕНДОВАТЬ
                  </Button>
                </motion.div>
              ) : (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  className="text-center font-mono text-[#00ff9d]/50"
                >
                  ВЫБЕРИТЕ МАШИНУ ДЛЯ ПРОСМОТРА
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Car Specs */}
        {selectedCar && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-12 bg-gray-800/70 border border-[#00ff9d]/20 rounded-xl p-6 shadow-lg z-10 relative"
          >
            <h2 className="text-xl md:text-2xl font-mono mb-6 text-[#00ff9d]/90 drop-shadow-[0_0_5px_rgba(0,255,157,0.3)]">
              ХАРАКТЕРИСТИКИ
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-lg font-mono text-[#00ff9d]/80">Производительность</h3>
                <p>
                  <span className="text-[#ff00ff]/80">Версия:</span> {specs.version}
                </p>
                <p>
                  <span className="text-[#ff00ff]/80">Электрический:</span> {specs.electric ? "Да" : "Нет"}
                </p>
                <p>
                  <span className="text-[#ff00ff]/80">Мощность:</span> {specs.horsepower} л.с.
                </p>
                <p>
                  <span className="text-[#ff00ff]/80">Крутящий момент:</span> {specs.torque}
                </p>
                <p>
                  <span className="text-[#ff00ff]/80">Разгон 0-100:</span> {specs.acceleration}
                </p>
                <p>
                  <span className="text-[#ff00ff]/80">Макс. скорость:</span> {specs.topSpeed}
                </p>
              </div>
              <div className="space-y-3">
                <h3 className="text-lg font-mono text-[#00ff9d]/80">Эстетика</h3>
                <p>
                  <span className="text-[#ff00ff]/80">Цвет:</span> {specs.color}
                </p>
                <p>
                  <span className="text-[#ff00ff]/80">Тема:</span> {specs.theme}
                </p>
              </div>
            </div>
          </motion.section>
        )}
      </div>
    </motion.div>
  )
}
