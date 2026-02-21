import Link from "next/link";
import { getFranchizeBySlug, getFranchizeRentalCard } from "../../../actions";
import { CrewHeader } from "../../../components/CrewHeader";
import { CrewFooter } from "../../../components/CrewFooter";

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
              href={rental.telegramDeepLink}
              className="inline-flex justify-center rounded-xl px-4 py-3 text-sm font-semibold"
              style={{ backgroundColor: crew.theme.palette.accentMain, color: "#16130A" }}
            >
              Открыть в Telegram WebApp
            </a>
            <Link
              href={`/franchize/${slug}`}
              className="inline-flex justify-center rounded-xl border px-4 py-3 text-sm"
              style={{ borderColor: crew.theme.palette.borderSoft, color: crew.theme.palette.textPrimary }}
            >
              К каталогу
            </Link>
            <Link
              href={`/franchize/${slug}/order/demo-order`}
              className="inline-flex justify-center rounded-xl border px-4 py-3 text-sm"
              style={{ borderColor: crew.theme.palette.borderSoft, color: crew.theme.palette.textPrimary }}
            >
              Открыть checkout
            </Link>
            <Link
              href={`/rentals/${id}`}
              className="inline-flex justify-center rounded-xl border px-4 py-3 text-sm"
              style={{ borderColor: crew.theme.palette.borderSoft, color: crew.theme.palette.textSecondary }}
            >
              Legacy rentals (fallback)
            </Link>
          </div>
        </section>
      </section>

      <CrewFooter crew={crew} />
    </main>
  );
}
