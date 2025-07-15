"use client"
import { useState, useEffect, useCallback } from "react"
import type React from "react"
import { supabaseAdmin } from "@/hooks/supabase"
import { useAppContext } from "@/contexts/AppContext"
import Link from "next/link"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Loading } from "@/components/Loading";
import Image from "next/image";
import { VibeContentRenderer } from "./VibeContentRenderer"
import { useRouter } from "next/navigation"

interface VehicleStat {
  id: string;
  make: string;
  model: string;
  daily_price: number;
  image_url: string;
  type: 'car' | 'bike';
  rental_count: number;
  total_revenue: number;
  active_rentals: number;
  completed_rentals: number;
  cancelled_rentals: number;
  owner_id: string;
}

export function Paddock() {
  const { dbUser, isAdmin, isLoading: isAppContextLoading } = useAppContext();
  const router = useRouter();
  
  const [fleet, setFleet] = useState<VehicleStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({
    totalRentals: 0,
    totalRevenue: 0,
    totalActive: 0,
    topVehicle: null as VehicleStat | null,
  });

  const isUserAdmin = isAdmin();

  const fetchFleetData = useCallback(async () => {
    if (!dbUser?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabaseAdmin
        .from("cars")
        .select(`id, make, model, daily_price, image_url, type, owner_id, rentals (id, total_cost, payment_status, status)`)
        .eq("owner_id", dbUser.id);

      if (error) throw error;

      const processedVehicles = data.map((v: any) => ({
        ...v,
        rental_count: v.rentals.length,
        total_revenue: v.rentals.filter((r: any) => r.payment_status === "paid").reduce((sum: number, r: any) => sum + r.total_cost, 0),
        active_rentals: v.rentals.filter((r: any) => r.status === "active").length,
        completed_rentals: v.rentals.filter((r: any) => r.status === "completed").length,
        cancelled_rentals: v.rentals.filter((r: any) => r.status === "cancelled").length,
      }));

      const filteredVehicles = processedVehicles.filter(
        (v) =>
          v.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.model.toLowerCase().includes(searchQuery.toLowerCase())
      );

      setFleet(filteredVehicles);

      const totalRentals = filteredVehicles.reduce((sum, v) => sum + v.rental_count, 0);
      const totalRevenue = filteredVehicles.reduce((sum, v) => sum + v.total_revenue, 0);
      const totalActive = filteredVehicles.reduce((sum, v) => sum + v.active_rentals, 0);
      const topVehicle = filteredVehicles.sort((a, b) => b.total_revenue - a.total_revenue)[0] || null;

      setStats({ totalRentals, totalRevenue, totalActive, topVehicle });
    } catch (error) {
      console.error("Error fetching fleet:", error);
      toast.error("Ошибка загрузки паддока");
    } finally {
      setLoading(false);
    }
  }, [dbUser?.id, searchQuery]);

  useEffect(() => {
    if (!isAppContextLoading && isUserAdmin) {
      fetchFleetData();
    }
  }, [isAppContextLoading, isUserAdmin, fetchFleetData]);

  if (isAppContextLoading) {
    return <Loading variant="bike" text="ПРОВЕРКА ДОСТУПА В ПАДДОК..." />;
  }

  if (!isUserAdmin) {
    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center p-4">
            <VibeContentRenderer content="::FaLock::" className="text-7xl text-destructive mb-4"/>
            <h1 className="text-3xl font-orbitron text-destructive">ДОСТУП ЗАПРЕЩЕН</h1>
            <p className="text-muted-foreground font-mono mt-2 max-w-md">Этот раздел доступен только владельцам транспорта. Добавьте свой первый байк или авто в Vibe Control Center, чтобы получить доступ.</p>
            <Link href="/admin">
                <button className="mt-6 group inline-flex items-center justify-center px-6 py-3 border-2 border-brand-purple bg-brand-purple/10 text-brand-purple rounded-lg font-orbitron text-lg tracking-wider transition-all duration-300 hover:bg-brand-purple hover:text-black hover:shadow-purple-glow">
                    <VibeContentRenderer content="::FaWrench::" className="mr-3 transition-transform group-hover:rotate-12"/>
                    В VIBE CONTROL CENTER
                </button>
            </Link>
        </div>
    );
  }

  if (loading) {
     return <Loading variant="bike" text="ЗАГРУЗКА ПАДДОКА..." />;
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none select-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-900 via-black to-purple-900 animate-pulse" />
      </div>

      <div className="pt-20 relative container mx-auto px-4">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-5xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 font-orbitron mb-8 drop-shadow-[0_0_15px_rgba(0,255,255,0.8)]"
        >
          МОЙ ПАДДОК
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
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
        >
          <StatCard title="Всего аренд" value={stats.totalRentals} icon="::FaKey::" glowColor="cyan" />
          <StatCard title="Общий доход (XTR)" value={stats.totalRevenue.toLocaleString()} icon="::FaCoins::" glowColor="purple" />
          <StatCard title="Активные аренды" value={stats.totalActive} icon="::FaHourglassHalf::" glowColor="green" />
          <StatCard title="Топ транспорт" value={stats.topVehicle ? `${stats.topVehicle.make} ${stats.topVehicle.model}` : "N/A"} icon="::FaTrophy::" glowColor="pink" />
        </motion.div>

        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-cyan-400 mb-4 font-mono">Мой Гараж</h2>
          {fleet.length === 0 ? (
            <div className="text-center text-gray-400">Ваш гараж пуст. Добавьте транспорт в Vibe Control Center!</div>
          ) : (
            fleet.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)
          )}
        </div>

        <Link href="/admin" className="mt-8 inline-block text-cyan-400 hover:text-cyan-300 transition-colors font-mono">
          ← Назад в Vibe Control Center
        </Link>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, glowColor }: { title: string; value: string | number; icon: string; glowColor: string }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`p-6 rounded-lg bg-gray-900/80 border border-${glowColor}-500/30 shadow-[0_0_10px_rgba(0,255,255,0.2)] hover:shadow-${glowColor}-500/40 transition-all`}
    >
      <div className="flex items-center gap-4">
        <VibeContentRenderer content={icon} className={`text-3xl text-${glowColor}-400`}/>
        <div>
            <h3 className="text-md font-mono text-gray-400">{title}</h3>
            <p className={`text-2xl font-bold text-${glowColor}-400 mt-1`}>{value}</p>
        </div>
      </div>
    </motion.div>
  )
}

