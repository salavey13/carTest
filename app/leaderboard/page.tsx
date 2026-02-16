"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaBug } from "react-icons/fa6";

import { getTopFleets, getTopCrews } from "@/app/rentals/actions";
import { Loading } from "@/components/Loading";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";

type DebugInfo = {
  [key: string]: string | number;
};

type Fleet = {
  owner_id: string;
  username: string;
  avatar_url: string;
  total_vehicles: number;
  total_revenue: number;
  debug_info?: DebugInfo;
};

type Crew = {
  crew_id: string;
  crew_name: string;
  slug: string;
  logo_url: string;
  owner_username: string;
  owner_avatar_url: string;
  total_members: number;
  total_fleet_value: number;
  debug_info?: DebugInfo;
};

const trophyColors = ["text-brand-yellow", "text-zinc-300", "text-amber-700"];

export default function LeaderboardPage() {
  const [topFleets, setTopFleets] = useState<Fleet[]>([]);
  const [topCrews, setTopCrews] = useState<Crew[]>([]);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  useEffect(() => {
    async function loadLeaderboards() {
      setLoading(true);
      const [fleetsResult, crewsResult] = await Promise.all([getTopFleets(), getTopCrews()]);

      let combinedDebug: DebugInfo = {};

      if (fleetsResult.success && fleetsResult.data?.length) {
        setTopFleets(fleetsResult.data);
        if (fleetsResult.data[0].debug_info) {
          combinedDebug = { ...combinedDebug, ...fleetsResult.data[0].debug_info };
        }
      }
      if (crewsResult.success && crewsResult.data?.length) {
        setTopCrews(crewsResult.data);
        if (crewsResult.data[0].debug_info) {
          combinedDebug = { ...combinedDebug, ...crewsResult.data[0].debug_info };
        }
      }

      if (Object.keys(combinedDebug).length > 0) {
        setDebugInfo(combinedDebug);
      }

      setLoading(false);
    }
    loadLeaderboards();
  }, []);

  if (loading) {
    return <Loading variant="bike" text="ЗАГРУЗКА РЕЙТИНГОВ..." />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-4 pb-16 pt-24 text-foreground">
      <div className="pointer-events-none fixed inset-0 z-[-2] bg-[radial-gradient(circle_at_top,rgba(255,106,0,0.15),transparent_40%),radial-gradient(circle_at_85%_0%,rgba(90,80,255,0.16),transparent_42%)]" />
      <div className="pointer-events-none fixed inset-0 z-[-3] opacity-25">
        <Image
          src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/21a9e79f-ab43-41dd-9603-4586fabed2cb-158b7f8c-86c6-42c8-8903-563ffcd61213.jpg"
          alt="Leaderboard Background"
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-background/80" />
      </div>

      <div className="mx-auto w-full max-w-6xl space-y-8">
        <motion.div initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-4 py-2 text-xs font-medium text-white/90 backdrop-blur">
            <VibeContentRenderer content="::FaTrophy::" className="text-brand-yellow" />
            VIPBIKE RENTAL LEADERBOARD
          </div>
          <h1 className="font-orbitron text-4xl sm:text-5xl">ЗАЛ СЛАВЫ</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Рейтинг активных экипажей и владельцев транспорта с живыми показателями и прозрачной статистикой.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <LeaderboardStat title="Экипажи в топе" value={topCrews.length} icon="::FaUsers::" />
          <LeaderboardStat title="Флоты в топе" value={topFleets.length} icon="::FaMotorcycle::" />
          <LeaderboardStat
            title="Лучший доход"
            value={topFleets[0] ? `${topFleets[0].total_revenue.toLocaleString()} XTR` : "—"}
            icon="::FaCoins::"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <LeaderboardSection title="Топ Экипажи" icon="::FaUsers::" actionLink="/crews" actionText="Все экипажи">
            {topCrews.length > 0 ? (
              topCrews.map((crew, index) => (
                <Link href={`/crews/${crew.slug}`} key={crew.crew_id} className="block w-full">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.08 }}
                    className="flex items-center gap-4 rounded-xl border border-border/70 bg-card/60 p-3 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/55 hover:bg-card/80"
                  >
                    <span className={`w-8 text-center text-2xl font-bold ${trophyColors[index] || "text-muted-foreground"}`}>{index + 1}</span>
                    <Image src={crew.logo_url || "/placeholder.svg"} alt={crew.crew_name} width={48} height={48} className="rounded-full border border-white/20 bg-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-accent-text">{crew.crew_name ?? "N/A"}</p>
                      <p className="text-xs text-muted-foreground">@{crew.owner_username ?? "N/A"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-bold text-accent">{(crew.total_fleet_value ?? 0).toLocaleString()} XTR</p>
                      <p className="text-xs text-muted-foreground">{(crew.total_members ?? 0)} участников</p>
                    </div>
                  </motion.div>
                </Link>
              ))
            ) : (
              <p className="col-span-full text-center text-muted-foreground">Нет данных</p>
            )}
            <Link href="/crews/create" className="mt-2 block w-full rounded-xl border border-dashed border-primary/50 bg-primary/10 px-4 py-3 text-center font-mono text-sm text-primary transition-colors hover:bg-primary/15">
              + Создать экипаж
            </Link>
          </LeaderboardSection>

          <LeaderboardSection title="Топ Владельцы" icon="::FaUserShield::" actionLink="/paddock" actionText="Мой паддок">
            {topFleets.length > 0 ? (
              topFleets.map((fleet, index) => (
                <motion.div
                  key={fleet.owner_id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className="flex items-center gap-4 rounded-xl border border-border/70 bg-card/60 p-3 backdrop-blur"
                >
                  <span className={`w-8 text-center text-2xl font-bold ${trophyColors[index] || "text-muted-foreground"}`}>{index + 1}</span>
                  <Image src={fleet.avatar_url || "/placeholder.svg"} alt={fleet.username || "avatar"} width={48} height={48} className="rounded-full border border-white/20 bg-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-accent-text">@{fleet.username ?? "N/A"}</p>
                    <p className="text-xs text-muted-foreground">{(fleet.total_vehicles ?? 0)} ед. транспорта</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-bold text-accent">{(fleet.total_revenue ?? 0).toLocaleString()} XTR</p>
                    <p className="text-xs text-muted-foreground">Доход</p>
                  </div>
                </motion.div>
              ))
            ) : (
              <p className="col-span-full text-center text-muted-foreground">Нет данных</p>
            )}
          </LeaderboardSection>
        </div>

        {debugInfo && <DebugInfoSection info={debugInfo} />}
      </div>
    </div>
  );
}

