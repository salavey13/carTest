// /app/franchize/[slug]/rental/[id]/page.tsx
import type { Metadata } from "next";
import { ExternalLink, Info } from "lucide-react";
import { getFranchizeBySlug, getFranchizeRentalCard } from "../../../actions";
import { CrewHeader } from "../../../components/CrewHeader";
// goodmorning-polish: removed CrewFooter import (footer ditched on rental page)
import { FranchizeErrorBoundary } from "../../../components/ErrorBoundary";
import { DisplayModeProvider } from "../../../components/DisplayModeContext";
import { FranchizeRentalLifecycleActions } from "../../../components/FranchizeRentalLifecycleActions";
// goodmorning-polish: removed FranchizePageShell import — replaced with plain <div>
// to avoid backdrop-blur breaking position:fixed on QuickActionBar + excessive padding.
import { FranchizeRentalDocumentsPanel } from "../../../components/FranchizeRentalDocumentsPanel";
// goodmorning-polish: removed RentalChecklistPanel import (broken local-state toggle,
// was duplicating RentalReturnChecklist which persists via API)
import { RentalMessageInput } from "../../../components/RentalMessageInput";
import { RentalReturnChecklist } from "../../../components/RentalReturnChecklist";
// goodmorning-polish: removed RentalTelegramGuard import (no longer used after streamline)
import { crewPaletteForSurface, readablePaletteTextOnColor } from "../../../lib/theme";
import { buildFranchizeSectionMetadata } from "../../metadata";
import { formatRuDate } from "../../../lib/date-utils";
// goodmorning-fixes: removed RentalEscapeHatch import (component no longer used —
// its buttons were redundant + caused startapp-param stickiness in TG WebApp)
import { RentalLink } from "../../../components/RentalLink";
// Polish v2 components (Ideas A–G from RENTAL_PAGE_PRD.md)
import { RentalIdealBadge } from "../../../components/RentalIdealBadge";
import { RentalQuickActionBar } from "../../../components/RentalQuickActionBar";
import { RentalTimeline } from "../../../components/RentalTimeline";
import { RentalDepositTracker } from "../../../components/RentalDepositTracker";
import { RentalOdometerDelta } from "../../../components/RentalOdometerDelta";
import { FranchizeRentalRoleGuard } from "../../../components/FranchizeRentalRoleGuard";
// Polish v3 components (Phase 3: extend modal, Phase 5: renter + guest views)
import { RentalExtendModal } from "../../../components/RentalExtendModal";
import { RenterActionsPanel } from "../../../components/RenterActionsPanel";
import { GuestRentalCta } from "../../../components/GuestRentalCta";
import { RentalBikePhoto } from "../../../components/RentalBikePhoto";

interface FranchizeRentalPageProps {
  params: Promise<{ slug: string; id: string }>;
}

const statusLabel: Record<string, string> = {
  pending_confirmation: "Ожидает",
  confirmed: "Подтверждена",
  active: "Активна",
  completed: "Завершена",
  cancelled: "Отменена",
};

const statusPalette: Record<string, { badgeBg: string; badgeText: string }> = {
  pending_confirmation: { badgeBg: "#f59e0b20", badgeText: "#f59e0b" },
  confirmed: { badgeBg: "#3b82f620", badgeText: "#3b82f6" },
  active: { badgeBg: "#22c55e20", badgeText: "#22c55e" },
  completed: { badgeBg: "#6b728020", badgeText: "#6b7280" },
  cancelled: { badgeBg: "#ef444420", badgeText: "#ef4444" },
};

export async function generateMetadata({ params }: FranchizeRentalPageProps): Promise<Metadata> {
  const { slug, id } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Карточка аренды",
    sectionDescription: "Карточка аренды экипажа: статус, документы и дальнейшие действия.",
    pathSuffix: `/rental/${id}`,
  });
}

