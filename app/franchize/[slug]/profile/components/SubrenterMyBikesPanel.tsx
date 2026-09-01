"use client";

// SubrenterMyBikesPanel — the partner's own profile panel: «Мои байки в парке».
// Shows the bikes he handed to the crew (clickable → bike story wall), his
// monthly 50% cut with a month switcher, and recent rentals of his bikes.
//
// iter31 enhancements:
//  • per-bike earnings breakdown for the selected month (multi-bike partners
//    see WHICH bike earned what, each row links to the bike story);
//  • rental rows show equipment share + a live-status dot, spill note
//    «и ещё N аренд» when the month had more than we list;
//  • fallback icon tile when a bike has no photo.

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Bike, ChevronRight, Wallet } from "lucide-react";
import { FranchizeOperatorPanel } from "@/app/franchize/components/FranchizeOperatorSurface";
import { MonthPickerBar } from "@/app/franchize/components/FranchizeMonthPicker";
import {
  getSubrenterMonthlyEarningsAction,
  type SubrenterOwnedBikesData,
} from "@/app/franchize/server-actions/subrenter-monitoring";
import type { SubrenterMonthSummary } from "@/app/franchize/lib/subrenter-economics";
import {
  formatCurrency,
  isLiveRentalStatus,
  itemVariants,
  rentalStatusLabel,
  type CrewTokens,
  type SpaNavigate,
} from "./profile-shared";

const RENTALS_SHOWN = 6;

