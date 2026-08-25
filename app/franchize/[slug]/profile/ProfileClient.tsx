"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Trophy, MapPin, ShoppingCart, Lock, CheckCircle, Wallet, Briefcase, Calendar, Users, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/contexts/AppContext";
import { getCurrentPayPeriod } from "@/lib/salary-period";
import { formatDateRu } from "@/app/franchize/components/DateInputRu";
import {
  getFranchizeProfileBySlugAction,
  grantFranchizeAchievementAction,
  type FranchizeAchievementDefinition,
  type FranchizeProfileState,
  type FranchizeActivityDigest,
  type FranchizeFormPrefill,
  getFranchizeActivityDigestAction,
  getFranchizeFormPrefillAction,
  saveFranchizeFormPrefillAction,
  getFranchizeUserRentalSecretsAction,
  getRentalDocsPrefillAction,
  saveRentalDocsPrefillAction,
  getProfileDocsStatusAction,
} from "@/app/franchize/profile-actions";
import {
  getFranchizeOperatorDashboardAccess,
  type FranchizeCrewVM,
} from "@/app/franchize/actions";
import { readablePaletteTextOnColor, withAlpha } from "@/app/franchize/lib/theme";
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";
import { useCrewTokens } from "@/app/franchize/lib/use-crew-tokens";
import { RentalDocsForm } from "../../components/RentalDocsForm";
import { PhotoUploadButton } from "../../components/PhotoUploadButton";
import {
  FranchizeOperatorLinkButton,
  FranchizeOperatorPanel,
  FranchizeOperatorStatCard,
  franchizeOperatorInputClassName,
  franchizeOperatorInputStyle,
} from "../../components/FranchizeOperatorSurface";
import { getMyEarnings } from "../../server-actions/salary-calculations";
import { getMyWorkTodayAction } from "../../server-actions/my-work";

// 2026-08-19 review: use the shared fallbackCrew constant from
// lib/fallback-crew.ts — was duplicated inline here, which meant it
// drifted from the canonical version (missing reservationHold,
// contentBlocks, cta fields after the type was extended).
import { fallbackCrew } from "@/app/franchize/lib/fallback-crew";

type FranchizeProfileClientProps = {
  initialCrew?: FranchizeCrewVM;
  initialSlug?: string;
};

// Loading skeleton component
function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
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

