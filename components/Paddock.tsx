"use client";

import { useState, useEffect, useCallback } from "react";
import type React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { useAppContext } from "@/contexts/AppContext";
import { Loading } from "@/components/Loading";
import { VibeContentRenderer } from "./VibeContentRenderer";
import { getUserPaddockData } from "@/app/actions";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface VehicleStat {
  id: string;
  make: string;
  model: string;
  daily_price: number;
  image_url: string;
  type: "car" | "bike";
  rental_count: number;
  total_revenue: number;
  active_rentals: number;
}
interface UserCrew {
  id: string;
  slug: string;
  name: string;
  logo_url: string;
}

const statTone: Record<string, { icon: string; ring: string; text: string }> = {
  primary: { icon: "text-primary", ring: "border-primary/40", text: "text-primary" },
  accent: { icon: "text-accent", ring: "border-accent/40", text: "text-accent" },
  success: { icon: "text-emerald-400", ring: "border-emerald-400/35", text: "text-emerald-400" },
  secondary: { icon: "text-secondary", ring: "border-secondary/40", text: "text-secondary" },
};

export function Paddock() {
  const { dbUser, isAdmin, isLoading: isAppContextLoading } = useAppContext();
  const router = useRouter();
  const [fleet, setFleet] = useState<VehicleStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRentals: 0,
    totalRevenue: 0,
    totalActive: 0,
    topVehicle: null as VehicleStat | null,
    userCrew: null as UserCrew | null,
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
      } else {
        throw new Error(result.error || "Failed to fetch paddock data.");
      }
    } catch (error) {
      console.error("Error fetching paddock:", error);
      toast.error(error instanceof Error ? error.message : "Ошибка загрузки паддока");
    } finally {
      setLoading(false);
    }
  }, [dbUser?.user_id]);

  useEffect(() => {
    if (!isAppContextLoading && isUserAdmin) {
      fetchPaddockData();
    }
  }, [isAppContextLoading, isUserAdmin, fetchPaddockData]);

  if (isAppContextLoading) return <Loading variant="bike" text="ПРОВЕРКА ДОСТУПА В ПАДДОК..." />;

  if (!isUserAdmin) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center rounded-3xl border border-border/60 bg-card/55 p-8 text-center backdrop-blur-sm">
          <VibeContentRenderer content="::FaLock::" className="mb-4 text-7xl text-destructive" />
          <h1 className="font-orbitron text-3xl text-destructive">ДОСТУП ЗАПРЕЩЕН</h1>
          <p className="mt-2 max-w-md font-mono text-muted-foreground">
            Этот раздел доступен только владельцам транспорта. Добавьте свой первый байк или авто в Vibe Control Center,
            чтобы получить доступ.
          </p>
          <Link href="/admin">
            <Button variant="secondary" className="group mt-6">
              <VibeContentRenderer content="::FaWrench::" className="mr-3 transition-transform group-hover:rotate-12" />
              В VIBE CONTROL CENTER
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (loading) return <Loading variant="bike" text="ЗАГРУЗКА ПАДДОКА..." />;

  return (
    <div className="relative min-h-screen overflow-hidden px-4 pb-14 pt-24">
      <div className="pointer-events-none fixed inset-0 z-[-2] bg-[radial-gradient(circle_at_top,rgba(255,106,0,0.13),transparent_40%),radial-gradient(circle_at_100%_20%,rgba(71,112,255,0.15),transparent_45%)]" />

      <div className="relative mx-auto w-full max-w-6xl">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-4 py-2 text-xs text-white/90 backdrop-blur-sm">
              <VibeContentRenderer content="::FaCompassDrafting::" className="text-primary" />
              VIPBIKE OPERATOR ZONE
            </div>
            <h1 className="font-orbitron text-3xl sm:text-5xl">КОМАНДНЫЙ МОСТИК</h1>
          </div>

          <div className="flex items-center gap-3">
            {stats.userCrew && (
              <Link
                href={`/crews/${stats.userCrew.slug}`}
                className="flex items-center gap-2 rounded-full border border-border/70 bg-card/55 p-2 pr-4 backdrop-blur-sm transition-colors hover:border-primary/60"
              >
                <Image src={stats.userCrew.logo_url} alt={stats.userCrew.name} width={32} height={32} className="rounded-full" />
                <span className="font-mono text-sm">{stats.userCrew.name}</span>
              </Link>
            )}
            <Button variant="outline" onClick={() => router.push("/leaderboard")}>
              <VibeContentRenderer content="::FaTrophy::" className="mr-2" />
              Лидерборд
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
        >
          <StatCard title="Всего аренд" value={stats.totalRentals} icon="::FaKey::" tone="primary" />
          <StatCard title="Общий доход (₽)" value={stats.totalRevenue.toLocaleString()} icon="::FaCoins::" tone="accent" />
          <StatCard title="Активные аренды" value={stats.totalActive} icon="::FaHourglassHalf::" tone="success" />
          <StatCard
            title="Топ транспорт"
            value={stats.topVehicle ? `${stats.topVehicle.make} ${stats.topVehicle.model}` : "N/A"}
            icon="::FaMotorcycle::"
            tone="secondary"
          />
        </motion.div>

        <div className="space-y-6 rounded-3xl border border-border/70 bg-card/45 p-5 backdrop-blur-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-orbitron text-2xl text-accent-text">Управление автопарком ({fleet.length})</h2>
            <Link href="/admin">
              <Button variant="accent" className="font-semibold shadow-lg shadow-accent/15">
                <VibeContentRenderer content="::FaPlusCircle::" className="mr-2" />
                Добавить транспорт
              </Button>
            </Link>
          </div>
          {fleet.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-background/25 py-10 text-center text-muted-foreground">
              Ваш гараж пуст. <Link href="/admin" className="text-accent-text hover:underline">Добавьте транспорт</Link> в Vibe Control Center!
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{fleet.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}</div>
          )}
        </div>

        <Link href="/admin" className="mb-2 mt-8 inline-block text-sm font-mono text-accent-text transition-colors hover:text-accent-text/80">
          ← Назад в Vibe Control Center
        </Link>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, tone }: { title: string; value: string | number; icon: string; tone: keyof typeof statTone }) {
  const config = statTone[tone];
  return (
    <motion.div whileHover={{ y: -3 }} className={cn("rounded-2xl border bg-card/60 p-5 backdrop-blur-sm", config.ring)}>
      <div className="flex items-center gap-4">
        <VibeContentRenderer content={icon} className={cn("text-3xl", config.icon)} />
        <div>
          <h3 className="text-sm text-muted-foreground">{title}</h3>
          <p className={cn("mt-1 text-2xl font-orbitron font-bold", config.text)}>{value}</p>
        </div>
      </div>
    </motion.div>
  );
}

