"use client"
import { useState, useEffect, useCallback } from "react"
import type React from "react"
import { useAppContext } from "@/contexts/AppContext"
import Link from "next/link"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Loading } from "@/components/Loading";
import Image from "next/image";
import { VibeContentRenderer } from "./VibeContentRenderer"
import { useRouter } from "next/navigation"
import { getUserPaddockData } from "@/app/actions"
import { Button } from "./ui/button"
import { cn } from "@/lib/utils"

interface VehicleStat {
  id: string; make: string; model: string; daily_price: number; image_url: string; type: 'car' | 'bike';
  rental_count: number; total_revenue: number; active_rentals: number;
}
interface UserCrew { id: string; slug: string; name: string; logo_url: string; }

export function Paddock() {
  const { dbUser, isAdmin, isLoading: isAppContextLoading } = useAppContext();
  const router = useRouter();
  const [fleet, setFleet] = useState<VehicleStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRentals: 0, totalRevenue: 0, totalActive: 0,
    topVehicle: null as VehicleStat | null, userCrew: null as UserCrew | null
  });
  const isUserAdmin = isAdmin();

  const fetchPaddockData = useCallback(async () => {
    if (!dbUser?.user_id) return;
    setLoading(true);
    try {
        const result = await getUserPaddockData(dbUser.user_id);
        if (result.success && result.data) {
            const { fleet: fleetData, userCrew } = result.data;
            setFleet(fleetData);
            const totalRentals = fleetData.reduce((sum, v) => sum + (v.rental_count || 0), 0);
            const totalRevenue = fleetData.reduce((sum, v) => sum + (v.total_revenue || 0), 0);
            const totalActive = fleetData.reduce((sum, v) => sum + (v.active_rentals || 0), 0);
            const topVehicle = [...fleetData].sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0))[0] || null;
            setStats({ totalRentals, totalRevenue, totalActive, topVehicle, userCrew });
        } else { throw new Error(result.error || "Failed to fetch paddock data."); }
    } catch (error) {
      console.error("Error fetching paddock:", error);
      toast.error(error instanceof Error ? error.message : "Ошибка загрузки паддока");
    } finally { setLoading(false); }
  }, [dbUser?.user_id]);

  useEffect(() => {
    if (!isAppContextLoading && isUserAdmin) { fetchPaddockData(); }
  }, [isAppContextLoading, isUserAdmin, fetchPaddockData]);

  if (isAppContextLoading) return <Loading variant="bike" text="ПРОВЕРКА ДОСТУПА В ПАДДОК..." />;

  if (!isUserAdmin) {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center p-4">
            <VibeContentRenderer content="::FaLock::" className="text-7xl text-destructive mb-4"/>
            <h1 className="text-3xl font-orbitron text-destructive">ДОСТУП ЗАПРЕЩЕН</h1>
            <p className="text-muted-foreground font-mono mt-2 max-w-md">Этот раздел доступен только владельцам транспорта. Добавьте свой первый байк или авто в Vibe Control Center, чтобы получить доступ.</p>
            <Link href="/admin">
                <Button variant="secondary" className="mt-6 group">
                    <VibeContentRenderer content="::FaWrench::" className="mr-3 transition-transform group-hover:rotate-12"/>
                    В VIBE CONTROL CENTER
                </Button>
            </Link>
        </div>
    );
  }

  if (loading) return <Loading variant="bike" text="ЗАГРУЗКА ПАДДОКА..." />;

  return (
    <div className="min-h-screen relative overflow-hidden p-4 dark">
      <div className="absolute inset-0 opacity-10 pointer-events-none select-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-background to-secondary/30 animate-pulse" />
      </div>

      <div className="pt-20 relative container mx-auto">
        <motion.div initial={{opacity: 0}} animate={{opacity: 1}} className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <h1 className="text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent font-orbitron drop-shadow-[0_0_15px_hsl(var(--primary))]">
            КОМАНДНЫЙ МОСТИК
            </h1>
            <div className="flex items-center gap-4">
                {stats.userCrew && (
                    <Link href={`/crews/${stats.userCrew.slug}`} className="flex items-center gap-2 bg-card/50 p-2 pr-4 rounded-full border border-border hover:border-brand-green transition-colors">
                        <Image src={stats.userCrew.logo_url} alt={stats.userCrew.name} width={32} height={32} className="rounded-full" />
                        <span className="font-mono text-sm">{stats.userCrew.name}</span>
                    </Link>
                )}
                 <Link href="/leaderboard" passHref>
                    <motion.button whileHover={{scale: 1.05}} className="px-4 py-2 text-sm bg-accent/20 border border-accent text-foreground rounded-lg font-semibold"><VibeContentRenderer content="::FaTrophy:: Лидерборд"/></motion.button>
                </Link>
            </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
        >
          <StatCard title="Всего аренд" value={stats.totalRentals} icon="::FaKey::" color="primary" />
          <StatCard title="Общий доход (₽)" value={stats.totalRevenue.toLocaleString()} icon="::FaCoins::" color="accent" />
          <StatCard title="Активные аренды" value={stats.totalActive} icon="::FaHourglassHalf::" color="brand-green" />
          <StatCard title="Топ транспорт" value={stats.topVehicle ? `${stats.topVehicle.make} ${stats.topVehicle.model}` : "N/A"} icon="::FaTrophy::" color="secondary" />
        </motion.div>

        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold text-accent-text font-mono">Управление Автопарком ({fleet.length})</h2>
            <Link href="/admin">
                <Button variant="accent" className="font-semibold shadow-lg shadow-accent/20">
                    <VibeContentRenderer content="::FaPlusCircle::" className="mr-2"/>
                    Добавить Транспорт
                </Button>
            </Link>
          </div>
          {fleet.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 bg-card/30 rounded-lg">Ваш гараж пуст. <Link href="/admin" className="text-accent-text hover:underline">Добавьте транспорт</Link> в Vibe Control Center!</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {fleet.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}
            </div>
          )}
        </div>
        <Link href="/admin" className="mt-8 mb-2 inline-block text-accent-text hover:text-accent-text/80 transition-colors font-mono text-sm">
          ← Назад в Vibe Control Center
        </Link>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, color }: { title: string; value: string | number; icon: string; color: string }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`p-6 rounded-lg bg-card/80 border border-${color}/30 shadow-[0_0_10px_hsl(var(--${color}))] hover:shadow-${color}/40 transition-all backdrop-blur-sm`}
    >
      <div className="flex items-center gap-4">
        <VibeContentRenderer content={icon} className={`text-3xl text-${color}`}/>
        <div>
            <h3 className="text-md font-mono text-muted-foreground">{title}</h3>
            <p className={`text-2xl font-bold text-${color} mt-1`}>{value}</p>
        </div>
      </div>
    </motion.div>
  )
}

