// /app/franchize/[slug]/rental/[id]/page.tsx
import type { Metadata } from "next";
import { ExternalLink, Info, RefreshCw, RotateCcw, ShoppingCart, Sparkles, Timer } from "lucide-react";
import { getFranchizeBySlug, getFranchizeRentalCard } from "../../../actions";
import { CrewHeader } from "../../../components/CrewHeader";
import { CrewFooter } from "../../../components/CrewFooter";
import { FranchizeErrorBoundary } from "../../../components/ErrorBoundary";
import { DisplayModeProvider } from "../../../components/DisplayModeContext";
import { FranchizeRentalLifecycleActions } from "../../../components/FranchizeRentalLifecycleActions";
import { FranchizePageShell } from "../../../components/FranchizePageShell";
import { FranchizeRentalDocumentsPanel } from "../../../components/FranchizeRentalDocumentsPanel";
import { RentalChecklistPanel } from "../../../components/RentalChecklistPanel";
import { RentalMessageInput } from "../../../components/RentalMessageInput";
import { RentalReturnChecklist } from "../../../components/RentalReturnChecklist";
import { RentalTelegramGuard } from "../../../components/RentalTelegramGuard";
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

  const dealStarted = rental.found || rental.paymentStatus === "interest_paid";
  const catalogHref = `/franchize/${resolvedSlug}`;
  // Use internal relative path for profile link — inside TG WebApp the mini app
  // can navigate internally; the TG deep link (with startapp) is fragile here.
  const profileHref = `/franchize/${resolvedSlug}/profile`;
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

      <FranchizePageShell theme={crew.theme} contentClassName="space-y-6">
        {/* goodmorning-fixes: removed <RentalEscapeHatch> — its "← В каталог"/"👤 Профиль"
            buttons were redundant with the in-flow nav buttons below, AND using
            window.location.href on relative URLs in TG WebApp keeps the startapp
            param alive → user gets bounced back to rental page. The CrewHeader
            already provides navigation; the action buttons below cover catalog/profile. */}

        {/* Top-level error boundary: if any client component crashes during hydration,
            the CrewHeader + navigation stays interactive while this section degrades gracefully. */}
        <FranchizeErrorBoundary
          fallbackTitle="Блок аренды временно недоступен"
          fallbackMessage="Что-то пошло не так при загрузке карточки. Попробуйте перезагрузить страницу или вернуться в профиль."
          fallbackHref={catalogHref}
          fallbackLinkLabel="В каталог"
        >
        {/* Stale rental warning */}
        {isStale && (
          <div
            className="rounded-3xl border-2 p-4 text-sm"
            style={{
              borderColor: "#ef4444",
              backgroundColor: "#ef444410",
              color: textPrimary,
            }}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg shrink-0 mt-0.5">⚠️</span>
              <div>
                <p className="font-semibold" style={{ color: "#ef4444" }}>Аренда просрочена</p>
                <p className="mt-1 opacity-80">
                  Дата возврата ({formatRuDate(new Date(endDate))}) уже прошла, но статус всё ещё «Активна».
                  Закройте аренду вручную — переведите в «Завершена» или «Просрочена».
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Compact page header — with IdealBadge (Idea A) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold" style={{ color: textPrimary }}>
                Карточка аренды
              </h1>
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
              <p className="text-sm" style={{ color: textSecondary }}>{hintText}</p>
            )}
          </div>
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: statusStyle.badgeBg, color: statusStyle.badgeText }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusStyle.badgeText }} />
            {statusLabel[status] || status}
          </span>
        </div>

        {/* Status + next steps */}
        <section className="rounded-3xl border p-4 md:p-6" style={surface.subtleCard}>
          {/* Timeline (Idea C) — replaces static numbered list with interactive horizontal stages */}
          {rental.found && (
            <div className="mb-4">
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
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] max-lg:grid-cols-1">
            {/* Left column: status, steps, info */}
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: statusStyle.badgeBg, color: statusStyle.badgeText }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusStyle.badgeText }} />
                  {statusLabel[status] || status}
                </span>
                {rental.found && (
                  <span className="text-xs" style={{ color: textSecondary }}>
                    #{rental.rentalId?.slice(0, 8)}
                  </span>
                )}
              </div>

              <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: accent }}>
                {status === "completed"
                  ? "Что сделано"
                  : status === "active"
                    ? "Текущие задачи"
                    : "Что будет дальше"}
              </p>

              <ol className="mt-3 space-y-2 text-sm">
                {(rental.found
                  ? (status === "completed"
                      ? [
                          "ТС возвращён, депозит возвращён.",
                          "Контракт сохранён в истории аренд.",
                          "Чтобы арендовать снова — нажмите «Арендовать снова».",
                        ]
                      : status === "active"
                        ? [
                            "Отслеживайте возврат ТС по чек-листу.",
                            "После возврата — проверьте состояние и пробег.",
                            "Подпишите акт возврата и верните депозит.",
                          ]
                        : [
                            "Проверим статус оплаты, договора и выдачи.",
                            "Продолжите оформление или откройте в Telegram.",
                            "После завершения — финальная сверка залога.",
                          ]
                    )
                  : [
                      "Подождём синхронизацию — бот присылает карточку с задержкой.",
                      "Откройте в Telegram или вернитесь в профиль.",
                      "Если не найдётся — вернитесь в каталог.",
                    ]
                ).map((step, index) => (
                  <li key={step} className="flex gap-2">
                    <span
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={{
                        backgroundColor: isAuto
                          ? "color-mix(in srgb, var(--franchize-accent-main) 14%, transparent)"
                          : `${accent}24`,
                        color: accent,
                      }}
                    >
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              <p
                className="mt-3 rounded-2xl border p-3 text-xs"
                style={{ ...surface.card, borderColor: borderSoft }}
              >
                {status === "completed"
                  ? "История сохранена. Документы в верификаторе."
                  : "Статус договора показывается отдельно, документы проверяются через verifier."}
              </p>
            </div>

            {/* Right column: actions sidebar */}
            <div className="space-y-2 text-sm">
              {status !== "completed" && status !== "cancelled" && (
                <RentalTelegramGuard>
                  <a
                    href={rental.telegramDeepLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex justify-center rounded-xl px-4 py-3 font-semibold transition hover:opacity-90"
                    style={{ backgroundColor: accent, color: accentTextOn }}
                  >
                    Открыть в TG
                  </a>
                </RentalTelegramGuard>
              )}

              {status === "active" && (
                <>
                  {/* Phase 3: extendRental modal — replaces dumb "open catalog" link with
                      1-click date picker that creates a new rental pre-filled with this
                      rental's renter/bike/equipment. */}
                  <FranchizeRentalRoleGuard
                    allowedRoles={["operator", "admin", "owner"]}
                    ownerId={rental.ownerId}
                    renterId={rental.renterId}
                    renterTelegramChatId={rental.renterTelegramChatId}
                    crewId={rental.crewId || crew.id}
                    crewSlug={resolvedSlug}
                    fallback={
                      <RentalLink
                        href={bikeSearchHref}
                        className="flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-semibold transition hover:opacity-85"
                        style={{ borderColor: accent, color: accent }}
                      >
                        <Timer className="h-4 w-4 shrink-0" /> Продлить
                      </RentalLink>
                    }
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
                      triggerClassName="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold transition hover:opacity-90"
                      triggerStyle={{ backgroundColor: accent, color: accentTextOn }}
                    />
                  </FranchizeRentalRoleGuard>
                  <p className="text-[11px] leading-tight text-center" style={{ color: textSecondary }}>
                    Создаст новую аренду с тем же арендатором и байком — останется только выбрать даты
                  </p>

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
                </>
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

              <div className="grid grid-cols-2 gap-2">
                <RentalLink
                  href={catalogHref}
                  className="rounded-xl border px-3 py-2 text-center text-xs transition hover:opacity-85"
                  style={{ borderColor: borderSoft }}
                >
                  Каталог
                </RentalLink>
                <RentalLink
                  href={profileHref}
                  className="rounded-xl border px-3 py-2 text-center text-xs transition hover:opacity-85"
                  style={{ borderColor: borderSoft }}
                >
                  Профиль
                </RentalLink>
              </div>
            </div>
          </div>
        </section>

        {/* Not found state */}
        {!rental.found ? (
          <section className="rounded-3xl border border-dashed p-4 md:p-6 text-sm" style={surface.card}>
            <h2 className="font-semibold">Карточка не найдена</h2>
            <p className="mt-2" style={surface.mutedText}>
              Проверьте ID в ссылке или вернитесь в профиль — там останутся последние активные заявки.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <RentalLink
                href={catalogHref}
                className="rounded-xl border px-3 py-2 text-xs transition hover:opacity-85"
                style={{ borderColor: borderSoft }}
              >
                Каталог
              </RentalLink>
              <RentalLink
                href={profileHref}
                className="rounded-xl border px-3 py-2 text-xs transition hover:opacity-85"
                style={{ borderColor: borderSoft }}
              >
                Профиль
              </RentalLink>
            </div>
          </section>
        ) : null}

        {/* goodmorning-fixes: Bike photo hero — extracted to Client Component
            because Server Components can't pass onError to <img>. */}
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

        {/* Deal started badge */}
        {dealStarted && status !== "completed" && status !== "cancelled" && (
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
            style={{ borderColor: accent, color: accent }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {status === "active" ? "ТС у арендатора" : "Заявка принята"}
          </div>
        )}

        {/* Rental details */}
        <section className="rounded-3xl border p-4 md:p-6 space-y-4" style={surface.subtleCard}>
          {/* Contract verification row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs" style={{ color: textSecondary }}>Контракт:</span>
            <span
              className="rounded-full border px-3 py-1 text-xs font-semibold"
              style={{ borderColor: verificationStatusStyle.badgeText, color: verificationStatusStyle.badgeText }}
            >
              {verificationText}
            </span>
            <RentalLink
              href={`/franchize/${resolvedSlug}/verify-doc?rental=${rental.rentalId}&scope=${encodeURIComponent(rental.contractVerifierScope || `rental:${rental.rentalId}`)}&key=${encodeURIComponent(rental.contractDocumentKey || `rental-${slug}-${rental.rentalId}`)}`}
              className="rounded-full border px-3 py-1 text-xs font-semibold transition hover:opacity-85"
              style={{ borderColor: accent, color: accent }}
            >
              Проверить
            </RentalLink>
            {rental.docVerifierRecordId && (
              <span className="text-[11px]" style={{ color: textSecondary }}>
                #{rental.docVerifierRecordId.slice(0, 8)}
              </span>
            )}
            {rental.contractSourceScope && (
              <span className="text-[11px]" style={{ color: textSecondary }}>
                {rental.contractSourceScope}
              </span>
            )}
          </div>

          {/* Detail grid */}
          <div className="grid gap-3 text-sm sm:grid-cols-2 max-sm:grid-cols-1">
            <p>
              <span style={{ color: textSecondary }}>Статус:</span>{" "}
              <span className="font-semibold" style={{ color: statusStyle.badgeText }}>
                {statusLabel[status] || status}
              </span>
            </p>
            {rental.paymentStatus && (
              <p><span style={{ color: textSecondary }}>Оплата:</span> {rental.paymentStatus}</p>
            )}
            {rental.totalCost > 0 && (
              <p><span style={{ color: textSecondary }}>Итого:</span> {rental.totalCost.toLocaleString("ru-RU")} ₽</p>
            )}
            {/* goodmorning-fixes: dates were missing entirely. Show start → end range. */}
            {(rental.agreedStartDate || rental.agreedEndDate) && (
              <p className={rental.totalCost > 0 ? "" : "sm:col-span-2"}>
                <span style={{ color: textSecondary }}>Период:</span>{" "}
                <span className="font-semibold">
                  {rental.agreedStartDate
                    ? formatRuDate(new Date(rental.agreedStartDate))
                    : "?"}
                  {" → "}
                  {rental.agreedEndDate
                    ? formatRuDate(new Date(rental.agreedEndDate))
                    : "?"}
                </span>
              </p>
            )}
            {/* goodmorning-fixes: renter name was missing. Show from rental_contract_artefacts.renter_full_name. */}
            {rental.renterFullName && (
              <p>
                <span style={{ color: textSecondary }}>Арендатор:</span>{" "}
                <span className="font-semibold">{rental.renterFullName}</span>
              </p>
            )}
            <p className={rental.totalCost > 0 ? "" : "sm:col-span-2"}>
              <span style={{ color: textSecondary }}>Транспорт:</span> {rental.vehicleTitle}
            </p>
            {rental.contractOriginalSha256 ? (
              <p className="sm:col-span-2 break-all text-xs">
                <span style={{ color: textSecondary }}>SHA256:</span>{" "}
                {rental.contractOriginalSha256}
              </p>
            ) : null}
          </div>

          {/* Deposit tracker (Idea F) + Odometer delta (Idea G) — compact cards row */}
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

          {/* Interactive checklist — OPERATOR ONLY (Idea E: hide from renters/guests) */}
          {rental.found && (
            <FranchizeRentalRoleGuard
              allowedRoles={["operator", "admin", "owner"]}
              ownerId={rental.ownerId}
              renterId={rental.renterId}
              renterTelegramChatId={rental.renterTelegramChatId}
              crewId={rental.crewId || crew.id}
                    crewSlug={resolvedSlug}
              fallback={
                <div className="pt-2 text-xs opacity-60" style={{ color: textSecondary }}>
                  📋 Чек-лист виден только операторам экипажа.
                </div>
              }
            >
              <div className="pt-2">
                <RentalChecklistPanel
                  rentalId={rental.rentalId}
                  crewId={rental.crewId || crew.id}
                    crewSlug={resolvedSlug}
                  slug={resolvedSlug}
                  accentColor={accent}
                  metadata={(rental.metadata as Record<string, any>) || undefined}
                  status={status}
                />
              </div>
            </FranchizeRentalRoleGuard>
          )}

          {/* Action buttons */}
          <div className="grid gap-2 sm:grid-cols-2 max-sm:grid-cols-1 pt-2">
            {status === "completed" ? (
              <>
                <RentalLink
                  href={`/franchize/${resolvedSlug}?vehicle=${encodeURIComponent(rental.vehicleTitle || "")}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition hover:opacity-90"
                  style={{ backgroundColor: accent, color: accentTextOn }}
                >
                  <RotateCcw className="h-4 w-4 shrink-0" />
                  Арендовать снова
                </RentalLink>
                <RentalLink
                  href={profileHref}
                  className="inline-flex justify-center rounded-xl border px-4 py-3 text-sm transition hover:opacity-85"
                  style={{ borderColor: borderSoft, color: textPrimary }}
                >
                  <ShoppingCart className="mr-2 h-4 w-4 shrink-0" />
                  История
                </RentalLink>
              </>
            ) : status === "active" ? (
              <>
                {/* Phase 3: extendRental modal in action buttons row (operator-only) */}
                <FranchizeRentalRoleGuard
                  allowedRoles={["operator", "admin", "owner"]}
                  ownerId={rental.ownerId}
                  renterId={rental.renterId}
                  renterTelegramChatId={rental.renterTelegramChatId}
                  crewId={rental.crewId || crew.id}
                    crewSlug={resolvedSlug}
                  fallback={
                    <RentalLink
                      href={bikeSearchHref}
                      className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition hover:opacity-90"
                      style={{ backgroundColor: accent, color: accentTextOn }}
                    >
                      <RefreshCw className="h-4 w-4 shrink-0" />
                      Продлить
                    </RentalLink>
                  }
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
                    triggerClassName="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition hover:opacity-90"
                    triggerStyle={{ backgroundColor: accent, color: accentTextOn }}
                  />
                </FranchizeRentalRoleGuard>
                <RentalLink
                  href={catalogHref}
                  className="inline-flex justify-center rounded-xl border px-4 py-3 text-sm transition hover:opacity-85"
                  style={{ borderColor: borderSoft, color: textPrimary }}
                >
                  Каталог
                </RentalLink>
              </>
            ) : (
              <>
                <RentalLink
                  href={`/franchize/${resolvedSlug}/cart`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition hover:opacity-90"
                  style={{ backgroundColor: accent, color: accentTextOn }}
                >
                  <Sparkles className="h-4 w-4 shrink-0" />
                  Продолжить
                </RentalLink>
                <RentalLink
                  href={catalogHref}
                  className="inline-flex justify-center rounded-xl border px-4 py-3 text-sm transition hover:opacity-85"
                  style={{ borderColor: borderSoft, color: textPrimary }}
                >
                  Каталог
                </RentalLink>
              </>
            )}
          </div>

          {/* Documents panel — OPERATOR ONLY (Idea E: hide from renters/guests) */}
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

          {/* Lifecycle actions — OPERATOR ONLY (Idea E: hide from renters/guests).
              Wrapped in a div#lifecycle-actions for QuickActionBar scroll target. */}
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

          {/* Telegram fallback link */}
          <RentalTelegramGuard>
            <div
              className="flex items-center justify-end gap-2 text-xs pt-2"
              style={{ color: textSecondary }}
            >
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border"
                style={{ borderColor: borderSoft }}
                title="Если карточка открылась вне Telegram — откроет в mini-app"
              >
                <Info className="h-3.5 w-3.5" />
              </span>
              <a
                href={rental.telegramDeepLink}
                className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Открыть в TG
              </a>
            </div>
          </RentalTelegramGuard>
        </section>
        </FranchizeErrorBoundary>

        {/* Phase 5: Renter-specific actions panel.
            Shows photo upload (if unverified), contract download, message crew.
            Only renders for the renter — operators/guests see nothing here. */}
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

        {/* Phase 5: Guest minimal view.
            Shows a single CTA to open in Telegram for unauthenticated visitors.
            Returns null for renters and operators. */}
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

        {/* Quick-action floating bar (Idea B) — always-visible action shortcuts.
            Renders after main content so it overlays on top of the scrollable page.
            Anchored to viewport bottom on mobile, bottom-right on desktop.
            Note: showClose is gated client-side by role inside the component —
            the #lifecycle-actions section is wrapped in FranchizeRentalRoleGuard,
            so for renters/guests the scroll target wouldn't exist. */}
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
      </FranchizePageShell>

      <CrewFooter crew={crew} />
    </main>
  );
}
