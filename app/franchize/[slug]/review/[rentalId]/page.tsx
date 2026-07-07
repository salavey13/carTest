import type { Metadata } from "next";
import Link from "next/link";
import { getFranchizeBySlug, getRentalReviewContext } from "../../../actions";
import { CrewHeader } from "../../../components/CrewHeader";
import { CrewFooter } from "../../../components/CrewFooter";
import {
  getTelegramHandleHref,
  getTelegramWebAppFallbackHref,
} from "../../../lib/telegram-links";
import { crewPaletteForSurface } from "../../../lib/theme";
import { ReviewForm } from "./ReviewForm";
import { buildFranchizeSectionMetadata } from "../../metadata";

interface RentalReviewPageProps {
  params: Promise<{ slug: string; rentalId: string }>;
}

export async function generateMetadata({
  params,
}: RentalReviewPageProps): Promise<Metadata> {
  const { slug, rentalId } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Отзыв об аренде",
    sectionDescription:
      "Страница отзыва после аренды: оценка байка, впечатления райдера и обратная связь экипажу.",
    pathSuffix: `/review/${rentalId}`,
  });
}

export default async function RentalReviewPage({
  params,
}: RentalReviewPageProps) {
  const { slug, rentalId } = await params;
  const [{ crew, items }, context] = await Promise.all([
    getFranchizeBySlug(slug),
    getRentalReviewContext({ slug, rentalId }),
  ]);
  const surface = crewPaletteForSurface(crew.theme);
  const rental = context.rental;
  const resolvedSlug = crew.slug || slug;
  const catalogHref = `/franchize/${resolvedSlug}`;
  const profileHref = `/franchize/${resolvedSlug}/profile`;
  const contactsHref = `/franchize/${resolvedSlug}/contacts`;
  const telegramSupportHref = getTelegramHandleHref(crew.contacts.telegram);
  const telegramFallbackHref = getTelegramWebAppFallbackHref(
    "review",
    rentalId,
    crew.contacts.telegramBotUsername,
  );

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader
        crew={crew}
        activePath={`/franchize/${resolvedSlug}`}
        groupLinks={items.map((item) => item.category)}
      />
      <section className="px-4 py-8">
        <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          {rental ? (
            <ReviewForm
              slug={resolvedSlug}
              rentalId={rental.rentalId}
              bikeTitle={rental.bikeTitle}
              status={rental.status}
              renterUserId={rental.userId}
              theme={crew.theme}
              existingReview={rental.existingReview}
            />
          ) : (
            <div className="rounded-3xl border p-5" style={surface.card}>
              <h1 className="text-xl font-semibold">Отзыв недоступен</h1>
              <p className="mt-2 text-sm" style={surface.mutedText}>
                {context.error ||
                  "Мы не нашли аренду по этой ссылке. Проверьте rental ID, откройте ссылку из Telegram или напишите оператору."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <Link
                  href={catalogHref}
                  className="rounded-xl border px-3 py-2"
                  style={{ borderColor: crew.theme.palette.borderSoft }}
                >
                  Вернуться в каталог
                </Link>
                <Link
                  href={profileHref}
                  className="rounded-xl border px-3 py-2"
                  style={{ borderColor: crew.theme.palette.borderSoft }}
                >
                  Вернуться в профиль
                </Link>
                <Link
                  href={contactsHref}
                  className="rounded-xl border px-3 py-2"
                  style={{ borderColor: crew.theme.palette.borderSoft }}
                >
                  Поддержка
                </Link>
              </div>
            </div>
          )}

          <aside
            className="h-fit rounded-3xl border p-4 text-sm"
            style={surface.subtleCard}
          >
            <p
              className="text-xs font-semibold uppercase tracking-[0.16em]"
              style={{ color: crew.theme.palette.accentMain }}
            >
              Что будет дальше
            </p>
            <ol className="mt-3 space-y-2">
              {(rental
                ? [
                    "Проверьте, что аренда завершена и Telegram-профиль совпадает с арендатором.",
                    "Оставьте оценку и пару строк — отзыв попадёт экипажу после безопасной WebApp-проверки.",
                    "Если форма закрыта, оператор поможет сверить статус аренды и ссылку на отзыв.",
                  ]
                : [
                    "Сначала восстановим правильную карточку аренды через Telegram или профиль.",
                    "Оператор проверит статус договора/оплаты и пришлёт рабочую ссылку.",
                    "После завершения аренды отзыв можно будет сохранить без повторной оплаты.",
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
              Безопасность: отзыв не запускает списания; договор и оплата уже
              проверяются в карточке аренды, а доступ к сохранению
              подтверждается Telegram WebApp-сессией.
            </p>
            <div className="mt-3 space-y-2">
              <a
                href={telegramFallbackHref}
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
          </aside>
        </div>
      </section>
      <CrewFooter crew={crew} />
    </main>
  );
}
