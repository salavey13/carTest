import type { Metadata } from "next";
import { ExternalLink, Info, RefreshCw, RotateCcw, ShoppingCart, Sparkles } from "lucide-react";
import Link from "next/link";
import { getFranchizeBySlug, getFranchizeRentalCard } from "../../../actions";
import { CrewHeader } from "../../../components/CrewHeader";
import { CrewFooter } from "../../../components/CrewFooter";
import { FranchizeRentalLifecycleActions } from "../../../components/FranchizeRentalLifecycleActions";
import { FranchizeHero } from "../../../components/FranchizeHero";
import { FranchizePageShell } from "../../../components/FranchizePageShell";
import { FranchizeRentalDocumentsPanel } from "../../../components/FranchizeRentalDocumentsPanel";
import { RentalChecklistPanel } from "../../../components/RentalChecklistPanel";
import { getTelegramHandleHref, getTelegramWebAppPageHref } from "../../../lib/telegram-links";
import { crewPaletteForSurface } from "../../../lib/theme";
import { buildFranchizeSectionMetadata } from "../../metadata";

interface FranchizeRentalPageProps {
  params: Promise<{ slug: string; id: string }>;
}

const statusLabel: Record<string, string> = {
  pending_confirmation: "Ожидает подтверждения",
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

export async function generateMetadata({
  params,
}: FranchizeRentalPageProps): Promise<Metadata> {
  const { slug, id } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Карточка аренды",
    sectionDescription:
      "Карточка аренды экипажа: статус сделки, документы, проверка контракта и дальнейшие действия.",
    pathSuffix: `/rental/${id}`,
  });
}

