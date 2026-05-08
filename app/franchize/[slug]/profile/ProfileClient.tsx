"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import VibeContentRenderer from "@/components/VibeContentRenderer";
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
} from "@/app/franchize/profile-actions";
import {
  getFranchizeOperatorDashboardAccess,
  type FranchizeCrewVM,
} from "@/app/franchize/actions";
import { readablePaletteTextOnColor } from "@/app/franchize/lib/theme";
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

export function FranchizeProfileClient({
  initialCrew,
  initialSlug,
}: FranchizeProfileClientProps) {
  const { dbUser } = useAppContext();
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
      if (!dbUser?.user_id) return;
      const result = await getFranchizeProfileBySlugAction({
        slug,
        userId: dbUser.user_id,
      });
      if (!result.success || !result.data) {
        setError(result.error || "Не удалось загрузить франшизный профиль.");
        return;
      }
      setProfile(result.data);
      setCatalog(result.catalog || []);
      const capabilities = await getFranchizeCapabilityContractAction();
      setCapabilityContract(capabilities);
      const [digestRes, prefillRes, operatorAccessRes] = await Promise.all([
        getFranchizeActivityDigestAction({ slug, userId: dbUser.user_id }),
        getFranchizeFormPrefillAction({ slug, userId: dbUser.user_id }),
        getFranchizeOperatorDashboardAccess({ slug }),
      ]);
      if (digestRes.success && digestRes.data) setDigest(digestRes.data);
      if (prefillRes.success && prefillRes.data) setPrefill(prefillRes.data);
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

  const handlePrefillSave = async () => {
    if (!dbUser?.user_id) return;
    const res = await saveFranchizeFormPrefillAction({
      slug,
      userId: dbUser.user_id,
      prefill,
    });
    if (!res.success) setError(res.error || "Не удалось сохранить поля.");
  };

  return (
    <div
      className="space-y-4"
      style={{
        ["--fr-profile-accent" as string]: crew.theme.palette.accentMain,
        ["--fr-profile-border" as string]: crew.theme.palette.borderSoft,
        ["--fr-profile-text" as string]: crew.theme.palette.textPrimary,
        ["--fr-profile-muted" as string]: crew.theme.palette.textSecondary,
      }}
    >
      <FranchizeOperatorPanel muted={false}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
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
            detail={`slug: ${slug}`}
          />
          <FranchizeOperatorStatCard
            label="Открытия профиля"
            value={profile?.counters?.profileOpenCount || 0}
          />
          <FranchizeOperatorStatCard
            label="Последняя активность"
            value={profile?.lastActivityAt || "—"}
          />
        </div>
      </FranchizeOperatorPanel>

      <FranchizeOperatorPanel>
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--fr-profile-text)]">
          <VibeContentRenderer content="::FaUserSecret::" /> Достижения
        </h2>
        <div className="mt-3 space-y-2">
          {catalog.map((achievement) => {
            const unlocked = unlockedSet.has(achievement.id);
            return (
              <div
                key={achievement.id}
                className="rounded-2xl border p-3"
                style={{
                  borderColor: unlocked
                    ? "var(--fr-profile-accent)"
                    : "var(--fr-profile-border)",
                  backgroundColor: unlocked
                    ? "color-mix(in srgb, var(--franchize-shell-accent) 9%, transparent)"
                    : "color-mix(in srgb, var(--franchize-shell-card) 70%, transparent)",
                }}
              >
                <p className="text-sm font-semibold text-[var(--fr-profile-text)]">
                  {achievement.title}
                </p>
                <p className="mt-1 text-xs text-[var(--fr-profile-muted)]">
                  {achievement.description}
                </p>
                <p className="mt-1 text-[11px] text-[var(--fr-profile-accent)]">
                  Источник: {achievement.triggerSources.join(", ")}
                </p>
                <p className="mt-1 text-[11px] text-[var(--fr-profile-muted)]">
                  {unlocked ? "✅ Разблокировано" : "🔒 Заблокировано"}
                </p>
              </div>
            );
          })}
          {!!error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </FranchizeOperatorPanel>

      <FranchizeOperatorPanel>
        <h2 className="text-base font-semibold text-[var(--fr-profile-text)]">
          Контракт интеграций
        </h2>
        <div className="mt-3 space-y-1">
          {Object.entries(capabilityContract).map(([key, value]) => (
            <p key={key} className="text-xs text-[var(--fr-profile-muted)]">
              <span className="font-semibold text-[var(--fr-profile-accent)]">
                {key}:
              </span>{" "}
              {value}
            </p>
          ))}
        </div>
      </FranchizeOperatorPanel>

      <FranchizeOperatorPanel>
        <h2 className="text-base font-semibold text-[var(--fr-profile-text)]">
          Данные для заявок
        </h2>
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
          <Button
            className="md:col-span-2 rounded-full font-semibold"
            onClick={handlePrefillSave}
            style={{
              backgroundColor: "var(--fr-profile-accent)",
              color: accentOn,
            }}
          >
            Сохранить данные
          </Button>
        </div>
      </FranchizeOperatorPanel>

      <FranchizeOperatorPanel>
        <h2 className="text-base font-semibold text-[var(--fr-profile-text)]">
          Аренды и покупки
        </h2>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-[var(--fr-profile-muted)]">
            Текущие аренды
          </p>
          {(digest?.rentals || []).slice(0, 5).map((r) => (
            <Link
              key={r.rentalId}
              href={r.docLink}
              className="block rounded-2xl border p-3 text-sm transition hover:opacity-90"
              style={{ borderColor: "var(--fr-profile-border)" }}
            >
              <span className="font-semibold">{r.vehicleLabel}</span> ·{" "}
              <span className="opacity-80">{r.status}</span>
            </Link>
          ))}
          <p className="pt-2 text-xs text-[var(--fr-profile-muted)]">
            Планируемые покупки
          </p>
          {(digest?.buyOrders || []).slice(0, 5).map((o) => (
            <Link
              key={o.orderId}
              href={o.docLink}
              className="block rounded-2xl border p-3 text-sm transition hover:opacity-90"
              style={{ borderColor: "var(--fr-profile-border)" }}
            >
              Заказ #{o.orderId} · {o.status} · {o.vehicleIds.join(", ")}
              {o.docFileName ? (
                <span className="mt-1 block text-xs text-[var(--fr-profile-muted)]">
                  Документ: {o.docFileName}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </FranchizeOperatorPanel>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {canOpenCloserDashboard && (
          <FranchizeOperatorLinkButton href={`/franchize/${slug}/dashboard`}>
            Заявки
          </FranchizeOperatorLinkButton>
        )}
        <FranchizeOperatorLinkButton href={`/franchize/${slug}/map-riders`}>
          Map Riders
        </FranchizeOperatorLinkButton>
        <FranchizeOperatorLinkButton href="/profile" variant="secondary">
          Главный профиль
        </FranchizeOperatorLinkButton>
      </div>
    </div>
  );
}