function VehicleCard({ vehicle }: { vehicle: VehicleStat }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="p-4 rounded-lg bg-gray-900/80 border border-cyan-500/30 flex flex-col md:flex-row gap-6 shadow-[0_0_10px_rgba(0,255,255,0.2)] hover:shadow-cyan-500/30 transition-all"
    >
      <Image
        src={vehicle.image_url}
        alt={`${vehicle.make} ${vehicle.model}`}
        width={200}
        height={150}
        className="w-full md:w-1/4 h-40 object-cover rounded-lg shadow-[0_0_8px_rgba(0,255,255,0.5)]"
      />
      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
        <div>
            <h3 className="text-xl font-semibold text-cyan-400 font-orbitron">{vehicle.make} {vehicle.model}</h3>
            <p className="text-gray-400 mt-1">Цена: {vehicle.daily_price} XTR/день</p>
            <Link href={`/rent/${vehicle.id}`} className="mt-2 inline-block text-cyan-400 hover:text-cyan-300 transition-colors font-mono text-sm">Подробности →</Link>
        </div>
        <StatPill label="Всего аренд" value={vehicle.rental_count} />
        <StatPill label="Доход (XTR)" value={vehicle.total_revenue.toLocaleString()} />
        <StatPill label="Активно" value={vehicle.active_rentals} />
      </div>
    </motion.div>
  )
}

const StatPill = ({ label, value }: { label: string, value: string | number }) => (
    <div className="text-center bg-black/30 p-2 rounded-lg border border-gray-700">
        <p className="text-2xl font-orbitron text-brand-yellow">{value}</p>
        <p className="text-xs text-muted-foreground font-mono uppercase">{label}</p>
    </div>
)