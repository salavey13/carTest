"use client";

// MyEarningsPanel — «Мои доходы» (CREW ONLY): pay-period earnings with a
// date-range picker, the legacy monthly summary, recent commissions, and the
// owner-only «Зарплаты команды» leaderboard modal.
//
// iter31: split out of ProfileClient AND self-contained — it owns its data
// loading, so ordinary renters never fire salary API calls at all (the old
// top-level loader fetched getMyEarnings for everyone, the panel then just
// hid the result).

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, RotateCw, Users, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FranchizeOperatorPanel } from "@/app/franchize/components/FranchizeOperatorSurface";
import { formatDateRu } from "@/app/franchize/components/DateInputRu";
import { getCurrentPayPeriod } from "@/lib/salary-period";
import { getMyEarnings } from "@/app/franchize/server-actions/salary-calculations";
import { formatCurrency, itemVariants, type CrewTokens } from "./profile-shared";

type PeriodEarnings = {
  shifts: number;
  shiftIncome: number;
  commissionIncome: number;
  total: number;
  breakdown: Array<{ date: string; description: string; amount: number }>;
};

type LegacyEarnings = {
  currentPlan: { accrued: number; balanceDue: number; nextPayoutDate: string | null };
  recentCommissions: Array<{ amount: number; date: string; description: string }>;
};

type TeamEarningsRow = {
  memberId: string;
  memberName: string;
  shifts: number;
  shiftIncome: number;
  commissionIncome: number;
  total: number;
};

