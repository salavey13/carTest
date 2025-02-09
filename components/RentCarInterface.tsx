"use client"
import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { searchCars, fetchCars } from "@/hooks/supabase"
import SemanticSearch from "@/components/SemanticSearch"
import { useWorker } from "@/hooks/useWorker"
import Image from "next/image"

const RentCarInterface = ({ preselectedCar }) => {
  const [cars, setCars] = useState([])
  const [selectedCar, setSelectedCar] = useState(preselectedCar)
  const [rentDays, setRentDays] = useState(1)
  const [searchResults, setSearchResults] = useState([])
  const { generateEmbedding } = useWorker()

  useEffect(() => {
    const loadCars = async () => {
      const data = await fetchCars()
      setCars(data || [])
      if (preselectedCar) setSelectedCar(preselectedCar)
    }
    loadCars()
  }, [preselectedCar])

  const handleSearch = async (query) => {
    const embedding = await generateEmbedding(query)
    const results = await searchCars(embedding, 5)
    setSearchResults(results)
  }

  return (
    <div className="min-h-screen bg-black text-[#00ff9d] pt-20">
      <div className="container mx-auto px-4 py-8">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold text-center mb-8 font-mono"
        >
          АРЕНДА_КИБЕР-МАШИНЫ//
        </motion.h1>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
          <SemanticSearch onSearch={handleSearch} results={searchResults} onSelect={setSelectedCar} />
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <motion.div initial={{ x: -50 }} animate={{ x: 0 }} transition={{ type: "spring" }}>
            <div className="bg-black/50 border-[#00ff9d]/20 p-6 rounded-xl">
              <h2 className="text-xl font-mono mb-4">ВЫБЕРИТЕ_МАШИНУ//</h2>

              <div className="space-y-4">
                <select
                  value={selectedCar?.id}
                  onChange={(e) => setSelectedCar(cars.find((c) => c.id === e.target.value))}
                  className="w-full bg-black/30 border-[#00ff9d]/30 text-[#00ff9d] font-mono p-3 rounded-lg"
                >
                  {cars.map((car) => (
                    <option key={car.id} value={car.id}>
                      {car.make} {car.model} - {car.daily_price}¥/день
                    </option>
                  ))}
                </select>

                <div className="mt-4">
                  <label className="text-sm font-mono">КОЛИЧЕСТВО_ДНЕЙ//</label>
                  <input
                    type="number"
                    min="1"
                    value={rentDays}
                    onChange={(e) => setRentDays(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-black/30 border-[#00ff9d]/30 text-[#00ff9d] font-mono p-3 rounded-lg mt-1"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ x: 50 }} animate={{ x: 0 }} transition={{ type: "spring", delay: 0.1 }}>
            <div className="bg-black/50 border-[#00ff9d]/20 p-6 rounded-xl">
              <h2 className="text-xl font-mono mb-4">ИНФО_О_МАШИНЕ//</h2>

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
                      className="relative h-48 w-full rounded-xl overflow-hidden"
                      whileHover={{ scale: 1.02 }}
                    >
                      <Image
                        src={selectedCar.image_url || "/placeholder.svg"}
                        alt={selectedCar.make}
                        layout="fill"
                        objectFit="cover"
                      />
                    </motion.div>

                    <div className="space-y-2">
                      <p className="text-center font-mono text-2xl">
                        {selectedCar.make} {selectedCar.model}
                      </p>
                      <p className="text-center font-mono text-lg">{selectedCar.daily_price}¥/день</p>
                      <p className="text-center font-mono text-xl mt-4">ИТОГО: {selectedCar.daily_price * rentDays}¥</p>
                    </div>

                    <button
                      onClick={() => alert(`Арендовано: ${selectedCar.make} на ${rentDays} дней`)}
                      className="w-full bg-[#ff00ff] text-black hover:bg-[#ff00ff]/80 font-mono p-4 rounded-lg transition-all"
                    >
                      АРЕНДОВАТЬ//
                    </button>
                  </motion.div>
                ) : (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} className="text-center font-mono">
                    ВЫБЕРИТЕ_МАШИНУ_ДЛЯ_ПРОСМОТРА_ИНФО//
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default RentCarInterface

