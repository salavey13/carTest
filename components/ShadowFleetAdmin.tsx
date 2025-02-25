"use client"
import { useState, useEffect } from "react"
import type React from "react"
import { supabaseAdmin } from "@/hooks/supabase"
import { useTelegram } from "@/hooks/useTelegram"
import Link from "next/link"
import { motion } from "framer-motion"
import { toast } from "sonner"

interface PremiumCar {
  id: string
  make: string
  model: string
  daily_price: number
  premium: boolean
  image_url: string
  rental_count: number
  total_revenue: number
  active_rentals: number
  completed_rentals: number
  cancelled_rentals: number
  owner_id: string
}

export function ShadowFleetAdmin() {
  const { dbUser, isAdmin } = useTelegram()
  const [premiumCars, setPremiumCars] = useState<PremiumCar[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [stats, setStats] = useState({
    totalVipRentals: 0,
    totalRevenue: 0,
    totalActive: 0,
    totalCompleted: 0,
    totalCancelled: 0,
    topCar: null as PremiumCar | null,
  })

  useEffect(() => {
    if (!dbUser || !isAdmin() || !dbUser.id) return

    const fetchPremiumCars = async () => {
      try {
        const { data, error } = await supabaseAdmin
          .from("cars")
          .select(`
            id,
            make,
            model,
            daily_price,
            premium,
            image_url,
            owner_id,
            rentals (id, total_cost, payment_status, status)
          `)
          .eq("premium", true)
          .eq("owner_id", dbUser.id) // Filter by current admin

        if (error) throw error

        const processedCars = data.map((car: any) => ({
          ...car,
          rental_count: car.rentals.length,
          total_revenue: car.rentals
            .filter((r: any) => r.payment_status === "paid")
            .reduce((sum: number, r: any) => sum + r.total_cost, 0),
          active_rentals: car.rentals.filter((r: any) => r.status === "active").length,
          completed_rentals: car.rentals.filter((r: any) => r.status === "completed").length,
          cancelled_rentals: car.rentals.filter((r: any) => r.status === "cancelled").length,
        }))

        const filteredCars = processedCars.filter(
          (car) =>
            car.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
            car.model.toLowerCase().includes(searchQuery.toLowerCase())
        )

        setPremiumCars(filteredCars)

        const totalVipRentals = filteredCars.reduce((sum, car) => sum + car.rental_count, 0)
        const totalRevenue = filteredCars.reduce((sum, car) => sum + car.total_revenue, 0)
        const totalActive = filteredCars.reduce((sum, car) => sum + car.active_rentals, 0)
        const totalCompleted = filteredCars.reduce((sum, car) => sum + car.completed_rentals, 0)
        const totalCancelled = filteredCars.reduce((sum, car) => sum + car.cancelled_rentals, 0)
        const topCar = filteredCars.sort((a, b) => b.total_revenue - a.total_revenue)[0] || null

        setStats({ totalVipRentals, totalRevenue, totalActive, totalCompleted, totalCancelled, topCar })
      } catch (error) {
        console.error("Error fetching premium cars:", error)
        toast.error("Ошибка загрузки флота")
      } finally {
        setLoading(false)
      }
    }

    fetchPremiumCars()
  }, [dbUser, isAdmin, searchQuery])

  if (!dbUser || !isAdmin()) {
    return <div className="min-h-screen bg-black" />
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Neon Cyber Background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none select-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-900 via-black to-purple-900 animate-pulse" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBvcGFjaXR5PSIwLjEiPjxwYXRoIGQ9Ik0wIDBIMjAwVjIwMEgwVjBaIiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTAgMEgyMDBNMCAyMEgyMDBNMCA0MEgyMDBNMCA2MEgyMDBNMCA4MEgyMDBNMCAxMDBIMjAwTTEwMCAwVjIwME0xMjAgMFYyMDBNMTQwIDBWMjAwTTE2MCAwVjIwME0xODAgMFYyMDAiIHN0cm9rZT0iIzAwZmZmZiIvPjwvZz48L3N2Zz4=')] bg-repeat animate-drift" />
      </div>

      <div className="pt-20 relative container mx-auto px-4">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-5xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 font-['Orbitron'] mb-8 drop-shadow-[0_0_15px_rgba(0,255,255,0.8)]"
        >
          Портал Shadow Fleet
        </motion.h1>

        <div className="mb-6">
          <input
            type="text"
            placeholder="Поиск по марке или модели..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md p-3 rounded-lg bg-gray-900/80 border border-cyan-500/30 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-[0_0_5px_rgba(0,255,255,0.3)]"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          <StatCard title="VIP Аренды" value={stats.totalVipRentals} glow="cyan" />
          <StatCard title="Доход (XTR)" value={stats.totalRevenue.toLocaleString()} glow="purple" />
          <StatCard
            title="Топ Машина"
            value={stats.topCar ? `${stats.topCar.make} ${stats.topCar.model}` : "N/A"}
            glow="pink"
          />
          <StatCard title="Активные" value={stats.totalActive} glow="green" />
          <StatCard title="Завершенные" value={stats.totalCompleted} glow="blue" />
          <StatCard title="Отмененные" value={stats.totalCancelled} glow="red" />
        </motion.div>

        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-cyan-400 mb-4 font-mono">Ваш Теневой Флот</h2>
          {loading ? (
            <div className="text-center text-gray-400 animate-pulse">Загрузка флота...</div>
          ) : premiumCars.length === 0 ? (
            <div className="text-center text-gray-400">Ваш флот пуст. Добавьте машины!</div>
          ) : (
            premiumCars.map((car) => <CarCard key={car.id} car={car} />)
          )}
        </div>

        <Link href="/admin" className="mt-8 inline-block text-cyan-400 hover:text-cyan-300 transition-colors font-mono">
          ← Назад к Центру Управления
        </Link>
      </div>
    </div>
  )
}

function StatCard({ title, value, glow }: { title: string; value: string | number; glow: string }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`p-6 rounded-lg bg-gray-900/80 border border-${glow}-500/30 shadow-[0_0_10px_rgba(0,255,255,0.2)] hover:shadow-${glow}-500/40 transition-all`}
    >
      <h3 className="text-lg font-mono text-gray-400">{title}</h3>
      <p className={`text-3xl font-bold text-${glow}-400 mt-2`}>{value}</p>
    </motion.div>
  )
}