export default async function FranchizeRentalPage({
  params,
}: FranchizeRentalPageProps) {
  const { slug, id } = await params;
  const [{ crew, items }, rental] = await Promise.all([
    getFranchizeBySlug(slug),
    getFranchizeRentalCard(slug, id),
  ]);
  const resolvedSlug = crew.slug || slug;
  const surface = crewPaletteForSurface(crew.theme);
  const p = crew.theme.palette;
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
        : { badgeBg: `${p.textSecondary}20`, badgeText: p.textSecondary };

  // Status-aware hero subcopy & CTAs
  const heroCopy: Record<string, { subcopy: string; primaryCta: { label: string; href: string }; secondaryCta: { label: string; href: string } }> = {
    pending_confirmation: {
      subcopy: "Заявка ждёт подтверждения оператором. Проверьте статус оплаты и контракта.",
      primaryCta: { label: "Продолжить оформление", href: `/franchize/${resolvedSlug}/order/demo-order` },
      secondaryCta: { label: "К каталогу", href: catalogHref },
    },
    confirmed: {
      subcopy: "Аренда подтверждена. Подготовьте документы и передайте ТС.",
      primaryCta: { label: "Перейти к выдаче", href: `/franchize/${resolvedSlug}/order/demo-order` },
      secondaryCta: { label: "К каталогу", href: catalogHref },
    },
    active: {
      subcopy: "ТС у арендатора. Следите за статусом, чек-листом и сроками возврата.",
      primaryCta: { label: "Продлить аренду", href: `/franchize/${resolvedSlug}/order/demo-order` },
      secondaryCta: { label: "К каталогу", href: catalogHref },
    },
    completed: {
      subcopy: "Аренда завершена. Депозит возвращён, документы подписаны.",
      primaryCta: { label: "Арендовать снова", href: `/franchize/${resolvedSlug}?bikeId=${encodeURIComponent(rental.vehicleTitle || "")}` },
      secondaryCta: { label: "Оставить отзыв", href: contactsHref },
    },
    cancelled: {
      subcopy: "Аренда отменена. Если ошиблись — свяжитесь с оператором.",
      primaryCta: { label: "Заказать ещё раз", href: catalogHref },
      secondaryCta: { label: "Написать оператору", href: telegramSupportHref },
    },
  };
  const heroDefault = {
    subcopy: rental.found
      ? "Сделка активирована. Управляйте арендой из Telegram WebApp."
      : "Сделка пока не найдена. Проверьте ссылку или напишите оператору.",
    primaryCta: { label: "Продолжить оформление", href: `/franchize/${resolvedSlug}/order/demo-order` },
    secondaryCta: { label: "К каталогу", href: catalogHref },
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

        {/* Status badge + next steps */}
        <section className="rounded-3xl border p-4" style={surface.subtleCard}>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] max-sm:grid-cols-1">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: statusStyle.badgeBg,
                    color: statusStyle.badgeText,
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusStyle.badgeText }} />
                  {statusLabel[status] || status}
                </span>
                {rental.found && (
                  <span className="text-xs" style={{ color: p.textSecondary }}>
                    ID: {rental.rentalId?.slice(0, 8)}…
                  </span>
                )}
              </div>
              <p
                className="text-xs font-semibold uppercase tracking-[0.16em]"
                style={{ color: p.accentMain }}
              >
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
                          "ТС возвращён, документы подписаны, депозит возвращён.",
                          "Контракт верифицирован и сохранён в истории аренд.",
                          "Чтобы арендовать этот байк снова — нажмите «Арендовать снова».",
                        ]
                      : status === "active"
                        ? [
                            "Отслеживайте возврат ТС по чек-листу.",
                            "После возврата — проверьте состояние, пробег и комплектацию.",
                            "Подпишите акт возврата и верните депозит.",
                          ]
                        : [
                            "Проверим статус оплаты, договора и выдачи в карточке аренды.",
                            "Если нужен следующий шаг — продолжите оформление или откройте сделку в Telegram WebApp.",
                            "После завершения аренды появится финальная сверка залога и документов.",
                          ]
                    )
                  : [
                      "Подождём синхронизацию: иногда XTR/бот присылает карточку с задержкой.",
                      "Откройте Telegram fallback или напишите оператору номер сделки.",
                      "Если сделка не найдётся, вернитесь в каталог или профиль.",
                    ]
                ).map((step, index) => (
                  <li key={step} className="flex gap-2">
                    <span
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={{
                        backgroundColor: `${p.accentMain}24`,
                        color: p.accentMain,
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
                style={{
                  ...surface.card,
                  borderColor: p.borderSoft,
                }}
              >
                {status === "completed"
                  ? "История аренды сохранена. Документы доступны в верификаторе."
                  : "Безопасность оплаты и договора: статус договора показывается отдельно, документы проверяются через verifier."}
              </p>
            </div>
            <div className="space-y-2 text-sm">
              {status !== "completed" && status !== "cancelled" && (
                <a
                  href={rental.telegramDeepLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex justify-center rounded-xl px-4 py-3 font-semibold"
                  style={{
                    backgroundColor: p.accentMain,
                    color: p.accentTextOn,
                  }}
                >
                  Открыть в TG
                </a>
              )}
              <a
                href={telegramSupportHref}
                target="_blank"
                rel="noreferrer"
                className="flex justify-center rounded-xl border px-4 py-3"
                style={{
                  borderColor: p.borderSoft,
                  color: p.textPrimary,
                }}
              >
                Написать оператору
              </a>
              <Link
                href={contactsHref}
                className="flex justify-center rounded-xl border px-4 py-3"
                style={{
                  borderColor: p.borderSoft,
                  color: p.textPrimary,
                }}
              >
                Поддержка / контакты
              </Link>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={catalogHref}
                  className="rounded-xl border px-3 py-2 text-center text-xs"
                  style={{ borderColor: p.borderSoft }}
                >
                  Каталог
                </Link>
                <Link
                  href={profileHref}
                  className="rounded-xl border px-3 py-2 text-center text-xs"
                  style={{ borderColor: p.borderSoft }}
                >
                  Профиль
                </Link>
              </div>
            </div>
          </div>
        </section>

        {!rental.found ? (
          <section
            className="rounded-3xl border border-dashed p-4 text-sm"
            style={surface.card}
          >
            <h2 className="font-semibold">Карточка аренды ещё не найдена</h2>
            <p className="mt-2" style={surface.mutedText}>
              Проверьте ID в ссылке, откройте fallback deeplink Telegram или
              вернитесь в профиль — там останутся последние активные заявки.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={catalogHref}
                className="rounded-xl border px-3 py-2 text-xs"
                style={{ borderColor: p.borderSoft }}
              >
                Вернуться в каталог
              </Link>
              <Link
                href={profileHref}
                className="rounded-xl border px-3 py-2 text-xs"
                style={{ borderColor: p.borderSoft }}
              >
                Вернуться в профиль
              </Link>
              <Link
                href={contactsHref}
                className="rounded-xl border px-3 py-2 text-xs"
                style={{ borderColor: p.borderSoft }}
              >
                Связаться с поддержкой
              </Link>
            </div>
          </section>
        ) : null}

        {dealStarted && status !== "completed" && status !== "cancelled" && (
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
            style={{
              borderColor: p.accentMain,
              color: p.accentMain,
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {status === "active" ? "ТС у арендатора" : "Заявка принята — продолжаем"}
          </div>
        )}

        <section className="rounded-3xl border p-4" style={surface.subtleCard}>
          {/* Contract verification */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs" style={{ color: p.textSecondary }}>
              Контракт:
            </span>
            <span
              className="rounded-full border px-3 py-1 text-xs font-semibold"
              style={{
                borderColor: verificationStatusStyle.badgeText,
                color: verificationStatusStyle.badgeText,
              }}
            >
              {verificationText}
            </span>
            <Link
              href={`/doc-verifier?integrationScope=${encodeURIComponent(rental.contractVerifierScope || `rental:${rental.rentalId}`)}&documentKey=${encodeURIComponent(rental.contractDocumentKey || `rental-${slug}-${rental.rentalId}`)}`}
              className="rounded-full border px-3 py-1 text-xs font-semibold"
              style={{
                borderColor: p.accentMain,
                color: p.accentMain,
              }}
            >
              Verify contract
            </Link>
            {rental.docVerifierRecordId ? (
              <span className="text-[11px]" style={{ color: p.textSecondary }}>
                record: {rental.docVerifierRecordId.slice(0, 8)}…
              </span>
            ) : null}
            {rental.contractSourceScope ? (
              <span className="text-[11px]" style={{ color: p.textSecondary }}>
                source: {rental.contractSourceScope}
              </span>
            ) : null}
          </div>

          {/* Rental details grid */}
          <div className="grid gap-3 text-sm sm:grid-cols-2 max-sm:grid-cols-1">
            <p>
              <span style={{ color: p.textSecondary }}>Статус:</span>{" "}
              <span
                className="font-semibold"
                style={{ color: statusStyle.badgeText }}
              >
                {statusLabel[status] || status}
              </span>
            </p>
            {rental.paymentStatus && (
              <p>
                <span style={{ color: p.textSecondary }}>Оплата:</span>{" "}
                {rental.paymentStatus}
              </p>
            )}
            {rental.totalCost > 0 && (
              <p>
                <span style={{ color: p.textSecondary }}>Итого:</span>{" "}
                {rental.totalCost.toLocaleString("ru-RU")} ₽
              </p>
            )}
            <p className={rental.totalCost > 0 ? "" : "sm:col-span-2"}>
              <span style={{ color: p.textSecondary }}>Транспорт:</span>{" "}
              {rental.vehicleTitle}
            </p>
            {rental.renterName && (
              <p className="sm:col-span-2">
                <span style={{ color: p.textSecondary }}>Арендатор:</span>{" "}
                {rental.renterName}
              </p>
            )}
            {rental.contractOriginalSha256 ? (
              <p className="sm:col-span-2 break-all">
                <span style={{ color: p.textSecondary }}>
                  Contract SHA256:
                </span>{" "}
                {rental.contractOriginalSha256}
              </p>
            ) : null}
          </div>

          {/* Interactive rental checklist — equipment, photos, checks */}
          {rental.found && (
            <div className="mt-4">
              <RentalChecklistPanel
                rentalId={rental.rentalId}
                crewId={crew.id}
                slug={resolvedSlug}
                accentColor={p.accentMain}
                metadata={(rental.metadata as Record<string, any>) || undefined}
                status={status}
              />
            </div>
          )}

          {/* Status-aware action buttons */}
          <div className="mt-5 grid gap-2 sm:grid-cols-2 max-sm:grid-cols-1">
            {status === "completed" ? (
              <>
                <Link
                  href={`/franchize/${resolvedSlug}?bikeId=${encodeURIComponent(rental.vehicleTitle || "")}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
                  style={{
                    backgroundColor: p.accentMain,
                    color: p.accentTextOn,
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  Арендовать снова
                </Link>
                <Link
                  href={profileHref}
                  className="inline-flex justify-center rounded-xl border px-4 py-3 text-sm"
                  style={{
                    borderColor: p.borderSoft,
                    color: p.textPrimary,
                  }}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  История аренд
                </Link>
              </>
            ) : status === "active" ? (
              <>
                <Link
                  href={`/franchize/${resolvedSlug}/order/demo-order`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
                  style={{
                    backgroundColor: p.accentMain,
                    color: p.accentTextOn,
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  Продлить аренду
                </Link>
                <Link
                  href={catalogHref}
                  className="inline-flex justify-center rounded-xl border px-4 py-3 text-sm"
                  style={{
                    borderColor: p.borderSoft,
                    color: p.textPrimary,
                  }}
                >
                  К каталогу
                </Link>
              </>
            ) : (
              <>
                <Link
                  href={`/franchize/${resolvedSlug}/order/demo-order`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
                  style={{
                    backgroundColor: p.accentMain,
                    color: p.accentTextOn,
                  }}
                >
                  <Sparkles className="h-4 w-4" />
                  Продолжить оформление
                </Link>
                <Link
                  href={catalogHref}
                  className="inline-flex justify-center rounded-xl border px-4 py-3 text-sm"
                  style={{
                    borderColor: p.borderSoft,
                    color: p.textPrimary,
                  }}
                >
                  К каталогу
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
            hasPickupFreeze={Boolean(rental.metadata?.pickup_freeze?.frozen_at)}
            palette={p}
          />

          <div
            className="mt-4 flex items-center justify-end gap-2 text-xs"
            style={{ color: p.textSecondary }}
          >
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border"
              style={{ borderColor: p.borderSoft }}
              title="Deep-link fallback: если карточка открылась вне Telegram mini-app, вернёт в контекст startapp=rental-..."
              aria-label="Информация о Telegram fallback"
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
        </section>
      </FranchizePageShell>

      <CrewFooter crew={crew} />
    </main>
  );
}
