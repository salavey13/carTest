import { ExternalLink, Info, Sparkles } from "lucide-react";
import { getFranchizeBySlug, getFranchizeRentalCard } from "../../../actions";
import { CrewHeader } from "../../../components/CrewHeader";
import { CrewFooter } from "../../../components/CrewFooter";
import { FranchizeRentalLifecycleActions } from "../../../components/FranchizeRentalLifecycleActions";

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

export default async function FranchizeRentalPage({ params }: FranchizeRentalPageProps) {
  const { slug, id } = await params;
  const [{ crew }, rental] = await Promise.all([getFranchizeBySlug(slug), getFranchizeRentalCard(slug, id)]);
  const dealStarted = rental.found || rental.paymentStatus === "interest_paid";

  return (
    <main className="min-h-screen" style={{ backgroundColor: crew.theme.palette.bgBase, color: crew.theme.palette.textPrimary }}>
      <CrewHeader crew={crew} activePath={`/franchize/${slug}/rental/${id}`} />

      <section className="mx-auto w-full max-w-4xl px-4 pb-8 pt-10">
        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: crew.theme.palette.accentMain }}>
          /franchize/{slug}/rental/{id}
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Franchize rental card</h1>
        <p className="mt-2 text-sm" style={{ color: crew.theme.palette.textSecondary }}>
          {rental.found
            ? "Сделка активирована. Управляй следующим шагом аренды из Telegram WebApp или через runtime-карточку."
            : "Сделка пока не найдена. Проверь ссылку и дождись синхронизации после оплаты XTR."}
        </p>

        {dealStarted && (
          <div
            className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
            style={{ borderColor: crew.theme.palette.accentMain, color: crew.theme.palette.accentMain }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Deal is starting for real — продолжаем оформление 🚀
          </div>
        )}

        <section className="mt-6 rounded-3xl border p-4 shadow-[0_18px_30px_rgba(0,0,0,0.35)]" style={{ borderColor: crew.theme.palette.borderSoft, backgroundColor: crew.theme.palette.bgCard }}>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <p><span style={{ color: crew.theme.palette.textSecondary }}>Rental ID:</span> {rental.rentalId}</p>
            <p><span style={{ color: crew.theme.palette.textSecondary }}>Статус:</span> {statusLabel[rental.status] ?? rental.status}</p>
            <p><span style={{ color: crew.theme.palette.textSecondary }}>Оплата:</span> {rental.paymentStatus}</p>
            <p><span style={{ color: crew.theme.palette.textSecondary }}>Итого:</span> {rental.totalCost.toLocaleString("ru-RU")} ₽</p>
            <p className="sm:col-span-2"><span style={{ color: crew.theme.palette.textSecondary }}>Транспорт:</span> {rental.vehicleTitle}</p>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <a
              href={`/franchize/${slug}/order/demo-order`}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
              style={{ backgroundColor: crew.theme.palette.accentMain, color: "#16130A" }}
            >
              <Sparkles className="h-4 w-4" />
              Продолжить оформление
            </a>
            <a
              href={`/franchize/${slug}`}
              className="inline-flex justify-center rounded-xl border px-4 py-3 text-sm"
              style={{ borderColor: crew.theme.palette.borderSoft, color: crew.theme.palette.textPrimary }}
            >
              К каталогу
            </a>
          </div>



          <FranchizeRentalLifecycleActions
            rentalId={rental.rentalId}
            ownerId={rental.ownerId}
            renterId={rental.renterId}
            status={rental.status}
            paymentStatus={rental.paymentStatus}
            palette={crew.theme.palette}
          />

          <div className="mt-4 flex items-center justify-end gap-2 text-xs" style={{ color: crew.theme.palette.textSecondary }}>
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
              Открыть в Telegram (fallback)
            </a>
          </div>
        </section>
      </section>

      <CrewFooter crew={crew} />
    </main>
  );
}
