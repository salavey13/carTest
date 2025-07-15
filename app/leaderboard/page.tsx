"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { getTopFleets } from "@/app/actions";
import { Loading } from "@/components/Loading";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import Image from "next/image";

interface FleetLeader {
  owner_id: string;
  owner_name: string;
  total_revenue: number;
  car_count: number;
}

const medalColors = [
  "text-yellow-400 filter drop-shadow-[0_0_8px_#facc15]", // Gold
  "text-gray-300 filter drop-shadow-[0_0_8px_#d1d5db]", // Silver
  "text-yellow-600 filter drop-shadow-[0_0_8px_#ca8a04]", // Bronze
];

export default function LeaderboardPage() {
  const [fleets, setFleets] = useState<FleetLeader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const result = await getTopFleets();
        if (result.success && result.data) {
          setFleets(result.data);
        } else {
          toast.error(result.error || "Не удалось загрузить лидерборд.");
        }
      } catch (error) {
        toast.error("Критическая ошибка при загрузке лидерборда.");
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  if (loading) {
    return <Loading text="ЗАГРУЗКА РЕЙТИНГОВ..." />;
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 pt-24 overflow-hidden relative">
      <div className="fixed inset-0 z-[-1] opacity-20">
        <Image
          src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/21a9e79f-ab43-41dd-9603-4586fabed2cb-158b7f8c-86c6-42c8-8903-563ffcd61213.jpg"
          alt="Leaderboard Background"
          fill
          className="object-cover animate-pan-zoom"
        />
        <div className="absolute inset-0 bg-black/70"></div>
      </div>
       <motion.header 
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <VibeContentRenderer content="::FaTrophy::" className="text-7xl text-brand-yellow mx-auto mb-4 filter drop-shadow-[0_0_15px_hsl(var(--brand-yellow-rgb))]"/>
        <h1 className="text-5xl md:text-7xl font-bold font-orbitron text-transparent bg-clip-text bg-gradient-to-r from-brand-yellow to-brand-orange animate-glitch" data-text="THE GRID">
          THE GRID
        </h1>
        <p className="text-muted-foreground font-mono mt-2">Легенды Паддока. Рейтинг лучших экипажей.</p>
      </motion.header>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="max-w-4xl mx-auto space-y-4"
      >
        {fleets.map((fleet, index) => (
          <motion.div
            key={fleet.owner_id}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
            className="bg-dark-card/80 border border-border rounded-xl shadow-lg backdrop-blur-md flex items-center p-4 gap-4"
          >
            <div className={`text-4xl font-orbitron font-bold w-16 text-center ${medalColors[index] || 'text-muted-foreground'}`}>
              {index < 3 ? <VibeContentRenderer content="::FaMedal::"/> : `#${index + 1}`}
            </div>
            <div className="flex-grow">
              <h2 className="text-xl font-semibold font-orbitron text-primary-foreground">{fleet.owner_name}</h2>
              <p className="text-sm text-muted-foreground font-mono">Единиц транспорта: {fleet.car_count}</p>
            </div>
            <div className="text-right">
                <p className="text-2xl font-bold font-orbitron text-brand-yellow">{fleet.total_revenue.toLocaleString()} XTR</p>
                <p className="text-xs text-muted-foreground font-mono uppercase">Общий доход</p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}