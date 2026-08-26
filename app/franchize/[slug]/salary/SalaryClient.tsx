"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { DollarSign, Calendar, CheckCircle, Clock, AlertCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAppContext } from "@/contexts/AppContext";
import {
  getFranchizeOperatorDashboardAccess,
  type FranchizeCrewVM,
} from "@/app/franchize/actions";
import { withAlpha } from "@/app/franchize/lib/theme";
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";
import { useCrewTokens } from "@/app/franchize/lib/use-crew-tokens";
import { getCurrentPayPeriod, getPreviousPayPeriod, getCurrentCalendarMonth } from "@/lib/salary-period";
import { formatDateRu } from "@/app/franchize/components/DateInputRu";
import {
  FranchizeOperatorPanel,
  FranchizeOperatorStatCard,
  franchizeOperatorInputClassName,
  franchizeOperatorInputStyle,
} from "../../components/FranchizeOperatorSurface";
import {
  calculateSalaryForPeriod,
  recordPayoutForPeriod,
} from "../../server-actions/salary-calculations";
import { getOwnerSalaryOverview } from "../../server-actions/team-earnings";
import { fallbackCrew } from "@/app/franchize/lib/fallback-crew";

interface SalaryMember {
  id: string;
  name: string;
  role: string;
}

interface SalaryPlan {
  id: string;          // memberId (computed; we render one row per member)
  memberId: string;
  memberName: string;
  role?: string;        // 'owner' | 'admin' | 'co_owner' | 'member' — shown as a badge
  periodStart: string;
  periodEnd: string;
  accrued: number;
  paid: number;
  balanceDue: number;
  status: "pending" | "partial" | "paid";
  breakdown: {
    shiftIncome: number;
    commissionIncome: number;
    bonusIncome: number;
    totalIncome: number;
    details: Array<{ type: string; amount: number; description: string }>;
  } | null;
}

// 2026-08-19 review: small role badge shown next to the member name so the
// owner can immediately see who is admin/co_owner/owner vs regular member.
const ROLE_LABELS: Record<string, { label: string; style: "accent" | "warning" | "success" }> = {
  owner: { label: "Владелец", style: "accent" },
  co_owner: { label: "Со-влад.", style: "accent" },
  admin: { label: "Админ", style: "warning" },
  member: { label: "Участник", style: "success" },
  mechanic: { label: "Механик", style: "success" },
};