function VehicleCard({ vehicle }: { vehicle: VehicleStat }) {
  const isRented = vehicle.active_rentals > 0;
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/60 p-4 shadow-lg shadow-black/10 backdrop-blur-sm transition-all"
    >
      <div className="flex gap-4">
        <Image src={vehicle.image_url} alt={`${vehicle.make} ${vehicle.model}`} width={120} height={120} className="w-1/3 rounded-xl object-cover" />
        <div className="flex-1">
          <div className={cn("mb-2 inline-block rounded-full px-2 py-1 text-xs font-mono", isRented ? "bg-destructive/20 text-destructive" : "bg-emerald-500/20 text-emerald-400")}>
            {isRented ? "В АРЕНДЕ" : "СВОБОДЕН"}
          </div>
          <h3 className="font-orbitron text-xl font-semibold text-accent-text">
            {vehicle.make} {vehicle.model}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">Цена: {vehicle.daily_price} ₽/день</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center text-sm">
        <StatPill label="Всего аренд" value={vehicle.rental_count} />
        <StatPill label="Доход (₽)" value={(vehicle.total_revenue ?? 0).toLocaleString()} />
      </div>
      <Link href={`/admin?edit=${vehicle.id}`} className="w-full">
        <Button variant="outline" className="w-full border-accent/50 text-accent hover:bg-accent/10 hover:text-accent">
          <VibeContentRenderer content="::FaTools::" className="mr-2" /> Редактировать
        </Button>
      </Link>
    </motion.div>
  );
}

const StatPill = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex h-full flex-col justify-center rounded-xl border border-border/70 bg-background/35 p-2">
    <p className="font-orbitron text-lg text-accent-text">{value}</p>
    <p className="text-xs uppercase text-muted-foreground">{label}</p>
  </div>
);
