"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CatalogItemVM, FranchizeCrewVM } from "../actions";
import { upsertFranchizeIntent } from "../actions";
import { useFranchizeCartLines } from "../hooks/useFranchizeCartLines";
import { useFranchizeCart } from "../hooks/useFranchizeCart";
import { useCrewTokens } from "../lib/use-crew-tokens";
import { saveUserFranchizeCartAction } from "@/contexts/actions";
import { useAppContext } from "@/contexts/AppContext";
import { getFranchizeUserRentalSecretsAction } from "../profile-actions";
import {
  CartItemCard,
  OrderSummary,
  CheckoutButton,
  EmptyCartState,
  CartShimmerStyle,
  PromoCodeInput,
} from "./cart";
import {
  clearCartAppliedPromo,
  computeCartPromoDiscount,
  loadCartAppliedPromo,
  saveCartAppliedPromo,
  type CartAppliedPromo,
} from "../lib/cart-promo";

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
  const T = useCrewTokens(crew.theme);
  const router = useRouter();
  const { dbUser, user } = useAppContext();
  const [isSaving, setIsSaving] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [hasSavedDocs, setHasSavedDocs] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  // ── Promo applied in the cart (boss request 2026-09-17) ──
  // Validated server-side by PromoCodeInput; persisted to sessionStorage so
  // the order page auto-applies the same code at checkout.
  const [appliedPromo, setAppliedPromo] = useState<CartAppliedPromo | null>(null);

  useEffect(() => {
    setAppliedPromo(loadCartAppliedPromo(typeof window === "undefined" ? null : window.sessionStorage, slug));
  }, [slug]);

  const handlePromoApplied = useCallback((promo: CartAppliedPromo) => {
    setAppliedPromo(promo);
    saveCartAppliedPromo(typeof window === "undefined" ? null : window.sessionStorage, promo);
  }, []);

  const handlePromoCleared = useCallback(() => {
    setAppliedPromo(null);
    clearCartAppliedPromo(typeof window === "undefined" ? null : window.sessionStorage);
  }, []);

  // Load rental secrets for returning users (WOW effect)
  useEffect(() => {
    const loadRentalSecrets = async () => {
      if (!dbUser?.user_id) return;
      const res = await getFranchizeUserRentalSecretsAction({ userId: dbUser.user_id, slug });
      if (!res.success || !res.data) return;

      // If user has previous rentals, show returning user indicators
      if (res.data.hasPreviousRentals) {
        setIsReturningUser(true);
        setUserName(res.data.savedData?.fullName ?? null);
        setHasSavedDocs(true);
      }
    };
    void loadRentalSecrets();
  }, [dbUser?.user_id, slug]);

  // ── Flow detection for UI labels ──
  const saleLinesCount = cartLines.filter((line) => line.flowType === "sale").length;
  const serviceLinesCount = cartLines.filter((line) => line.flowType === "service").length;
  const isAllSale = saleLinesCount > 0 && saleLinesCount === cartLines.length;
  const isAllService = serviceLinesCount > 0 && serviceLinesCount === cartLines.length;
  const isMixed = (saleLinesCount > 0 || serviceLinesCount > 0) && !isAllSale && !isAllService;

  // CART-TODO #1: Subtotal label adapts to cart composition.
  // For pure rental carts we use the actual rental period from the
  // first line ("3 часа", "1 день", etc.) so a 3-hour rental says
  // "Сумма за 3 часа аренды" instead of the misleading
  // "Сумма за 1 день аренды" that the old hardcoded label produced.
  const firstRentalLine = cartLines.find((line) => line.flowType === "rental");
  const rentalLabel = firstRentalLine?.rentalPeriod;
  const subtotalLabel = isAllSale
    ? "Сумма покупки"
    : isAllService
      ? "Сумма заказа"
      : isMixed
        ? "Итого"
        : rentalLabel
          ? `Сумма ${rentalLabel} аренды`
          : "Сумма аренды";

  // ── Promo math ──
  // computeCartPromoDiscount re-caps the server-validated amount against the
  // LIVE subtotal: 100% codes (PROMORIDE) keep covering the whole order even
  // after the rider adds another bike. When the promo covers everything, the
  // LINE PRICES THEMSELVES render as 0 ₽ — the boss asked for «цена на
  // выбранный товар меняется на 0» — while the real totals still feed the
  // checkout intent metadata so the CRM sees the honest pre-promo numbers.
  const promoDiscount = appliedPromo ? computeCartPromoDiscount(appliedPromo, subtotal) : 0;
  const promoCoversAll = subtotal > 0 && promoDiscount >= subtotal;
  const displayCartLines = useMemo(
    () =>
      promoCoversAll && appliedPromo
        ? cartLines.map((line) => ({
            ...line,
            lineTotal: 0,
            pricePerDay: 0,
            salePrice: line.flowType === "sale" ? 0 : line.salePrice,
            displayPriceLabel: `0 ₽ · промокод ${appliedPromo.code}`,
          }))
        : cartLines,
    [cartLines, promoCoversAll, appliedPromo],
  );

  // CART-TODO #4: CTA text adapts to flow
  const ctaLabel = isAllSale
    ? "Перейти к оформлению покупки"
    : isAllService
      ? "Перейти к оформлению заявки"
      : isMixed
        ? "Перейти к оформлению"
        : "Перейти к оформлению аренды";

  const handleProceed = async () => {
    setIsSaving(true);
    setLoadingMessage("Сохраняем корзину...");
    const flow = isAllSale ? "sale" : isAllService ? "service" : isMixed ? "mixed" : "rental";
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
        promoCode: appliedPromo?.code,
        promoDiscount,
        cartLines: cartLines.map((line) => ({
          itemId: line.item?.id ?? line.itemId,
          qty: line.qty,
          saleAvailable: line.saleAvailable,
          lineTotal: line.lineTotal,
          flowType: line.flowType,
        })),
      },
    }).catch((error) => console.warn("checkout intent tracking failed", error));
    // Sync to DB explicitly before navigating
    if (dbUser?.user_id) {
      await Promise.allSettled([saveUserFranchizeCartAction(dbUser.user_id, slug, cart), intentPromise]);
    } else {
      await intentPromise;
    }
    // Generate a real order ID instead of hardcoded "demo-order"
    const orderId = `order-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    setLoadingMessage("Переходим к оформлению...");
    router.push(`/franchize/${slug}/order/${orderId}?flow=${flow}`);
  };

  const handleDelete = useCallback(
    (lineId: string) => {
      setConfirmDeleteId(lineId);
    },
    [],
  );

  const confirmDelete = useCallback(() => {
    if (confirmDeleteId) {
      removeLine(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  }, [confirmDeleteId, removeLine]);

  const cancelDelete = useCallback(() => {
    setConfirmDeleteId(null);
  }, []);

  const handleEdit = useCallback(
    (lineId: string) => {
      const line = cartLines.find((l) => l.lineId === lineId);
      if (!line?.item) return;

      // Store edit context in sessionStorage for catalog page to pick up
      sessionStorage.setItem(
        "franchize-edit-cart-line",
        JSON.stringify({
          itemId: line.itemId,
          options: line.options,
        }),
      );

      // Remove the line (user will re-add with edited options)
      removeLine(lineId);

      // Navigate to catalog page
      router.push(`/franchize/${slug}`);
    },
    [cartLines, removeLine, router, slug],
  );

  const isEmpty = cartLines.length === 0 && rawItemCount === 0;

  return (
    <section
      className="mx-auto w-full max-w-5xl px-4 py-6"
      style={{
        ["--cart-accent" as string]: T.accent,
        ["--cart-border" as string]: T.borderSoft,
        ["--cart-glow" as string]: T.accentSoft,
      }}
    >
      <CartShimmerStyle />
      {/* Breadcrumb */}
      {/* break-all: long crew names/urls wrap instead of pushing the page wider */}
      <nav aria-label="Breadcrumb" className="mb-2">
        <p
          className="break-all text-xs uppercase tracking-[0.2em]"
          style={{ color: T.accent }}
        >
          / FRANCHIZE / {crew.header.brandName?.toUpperCase() ?? slug.toUpperCase()} / CART
        </p>
      </nav>

      {/* Returning User Welcome — theme-aware */}
      {isReturningUser && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-2xl border p-4"
          style={{
            borderColor: T.borderSoft,
            backgroundColor: T.accentSoft,
          }}
        >
          <p
            className="text-sm font-semibold"
            style={{ color: T.text }}
          >
            С возвращением{userName ? `, ${userName}` : ""}!
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {hasSavedDocs && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
                style={T.styles.accentPill}
              >
                <span style={{ color: T.accent }}>✓</span>
                Паспорт и права сохранены
              </span>
            )}
          </div>
        </motion.div>
      )}

      {/* Title Section */}
      <h1 className="mt-2 text-2xl font-semibold" style={{ color: T.text }}>Корзина</h1>
      <p className="mt-2 text-sm" style={{ color: T.textMuted }}>
        Проверьте состав заказа, количество и итог перед оформлением.
      </p>

      {isEmpty ? (
        <EmptyCartState
          crew={crew}
          slug={slug}
          onNavigateToCatalog={() => router.push(`/franchize/${slug}`)}
        />
      ) : (
        <AnimatePresence mode="popLayout">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_360px]">
              {/* Left: Cart item cards with stagger + delete animation.
                  With a 100% promo (e.g. PROMORIDE) the display lines carry
                  zeroed prices — «цена на выбранный товар = 0». */}
              <div className="space-y-3">
                {displayCartLines.map((line, index) => (
                  <motion.div
                    key={line.lineId}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{
                      delay: index * 0.08,
                      duration: 0.3,
                      layout: { duration: 0.2 },
                    }}
                  >
                    <CartItemCard
                      line={line}
                      crew={crew}
                      onDecreaseQty={(lineId) => changeLineQty(lineId, -1)}
                      onIncreaseQty={(lineId) => changeLineQty(lineId, 1)}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                    />
                  </motion.div>
                ))}
              </div>

              {/* Right: Summary sidebar */}
              <div className="space-y-3 lg:sticky lg:top-24 lg:h-fit">
                <OrderSummary
                  cartLines={displayCartLines}
                  subtotal={subtotal}
                  crew={crew}
                  promoCode={appliedPromo?.code}
                  promoDiscount={promoDiscount}
                />
                <PromoCodeInput
                  slug={slug}
                  crew={crew}
                  baseAmount={subtotal}
                  appliedPromo={appliedPromo}
                  onApply={handlePromoApplied}
                  onClear={handlePromoCleared}
                />
                <CheckoutButton
                  onClick={handleProceed}
                  isLoading={isSaving}
                  label={ctaLabel}
                  crew={crew}
                />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Confirmation dialog for item removal */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
        >
          <div className="mx-4 max-w-sm rounded-2xl border bg-[var(--cart-bg)] p-6 shadow-2xl" style={{ borderColor: T.borderSoft }}>
            <h3 id="confirm-delete-title" className="mb-2 text-lg font-semibold" style={{ color: T.text }}>
              Удалить из корзины?
            </h3>
            <p className="mb-4 text-sm" style={{ color: T.textMuted }}>
              Вы уверены, что хотите удалить этот байк из корзины?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={cancelDelete}
                autoFocus
                className="flex-1 rounded-xl border px-4 py-2 text-sm font-medium transition hover:opacity-80"
                style={{ borderColor: T.borderSoft, color: T.text }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay during checkout */}
      {isSaving && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Оформление заказа"
        >
          <div className="flex flex-col items-center gap-3 rounded-2xl border bg-[var(--cart-bg)] p-8 shadow-2xl" style={{ borderColor: T.borderSoft }}>
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--cart-accent)] border-t-transparent" />
            <p className="text-sm font-medium" style={{ color: T.text }}>{loadingMessage}</p>
          </div>
        </div>
      )}
    </section>
  );
}