"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CatalogItemVM, FranchizeCrewVM } from "../actions";
import { upsertFranchizeIntent } from "../actions";
import { useFranchizeCartLines } from "../hooks/useFranchizeCartLines";
import { useFranchizeCart } from "../hooks/useFranchizeCart"; // Import cart state access
import { crewPaletteForSurface } from "../lib/theme";
import { saveUserFranchizeCartAction } from "@/contexts/actions"; // Explicit import
import { useAppContext } from "@/contexts/AppContext";

interface CartPageClientProps {
  crew: FranchizeCrewVM;
  slug: string;
  items: CatalogItemVM[];
}

export function CartPageClient({ crew, slug, items }: CartPageClientProps) {
  const { cart, itemCount: rawItemCount, changeLineQty, removeLine } = useFranchizeCart(slug);
  const { cartLines, subtotal, itemCount } = useFranchizeCartLines(slug, items, {
    cart,
    itemCount: rawItemCount,
    changeLineQty,
    removeLine,
  });
  const surface = crewPaletteForSurface(crew.theme);
  const router = useRouter();
  const { dbUser, user } = useAppContext();
  const [isSaving, setIsSaving] = useState(false);

  const handleProceed = async () => {
    setIsSaving(true);
    const saleLinesCount = cartLines.filter((line) => line.saleAvailable).length;
    const flow = saleLinesCount > 0 && saleLinesCount === cartLines.length ? "sale" : saleLinesCount > 0 ? "mixed" : "rental";
    const intentPromise = upsertFranchizeIntent({
      slug,
      bikeId: cartLines[0]?.item?.id ?? cartLines[0]?.itemId,
      intentType: "checkout_start",
      stage: "checkout_started",
      sourceRoute: `/franchize/${slug}/cart`,
      contactChannel: "web_cart",
      urgencyScore: flow === "rental" ? 70 : 80,
      telegramUserId: user?.id ? String(user.id) : dbUser?.user_id ? String(dbUser.user_id) : undefined,
      phone: typeof (dbUser as { phone?: unknown } | null)?.phone === "string" ? (dbUser as { phone?: string } | null)?.phone : undefined,
      metadata: {
        flow,
        itemCount,
        subtotal,
        cartLines: cartLines.map((line) => ({
          itemId: line.item?.id ?? line.itemId,
          qty: line.qty,
          saleAvailable: line.saleAvailable,
          lineTotal: line.lineTotal,
        })),
      },
    }).catch((error) => console.warn("checkout intent tracking failed", error));
    // Sync to DB explicitly before navigating; keep checkout-intent persistence in the same checkpoint.
    if (dbUser?.user_id) {
        await Promise.allSettled([saveUserFranchizeCartAction(dbUser.user_id, slug, cart), intentPromise]);
    } else {
        await intentPromise;
    }
    // Navigate even if save failed (local storage might still be used by next page if hydrated client-side)
    router.push(`/franchize/${slug}/order/demo-order?flow=${flow}`);
  };

  return (
    <section
      className="mx-auto w-full max-w-5xl px-4 py-6"
      style={{
        ["--cart-accent" as string]: crew.theme.palette.accentMain,
        ["--cart-border" as string]: crew.theme.palette.borderSoft,
      }}
    >
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--cart-accent)]">
        /franchize/{slug}/cart
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Корзина</h1>
      <p className="mt-2 text-sm" style={surface.mutedText}>Проверьте состав заказа, количество и итог перед оформлением.</p>

      {cartLines.length === 0 && rawItemCount === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed p-6 text-sm" style={surface.subtleCard}>
          Корзина пока пустая. Добавьте позицию из каталога, чтобы перейти к оформлению.
          <div className="mt-4">
             {/* Using standard anchor/button for back link to be safe */}
             <button
                onClick={() => router.push(`/franchize/${slug}`)}
                className="inline-flex font-medium text-[var(--cart-accent)] underline-offset-4 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cart-accent)]"
             >
              Вернуться в каталог
             </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            {cartLines.map((line) => (
              <article key={line.lineId} className="rounded-3xl border p-4 md:p-5" style={surface.card}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    {line.item?.imageUrl ? (
                      <img
                        src={line.item.imageUrl}
                        alt={line.item.title}
                        className="h-24 w-20 shrink-0 rounded-xl object-cover md:h-28 md:w-24"
                      />
                    ) : null}
                    <div className="min-w-0">
                    <h2 className="text-xl font-semibold">{line.item?.title ?? "Позиция недоступна"}</h2>
                    <p className="text-xs" style={surface.mutedText}>
                      {line.item?.subtitle ?? "Этот товар был удалён или временно недоступен в каталоге."}
                    <span className="mt-1 block text-[11px]" style={surface.mutedText}>{line.options.package} · {line.options.duration} · {line.options.perk} · {line.options.auction}</span>
                    </p>
                    {line.item ? (
                      <p className="mt-1 text-sm font-medium text-[var(--cart-accent)]">
                        {line.item.rentPriceLabel}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs" style={surface.mutedText}>Недоступные позиции не участвуют в расчёте суммы.</p>
                    )}
                    </div>
                  </div>
                  <button className="rounded-md px-1 text-xs transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cart-accent)]" style={surface.mutedText} onClick={() => removeLine(line.lineId)}>
                    Удалить
                  </button>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/10 p-2">
                  <p className="text-sm font-semibold text-[var(--cart-accent)]">{line.lineTotal.toLocaleString("ru-RU")} ₽</p>
                  <div className="flex items-center gap-2">
                  <button
                    className="h-8 w-8 rounded-full border transition hover:opacity-90 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cart-accent)]"
                    style={{ borderColor: "var(--cart-border)" }}
                    onClick={() => changeLineQty(line.lineId, -1)}
                    aria-label="Уменьшить"
                  >
                    −
                  </button>
                  <span className="min-w-8 text-center text-lg font-medium">{line.qty}</span>
                  <button
                    className="h-8 w-8 rounded-full border transition hover:opacity-90 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cart-accent)]"
                    style={{ borderColor: "var(--cart-border)" }}
                    onClick={() => changeLineQty(line.lineId, 1)}
                    aria-label="Увеличить"
                  >
                    +
                  </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <aside className="h-fit rounded-3xl border p-4 md:sticky md:top-24 md:p-5" style={surface.card}>
            <p className="text-sm" style={surface.mutedText}>Итого позиций</p>
            <p className="text-3xl font-semibold">{itemCount}</p>
            <p className="mt-3 text-sm" style={surface.mutedText}>Сумма за 1 день аренды</p>
            <p className="text-4xl font-semibold text-[var(--cart-accent)]">
              {subtotal.toLocaleString("ru-RU")} ₽
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
              <span className="rounded-full border px-2 py-1" style={surface.subtleCard}>Быстрое оформление</span>
              <span className="rounded-full border px-2 py-1" style={surface.subtleCard}>Без скрытых платежей</span>
              <span className="rounded-full border px-2 py-1" style={surface.subtleCard}>Поддержка 24/7</span>
            </div>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleProceed}
              className="mt-5 inline-flex w-full justify-center rounded-2xl bg-[var(--cart-accent)] px-4 py-4 text-lg font-semibold text-[#16130A] transition hover:brightness-105 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cart-accent)] cursor-pointer disabled:opacity-70"
            >
              {isSaving ? "Сохранение..." : "Перейти к оформлению"}
            </button>
          </aside>
        </div>
      )}
    </section>
  );
}
