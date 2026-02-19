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
}

export function FloatingCartIconLink({
  href,
  itemCount,
  totalPrice,
  accentColor,
  textColor,
  borderColor,
}: FloatingCartIconLinkProps) {
  return (
    <div className="fixed bottom-6 right-4 z-30 flex items-center gap-2">
      <button
        type="button"
        aria-label="Scroll to top"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border"
        style={{ borderColor, color: textColor, backgroundColor: "#111217" }}
      >
        <ArrowUp className="h-4 w-4" />
      </button>

      <Link
        href={href}
        className="inline-flex items-center gap-2 rounded-full border px-3 py-2"
        style={{ borderColor: accentColor, backgroundColor: "#111217", color: textColor }}
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: accentColor, color: "#16130A" }}>
          <ShoppingCart className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium">{totalPrice.toLocaleString("ru-RU")} ₽</span>
        <span
          className="inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ backgroundColor: accentColor, color: "#16130A" }}
        >
          {itemCount}
        </span>
      </Link>
    </div>
  );
}
