"use client";

import Link from "next/link";
import { ArrowUp, ShoppingCart } from "lucide-react";

interface FloatingCartIconLinkProps {
  mode?: "floating" | "inline-icon";
  href: string;
  itemCount: number;
  totalPrice: number;
  accentColor: string;
  textColor: string;
  borderColor: string;
  backgroundColor: string;
  className?: string;
}

export function FloatingCartIconLink({ href, itemCount, totalPrice, accentColor, textColor, borderColor, backgroundColor, className, mode = "floating" }: FloatingCartIconLinkProps) {
  const isCartEmpty = itemCount === 0;


  if (mode === "inline-icon") {
    return (
      <Link
        href={href}
        aria-label={`Открыть корзину: ${itemCount} позиций, ${isCartEmpty ? "0 ₽" : `${totalPrice.toLocaleString("ru-RU")} ₽`}`}
        className={className ?? "relative inline-flex h-10 w-10 items-center justify-center rounded-xl transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"}
        style={{
          backgroundColor,
          color: textColor,
          border: `1px solid ${borderColor}`,
        }}
      >
        <ShoppingCart className="h-4 w-4" />
        <span
          className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border bg-white px-1 text-[10px] font-bold text-[#16130A]"
          style={{ borderColor }}
        >
          {itemCount}
        </span>
      </Link>
    );
  }

  return (
    <div
      className={className ?? "fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-[60] flex items-center gap-3"}
      style={{
        ["--floating-cart-accent" as string]: accentColor,
        ["--floating-cart-border" as string]: borderColor,
        ["--floating-cart-text" as string]: textColor,
        ["--floating-cart-bg" as string]: backgroundColor,
        pointerEvents: "auto",
        isolation: "isolate",
      }}
    >
      <button
        type="button"
        aria-label="Прокрутить страницу вверх"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--floating-cart-bg)] text-[var(--floating-cart-text)] shadow-lg transition active:scale-95 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--floating-cart-accent)]"
      >
        <ArrowUp className="h-5 w-5" />
      </button>

      {/* RESTORED TO SPA LINK */}
      <Link
        href={href}
        aria-label={`Открыть корзину: ${itemCount} позиций, ${isCartEmpty ? "0 ₽" : `${totalPrice.toLocaleString("ru-RU")} ₽`}`}
        className="relative inline-flex items-center justify-center gap-2 rounded-full bg-[var(--floating-cart-accent)] px-5 py-3 text-black shadow-xl transition-transform active:scale-95 cursor-pointer no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--floating-cart-accent)]"
      >
        <ShoppingCart className="h-5 w-5" />
        <span className="text-sm font-bold">{isCartEmpty ? "0 ₽" : `${totalPrice.toLocaleString("ru-RU")} ₽`}</span>
        <span
          className="absolute -right-1.5 -top-1.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-[var(--floating-cart-border)] bg-white px-1.5 text-xs font-bold text-[#16130A] shadow-md"
        >
          {itemCount}
        </span>
      </Link>
    </div>
  );
}