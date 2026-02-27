"use client";

import Link from "next/link";
import type { CatalogItemVM, FranchizeCrewVM } from "../actions";
import { useFranchizeCartLines } from "../hooks/useFranchizeCartLines";
import { crewPaletteForSurface } from "../lib/theme";

interface CartPageClientProps {
  crew: FranchizeCrewVM;
  slug: string;
  items: CatalogItemVM[];
}

export function CartPageClient({ crew, slug, items }: CartPageClientProps) {
  const { cartLines, changeLineQty, removeLine, subtotal, itemCount } = useFranchizeCartLines(slug, items);
  const surface = crewPaletteForSurface(crew.theme);

  return (
    <section
      className="mx-auto w-full max-w-4xl px-4 py-6"
      style={{
        ["--cart-accent" as string]: crew.theme.palette.accentMain,
        ["--cart-border" as string]: crew.theme.palette.borderSoft,
      }}
    >
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--cart-accent)]">
        /franchize/{slug}/cart
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Корзина</h1>
      <p className="mt-2 text-sm" style={surface.mutedText}>Проверьте состав заказа, количество и итог перед оформлением.</p>

      {cartLines.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed p-6 text-sm" style={surface.subtleCard}>
          Корзина пока пустая. Добавьте байк из каталога, чтобы перейти к оформлению.
          <div>
            <Link
              href={`/franchize/${slug}`}
              className="mt-4 inline-flex font-medium text-[var(--cart-accent)] underline-offset-4 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cart-accent)]"
            >
              Вернуться в каталог
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            {cartLines.map((line) => (
              <article key={line.lineId} className="rounded-2xl border p-4" style={surface.card}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">{line.item?.title ?? "Позиция недоступна"}</h2>
                    <p className="text-xs" style={surface.mutedText}>
                      {line.item?.subtitle ?? "Этот товар был удалён или временно недоступен в каталоге."}
                    <span className="mt-1 block text-[11px]" style={surface.mutedText}>{line.options.package} · {line.options.duration} · {line.options.perk} · {line.options.auction}</span>
                    </p>
                    {line.item ? (
                      <p className="mt-1 text-sm font-medium text-[var(--cart-accent)]">
                        {line.item.pricePerDay.toLocaleString("ru-RU")} ₽ / день
                      </p>
                    ) : (
                      <p className="mt-1 text-xs" style={surface.mutedText}>Недоступные позиции не участвуют в расчёте суммы.</p>
                    )}
                  </div>
                  <button className="rounded-md px-1 text-xs transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cart-accent)]" style={surface.mutedText} onClick={() => removeLine(line.lineId)}>
                    Удалить
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    className="h-8 w-8 rounded-full border transition hover:opacity-90 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cart-accent)]"
                    style={{ borderColor: "var(--cart-border)" }}
                    onClick={() => changeLineQty(line.lineId, -1)}
                    aria-label="Уменьшить"
                  >
                    −
                  </button>
                  <span className="min-w-7 text-center text-sm font-medium">{line.qty}</span>
                  <button
                    className="h-8 w-8 rounded-full border transition hover:opacity-90 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cart-accent)]"
                    style={{ borderColor: "var(--cart-border)" }}
                    onClick={() => changeLineQty(line.lineId, 1)}
                    aria-label="Увеличить"
                  >
                    +
                  </button>
                </div>
              </article>
            ))}
          </div>

          <aside className="h-fit rounded-2xl border p-4" style={surface.card}>
            <p className="text-sm" style={surface.mutedText}>Итого позиций</p>
            <p className="text-2xl font-semibold">{itemCount}</p>
            <p className="mt-3 text-sm" style={surface.mutedText}>Сумма за 1 день аренды</p>
            <p className="text-2xl font-semibold text-[var(--cart-accent)]">
              {subtotal.toLocaleString("ru-RU")} ₽
            </p>
            <Link
              href={`/franchize/${slug}/order/demo-order`}
              className="mt-4 inline-flex w-full justify-center rounded-xl bg-[var(--cart-accent)] px-4 py-3 text-sm font-semibold text-[#16130A] transition hover:brightness-105 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cart-accent)]"
            >
              Перейти к оформлению
            </Link>
          </aside>
        </div>
      )}
    </section>
  );
}
