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
import { Calendar, RotateCw, Send, Users, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FranchizeOperatorPanel } from "@/app/franchize/components/FranchizeOperatorSurface";
import { formatDateRu } from "@/app/franchize/components/DateInputRu";
import { getCurrentPayPeriod } from "@/lib/salary-period";
import { getMyEarnings, getMyPayoutHistory } from "@/app/franchize/server-actions/salary-calculations";
// Task 77: the salary report as a TG file — the same delivery channel the
// subrenter weekly reports use (docx → sendTelegramDocument).
import { sendSalaryReportTelegramAction } from "@/app/franchize/server-actions/salary-report";
// Task 101: manual «verified» stamp for the owner (backfill of closed rentals).
import { adminVerifyRentalAction } from "@/app/franchize/server-actions/rental-verify-actions";
// Task 107: verified-payout counters (✅ к выплате / ⏳ не сверено / 🏦 выплачено)
// — the same buckets the Telegram payout hub (/payouts) shows. The hub is the
// write surface (mark paid out); the web strip is read-only truth.
import { getMyPayoutSummaryAction } from "@/app/franchize/server-actions/rental-payout-actions";
import { buildStartLink } from "@/app/franchize/lib/onboarding/payload-parser";
import { formatCurrency, itemVariants, type CrewTokens } from "./profile-shared";

type PeriodEarnings = {
  shifts: number;
  shiftIncome: number;
  commissionIncome: number;
  total: number;
  breakdown: Array<{ date: string; description: string; amount: number }>;
  // Task 98: per-rental / per-sale TL;DR rows (category-model crews) —
  // the rentals twin of the shifts list, with equipment flags and the ₽ split.
  commissionItems?: {
    rentals: Array<{
      rentalId: string;
      dateIso: string | null;
      bikeName: string;
      totalCost: number;
      amount: number;
      base: number;
      equipment: number;
      overprice: number;
      equipmentUnits: number;
      equipmentFlags: string;
      source: string;
      createdByLabel: string;
      handedByLabel: string;
      returnedByLabel: string;
      // Task 101: operator+owner verification state (null = no data yet).
      verificationStatus?: "pending" | "operator_confirmed" | "owner_confirmed" | "verified" | "disputed" | null;
      // Task 106: the numbers were corrected by an accepted negotiation deal.
      verificationAdjusted?: boolean;
      // Task 102: rentals.status — manual verify button renders for completed only.
      status?: string;
    }>;
    sales: Array<{
      saleId: string;
      dateIso: string | null;
      amount: number;
      base: number;
      overprice: number;
      source: string;
      createdByLabel: string;
    }>;
  };
};

type LegacyEarnings = {
  currentPlan: { accrued: number; balanceDue: number; nextPayoutDate: string | null };
  recentCommissions: Array<{ amount: number; date: string; description: string }>;
};

// Task 107: verified-payout buckets (operator-commission money).
type PayoutSummaryView = {
  toPay: { sum: number; count: number };
  unverified: { sum: number; count: number };
  paid: { sum: number; count: number };
  payoutColumnMissing: boolean;
};

/** Deep link into the Telegram payout hub (mark / convert happens there). */
const PAYOUT_TG_LINK = buildStartLink("payout");

// iter32: the member's own payout ledger — «когда и сколько выплачено».
type PayoutHistory = {
  payouts: Array<{ id: string; amount: number; date: string; description: string; paymentMethod: string | null }>;
  paidThisMonth: number;
};

type TeamEarningsRow = {
  memberId: string;
  memberName: string;
  // Task 100: Telegram full name for the muted secondary line (may be null).
  memberFullName?: string | null;
  shifts: number;
  shiftIncome: number;
  commissionIncome: number;
  total: number;
};

