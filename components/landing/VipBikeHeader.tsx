"use client";

import Link from "next/link";
import { Menu, ShoppingCart, X, Motorcycle, Phone, MapPin } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";

// VIP-BIKE themed colors (gold on black)
const VIP_THEME = {
  bgBase: "#0A0A0A",
  bgCard: "#1A1A1A",
  accentMain: "#FFD700",
  accentHover: "#FFC125",
  textPrimary: "#FFFAF0",
  textSecondary: "#D4AF37",
  borderSoft: "#2A2A2A",
};

const NAV_LINKS = [
  { label: "Каталог", href: "/franchize/vip-bike" },
  { label: "Тест-драйв", href: "/franchize/vip-bike#test-drive" },
  { label: "Электро", href: "/franchize/vip-bike/electro-enduro" },
  { label: "Аренда", href: "/franchize/vip-bike#rentals" },
  { label: "Конфигуратор", href: "/franchize/vip-bike/configurator" },
  { label: "Контакты", href: "/franchize/vip-bike/contacts" },
];

const CONTACT_INFO = {
  phone: "+7 9200-789-888",
  address: "пл. Комсомольская 2, Н. Новгород",
};

export function VipBikeHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const pathname = usePathname();

  // Scroll-based compact state
  useState(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;
      setIsCompact(scrollY > 50);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  });

  return (
    <>
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-xl"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)",
          borderColor: VIP_THEME.borderSoft,
          backgroundColor: VIP_THEME.bgCard,
          color: VIP_THEME.textPrimary,
        }}
      >
        <div className="mx-auto w-full max-w-7xl px-4">
          <div
            className="flex items-center justify-between gap-4 transition-all"
            style={{
              maxHeight: isCompact ? 0 : 80,
              opacity: isCompact ? 0 : 1,
              paddingBottom: isCompact ? 0 : "0.5rem",
              transform: isCompact ? "scaleY(0.85) translateY(-6px)" : "scaleY(1) translateY(0)",
              transformOrigin: "top center",
              transition: "transform 0.3s ease, opacity 0.3s ease, max-height 0.3s ease, padding 0.3s ease",
              pointerEvents: isCompact ? "none" : "auto",
            }}
          >
            {/* Menu button */}
            <button
              onClick={() => setMenuOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl transition-colors"
              style={{ backgroundColor: VIP_THEME.bgBase, color: VIP_THEME.textPrimary }}
              aria-label="Открыть меню"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Logo */}
            <Link
              href="/"
              className="flex flex-col items-center text-center hover:opacity-90 transition-opacity"
              style={{ textDecoration: "none", color: VIP_THEME.textPrimary }}
            >
              <div
                className="relative h-12 w-12 min-h-12 min-w-12 overflow-hidden rounded-full border shadow-lg flex items-center justify-center font-bold text-lg"
                style={{
                  borderColor: VIP_THEME.accentMain,
                  backgroundColor: VIP_THEME.bgBase,
                  color: VIP_THEME.accentMain,
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
                backgroundColor: VIP_THEME.bgBase,
                color: VIP_THEME.textPrimary,
                textDecoration: "none",
              }}
              aria-label="Корзина"
            >
              <ShoppingCart className="h-5 w-5" />
            </Link>
          </div>

          {/* Navigation rail - desktop */}
          <div className="-mx-4 mt-2 border-t px-4 pt-2 hidden md:block" style={{ borderColor: VIP_THEME.borderSoft }}>
            <div className="mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto no-scrollbar pb-1">
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="shrink-0 rounded-full px-4 py-2 text-xs font-medium tracking-wide transition-all no-underline"
                    style={{
                      backgroundColor: isActive ? VIP_THEME.accentMain : VIP_THEME.bgBase,
                      color: isActive ? "#000000" : VIP_THEME.textPrimary,
                      textDecoration: "none",
                    }}
                  >
                    {link.label}
                  </Link>
                );
              })}
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
          <div className="fixed inset-y-0 left-0 z-50 w-72 shadow-xl md:hidden" style={{ backgroundColor: VIP_THEME.bgCard }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: VIP_THEME.borderSoft }}>
              <span className="text-lg font-bold" style={{ color: VIP_THEME.accentMain }}>VIP BIKE</span>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-2 rounded-lg transition-colors"
                style={{ color: VIP_THEME.textPrimary }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="p-4 space-y-2">
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors no-underline"
                    style={{
                      backgroundColor: isActive ? VIP_THEME.accentMain + "20" : "transparent",
                      color: isActive ? VIP_THEME.accentMain : VIP_THEME.textPrimary,
                      textDecoration: "none",
                    }}
                  >
                    <Motorcycle className="h-5 w-5" style={{ color: isActive ? VIP_THEME.accentMain : VIP_THEME.textSecondary }} />
                    <span className="font-medium">{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Contact info */}
            <div className="p-4 border-t mt-4 space-y-3" style={{ borderColor: VIP_THEME.borderSoft }}>
              <a
                href={`tel:${CONTACT_INFO.phone.replace(/\s/g, "")}`}
                className="flex items-center gap-3 px-4 py-2 rounded-lg no-underline"
                style={{ color: VIP_THEME.textPrimary, textDecoration: "none" }}
              >
                <Phone className="h-4 w-4" style={{ color: VIP_THEME.accentMain }} />
                <span className="text-sm">{CONTACT_INFO.phone}</span>
              </a>
              <div className="flex items-center gap-3 px-4 py-2 rounded-lg" style={{ color: VIP_THEME.textSecondary }}>
                <MapPin className="h-4 w-4" style={{ color: VIP_THEME.accentMain }} />
                <span className="text-sm">{CONTACT_INFO.address}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
