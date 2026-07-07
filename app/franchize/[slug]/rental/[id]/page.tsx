import type { Metadata } from "next";
import { ExternalLink, Info, Sparkles } from "lucide-react";
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
  const dealStarted = rental.found || rental.paymentStatus === "interest_paid";
  const catalogHref = `/franchize/${resolvedSlug}`;
  const profileHref = getTelegramWebAppPageHref(`franchize/${resolvedSlug}/profile`, crew.contacts.telegramBotUsername) || `/franchize/${resolvedSlug}/profile`;
  const contactsHref = `/franchize/${resolvedSlug}/contacts`;
  const telegramSupportHref = getTelegramHandleHref(crew.contacts.telegram);
  const verificationText =
    rental.contractVerificationStatus === "verified"
      ? "Верифицирован"
      : rental.contractVerificationStatus === "expired"
        ? "Истёк"
        : "Не верифицирован";
  const verificationColor =
    rental.contractVerificationStatus === "verified"
      ? "#22c55e"
      : rental.contractVerificationStatus === "expired"
        ? "#f59e0b"
        : crew.theme.palette.textSecondary;

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
          subcopy={
            rental.found
              ? "Сделка активирована. Управляй следующим шагом аренды из Telegram WebApp или через runtime-карточку."
              : "Сделка пока не найдена. Проверь ссылку и дождись синхронизации после оплаты XTR."
          }
          primaryCta={{
            label: "Продолжить оформление",
            href: `/franchize/${resolvedSlug}/order/demo-order`,
          }}
          secondaryCta={{
            label: "К каталогу",
            href: `/franchize/${resolvedSlug}`,
          }}
        />

        <section className="rounded-3xl border p-4" style={surface.subtleCard}>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-[0.16em]"
                style={{ color: crew.theme.palette.accentMain }}
              >
                Что будет дальше
              </p>
              <ol className="mt-3 space-y-2 text-sm">
                {(rental.found
                  ? [
                      "Проверим статус оплаты, договора и выдачи в карточке аренды.",
                      "Если нужен следующий шаг — продолжите оформление или откройте сделку в Telegram WebApp.",
                      "После завершения аренды появится отзыв и финальная сверка залога/документов.",
                    ]
                  : [
                      "Подождём синхронизацию: иногда XTR/бот присылает карточку с задержкой.",
                      "Откройте Telegram fallback или напишите оператору номер сделки.",
                      "Если сделка не найдётся, вернитесь в каталог или профиль без потери навигации.",
                    ]
                ).map((step, index) => (
                  <li key={step} className="flex gap-2">
                    <span
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={{
                        backgroundColor: `${crew.theme.palette.accentMain}24`,
                        color: crew.theme.palette.accentMain,
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
                  borderColor: crew.theme.palette.borderSoft,
                }}
              >
                Безопасность оплаты и договора: статус договора показывается
                отдельно, документы проверяются через verifier, а новые списания
                или изменения условий согласуются с оператором.
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <a
                href={rental.telegramDeepLink}
                target="_blank"
                rel="noreferrer"
                className="flex justify-center rounded-xl px-4 py-3 font-semibold"
                style={{
                  backgroundColor: crew.theme.palette.accentMain,
                  color: crew.theme.palette.accentTextOn,
                }}
              >
                Открыть в TG
              </a>
              <a
                href={telegramSupportHref}
                target="_blank"
                rel="noreferrer"
                className="flex justify-center rounded-xl border px-4 py-3"
                style={{
                  borderColor: crew.theme.palette.borderSoft,
                  color: crew.theme.palette.textPrimary,
                }}
              >
                Написать оператору
              </a>
              <Link
                href={contactsHref}
                className="flex justify-center rounded-xl border px-4 py-3"
                style={{
                  borderColor: crew.theme.palette.borderSoft,
                  color: crew.theme.palette.textPrimary,
                }}
              >
                Поддержка / контакты
              </Link>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={catalogHref}
                  className="rounded-xl border px-3 py-2 text-center text-xs"
                  style={{ borderColor: crew.theme.palette.borderSoft }}
                >
                  Каталог
                </Link>
                <Link
                  href={profileHref}
                  className="rounded-xl border px-3 py-2 text-center text-xs"
                  style={{ borderColor: crew.theme.palette.borderSoft }}
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
                style={{ borderColor: crew.theme.palette.borderSoft }}
              >
                Вернуться в каталог
              </Link>
              <Link
                href={profileHref}
                className="rounded-xl border px-3 py-2 text-xs"
                style={{ borderColor: crew.theme.palette.borderSoft }}
              >
                Вернуться в профиль
              </Link>
              <Link
                href={contactsHref}
                className="rounded-xl border px-3 py-2 text-xs"
                style={{ borderColor: crew.theme.palette.borderSoft }}
              >
                Связаться с поддержкой
              </Link>
            </div>
          </section>
        ) : null}

        {dealStarted && (
          <div
            className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
            style={{
              borderColor: crew.theme.palette.accentMain,
              color: crew.theme.palette.accentMain,
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Заявка принята — продолжаем оформление 🚀
          </div>
        )}

        <section className="rounded-3xl border p-4" style={surface.subtleCard}>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span
              className="text-xs"
              style={{ color: crew.theme.palette.textSecondary }}
            >
              Проверка контракта:
            </span>
            <span
              className="rounded-full border px-3 py-1 text-xs font-semibold"
              style={{
                borderColor: verificationColor,
                color: verificationColor,
              }}
            >
              {verificationText}
            </span>
            <Link
              href={`/doc-verifier?integrationScope=${encodeURIComponent(rental.contractVerifierScope || `rental:${rental.rentalId}`)}&documentKey=${encodeURIComponent(rental.contractDocumentKey || `rental-${slug}-${rental.rentalId}`)}`}
              className="rounded-full border px-3 py-1 text-xs font-semibold"
              style={{
                borderColor: crew.theme.palette.accentMain,
                color: crew.theme.palette.accentMain,
              }}
            >
              Verify contract
            </Link>
            {rental.docVerifierRecordId ? (
              <span
                className="text-[11px]"
                style={{ color: crew.theme.palette.textSecondary }}
              >
                record: {rental.docVerifierRecordId.slice(0, 8)}…
              </span>
            ) : null}
            {rental.contractSourceScope ? (
              <span
                className="text-[11px]"
                style={{ color: crew.theme.palette.textSecondary }}
              >
                source: {rental.contractSourceScope}
              </span>
            ) : null}
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <p>
              <span style={{ color: crew.theme.palette.textSecondary }}>
                Rental ID:
              </span>{" "}
              {rental.rentalId}
            </p>
            <p>
              <span style={{ color: crew.theme.palette.textSecondary }}>
                Статус:
              </span>{" "}
              {statusLabel[rental.status] ?? rental.status}
            </p>
            <p>
              <span style={{ color: crew.theme.palette.textSecondary }}>
                Оплата:
              </span>{" "}
              {rental.paymentStatus}
            </p>
            <p>
              <span style={{ color: crew.theme.palette.textSecondary }}>
                Итого:
              </span>{" "}
              {rental.totalCost.toLocaleString("ru-RU")} ₽
            </p>
            <p className="sm:col-span-2">
              <span style={{ color: crew.theme.palette.textSecondary }}>
                Транспорт:
              </span>{" "}
              {rental.vehicleTitle}
            </p>
            {rental.contractOriginalSha256 ? (
              <p className="sm:col-span-2 break-all">
                <span style={{ color: crew.theme.palette.textSecondary }}>
                  Contract SHA256:
                </span>{" "}
                {rental.contractOriginalSha256}
              </p>
            ) : null}
          </div>

          {/* Interactive rental checklist — equipment, photos, checks */}
          <div className="mt-4">
            <RentalChecklistPanel
              rentalId={rental.rentalId}
              crewId={crew.id}
              slug={resolvedSlug}
              accentColor={crew.theme.palette.accentMain}
              metadata={(rental.metadata as Record<string, any>) || undefined}
              status={rental.status}
            />
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Link
              href={`/franchize/${resolvedSlug}/order/demo-order`}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
              style={{
                backgroundColor: crew.theme.palette.accentMain,
                color: crew.theme.palette.accentTextOn,
              }}
            >
              <Sparkles className="h-4 w-4" />
              Продолжить оформление
            </Link>
            <Link
              href={catalogHref}
              className="inline-flex justify-center rounded-xl border px-4 py-3 text-sm"
              style={{
                borderColor: crew.theme.palette.borderSoft,
                color: crew.theme.palette.textPrimary,
              }}
            >
              К каталогу
            </Link>
          </div>

          <FranchizeRentalDocumentsPanel
            rentalId={rental.rentalId}
            ownerId={rental.ownerId}
            status={rental.status}
            metadata={rental.metadata}
            palette={crew.theme.palette}
          />

          <FranchizeRentalLifecycleActions
            rentalId={rental.rentalId}
            ownerId={rental.ownerId}
            renterId={rental.renterId}
            status={rental.status}
            paymentStatus={rental.paymentStatus}
            hasPickupFreeze={Boolean(rental.metadata?.pickup_freeze?.frozen_at)}
            palette={crew.theme.palette}
          />

          <div
            className="mt-4 flex items-center justify-end gap-2 text-xs"
            style={{ color: crew.theme.palette.textSecondary }}
          >
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border"
              style={{ borderColor: crew.theme.palette.borderSoft }}
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
