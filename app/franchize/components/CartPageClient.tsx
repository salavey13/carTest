"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CatalogItemVM, FranchizeCrewVM } from "../actions";
import { upsertFranchizeIntent, validateFranchizePromoCode } from "../actions";
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
  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [isPromoChecking, setIsPromoChecking] = useState(false);

  const normalizePromoCode = (value: string) => value.trim().toUpperCase();

  const handleApplyPromo = async () => {
    const normalized = normalizePromoCode(promoCode);
    if (!normalized) {
      setPromoMessage({ tone: "error", text: "Введите промокод перед проверкой." });
      return;
    }

    setIsPromoChecking(true);
    try {
      const result = await validateFranchizePromoCode({ slug, code: normalized, baseAmount: subtotal });
      if (!result.success) {
        setPromoMessage({ tone: "error", text: result.error });
        return;
      }
      setPromoCode(result.code);
      setPromoMessage({ tone: "success", text: `${result.title}: скидка ${result.discountAmount.toLocaleString("ru-RU")} ₽` });
    } catch {
      setPromoMessage({ tone: "error", text: "Не удалось проверить промокод. Попробуйте ещё раз." });
    } finally {
      setIsPromoChecking(false);
    }
  };

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
    const normalizedPromo = normalizePromoCode(promoCode);
    const params = new URLSearchParams({ flow });
    if (normalizedPromo) params.set("promo", normalizedPromo);
    router.push(`/franchize/${slug}/order/demo-order?${params.toString()}`);
  };

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

      {cartLines.length === 0 && rawItemCount === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed p-6 text-sm" style={surface.subtleCard}>
          Корзина пока пустая. Добавьте байк из каталога, чтобы перейти к оформлению.
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
                        {line.item.rentPriceLabel}
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
            <div className="mt-4 rounded-xl border p-3" style={{ borderColor: "var(--cart-border)" }}>
              <p className="text-xs" style={surface.mutedText}>Промокод (проверим перед переходом к checkout)</p>
              <div className="mt-2 flex gap-2">
                <input
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value);
                    setPromoMessage(null);
                  }}
                  placeholder={crew.catalog.promoBanners.length > 0 ? crew.catalog.promoPlaceholder || "Введите промокод" : "Промокодов нет"}
                  className="h-10 w-full rounded-lg border px-3 text-sm"
                  style={{ borderColor: "var(--cart-border)", background: "transparent" }}
                />
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  disabled={!promoCode.trim() || isPromoChecking}
                  className="rounded-lg border px-3 text-xs font-medium disabled:opacity-60"
                  style={{ borderColor: "var(--cart-border)" }}
                >
                  {isPromoChecking ? "Проверка..." : "Применить"}
                </button>
              </div>
              {promoMessage ? <p className={`mt-2 text-xs ${promoMessage.tone === "error" ? "text-rose-300" : "text-emerald-300"}`}>{promoMessage.text}</p> : null}
            </div>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleProceed}
              className="mt-4 inline-flex w-full justify-center rounded-xl bg-[var(--cart-accent)] px-4 py-3 text-sm font-semibold text-[#16130A] transition hover:brightness-105 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cart-accent)] cursor-pointer disabled:opacity-70"
            >
              {isSaving ? "Сохранение..." : "Перейти к оформлению"}
            </button>
          </aside>
        </div>
      )}
    </section>
  );
}
