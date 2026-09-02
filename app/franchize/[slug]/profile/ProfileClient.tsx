"use client";

// ProfileClient.tsx (franchize profile, iter31)
// ──────────────────────────────────────────────────────────────────────────
// The page was split into per-domain panel components under ./components/ —
// the file had grown past 2.5k lines and every new feature touched it.
// This file now owns ONLY: identity/theme, the master data load, the
// owner-cash store (shared between the wallet panel and the payout
// actions), and the composition of panels.
//
// Panels (each self-contained unless noted):
//   ProfileHeaderPanel        — hero + stat cards
//   RentalsPurchasesPanel     — my rentals + buy orders (digest)
//   SubrenterMyBikesPanel     — partner's bikes + monthly cut (own fetch)
//   SubrentersOverviewPanel   — owner/admin partner list + payout sheet
//                               (own fetch; writes via owner cash)
//   OwnerCashWalletPanel      — «Кошелёк владельца» (data owned here)
//   MyEarningsPanel           — pay-period + monthly earnings (own fetch)
//   MyWorkPanel               — per-day work stats (own fetch)
//   CrewOperationsPanel       — quick links
//   DocumentPhotosPanel /
//   RentalDocsPanel /
//   FormPrefillsPanel         — document & form prefills
//   AchievementsPanel         — gamification grid

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
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
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";
import { useCrewTokens } from "@/app/franchize/lib/use-crew-tokens";
import { getTelegramInitData } from "@/lib/telegram-webapp-init-data";
import {
  getSubrenterOwnedBikesAction,
  getFranchizeSubrentersOverviewAction,
  type SubrenterOwnedBikesData,
  type SubrenterOverviewRow,
} from "@/app/franchize/server-actions/subrenter-monitoring";
import {
  addOwnerCashEntryAction,
  deleteOwnerCashEntryAction,
  getOwnerCashMonthAction,
  type OwnerCashMonthData,
} from "@/app/franchize/server-actions/owner-cash";
import { currentMskMonthKey } from "@/app/franchize/lib/subrenter-economics";

// 2026-08-19 review: use the shared fallbackCrew constant from
// lib/fallback-crew.ts — was duplicated inline here, which meant it
// drifted from the canonical version (missing reservationHold,
// contentBlocks, cta fields after the type was extended).
import { fallbackCrew } from "@/app/franchize/lib/fallback-crew";

import {
  containerVariants,
  ProfileSkeleton,
  type ProfileDocsStatusState,
  type RentalSecretsState,
  type OwnerCashFormValues,
} from "./components/profile-shared";
import { ProfileHeaderPanel } from "./components/ProfileHeaderPanel";
import { RentalsPurchasesPanel } from "./components/RentalsPurchasesPanel";
import { SubrenterMyBikesPanel } from "./components/SubrenterMyBikesPanel";
import { SubrentersOverviewPanel } from "./components/SubrentersOverviewPanel";
import { OwnerCashWalletPanel } from "./components/OwnerCashWalletPanel";
import { MyEarningsPanel } from "./components/MyEarningsPanel";
import { MyWorkPanel } from "./components/MyWorkPanel";
import { CrewOperationsPanel } from "./components/CrewOperationsPanel";
import {
  DocumentPhotosPanel,
  RentalDocsPanel,
  FormPrefillsPanel,
  type RentalDocsPrefillState,
} from "./components/ProfileDocumentsPanels";
import { AchievementsPanel } from "./components/AchievementsPanel";

type FranchizeProfileClientProps = {
  initialCrew?: FranchizeCrewVM;
  initialSlug?: string;
};