export function MyEarningsPanel({
  slug,
  userId,
  enabled,
  T,
}: {
  slug: string;
  userId: string;
  /** false → the panel is not rendered by the parent anyway (crew gate). */
  enabled: boolean;
  T: CrewTokens;
}) {
  // 2026-08-19 review: default to the CURRENT PAY PERIOD (10th → 25th, or
  // 25th → next 10th) instead of "first of month → today". Matches the
  // owner's actual payout cycle so the totals match what gets paid out.
  const [earningsPeriod, setEarningsPeriod] = useState(() => getCurrentPayPeriod());
  const [legacy, setLegacy] = useState<LegacyEarnings | null>(null);
  const [legacyLoading, setLegacyLoading] = useState(true);
  const [periodEarnings, setPeriodEarnings] = useState<PeriodEarnings | null>(null);
  const [periodEarningsLoading, setPeriodEarningsLoading] = useState(false);
  const [periodEarningsError, setPeriodEarningsError] = useState<string | null>(null);

  // Team earnings modal state (for owners)
  const [showTeamEarningsModal, setShowTeamEarningsModal] = useState(false);
  const [teamEarnings, setTeamEarnings] = useState<TeamEarningsRow[]>([]);
  const [teamEarningsLoading, setTeamEarningsLoading] = useState(false);
  const [teamEarningsError, setTeamEarningsError] = useState<string | null>(null);

  // Fetch earnings helper (shared between self and team)
  const fetchEarnings = useCallback(
    async (scope: "self" | "team", period: { from: string; to: string }) => {
      if (!userId) return { success: false as const, error: "Не авторизован" };

      // B4 fix (MSK boundaries): границы периода считаются по Москве, а не по
      // часовому поясу клиента. Раньше `new Date("2026-09-02")` парсился как
      // UTC-полночь, а `setHours(23,59,59,999)` ставил КОНЕЦ дня в локальном
      // поясе — клиент из UTC+10 получал окно, сдвинутое на −7 ч от МСК, и
      // смены/комиссии у границ суток падали в соседний период. Конвенция
      // приложения — MSK везде (как в my-work.ts и зарплатной модели).
      const asMskDay = (dateStr: string, endOfDay: boolean): Date | null => {
        const m = /^\d{4}-\d{2}-\d{2}$/.exec(dateStr.trim());
        if (!m) return null;
        const iso = endOfDay ? `${dateStr}T23:59:59.999+03:00` : `${dateStr}T00:00:00.000+03:00`;
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? null : d;
      };
      const fromDate = asMskDay(period.from, false);
      const toDate = asMskDay(period.to, true);
      if (!fromDate || !toDate) {
        return { success: false as const, error: "Некорректный формат даты" };
      }
      if (fromDate > toDate) {
        return { success: false as const, error: "Дата начала не может быть позже даты окончания" };
      }

      const params = new URLSearchParams({
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        scope,
        actorUserId: userId,
      });

      try {
        const res = await fetch(`/api/franchize/${slug}/earnings?${params}`);
        return await res.json();
      } catch (err) {
        console.error(`Failed to fetch ${scope} earnings:`, err);
        return {
          success: false as const,
          error: `Ошибка при загрузке ${scope === "team" ? "зарплат команды" : "дохода за период"}`,
        };
      }
    },
    [slug, userId],
  );

  const fetchPeriodEarnings = useCallback(
    async (period = earningsPeriod) => {
      setPeriodEarningsLoading(true);
      setPeriodEarningsError(null);
      const result = await fetchEarnings("self", period);
      if (result.success && result.data) {
        setPeriodEarnings(result.data);
      } else {
        setPeriodEarningsError(result.error || "Не удалось загрузить доход за период");
      }
      setPeriodEarningsLoading(false);
    },
    [earningsPeriod, fetchEarnings],
  );

  const fetchTeamEarnings = async () => {
    setTeamEarningsLoading(true);
    setTeamEarningsError(null);
    const result = await fetchEarnings("team", earningsPeriod);
    if (result.success && result.data) {
      setTeamEarnings(result.data);
      setShowTeamEarningsModal(true);
    } else {
      setTeamEarningsError(result.error || "Не удалось загрузить зарплаты команды");
    }
    setTeamEarningsLoading(false);
  };

  // Initial load: legacy monthly summary + the current pay period, once.
  useEffect(() => {
    if (!enabled || !userId) return;
    let cancelled = false;
    setLegacyLoading(true);
    getMyEarnings({ slug, actorUserId: userId })
      .then((res) => {
        if (!cancelled && res.success && res.data) setLegacy(res.data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLegacyLoading(false);
      });
    void fetchPeriodEarnings();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userId, slug]);

  return (
    <motion.div variants={itemVariants}>
      <FranchizeOperatorPanel>
        <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: T.text }}>
          <Wallet className="h-4 w-4" /> Мои доходы
        </h2>

        {/* Period selector */}
        <div className="mt-3 rounded-lg border p-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold" style={{ color: T.textMuted }}>
              📅 Период расчёта
            </p>
            <button
              onClick={() => void fetchTeamEarnings()}
              disabled={teamEarningsLoading}
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-85 disabled:opacity-50"
              style={{
                backgroundColor: "color-mix(in srgb, var(--franchize-shell-accent) 15%, transparent)",
                color: T.accent,
                border: `1px solid ${T.borderSoft}`,
              }}
            >
              {teamEarningsLoading ? (
                <>
                  <RotateCw className="h-3 w-3 animate-spin" />
                  Загрузка...
                </>
              ) : (
                <>
                  <Users className="h-3 w-3" />
                  Зарплаты команды
                </>
              )}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: T.textMuted }}>с</span>
              <input
                type="date"
                value={earningsPeriod.from}
                onChange={(e) => setEarningsPeriod((p) => ({ ...p, from: e.target.value }))}
                className="rounded border px-2 py-1 text-xs"
                style={{
                  borderColor: T.borderSoft,
                  backgroundColor: "color-mix(in srgb, var(--franchize-shell-card) 50%, transparent)",
                  color: T.text,
                }}
              />
              {/* 2026-08-19 review: unambiguous Russian-format display */}
              {earningsPeriod.from && (
                <span className="text-[10px] tabular-nums" style={{ color: T.textMuted }}>
                  ({formatDateRu(earningsPeriod.from)})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: T.textMuted }}>по</span>
              <input
                type="date"
                value={earningsPeriod.to}
                onChange={(e) => setEarningsPeriod((p) => ({ ...p, to: e.target.value }))}
                className="rounded border px-2 py-1 text-xs"
                style={{
                  borderColor: T.borderSoft,
                  backgroundColor: "color-mix(in srgb, var(--franchize-shell-card) 50%, transparent)",
                  color: T.text,
                }}
              />
              {earningsPeriod.to && (
                <span className="text-[10px] tabular-nums" style={{ color: T.textMuted }}>
                  ({formatDateRu(earningsPeriod.to)})
                </span>
              )}
            </div>
            <button
              onClick={() => void fetchPeriodEarnings()}
              disabled={periodEarningsLoading}
              className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-85 disabled:opacity-50"
              style={{
                backgroundColor: T.accent,
                color: T.accentContrast,
              }}
            >
              {periodEarningsLoading ? (
                <>
                  <RotateCw className="h-3 w-3 animate-spin" />
                  Загрузка...
                </>
              ) : (
                <>
                  <RotateCw className="h-3 w-3" />
                  Применить
                </>
              )}
            </button>
          </div>
          {/* Inline error for period */}
          {periodEarningsError && (
            <div className="mt-2 rounded px-2 py-1 text-xs" style={{ backgroundColor: "color-mix(in srgb, #ef4444 12%, transparent)", color: "#ef4444" }}>
              ⚠️ {periodEarningsError}
            </div>
          )}
        </div>

        {/* Period earnings result */}
        {periodEarnings && (
          <div className="mt-3 rounded-lg border p-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs" style={{ color: T.textMuted }}>Часы (смены)</p>
                <p className="mt-1 text-lg font-semibold" style={{ color: T.text }}>
                  {periodEarnings.shifts}ч
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: T.textMuted }}>Смены</p>
                <p className="mt-1 text-lg font-semibold" style={{ color: T.text }}>
                  {formatCurrency(periodEarnings.shiftIncome)}
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: T.textMuted }}>Комиссии</p>
                <p className="mt-1 text-lg font-semibold" style={{ color: T.text }}>
                  {formatCurrency(periodEarnings.commissionIncome)}
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: T.textMuted }}>Итого за период</p>
                <p className="mt-1 text-lg font-semibold" style={{ color: T.accent }}>
                  {formatCurrency(periodEarnings.total)}
                </p>
              </div>
            </div>
            {periodEarnings.breakdown.length > 0 && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: T.borderSoft }}>
                <p className="mb-2 text-xs font-semibold" style={{ color: T.textMuted }}>
                  Детализация (последние 10 записей)
                </p>
                <div className="space-y-1">
                  {periodEarnings.breakdown.slice(0, 10).map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded px-2 py-1 text-xs"
                      style={{ backgroundColor: "color-mix(in srgb, var(--franchize-shell-accent) 8%, transparent)" }}
                    >
                      <div className="flex-1">
                        <p style={{ color: T.text }}>{item.description}</p>
                        <p className="text-[10px]" style={{ color: T.textMuted }}>
                          {new Date(item.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <span className="font-mono font-semibold" style={{ color: T.accent }}>
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Legacy monthly earnings summary */}
        {legacyLoading ? (
          <div className="py-4 text-center text-sm" style={{ color: T.textMuted }}>
            Загрузка данных...
          </div>
        ) : legacy ? (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
                <p className="text-xs" style={{ color: T.textMuted }}>Начислено (месяц)</p>
                <p className="mt-1 text-lg font-semibold" style={{ color: T.text }}>
                  {formatCurrency(legacy.currentPlan.accrued)}
                </p>
              </div>
              <div className="rounded-lg border p-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
                <p className="text-xs" style={{ color: T.textMuted }}>К выплате</p>
                <p className="mt-1 text-lg font-semibold" style={{ color: legacy.currentPlan.balanceDue > 0 ? "#f59e0b" : "#10b981" }}>
                  {formatCurrency(legacy.currentPlan.balanceDue)}
                </p>
              </div>
              <div className="rounded-lg border p-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
                <p className="text-xs" style={{ color: T.textMuted }}>Следующая выплата</p>
                <p className="mt-1 text-lg font-semibold" style={{ color: T.text }}>
                  {legacy.currentPlan.nextPayoutDate
                    ? new Date(legacy.currentPlan.nextPayoutDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
                    : "—"}
                </p>
              </div>
            </div>

            {legacy.recentCommissions.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold" style={{ color: T.textMuted }}>
                  Последние комиссии
                </p>
                <div className="space-y-2">
                  {legacy.recentCommissions.slice(0, 5).map((comm, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                      style={{ borderColor: T.borderSoft }}
                    >
                      <div className="flex-1">
                        <p style={{ color: T.text }}>{comm.description}</p>
                        <p className="text-xs" style={{ color: T.textMuted }}>
                          {new Date(comm.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <span className="font-mono font-semibold" style={{ color: T.accent }}>
                        {formatCurrency(comm.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-4 text-center text-sm" style={{ color: T.textMuted }}>
            Нет данных о доходах
          </div>
        )}
        <TeamEarningsModal
          open={showTeamEarningsModal}
          onOpenChange={setShowTeamEarningsModal}
          period={earningsPeriod}
          rows={teamEarnings}
          loading={teamEarningsLoading}
          error={teamEarningsError}
          T={T}
        />
      </FranchizeOperatorPanel>
    </motion.div>
  );
}

// ── Team earnings modal (owner-only leaderboard) ─────────────────────────────

function TeamEarningsModal({
  open,
  onOpenChange,
  period,
  rows,
  loading,
  error,
  T,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: { from: string; to: string };
  rows: TeamEarningsRow[];
  loading: boolean;
  error: string | null;
  T: CrewTokens;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" style={{ backgroundColor: T.bgCard, borderColor: T.borderSoft }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: T.text }}>
            <Users className="h-5 w-5" style={{ color: T.accent }} />
            💰 Зарплаты команды
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Period display */}
          <div className="flex items-center gap-2 text-sm" style={{ color: T.textMuted }}>
            <Calendar className="h-4 w-4" />
            <span>
              Период: с {new Date(period.from).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}{" "}
              по {new Date(period.to).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
            </span>
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded px-3 py-2 text-sm" style={{ backgroundColor: "color-mix(in srgb, #ef4444 12%, transparent)", color: "#ef4444" }}>
              ⚠️ {error}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded" style={{ backgroundColor: "color-mix(in srgb, var(--franchize-shell-accent) 8%, transparent)" }} />
              ))}
            </div>
          )}

          {/* Leaderboard header with bonus info */}
          {!loading && rows.length > 0 && (
            <div className="rounded-lg border p-3 mb-3" style={{ borderColor: T.borderSoft, backgroundColor: "color-mix(in srgb, var(--franchize-shell-accent) 8%, transparent)" }}>
              <p className="text-xs font-semibold mb-2" style={{ color: T.text }}>
                🏆 Бонусы топ-3 лидеров
              </p>
              <div className="flex items-center gap-3 text-xs">
                <span style={{ color: T.textMuted }}>🥇 1-е место: +10%</span>
                <span style={{ color: T.textMuted }}>🥈 2-е место: +5%</span>
                <span style={{ color: T.textMuted }}>🥉 3-е место: +3%</span>
              </div>
            </div>
          )}

          {/* Team earnings table */}
          {!loading && rows.length > 0 ? (
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: T.borderSoft }}>
              {/* Responsive table with horizontal scroll on mobile */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: T.borderSoft, color: T.textMuted }}>
                      <th className="px-3 py-2 text-left text-xs font-semibold w-10">#</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold">Сотрудник</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold">Смены</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold">Комиссии</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold">Итого</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold w-16">Бонус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: T.borderSoft }}>
                    {rows
                      .slice()
                      .sort((a, b) => b.total - a.total)
                      .map((member, rank) => {
                        // Bonus calculation: 10% for 1st, 5% for 2nd, 3% for 3rd
                        const bonusPercent = rank === 0 ? 0.10 : rank === 1 ? 0.05 : rank === 2 ? 0.03 : 0;
                        const bonus = Math.round(member.total * bonusPercent);
                        const medal = rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : "";

                        return (
                          <tr
                            key={member.memberId}
                            className="hover:bg-opacity-50 transition"
                            style={{
                              backgroundColor: rank < 3
                                ? `color-mix(in srgb, var(--franchize-shell-accent) ${12 - rank * 3}%, transparent)`
                                : "color-mix(in srgb, var(--franchize-shell-accent) 4%, transparent)",
                              fontWeight: rank < 3 ? 600 : 400,
                            }}
                          >
                            <td className="px-3 py-2 text-center font-mono" style={{ color: T.textMuted }}>
                              {medal || rank + 1}
                            </td>
                            <td className="px-3 py-2 font-medium" style={{ color: T.text }}>
                              {member.memberName}
                            </td>
                            <td className="px-3 py-2 text-right font-mono" style={{ color: T.text }}>
                              {member.shifts}ч
                            </td>
                            <td className="px-3 py-2 text-right font-mono" style={{ color: T.text }}>
                              {formatCurrency(member.commissionIncome)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-semibold" style={{ color: T.accent }}>
                              {formatCurrency(member.total)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono" style={{ color: bonus > 0 ? "#10b981" : T.textMuted }}>
                              {bonus > 0 ? `+${formatCurrency(bonus)}` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-semibold" style={{ borderColor: T.borderSoft, backgroundColor: "color-mix(in srgb, var(--franchize-shell-accent) 10%, transparent)" }}>
                      <td className="px-3 py-2 text-center" style={{ color: T.textMuted }}></td>
                      <td className="px-3 py-2" style={{ color: T.text }}>Всего</td>
                      <td className="px-3 py-2 text-right font-mono" style={{ color: T.text }}>
                        {rows.reduce((sum, m) => sum + m.shifts, 0).toFixed(1)}ч
                      </td>
                      <td className="px-3 py-2 text-right font-mono" style={{ color: T.text }}>
                        {formatCurrency(rows.reduce((sum, m) => sum + m.commissionIncome, 0))}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold" style={{ color: T.accent }}>
                        {formatCurrency(rows.reduce((sum, m) => sum + m.total, 0))}
                      </td>
                      <td className="px-3 py-2 text-right font-mono" style={{ color: T.textMuted }}>
                        —
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : !loading ? (
            <div className="py-8 text-center text-sm" style={{ color: T.textMuted }}>
              Нет данных о зарплатах за выбранный период
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
