"use client";

// /app/franchize/components/FranchizeLeaderboardClient.tsx

import { useMemo } from "react";
import Link from "next/link";
import { Trophy, Users, Zap, MapPin, ChevronRight } from "lucide-react";
import type { FranchizeCrewVM } from "../actions";
import { crewPaletteForSurface } from "../lib/theme";

// ── Fake data for fakedoor ──
const FAKE_TOP_RIDERS = [
  { id: "r1", name: "КотБайкер", rides: 142, kmTotal: 4820, avgSpeed: 38, streak: 12 },
  { id: "r2", name: "ElectraRider", rides: 119, kmTotal: 3950, avgSpeed: 42, streak: 8 },
  { id: "r3", name: "НочнойСтранник", rides: 97, kmTotal: 3210, avgSpeed: 35, streak: 15 },
  { id: "r4", name: "SlyRacer13", rides: 88, kmTotal: 2940, avgSpeed: 44, streak: 6 },
  { id: "r5", name: "ВетерДорог", rides: 76, kmTotal: 2510, avgSpeed: 31, streak: 9 },
  { id: "r6", name: "TurboMax", rides: 64, kmTotal: 2180, avgSpeed: 39, streak: 4 },
];

const FAKE_SEASON = {
  name: "Весенний заезд 2026",
  daysLeft: 18,
  totalRiders: 234,
  totalKm: 128_450,
  topPrize: "Скидка 30% на следующий сезон + эксклюзивный шлем",
};

interface FranchizeLeaderboardClientProps {
  crew: FranchizeCrewVM;
  slug: string;
}

