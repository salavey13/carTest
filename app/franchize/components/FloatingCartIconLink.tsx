"use client";

import Link from "next/link";
import { ArrowUp, ShoppingCart } from "lucide-react";

interface FloatingCartIconLinkProps {
  href: string;
  itemCount: number;
  totalPrice: number;
  accentColor: string;
  textColor: string;
  borderColor: string;
  backgroundColor: string;
}

export function FloatingCartIconLink({ href, itemCount, totalPrice, accentColor, textColor, borderColor, backgroundColor }: FloatingCartIconLinkProps) {
  const isCartEmpty = itemCount === 0;

  return (
    <div
      className="fixed bottom-6 right-4 z-[60] flex items-center gap-3"
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
        aria-label="Scroll to top"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--floating-cart-bg)] text-[var(--floating-cart-text)] shadow-lg transition active:scale-95 cursor-pointer"
      >
        <ArrowUp className="h-5 w-5" />
      </button>

      <Link 
        href={href}
        className="relative inline-flex items-center justify-center gap-2 rounded-full bg-[var(--floating-cart-accent)] px-5 py-3 text-black shadow-xl transition-transform active:scale-95 cursor-pointer"
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