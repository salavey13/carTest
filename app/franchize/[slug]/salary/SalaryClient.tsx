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
import { cn } from "@/lib/utils";
import { useAppContext } from "@/contexts/AppContext";
import {
  getFranchizeOperatorDashboardAccess,
  type FranchizeCrewVM,
} from "@/app/franchize/actions";
import { withAlpha } from "@/app/franchize/lib/theme";
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";
import { useCrewTokens } from "@/app/franchize/lib/use-crew-tokens";
import {
  FranchizeOperatorPanel,
  FranchizeOperatorStatCard,
  franchizeOperatorInputClassName,
  franchizeOperatorInputStyle,
} from "../../components/FranchizeOperatorSurface";
import {
  getOrCreateSalaryPlan,
  calculateSalaryForPeriod,
  recordPayout,
} from "../../server-actions/salary-calculations";

interface SalaryMember {
  id: string;
  name: string;
  role: string;
}

interface SalaryPlan {
  id: string;
  memberId: string;
  memberName: string;
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

type SalaryClientProps = {
  initialSlug?: string;
  initialCrew?: FranchizeCrewVM;
};

const fallbackCrew: FranchizeCrewVM = {
  id: "",
  slug: "vip-bike",
  name: "VIP BIKE",
  description: "Crew profile",
  logoUrl: "",
  hqLocation: "",
  isFound: false,
  theme: {
    mode: "pepperolli_dark",
    palette: {
      bgBase: "#0B0C10",
      bgCard: "#111217",
      accentMain: "#D99A00",
      accentMainHover: "#E2A812",
      textPrimary: "#F2F2F3",
      textSecondary: "#A7ABB4",
      borderSoft: "#24262E",
    },
  },
  header: {
    brandName: "VIP BIKE",
    tagline: "Ride the vibe",
    logoUrl: "",
    logoHref: "",
    menuLinks: [],
  },
  contacts: {
    phone: "",
    email: "",
    address: "",
    telegram: "",
    telegramBotUsername: "",
    workingHours: "",
    map: {
      gps: "",
      publicTransport: "",
      carDirections: "",
      imageUrl: "",
      bounds: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  },
  catalog: {
    categories: [],
    quickLinks: [],
    tickerItems: [],
    promoBanners: [],
    adCards: [],
    showcaseGroups: [],
  },
  ratingSummary: { average: 0, count: 0 },
  footer: { socialLinks: [], columns: [], textColor: "#16130A" },
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

  // Period filter
  const [periodStart, setPeriodStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [periodEnd, setPeriodEnd] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];
  });

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
        // Check owner access
        const accessCheck = await getFranchizeOperatorDashboardAccess({ slug });
        setIsOwner(Boolean(accessCheck.success && accessCheck.canOpen));

        // Load crew members (using crew_members table)
        const { supabaseAdmin } = await import("@/lib/supabase-server");

        // Get crew_id first
        const { data: crewData } = await supabaseAdmin
          .from("crews")
          .select("id")
          .eq("slug", slug)
          .single();

        if (!crewData) {
          setError("Экипаж не найден");
          setIsLoading(false);
          return;
        }

        const { data: membersData, error: membersError } = await supabaseAdmin
          .from("crew_members")
          .select(`
            id,
            user_id,
            role,
            users!inner (
              metadata
            )
          `)
          .eq("crew_id", crewData.id)
          .eq("membership_status", "active");

        if (membersError) {
          console.error("Failed to load members:", membersError);
        }

        const formattedMembers = (membersData || []).map((m: any) => ({
          id: m.user_id,
          name: m.users?.metadata?.name || m.users?.metadata?.username || `Member ${m.user_id.slice(0, 6)}`,
          role: m.role,
        }));

        setMembers(formattedMembers);

        // Load salary plans for the period
        const startPeriod = new Date(periodStart).toISOString();
        const endPeriod = new Date(periodEnd).toISOString();

        const { data: plansData, error: plansError } = await supabaseAdmin
          .from("salary_calculations")
          .select(`
            id,
            salary_plan_id,
            period_start,
            period_end,
            total_income,
            payout_status,
            salary_plans!inner (
              member_id,
              crew_id
            )
          `)
          .eq("salary_plans.crew_id", crewData.id)
          .gte("period_start", startPeriod)
          .lt("period_end", endPeriod);

        if (plansError) {
          console.error("Failed to load plans:", plansError);
        }

        // Format plans with member names
        const formattedPlans = await Promise.all(
          (plansData || []).map(async (plan: any) => {
            const member = formattedMembers.find(m => m.id === plan.salary_plans.member_id);

            // Get total paid
            const { data: payments } = await supabaseAdmin
              .from("cash_transactions")
              .select("amount")
              .eq("salary_calc_id", plan.id)
              .eq("transaction_type", "expense_salary");

            const totalPaid = (payments || []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
            const accrued = Number(plan.total_income || 0);
            const balanceDue = accrued - totalPaid;

            return {
              id: plan.id,
              memberId: plan.salary_plans.member_id,
              memberName: member?.name || `Member ${plan.salary_plans.member_id.slice(0, 6)}`,
              periodStart: plan.period_start,
              periodEnd: plan.period_end,
              accrued,
              paid: totalPaid,
              balanceDue,
              status: balanceDue <= 0 ? "paid" : totalPaid > 0 ? "partial" : "pending",
              breakdown: null, // Will load on demand
            };
          })
        );

        setPlans(formattedPlans);
      } catch (err) {
        console.error("Failed to load salary data:", err);
        setError("Не удалось загрузить данные зарплаты");
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
        setPlans(prev => prev.map(p =>
          p.id === plan.id
            ? {
                ...p,
                breakdown: {
                  shiftIncome: result.data!.shiftIncome,
                  commissionIncome: result.data!.commissionIncome,
                  bonusIncome: result.data!.bonusIncome,
                  totalIncome: result.data!.totalIncome,
                  details: result.data!.breakdown,
                }
              }
            : p
        ));
        setBreakdownModal({ open: true, plan: plans.find(p => p.id === plan.id) || null });
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
      const result = await recordPayout({
        slug,
        actorUserId: dbUser.user_id,
        salaryCalcId: plan.id,
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
            <div className="py-8 text-center text-sm" style={{ color: T.textMuted }}>
              Нет данных за выбранный период. Измените период или дождитесь начислений.
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
                        {plan.memberName}
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
                        style={{ color: plan.balanceDue > 0 ? "#f59e0b" : "#10b981" }}
                      >
                        {formatCurrency(plan.balanceDue)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                            plan.status === "paid" && "bg-green-500/10 text-green-400",
                            plan.status === "partial" && "bg-yellow-500/10 text-yellow-400",
                            plan.status === "pending" && "bg-gray-500/10 text-gray-400"
                          )}
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