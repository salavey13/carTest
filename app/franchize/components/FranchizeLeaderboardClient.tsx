"use client";

// /app/franchize/components/FranchizeLeaderboardClient.tsx

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Users, Zap, MapPin, ChevronRight, TrendingUp, Award, Filter, Calendar } from "lucide-react";
import type { FranchizeCrewVM } from "../actions";
import { crewPaletteForSurface, withAlpha } from "../lib/theme";
import { useResolvedPalette } from "../lib/useResolvedPalette";

// ── Data layer (would be fetched from API in production) ──
const FAKE_TOP_RIDERS = [
  { id: "r1", name: "КотБайкер", rides: 142, kmTotal: 4820, avgSpeed: 38, streak: 12, avatar: "🏍️" },
  { id: "r2", name: "ElectraRider", rides: 119, kmTotal: 3950, avgSpeed: 42, streak: 8, avatar: "⚡" },
  { id: "r3", name: "НочнойСтранник", rides: 97, kmTotal: 3210, avgSpeed: 35, streak: 15, avatar: "🌙" },
  { id: "r4", name: "SlyRacer13", rides: 88, kmTotal: 2940, avgSpeed: 44, streak: 6, avatar: "🏁" },
  { id: "r5", name: "ВетерДорог", rides: 76, kmTotal: 2510, avgSpeed: 31, streak: 9, avatar: "💨" },
  { id: "r6", name: "TurboMax", rides: 64, kmTotal: 2180, avgSpeed: 39, streak: 4, avatar: "🔥" },
  { id: "r7", name: "SteelHorse", rides: 58, kmTotal: 1920, avgSpeed: 33, streak: 7, avatar: "🐎" },
  { id: "r8", name: "NightWolf", rides: 52, kmTotal: 1680, avgSpeed: 36, streak: 5, avatar: "🐺" },
];

const FAKE_ALL_TIME = [
  { id: "a1", name: "Легенда76", rides: 892, kmTotal: 28450, avgSpeed: 40, streak: 45, avatar: "👑" },
  { id: "a2", name: "MileageKing", rides: 756, kmTotal: 31200, avgSpeed: 35, streak: 38, avatar: "📏" },
  { id: "r1", name: "КотБайкер", rides: 142, kmTotal: 4820, avgSpeed: 38, streak: 12, avatar: "🏍️" },
];

const FAKE_SEASON = {
  name: "Весенний заезд 2026",
  daysLeft: 18,
  totalRiders: 234,
  totalKm: 128_450,
  topPrize: "Скидка 30% на следующий сезон + эксклюзивный шлем",
};

const SEASONS = [
  { id: "current", name: "Весенний заезд 2026", label: "Текущий сезон" },
  { id: "alltime", name: "Все времена", label: "Всё время" },
];

const SORT_OPTIONS = [
  { id: "rides", name: "По выездам", icon: "🏍️" },
  { id: "km", name: "По пробегу", icon: "📍" },
  { id: "speed", name: "По скорости", icon: "⚡" },
  { id: "streak", name: "По серии", icon: "🔥" },
];

interface FranchizeLeaderboardClientProps {
  crew: FranchizeCrewVM;
  slug: string;
}

// Loading skeleton component
function LeaderboardSkeleton() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6">
      <div className="mb-6 h-32 animate-pulse rounded-2xl bg-white/5" />
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
      <div className="mt-6 h-96 animate-pulse rounded-2xl bg-white/5" />
    </section>
  );
}