const LeaderboardStat = ({ title, value, icon }: { title: string; value: string | number; icon: string }) => (
  <div className="rounded-2xl border border-border/70 bg-card/55 p-4 backdrop-blur-sm">
    <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
      <VibeContentRenderer content={icon} className="text-primary" />
      {title}
    </div>
    <p className="font-orbitron text-2xl text-foreground">{value}</p>
  </div>
);

const LeaderboardSection = ({
  title,
  icon,
  children,
  actionLink,
  actionText,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  actionLink?: string;
  actionText?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45 }}
    className="rounded-2xl border border-border/70 bg-card/55 p-5 shadow-xl shadow-black/15 backdrop-blur"
  >
    <div className="mb-5 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-3 font-orbitron text-2xl text-foreground">
        <VibeContentRenderer content={icon} className="text-primary" /> {title}
      </h2>
      {actionLink && actionText && (
        <Link href={actionLink} className="text-xs font-mono text-primary hover:underline">
          {actionText} →
        </Link>
      )}
    </div>
    <div className="space-y-3">{children}</div>
  </motion.div>
);

const statMetadata: { [key: string]: { title: string; icon: string } } = {
  users_count: { title: "Всего пользователей", icon: "::FaUsers::" },
  cars_count: { title: "Всего машин", icon: "::FaCar::" },
  rentals_count: { title: "Всего аренд", icon: "::FaKey::" },
  rentals_fully_paid_count: { title: "Оплаченные аренды", icon: "::FaMoneyBillWave::" },
  users_with_cars_count: { title: "Владельцы", icon: "::FaUserCheck::" },
  crews_count: { title: "Всего экипажей", icon: "::FaUsersGear::" },
  cars_with_crew_count: { title: "Авто в экипажах", icon: "::FaSquareParking::" },
  crew_members_count: { title: "Участники экипажей", icon: "::FaUserGroup::" },
  crews_with_cars_count: { title: "Активные экипажи", icon: "::FaToolbox::" },
  crew_engagement: { title: "Вовлеченность", icon: "::FaFire::" },
};

const DebugInfoSection = ({ info }: { info: DebugInfo }) => {
  const augmentedInfo = { ...info };
  const crewsCount = Number(info.crews_count || 0);
  const crewMembersCount = Number(info.crew_members_count || 0);
  const carsWithCrewCount = Number(info.cars_with_crew_count || 0);

  if (crewsCount > 0) {
    const engagement = (crewMembersCount + carsWithCrewCount) / crewsCount;
    augmentedInfo.crew_engagement = engagement.toFixed(2);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="mt-10"
    >
      <div className="rounded-2xl border border-border/70 bg-card/40 p-5 backdrop-blur-sm">
        <div className="mb-4 flex items-center gap-2 font-orbitron text-lg text-accent">
          <FaBug />
          <span>СИСТЕМНАЯ ТЕЛЕМЕТРИЯ</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Object.entries(augmentedInfo).map(([key, value]) => {
            const meta = statMetadata[key] || { title: key.replace(/_/g, " "), icon: "::FaQuestionCircle::" };
            return (
              <motion.div
                key={key}
                whileHover={{ y: -4 }}
                className="rounded-xl border border-border/70 bg-card/60 p-3 text-center transition-all duration-300 hover:border-primary/50"
              >
                <VibeContentRenderer content={meta.icon} className="mb-2 text-3xl text-accent-text" />
                <span className="font-orbitron text-2xl font-bold text-foreground">{Number(value).toLocaleString()}</span>
                <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{meta.title}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};
