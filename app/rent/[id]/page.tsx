"use client"

import { notFound } from "next/navigation"
import { fetchCarById } from "@/hooks/supabase"
import RentCarInterface from "@/components/RentCarInterface"
import { motion } from "framer-motion"

export default async function RentCarPage({ params }: { params: { id: string } }) {
  const car = await fetchCarById(params.id)

  if (!car) return notFound()

  const specs = car.specs || {
    version: "v12",
    electric: false,
    color: "Cyber Blue",
    theme: "cyber",
    horsepower: 900,
    torque: "750Nm",
    acceleration: "2.9s 0-60mph",
    topSpeed: "210mph",
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="min-h-screen bg-black text-[#00ff9d] p-4 pt-20"
    >
      <RentCarInterface preselectedCar={car} />
      <section className="mt-8">
        <h2 className="text-2xl font-bold cyber-text mb-6">Характеристики автомобиля</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-black/50 border-[#00ff9d]/20 p-4 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-3">Производительность</h3>
            <p>
              <span className="text-[#ff00ff]">Версия:</span> {specs.version}
            </p>
            <p>
              <span className="text-[#ff00ff]">Электрический:</span> {specs.electric ? "Да" : "Нет"}
            </p>
            <p>
              <span className="text-[#ff00ff]">Мощность:</span> {specs.horsepower} л.с.
            </p>
            <p>
              <span className="text-[#ff00ff]">Крутящий момент:</span> {specs.torque}
            </p>
            <p>
              <span className="text-[#ff00ff]">Разгон 0-100 км/ч:</span> {specs.acceleration}
            </p>
            <p>
              <span className="text-[#ff00ff]">Максимальная скорость:</span> {specs.topSpeed}
            </p>
          </div>
          <div className="bg-black/50 border-[#00ff9d]/20 p-4 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-3">Эстетика</h3>
            <p>
              <span className="text-[#ff00ff]">Цвет:</span> {specs.color}
            </p>
            <p>
              <span className="text-[#ff00ff]">Тема:</span> {specs.theme}
            </p>
          </div>
        </div>
      </section>
    </motion.div>
  )
}