type SalaryClientProps = {
  initialSlug?: string;
  initialCrew?: FranchizeCrewVM;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function SalaryClient({ initialCrew, initialSlug }: SalaryClientProps) {
  const { dbUser } = useAppContext();

  useFranchizeTheme(initialCrew?.theme || fallbackCrew.theme);
  const T = useCrewTokens(initialCrew?.theme || fallbackCrew.theme);
  const slug = initialSlug || initialCrew?.slug || "vip-bike";
  const crew = initialCrew || fallbackCrew;

  const [members, setMembers] = useState<SalaryMember[]>([]);
  const [plans, setPlans] = useState<SalaryPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  // Period filter.
  // 2026-08-19 review: default to the CURRENT PAY PERIOD (10th → 25th, or
  // 25th → next 10th) instead of "first-of-month → first-of-next-month".
  // Matches the owner's actual payout cycle so the table shows what will
  // be paid out on the next payout date.
  const initialPeriod = getCurrentPayPeriod();
  const [periodStart, setPeriodStart] = useState(initialPeriod.from);
  const [periodEnd, setPeriodEnd] = useState(initialPeriod.to);

  // Modal states
  const [breakdownModal, setBreakdownModal] = useState<{
    open: boolean;
    plan: SalaryPlan | null;
  }>({ open: false, plan: null });

  const [processingPayout, setProcessingPayout] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!dbUser?.user_id) {
        setIsLoading(false);
        return;
      }

      try {
        // Check owner access — UI only. The server action enforces auth
        // independently via verifyCrewAccess.
        const accessCheck = await getFranchizeOperatorDashboardAccess({ slug });
        setIsOwner(Boolean(accessCheck.success && accessCheck.canOpen));

        // 2026-08-19 review fix: previously this client component imported
        // `supabaseAdmin` from "@/lib/supabase-server" and ran four raw
        // queries directly. That module throws on the client (server-only
        // guard) AND reads salary_calculations which is empty for this crew.
        // Now we call the new getOwnerSalaryOverview server action which:
        //   - verifies owner-tier access via the shared cookie helper
        //   - computes accrued dynamically from crew_member_shifts +
        //     cash_transactions.expense_commission (same logic as
        //     getMemberEarnings / my-work / getMyEarnings)
        //   - returns one row per member with paid + balanceDue + status
        const startIso = new Date(periodStart).toISOString();
        const endIso = new Date(periodEnd).toISOString();

        const result = await getOwnerSalaryOverview({
          slug,
          from: startIso,
          to: endIso,
        });

        if (!result.success || !result.data) {
          if (result.error) setError(result.error);
          setMembers([]);
          setPlans([]);
          return;
        }

        // Derive a member list for any UI that uses it (currently unused
        // beyond the table — kept for compatibility with future filters).
        const formattedMembers: SalaryMember[] = result.data.map((row: any) => ({
          id: row.memberId,
          name: row.memberName,
          role: row.role,
        }));
        setMembers(formattedMembers);

        const formattedPlans: SalaryPlan[] = result.data.map((row: any) => ({
          id: row.memberId, // used as React key
          memberId: row.memberId,
          memberName: row.memberName,
          role: row.role,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
          accrued: row.accrued,
          paid: row.paid,
          balanceDue: row.balanceDue,
          status: row.status,
          breakdown: null, // loaded on demand via calculateSalaryForPeriod
        }));

        setPlans(formattedPlans);
      } catch (err) {
        console.error("Failed to load salary data:", err);
        // Surface the ACTUAL error alongside the generic message (owner request).
        setError(`Не удалось загрузить данные зарплаты — ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [dbUser?.user_id, slug, periodStart, periodEnd]);

  const handleLoadBreakdown = async (plan: SalaryPlan) => {
    if (!dbUser?.user_id) return;

    try {
      const result = await calculateSalaryForPeriod({
        slug,
        actorUserId: dbUser.user_id,
        memberId: plan.memberId,
        periodStart: plan.periodStart,
        periodEnd: plan.periodEnd,
      });

      if (result.success && result.data) {
        const newBreakdown = {
          shiftIncome: result.data.shiftIncome,
          commissionIncome: result.data.commissionIncome,
          bonusIncome: result.data.bonusIncome,
          totalIncome: result.data.totalIncome,
          details: result.data.breakdown,
        };
        // 2026-08-19 review: previously the modal opened with the OLD plan
        // (closure capture) — `plans.find(p => p.id === plan.id)` returned
        // the pre-update plan, so `breakdown === null` and the modal showed
        // "Загрузка деталей..." forever. Use the updated plan object
        // directly so the modal renders the breakdown immediately.
        const updatedPlan: SalaryPlan = { ...plan, breakdown: newBreakdown };
        setPlans(prev => prev.map(p => p.id === plan.id ? updatedPlan : p));
        setBreakdownModal({ open: true, plan: updatedPlan });
      } else {
        setError(result.error || "Не удалось загрузить расчёт");
      }
    } catch (err) {
      console.error("Failed to load breakdown:", err);
      setError("Не удалось загрузить расчёт");
    }
  };

  const handlePayout = async (plan: SalaryPlan) => {
    if (!dbUser?.user_id || !isOwner) return;

    setProcessingPayout(plan.id);
    setError(null);

    try {
      // 2026-08-19 review fix: previously called recordPayout({ salaryCalcId })
      // — but salary_calculations is empty for this crew (no snapshot rows
      // are ever auto-created), so the button always failed with "Расчёт не
      // найден." Now we use recordPayoutForPeriod which computes the balance
      // dynamically and inserts an expense_salary transaction directly.
      const result = await recordPayoutForPeriod({
        slug,
        memberId: plan.memberId,
        periodStart: plan.periodStart,
        periodEnd: plan.periodEnd,
      });

      if (result.success) {
        // Refresh the plan data
        setPlans(prev => prev.map(p =>
          p.id === plan.id
            ? {
                ...p,
                paid: p.accrued,
                balanceDue: 0,
                status: "paid" as const
              }
            : p
        ));
      } else {
        setError(result.error || "Не удалось выполнить выплату");
      }
    } catch (err) {
      console.error("Failed to record payout:", err);
      setError("Не удалось выполнить выплату");
    } finally {
      setProcessingPayout(null);
    }
  };

  const handlePeriodChange = () => {
    // Reload data with new period
    setIsLoading(true);
    // The useEffect will trigger due to periodStart/periodEnd changes
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl border"
            style={{
              borderColor: "var(--franchize-shell-border)",
              backgroundColor: "color-mix(in srgb, var(--franchize-shell-card) 50%, transparent)",
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
      style={{
        ["--franchize-shell-bg" as string]: T.bg,
        ["--franchize-shell-card" as string]: T.bgCard,
        ["--franchize-shell-border" as string]: T.borderSoft,
        ["--franchize-shell-text" as string]: T.text,
        ["--franchize-shell-muted" as string]: T.textMuted,
        ["--franchize-shell-accent" as string]: T.accent,
        ["--franchize-shell-primary-contrast" as string]: T.accentContrast,
        ["--franchize-shell-ring" as string]: T.accent,
      }}
    >
      {/* Header Panel */}
      <motion.div variants={itemVariants}>
        <FranchizeOperatorPanel>
          <div className="flex items-start justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-medium tracking-wide" style={{ color: T.accent }}>
                <Wallet className="h-4 w-4" /> Зарплата
              </p>
              <h1 className="mt-2 text-2xl font-semibold" style={{ color: T.text }}>
                Расчёт зарплаты экипажа
              </h1>
              <p className="mt-2 text-sm" style={{ color: T.textMuted }}>
                Управление сменами, комиссиями и выплатами участникам экипажа
              </p>
              {/* iter5: link to the official bonus coefficients configuration */}
              <div
                className="mt-3 rounded-lg border px-3 py-2 text-xs"
                style={{
                  borderColor: `color-mix(in srgb, ${T.accent} 30%, transparent)`,
                  backgroundColor: `color-mix(in srgb, ${T.accent} 6%, transparent)`,
                  color: T.textMuted,
                }}
              >
                Бонусы за аренды и продажи считаются по официальной схеме (категория
                техники + экип + оверпрайс).{" "}
                <a
                  href={`/franchize/${slug}/salary-coefficients`}
                  className="font-semibold underline underline-offset-2"
                  style={{ color: T.accent }}
                >
                  Настроить коэффициенты ЗП →
                </a>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <FranchizeOperatorStatCard
              label="Всего начислено"
              value={formatCurrency(plans.reduce((sum, p) => sum + p.accrued, 0))}
              icon={<DollarSign className="h-4 w-4" style={{ color: T.accent }} />}
            />
            <FranchizeOperatorStatCard
              label="Выплачено"
              value={formatCurrency(plans.reduce((sum, p) => sum + p.paid, 0))}
              icon={<CheckCircle className="h-4 w-4" style={{ color: "#10b981" }} />}
            />
            <FranchizeOperatorStatCard
              label="К выплате"
              value={formatCurrency(plans.reduce((sum, p) => sum + p.balanceDue, 0))}
              icon={<AlertCircle className="h-4 w-4" style={{ color: "#f59e0b" }} />}
            />
          </div>
        </FranchizeOperatorPanel>
      </motion.div>

      {/* Period Filter */}
      <motion.div variants={itemVariants}>
        <FranchizeOperatorPanel>
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: T.text }}>
            <Calendar className="h-4 w-4" /> Период расчёта
          </div>

          {/* Quick presets — saves the owner from manually typing dates for
              common queries. Payout schedule is the 10th and 25th of each
              month, so the "pay period" presets match the actual cycle. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const p = getCurrentPayPeriod();
                setPeriodStart(p.from);
                setPeriodEnd(p.to);
                setIsLoading(true);
              }}
              className="rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-85"
              style={{
                backgroundColor: "color-mix(in srgb, var(--franchize-shell-accent) 15%, transparent)",
                color: T.accent,
                border: `1px solid ${T.borderSoft}`,
              }}
            >
              Текущий расчёт (10→25)
            </button>
            <button
              type="button"
              onClick={() => {
                const p = getPreviousPayPeriod();
                setPeriodStart(p.from);
                setPeriodEnd(p.to);
                setIsLoading(true);
              }}
              className="rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-85"
              style={{
                backgroundColor: "color-mix(in srgb, var(--franchize-shell-card) 80%, transparent)",
                color: T.textMuted,
                border: `1px solid ${T.borderSoft}`,
              }}
            >
              Прошлый расчёт
            </button>
            <button
              type="button"
              onClick={() => {
                const p = getCurrentCalendarMonth();
                setPeriodStart(p.from);
                setPeriodEnd(p.to);
                setIsLoading(true);
              }}
              className="rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-85"
              style={{
                backgroundColor: "color-mix(in srgb, var(--franchize-shell-card) 80%, transparent)",
                color: T.textMuted,
                border: `1px solid ${T.borderSoft}`,
              }}
            >
              Этот месяц
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs" style={{ color: T.textMuted }}>
                С
              </label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className={franchizeOperatorInputClassName}
                style={franchizeOperatorInputStyle}
              />
              {/* 2026-08-19 review: unambiguous Russian-format display so the
                  owner doesn't misread "08.07" as July 8 when it's August 7. */}
              {periodStart && (
                <p className="mt-1 text-[10px] tabular-nums" style={{ color: T.textMuted }}>
                  ({formatDateRu(periodStart)})
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs" style={{ color: T.textMuted }}>
                По
              </label>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className={franchizeOperatorInputClassName}
                style={franchizeOperatorInputStyle}
              />
              {periodEnd && (
                <p className="mt-1 text-[10px] tabular-nums" style={{ color: T.textMuted }}>
                  ({formatDateRu(periodEnd)})
                </p>
              )}
            </div>
          </div>
        </FranchizeOperatorPanel>
      </motion.div>

      {/* Error Display */}
      {error && (
        <motion.div variants={itemVariants}>
          <FranchizeOperatorPanel>
            <div className="flex items-center gap-2 text-sm" style={{ color: "#ef4444" }}>
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          </FranchizeOperatorPanel>
        </motion.div>
      )}

      {/* Plans Table */}
      <motion.div variants={itemVariants}>
        <FranchizeOperatorPanel>
          <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: T.text }}>
            <CheckCircle className="h-4 w-4" /> План выплат
          </h2>

          {plans.length === 0 ? (
            <div
              className="mt-3 flex flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center"
              style={{ borderColor: T.borderSoft }}
            >
              <div
                className="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--franchize-shell-accent) 12%, transparent)",
                  color: T.accent,
                }}
              >
                <Wallet className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold" style={{ color: T.text }}>
                Нет начислений за выбранный период
              </p>
              <p className="mt-1 text-xs" style={{ color: T.textMuted }}>
                Смены и комиссии появятся здесь автоматически — ведите учёт через профиль и кассовую книгу.
              </p>
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: T.borderSoft }}>
                    <th className="px-3 py-2 text-left font-medium" style={{ color: T.textMuted }}>
                      Участник
                    </th>
                    <th className="px-3 py-2 text-left font-medium" style={{ color: T.textMuted }}>
                      Период
                    </th>
                    <th className="px-3 py-2 text-right font-medium" style={{ color: T.textMuted }}>
                      Начислено
                    </th>
                    <th className="px-3 py-2 text-right font-medium" style={{ color: T.textMuted }}>
                      Выплачено
                    </th>
                    <th className="px-3 py-2 text-right font-medium" style={{ color: T.textMuted }}>
                      Баланс
                    </th>
                    <th className="px-3 py-2 text-center font-medium" style={{ color: T.textMuted }}>
                      Статус
                    </th>
                    <th className="px-3 py-2 text-right font-medium" style={{ color: T.textMuted }}>
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr
                      key={plan.id}
                      className="border-b transition-colors hover:bg-white/5"
                      style={{ borderColor: T.borderSoft }}
                    >
                      <td className="px-3 py-3 font-medium" style={{ color: T.text }}>
                        <div className="flex items-center gap-2">
                          <span>{plan.memberName}</span>
                          {plan.role && ROLE_LABELS[plan.role] && (
                            <span
                              className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                              style={
                                ROLE_LABELS[plan.role].style === "accent"
                                  ? T.styles.accentBadge
                                  : ROLE_LABELS[plan.role].style === "warning"
                                    ? T.styles.warningBadge
                                    : T.styles.successBadge
                              }
                            >
                              {ROLE_LABELS[plan.role].label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3" style={{ color: T.textMuted }}>
                        <div className="flex flex-col">
                          <span>{formatDate(plan.periodStart)}</span>
                          <span className="text-xs opacity-70">→ {formatDate(plan.periodEnd)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono" style={{ color: T.text }}>
                        {formatCurrency(plan.accrued)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono" style={{ color: T.textMuted }}>
                        {formatCurrency(plan.paid)}
                      </td>
                      <td
                        className="px-3 py-3 text-right font-mono font-semibold"
                        style={{
                          color: plan.balanceDue > 0
                            ? T.styles.warningBadge.color
                            : T.styles.successBadge.color,
                        }}
                      >
                        {formatCurrency(plan.balanceDue)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={
                            plan.status === "paid"
                              ? T.styles.successBadge
                              : plan.status === "partial"
                                ? T.styles.warningBadge
                                : T.styles.accentBadge
                          }
                        >
                          {plan.status === "paid" && <CheckCircle className="h-3 w-3" />}
                          {plan.status === "partial" && <Clock className="h-3 w-3" />}
                          {plan.status === "pending" && <Clock className="h-3 w-3" />}
                          {plan.status === "paid" ? "Выплачено" : plan.status === "partial" ? "Частично" : "Ожидает"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleLoadBreakdown(plan)}
                            style={{ color: T.accent }}
                          >
                            Детали
                          </Button>
                          {isOwner && plan.balanceDue > 0 && (
                            <Button
                              size="sm"
                              disabled={processingPayout === plan.id}
                              onClick={() => handlePayout(plan)}
                              className="h-7 px-3 text-xs font-semibold"
                              style={{
                                backgroundColor: T.accent,
                                color: T.accentContrast,
                                opacity: processingPayout === plan.id ? 0.7 : 1,
                              }}
                            >
                              {processingPayout === plan.id ? "Выплата..." : "Выплатить"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr
                    className="border-t-2"
                    style={{ borderColor: T.accent }}
                  >
                    <td className="px-3 py-3 font-semibold" style={{ color: T.text }}>
                      Итого
                    </td>
                    <td className="px-3 py-3" />
                    <td className="px-3 py-3 text-right font-mono font-semibold" style={{ color: T.text }}>
                      {formatCurrency(plans.reduce((sum, p) => sum + p.accrued, 0))}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold" style={{ color: T.textMuted }}>
                      {formatCurrency(plans.reduce((sum, p) => sum + p.paid, 0))}
                    </td>
                    <td
                      className="px-3 py-3 text-right font-mono font-bold"
                      style={{
                        color: plans.reduce((s, p) => s + p.balanceDue, 0) > 0
                          ? T.styles.warningBadge.color
                          : T.styles.successBadge.color,
                      }}
                    >
                      {formatCurrency(plans.reduce((sum, p) => sum + p.balanceDue, 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </FranchizeOperatorPanel>
      </motion.div>

      {/* Breakdown Modal */}
      <Dialog open={breakdownModal.open} onOpenChange={(open) => setBreakdownModal({ open, plan: null })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Детали расчёта</DialogTitle>
            <DialogDescription>
              {breakdownModal.plan && (
                <>
                  {breakdownModal.plan.memberName} · {formatDate(breakdownModal.plan.periodStart)} — {formatDate(breakdownModal.plan.periodEnd)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {breakdownModal.plan?.breakdown ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border p-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
                  <p className="text-xs" style={{ color: T.textMuted }}>Смены</p>
                  <p className="mt-1 text-lg font-semibold" style={{ color: T.text }}>
                    {formatCurrency(breakdownModal.plan.breakdown.shiftIncome)}
                  </p>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
                  <p className="text-xs" style={{ color: T.textMuted }}>Комиссии</p>
                  <p className="mt-1 text-lg font-semibold" style={{ color: T.text }}>
                    {formatCurrency(breakdownModal.plan.breakdown.commissionIncome)}
                  </p>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
                  <p className="text-xs" style={{ color: T.textMuted }}>Бонусы</p>
                  <p className="mt-1 text-lg font-semibold" style={{ color: T.text }}>
                    {formatCurrency(breakdownModal.plan.breakdown.bonusIncome)}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold" style={{ color: T.text }}>Детали по типам</h4>
                <div className="mt-2 space-y-2">
                  {breakdownModal.plan.breakdown.details.map((detail, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border p-2"
                      style={{ borderColor: T.borderSoft }}
                    >
                      <span className="text-sm" style={{ color: T.text }}>
                        {detail.description}
                      </span>
                      <span className="font-mono text-sm font-semibold" style={{ color: T.accent }}>
                        {formatCurrency(detail.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: T.borderSoft, backgroundColor: withAlpha(T.accent, 0.1) }}>
                <span className="text-sm font-semibold" style={{ color: T.text }}>Итого начислено</span>
                <span className="text-lg font-bold font-mono" style={{ color: T.accent }}>
                  {formatCurrency(breakdownModal.plan.breakdown.totalIncome)}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-sm" style={{ color: T.textMuted }}>
              Загрузка деталей...
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBreakdownModal({ open: false, plan: null })}
              className="rounded-full"
            >
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}