function CarCard({ car }: { car: PremiumCar }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="p-6 rounded-lg bg-gray-900/80 border border-cyan-500/30 flex flex-col md:flex-row gap-6 shadow-[0_0_10px_rgba(0,255,255,0.2)] hover:shadow-cyan-500/30 transition-all"
    >
      <div className="w-full md:w-1/3">
        <img
          src={car.image_url}
          alt={`${car.make} ${car.model}`}
          className="w-full h-40 object-cover rounded-lg shadow-[0_0_8px_rgba(0,255,255,0.5)]"
        />
      </div>
      <div className="flex-1">
        <h3 className="text-xl font-semibold text-cyan-400 font-['Orbitron']">
          {car.make} {car.model}
        </h3>
        <p className="text-gray-400 mt-2">Цена: {car.daily_price} XTR/день</p>
        <p className="text-gray-400">Аренд: {car.rental_count}</p>
        <p className="text-gray-400">Доход: {car.total_revenue.toLocaleString()} XTR</p>
        <p className="text-gray-400">Активные: {car.active_rentals}</p>
        <p className="text-gray-400">Завершенные: {car.completed_rentals}</p>
        <p className="text-gray-400">Отмененные: {car.cancelled_rentals}</p>
        <Link
          href={`/rent/${car.id}`}
          className="mt-2 inline-block text-cyan-400 hover:text-cyan-300 transition-colors font-mono"
        >
          Подробности →
        </Link>
      </div>
    </motion.div>
  )
}