export function FranchizeLeaderboardClient({ crew, slug }: FranchizeLeaderboardClientProps) {
  const [selectedSeason, setSelectedSeason] = useState("current");
  const [sortBy, setSortBy] = useState("rides");
  const [isLoading, setIsLoading] = useState(false);

  const palette = useResolvedPalette(crew.theme);
  const surface = useMemo(() => crewPaletteForSurface(crew.theme), [crew.theme]);
  const brandName = crew.header.brandName || crew.name || "VIP BIKE";

  // Sort riders based on selected criteria
  const sortedRiders = useMemo(() => {
    const riders = selectedSeason === "current" ? FAKE_TOP_RIDERS : FAKE_ALL_TIME;
    const key = sortBy as keyof typeof riders[0];
    return [...riders].sort((a, b) => (b[key] as number) - (a[key] as number));
  }, [selectedSeason, sortBy]);

  const season = selectedSeason === "current" ? FAKE_SEASON : {
    name: "Все времена",
    daysLeft: null,
    totalRiders: 1247,
    totalKm: 892_450,
    topPrize: "Вечная слава в зале славы экипажа",
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  if (isLoading) {
    return <LeaderboardSkeleton />;
  }

  return (
    <section
      className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6"
      style={{
        ["--lb-accent" as string]: palette.accentMain,
        ["--lb-border" as string]: palette.borderSoft,
        ["--lb-text" as string]: palette.textPrimary,
        ["--lb-muted" as string]: palette.textSecondary,
        ["--lb-card" as string]: palette.bgCard,
        ["--lb-base" as string]: palette.bgBase,
      }}
    >
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-center"
      >
        <div
          className="mb-3 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium backdrop-blur"
          style={{
            borderColor: withAlpha(palette.accentMain, 0.27),
            backgroundColor: withAlpha(palette.accentMain, 0.09),
            color: palette.accentMain,
          }}
        >
          <Trophy className="h-3.5 w-3.5" />
          {brandName.toUpperCase()} · LEADERBOARD
        </div>
        <h1 className="font-orbitron text-3xl sm:text-4xl" style={{ color: palette.textPrimary }}>
          Зал славы экипажа
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm" style={surface.mutedText}>
          Рейтинг самых активных райдеров {brandName}. Сезонный заезд, живая статистика и награды за выносливость.
        </p>
      </motion.div>

      {/* ── Season selector & filters ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex gap-2">
          {SEASONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSeason(s.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                selectedSeason === s.id
                  ? "shadow-lg"
                  : "opacity-60 hover:opacity-80"
              )}
              style={{
                backgroundColor: selectedSeason === s.id
                  ? palette.accentMain
                  : withAlpha(palette.accentMain, 0.12),
                color: selectedSeason === s.id
                  ? palette.bgBase
                  : palette.accentMain,
              }}
            >
              <Calendar className="mr-1 inline h-3 w-3" />
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSortBy(opt.id)}
              className={cn(
                "rounded-full px-2 py-1 text-xs transition-all",
                sortBy === opt.id
                  ? "shadow-md"
                  : "opacity-50 hover:opacity-80"
              )}
              style={{
                backgroundColor: sortBy === opt.id
                  ? withAlpha(palette.accentMain, 0.15)
                  : "transparent",
                color: sortBy === opt.id
                  ? palette.accentMain
                  : palette.textSecondary,
                border: sortBy === opt.id
                  ? `1px solid ${withAlpha(palette.accentMain, 0.3)}`
                  : undefined,
              }}
              title={`Сортировать: ${opt.name}`}
            >
              <span className="mr-1">{opt.icon}</span>
              <span className="hidden sm:inline">{opt.name}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Season banner ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mb-6 overflow-hidden rounded-3xl border p-4 backdrop-blur-xl sm:p-5"
        style={{
          ...surface.card,
          background: `linear-gradient(135deg, ${withAlpha(palette.bgCard, 0.88)}, ${withAlpha(palette.accentMain, 0.08)})`,
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" style={{ color: palette.accentMain }} />
              <span className="text-sm font-semibold" style={{ color: palette.textPrimary }}>
                {season.name}
              </span>
            </div>
            <p className="mt-1 text-xs" style={surface.mutedText}>
              {season.topPrize}
            </p>
          </div>
          <div className="flex gap-4 text-center">
            {season.daysLeft !== null && (
              <>
                <div>
                  <p className="font-orbitron text-xl font-bold" style={{ color: palette.accentMain }}>
                    {season.daysLeft}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider" style={surface.mutedText}>Дней</p>
                </div>
                <div className="w-px" style={{ backgroundColor: palette.borderSoft }} />
              </>
            )}
            <div>
              <p className="font-orbitron text-xl font-bold" style={{ color: palette.textPrimary }}>
                {season.totalRiders}
              </p>
              <p className="text-[10px] uppercase tracking-wider" style={surface.mutedText}>Райдеров</p>
            </div>
            <div className="w-px" style={{ backgroundColor: palette.borderSoft }} />
            <div>
              <p className="font-orbitron text-xl font-bold" style={{ color: palette.textPrimary }}>
                {(season.totalKm / 1000).toFixed(0)}k
              </p>
              <p className="text-[10px] uppercase tracking-wider" style={surface.mutedText}>Км</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Stats row ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="mb-6 grid grid-cols-3 gap-3"
      >
        <StatCard
          icon={<Trophy className="h-4 w-4" style={{ color: palette.accentMain }} />}
          label="В заезде"
          value={season.totalRiders}
          surface={surface}
          accentColor={palette.accentMain}
        />
        <StatCard
          icon={<MapPin className="h-4 w-4" style={{ color: palette.accentMain }} />}
          label="Общий пробег"
          value={`${season.totalKm.toLocaleString("ru-RU")} км`}
          surface={surface}
          accentColor={palette.accentMain}
        />
        <StatCard
          icon={<Users className="h-4 w-4" style={{ color: palette.accentMain }} />}
          label="Активны сегодня"
          value={47}
          surface={surface}
          accentColor={palette.accentMain}
        />
      </motion.div>

      {/* ── Top 3 podium ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="mb-6 grid grid-cols-3 gap-2 sm:gap-4"
      >
        {sortedRiders.slice(0, 3).map((rider, index) => {
          const podiumOrder = [1, 0, 2]; // Silver, Gold, Bronze layout
          const place = podiumOrder[index] + 1;
          const isGold = place === 1;
          const medals = ["🥇", "🥈", "🥉"];
          const medalColors = [palette.accentMain, "#C0C0C0", "#CD7F32"];

          return (
            <motion.div
              key={rider.id}
              variants={itemVariants}
              whileHover={{ scale: 1.05 }}
              className={`relative flex flex-col items-center rounded-2xl border p-3 text-center backdrop-blur sm:p-4 ${
                isGold ? "sm:-mt-3 shadow-xl" : "shadow-md"
              }`}
              style={{
                ...surface.card,
                borderColor: isGold
                  ? withAlpha(palette.accentMain, 0.4)
                  : withAlpha(palette.borderSoft, 0.5),
                boxShadow: isGold
                  ? `0 0 40px ${withAlpha(palette.accentMain, 0.2)}`
                  : undefined,
                background: isGold
                  ? `linear-gradient(135deg, ${withAlpha(palette.accentMain, 0.15)}, ${withAlpha(palette.bgCard, 0.8)})`
                  : undefined,
              }}
            >
              {/* Medal */}
              <div className="relative">
                <span className="text-3xl drop-shadow-lg">{medals[place - 1]}</span>
                {isGold && (
                  <div className="absolute -inset-2 animate-ping rounded-full opacity-20"
                    style={{ backgroundColor: palette.accentMain }}
                  />
                )}
              </div>

              {/* Avatar */}
              <div
                className="my-3 flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-md sm:h-16 sm:w-16 sm:text-3xl"
                style={{
                  borderColor: isGold ? palette.accentMain : palette.borderSoft,
                  backgroundColor: isGold
                    ? withAlpha(palette.accentMain, 0.2)
                    : palette.bgBase,
                  color: palette.textPrimary,
                  borderWidth: "2px",
                }}
              >
                {rider.avatar}
              </div>

              {/* Name */}
              <p className="w-full truncate px-2 text-sm font-semibold text-[var(--lb-text)]">
                {rider.name}
              </p>

              {/* Score based on sort */}
              <p className="mt-1 font-orbitron text-lg font-bold" style={{ color: palette.accentMain }}>
                {sortBy === "rides" ? rider.rides :
                 sortBy === "km" ? `${(rider.kmTotal / 1000).toFixed(1)}k` :
                 sortBy === "speed" ? `${rider.avgSpeed} км/ч` :
                 rider.streak}
              </p>
              <p className="text-[10px] uppercase tracking-wider" style={surface.mutedText}>
                {sortBy === "rides" ? "выездов" :
                 sortBy === "km" ? "пробег" :
                 sortBy === "speed" ? "скорость" :
                 "серия"}
              </p>

              {/* Trend indicator */}
              {place <= 3 && (
                <div className="mt-2 flex items-center gap-1 text-[10px]"
                  style={{ color: withAlpha(palette.accentMain, 0.8) }}
                >
                  <TrendingUp className="h-3 w-3" />
                  <span>Top 3</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </motion.div>

      {/* ── Full leaderboard list ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border p-4 backdrop-blur sm:p-5"
        style={surface.card}
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 font-orbitron text-lg" style={{ color: palette.textPrimary }}>
            <Trophy className="h-4 w-4" style={{ color: palette.accentMain }} />
            Полный рейтинг
          </h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
              style={{
                backgroundColor: withAlpha(palette.accentMain, 0.09),
                color: palette.accentMain,
                border: `1px solid ${withAlpha(palette.accentMain, 0.2)}`,
              }}
            >
              {selectedSeason === "current" ? "Сезон активен" : "Вечный рейтинг"}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {sortedRiders.map((rider, index) => (
              <motion.div
                key={`${rider.id}-${sortBy}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.03 }}
                whileHover={{ x: 4 }}
                className="flex items-center gap-3 rounded-2xl border p-3 transition-all duration-200"
                style={{
                  ...surface.subtleCard,
                  borderColor: index < 3
                    ? withAlpha(palette.accentMain, 0.2)
                    : undefined,
                  backgroundColor: index < 3
                    ? withAlpha(palette.accentMain, 0.03)
                    : undefined,
                }}
              >
                {/* Rank badge */}
                <div className="relative">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                    style={{
                      backgroundColor: index < 3
                        ? withAlpha(palette.accentMain, 0.2)
                        : palette.bgBase,
                      color: index < 3
                        ? palette.accentMain
                        : palette.textSecondary,
                    }}
                  >
                    {index + 1}
                  </span>
                  {index < 3 && (
                    <div className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full text-[8px]"
                      style={{ backgroundColor: palette.accentMain }}
                    >
                      {["🥇", "🥈", "🥉"][index]}
                    </div>
                  )}
                </div>

                {/* Avatar */}
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-lg shadow-sm"
                  style={{
                    borderColor: palette.borderSoft,
                    backgroundColor: palette.bgBase,
                    color: palette.textPrimary,
                  }}
                >
                  {rider.avatar}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" style={{ color: palette.textPrimary }}>
                    {rider.name}
                  </p>
                  <div className="flex items-center gap-3 text-[11px]" style={surface.mutedText}>
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" /> {rider.rides} выездов
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {rider.kmTotal.toLocaleString("ru-RU")} км
                    </span>
                  </div>
                </div>

                {/* Stats (desktop) */}
                <div className="hidden items-center gap-4 sm:flex">
                  <div className="text-right">
                    <p className="font-mono text-sm font-bold" style={{ color: palette.accentMain }}>
                      {rider.avgSpeed} км/ч
                    </p>
                    <p className="text-[10px]" style={surface.mutedText}>Ср. скорость</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-bold" style={{ color: palette.textPrimary }}>
                      {rider.streak} дн.
                    </p>
                    <p className="text-[10px]" style={surface.mutedText}>Серия</p>
                  </div>
                </div>

                <ChevronRight className="h-4 w-4 shrink-0 opacity-30" style={{ color: palette.textSecondary }} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 overflow-hidden rounded-2xl border border-dashed p-4 text-center"
          style={{
            borderColor: withAlpha(palette.accentMain, 0.27),
            backgroundColor: withAlpha(palette.accentMain, 0.04),
          }}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <Award className="h-4 w-4" style={{ color: palette.accentMain }} />
            <p className="text-sm font-medium" style={{ color: palette.textPrimary }}>
              Хочешь попасть в рейтинг?
            </p>
          </div>
          <p className="mt-1 text-xs" style={surface.mutedText}>
            Совершай поездки, делись геопозицией и соревнуйся с райдерами экипажа
          </p>
          <Link
            href={`/franchize/${slug}/map-riders`}
            className="mt-3 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition hover:scale-105 active:scale-95"
            style={{
              backgroundColor: palette.accentMain,
              color: palette.bgBase,
              boxShadow: `0 4px 14px ${withAlpha(palette.accentMain, 0.4)}`,
            }}
          >
            <MapPin className="h-4 w-4" />
            Начать заезд
          </Link>
        </motion.div>
      </motion.div>

      {/* ── Coming soon sections ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <FadedTeaser
          title="Еженедельные челленджи"
          description="Каждую неделю — новая миссия: пробег 100 км, ночной заезд, маршрут по новым точкам. Выполняй и получай бонусные баллы."
          icon="🎯"
          surface={surface}
          accentColor={palette.accentMain}
        />
        <FadedTeaser
          title="Достижения и бейджи"
          description="Разблокируй достижения за мастерство: «Ночной волк», «Марафонец», «Первый в экипаже». Собери коллекцию."
          icon="🏅"
          surface={surface}
          accentColor={palette.accentMain}
        />
      </motion.div>
    </section>
  );
}

// ── Sub-components ──

function StatCard({
  icon,
  label,
  value,
  surface,
  accentColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  surface: ReturnType<typeof crewPaletteForSurface>;
  accentColor: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-2xl border p-3 backdrop-blur-sm transition-shadow"
      style={{
        ...surface.subtleCard,
        borderColor: withAlpha(accentColor, 0.13),
      }}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-xs" style={surface.mutedText}>
        {icon}
        {label}
      </div>
      <p className="font-orbitron text-xl font-bold" style={{ color: accentColor }}>
        {value}
      </p>
    </motion.div>
  );
}

function FadedTeaser({
  title,
  description,
  icon,
  surface,
  accentColor,
}: {
  title: string;
  description: string;
  icon: string;
  surface: ReturnType<typeof crewPaletteForSurface>;
  accentColor: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4 transition-opacity hover:opacity-70"
      style={{
        ...surface.card,
        borderColor: withAlpha(accentColor, 0.13),
      }}
    >
      {/* "Coming soon" overlay */}
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
        <span
          className="rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-widest"
          style={{
            borderColor: withAlpha(accentColor, 0.33),
            backgroundColor: withAlpha(accentColor, 0.09),
            color: accentColor,
          }}
        >
          Скоро
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <p className="text-sm font-semibold" style={{ color: surface.card.color as string }}>
          {title}
        </p>
      </div>
      <p className="mt-1 text-xs leading-relaxed" style={surface.mutedText}>
        {description}
      </p>
    </div>
  );
}

// ── Utility ──
function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}
