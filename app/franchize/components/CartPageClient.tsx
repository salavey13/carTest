"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { CatalogItemVM, FranchizeCrewVM } from "../actions";
import { useFranchizeCart } from "../hooks/useFranchizeCart";

interface CartPageClientProps {
  crew: FranchizeCrewVM;
  slug: string;
  items: CatalogItemVM[];
}

type CartLineVM = {
  itemId: string;
  qty: number;
  item: CatalogItemVM | null;
};

export function CartPageClient({ crew, slug, items }: CartPageClientProps) {
  const { cart, changeItemQty, removeItem } = useFranchizeCart(slug);

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const cartLines = useMemo<CartLineVM[]>(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => ({
        itemId,
        qty,
        item: itemById.get(itemId) ?? null,
      }));
  }, [cart, itemById]);

  const realCartLines = useMemo(() => cartLines.filter((line) => line.item), [cartLines]);

  const total = realCartLines.reduce((sum, line) => sum + (line.item?.pricePerDay ?? 0) * line.qty, 0);
  const count = realCartLines.reduce((sum, line) => sum + line.qty, 0);

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-6">
      <p className="text-xs uppercase tracking-[0.2em]" style={{ color: crew.theme.palette.accentMain }}>
        /franchize/{slug}/cart
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Корзина</h1>
      <p className="mt-2 text-sm text-muted-foreground">Проверьте состав заказа, количество и итог перед оформлением.</p>

      {cartLines.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          Корзина пока пустая. Добавьте байк из каталога, чтобы перейти к оформлению.
          <div>
            <Link
              href={`/franchize/${slug}`}
              className="mt-4 inline-flex font-medium underline-offset-4 hover:underline"
              style={{ color: crew.theme.palette.accentMain }}
            >
              Вернуться в каталог
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            {cartLines.map((line) => (
              <article key={line.itemId} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">{line.item?.title ?? "Позиция недоступна"}</h2>
                    <p className="text-xs text-muted-foreground">
                      {line.item?.subtitle ?? "Этот товар был удалён или временно недоступен в каталоге."}
                    </p>
                    {line.item ? (
                      <p className="mt-1 text-sm font-medium" style={{ color: crew.theme.palette.accentMain }}>
                        {line.item.pricePerDay.toLocaleString("ru-RU")} ₽ / день
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">Недоступные позиции не участвуют в расчёте суммы.</p>
                    )}
                  </div>
                  <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => removeItem(line.itemId)}>
                    Удалить
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    className="h-8 w-8 rounded-full border border-border"
                    onClick={() => changeItemQty(line.itemId, -1)}
                    aria-label="Уменьшить"
                  >
                    −
                  </button>
                  <span className="min-w-7 text-center text-sm font-medium">{line.qty}</span>
                  <button
                    className="h-8 w-8 rounded-full border border-border"
                    onClick={() => changeItemQty(line.itemId, 1)}
                    aria-label="Увеличить"
                  >
                    +
                  </button>
                </div>
              </article>
            ))}
          </div>

          <aside className="h-fit rounded-2xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Итого позиций</p>
            <p className="text-2xl font-semibold">{count}</p>
            <p className="mt-3 text-sm text-muted-foreground">Сумма за 1 день аренды</p>
            <p className="text-2xl font-semibold" style={{ color: crew.theme.palette.accentMain }}>
              {total.toLocaleString("ru-RU")} ₽
            </p>
            <Link
              href={`/franchize/${slug}/order/demo-order`}
              className="mt-4 inline-flex w-full justify-center rounded-xl px-4 py-3 text-sm font-semibold"
              style={{ backgroundColor: crew.theme.palette.accentMain, color: "#16130A" }}
            >
              Перейти к оформлению
            </Link>
          </aside>
        </div>
      )}
    </section>
  );
}
