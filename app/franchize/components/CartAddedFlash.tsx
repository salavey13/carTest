"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ShoppingCart } from "lucide-react";
import { readableTextOnColor } from "../lib/theme";

export type CartAddedFlashData = { label: string; kind: "cart" | "testdrive"; at: number } | null;

interface CartAddedFlashProps {
  /** Current flash payload; null → nothing rendered. `at` re-keys the overlay so back-to-back adds retrigger the animation. */
  flash: CartAddedFlashData;
  /** Catalog-scoped cart link for the primary CTA. */
  cartHref: string;
  accentColor: string;
  textColor: string;
  borderColor: string;
  onClose: () => void;
}

const AUTO_DISMISS_MS = 2600;

/**
 * Fullscreen confirmation when something lands in the cart (2026-10-04, owner:
 * «когда что-то добавлено в корзину — оповещение на весь экран»). Covers the
 * viewport with a dimmed backdrop, auto-dismisses after ~2.6 s, closes on
 * backdrop tap / ESC, and offers a shortcut into the cart.
 */
export function CartAddedFlash({ flash, cartHref, accentColor, textColor, borderColor, onClose }: CartAddedFlashProps) {
  // Keep the latest onClose without re-arming the auto-dismiss timer.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => closeRef.current(), AUTO_DISMISS_MS);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [flash]);

  const onAccentText = readableTextOnColor(accentColor, ["#16130A", "#FFFFFF"]);

  return (
    <AnimatePresence>
      {flash && (
        <motion.div
          key={flash.at}
          className="fixed inset-0 z-[9999] flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="dialog"
          aria-modal="true"
          aria-live="assertive"
          aria-label={flash.kind === "testdrive" ? "Вы записаны на тест-драйв" : "Добавлено в корзину"}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <motion.div
            className="relative w-full max-w-sm rounded-3xl border p-6 text-center shadow-2xl"
            style={{ backgroundColor: "var(--franchize-bg-elevated, #16181d)", borderColor, color: textColor }}
            initial={{ scale: 0.88, opacity: 0, y: 14 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: accentColor }}
            >
              <Check className="h-8 w-8" strokeWidth={3} style={{ color: onAccentText }} aria-hidden />
            </div>
            <p className="mt-4 text-lg font-bold">
              {flash.kind === "testdrive" ? "Вы записаны на тест-драйв" : "Добавлено в корзину"}
            </p>
            <p className="mt-1 line-clamp-2 text-sm opacity-70">{flash.label}</p>
            <div className="mt-5 grid gap-2">
              <Link
                href={cartHref}
                onClick={onClose}
                className="flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ backgroundColor: accentColor, color: onAccentText, outlineColor: accentColor }}
              >
                <ShoppingCart className="h-4 w-4" aria-hidden />
                Перейти в корзину
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="flex min-h-11 items-center justify-center rounded-2xl border px-4 text-sm font-medium transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ borderColor, color: textColor, outlineColor: accentColor }}
              >
                Продолжить выбор
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
