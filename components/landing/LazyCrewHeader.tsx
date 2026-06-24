"use client";

import type { FranchizeCrewVM } from "@/app/franchize/actions";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, ShoppingCart, X } from "lucide-react";

// VIP-BIKE themed fallback colors (match hydration.sql)
const VIP_FALLBACK = {
  bgBase: "#0A0A0A",
  bgCard: "#1A1A1A",
  accentMain: "#FFD700",
  accentHover: "#FFC125",
  textPrimary: "#FFFAF0",
  textSecondary: "#D4AF37",
  borderSoft: "#2A2A2A",
};

// Simple functional fallback header with hamburger menu
function FallbackHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { label: "Каталог", href: "/franchize/vip-bike" },
    { label: "Тест-драйв", href: "/franchize/vip-bike#test-drive" },
    { label: "Электро", href: "/franchize/vip-bike/electro-enduro" },
    { label: "Аренда", href: "/franchize/vip-bike#rentals" },
    { label: "Конфигуратор", href: "/franchize/vip-bike/configurator" },
    { label: "Контакты", href: "/franchize/vip-bike/contacts" },
  ];

  return (
    <>
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-xl"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)",
          borderColor: VIP_FALLBACK.borderSoft,
          backgroundColor: VIP_FALLBACK.bgCard,
          color: VIP_FALLBACK.textPrimary,
        }}
      >
        <div className="mx-auto w-full max-w-7xl px-4">
          <div className="flex items-center justify-between gap-4 py-2">
            {/* Menu button */}
            <button
              onClick={() => setMenuOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl transition-colors"
              style={{ backgroundColor: VIP_FALLBACK.bgBase, color: VIP_FALLBACK.textPrimary }}
              aria-label="Открыть меню"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Logo */}
            <Link
              href="/"
              className="flex flex-col items-center text-center hover:opacity-90 transition-opacity"
              style={{ textDecoration: "none", color: VIP_FALLBACK.textPrimary }}
            >
              <div
                className="relative h-12 w-12 min-h-12 min-w-12 overflow-hidden rounded-full border shadow-lg flex items-center justify-center font-bold text-lg"
                style={{
                  borderColor: VIP_FALLBACK.accentMain,
                  backgroundColor: VIP_FALLBACK.bgBase,
                  color: VIP_FALLBACK.accentMain,
                }}
              >
                VIP
              </div>
            </Link>

            {/* Cart icon */}
            <Link
              href="/franchize/vip-bike/cart"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl transition-colors no-underline"
              style={{
                backgroundColor: VIP_FALLBACK.bgBase,
                color: VIP_FALLBACK.textPrimary,
                textDecoration: "none",
              }}
              aria-label="Корзина"
            >
              <ShoppingCart className="h-5 w-5" />
            </Link>
          </div>

          {/* Navigation rail - desktop */}
          <div className="-mx-4 mt-2 border-t px-4 pt-2 hidden md:block" style={{ borderColor: VIP_FALLBACK.borderSoft }}>
            <div className="mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto no-scrollbar pb-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="shrink-0 rounded-full px-4 py-2 text-xs font-medium tracking-wide transition-all no-underline"
                  style={{
                    backgroundColor: "transparent",
                    color: VIP_FALLBACK.textPrimary,
                    textDecoration: "none",
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 shadow-xl md:hidden" style={{ backgroundColor: VIP_FALLBACK.bgCard }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: VIP_FALLBACK.borderSoft }}>
              <span className="text-lg font-bold" style={{ color: VIP_FALLBACK.accentMain }}>VIP BIKE</span>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-2 rounded-lg transition-colors"
                style={{ color: VIP_FALLBACK.textPrimary }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="p-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors no-underline"
                  style={{
                    backgroundColor: "transparent",
                    color: VIP_FALLBACK.textPrimary,
                    textDecoration: "none",
                  }}
                >
                  <span className="font-medium">{link.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}
    </>
  );
}

// Lazy load the actual CrewHeader from franchize system
const CrewHeader = dynamic(() => import("@/app/franchize/components/CrewHeader").then(mod => mod.CrewHeader), {
  ssr: false,
});

interface LazyCrewHeaderProps {
  crew: FranchizeCrewVM;
}

export function LazyCrewHeader({ crew }: LazyCrewHeaderProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Preload CrewHeader component
    import("@/app/franchize/components/CrewHeader").then(() => {
      setIsLoaded(true);
    });
  }, []);

  // Show fallback immediately, swap when CrewHeader loads
  if (!isLoaded) {
    return <FallbackHeader />;
  }

  return <CrewHeader crew={crew} activePath="/" showRail={false} />;
}