export default async function FranchizeRentalPage({ params }: FranchizeRentalPageProps) {
  const { slug, id } = await params;
  const [{ crew, items }, rental] = await Promise.all([
    getFranchizeBySlug(slug),
    getFranchizeRentalCard(slug, id),
  ]);
  const resolvedSlug = crew.slug || slug;
  const surface = crewPaletteForSurface(crew.theme);
  const p = crew.theme.palette;
  const isAuto = Boolean(crew.theme.isAuto);

  // Theme-safe values — CSS vars for auto, palette values for manual themes
  const accent = isAuto ? "var(--franchize-accent-main)" : (p?.accentMain || "#B8860B");
  const accentTextOn = isAuto
    ? "var(--franchize-accent-contrast, #16130A)"
    : readablePaletteTextOnColor(p?.accentMain || "#B8860B", p);
  const textPrimary = isAuto ? "var(--franchize-text-primary)" : (p?.textPrimary || "#FFFFFF");
  const textSecondary = isAuto ? "var(--franchize-text-secondary)" : (p?.textSecondary || "#AAAAAA");
  const borderSoft = isAuto ? "var(--franchize-border-soft)" : (p?.borderSoft || "#333333");

  // goodmorning-polish: CSS vars for the plain div that replaced FranchizePageShell.
  // Sets shadcn/ui vars so any Button/Dialog components inside still get themed correctly.
  const shellVarsFallback: React.CSSProperties = {
    "--background": isAuto ? "hsl(var(--background))" : (p?.bgCard || "#1a1a1a"),
    "--foreground": isAuto ? "hsl(var(--foreground))" : (p?.textPrimary || "#FFFFFF"),
    "--card": isAuto ? "hsl(var(--card))" : (p?.bgCard || "#1a1a1a"),
    "--card-foreground": isAuto ? "hsl(var(--card-foreground))" : (p?.textPrimary || "#FFFFFF"),
    "--primary": isAuto ? "var(--franchize-accent-main)" : (p?.accentMain || "#B8860B"),
    "--primary-foreground": accentTextOn,
    "--border": isAuto ? "var(--franchize-border-soft)" : (p?.borderSoft || "#333333"),
    "--ring": isAuto ? "var(--franchize-accent-main)" : (p?.accentMain || "#B8860B"),
    "--franchize-shell-accent": accent,
    "--franchize-shell-text": textPrimary,
    "--franchize-shell-muted": textSecondary,
    "--franchize-shell-border": borderSoft,
    "--franchize-shell-card": isAuto ? "var(--franchize-bg-card)" : (p?.bgCard || "#1a1a1a"),
  } as React.CSSProperties;

  // goodmorning-polish: translate payment status to Russian
  const paymentStatusLabels: Record<string, string> = {
    fully_paid: "Полностью оплачена",
    interest_paid: "Предоплата получена",
    pending: "Ожидает оплаты",
    partial: "Частичная оплата",
    refunded: "Возврат средств",
  };
  const paymentStatusLabel = rental.paymentStatus
    ? (paymentStatusLabels[rental.paymentStatus] || rental.paymentStatus)
    : null;

  // goodmorning-polish: removed dealStarted + profileHref (unused after streamline)
  const catalogHref = `/franchize/${resolvedSlug}`;
  const status = rental.status || "pending_confirmation";
  const statusStyle = statusPalette[status] || statusPalette.pending_confirmation;

  // goodmorning-fixes: active rentals are ALWAYS verified (operator saw physical docs at pickup).
  // Was: showed "Не верифицирован" even when status=active → confusing for operators.
  const effectiveVerificationStatus =
    status === "active" || status === "completed"
      ? "verified" as const
      : rental.contractVerificationStatus;
  const verificationText =
    effectiveVerificationStatus === "verified"
      ? "Верифицирован"
      : effectiveVerificationStatus === "expired"
        ? "Истёк"
        : "Не верифицирован";
  const verificationStatusStyle =
    effectiveVerificationStatus === "verified"
      ? statusPalette.active
      : effectiveVerificationStatus === "expired"
        ? statusPalette.pending_confirmation
        : { badgeBg: `${textSecondary}20`, badgeText: textSecondary };

  const bikeSearchHref = rental.vehicleTitle
    ? `/franchize/${resolvedSlug}?vehicle=${encodeURIComponent(rental.vehicleTitle)}`
    : catalogHref;

  // Status-aware explanatory text — actionable phrasing (operator knows what to do next)
  const statusHint: Record<string, string> = {
    pending_confirmation: "Аренда готова к активации — подтвердите выдачу.",
    confirmed: "Аренда подтверждена. Готовьте ТС к выдаче.",
    active: "ТС у арендатора. Готовьте возврат к указанной дате.",
    completed: "Аренда завершена ✓ — запросите отзыв у клиента.",
    cancelled: "Аренда отменена.",
  };
  const hintText = rental.found ? (statusHint[status] || "") : "Сделка не найдена. Проверьте ссылку или вернитесь в каталог.";

  // ── Polish v2: extract closure data for IdealBadge + OdometerDelta + DepositTracker ──
  const rentalMeta = (rental.metadata as Record<string, any> | null) ?? null;
  const closureData = rentalMeta?.closure_data ?? rentalMeta?.closure ?? null;
  const odometerBefore = rentalMeta?.pickup_freeze?.odometer_km ?? rentalMeta?.odometer_before ?? null;
  const odometerAfter = closureData?.odometer_after ?? rentalMeta?.odometer_after ?? null;
  const depositReturned =
    typeof closureData?.deposit_returned === "boolean"
      ? closureData.deposit_returned
      : typeof rentalMeta?.deposit_returned === "boolean"
        ? rentalMeta.deposit_returned
        : null;
  const depositRub = rentalMeta?.deposit_rub ?? rentalMeta?.depositRub ?? null;
  const damageLevel = closureData?.damage_level ?? rentalMeta?.damage_level ?? null;
  const todosDone = Number(rentalMeta?.todos_done ?? 0);
  const todosTotal = Number(rentalMeta?.todos_total ?? 0);
  const isVerified = rental.contractVerificationStatus === "verified" || status === "active";

  // ── Polish v2: rental stage timestamps for Timeline ──
  // goodmorning-fixes: prefer rental.createdAt (from rentals.created_at column) over metadata.
  // Production metadata doesn't always have created_at — the DB column is the source of truth.
  // Also try metadata.history[] for status-change timestamps (operator-driven events).
  const historyArr = Array.isArray(rentalMeta?.history) ? (rentalMeta!.history as Array<{ status?: string; at?: string }>) : [];
  const findHistoryAt = (status: string) => historyArr.find((h) => h.status === status)?.at || null;
  const createdAt = rental.createdAt ?? rentalMeta?.created_at ?? rentalMeta?.createdAt ?? null;
  const verifiedAt = rentalMeta?.verified_at ?? rentalMeta?.verifiedAt ?? findHistoryAt("confirmed") ?? null;
  const pickedUpAt = rentalMeta?.picked_up_at ?? rentalMeta?.pickedUpAt ?? findHistoryAt("active") ?? null;
  const activeAt = rentalMeta?.active_at ?? rentalMeta?.activeAt ?? pickedUpAt;
  const returnedAt = closureData?.returned_at ?? rentalMeta?.returned_at ?? findHistoryAt("completed") ?? null;
  const completedAt = rentalMeta?.completed_at ?? rentalMeta?.completedAt ?? findHistoryAt("completed") ?? null;

  // ── Stale rental detection ──
  // If the rental is "active" but the agreed/requested end date has passed,
  // show a warning banner prompting the operator to mark it as completed.
  const endDateStr = rental.agreedEndDate || rental.requestedEndDate;
  const endDate = endDateStr ? Date.parse(endDateStr) : Number.NaN;
  const isStale = status === "active" && !Number.isNaN(endDate) && endDate < Date.now();

  return (
    <main className="min-h-screen" style={surface.page}>
      <DisplayModeProvider>
      <FranchizeErrorBoundary
        resetKey={resolvedSlug}
        fallbackTitle="Шапка недоступна"
        fallbackHref={catalogHref}
        fallbackLinkLabel="В каталог"
      >
      <CrewHeader
        crew={crew}
        activePath={`/franchize/${resolvedSlug}/rental/${id}`}
        groupLinks={items.map((item) => item.category)}
      />
      </FranchizeErrorBoundary>
      </DisplayModeProvider>

      {/* goodmorning-polish: replaced <FranchizePageShell> with plain <div>.
          PageShell had backdrop-blur which creates a containing block that breaks
          position:fixed for the QuickActionBar (bar stuck to page bottom, not viewport).
          Also had excessive padding (py-8 + p-6 + rounded-[2rem]). Now: minimal padding,
          no backdrop-blur, no border shell. Content flows edge-to-edge with small margin. */}
      <div className="mx-auto w-full max-w-2xl px-3 py-3 space-y-4" style={shellVarsFallback}>
        {/* Inline CSS for bottom spacer + portrait bike photo aspect ratio */}
        <style>{`
          @media (max-width: 768px) {
            .rental-quick-bar-spacer { height: 140px; }
            .rental-bike-photo { aspect-ratio: 1 / 1; }
          }
          @media (min-width: 769px) {
            .rental-quick-bar-spacer { height: 24px; }
            .rental-bike-photo { aspect-ratio: 9 / 16; max-height: 70vh; }
          }
          /* goodmorning-polish: slide-up animation for QuickActionBar expand.
             FAB (48px circle) → full bar slides up + fades in. */
          @keyframes slideup {
            from {
              opacity: 0;
              transform: translateY(12px) scale(0.85);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        `}</style>

        {/* Top-level error boundary */}
        <FranchizeErrorBoundary
          fallbackTitle="Блок аренды временно недоступен"
          fallbackMessage="Что-то пошло не так при загрузке карточки. Попробуйте перезагрузить страницу или вернуться в профиль."
          fallbackHref={catalogHref}
          fallbackLinkLabel="В каталог"
        >
        {/* Stale rental warning */}
        {isStale && (
          <div
            className="rounded-2xl border-2 p-3 text-sm"
            style={{ borderColor: "#ef4444", backgroundColor: "#ef444410", color: textPrimary }}
          >
            <div className="flex items-start gap-2">
              <span className="text-base shrink-0 mt-0.5">⚠️</span>
              <div>
                <p className="font-semibold" style={{ color: "#ef4444" }}>Аренда просрочена</p>
                <p className="mt-0.5 text-xs opacity-80">
                  Дата возврата ({formatRuDate(new Date(endDate))}) уже прошла. Закройте аренду — переведите в «Завершена».
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Bike photo hero — portrait 9:16 on desktop, square on mobile */}
        {rental.found && rental.vehicleImageUrl && (
          <RentalBikePhoto
            src={rental.vehicleImageUrl}
            alt={rental.vehicleTitle || "Байк"}
            statusLabel={statusLabel[status] || status}
            statusBadgeBg={statusStyle.badgeBg}
            statusBadgeText={statusStyle.badgeText}
            rentalShortId={rental.rentalId?.slice(0, 8)}
            borderColor={borderSoft}
          />
        )}

        {/* Compact header — status + IdealBadge only.
            Bike title + ID are already shown on the photo overlay above,
            so we don't repeat them here. */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {rental.found && (
                <RentalIdealBadge
                  verified={isVerified}
                  todosDone={todosDone}
                  todosTotal={todosTotal}
                  odometerAfter={odometerAfter}
                  depositReturned={depositReturned}
                  damageLevel={damageLevel}
                  accentColor={accent}
                />
              )}
            </div>
            {hintText && (
              <p className="text-xs" style={{ color: textSecondary }}>{hintText}</p>
            )}
          </div>
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ backgroundColor: statusStyle.badgeBg, color: statusStyle.badgeText }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusStyle.badgeText }} />
            {statusLabel[status] || status}
          </span>
        </div>

        {/* Timeline (Idea C) — single source of truth for stage progress.
            Removed the static numbered "Текущие задачи" list that duplicated this info. */}
        {rental.found && (
          <RentalTimeline
            status={status}
            createdAt={createdAt}
            verifiedAt={verifiedAt}
            pickedUpAt={pickedUpAt}
            activeAt={activeAt}
            returnedAt={returnedAt}
            completedAt={completedAt}
            accentColor={accent}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderSoft={borderSoft}
          />
        )}

        {/* Compact detail grid — bike photo is already shown above, so NO duplicate vehicle title here */}
        <section className="rounded-2xl border p-3 space-y-2" style={surface.subtleCard}>
          {/* Contract verification row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs" style={{ color: textSecondary }}>Контракт:</span>
            <span
              className="rounded-full border px-2.5 py-0.5 text-xs font-semibold"
              style={{ borderColor: verificationStatusStyle.badgeText, color: verificationStatusStyle.badgeText }}
            >
              {verificationText}
            </span>
            <RentalLink
              href={`/franchize/${resolvedSlug}/verify-doc?rental=${rental.rentalId}&scope=${encodeURIComponent(rental.contractVerifierScope || `rental:${rental.rentalId}`)}&key=${encodeURIComponent(rental.contractDocumentKey || `rental-${slug}-${rental.rentalId}`)}`}
              className="rounded-full border px-2.5 py-0.5 text-xs font-semibold transition hover:opacity-85"
              style={{ borderColor: accent, color: accent }}
            >
              Проверить
            </RentalLink>
          </div>

          {/* Detail grid — 2 columns on desktop, 1 on mobile */}
          <div className="grid gap-2 text-sm sm:grid-cols-2 max-sm:grid-cols-1">
            {paymentStatusLabel && (
              <p><span style={{ color: textSecondary }}>Оплата:</span> {paymentStatusLabel}</p>
            )}
            {rental.totalCost > 0 && (
              <p><span style={{ color: textSecondary }}>Итого:</span> {rental.totalCost.toLocaleString("ru-RU")} ₽</p>
            )}
            {(rental.agreedStartDate || rental.agreedEndDate) && (
              <p>
                <span style={{ color: textSecondary }}>Период:</span>{" "}
                <span className="font-semibold">
                  {rental.agreedStartDate ? formatRuDate(new Date(rental.agreedStartDate)) : "?"}
                  {" → "}
                  {rental.agreedEndDate ? formatRuDate(new Date(rental.agreedEndDate)) : "?"}
                </span>
              </p>
            )}
            {rental.renterFullName && (
              <p>
                <span style={{ color: textSecondary }}>Арендатор:</span>{" "}
                <span className="font-semibold">{rental.renterFullName}</span>
              </p>
            )}
          </div>

          {/* Deposit tracker (Idea F) + Odometer delta (Idea G) */}
          {rental.found && (
            <div className="grid gap-2 sm:grid-cols-2 max-sm:grid-cols-1">
              <RentalDepositTracker
                depositRub={depositRub}
                depositReturned={depositReturned}
                status={status}
                accentColor={accent}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                borderSoft={borderSoft}
              />
              <RentalOdometerDelta
                odometerBefore={odometerBefore}
                odometerAfter={odometerAfter}
                includedKm={rentalMeta?.included_km ?? null}
                overageRatePerKm={rentalMeta?.overage_rate_per_km ?? null}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                borderSoft={borderSoft}
                accentColor={accent}
              />
            </div>
          )}
        </section>

        {/* Return checklist — OPERATOR ONLY. Single source of truth (was duplicated
            between RentalReturnChecklist in sidebar + RentalChecklistPanel in main).
            Removed RentalChecklistPanel entirely — its toggle was broken (local state
            only, reset on every re-render). RentalReturnChecklist persists via API. */}
        {rental.found && status === "active" && (
          <FranchizeRentalRoleGuard
            allowedRoles={["operator", "admin", "owner"]}
            ownerId={rental.ownerId}
            renterId={rental.renterId}
            renterTelegramChatId={rental.renterTelegramChatId}
            crewId={rental.crewId || crew.id}
            crewSlug={resolvedSlug}
            fallback={
              <div className="text-xs opacity-60 py-2" style={{ color: textSecondary }}>
                📋 Чек-лист виден только операторам экипажа.
              </div>
            }
          >
            <RentalReturnChecklist
              rentalId={rental.rentalId}
              crewId={rental.crewId || crew.id}
              crewSlug={resolvedSlug}
              accentColor={accent}
              borderColor={borderSoft}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              isAuto={isAuto}
            />
          </FranchizeRentalRoleGuard>
        )}

        {/* Message input — sends notification to crew owner via TG bot */}
        <div id="rental-message-input">
          <RentalMessageInput
            rentalId={rental.rentalId}
            accentColor={accent}
            borderColor={borderSoft}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
          />
        </div>

        {/* Documents panel — OPERATOR ONLY */}
        <FranchizeRentalRoleGuard
          allowedRoles={["operator", "admin", "owner"]}
          ownerId={rental.ownerId}
          renterId={rental.renterId}
          renterTelegramChatId={rental.renterTelegramChatId}
          crewId={rental.crewId || crew.id}
          crewSlug={resolvedSlug}
        >
          <FranchizeErrorBoundary fallbackTitle="Документы временно недоступны" fallbackMessage="Попробуйте перезагрузить.">
            <FranchizeRentalDocumentsPanel
              rentalId={rental.rentalId}
              ownerId={rental.ownerId}
              crewId={rental.crewId || crew.id}
              crewSlug={resolvedSlug}
              status={status}
              metadata={rental.metadata}
              palette={p}
              isAuto={isAuto}
            />
          </FranchizeErrorBoundary>
        </FranchizeRentalRoleGuard>

        {/* Single "Продлить" button — operator-only. Opens ExtendModal with date picker.
            Was 2 duplicate buttons (sidebar + action row); now just one. */}
        {rental.found && status === "active" && (
          <FranchizeRentalRoleGuard
            allowedRoles={["operator", "admin", "owner"]}
            ownerId={rental.ownerId}
            renterId={rental.renterId}
            renterTelegramChatId={rental.renterTelegramChatId}
            crewId={rental.crewId || crew.id}
            crewSlug={resolvedSlug}
          >
            <RentalExtendModal
              rentalId={rental.rentalId}
              originalStartDate={rental.agreedStartDate}
              originalEndDate={rental.agreedEndDate || rental.requestedEndDate}
              bikeTitle={rental.vehicleTitle}
              renterName={rental.renterFullName}
              accentColor={accent}
              accentTextOn={accentTextOn}
              borderColor={borderSoft}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              triggerClassName="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition hover:opacity-90"
              triggerStyle={{ backgroundColor: accent, color: accentTextOn }}
            />
          </FranchizeRentalRoleGuard>
        )}

        {/* Lifecycle actions — OPERATOR ONLY.
            Wrapped in div#lifecycle-actions for QuickActionBar scroll target. */}
        <FranchizeRentalRoleGuard
          allowedRoles={["operator", "admin", "owner"]}
          ownerId={rental.ownerId}
          renterId={rental.renterId}
          renterTelegramChatId={rental.renterTelegramChatId}
          crewId={rental.crewId || crew.id}
          crewSlug={resolvedSlug}
        >
          <div id="lifecycle-actions">
            <FranchizeErrorBoundary fallbackTitle="Действия временно недоступны" fallbackMessage="Попробуйте перезагрузить.">
              <FranchizeRentalLifecycleActions
                rentalId={rental.rentalId}
                ownerId={rental.ownerId}
                renterId={rental.renterId}
                crewId={rental.crewId || crew.id}
                crewSlug={resolvedSlug}
                status={status}
                paymentStatus={rental.paymentStatus}
                hasPickupFreeze={Boolean((rental.metadata as { pickup_freeze?: { frozen_at?: unknown } } | null)?.pickup_freeze?.frozen_at)}
                palette={p}
                isAuto={isAuto}
              />
            </FranchizeErrorBoundary>
          </div>
        </FranchizeRentalRoleGuard>

        {/* Phase 5: Renter-specific actions panel */}
        {rental.found && (
          <RenterActionsPanel
            rentalId={rental.rentalId}
            ownerId={rental.ownerId}
            renterId={rental.renterId}
            renterTelegramChatId={rental.renterTelegramChatId}
            crewId={rental.crewId || crew.id}
            crewSlug={resolvedSlug}
            contractVerified={isVerified}
            contractDownloadUrl={rental.contractDownloadUrl || null}
            photoUploadHref={`/franchize/${resolvedSlug}/verify-doc?rental=${rental.rentalId}`}
            messageCrewHref={`#rental-message-input`}
            telegramDeepLink={rental.telegramDeepLink}
            accentColor={accent}
            accentTextOn={accentTextOn}
            borderColor={borderSoft}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
          />
        )}

        {/* Phase 5: Guest minimal view */}
        {rental.found && (
          <GuestRentalCta
            ownerId={rental.ownerId}
            renterId={rental.renterId}
            renterTelegramChatId={rental.renterTelegramChatId}
            crewId={rental.crewId || crew.id}
            crewSlug={resolvedSlug}
            bikeTitle={rental.vehicleTitle}
            statusLabel={statusLabel[status]}
            telegramDeepLink={rental.telegramDeepLink}
            accentColor={accent}
            accentTextOn={accentTextOn}
            borderColor={borderSoft}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
          />
        )}

        {/* Bottom spacer so QuickActionBar doesn't overlap last button.
            140px on mobile to clear phone native nav + the bar. */}
        {rental.found && status !== "completed" && status !== "cancelled" && (
          <div className="rental-quick-bar-spacer" aria-hidden="true" />
        )}
        </FranchizeErrorBoundary>
      </div>

      {/* Quick-action floating bar (Idea B) — OUTSIDE the content div.
          goodmorning-polish: moved outside FranchizePageShell's replacement div
          because backdrop-blur/transform on ancestors breaks position:fixed.
          Now a direct child of <main> → position:fixed sticks to viewport. */}
      {rental.found && (
        <RentalQuickActionBar
          rentalId={rental.rentalId}
          showProlong={status === "active"}
          showClose={status === "active"}
          showMessagerent={status !== "completed" && status !== "cancelled"}
          prolongHref={bikeSearchHref}
          ownerId={rental.ownerId}
          renterId={rental.renterId}
          renterTelegramChatId={rental.renterTelegramChatId}
          crewId={rental.crewId || crew.id}
          crewSlug={resolvedSlug}
          accentColor={accent}
          accentTextOn={accentTextOn}
          borderColor={borderSoft}
          textPrimary={textPrimary}
        />
      )}

    </main>
  );
}
