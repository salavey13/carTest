import type { Metadata } from "next";
import { ChevronDown, ExternalLink, Info, PackageCheck, RefreshCw, RotateCcw, ShoppingCart, Sparkles, Timer } from "lucide-react";
import Link from "next/link";
import { getFranchizeBySlug, getFranchizeRentalCard } from "../../../actions";
import { CrewHeader } from "../../../components/CrewHeader";
import { CrewFooter } from "../../../components/CrewFooter";
import { FranchizeRentalLifecycleActions } from "../../../components/FranchizeRentalLifecycleActions";
import { FranchizeHero } from "../../../components/FranchizeHero";
import { FranchizePageShell } from "../../../components/FranchizePageShell";
import { FranchizeRentalDocumentsPanel } from "../../../components/FranchizeRentalDocumentsPanel";
import { RentalChecklistPanel } from "../../../components/RentalChecklistPanel";
import { RentalTelegramGuard } from "../../../components/RentalTelegramGuard";
import { getTelegramHandleHref, getTelegramWebAppPageHref } from "../../../lib/telegram-links";
import { crewPaletteForSurface, readablePaletteTextOnColor } from "../../../lib/theme";
import { buildFranchizeSectionMetadata } from "../../metadata";

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
  const profileHref = getTelegramWebAppPageHref(`franchize/${resolvedSlug}/profile`, crew.contacts.telegramBotUsername) || `/franchize/${resolvedSlug}/profile`;
  const contactsHref = `/franchize/${resolvedSlug}/contacts`;
  const telegramSupportHref = getTelegramHandleHref(crew.contacts.telegram);
  const status = rental.status || "pending_confirmation";
  const statusStyle = statusPalette[status] || statusPalette.pending_confirmation;

  const verificationText =
    rental.contractVerificationStatus === "verified"
      ? "Верифицирован"
      : rental.contractVerificationStatus === "expired"
        ? "Истёк"
        : "Не верифицирован";
  const verificationStatusStyle =
    rental.contractVerificationStatus === "verified"
      ? statusPalette.active
      : rental.contractVerificationStatus === "expired"
        ? statusPalette.pending_confirmation
        : { badgeBg: `${textSecondary}20`, badgeText: textSecondary };

  const bikeSearchHref = rental.vehicleTitle
    ? `/franchize/${resolvedSlug}?vehicle=${encodeURIComponent(rental.vehicleTitle)}`
    : catalogHref;

  // Status-aware hero subcopy & CTAs
  const heroCopy: Record<string, { subcopy: string; primaryCta: { label: string; href: string }; secondaryCta: { label: string; href: string } }> = {
    pending_confirmation: {
      subcopy: "Заявка ждёт подтверждения.",
      primaryCta: { label: "Продолжить", href: `/franchize/${resolvedSlug}/cart` },
      secondaryCta: { label: "Каталог", href: catalogHref },
    },
    confirmed: {
      subcopy: "Аренда подтверждена. Готовим выдачу.",
      primaryCta: { label: "Открыть в Telegram", href: rental.telegramDeepLink },
      secondaryCta: { label: "Каталог", href: catalogHref },
    },
    active: {
      subcopy: "ТС у арендатора. Следим за сроками.",
      primaryCta: { label: "Продлить", href: bikeSearchHref },
      secondaryCta: { label: "Каталог", href: catalogHref },
    },
    completed: {
      subcopy: "Аренда завершена.",
      primaryCta: { label: "Арендовать снова", href: bikeSearchHref },
      secondaryCta: { label: "Отзыв", href: contactsHref },
    },
    cancelled: {
      subcopy: "Аренда отменена.",
      primaryCta: { label: "Заказать ещё", href: catalogHref },
      secondaryCta: { label: "Оператору", href: telegramSupportHref },
    },
  };
  const heroDefault = {
    subcopy: rental.found
      ? "Сделка активирована. Управляйте из Telegram."
      : "Сделка не найдена. Проверьте ссылку или напишите оператору.",
    primaryCta: { label: "Открыть в Telegram", href: rental.telegramDeepLink },
    secondaryCta: { label: "Каталог", href: catalogHref },
  };
  const hero = rental.found ? (heroCopy[status] || heroDefault) : heroDefault;

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader
        crew={crew}
        activePath={`/franchize/${resolvedSlug}/rental/${id}`}
        groupLinks={items.map((item) => item.category)}
      />

      <FranchizePageShell theme={crew.theme} contentClassName="space-y-6">
        <FranchizeHero
          eyebrow={`/franchize/${resolvedSlug}/rental/${id} · сделка`}
          title="Карточка аренды"
          subcopy={hero.subcopy}
          primaryCta={hero.primaryCta}
          secondaryCta={hero.secondaryCta}
        />

        {/* Status + next steps */}
        <section className="rounded-3xl border p-4 md:p-6" style={surface.subtleCard}>
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
                      "Откройте в Telegram или напишите оператору.",
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
                  <Link
                    href={bikeSearchHref}
                    className="flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-semibold transition hover:opacity-85"
                    style={{ borderColor: accent, color: accent }}
                  >
                    <Timer className="h-4 w-4 shrink-0" /> Продлить
                  </Link>

                  <details className="group rounded-xl border" style={{ borderColor: borderSoft }}>
                    <summary
                      className="flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium list-none"
                      style={{ color: textPrimary }}
                    >
                      <PackageCheck className="h-4 w-4 shrink-0" />
                      Что вернуть
                      <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                    </summary>
                    <div className="border-t px-4 py-3 text-xs space-y-2" style={{ borderColor: borderSoft, color: textPrimary }}>
                      <ul className="space-y-1.5">
                        {[
                          "ТС в том же состоянии",
                          "Ключи от байка",
                          "Шлем (если брали)",
                          "Допы: перчатки, куртка, зарядка",
                          "Паспорт/СТС, если в залог",
                          "Полный бак / заряд",
                        ].map((item) => (
                          <li key={item} className="flex gap-2">
                            <span style={{ color: accent }}>✓</span> {item}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3" style={{ color: textSecondary }}>
                        При возврате оператор проверит комплектацию и состояние. Депозит вернём после акта.
                      </p>
                    </div>
                  </details>
                </>
              )}

              <a
                href={telegramSupportHref}
                target="_blank"
                rel="noreferrer"
                className="flex justify-center rounded-xl border px-4 py-3 transition hover:opacity-85"
                style={{ borderColor: borderSoft, color: textPrimary }}
              >
                Оператору
              </a>

              <Link
                href={contactsHref}
                className="flex justify-center rounded-xl border px-4 py-3 transition hover:opacity-85"
                style={{ borderColor: borderSoft, color: textPrimary }}
              >
                Контакты
              </Link>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  href={catalogHref}
                  className="rounded-xl border px-3 py-2 text-center text-xs transition hover:opacity-85"
                  style={{ borderColor: borderSoft }}
                >
                  Каталог
                </Link>
                <Link
                  href={profileHref}
                  className="rounded-xl border px-3 py-2 text-center text-xs transition hover:opacity-85"
                  style={{ borderColor: borderSoft }}
                >
                  Профиль
                </Link>
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
              {[catalogHref, profileHref, contactsHref].map((href, i) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-xl border px-3 py-2 text-xs transition hover:opacity-85"
                  style={{ borderColor: borderSoft }}
                >
                  {["Каталог", "Профиль", "Поддержка"][i]}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

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
            <Link
              href={`/doc-verifier?integrationScope=${encodeURIComponent(rental.contractVerifierScope || `rental:${rental.rentalId}`)}&documentKey=${encodeURIComponent(rental.contractDocumentKey || `rental-${slug}-${rental.rentalId}`)}`}
              className="rounded-full border px-3 py-1 text-xs font-semibold transition hover:opacity-85"
              style={{ borderColor: accent, color: accent }}
            >
              Verify
            </Link>
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

          {/* Interactive checklist */}
          {rental.found && (
            <div className="pt-2">
              <RentalChecklistPanel
                rentalId={rental.rentalId}
                crewId={crew.id}
                slug={resolvedSlug}
                accentColor={accent}
                metadata={(rental.metadata as Record<string, any>) || undefined}
                status={status}
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="grid gap-2 sm:grid-cols-2 max-sm:grid-cols-1 pt-2">
            {status === "completed" ? (
              <>
                <Link
                  href={`/franchize/${resolvedSlug}?vehicle=${encodeURIComponent(rental.vehicleTitle || "")}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition hover:opacity-90"
                  style={{ backgroundColor: accent, color: accentTextOn }}
                >
                  <RotateCcw className="h-4 w-4 shrink-0" />
                  Арендовать снова
                </Link>
                <Link
                  href={profileHref}
                  className="inline-flex justify-center rounded-xl border px-4 py-3 text-sm transition hover:opacity-85"
                  style={{ borderColor: borderSoft, color: textPrimary }}
                >
                  <ShoppingCart className="mr-2 h-4 w-4 shrink-0" />
                  История
                </Link>
              </>
            ) : status === "active" ? (
              <>
                <Link
                  href={bikeSearchHref}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition hover:opacity-90"
                  style={{ backgroundColor: accent, color: accentTextOn }}
                >
                  <RefreshCw className="h-4 w-4 shrink-0" />
                  Продлить
                </Link>
                <Link
                  href={catalogHref}
                  className="inline-flex justify-center rounded-xl border px-4 py-3 text-sm transition hover:opacity-85"
                  style={{ borderColor: borderSoft, color: textPrimary }}
                >
                  Каталог
                </Link>
              </>
            ) : (
              <>
                <Link
                  href={`/franchize/${resolvedSlug}/cart`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition hover:opacity-90"
                  style={{ backgroundColor: accent, color: accentTextOn }}
                >
                  <Sparkles className="h-4 w-4 shrink-0" />
                  Продолжить
                </Link>
                <Link
                  href={catalogHref}
                  className="inline-flex justify-center rounded-xl border px-4 py-3 text-sm transition hover:opacity-85"
                  style={{ borderColor: borderSoft, color: textPrimary }}
                >
                  Каталог
                </Link>
              </>
            )}
          </div>

          <FranchizeRentalDocumentsPanel
            rentalId={rental.rentalId}
            ownerId={rental.ownerId}
            status={status}
            metadata={rental.metadata}
            palette={p}
          />

          <FranchizeRentalLifecycleActions
            rentalId={rental.rentalId}
            ownerId={rental.ownerId}
            renterId={rental.renterId}
            status={status}
            paymentStatus={rental.paymentStatus}
            hasPickupFreeze={Boolean((rental.metadata as { pickup_freeze?: { frozen_at?: unknown } } | null)?.pickup_freeze?.frozen_at)}
            palette={p}
          />

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
      </FranchizePageShell>

      <CrewFooter crew={crew} />
    </main>
  );
}