export function FranchizeProfileClient({
  initialCrew,
  initialSlug,
}: FranchizeProfileClientProps) {
  const { dbUser, isLoading: authLoading } = useAppContext();

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
  const [rentalSecrets, setRentalSecrets] = useState<RentalSecretsState | null>(null);
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

  // Subrent partner monitoring (iter12): the user's OWN partner bikes
  // (specs.subrenter_chat_id = his chat id) and, for crew owner/admins,
  // the dedicated subrenters list. Owned here (not in the panels) because
  // both drive cross-panel behavior: the overview gate doubles as the
  // owner-cash permission check, and payout writes reload the wallet.
  const [subrenterOwned, setSubrenterOwned] = useState<SubrenterOwnedBikesData | null>(null);
  const [subrentersOverview, setSubrentersOverview] = useState<SubrenterOverviewRow[] | null>(null);
  const [subrenterMonth, setSubrenterMonth] = useState(() => currentMskMonthKey());

  // Owner cash wallet («Кошелёк владельца») — personal money movements +
  // subrenter payouts, owner/admin only. null = нет прав / не загружено.
  // 2026-09-02 fix (C1): visibility derives from the wallet fetch itself —
  // the old sticky `ownerCashHidden` flag was set true on mount (overview
  // still null) and never reset, so the panel could never render. Probing is
  // gated on canOpenCloserDashboard so ordinary renters fire zero wallet calls.
  const [ownerCash, setOwnerCash] = useState<OwnerCashMonthData | null>(null);
  const [ownerCashDenied, setOwnerCashDenied] = useState(false);
  const [ownerCashMonth, setOwnerCashMonth] = useState(() => currentMskMonthKey());
  const [ownerCashLoading, setOwnerCashLoading] = useState(false);
  const [ownerCashBusy, setOwnerCashBusy] = useState(false);
  // Stale-response guard: only the answer for the CURRENT month may land.
  const ownerCashMonthRef = useRef(ownerCashMonth);
  useEffect(() => {
    ownerCashMonthRef.current = ownerCashMonth;
  }, [ownerCashMonth]);

  // Pre-entered rental docs (passport/license) from private.user_rental_secrets
  const [docsPrefill, setDocsPrefill] = useState<RentalDocsPrefillState | null>(null);
  // Profile document photos status (uploaded/verified)
  const [profileDocsStatus, setProfileDocsStatus] = useState<ProfileDocsStatusState | null>(null);

  useEffect(() => {
    const run = async () => {
      // 2026-09-02 fix: hold the skeleton while the Telegram session is still
      // resolving — the early return used to flash an empty page, then load.
      if (authLoading) return;
      if (!dbUser?.user_id) {
        setIsLoading(false);
        return;
      }
      let cancelled = false;
      try {
        const result = await getFranchizeProfileBySlugAction({
          slug,
          userId: dbUser.user_id,
        });
        if (cancelled) return;
        if (!result.success || !result.data) {
          setError(result.error || "Не удалось загрузить франшизный профиль.");
          return;
        }
        setProfile(result.data);
        setCatalog(result.catalog || []);
        const [digestRes, prefillRes, operatorAccessRes, rentalSecretsRes, docsRes, profileDocsRes, subrenterOwnedRes, subrentersOverviewRes] = await Promise.all([
          getFranchizeActivityDigestAction({ slug, userId: dbUser.user_id }),
          getFranchizeFormPrefillAction({ slug, userId: dbUser.user_id }),
          getFranchizeOperatorDashboardAccess({ slug }),
          getFranchizeUserRentalSecretsAction({ slug, userId: dbUser.user_id }),
          getRentalDocsPrefillAction({ slug, userId: dbUser.user_id }),
          getProfileDocsStatusAction({ slug, userId: dbUser.user_id }),
          // Partner monitoring — never blocks the profile: failures are swallowed.
          getSubrenterOwnedBikesAction({ slug, userId: dbUser.user_id, initData: getTelegramInitData() }).catch(() => null),
          getFranchizeSubrentersOverviewAction({ slug, actorUserId: dbUser.user_id, initData: getTelegramInitData() }).catch(() => null),
        ]);
        if (cancelled) return;
        if (digestRes.success && digestRes.data) setDigest(digestRes.data);
        if (prefillRes.success && prefillRes.data) setPrefill(prefillRes.data);
        if (rentalSecretsRes.success && rentalSecretsRes.data) setRentalSecrets(rentalSecretsRes.data);
        if (docsRes.success && docsRes.data) setDocsPrefill(docsRes.data);
        if (profileDocsRes.success && profileDocsRes.data) setProfileDocsStatus(profileDocsRes.data);
        if (subrenterOwnedRes?.success && subrenterOwnedRes.data) setSubrenterOwned(subrenterOwnedRes.data);
        if (subrentersOverviewRes?.success && subrentersOverviewRes.data) setSubrentersOverview(subrentersOverviewRes.data);
        setCanOpenCloserDashboard(
          Boolean(operatorAccessRes.success && operatorAccessRes.canOpen),
        );
        // 2026-09-02 fix: the achievement write used to be awaited BEFORE the
        // first paint — it is a non-critical counter bump, so fire-and-forget.
        void grantFranchizeAchievementAction({
          slug,
          userId: dbUser.user_id,
          achievementId: "franchize_profile_opened",
          source: "web:franchize_profile",
          context: { path: `/franchize/${slug}/profile` },
          incrementCounters: { profileOpenCount: 1 },
        }).catch(() => undefined);
      } catch (err) {
        // M1 fix: a thrown server action used to leave the skeleton forever.
        console.error("[FranchizeProfileClient] master load failed:", err);
        setError("Не удалось загрузить профиль. Попробуйте обновить страницу.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true; // stale-response race guard (session refresh / unmount)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbUser?.user_id, slug, authLoading]);

  // ── Owner cash wallet loader (2026-09-02 rewrite).
  // Probes only when canOpenCloserDashboard is true (owner/co_owner/admin ⊂
  // crew operators) — renters fire zero wallet calls. The wallet action
  // enforces permission server-side; a "Недостаточно прав" answer just hides
  // the panel for this user. A month-ref guard keeps a slow response for a
  // previous month from overwriting the current one.
  const reloadOwnerCash = useCallback(() => {
    if (!dbUser?.user_id || !slug || !canOpenCloserDashboard) return;
    let cancelled = false;
    setOwnerCashLoading(true);
    getOwnerCashMonthAction({
      slug,
      actorUserId: dbUser.user_id,
      month: ownerCashMonthRef.current,
      initData: getTelegramInitData(),
    })
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          // Stale-response guard: only the CURRENT month's payload may land.
          if (res.data.month === ownerCashMonthRef.current) setOwnerCash(res.data);
          setOwnerCashDenied(false);
        } else {
          // Hide only on a real permission denial; transient failures keep
          // the last state so a month switch / retry can still recover.
          if (res.error?.includes("Недостаточно прав")) setOwnerCashDenied(true);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setOwnerCashLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dbUser?.user_id, slug, canOpenCloserDashboard]);

  useEffect(() => {
    const cleanup = reloadOwnerCash();
    return cleanup;
  }, [reloadOwnerCash, ownerCashMonth]);

  const submitOwnerCash = async (form: OwnerCashFormValues): Promise<boolean> => {
    if (!dbUser?.user_id) return false;
    const amount = Number(String(form.amount || "").replace(/[^\d.]/g, ""));
    if (!amount || amount <= 0) {
      toast.error("Укажите сумму");
      return false;
    }
    if (!form.title.trim()) {
      toast.error("Укажите, за что / от кого");
      return false;
    }
    setOwnerCashBusy(true);
    try {
      const res = await addOwnerCashEntryAction({
        slug,
        actorUserId: dbUser.user_id,
        direction: form.direction,
        kind: form.kind,
        amount,
        title: form.title.trim(),
        person: form.person.trim() || undefined,
        initData: getTelegramInitData(),
      });
      if (res.success) {
        toast.success("Записано в кошелёк владельца");
        reloadOwnerCash();
        return true;
      }
      toast.error(res.error || "Не удалось записать");
      return false;
    } catch {
      // m2 fix: a network throw used to escape as an unhandled rejection.
      toast.error("Не удалось записать — нет связи.");
      return false;
    } finally {
      setOwnerCashBusy(false);
    }
  };

  // iter35: per-entry delete guard — the two-tap «Удалить» used to fire
  // deleteOwnerCashEntryAction repeatedly on rapid taps (double toast).
  const [ownerCashRemovingId, setOwnerCashRemovingId] = useState<string | null>(null);
  const removeOwnerCash = async (id: string) => {
    if (!dbUser?.user_id || ownerCashRemovingId) return;
    setOwnerCashRemovingId(id);
    try {
      const res = await deleteOwnerCashEntryAction({
        slug,
        actorUserId: dbUser.user_id,
        id,
        initData: getTelegramInitData(),
      });
      if (res.success) {
        toast.success("Удалено");
        reloadOwnerCash();
      } else {
        toast.error(res.error || "Не удалось удалить");
      }
    } catch {
      toast.error("Не удалось удалить — нет связи.");
    } finally {
      setOwnerCashRemovingId(null);
    }
  };

  const handlePrefillSave = async () => {
    if (!dbUser?.user_id) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await saveFranchizeFormPrefillAction({
        slug,
        userId: dbUser.user_id,
        prefill,
      });
      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        // M3 fix: renters never saw this error (it rendered only inside the
        // crew-gated AchievementsPanel) — surface it immediately.
        setError(res.error || "Не удалось сохранить поля.");
        toast.error(res.error || "Не удалось сохранить поля.");
      }
    } catch {
      toast.error("Не удалось сохранить — нет связи.");
    } finally {
      setIsSaving(false);
    }
  };

  const unlockedSet = useMemo(
    () => new Set(Object.keys(profile?.achievements || {})),
    [profile?.achievements],
  );
  const unlockedCount = useMemo(
    () => catalog.filter((item) => unlockedSet.has(item.id)).length,
    [catalog, unlockedSet],
  );

  if (isLoading) {
    return <ProfileSkeleton />;
  }

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
      {/* M3 fix: top-level error banner — profile load / save failures were
          previously rendered ONLY inside the crew-gated AchievementsPanel,
          so ordinary renters saw a silently empty page. */}
      {error && (
        <div
          className="flex items-start gap-2 rounded-xl border px-4 py-3 text-sm"
          style={{
            background: "rgba(239,68,68,0.08)",
            borderColor: "rgba(239,68,68,0.35)",
            color: "#ef4444",
          }}
          role="alert"
        >
          <span className="flex-1">{error}</span>
          <button
            type="button"
            className="shrink-0 font-medium underline underline-offset-2"
            onClick={() => setError(null)}
          >
            Закрыть
          </button>
        </div>
      )}

      {/* Header Panel */}
      <ProfileHeaderPanel
        crewName={profile?.crewName || crew.header.brandName || slug}
        slug={slug}
        unlockedCount={unlockedCount}
        achievementsTotal={catalog.length}
        shiftsCompleted={profile?.counters?.shiftsCompleted || 0}
        totalHoursWorked={profile?.counters?.totalHoursWorked || 0}
        T={T}
      />

      {/* Rentals and Purchases Panel */}
      <RentalsPurchasesPanel
        digest={digest}
        slug={slug}
        T={T}
        navigateSpa={navigateSpa}
      />

      {/* Subrenter panel: rentals of MY bikes in the park (partner monitoring).
          The panel fetches its own monthly earnings when the month changes. */}
      {subrenterOwned && subrenterOwned.bikes.length > 0 && (
        <SubrenterMyBikesPanel
          owned={subrenterOwned}
          month={subrenterMonth}
          onMonthChange={setSubrenterMonth}
          slug={slug}
          userId={dbUser?.user_id || ""}
          T={T}
          navigateSpa={navigateSpa}
        />
      )}

      {/* Crew owner/admin panel: dedicated subrenters list + payout sheet */}
      {subrentersOverview && subrentersOverview.length > 0 && (
        <SubrentersOverviewPanel
          rows={subrentersOverview}
          slug={slug}
          userId={dbUser?.user_id || ""}
          T={T}
          navigateSpa={navigateSpa}
          onPayoutRecorded={reloadOwnerCash}
        />
      )}

      {/* Owner cash wallet («Кошелёк владельца») — owner/admin only.
          2026-09-02: gate = the wallet data itself (ownerCashDenied only
          suppresses the panel; data presence implies permission). */}
      {ownerCash && !ownerCashDenied && (
        <OwnerCashWalletPanel
          data={ownerCash}
          loading={ownerCashLoading}
          busy={ownerCashBusy}
          month={ownerCashMonth}
          onMonthChange={setOwnerCashMonth}
          onSubmit={submitOwnerCash}
          onRemove={(id) => void removeOwnerCash(id)}
          removingId={ownerCashRemovingId}
          T={T}
        />
      )}

      {/* My Earnings Panel — CREW ONLY (iter14): hidden for ordinary renters.
          Self-contained: it loads its own data only when rendered. */}
      {canOpenCloserDashboard && (
        <MyEarningsPanel
          slug={slug}
          userId={dbUser?.user_id || ""}
          enabled={canOpenCloserDashboard}
          T={T}
        />
      )}

      {/* My Work Panel — CREW ONLY (iter14): shift/commission work stats are
          internal crew info, hidden for ordinary renters. */}
      {canOpenCloserDashboard && (
        <MyWorkPanel slug={slug} enabled={canOpenCloserDashboard} T={T} />
      )}

      {/* Crew Operations Panel — shown only for crew members */}
      {canOpenCloserDashboard && <CrewOperationsPanel slug={slug} T={T} />}

      {/* Profile Document Photos Panel */}
      <DocumentPhotosPanel
        slug={slug}
        userId={dbUser?.user_id || null}
        docsPrefill={docsPrefill}
        docsStatus={profileDocsStatus}
        onDocsStatus={setProfileDocsStatus}
        T={T}
      />

      {/* Rental Documents Panel — editable via RentalDocsForm */}
      <RentalDocsPanel
        slug={slug}
        userId={dbUser?.user_id || null}
        docsPrefill={docsPrefill}
        rentalSecrets={rentalSecrets}
        T={T}
      />

      {/* Form Prefills Panel */}
      <FormPrefillsPanel
        prefill={prefill}
        onPrefillChange={setPrefill}
        onSave={() => void handlePrefillSave()}
        isSaving={isSaving}
        saveSuccess={saveSuccess}
        T={T}
      />

      {/* Achievements Panel — at the very end — CREW ONLY (iter14):
          crew gamification is not for ordinary renters. */}
      {canOpenCloserDashboard && (
        <AchievementsPanel
          catalog={catalog}
          unlockedSet={unlockedSet}
          error={error}
          T={T}
        />
      )}
    </motion.div>
  );
}