export function FranchizeLeaderboardClient({ crew, slug }: FranchizeLeaderboardClientProps) {
  const surface = useMemo(() => crewPaletteForSurface(crew.theme), [crew.theme]);
  const brandName = crew.header.brandName || crew.name || "VIP BIKE";

  return (
    <section
      className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6"
      style={{
        ["--lb-accent" as string]: crew.theme.palette.accentMain,
        ["--lb-border" as string]: crew.theme.palette.borderSoft,
        ["--lb-text" as string]: crew.theme.palette.textPrimary,
        ["--lb-muted" as string]: crew.theme.palette.textSecondary,
        ["--lb-card" as string]: crew.theme.palette.bgCard,
        ["--lb-base" as string]: crew.theme.palette.bgBase,
      }}
    >
      {/* ── Header ── */}
      <div className="mb-6 text-center">
        <div
          className="mb-3 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium backdrop-blur"
          style={{
            borderColor: `${crew.theme.palette.accentMain}44`,
            backgroundColor: `${crew.theme.palette.accentMain}18`,
            color: crew.theme.palette.accentMain,
          }}
        >
          <Trophy className="h-3.5 w-3.5" />
          {brandName.toUpperCase()} · LEADERBOARD
        </div>
        <h1 className="font-orbitron text-3xl sm:text-4xl" style={{ color: crew.theme.palette.textPrimary }}>
          Зал славы экипажа
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm" style={surface.mutedText}>
          Рейтинг самых активных райдеров {brandName}. Сезонный заезд, живая статистика и награды за выносливость.
        </p>
      </div>

      {/* ── Season banner ── */}
      <div
        className="mb-6 rounded-3xl border p-4 backdrop-blur-xl sm:p-5"
        style={{
          ...surface.card,
          background: `linear-gradient(135deg, ${crew.theme.palette.bgCard}E0, ${crew.theme.palette.accentMain}15)`,
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" style={{ color: crew.theme.palette.accentMain }} />
              <span className="text-sm font-semibold" style={{ color: crew.theme.palette.textPrimary }}>
                {FAKE_SEASON.name}
              </span>
            </div>
            <p className="mt-1 text-xs" style={surface.mutedText}>
              {FAKE_SEASON.topPrize}
            </p>
          </div>
          <div className="flex gap-4 text-center">
            <div>
              <p className="font-orbitron text-xl font-bold" style={{ color: crew.theme.palette.accentMain }}>
                {FAKE_SEASON.daysLeft}
              </p>
              <p className="text-[10px] uppercase tracking-wider" style={surface.mutedText}>Дней</p>
            </div>
            <div className="w-px" style={{ backgroundColor: crew.theme.palette.borderSoft }} />
            <div>
              <p className="font-orbitron text-xl font-bold" style={{ color: crew.theme.palette.textPrimary }}>
                {FAKE_SEASON.totalRiders}
              </p>
              <p className="text-[10px] uppercase tracking-wider" style={surface.mutedText}>Райдеров</p>
            </div>
            <div className="w-px" style={{ backgroundColor: crew.theme.palette.borderSoft }} />
            <div>
              <p className="font-orbitron text-xl font-bold" style={{ color: crew.theme.palette.textPrimary }}>
                {(FAKE_SEASON.totalKm / 1000).toFixed(0)}k
              </p>
              <p className="text-[10px] uppercase tracking-wider" style={surface.mutedText}>Км</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard
          icon={<Trophy className="h-4 w-4" style={{ color: crew.theme.palette.accentMain }} />}
          label="В заезде"
          value={FAKE_SEASON.totalRiders}
          surface={surface}
          accentColor={crew.theme.palette.accentMain}
        />
        <StatCard
          icon={<MapPin className="h-4 w-4" style={{ color: crew.theme.palette.accentMain }} />}
          label="Общий пробег"
          value={`${FAKE_SEASON.totalKm.toLocaleString("ru-RU")} км`}
          surface={surface}
          accentColor={crew.theme.palette.accentMain}
        />
        <StatCard
          icon={<Users className="h-4 w-4" style={{ color: crew.theme.palette.accentMain }} />}
          label="Активны сегодня"
          value={47}
          surface={surface}
          accentColor={crew.theme.palette.accentMain}
        />
      </div>

      {/* ── Top 3 podium ── */}
      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
        {FAKE_TOP_RIDERS.slice(0, 3).map((rider, index) => {
          const podiumOrder = [1, 0, 2]; // Silver, Gold, Bronze layout
          const place = podiumOrder[index] + 1;
          const isGold = place === 1;
          const medals = ["🥇", "🥈", "🥉"];
          return (
            <div
              key={rider.id}
              className={`flex flex-col items-center rounded-2xl border p-3 text-center backdrop-blur sm:p-4 ${
                isGold ? "sm:-mt-3" : ""
              }`}
              style={{
                ...surface.card,
                borderColor: isGold ? `${crew.theme.palette.accentMain}66` : undefined,
                boxShadow: isGold ? `0 0 24px ${crew.theme.palette.accentMain}20` : undefined,
              }}
            >
              <span className="text-2xl">{medals[place - 1]}</span>
              <div
                className="my-2 flex h-12 w-12 items-center justify-center rounded-full border-2 text-lg font-bold sm:h-14 sm:w-14"
                style={{
                  borderColor: isGold ? crew.theme.palette.accentMain : crew.theme.palette.borderSoft,
                  backgroundColor: isGold ? `${crew.theme.palette.accentMain}20` : crew.theme.palette.bgBase,
                  color: crew.theme.palette.textPrimary,
                }}
              >
                {rider.name.charAt(0)}
              </div>
              <p className="w-full truncate text-sm font-semibold" style={{ color: crew.theme.palette.textPrimary }}>
                {rider.name}
              </p>
              <p className="font-orbitron text-lg font-bold" style={{ color: crew.theme.palette.accentMain }}>
                {rider.rides}
              </p>
              <p className="text-[10px] uppercase tracking-wider" style={surface.mutedText}>
                выездов
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Full leaderboard list ── */}
      <div
        className="rounded-3xl border p-4 backdrop-blur sm:p-5"
        style={surface.card}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-orbitron text-lg" style={{ color: crew.theme.palette.textPrimary }}>
            <Trophy className="h-4 w-4" style={{ color: crew.theme.palette.accentMain }} />
            Полный рейтинг
          </h2>
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
            style={{
              backgroundColor: `${crew.theme.palette.accentMain}18`,
              color: crew.theme.palette.accentMain,
              border: `1px solid ${crew.theme.palette.accentMain}33`,
            }}
          >
            Сезон активен
          </span>
        </div>

        <div className="space-y-2">
          {FAKE_TOP_RIDERS.map((rider, index) => (
            <div
              key={rider.id}
              className="flex items-center gap-3 rounded-2xl border p-3 transition-all duration-200 hover:border-[var(--lb-accent)]/40"
              style={{
                ...surface.subtleCard,
                borderColor: index < 3 ? `${crew.theme.palette.accentMain}33` : undefined,
              }}
            >
              {/* Rank */}
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{
                  backgroundColor: index < 3 ? `${crew.theme.palette.accentMain}20` : crew.theme.palette.bgBase,
                  color: index < 3 ? crew.theme.palette.accentMain : crew.theme.palette.textSecondary,
                }}
              >
                {index + 1}
              </span>

              {/* Avatar placeholder */}
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold"
                style={{
                  borderColor: crew.theme.palette.borderSoft,
                  backgroundColor: crew.theme.palette.bgBase,
                  color: crew.theme.palette.textPrimary,
                }}
              >
                {rider.name.charAt(0)}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" style={{ color: crew.theme.palette.textPrimary }}>
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
                  <p className="font-mono text-sm font-bold" style={{ color: crew.theme.palette.accentMain }}>
                    {rider.avgSpeed} км/ч
                  </p>
                  <p className="text-[10px]" style={surface.mutedText}>Ср. скорость</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold" style={{ color: crew.theme.palette.textPrimary }}>
                    {rider.streak} дн.
                  </p>
                  <p className="text-[10px]" style={surface.mutedText}>Серия</p>
                </div>
              </div>

              <ChevronRight className="h-4 w-4 shrink-0 opacity-30" style={{ color: crew.theme.palette.textSecondary }} />
            </div>
          ))}
        </div>

        {/* Fakedoor CTA */}
        <div
          className="mt-4 rounded-2xl border border-dashed p-4 text-center"
          style={{
            borderColor: `${crew.theme.palette.accentMain}44`,
            backgroundColor: `${crew.theme.palette.accentMain}08`,
          }}
        >
          <p className="text-sm font-medium" style={{ color: crew.theme.palette.textPrimary }}>
            Хочешь попасть в рейтинг?
          </p>
          <p className="mt-1 text-xs" style={surface.mutedText}>
            Совершай поездки, делись геопозицией и соревнуйся с райдерами экипажа
          </p>
          <Link
            href={`/franchize/${slug}/map-riders`}
            className="mt-3 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition hover:brightness-110 active:scale-[0.98]"
            style={{
              backgroundColor: crew.theme.palette.accentMain,
              color: "#16130A",
            }}
          >
            <MapPin className="h-4 w-4" />
            Начать заезд
          </Link>
        </div>
      </div>

      {/* ── Faded "coming soon" sections ── */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FadedTeaser
          title="Еженедельные челленджи"
          description="Каждую неделю — новая миссия: пробег 100 км, ночной заезд, маршрут по новым точкам. Выполняй и получай бонусные баллы."
          icon="🎯"
          surface={surface}
          accentColor={crew.theme.palette.accentMain}
        />
        <FadedTeaser
          title="Достижения и бейджи"
          description="Разблокируй достижения за мастерство: «Ночной волк», «Марафонец», «Первый в экипаже». Собери коллекцию."
          icon="🏅"
          surface={surface}
          accentColor={crew.theme.palette.accentMain}
        />
      </div>
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
    <div
      className="rounded-2xl border p-3 backdrop-blur-sm"
      style={{
        ...surface.subtleCard,
        borderColor: `${accentColor}22`,
      }}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-xs" style={surface.mutedText}>
        {icon}
        {label}
      </div>
      <p className="font-orbitron text-xl font-bold" style={{ color: accentColor }}>
        {value}
      </p>
    </div>
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
      className="relative overflow-hidden rounded-2xl border p-4 opacity-60"
      style={{
        ...surface.card,
        borderColor: `${accentColor}22`,
      }}
    >
      {/* "Coming soon" overlay */}
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
        <span
          className="rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-widest"
          style={{
            borderColor: `${accentColor}55`,
            backgroundColor: `${accentColor}15`,
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