// Empty state component
function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          backgroundColor: "color-mix(in srgb, var(--franchize-shell-accent) 12%, transparent)",
          color: "var(--franchize-shell-accent)",
        }}
      >
        {icon}
      </div>
      <p className="font-semibold" style={{ color: "var(--franchize-shell-text)" }}>
        {title}
      </p>
      <p className="mt-1 text-sm" style={{ color: "var(--franchize-shell-muted)" }}>
        {description}
      </p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-90"
          style={{
            backgroundColor: "var(--franchize-shell-accent)",
            color: "var(--franchize-shell-primary-contrast)",
          }}
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function FranchizeProfileClient({
  initialCrew,
  initialSlug,
}: FranchizeProfileClientProps) {
  const { dbUser } = useAppContext();

  // Apply franchize theme CSS variables for proper light/dark mode support
  useFranchizeTheme(initialCrew?.theme || fallbackCrew.theme);
  const T = useCrewTokens(initialCrew?.theme || fallbackCrew.theme);
  const params = useParams<{ slug: string }>();
  // FIX: The rental/order cards below use Next.js `<Link>` for
  // navigation, but Next.js falls back to a full page load when the
  // target route lives in a different segment (e.g. `/rentals/[id]`
  // vs `/franchize/[slug]/profile`) AND the user is not yet
  // authenticated — which is exactly when the profile is opened
  // (no session, just the password form). The browser therefore
  // navigates with a hard reload instead of an SPA transition.
  //
  // We force SPA navigation by calling `router.push()` directly. This
  // works whether the target is inside or outside the franchize
  // segment and bypasses the `<Link>` middleware / prefetch quirks.
  const router = useRouter();
  const navigateSpa = (href: string) => {
    if (!href) return;
    router.push(href);
  };
  const slug = initialSlug || params?.slug || initialCrew?.slug || "vip-bike";
  const crew = initialCrew || fallbackCrew;
  const [catalog, setCatalog] = useState<FranchizeAchievementDefinition[]>([]);
  const [profile, setProfile] = useState<FranchizeProfileState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [digest, setDigest] = useState<FranchizeActivityDigest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rentalSecrets, setRentalSecrets] = useState<{
    hasPreviousRentals: boolean;
    lastRentalDate?: string;
    savedData?: {
      fullName: string;
      phone: string;
      passport: string;
      driverLicense: string;
      birthDate: string;
      licenseExpiryDate: string;
      licenseCategories: string;
    };
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [prefill, setPrefill] = useState<FranchizeFormPrefill>({
    fullName: "",
    phone: "",
    preferredTime: "",
    deliveryMode: "pickup",
    comment: "",
  });
  const [canOpenCloserDashboard, setCanOpenCloserDashboard] = useState(false);

  // Earnings and work state
  const [earnings, setEarnings] = useState<{
    currentPlan: { accrued: number; balanceDue: number; nextPayoutDate: string | null };
    recentCommissions: Array<{ amount: number; date: string; description: string }>;
  } | null>(null);
  const [myWork, setMyWork] = useState<{
    date: string;
    rentals: { count: number; total: number };
    sales: { count: number; total: number };
    serviceReturns: { count: number; total: number };
  } | null>(null);
  const [earningsLoading, setEarningsLoading] = useState(true);
  const [workLoading, setWorkLoading] = useState(true);

  // Period earnings state.
  // 2026-08-19 review: default to the CURRENT PAY PERIOD (10th → 25th, or
  // 25th → next 10th) instead of "first of month → today". Matches the
  // owner's actual payout cycle so the totals match what gets paid out.
  // Helper lives in lib/salary-period.ts and is shared with SalaryClient.
  const [earningsPeriod, setEarningsPeriod] = useState(() => {
    // Inline the import-time compute so we don't recompute every render.
    const period = getCurrentPayPeriod();
    return period;
  });
  const [periodEarnings, setPeriodEarnings] = useState<{
    shifts: number;
    shiftIncome: number;
    commissionIncome: number;
    total: number;
    breakdown: Array<{ date: string; description: string; amount: number }>;
  } | null>(null);
  const [periodEarningsLoading, setPeriodEarningsLoading] = useState(false);
  const [periodEarningsError, setPeriodEarningsError] = useState<string | null>(null);

  // Team earnings modal state (for owners)
  const [showTeamEarningsModal, setShowTeamEarningsModal] = useState(false);
  const [teamEarnings, setTeamEarnings] = useState<Array<{
    memberId: string;
    memberName: string;
    shifts: number;
    shiftIncome: number;
    commissionIncome: number;
    total: number;
  }>>([]);
  const [teamEarningsLoading, setTeamEarningsLoading] = useState(false);
  const [teamEarningsError, setTeamEarningsError] = useState<string | null>(null);
  // Pre-entered rental docs (passport/license) from private.user_rental_secrets
  const [docsPrefill, setDocsPrefill] = useState<{
    fullName?: string; phone?: string; birthDate?: string;
    passportSeries?: string; passportNumber?: string; passportIssuedBy?: string;
    passportIssueDate?: string; registrationAddress?: string;
    licenseSeries?: string; licenseNumber?: string; licenseCategories?: string;
    licenseExpiryDate?: string; verificationStatus?: string; hasVerifiedData?: boolean;
  } | null>(null);
  // Profile document photos status (uploaded/verified)
  const [profileDocsStatus, setProfileDocsStatus] = useState<{
    passportMainpage: { uploaded: boolean; verified: boolean };
    passportRegistration: { uploaded: boolean; verified: boolean };
    driversLicence: { uploaded: boolean; verified: boolean };
  } | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!dbUser?.user_id) {
        setIsLoading(false);
        return;
      }
      const result = await getFranchizeProfileBySlugAction({
        slug,
        userId: dbUser.user_id,
      });
      if (!result.success || !result.data) {
        setError(result.error || "Не удалось загрузить франшизный профиль.");
        setIsLoading(false);
        return;
      }
      setProfile(result.data);
      setCatalog(result.catalog || []);
      const [digestRes, prefillRes, operatorAccessRes, rentalSecretsRes, docsRes, profileDocsRes] = await Promise.all([
        getFranchizeActivityDigestAction({ slug, userId: dbUser.user_id }),
        getFranchizeFormPrefillAction({ slug, userId: dbUser.user_id }),
        getFranchizeOperatorDashboardAccess({ slug }),
        getFranchizeUserRentalSecretsAction({ slug, userId: dbUser.user_id }),
        getRentalDocsPrefillAction({ slug, userId: dbUser.user_id }),
        getProfileDocsStatusAction({ slug, userId: dbUser.user_id }),
      ]);
      if (digestRes.success && digestRes.data) setDigest(digestRes.data);
      if (prefillRes.success && prefillRes.data) setPrefill(prefillRes.data);
      if (rentalSecretsRes.success && rentalSecretsRes.data) setRentalSecrets(rentalSecretsRes.data);
      if (docsRes.success && docsRes.data) setDocsPrefill(docsRes.data);
      if (profileDocsRes.success && profileDocsRes.data) setProfileDocsStatus(profileDocsRes.data);
      setCanOpenCloserDashboard(
        Boolean(operatorAccessRes.success && operatorAccessRes.canOpen),
      );
      await grantFranchizeAchievementAction({
        slug,
        userId: dbUser.user_id,
        achievementId: "franchize_profile_opened",
        source: "web:franchize_profile",
        context: { path: `/franchize/${slug}/profile` },
        incrementCounters: { profileOpenCount: 1 },
      });
      setIsLoading(false);

      // Load earnings and work data
      setEarningsLoading(true);
      setWorkLoading(true);

      const [earningsRes, workRes] = await Promise.all([
        getMyEarnings({ slug, actorUserId: dbUser.user_id }),
        getMyWorkTodayAction({ slug, userId: dbUser.user_id }),
      ]);

      if (earningsRes.success && earningsRes.data) {
        setEarnings(earningsRes.data);
      }
      setEarningsLoading(false);

      if (workRes.success && workRes.data) {
        setMyWork(workRes.data);
      }
      setWorkLoading(false);
    };
    void run();
  }, [dbUser?.user_id, slug]);

  // Currency formatter helper (reused across component)
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  // Fetch earnings helper (shared between self and team)
  const fetchEarnings = async (scope: "self" | "team") => {
    if (!dbUser?.user_id) return { success: false, error: "Не авторизован" };

    // Validate date range
    const fromDate = new Date(earningsPeriod.from);
    const toDate = new Date(earningsPeriod.to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return { success: false, error: "Некорректный формат даты" };
    }
    if (fromDate > toDate) {
      return { success: false, error: "Дата начала не может быть позже даты окончания" };
    }

    // Clone date to avoid mutation
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    const params = new URLSearchParams({
      from: fromDate.toISOString(),
      to: to.toISOString(),
      scope,
      actorUserId: dbUser.user_id,
    });

    try {
      const res = await fetch(`/api/franchize/${slug}/earnings?${params}`);
      return await res.json();
    } catch (err) {
      console.error(`Failed to fetch ${scope} earnings:`, err);
      return { success: false, error: `Ошибка при загрузке ${scope === "team" ? "зарплат команды" : "дохода за период"}` };
    }
  };

  // Fetch period earnings for self
  const fetchPeriodEarnings = async () => {
    setPeriodEarningsLoading(true);
    setPeriodEarningsError(null);
    const result = await fetchEarnings("self");
    if (result.success && result.data) {
      setPeriodEarnings(result.data);
    } else {
      setPeriodEarningsError(result.error || "Не удалось загрузить доход за период");
    }
    setPeriodEarningsLoading(false);
  };

  // Fetch team earnings for owners
  const fetchTeamEarnings = async () => {
    setTeamEarningsLoading(true);
    setTeamEarningsError(null);
    const result = await fetchEarnings("team");
    if (result.success && result.data) {
      setTeamEarnings(result.data);
      setShowTeamEarningsModal(true);
    } else {
      setTeamEarningsError(result.error || "Не удалось загрузить зарплаты команды");
    }
    setTeamEarningsLoading(false);
  };

  // Auto-load period earnings on mount with default period
  useEffect(() => {
    if (dbUser?.user_id && !periodEarnings) {
      void fetchPeriodEarnings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbUser?.user_id]);

  const unlockedSet = useMemo(
    () => new Set(Object.keys(profile?.achievements || {})),
    [profile?.achievements],
  );
  const unlockedCount = catalog.filter((item) =>
    unlockedSet.has(item.id),
  ).length;
  const accentOn = T.accentContrast;
  const isAuto = T.isAuto;

  const handlePrefillSave = async () => {
    if (!dbUser?.user_id) return;
    setIsSaving(true);
    setSaveSuccess(false);
    const res = await saveFranchizeFormPrefillAction({
      slug,
      userId: dbUser.user_id,
      prefill,
    });
    if (res.success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      setError(res.error || "Не удалось сохранить поля.");
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
      style={{
        // Shell variables for FranchizeOperatorPanel compatibility
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
        <FranchizeOperatorPanel muted={false}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1">
              <p className="flex items-center gap-2 text-xs font-medium tracking-wide " style={{ color: T.accent }}>
                <VibeContentRenderer content="::FaIdBadge::" /> Профиль райдера
              </p>
              <h1 className="mt-2 break-words text-2xl font-semibold " style={{ color: T.text }}>
                {profile?.crewName || crew.header.brandName || slug}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed " style={{ color: T.textMuted }}>
                Персональная страница достижений, сохранённых данных и быстрых
                возвратов в аренды экипажа.
              </p>
            </div>
            <FranchizeOperatorLinkButton href={`/franchize/${slug}`}>
              В каталог
            </FranchizeOperatorLinkButton>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <FranchizeOperatorStatCard
              label="Достижения"
              value={`${unlockedCount}/${catalog.length}`}
              icon={<Trophy className="h-4 w-4" style={{ color: T.accent }} />}
            />
            <FranchizeOperatorStatCard
              label="Смен завершено"
              value={profile?.counters?.shiftsCompleted || 0}
              icon={<Briefcase className="h-4 w-4" style={{ color: T.accent }} />}
            />
            <FranchizeOperatorStatCard
              label="Часов работы"
              value={profile?.counters?.totalHoursWorked
                ? Math.round(profile.counters.totalHoursWorked)
                : 0}
              icon={<Calendar className="h-4 w-4" style={{ color: T.accent }} />}
            />
          </div>
        </FranchizeOperatorPanel>
      </motion.div>

      {/* Achievements Panel moved to end of page */}

      {/* Rentals and Purchases Panel */}
      <motion.div variants={itemVariants}>
        <FranchizeOperatorPanel>
          <h2 className="flex items-center gap-2 text-base font-semibold " style={{ color: T.text }}>
            <ShoppingCart className="h-4 w-4" /> Аренды и покупки
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Rentals section */}
            <div>
              <p className="mb-2 text-xs font-semibold " style={{ color: T.textMuted }}>
                Мои аренды
              </p>
              {digest?.rentals && digest.rentals.length > 0 ? (
                <div className="space-y-2">
                  {digest.rentals.slice(0, 5).map((r) => (
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
                      className="block rounded-xl border p-3 text-sm transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={T.styles.card}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          {r.vehicleImage && (
                            <img
                              src={r.vehicleImage}
                              alt={r.vehicleLabel}
                              className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          )}
                          <div>
                            <span className="font-semibold" style={{ color: T.text }}>
                              {r.vehicleLabel}
                            </span>
                            {r.agreedStartDate && r.agreedEndDate && (
                              <p style={{ color: T.textMuted }} className="mt-0.5 text-[11px]">
                                {new Date(r.agreedStartDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                                {" → "}
                                {new Date(r.agreedEndDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                              </p>
                            )}
                          </div>
                        </div>
                        {r.isTestRide ? (
                          <span style={T.styles.accentBadge} className="rounded-full px-2 py-0.5 text-[10px] whitespace-nowrap">
                            Тест-драйв
                          </span>
                        ) : (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] whitespace-nowrap"
                            style={{
                              ...T.styles.accentPill,
                              opacity: r.status === "active" ? 1 : 0.6,
                            }}
                          >
                            {(() => {
                              const STATUS_LABELS: Record<string, string> = {
                                active: "Активна",
                                completed: "Завершена",
                                cancelled: "Отменена",
                                disputed: "Спорная",
                                confirmed: "Подтверждена",
                                pending_confirmation: "Ждёт подтверждения",
                              };
                              return STATUS_LABELS[r.status] || r.status;
                            })()}
                          </span>
                        )}
                      </div>
                      {r.status === "active" && (
                        <div className="mt-2 flex items-center justify-end gap-2 border-t pt-2"
                          style={{ borderColor: T.borderSoft }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigateSpa(`/franchize/${slug}?vehicle=${r.vehicleId}`);
                            }}
                            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition hover:opacity-85"
                            style={T.styles.ctaPrimary}
                          >
                            Продлить
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<MapPin className="h-6 w-6" />}
                  title="Нет активных аренд"
                  description="Начните аренду, чтобы она появилась здесь"
                  actionLabel="Каталог байков"
                  actionHref={`/franchize/${slug}`}
                />
              )}
            </div>

            {/* Orders section */}
            <div>
              <p className="mb-2 text-xs font-semibold " style={{ color: T.textMuted }}>
                Планируемые покупки
              </p>
              {digest?.buyOrders && digest.buyOrders.length > 0 ? (
                <div className="space-y-2">
                  {digest.buyOrders.slice(0, 3).map((o) => (
                    <div
                      key={o.orderId}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigateSpa(o.docLink)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigateSpa(o.docLink);
                        }
                      }}
                      className="block cursor-pointer rounded-xl border p-3 text-sm transition hover:opacity-90 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{ borderColor: T.borderSoft }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs " style={{ color: T.accent }}>
                          #{o.orderId}
                        </span>
                        <ShoppingCart className="h-3 w-3 "  style={{ color: T.textMuted }} />
                      </div>
                      <div className="mt-1 text-xs " style={{ color: T.text }}>
                        {o.status} · {o.vehicleIds.slice(0, 2).join(", ")}
                        {o.vehicleIds.length > 2 && ` +${o.vehicleIds.length - 2}`}
                      </div>
                      {o.docFileName && (
                        <div className="mt-1 text-xs " style={{ color: T.textMuted }}>
                          📄 {o.docFileName}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<ShoppingCart className="h-6 w-6" />}
                  title="Нет заказов"
                  description="Оформите покупку, чтобы она появилась здесь"
                  actionLabel="Каталог"
                  actionHref={`/franchize/${slug}`}
                />
              )}
            </div>
          </div>
        </FranchizeOperatorPanel>
      </motion.div>

      {/* My Earnings Panel */}
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
              {canOpenCloserDashboard && (
                <button
                  onClick={fetchTeamEarnings}
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
              )}
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
                onClick={fetchPeriodEarnings}
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
          {earningsLoading ? (
            <div className="py-4 text-center text-sm" style={{ color: T.textMuted }}>
              Загрузка данных...
            </div>
          ) : earnings ? (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-lg border p-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
                  <p className="text-xs" style={{ color: T.textMuted }}>Начислено (месяц)</p>
                  <p className="mt-1 text-lg font-semibold" style={{ color: T.text }}>
                    {formatCurrency(earnings.currentPlan.accrued)}
                  </p>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
                  <p className="text-xs" style={{ color: T.textMuted }}>К выплате</p>
                  <p className="mt-1 text-lg font-semibold" style={{ color: earnings.currentPlan.balanceDue > 0 ? "#f59e0b" : "#10b981" }}>
                    {formatCurrency(earnings.currentPlan.balanceDue)}
                  </p>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
                  <p className="text-xs" style={{ color: T.textMuted }}>Следующая выплата</p>
                  <p className="mt-1 text-lg font-semibold" style={{ color: T.text }}>
                    {earnings.currentPlan.nextPayoutDate
                      ? new Date(earnings.currentPlan.nextPayoutDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
                      : "—"}
                  </p>
                </div>
              </div>

              {earnings.recentCommissions.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold" style={{ color: T.textMuted }}>
                    Последние комиссии
                  </p>
                  <div className="space-y-2">
                    {earnings.recentCommissions.slice(0, 5).map((comm, idx) => (
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
        </FranchizeOperatorPanel>
      </motion.div>

      {/* My Work Panel */}
      <motion.div variants={itemVariants}>
        <FranchizeOperatorPanel>
          <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: T.text }}>
            <Briefcase className="h-4 w-4" /> Моя работа
          </h2>
          {workLoading ? (
            <div className="py-4 text-center text-sm" style={{ color: T.textMuted }}>
              Загрузка данных...
            </div>
          ) : myWork ? (
            <div className="mt-3 space-y-4">
              <div className="flex items-center gap-2 text-sm" style={{ color: T.textMuted }}>
                <Calendar className="h-4 w-4" />
                <span>Сегодня: {new Date(myWork.date).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}</span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-lg border p-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
                  <p className="text-xs" style={{ color: T.textMuted }}>Аренды</p>
                  <p className="mt-1 text-lg font-semibold" style={{ color: T.text }}>
                    {myWork.rentals.count}
                  </p>
                  <p className="text-xs" style={{ color: T.textMuted }}>
                    {formatCurrency(myWork.rentals.total)}
                  </p>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
                  <p className="text-xs" style={{ color: T.textMuted }}>Продажи</p>
                  <p className="mt-1 text-lg font-semibold" style={{ color: T.text }}>
                    {myWork.sales.count}
                  </p>
                  <p className="text-xs" style={{ color: T.textMuted }}>
                    {formatCurrency(myWork.sales.total)}
                  </p>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
                  <p className="text-xs" style={{ color: T.textMuted }}>Сервис/Возвраты</p>
                  <p className="mt-1 text-lg font-semibold" style={{ color: T.text }}>
                    {myWork.serviceReturns.count}
                  </p>
                  <p className="text-xs" style={{ color: T.textMuted }}>
                    {formatCurrency(myWork.serviceReturns.total)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-sm" style={{ color: T.textMuted }}>
              Нет данных о работе
            </div>
          )}
        </FranchizeOperatorPanel>
      </motion.div>

      {/* Crew Operations Panel — shown only for crew members */}
      {canOpenCloserDashboard && (
        <motion.div variants={itemVariants}>
          <FranchizeOperatorPanel>
            <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: T.text }}>
              <VibeContentRenderer content="::FaTools::" /> Операции экипажа
            </h2>
            <p className="mt-1 text-xs" style={{ color: T.textMuted }}>
              Быстрый доступ к инструментам управления экипажем
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <FranchizeOperatorLinkButton href={`/franchize/${slug}/equipment`}>
                📦 Оборудование
              </FranchizeOperatorLinkButton>
              <FranchizeOperatorLinkButton href={`/franchize/${slug}/cash-ledger`}>
                💰 Касса
              </FranchizeOperatorLinkButton>
              <FranchizeOperatorLinkButton href={`/franchize/${slug}/commissions`}>
                📊 Комиссии
              </FranchizeOperatorLinkButton>
              <FranchizeOperatorLinkButton href={`/franchize/${slug}/salary`}>
                💵 Зарплата
              </FranchizeOperatorLinkButton>
              <FranchizeOperatorLinkButton href={`/franchize/${slug}/admin`}>
                ⚙️ Админка
              </FranchizeOperatorLinkButton>
              <FranchizeOperatorLinkButton href={`/franchize/${slug}/rentals-analytics`}>
                📈 Аналитика
              </FranchizeOperatorLinkButton>
              <FranchizeOperatorLinkButton href={`/franchize/${slug}/leads`}>
                👥 Лиды
              </FranchizeOperatorLinkButton>
              <FranchizeOperatorLinkButton href={`/franchize/${slug}/admin/deposits`}>
                🏦 Депозиты
              </FranchizeOperatorLinkButton>
              <FranchizeOperatorLinkButton href={`/franchize/${slug}/calc-explainer`}>
                📐 Как считаются деньги
              </FranchizeOperatorLinkButton>
            </div>
          </FranchizeOperatorPanel>
        </motion.div>
      )}

      {/* Profile Document Photos Panel */}
      <motion.div variants={itemVariants}>
        <FranchizeOperatorPanel>
          <h2 className="flex items-center gap-2 text-base font-semibold " style={{ color: T.text }}>
            <VibeContentRenderer content="::FaCamera::" /> Мои документы
          </h2>
          <p className="mt-1 text-xs " style={{ color: T.textMuted }}>
            Загрузите фото документов для ускорения оформления аренды. Данные будут распознаны автоматически.
          </p>
          <div className="mt-4 space-y-4">
            {/* Passport Main Page */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: T.text }}>
                  Паспорт (главная страница)
                </span>
                {profileDocsStatus?.passportMainpage.verified ? (
                  <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{
                      backgroundColor: withAlpha("#10b981", 0.15),
                      color: "#10b981",
                    }}>
                    <CheckCircle className="h-3 w-3" />
                    Верифицирован
                  </span>
                ) : profileDocsStatus?.passportMainpage.uploaded ? (
                  <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{
                      backgroundColor: withAlpha("#f59e0b", 0.15),
                      color: "#f59e0b",
                    }}>
                    ⏳ Ожидает верификации
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{
                      backgroundColor: withAlpha("#ef4444", 0.15),
                      color: "#ef4444",
                    }}>
                    ❌ Не загружен
                  </span>
                )}
              </div>
              {dbUser?.user_id && (
                <PhotoUploadButton
                  docType="passport_mainpage"
                  rentalId={`profile_${dbUser.user_id}`}
                  chatId={dbUser.user_id}
                  onSuccess={() => {
                    // Refresh status after upload
                    getProfileDocsStatusAction({ slug, userId: dbUser.user_id }).then((res) => {
                      if (res.success && res.data) setProfileDocsStatus(res.data);
                    });
                  }}
                />
              )}
              {profileDocsStatus?.passportMainpage.uploaded && !profileDocsStatus?.passportMainpage.verified && (
                <p className="text-xs italic" style={{ color: T.textMuted }}>
                  Нельзя загрузить новое фото до верификации текущего
                </p>
              )}
            </div>

            {/* Passport Registration Page */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: T.text }}>
                  Паспорт (страница с пропиской)
                </span>
                {profileDocsStatus?.passportRegistration.verified ? (
                  <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{
                      backgroundColor: withAlpha("#10b981", 0.15),
                      color: "#10b981",
                    }}>
                    <CheckCircle className="h-3 w-3" />
                    Верифицирован
                  </span>
                ) : profileDocsStatus?.passportRegistration.uploaded ? (
                  <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{
                      backgroundColor: withAlpha("#f59e0b", 0.15),
                      color: "#f59e0b",
                    }}>
                    ⏳ Ожидает верификации
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{
                      backgroundColor: withAlpha("#ef4444", 0.15),
                      color: "#ef4444",
                    }}>
                    ❌ Не загружен
                  </span>
                )}
              </div>
              {dbUser?.user_id && (
                <PhotoUploadButton
                  docType="passport_registration"
                  rentalId={`profile_${dbUser.user_id}`}
                  chatId={dbUser.user_id}
                  onSuccess={() => {
                    getProfileDocsStatusAction({ slug, userId: dbUser.user_id }).then((res) => {
                      if (res.success && res.data) setProfileDocsStatus(res.data);
                    });
                  }}
                />
              )}
              {profileDocsStatus?.passportRegistration.uploaded && !profileDocsStatus?.passportRegistration.verified && (
                <p className="text-xs italic" style={{ color: T.textMuted }}>
                  Нельзя загрузить новое фото до верификации текущего
                </p>
              )}
            </div>

            {/* Driver's License */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: T.text }}>
                  Водительское удостоверение
                </span>
                {profileDocsStatus?.driversLicence.verified ? (
                  <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{
                      backgroundColor: withAlpha("#10b981", 0.15),
                      color: "#10b981",
                    }}>
                    <CheckCircle className="h-3 w-3" />
                    Верифицирован
                  </span>
                ) : profileDocsStatus?.driversLicence.uploaded ? (
                  <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{
                      backgroundColor: withAlpha("#f59e0b", 0.15),
                      color: "#f59e0b",
                    }}>
                    ⏳ Ожидает верификации
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{
                      backgroundColor: withAlpha("#ef4444", 0.15),
                      color: "#ef4444",
                    }}>
                    ❌ Не загружен
                  </span>
                )}
              </div>
              {dbUser?.user_id && (
                <PhotoUploadButton
                  docType="drivers_licence"
                  rentalId={`profile_${dbUser.user_id}`}
                  chatId={dbUser.user_id}
                  onSuccess={() => {
                    getProfileDocsStatusAction({ slug, userId: dbUser.user_id }).then((res) => {
                      if (res.success && res.data) setProfileDocsStatus(res.data);
                    });
                  }}
                />
              )}
              {profileDocsStatus?.driversLicence.uploaded && !profileDocsStatus?.driversLicence.verified && (
                <p className="text-xs italic" style={{ color: T.textMuted }}>
                  Нельзя загрузить новое фото до верификации текущего
                </p>
              )}
            </div>
          </div>
        </FranchizeOperatorPanel>
      </motion.div>

      {/* Rental Documents Panel — editable via RentalDocsForm */}
      <motion.div variants={itemVariants}>
        <FranchizeOperatorPanel>
          <h2 className="flex items-center gap-2 text-base font-semibold " style={{ color: T.text }}>
            <Lock className="h-4 w-4" /> Документы для аренды
          </h2>
          <p className="mt-1 text-xs " style={{ color: T.textMuted }}>
            Заполните заранее — данные подставятся при оформлении. Проверяются оператором при первой аренде.
          </p>
          <div className="mt-3">
            {/* Verification status badge — text color is textPrimary so it
                stays readable in both light and dark themes (gold on gold
                washes out in light mode). */}
            {docsPrefill?.hasVerifiedData && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
                style={{
                  borderColor: withAlpha(T.accent, 0.35),
                  backgroundColor: withAlpha(T.accent, 0.12),
                  color: T.text,
                }}>
                <CheckCircle className="h-4 w-4" style={{ color: T.accent }} />
                <span>Документы верифицированы (завершённая аренда найдена)</span>
              </div>
            )}

            {/* Read-only summary of verified data from past rentals */}
            {rentalSecrets?.hasPreviousRentals && (
              <div className="mb-3 grid grid-cols-1 gap-1.5 text-xs " style={{ color: T.textMuted }}>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    Паспорт: <span className={rentalSecrets.savedData?.passport ? "" : ""} style={{ color: T.accent }}>
                      {rentalSecrets.savedData?.passport ? "✓ Сохранён" : "—"}
                    </span>
                  </div>
                  <div>
                    ВУ: <span className={rentalSecrets.savedData?.driverLicense ? "" : ""} style={{ color: T.accent }}>
                      {rentalSecrets.savedData?.driverLicense ? "✓ Сохранено" : "—"}
                    </span>
                  </div>
                  <div>
                    Дата рождения: <span className={rentalSecrets.savedData?.birthDate ? "" : ""} style={{ color: T.accent }}>
                      {rentalSecrets.savedData?.birthDate || "—"}
                    </span>
                  </div>
                  <div>
                    Категории: <span className={rentalSecrets.savedData?.licenseCategories ? "" : ""} style={{ color: T.accent }}>
                      {rentalSecrets.savedData?.licenseCategories || "—"}
                    </span>
                  </div>
                </div>
                {rentalSecrets.lastRentalDate && (
                  <div className="pt-0.5 opacity-60">
                    Последняя аренда: {rentalSecrets.lastRentalDate}
                  </div>
                )}
              </div>
            )}

            {/* Editable form — only inside Telegram WebApp (not browser) */}
            {dbUser?.user_id ? (
              <RentalDocsForm
                slug={slug}
                userId={dbUser.user_id}
                accentColor={T.accent}
                initialData={docsPrefill || undefined}
                onSave={async (data) => {
                  return saveRentalDocsPrefillAction({ slug, userId: dbUser.user_id, ...data });
                }}
              />
            ) : (
              <p className="py-4 text-center text-xs " style={{ color: T.textMuted }}>
                Откройте профиль в Telegram для ввода документов
              </p>
            )}
          </div>
        </FranchizeOperatorPanel>
      </motion.div>

      {/* Form Prefills Panel */}
      <motion.div variants={itemVariants}>
        <FranchizeOperatorPanel>
          <h2 className="flex items-center gap-2 text-base font-semibold " style={{ color: T.text }}>
            <VibeContentRenderer content="::FaClipboard::" /> Данные для заявок
          </h2>
          <p className="mt-1 text-xs " style={{ color: T.textMuted }}>
            Сохранённые данные будут автоматически подставляться в формы заявок
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <input
              className={franchizeOperatorInputClassName}
              style={franchizeOperatorInputStyle}
              placeholder="ФИО"
              value={prefill.fullName}
              onChange={(e) =>
                setPrefill((p) => ({ ...p, fullName: e.target.value }))
              }
            />
            <input
              className={franchizeOperatorInputClassName}
              style={franchizeOperatorInputStyle}
              placeholder="Телефон"
              value={prefill.phone}
              onChange={(e) =>
                setPrefill((p) => ({ ...p, phone: e.target.value }))
              }
            />
            <input
              className={franchizeOperatorInputClassName}
              style={franchizeOperatorInputStyle}
              placeholder="Удобное время"
              value={prefill.preferredTime}
              onChange={(e) =>
                setPrefill((p) => ({ ...p, preferredTime: e.target.value }))
              }
            />
            <input
              className={franchizeOperatorInputClassName}
              style={franchizeOperatorInputStyle}
              placeholder="Комментарий по умолчанию"
              value={prefill.comment}
              onChange={(e) =>
                setPrefill((p) => ({ ...p, comment: e.target.value }))
              }
            />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs " style={{ color: T.textMuted }}>
              Данные сохраняются локально для вашего аккаунта
            </p>
            <Button
              className="rounded-full font-semibold transition-all"
              disabled={isSaving}
              onClick={handlePrefillSave}
              style={{
                backgroundColor: T.accent,
                color: accentOn,
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? "Сохранение..." : saveSuccess ? "✓ Сохранено" : "Сохранить данные"}
            </Button>
          </div>
        </FranchizeOperatorPanel>
      </motion.div>

      {/* (Capability Contract Panel removed — not needed in profile) */}

      {/* Quick Actions — removed (Заявки, Map Riders not needed in profile) */}

      {/* Achievements Panel — at the very end */}
      <motion.div variants={itemVariants}>
        <FranchizeOperatorPanel>
          <h2 className="flex items-center gap-2 text-base font-semibold " style={{ color: T.text }}>
            <VibeContentRenderer content="::FaUserSecret::" /> Достижения
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {catalog.length === 0 ? (
              <EmptyState
                icon={<Trophy className="h-8 w-8" />}
                title="Нет достижений"
                description="Достижения появятся здесь по мере вашей активности"
              />
            ) : (
              catalog.map((achievement) => {
                const unlocked = unlockedSet.has(achievement.id);
                return (
                  <motion.div
                    key={achievement.id}
                    whileHover={{ scale: 1.02 }}
                    className={cn(
                      "relative overflow-hidden rounded-2xl border p-3 transition-all duration-300",
                      unlocked && "shadow-lg"
                    )}
                    style={{
                      borderColor: unlocked
                        ? T.accent
                        : T.borderSoft,
                      backgroundColor: unlocked
                        ? withAlpha(T.accent, 0.09)
                        : "color-mix(in srgb, var(--franchize-shell-card) 70%, transparent)",
                    }}
                  >
                    {/* Status indicator */}
                    <div className="absolute right-3 top-3">
                      {unlocked ? (
                        <div
                          className="flex h-6 w-6 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: withAlpha(T.accent, 0.2),
                            color: T.accent,
                          }}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </div>
                      ) : (
                        <div
                          className="flex h-6 w-6 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: "withAlpha(T.textMuted, 0.15)",
                            color: T.textMuted,
                          }}
                        >
                          <Lock className="h-4 w-4" />
                        </div>
                      )}
                    </div>

                    <p className="pr-8 text-sm font-semibold " style={{ color: T.text }}>
                      {achievement.title}
                    </p>
                    <p className="mt-1 text-xs " style={{ color: T.textMuted }}>
                      {achievement.description}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[11px]">
                      <span
                        className="rounded-full px-2 py-0.5"
                        style={{
                          backgroundColor: withAlpha(T.accent, 0.12),
                          color: unlocked
                            ? T.accent
                            : T.textMuted,
                        }}
                      >
                        {achievement.triggerSources[0] || "Система"}
                      </span>
                      {unlocked && (
                        <span className="" style={{ color: T.accent }}>
                          ✓ Разблокировано
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
          {!!error && <p className="text-xs text-red-400">{error}</p>}
        </FranchizeOperatorPanel>
      </motion.div>

      {/* Team Earnings Modal (for owners) */}
      <Dialog open={showTeamEarningsModal} onOpenChange={setShowTeamEarningsModal}>
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
                Период: с {new Date(earningsPeriod.from).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}{" "}
                по {new Date(earningsPeriod.to).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
              </span>
            </div>

            {/* Error message */}
            {teamEarningsError && (
              <div className="rounded px-3 py-2 text-sm" style={{ backgroundColor: "color-mix(in srgb, #ef4444 12%, transparent)", color: "#ef4444" }}>
                ⚠️ {teamEarningsError}
              </div>
            )}

            {/* Loading skeleton */}
            {teamEarningsLoading && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded" style={{ backgroundColor: "color-mix(in srgb, var(--franchize-shell-accent) 8%, transparent)" }} />
                ))}
              </div>
            )}

            {/* Leaderboard header with bonus info */}
            {!teamEarningsLoading && teamEarnings.length > 0 && (
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
            {!teamEarningsLoading && teamEarnings.length > 0 ? (
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
                      {teamEarnings
                        .sort((a, b) => b.total - a.total)
                        .map((member, rank) => {
                          // Bonus calculation: 10% for 1st, 5% for 2nd, 3% for 3rd
                          const bonusPercent = rank === 0 ? 0.10 : rank === 1 ? 0.05 : rank === 2 ? 0.03 : 0;
                          const bonus = Math.round(member.total * bonusPercent);
                          const totalWithBonus = member.total + bonus;
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
                          {teamEarnings.reduce((sum, m) => sum + m.shifts, 0).toFixed(1)}ч
                        </td>
                        <td className="px-3 py-2 text-right font-mono" style={{ color: T.text }}>
                          {formatCurrency(teamEarnings.reduce((sum, m) => sum + m.commissionIncome, 0))}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold" style={{ color: T.accent }}>
                          {formatCurrency(teamEarnings.reduce((sum, m) => sum + m.total, 0))}
                        </td>
                        <td className="px-3 py-2 text-right font-mono" style={{ color: T.textMuted }}>
                          —
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : !teamEarningsLoading ? (
                <div className="py-8 text-center text-sm" style={{ color: T.textMuted }}>
                  Нет данных о зарплатах за выбранный период
                </div>
              ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