function VehicleCard({ vehicle }: { vehicle: VehicleStat }) {
  const isRented = vehicle.active_rentals > 0;
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="p-4 rounded-lg bg-card/70 border border-primary/30 flex flex-col gap-4 shadow-[0_0_10px_hsl(var(--primary))] hover:shadow-primary/30 transition-all backdrop-blur-sm"
    >
      <div className="flex gap-4">
        <Image
          src={vehicle.image_url} alt={`${vehicle.make} ${vehicle.model}`} width={120} height={120}
          className="w-1/3 object-cover rounded-lg shadow-[0_0_8px_hsl(var(--primary))]"
        />
        <div className="flex-1">
            <div className={cn("inline-block px-2 py-1 text-xs font-mono rounded-full mb-2", isRented ? "bg-destructive/20 text-destructive" : "bg-green-500/20 text-green-500")}>
                {isRented ? "В АРЕНДЕ" : "СВОБОДЕН"}
            </div>
            <h3 className="text-xl font-semibold text-accent-text font-orbitron">{vehicle.make} {vehicle.model}</h3>
            <p className="text-muted-foreground mt-1 text-sm">Цена: {vehicle.daily_price} ₽/день</p>
        </div>
      </div>
       <div className="grid grid-cols-2 gap-2 text-center text-sm">
            <StatPill label="Всего аренд" value={vehicle.rental_count} />
            <StatPill label="Доход (₽)" value={(vehicle.total_revenue ?? 0).toLocaleString()} />
       </div>
       <Link href={`/admin?edit=${vehicle.id}`} className="w-full">
            <Button variant="outline" className="w-full border-accent/50 text-accent hover:bg-accent/10 hover:text-accent">
                <VibeContentRenderer content="::FaTools::" className="mr-2"/> Редактировать
            </Button>
       </Link>
    </motion.div>
  )
}

const StatPill = ({ label, value }: { label: string, value: string | number }) => (
    <div className="bg-background/30 p-2 rounded-lg border border-border h-full flex flex-col justify-center">
        <p className="text-lg font-orbitron text-accent-text">{value}</p>
        <p className="text-xs text-muted-foreground font-mono uppercase">{label}</p>
    </div>
)