export function MyEarningsPanel({
  slug,
  userId,
  enabled,
  teamSalariesVisible = true,
  T,
}: {
  slug: string;
  userId: string;
  /** false → the panel is not rendered by the parent anyway (crew gate). */
  enabled: boolean;
  /**
   * task99: «Зарплаты команды» is an owner-tier surface (owner/co_owner/admin).
   * Parent passes the probe role verdict; when false the button is not
   * rendered so ordinary members never hit the server-side rejection toast.
   * Server action stays the source of truth either way.
   */
  teamSalariesVisible?: boolean;
  T: CrewTokens;
}) {
  // 2026-08-19 review: default to the CURRENT PAY PERIOD (10th → 25th, or
  // 25th → next 10th) instead of "first of month → today". Matches the
  // owner's actual payout cycle so the totals match what gets paid out.
  const [earningsPeriod, setEarningsPeriod] = useState(() => getCurrentPayPeriod());
  const [legacy, setLegacy] = useState<LegacyEarnings | null>(null);
  const [legacyLoading, setLegacyLoading] = useState(true);
  // iter32: payout history (cash_transactions expense_salary → me)
  const [payoutHistory, setPayoutHistory] = useState<PayoutHistory | null>(null);
  const [periodEarnings, setPeriodEarnings] = useState<PeriodEarnings | null>(null);
  const [periodEarningsLoading, setPeriodEarningsLoading] = useState(false);
  const [periodEarningsError, setPeriodEarningsError] = useState<string | null>(null);
  // Task 101: optimistic per-rental verify stamps (admin tap-to-verify).
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());
  const [verifiedOverrides, setVerifiedOverrides] = useState<Record<string, true>>({});

  // Task 107: verified-payout counters for this member (operator-commission
  // money inside THIS crew). Hidden until at least one сверка carries money —
  // pre-feature crews see zero new UI (the task-101 lesson).
  const [payoutSummary, setPayoutSummary] = useState<PayoutSummaryView | null>(null);

  // Task 77: TG salary report delivery state (self-service — the action
  // enforces owner-or-self server-side; here it is always self).
  const [tgReportState, setTgReportState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [tgReportError, setTgReportError] = useState<string | null>(null);

  // Task 101: owner stamps «verified» on a closed rental after an offline
  // double-check (mainly the backfill of rentals closed BEFORE the Telegram
  // verification flow shipped). Optimistic UI — the server action stays the
  // source of truth and is gated owner/co_owner/admin server-side.
  // Task 102: failures are no longer silent — a short inline error flag is
  // shown in place of the button (money surface: the boss must KNOW that a
  // confirm did not land, not stare at an unchanged badge).
  const [verifyErrorIds, setVerifyErrorIds] = useState<Set<string>>(new Set());
  const handleManualVerify = useCallback(
    async (rentalId: string) => {
      if (verifyingIds.has(rentalId)) return;
      setVerifyingIds((prev) => new Set(prev).add(rentalId));
      setVerifyErrorIds((prev) => {
        if (!prev.has(rentalId)) return prev;
        const next = new Set(prev);
        next.delete(rentalId);
        return next;
      });
      try {
        const res = await adminVerifyRentalAction({ slug, rentalId });
        if (res.success) {
          setVerifiedOverrides((prev) => ({ ...prev, [rentalId]: true }));
        } else {
          setVerifyErrorIds((prev) => new Set(prev).add(rentalId));
        }
      } catch {
        setVerifyErrorIds((prev) => new Set(prev).add(rentalId));
      } finally {
        setVerifyingIds((prev) => {
          const next = new Set(prev);
          next.delete(rentalId);
          return next;
        });
      }
    },
    [slug, verifyingIds],
  );

  const handleSendTgReport = async () => {
    if (!userId || tgReportState === "sending") return;
    setTgReportState("sending");
    setTgReportError(null);
    try {
      const result = await sendSalaryReportTelegramAction({
        slug,
        memberId: userId,
        from: earningsPeriod.from,
        to: earningsPeriod.to,
      });
      if (result.success && result.sentToMember) {
        setTgReportState("sent");
      } else {
        setTgReportState("error");
        setTgReportError(result.error || "Telegram не принял файл — попробуй ещё раз");
      }
    } catch (err) {
      console.error("Failed to send salary report to TG:", err);
      setTgReportState("error");
      setTgReportError("Не удалось отправить отчёт");
    }
  };

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
    // iter32: same-bar payout visibility — the member sees the actual
    // payouts, not only accruals (the subrenter got the same in his panel).
    getMyPayoutHistory({ slug, actorUserId: userId })
      .then((res) => {
        if (!cancelled && res.success && res.data) setPayoutHistory(res.data);
      })
      .catch(() => undefined);
    // Task 107: payout counters degrade silently (no сверка data → strip hidden).
    getMyPayoutSummaryAction({ slug })
      .then((res) => {
        if (!cancelled && res.success && res.data) setPayoutSummary(res.data);
      })
      .catch(() => undefined);
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

        {/* Task 107: verified-payout counters — live money truth from the
            verification flow. Hidden until at least one сверка exists, and
            hidden for pre-feature crews (payoutColumnMissing degrades to
            unpaid defaults, so the strip stays correct either way). */}
        {payoutSummary &&
         payoutSummary.toPay.count + payoutSummary.unverified.count + payoutSummary.paid.count > 0 ? (
          <div className="mt-3 rounded-lg border p-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold" style={{ color: T.textMuted }}>
                💰 Выплаты по сверкам
                {payoutSummary.payoutColumnMissing ? " (выплата отмечается в Telegram)" : ""}
              </p>
              <a
                href={PAYOUT_TG_LINK}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-85"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--franchize-shell-accent) 15%, transparent)",
                  color: T.accent,
                  border: `1px solid ${T.borderSoft}`,
                }}
              >
                <Send className="h-3 w-3" />
                Хаб выплат
              </a>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border p-2" style={{ borderColor: T.borderSoft }}>
                <p className="text-[10px]" style={{ color: T.textMuted }}>✅ К выплате</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: T.text }}>
                  {formatCurrency(payoutSummary.toPay.sum)}
                </p>
                <p className="text-[10px]" style={{ color: T.textMuted }}>{payoutSummary.toPay.count} ар.</p>
              </div>
              <div className="rounded-md border p-2" style={{ borderColor: T.borderSoft }}>
                <p className="text-[10px]" style={{ color: T.textMuted }}>⏳ Не сверено</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: T.text }}>
                  {formatCurrency(payoutSummary.unverified.sum)}
                </p>
                <p className="text-[10px]" style={{ color: T.textMuted }}>{payoutSummary.unverified.count} ар.</p>
              </div>
              <div className="rounded-md border p-2" style={{ borderColor: T.borderSoft }}>
                <p className="text-[10px]" style={{ color: T.textMuted }}>🏦 Выплачено</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: T.text }}>
                  {formatCurrency(payoutSummary.paid.sum)}
                </p>
                <p className="text-[10px]" style={{ color: T.textMuted }}>{payoutSummary.paid.count} ар.</p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Period selector */}
        <div className="mt-3 rounded-lg border p-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold" style={{ color: T.textMuted }}>
              📅 Период расчёта
            </p>
            {teamSalariesVisible ? (
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
            ) : null}
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
            {/* Task 77: salary report as a TG file — same channel as the
                subrenter reports. Uses the period selected above. */}
            <button
              onClick={() => void handleSendTgReport()}
              disabled={tgReportState === "sending"}
              className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-85 disabled:opacity-50"
              style={{
                border: `1px solid ${T.borderSoft}`,
                backgroundColor:
                  tgReportState === "sent"
                    ? "color-mix(in srgb, #22c55e 15%, transparent)"
                    : "color-mix(in srgb, var(--franchize-shell-accent) 12%, transparent)",
                color: tgReportState === "sent" ? "#22c55e" : T.accent,
              }}
            >
              {tgReportState === "sending" ? (
                <>
                  <RotateCw className="h-3 w-3 animate-spin" />
                  Отправляю...
                </>
              ) : tgReportState === "sent" ? (
                <>✓ В Telegram</>
              ) : (
                <>
                  <Send className="h-3 w-3" />
                  Отчёт в Telegram
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
          {/* Inline error for TG report */}
          {tgReportState === "error" && tgReportError && (
            <div className="mt-2 rounded px-2 py-1 text-xs" style={{ backgroundColor: "color-mix(in srgb, #ef4444 12%, transparent)", color: "#ef4444" }}>
              ⚠️ {tgReportError}
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
                {/* Task 100: this KPI shows MONEY for shifts, not a count —
                    the old label «Смены» read as a number of shifts. */}
                <p className="text-xs" style={{ color: T.textMuted }}>За смены</p>
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

            {/* Task 98: TL;DR rentals list — the same picture the shifts list
                gives, but for rental bonuses: every credited rental with its
                equipment flags, attribution source, operator roles and the
                ₽ split (техника · экип · наценка), so «итого» is auditable. */}
            {/* Task 100: the section is ALWAYS rendered for category-model
                crews (commissionItems present) — with a clear empty state when
                the period has no credited rentals. Previously it vanished for
                members with 0 rentals, so the feature looked missing (boss:
                «are you sure there is table for rentals in salary part?»). */}
            {periodEarnings.commissionItems && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: T.borderSoft }}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="min-w-0 text-xs font-semibold" style={{ color: T.textMuted }}>
                    🛵 Аренды с моими бонусами — {periodEarnings.commissionItems.rentals.length}
                  </p>
                  <span className="shrink-0 font-mono text-xs font-semibold" style={{ color: T.accent }}>
                    +{formatCurrency(periodEarnings.commissionItems.rentals.reduce((s, r) => s + r.amount, 0))}
                  </span>
                </div>
                {/* Task 101: verification tally — how much of the period is
                    already confirmed by operator+owner (Telegram ✅ / manual
                    owner stamp). null statuses (feature off / old rentals
                    without a row) are shown as «нет данных», not «ждёт». */}
                {periodEarnings.commissionItems.rentals.length > 0 && (() => {
                  const withStatus = periodEarnings.commissionItems.rentals.filter(
                    (r) => r.verificationStatus != null || verifiedOverrides[r.rentalId],
                  );
                  const verified = withStatus.filter(
                    (r) => r.verificationStatus === "verified" || verifiedOverrides[r.rentalId],
                  ).length;
                  const waiting = withStatus.filter(
                    (r) =>
                      r.verificationStatus !== "verified" &&
                      r.verificationStatus !== "disputed" &&
                      !verifiedOverrides[r.rentalId],
                  ).length;
                  const disputed = withStatus.filter((r) => r.verificationStatus === "disputed").length;
                  if (withStatus.length === 0) return null;
                  return (
                    <p className="mb-2 text-[10px]" style={{ color: T.textMuted }}>
                      🤝 Сверка: <span style={{ color: "#22c55e" }}>{verified} подтверждено</span>
                      {waiting > 0 ? <span> · {waiting} ожидает</span> : null}
                      {disputed > 0 ? <span style={{ color: "#ef4444" }}> · {disputed} спор</span> : null}
                    </p>
                  );
                })()}
                {periodEarnings.commissionItems.rentals.length === 0 ? (
                  <p
                    className="rounded px-2 py-2 text-xs"
                    style={{ color: T.textMuted, backgroundColor: "color-mix(in srgb, var(--franchize-shell-accent) 8%, transparent)" }}
                  >
                    В выбранном периоде аренд с моими бонусами нет — бонусы за аренды
                    начисляются оператору (/doc, выдача или возврат).
                  </p>
                ) : (
                <div className="space-y-1.5">
                  {periodEarnings.commissionItems.rentals.map((r) => (
                    <div
                      key={r.rentalId}
                      className="rounded px-2 py-1.5 text-xs"
                      style={{ backgroundColor: "color-mix(in srgb, var(--franchize-shell-accent) 8%, transparent)" }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium" style={{ color: T.text }}>
                            {r.dateIso
                              ? new Date(r.dateIso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Europe/Moscow" })
                              : "—"}{" "}
                            · {r.bikeName || "аренда"}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1">
                            {r.equipmentFlags && (
                              <span
                                className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                                style={{ backgroundColor: "color-mix(in srgb, #0ea5e9 15%, transparent)", color: "#0ea5e9" }}
                              >
                                🪖 {r.equipmentFlags} +{formatCurrency(r.equipment)}
                              </span>
                            )}
                            {r.overprice > 0 && (
                              <span
                                className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                                style={{ backgroundColor: "color-mix(in srgb, #f59e0b 15%, transparent)", color: "#f59e0b" }}
                              >
                                ⬆ наценка +{formatCurrency(r.overprice)}
                              </span>
                            )}
                            <span
                              className="rounded px-1.5 py-0.5 text-[10px]"
                              style={{
                                backgroundColor: "color-mix(in srgb, var(--franchize-shell-accent) 12%, transparent)",
                                color: T.textMuted,
                              }}
                            >
                              {r.source === "doc_command" ? "/doc" : r.source === "handout" ? "выдача" : r.source === "return" ? "возврат" : r.source === "shift" ? "смена" : "—"}
                            </span>
                            {/* Task 101: verification badge — money sensitive, so
                                the wording stays soft and exact. For the owner
                                tier an inline tap verifies on the spot (old
                                rentals / offline reconciliation backfill). */}
                            {(r.verificationStatus || verifiedOverrides[r.rentalId]) &&
                              (r.verificationStatus === "verified" || verifiedOverrides[r.rentalId] ? (
                                <span
                                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                                  style={{ backgroundColor: "color-mix(in srgb, #22c55e 15%, transparent)", color: "#22c55e" }}
                                  title={r.verificationAdjusted ? "Числа скорректированы по согласованному предложению" : undefined}
                                >
                                  {r.verificationAdjusted ? "✅ скорректировано" : "✅ подтверждено"}
                                </span>
                              ) : r.verificationStatus === "disputed" ? (
                                <span
                                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                                  style={{ backgroundColor: "color-mix(in srgb, #ef4444 15%, transparent)", color: "#ef4444" }}
                                >
                                  ⚠️ спор
                                </span>
                              ) : (
                                <span
                                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                                  style={{ backgroundColor: "color-mix(in srgb, #f59e0b 15%, transparent)", color: "#f59e0b" }}
                                >
                                  ⏳ {r.verificationStatus === "operator_confirmed" ? "ждёт владельца" : r.verificationStatus === "owner_confirmed" ? "ждёт оператора" : "ожидает"}
                                </span>
                              ))}
                            {!r.verificationStatus && !verifiedOverrides[r.rentalId] && teamSalariesVisible && (
                              r.status === "completed" ? (
                                verifyErrorIds.has(r.rentalId) ? (
                                  <span
                                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                                    style={{ backgroundColor: "color-mix(in srgb, #ef4444 15%, transparent)", color: "#ef4444" }}
                                    title="Не удалось сохранить подтверждение — попробуйте ещё раз"
                                  >
                                    ✕ не сохранилось
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleManualVerify(r.rentalId)}
                                    disabled={verifyingIds.has(r.rentalId)}
                                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold transition disabled:opacity-50"
                                    style={{ backgroundColor: "color-mix(in srgb, #22c55e 12%, transparent)", color: "#22c55e" }}
                                    title="Подтвердить расчёт вручную (после личной сверки)"
                                  >
                                    {verifyingIds.has(r.rentalId) ? "…" : "✓ подтвердить"}
                                  </button>
                                )
                              ) : (
                                <span
                                  className="rounded px-1.5 py-0.5 text-[10px]"
                                  style={{ backgroundColor: "color-mix(in srgb, var(--franchize-shell-accent) 12%, transparent)", color: T.textMuted }}
                                  title="Сверка появится после закрытия аренды"
                                >
                                  ⏳ в аренде
                                </span>
                              )
                            )}
                          </div>
                          {(r.createdByLabel || r.handedByLabel || r.returnedByLabel) && (
                            <p className="mt-0.5 truncate text-[10px]" style={{ color: T.textMuted }}>
                              {[r.createdByLabel ? `создал ${r.createdByLabel}` : "", r.handedByLabel ? `выдал ${r.handedByLabel}` : "", r.returnedByLabel ? `принял ${r.returnedByLabel}` : ""]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="font-mono font-semibold" style={{ color: T.accent }}>
                            +{formatCurrency(r.amount)}
                          </span>
                          <p className="text-[10px]" style={{ color: T.textMuted }}>
                            техника {formatCurrency(r.base)}
                            {r.equipment > 0 ? ` · экип ${formatCurrency(r.equipment)}` : ""}
                            {r.overprice > 0 ? ` · нац. ${formatCurrency(r.overprice)}` : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>
            )}

            {/* Task 98: TL;DR sales list — same treatment for sale bonuses.
                Task 100: always visible (empty state) for the same reason. */}
            {periodEarnings.commissionItems && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: T.borderSoft }}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="min-w-0 text-xs font-semibold" style={{ color: T.textMuted }}>
                    💰 Продажи с моими бонусами — {periodEarnings.commissionItems.sales.length}
                  </p>
                  <span className="shrink-0 font-mono text-xs font-semibold" style={{ color: T.accent }}>
                    +{formatCurrency(periodEarnings.commissionItems.sales.reduce((s, r) => s + r.amount, 0))}
                  </span>
                </div>
                {periodEarnings.commissionItems.sales.length === 0 ? (
                  <p
                    className="rounded px-2 py-2 text-xs"
                    style={{ color: T.textMuted, backgroundColor: "color-mix(in srgb, var(--franchize-shell-accent) 8%, transparent)" }}
                  >
                    В выбранном периоде продаж с моими бонусами нет — бонусы за продажи
                    начисляются оператору (/doc).
                  </p>
                ) : (
                <div className="space-y-1.5">
                  {periodEarnings.commissionItems.sales.map((s) => (
                    <div
                      key={s.saleId}
                      className="flex items-start justify-between gap-2 rounded px-2 py-1.5 text-xs"
                      style={{ backgroundColor: "color-mix(in srgb, var(--franchize-shell-accent) 8%, transparent)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium" style={{ color: T.text }}>
                          {s.dateIso
                            ? new Date(s.dateIso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Europe/Moscow" })
                            : "—"}{" "}
                          · продажа
                        </p>
                        <p className="mt-0.5 truncate text-[10px]" style={{ color: T.textMuted }}>
                          {s.source === "doc_command" ? "/doc" : s.source === "shift" ? "смена" : "—"}
                          {s.createdByLabel ? ` · создал ${s.createdByLabel}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="font-mono font-semibold" style={{ color: T.accent }}>
                          +{formatCurrency(s.amount)}
                        </span>
                        <p className="text-[10px]" style={{ color: T.textMuted }}>
                          база {formatCurrency(s.base)}
                          {s.overprice > 0 ? ` · нац. ${formatCurrency(s.overprice)}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                )}
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

            {/* iter32: payout history — the member sees the actual salary
                payouts from the formal ledger (cash_transactions,
                expense_salary, to_user_id = him), not only accruals. Same
                visibility bar the subrenter payout panel now has. */}
            {payoutHistory && payoutHistory.payouts.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold" style={{ color: T.textMuted }}>
                    История выплат
                  </p>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor:
                        payoutHistory.paidThisMonth > 0 ? "#22c55e15" : T.bgElevated,
                      color: payoutHistory.paidThisMonth > 0 ? "#22c55e" : T.textMuted,
                    }}
                  >
                    за месяц: {formatCurrency(payoutHistory.paidThisMonth)}
                  </span>
                </div>
                <div className="space-y-2">
                  {payoutHistory.payouts.slice(0, 6).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                      style={{ borderColor: T.borderSoft }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate" style={{ color: T.text }}>{p.description}</p>
                        <p className="text-xs" style={{ color: T.textMuted }}>
                          {new Date(p.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          {p.paymentMethod && (
                            <span className="ml-1.5">
                              ·{" "}
                              {p.paymentMethod === "cash"
                                ? "наличные"
                                : p.paymentMethod === "card"
                                  ? "карта"
                                  : p.paymentMethod === "transfer"
                                    ? "перевод"
                                    : "другое"}
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="whitespace-nowrap font-mono font-semibold" style={{ color: "#22c55e" }}>
                        +{formatCurrency(p.amount)}
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
      {/* Task 100: w-[calc(100vw-2rem)] pins the dialog to the PHONE screen —
          the old w-full-only dialog was position:fixed and the 6-column
          table (min-w) blew it past the viewport, so it was CLIPPED with no
          scrollbar anywhere (the real «not scrollable on mobile» bug).
          max-h + overflow-y keeps the 10-row leaderboard inside the screen. */}
      <DialogContent
        className="max-h-[90dvh] max-w-2xl w-[calc(100vw_-_2rem)] overflow-y-auto p-4 sm:p-6"
        style={{ backgroundColor: T.bgCard, borderColor: T.borderSoft }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: T.text }}>
            <Users className="h-5 w-5" style={{ color: T.accent }} />
            💰 Зарплаты команды
          </DialogTitle>
        </DialogHeader>
        {/* Task 100: min-w-0 — this div is a GRID ITEM of DialogContent;
            grid items default to min-width:auto, so without it the item kept
            the table's 560px+ min-content width and the horizontal scroll
            escaped to the dialog instead of the table wrapper. */}
        <div className="min-w-0 space-y-4">
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
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span style={{ color: T.textMuted }}>🥇 1-е место: +10%</span>
                <span style={{ color: T.textMuted }}>🥈 2-е место: +5%</span>
                <span style={{ color: T.textMuted }}>🥉 3-е место: +3%</span>
              </div>
            </div>
          )}

          {/* Team earnings table */}
          {!loading && rows.length > 0 ? (
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: T.borderSoft }}>
              {/* Responsive table with horizontal scroll on mobile.
                  Task 100: min-w forces the table to keep a usable width on
                  phones — the old w-full-only table compressed 6 columns into
                  a 360px viewport and had nothing left to scroll. */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: T.borderSoft, color: T.textMuted }}>
                      <th className="px-3 py-2 text-left text-xs font-semibold w-10">#</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold">Сотрудник</th>
                      {/* Task 100: the column shows HOURS (288ч), not a shift count. */}
                      <th className="px-3 py-2 text-right text-xs font-semibold">Часы</th>
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
                              {/* Task 100: primary = @username (the identity the
                                  crew actually uses, same label the CSV
                                  attribution columns use), muted secondary =
                                  the Telegram full name («Dmitry User» wart). */}
                              <div className="min-w-0">
                                <p className="truncate">{member.memberName}</p>
                                {member.memberFullName && member.memberFullName !== member.memberName.replace(/^@/, "") && (
                                  <p className="truncate text-[10px] font-normal" style={{ color: T.textMuted }}>
                                    {member.memberFullName}
                                  </p>
                                )}
                              </div>
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
