import Link from "next/link";
import { getFranchizeBySlug, getFranchizeRentalCard } from "../../../../actions";

interface FranchizeRentalPageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function FranchizeRentalPage({ params }: FranchizeRentalPageProps) {
  const { slug, id } = await params;
  const [{ crew }, rental] = await Promise.all([getFranchizeBySlug(slug), getFranchizeRentalCard(slug, id)]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 text-foreground">
      <p className="text-xs uppercase tracking-[0.2em]" style={{ color: crew.theme.palette.accentMain }}>
        /franchize/{slug}/rental/{id}
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Сделка по аренде</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {rental.found
          ? "XTR-подтверждение получено. Продолжай чеклист аренды из WebApp или открой сделку в Telegram."
          : "Сделка пока не найдена. Проверь ссылку или дождись синхронизации после оплаты."}
      </p>

      <section className="mt-6 rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <p><span className="text-muted-foreground">Rental ID:</span> {rental.rentalId}</p>
          <p><span className="text-muted-foreground">Статус:</span> {rental.status}</p>
          <p><span className="text-muted-foreground">Оплата:</span> {rental.paymentStatus}</p>
          <p><span className="text-muted-foreground">Итого:</span> {rental.totalCost.toLocaleString("ru-RU")} ₽</p>
          <p className="sm:col-span-2"><span className="text-muted-foreground">Транспорт:</span> {rental.vehicleTitle}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={rental.telegramDeepLink}
            className="inline-flex rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ backgroundColor: crew.theme.palette.accentMain, color: "#16130A" }}
          >
            Открыть в Telegram WebApp
          </a>
          <Link href={`/franchize/${slug}`} className="inline-flex rounded-xl border border-border px-4 py-2 text-sm">
            К каталогу
          </Link>
          <Link href={`/rentals/${id}`} className="inline-flex rounded-xl border border-border px-4 py-2 text-sm">
            Legacy rentals view
          </Link>
        </div>
      </section>
    </main>
  );
}
