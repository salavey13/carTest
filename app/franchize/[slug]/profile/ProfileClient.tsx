"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
} from "@/app/franchize/profile-actions";
import {
  getFranchizeOperatorDashboardAccess,
  type FranchizeCrewVM,
} from "@/app/franchize/actions";
import { readablePaletteTextOnColor, withAlpha } from "@/app/franchize/lib/theme";
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";
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
  const params = useParams<{ slug: string }>();
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
      const [digestRes, prefillRes, operatorAccessRes, rentalSecretsRes] = await Promise.all([
        getFranchizeActivityDigestAction({ slug, userId: dbUser.user_id }),
        getFranchizeFormPrefillAction({ slug, userId: dbUser.user_id }),
        getFranchizeOperatorDashboardAccess({ slug }),
        getFranchizeUserRentalSecretsAction({ slug, userId: dbUser.user_id }),
      ]);
      if (digestRes.success && digestRes.data) setDigest(digestRes.data);
      if (prefillRes.success && prefillRes.data) setPrefill(prefillRes.data);
      if (rentalSecretsRes.success && rentalSecretsRes.data) setRentalSecrets(rentalSecretsRes.data);
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
  const accentOn = readablePaletteTextOnColor(
    crew.theme.palette.accentMain,
    crew.theme.palette,
  );
  const isAuto = crew.theme.isAuto;
  const palette = isAuto
    ? (crew.theme.palettes?.light || crew.theme.palettes?.dark || crew.theme.palette)
    : crew.theme.palette;

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
        // Profile-specific variables
        ["--fr-profile-accent" as string]: crew.theme.palette.accentMain,
        ["--fr-profile-border" as string]: crew.theme.palette.borderSoft,
        ["--fr-profile-text" as string]: crew.theme.palette.textPrimary,
        ["--fr-profile-muted" as string]: crew.theme.palette.textSecondary,
        // Shell variables for FranchizeOperatorPanel compatibility
        ["--franchize-shell-bg" as string]: isAuto ? "var(--franchize-bg-base)" : palette.bgBase,
        ["--franchize-shell-card" as string]: isAuto ? "var(--franchize-bg-card)" : palette.bgCard,
        ["--franchize-shell-border" as string]: isAuto ? "var(--franchize-border-soft)" : palette.borderSoft,
        ["--franchize-shell-text" as string]: isAuto ? "var(--franchize-text-primary)" : palette.textPrimary,
        ["--franchize-shell-muted" as string]: isAuto ? "var(--franchize-text-secondary)" : palette.textSecondary,
        ["--franchize-shell-accent" as string]: isAuto ? "var(--franchize-accent-main)" : palette.accentMain,
        ["--franchize-shell-primary-contrast" as string]: isAuto
          ? readablePaletteTextOnColor(crew.theme.palettes?.dark?.accentMain || crew.theme.palettes?.light?.accentMain || crew.theme.palette.accentMain, crew.theme.palettes?.dark || crew.theme.palettes?.light || crew.theme.palette)
          : readablePaletteTextOnColor(palette.accentMain, palette),
        ["--franchize-shell-ring" as string]: isAuto ? "var(--franchize-accent-main)" : palette.accentMain,
      }}
    >
      {/* Header Panel */}
      <motion.div variants={itemVariants}>
        <FranchizeOperatorPanel muted={false}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1">
              <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-[var(--fr-profile-accent)]">
                <VibeContentRenderer content="::FaIdBadge::" /> Профиль райдера
              </p>
              <h1 className="mt-2 break-words text-2xl font-semibold text-[var(--fr-profile-text)]">
                {profile?.crewName || crew.header.brandName || slug}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--fr-profile-muted)]">
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
              icon={<Trophy className="h-4 w-4" style={{ color: "var(--fr-profile-accent)" }} />}
            />
            <FranchizeOperatorStatCard
              label="Открытия профиля"
              value={profile?.counters?.profileOpenCount || 0}
              icon={<User className="h-4 w-4" style={{ color: "var(--fr-profile-accent)" }} />}
            />
            <FranchizeOperatorStatCard
              label="Последняя активность"
              value={profile?.lastActivityAt || "—"}
              icon={<Clock className="h-4 w-4" style={{ color: "var(--fr-profile-accent)" }} />}
            />
          </div>
        </FranchizeOperatorPanel>
      </motion.div>

      {/* Achievements Panel */}
      <motion.div variants={itemVariants}>
        <FranchizeOperatorPanel>
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--fr-profile-text)]">
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
                        ? "var(--fr-profile-accent)"
                        : "var(--fr-profile-border)",
                      backgroundColor: unlocked
                        ? withAlpha(crew.theme.palette.accentMain, 0.09)
                        : "color-mix(in srgb, var(--franchize-shell-card) 70%, transparent)",
                    }}
                  >
                    {/* Status indicator */}
                    <div className="absolute right-3 top-3">
                      {unlocked ? (
                        <div
                          className="flex h-6 w-6 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: withAlpha(crew.theme.palette.accentMain, 0.2),
                            color: crew.theme.palette.accentMain,
                          }}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </div>
                      ) : (
                        <div
                          className="flex h-6 w-6 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: "color-mix(in srgb, var(--fr-profile-muted) 15%, transparent)",
                            color: "var(--fr-profile-muted)",
                          }}
                        >
                          <Lock className="h-4 w-4" />
                        </div>
                      )}
                    </div>

                    <p className="pr-8 text-sm font-semibold text-[var(--fr-profile-text)]">
                      {achievement.title}
                    </p>
                    <p className="mt-1 text-xs text-[var(--fr-profile-muted)]">
                      {achievement.description}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[11px]">
                      <span
                        className="rounded-full px-2 py-0.5"
                        style={{
                          backgroundColor: withAlpha(crew.theme.palette.accentMain, 0.12),
                          color: unlocked
                            ? crew.theme.palette.accentMain
                            : "var(--fr-profile-muted)",
                        }}
                      >
                        {achievement.triggerSources[0] || "Система"}
                      </span>
                      {unlocked && (
                        <span className="text-[var(--fr-profile-accent)]">
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
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--fr-profile-text)]">
            <ShoppingCart className="h-4 w-4" /> Аренды и покупки
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Rentals section */}
            <div>
              <p className="mb-2 text-xs font-semibold text-[var(--fr-profile-muted)]">
                Текущие аренды
              </p>
              {digest?.rentals && digest.rentals.length > 0 ? (
                <div className="space-y-2">
                  {digest.rentals.slice(0, 3).map((r) => (
                    <Link
                      key={r.rentalId}
                      href={r.docLink}
                      className="block rounded-xl border p-3 text-sm transition hover:opacity-90 hover:shadow-md"
                      style={{
                        borderColor: "var(--fr-profile-border)",
                        backgroundColor: "color-mix(in srgb, var(--fr-profile-accent) 4%, transparent)",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[var(--fr-profile-text)]">
                          {r.vehicleLabel}
                        </span>
                        <MapPin className="h-3 w-3 text-[var(--fr-profile-muted)]" />
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-[var(--fr-profile-muted)]">
                        <span>{r.status}</span>
                      </div>
                    </Link>
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
              <p className="mb-2 text-xs font-semibold text-[var(--fr-profile-muted)]">
                Планируемые покупки
              </p>
              {digest?.buyOrders && digest.buyOrders.length > 0 ? (
                <div className="space-y-2">
                  {digest.buyOrders.slice(0, 3).map((o) => (
                    <Link
                      key={o.orderId}
                      href={o.docLink}
                      className="block rounded-xl border p-3 text-sm transition hover:opacity-90 hover:shadow-md"
                      style={{ borderColor: "var(--fr-profile-border)" }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-[var(--fr-profile-accent)]">
                          #{o.orderId}
                        </span>
                        <ShoppingCart className="h-3 w-3 text-[var(--fr-profile-muted)]" />
                      </div>
                      <div className="mt-1 text-xs text-[var(--fr-profile-text)]">
                        {o.status} · {o.vehicleIds.slice(0, 2).join(", ")}
                        {o.vehicleIds.length > 2 && ` +${o.vehicleIds.length - 2}`}
                      </div>
                      {o.docFileName && (
                        <div className="mt-1 text-xs text-[var(--fr-profile-muted)]">
                          📄 {o.docFileName}
                        </div>
                      )}
                    </Link>
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

      {/* Rental Documents Panel */}
      <motion.div variants={itemVariants}>
        <FranchizeOperatorPanel>
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--fr-profile-text)]">
            <Lock className="h-4 w-4" /> Документы для аренды
          </h2>
          <p className="mt-1 text-xs text-[var(--fr-profile-muted)]">
            Верифицированные документы из прошлых аренд для быстрого оформления
          </p>
          <div className="mt-3 rounded-xl border p-4" style={{
            borderColor: rentalSecrets?.hasPreviousRentals
              ? "var(--fr-profile-accent)"
              : "var(--fr-profile-border)",
            backgroundColor: rentalSecrets?.hasPreviousRentals
              ? withAlpha(crew.theme.palette.accentMain, 0.09)
              : "color-mix(in srgb, var(--franchize-shell-card) 70%, transparent)",
          }}>
            {rentalSecrets?.hasPreviousRentals ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full" style={{
                    backgroundColor: withAlpha(crew.theme.palette.accentMain, 0.2),
                    color: crew.theme.palette.accentMain,
                  }}>
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-semibold text-[var(--fr-profile-accent)]">
                    Документы верифицированы
                  </span>
                </div>
                {rentalSecrets.lastRentalDate && (
                  <p className="text-xs text-[var(--fr-profile-muted)]">
                    Последняя аренда: {rentalSecrets.lastRentalDate}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--fr-profile-muted)]">Паспорт:</span>
                    <span className={rentalSecrets.savedData?.passport ? "text-[var(--fr-profile-accent)]" : "text-[var(--fr-profile-muted)]"}>
                      {rentalSecrets.savedData?.passport ? "✓ Сохранён" : "Не добавлен"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--fr-profile-muted)]">Вод. удостоверение:</span>
                    <span className={rentalSecrets.savedData?.driverLicense ? "text-[var(--fr-profile-accent)]" : "text-[var(--fr-profile-muted)]"}>
                      {rentalSecrets.savedData?.driverLicense ? "✓ Сохранено" : "Не добавлено"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <Lock className="h-8 w-8 text-[var(--fr-profile-muted)] mb-2" />
                <p className="text-sm font-semibold text-[var(--fr-profile-text)]">
                  Нет верифицированных документов
                </p>
                <p className="mt-1 text-xs text-[var(--fr-profile-muted)]">
                  После первой аренды ваши документы будут сохранены здесь
                </p>
              </div>
            )}
          </div>
        </FranchizeOperatorPanel>
      </motion.div>

      {/* Form Prefills Panel */}
      <motion.div variants={itemVariants}>
        <FranchizeOperatorPanel>
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--fr-profile-text)]">
            <VibeContentRenderer content="::FaClipboard::" /> Данные для заявок
          </h2>
          <p className="mt-1 text-xs text-[var(--fr-profile-muted)]">
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
            <p className="text-xs text-[var(--fr-profile-muted)]">
              Данные сохраняются локально для вашего аккаунта
            </p>
            <Button
              className="rounded-full font-semibold transition-all"
              disabled={isSaving}
              onClick={handlePrefillSave}
              style={{
                backgroundColor: "var(--fr-profile-accent)",
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
                <h2 className="text-base font-semibold text-[var(--fr-profile-text)]">
                  Контракт интеграций
                </h2>
                <span className="text-xs text-[var(--fr-profile-muted)]">
                  {Object.keys(capabilityContract).length} активных
                </span>
              </summary>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Object.entries(capabilityContract).map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-lg border p-2"
                    style={{
                      borderColor: "var(--fr-profile-border)",
                      backgroundColor: "color-mix(in srgb, var(--fr-profile-accent) 4%, transparent)",
                    }}
                  >
                    <p className="text-xs font-semibold text-[var(--fr-profile-accent)]">
                      {key}
                    </p>
                    <p className="mt-1 text-xs text-[var(--fr-profile-muted)]">
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
        className="grid grid-cols-1 gap-3 md:grid-cols-3"
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
        <FranchizeOperatorLinkButton href="/profile" variant="secondary">
          <VibeContentRenderer content="::FaUser::" className="mr-2" />
          Главный профиль
        </FranchizeOperatorLinkButton>
      </motion.div>
    </motion.div>
  );
}
