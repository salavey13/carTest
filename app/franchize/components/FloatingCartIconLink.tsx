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
    <div className="fixed bottom-6 right-4 z-30 flex items-center gap-3">
      <button
        type="button"
        aria-label="Scroll to top"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="inline-flex h-12 w-12 items-center justify-center rounded-full shadow-lg"
        style={{ color: textColor, backgroundColor }}
      >
        <ArrowUp className="h-5 w-5" />
      </button>

      <Link href={href} className="relative inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 shadow-xl transition-transform active:scale-95" style={{ color: "#000000", backgroundColor: accentColor }}>
        <ShoppingCart className="h-5 w-5" />
        <span className="text-sm font-bold">{isCartEmpty ? "0 ₽" : `${totalPrice.toLocaleString("ru-RU")} ₽`}</span>
        <span
          className="absolute -right-1.5 -top-1.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold shadow-md"
          style={{ backgroundColor: "#FFFFFF", borderColor: borderColor, color: "#16130A" }}
        >
          {itemCount}
        </span>
      </Link>
    </div>
  );
}
