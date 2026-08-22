"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { Zap, Menu, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  variant?: "full" | "compact";
}

export function Header({ variant = "full" }: HeaderProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  // Base path for menu links: works on /nnvolt, /nnvolt/zapros-smeti,
  // and on a dedicated domain where the page is served at root.
  const basePath = pathname === "/" ? "" : "/nnvolt";
  const isOnNnvoltPage = pathname === "/nnvolt" || pathname === "/";

  const links = [
    { label: "Услуги", href: `${basePath}#services` },
    { label: "Портфолио", href: `${basePath}#portfolio` },
    { label: "Бригада", href: `${basePath}#team` },
    { label: "Калькулятор", href: `${basePath}#calculator` },
    { label: "FAQ", href: `${basePath}#faq` },
    { label: "Контакты", href: `${basePath}#contacts` },
  ];

  const ctaHref = `${basePath}#contacts`;

  const scrollTo = (href: string) => (e: React.MouseEvent) => {
    // Same-page anchor: smooth scroll. Cross-page anchor: normal navigation.
    const hashIndex = href.indexOf("#");
    if (hashIndex === -1) return;

    const hash = href.slice(hashIndex + 1);
    const path = href.slice(0, hashIndex) || pathname;

    if (path === pathname || (isOnNnvoltPage && path === basePath)) {
      e.preventDefault();
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const headerBlur =
    scrolled || mobileOpen
      ? "bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/5 shadow-lg shadow-black/30"
      : "bg-transparent";

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${headerBlur}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Left: back or brand */}
          {variant === "compact" ? (
            <a
              href={basePath || "/nnvolt"}
              className="inline-flex items-center gap-2 text-white/50 hover:text-volt transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Назад</span>
            </a>
          ) : (
            <a href={basePath || "/nnvolt"} className="flex items-center gap-2.5 group">
              <div className="relative">
                <Zap className="w-8 h-8 text-volt group-hover:text-electric-blue transition-colors duration-300" />
                <div className="absolute inset-0 bg-volt/20 rounded-full blur-lg group-hover:bg-electric-blue/20 transition-colors duration-300" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg sm:text-xl font-black tracking-[0.15em] text-white leading-none">
                  NN VOLT
                </span>
                <span className="text-[9px] tracking-[0.25em] text-volt font-semibold leading-none mt-0.5">
                  ЭЛЕКТРОМОНТАЖ
                </span>
              </div>
            </a>
          )}

          {/* Desktop nav */}
          {variant === "full" ? (
            <nav className="hidden md:flex items-center gap-0.5">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={scrollTo(l.href)}
                  className="px-3.5 py-2 text-[13px] font-medium text-white/60 hover:text-volt transition-colors tracking-wide uppercase"
                >
                  {l.label}
                </a>
              ))}
              <a href={ctaHref} onClick={scrollTo(ctaHref)}>
                <Button className="ml-3 bg-volt text-charcoal font-bold hover:bg-volt-hover hover:text-charcoal tracking-wide uppercase text-xs px-5">
                  Вызвать электрика
                </Button>
              </a>
            </nav>
          ) : (
            <a href={basePath || "/nnvolt"} className="flex items-center gap-2 group">
              <Zap className="w-6 h-6 text-volt group-hover:text-electric-blue transition-colors" />
              <div className="flex flex-col">
                <span className="text-base font-black tracking-[0.15em] text-white leading-none">
                  NN VOLT
                </span>
                <span className="text-[9px] tracking-[0.25em] text-volt font-semibold leading-none mt-0.5">
                  ЭЛЕКТРОМОНТАЖ
                </span>
              </div>
            </a>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-white/60 hover:text-volt transition-colors"
            aria-label="Открыть меню"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#0a0a0a]/98 backdrop-blur-md border-t border-white/5"
          >
            <div className="px-4 py-4 space-y-1">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={(e) => {
                    setMobileOpen(false);
                    scrollTo(l.href)(e);
                  }}
                  className="block px-4 py-3 text-sm font-medium text-white/60 hover:text-volt hover:bg-white/5 rounded transition-colors tracking-wide uppercase"
                >
                  {l.label}
                </a>
              ))}
              <a
                href={ctaHref}
                onClick={(e) => {
                  setMobileOpen(false);
                  scrollTo(ctaHref)(e);
                }}
              >
                <Button className="w-full mt-2 bg-volt text-charcoal font-bold hover:bg-volt-hover hover:text-charcoal tracking-wide uppercase text-xs">
                  Вызвать электрика
                </Button>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
