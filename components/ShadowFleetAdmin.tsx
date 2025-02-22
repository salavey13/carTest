// components/ShadowFleetAdmin.tsx
"use client"
import { useState, useEffect } from "react"
import type React from "react"
import { supabaseAdmin } from "@/hooks/supabase"
import { useTelegram } from "@/hooks/useTelegram"
import Link from "next/link"

interface PremiumCar {
  id: string
  make: string
  model: string
  daily_price: number
  premium: boolean
  image_url: string
  rental_count: number
  total_revenue: number
}

export function ShadowFleetAdmin() {
  const { dbUser, isAdmin } = useTelegram()
  const [premiumCars, setPremiumCars] = useState<PremiumCar[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalVipRentals: 0,
    totalRevenue: 0,
    topCar: null as PremiumCar | null,
  })

  useEffect(() => {
    if (!dbUser || !isAdmin()) return

    const fetchPremiumCars = async () => {
      try {
        // Fetch premium cars with rental stats
        const { data, error } = await supabaseAdmin
          .from("cars")
          .select(`
            id,
            make,
            model,
            daily_price,
            premium,
            image_url,
            rentals (id, amount, status)
          `)
          .eq("premium", true)

        if (error) throw error

        // Process rental stats
        const processedCars = data.map((car: any) => ({
          ...car,
          rental_count: car.rentals.length,
          total_revenue: car.rentals
            .filter((r: any) => r.status === "paid")
            .reduce((sum: number, r: any) => sum + r.amount, 0),
        }))

        setPremiumCars(processedCars)

        // Calculate overall stats
        const totalVipRentals = processedCars.reduce(
          (sum, car) => sum + car.rental_count,
          0
        )
        const totalRevenue = processedCars.reduce(
          (sum, car) => sum + car.total_revenue,
          0
        )
        const topCar = processedCars.sort(
          (a, b) => b.total_revenue - a.total_revenue
        )[0] || null

        setStats({ totalVipRentals, totalRevenue, topCar })
      } catch (error) {
        console.error("Error fetching premium cars:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchPremiumCars()
  }, [dbUser, isAdmin])

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
        <h1 className="text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 font-mono mb-8 animate-neon">
          Shadow Fleet Admin Portal
        </h1>

        {/* Fleet Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <StatCard
            title="Total VIP Rentals"
            value={stats.totalVipRentals}
            glow="cyan"
          />
          <StatCard
            title="Total Revenue (XTR)"
            value={stats.totalRevenue.toLocaleString()}
            glow="purple"
          />
          <StatCard
            title="Top Performer"
            value={stats.topCar ? `${stats.topCar.make} ${stats.topCar.model}` : "N/A"}
            glow="pink"
          />
        </div>

        {/* Premium Cars List */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-cyan-400 mb-4">Fleet Overview</h2>
          {loading ? (
            <div className="text-center text-gray-400 animate-pulse">
              Loading Shadow Fleet...
            </div>
          ) : premiumCars.length === 0 ? (
            <div className="text-center text-gray-400">
              No premium cars in the fleet yet. Add some VIP rides!
            </div>
          ) : (
            premiumCars.map((car) => (
              <CarCard key={car.id} car={car} />
            ))
          )}
        </div>

        <Link href="/admin" className="mt-8 inline-block text-cyan-400 hover:text-cyan-300 transition-colors">
          ← Back to Main Admin Panel
        </Link>
      </div>
    </div>
  )
}

// StatCard Component
function StatCard({ title, value, glow }: { title: string; value: string | number; glow: string }) {
  return (
    <div className={`p-6 rounded-lg bg-gray-900/80 border border-${glow}-500/20 shadow-lg shadow-${glow}-500/10 hover:shadow-${glow}-500/20 transition-shadow`}>
      <h3 className="text-lg font-mono text-gray-400">{title}</h3>
      <p className={`text-3xl font-bold text-${glow}-400 mt-2`}>{value}</p>
    </div>
  )
}

// CarCard Component
function CarCard({ car }: { car: PremiumCar }) {
  return (
    <div className="p-6 rounded-lg bg-gray-900/80 border border-cyan-500/20 flex flex-col md:flex-row gap-6 hover:shadow-cyan-500/20 transition-shadow">
      <div className="w-full md:w-1/3">
        <img
          src={car.image_url}
          alt={`${car.make} ${car.model}`}
          className="w-full h-40 object-cover rounded-lg"
        />
      </div>
      <div className="flex-1">
        <h3 className="text-xl font-semibold text-cyan-400">
          {car.make} {car.model}
        </h3>
        <p className="text-gray-400 mt-2">Price: {car.daily_price} XTR/day</p>
        <p className="text-gray-400">Rentals: {car.rental_count}</p>
        <p className="text-gray-400">Revenue: {car.total_revenue.toLocaleString()} XTR</p>
      </div>
    </div>
  )
}
