"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Trophy, MapPin, ShoppingCart, Lock, CheckCircle, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/contexts/AppContext";
import {
  getFranchizeCapabilityContractAction,
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
} from "@/app/franchize/profile-actions";
import {
  getFranchizeOperatorDashboardAccess,
  type FranchizeCrewVM,
} from "@/app/franchize/actions";
import { readablePaletteTextOnColor, withAlpha } from "@/app/franchize/lib/theme";
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";
import { useCrewTokens } from "@/app/franchize/lib/use-crew-tokens";
import { RentalDocsForm } from "../../components/RentalDocsForm";
import {
  FranchizeOperatorLinkButton,
  FranchizeOperatorPanel,
  FranchizeOperatorStatCard,
  franchizeOperatorInputClassName,
  franchizeOperatorInputStyle,
} from "../../components/FranchizeOperatorSurface";

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
  footer: { socialLinks: [], textColor: "#16130A" },
};

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
  const [capabilityContract, setCapabilityContract] = useState<
    Record<string, string>
  >({});
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
  // Pre-entered rental docs (passport/license) from private.user_rental_secrets
  const [docsPrefill, setDocsPrefill] = useState<{
    fullName?: string; phone?: string; birthDate?: string;
    passportSeries?: string; passportNumber?: string; passportIssuedBy?: string;
    passportIssueDate?: string; registrationAddress?: string;
    licenseSeries?: string; licenseNumber?: string; licenseCategories?: string;
    licenseExpiryDate?: string; verificationStatus?: string; hasVerifiedData?: boolean;
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
      const capabilities = await getFranchizeCapabilityContractAction();
      setCapabilityContract(capabilities);
      const [digestRes, prefillRes, operatorAccessRes, rentalSecretsRes, docsRes] = await Promise.all([
        getFranchizeActivityDigestAction({ slug, userId: dbUser.user_id }),
        getFranchizeFormPrefillAction({ slug, userId: dbUser.user_id }),
        getFranchizeOperatorDashboardAccess({ slug }),
        getFranchizeUserRentalSecretsAction({ slug, userId: dbUser.user_id }),
        getRentalDocsPrefillAction({ slug, userId: dbUser.user_id }),
      ]);
      if (digestRes.success && digestRes.data) setDigest(digestRes.data);
      if (prefillRes.success && prefillRes.data) setPrefill(prefillRes.data);
      if (rentalSecretsRes.success && rentalSecretsRes.data) setRentalSecrets(rentalSecretsRes.data);
      if (docsRes.success && docsRes.data) setDocsPrefill(docsRes.data);
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
    };
    void run();
  }, [dbUser?.user_id, slug]);

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
              label="Открытия профиля"
              value={profile?.counters?.profileOpenCount || 0}
              icon={<User className="h-4 w-4" style={{ color: T.accent }} />}
            />
            <FranchizeOperatorStatCard
              label="Последняя активность"
              value={profile?.lastActivityAt || "—"}
              icon={<Clock className="h-4 w-4" style={{ color: T.accent }} />}
            />
          </div>
        </FranchizeOperatorPanel>
      </motion.div>

      {/* Achievements Panel */}
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
                Текущие аренды
              </p>
              {digest?.rentals && digest.rentals.length > 0 ? (
                <div className="space-y-2">
                  {digest.rentals.slice(0, 3).map((r) => (
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
                      className="block cursor-pointer rounded-xl border p-3 text-sm transition hover:opacity-90 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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
                          <span style={T.styles.accentBadge} className="rounded-full px-2 py-0.5 text-[10px]">
                            Тест-драйв
                          </span>
                        ) : (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px]"
                            style={{
                              ...T.styles.accentPill,
                              opacity: r.status === "active" ? 1 : 0.6,
                            }}
                          >
                            {r.status === "active" ? "Активна" : r.status}
                          </span>
                        )}
                      </div>
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

      {/* Capability Contract Panel - Collapsed by default */}
      {Object.keys(capabilityContract).length > 0 && (
        <motion.div variants={itemVariants}>
          <details className="group">
            <FranchizeOperatorPanel className="cursor-pointer transition hover:opacity-80">
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <h2 className="text-base font-semibold " style={{ color: T.text }}>
                  Контракт интеграций
                </h2>
                <span className="text-xs " style={{ color: T.textMuted }}>
                  {Object.keys(capabilityContract).length} активных
                </span>
              </summary>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Object.entries(capabilityContract).map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-lg border p-2"
                    style={{
                      borderColor: T.borderSoft,
                      backgroundColor: "withAlpha(T.accent, 0.04)",
                    }}
                  >
                    <p className="text-xs font-semibold " style={{ color: T.accent }}>
                      {key}
                    </p>
                    <p className="mt-1 text-xs " style={{ color: T.textMuted }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </FranchizeOperatorPanel>
          </details>
        </motion.div>
      )}

      {/* Quick Actions */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        {canOpenCloserDashboard && (
          <FranchizeOperatorLinkButton href={`/franchize/${slug}/dashboard`}>
            <VibeContentRenderer content="::FaChartBar::" className="mr-2" />
            Заявки
          </FranchizeOperatorLinkButton>
        )}
        <FranchizeOperatorLinkButton href={`/franchize/${slug}/map-riders`}>
          <VibeContentRenderer content="::FaMap::" className="mr-2" />
          Map Riders
        </FranchizeOperatorLinkButton>
      </motion.div>
    </motion.div>
  );
}