export function SubrenterMyBikesPanel({
  owned,
  month,
  onMonthChange,
  slug,
  userId,
  T,
  navigateSpa,
}: {
  owned: SubrenterOwnedBikesData;
  month: string;
  onMonthChange: (next: string) => void;
  slug: string;
  userId: string;
  T: CrewTokens;
  navigateSpa: SpaNavigate;
}) {
  // iter31: the panel owns its monthly earnings fetch — runs on mount and
  // whenever the partner switches the month. Failures are silent (the panel
  // keeps the previous data).
  const [earnings, setEarnings] = useState<SubrenterMonthSummary | null>(null);
  const [earningsLoading, setEarningsLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setEarningsLoading(true);
    getSubrenterMonthlyEarningsAction({ slug, userId, month })
      .then((res) => {
        if (!cancelled && res.success && res.data) setEarnings(res.data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setEarningsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, userId, month]);

  // iter31: per-bike cut breakdown for the selected month (only meaningful
  // when the partner owns more than one bike).
  const byBike = useMemo(() => {
    const m = new Map<string, { bikeId: string; label: string; cut: number; count: number }>();
    for (const r of earnings?.rentals ?? []) {
      const prev = m.get(r.bikeId) ?? { bikeId: r.bikeId, label: r.bikeLabel, cut: 0, count: 0 };
      prev.cut += r.cutRub;
      prev.count += 1;
      m.set(r.bikeId, prev);
    }
    return Array.from(m.values()).sort((a, b) => b.cut - a.cut);
  }, [earnings]);

  const shownRentals = earnings?.rentals.slice(0, RENTALS_SHOWN) ?? [];
  const spilledRentals = Math.max(0, (earnings?.rentalCount ?? 0) - shownRentals.length);

  return (
    <motion.div variants={itemVariants}>
      <FranchizeOperatorPanel>
        <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: T.text }}>
          <Bike className="h-4 w-4" /> Мои байки в парке
        </h2>
        <p className="mt-1 text-xs" style={{ color: T.textMuted }}>
          Аренды байков, которые вы передали экипажу — вы видите их статус
          в реальном времени. Нажмите на байк, чтобы открыть его историю:
          аренды, сервис, пробег.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {owned.bikes.map((bike) => (
            <Link
              key={bike.bikeId}
              href={`/franchize/${slug}/bikes/${bike.bikeId}`}
              className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={T.styles.card}
            >
              {bike.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bike.imageUrl}
                  alt={bike.label}
                  className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <span
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: T.bgElevated, color: T.textMuted }}
                >
                  <Bike className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <span className="block truncate font-semibold" style={{ color: T.text }}>
                  {bike.label}
                </span>
                <span className="mt-0.5 block text-[11px]" style={{ color: T.textMuted }}>
                  Аренд всего: {bike.totalRentals}
                  {bike.activeRentals > 0 && (
                    <span className="ml-1 font-semibold" style={{ color: T.accent }}>
                      · сейчас в аренде: {bike.activeRentals}
                    </span>
                  )}
                </span>
              </div>
              <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: T.textMuted }} />
            </Link>
          ))}
        </div>

        {/* Monthly earnings with month switcher — the partner's payback
            bookkeeping (his 50% cut of the bike part; equipment is crew
            money and never split). */}
        <div className="mt-4 rounded-xl border p-3" style={T.styles.card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: T.textMuted }}>
              <Wallet className="h-3.5 w-3.5" /> Заработок за месяц
            </p>
            <MonthPickerBar
              value={month}
              onChange={onMonthChange}
              accent={T.accent}
              accentContrast={T.accentContrast}
              bgCard={T.bgCard}
              bgElevated={T.bgElevated}
              border={T.borderSoft}
              text={T.text}
              textMuted={T.textMuted}
            />
          </div>

          {earningsLoading ? (
            <p className="mt-3 animate-pulse text-sm" style={{ color: T.textMuted }}>
              Считаем…
            </p>
          ) : earnings ? (
            <>
              <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
                <span className="text-2xl font-bold tabular-nums" style={{ color: T.accent }}>
                  {formatCurrency(earnings.cutRub)}
                </span>
                <span className="text-[11px]" style={{ color: T.textMuted }}>
                  ваша доля · 50% от аренды байков {formatCurrency(earnings.bikePartRub)}
                  {earnings.equipmentRub > 0 && (
                    <> · экипировка {formatCurrency(earnings.equipmentRub)} (не делится)</>
                  )}
                </span>
              </div>
              <p className="mt-1 text-[11px]" style={{ color: T.textMuted }}>
                Аренд за месяц: {earnings.rentalCount} · Суммарно оплачено:{" "}
                {formatCurrency(earnings.totalRub)} · Экипировка целиком остаётся экипажу.
              </p>

              {/* iter31: per-bike breakdown — which bike earned what this month. */}
              {byBike.length > 1 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.textMuted }}>
                    По байкам за месяц
                  </p>
                  {byBike.map((b) => (
                    <Link
                      key={b.bikeId}
                      href={`/franchize/${slug}/bikes/${b.bikeId}`}
                      className="flex items-center justify-between gap-2 rounded-lg border p-2 text-xs transition hover:shadow-md"
                      style={T.styles.card}
                      title="Открыть историю байка"
                    >
                      <span className="min-w-0 truncate font-medium" style={{ color: T.text }}>
                        {b.label}
                        <span className="ml-1.5 font-normal" style={{ color: T.textMuted }}>
                          {b.count} аренд
                        </span>
                      </span>
                      <span className="whitespace-nowrap font-bold tabular-nums" style={{ color: T.accent }}>
                        +{formatCurrency(b.cut)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {earnings.rentals.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {shownRentals.map((r) => (
                    <div
                      key={r.rentalId}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigateSpa(r.docLink || `/franchize/${slug}/rental/${r.rentalId}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigateSpa(r.docLink || `/franchize/${slug}/rental/${r.rentalId}`);
                        }
                      }}
                      className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border p-2 text-xs transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={T.styles.card}
                    >
                      <span className="min-w-0 truncate font-medium" style={{ color: T.text }}>
                        {isLiveRentalStatus(r.status) && (
                          <span
                            className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                            style={{ backgroundColor: "#22c55e" }}
                            title="Аренда идёт"
                          />
                        )}
                        {r.bikeLabel}
                        {r.startedAt && (
                          <span className="ml-1.5 font-normal" style={{ color: T.textMuted }}>
                            {new Date(r.startedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                          </span>
                        )}
                        {r.equipmentRub > 0 && (
                          <span className="ml-1.5 font-normal" style={{ color: T.textMuted }}>
                            · экип. {formatCurrency(r.equipmentRub)}
                          </span>
                        )}
                      </span>
                      <span className="whitespace-nowrap font-bold tabular-nums" style={{ color: T.accent }}>
                        +{formatCurrency(r.cutRub)}
                      </span>
                    </div>
                  ))}
                  {spilledRentals > 0 && (
                    <p className="px-1 text-[11px]" style={{ color: T.textMuted }}>
                      и ещё {spilledRentals} за месяц — полная история на странице каждого байка
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm" style={{ color: T.textMuted }}>
              Нет данных за этот месяц.
            </p>
          )}
        </div>

        {owned.rentals.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold" style={{ color: T.textMuted }}>
              Последние аренды моих байков
            </p>
            <div className="space-y-2">
              {owned.rentals.slice(0, 5).map((r) => (
                <div
                  key={r.rentalId}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigateSpa(r.docLink)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigateSpa(r.docLink);
                    }
                  }}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border p-3 text-sm transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={T.styles.card}
                >
                  <div className="min-w-0">
                    <span className="font-semibold" style={{ color: T.text }}>
                      {r.bikeLabel}
                    </span>
                    {r.agreedStartDate && r.agreedEndDate && (
                      <p className="mt-0.5 text-[11px]" style={{ color: T.textMuted }}>
                        {new Date(r.agreedStartDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                        {" → "}
                        {new Date(r.agreedEndDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                      </p>
                    )}
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] whitespace-nowrap"
                    style={{ ...T.styles.accentPill, opacity: isLiveRentalStatus(r.status) ? 1 : 0.6 }}
                  >
                    {rentalStatusLabel(r.status)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </FranchizeOperatorPanel>
    </motion.div>
  );
}
