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
} from "./cart";

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

  // Load rental secrets for returning users (WOW effect)
  useEffect(() => {
    const loadRentalSecrets = async () => {
      if (!dbUser?.user_id) return;
      const res = await getFranchizeUserRentalSecretsAction({ userId: dbUser.user_id, slug });
      if (!res.success || !res.data) return;

      // If user has previous rentals, show returning user indicators
      if (res.data.hasPreviousRentals) {
        setIsReturningUser(true);
        setUserName(res.data.savedData.fullName ?? null);
        setHasSavedDocs(true);
      }
    };
    void loadRentalSecrets();
  }, [dbUser?.user_id, slug]);

  // ── Flow detection for UI labels ──
  const saleLinesCount = cartLines.filter((line) => line.flowType === "sale").length;
  const isAllSale = saleLinesCount > 0 && saleLinesCount === cartLines.length;
  const isMixed = saleLinesCount > 0 && !isAllSale;

  // CART-TODO #1: Subtotal label adapts to cart composition.
  // For pure rental carts we use the actual rental period from the
  // first line ("3 часа", "1 день", etc.) so a 3-hour rental says
  // "Сумма за 3 часа аренды" instead of the misleading
  // "Сумма за 1 день аренды" that the old hardcoded label produced.
  const firstRentalLine = cartLines.find((line) => line.flowType === "rental");
  const rentalLabel = firstRentalLine?.rentalPeriod;
  const subtotalLabel = isAllSale
    ? "Сумма покупки"
    : isMixed
      ? "Итого (аренда + покупка)"
      : rentalLabel
        ? `Сумма ${rentalLabel} аренды`
        : "Сумма аренды";

  // CART-TODO #4: CTA text adapts to flow
  const ctaLabel = isAllSale
    ? "Перейти к оформлению покупки"
    : isMixed
      ? "Перейти к оформлению"
      : "Перейти к оформлению аренды";

  const handleProceed = async () => {
    setIsSaving(true);
    setLoadingMessage("Сохраняем корзину...");
    const flow = isAllSale ? "sale" : isMixed ? "mixed" : "rental";
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
      <nav aria-label="Breadcrumb" className="mb-2">
        <p
          className="text-xs uppercase tracking-[0.2em]"
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
              {/* Left: Cart item cards with stagger + delete animation */}
              <div className="space-y-3">
                {cartLines.map((line, index) => (
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
                  cartLines={cartLines}
                  subtotal={subtotal}
                  crew={crew}
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