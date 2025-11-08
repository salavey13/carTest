"use client";

import React, { useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useBio30ThemeFix } from "../hooks/useBio30ThemeFix";
import { cn } from "@/lib/utils";

const Header: React.FC = () => {
  const { dbUser } = useAppContext();
  const cartCount = dbUser?.metadata?.cart?.length || 0;
  const [menuOpen, setMenuOpen] = useState(false);
  useBio30ThemeFix();

  return (
    <>
      <header className="fixed top-0 right-0 left-0 z-50 bg-background/95 backdrop-blur-md border-b border-border h-16 md:h-20 px-4 md:px-8">
        {/* DESKTOP */}
        <div className="hidden md:flex items-center justify-between h-full">
          <div className="flex items-center gap-8">
            <Link href="/bio30" className="flex items-center gap-2">
              <span className="w-12 h-12 rounded-full bg-gradient-to-br from-[hsl(var(--brand-red-orange))] to-[hsl(var(--brand-gold))] flex items-center justify-center text-white font-bold text-xl">
                🧬
              </span>
              <span className="font-medium text-xs text-muted-foreground whitespace-nowrap">
                МАГАЗИН БИОЛОГИЧЕСКИ АКТИВНЫХ ДОБАВОК
              </span>
            </Link>
            <nav className="flex items-center gap-6">
              <Link href="/bio30/categories" className="text-foreground hover:text-primary transition-colors font-medium">
                Продукты
              </Link>
              <Link href="/bio30/delivery" className="text-foreground hover:text-primary transition-colors font-medium">
                Доставка
              </Link>
              <Link href="/bio30/referral" className="text-foreground hover:text-primary transition-colors font-medium">
                Реферальная программа
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Link href="/bio30/cart" className="text-foreground hover:text-primary transition-colors font-medium">
                Корзина
              </Link>
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {cartCount}
                </span>
              )}
            </div>
            <Link 
              href="/profile" 
              className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors font-medium"
            >
              <span>👤</span>
              <span>{dbUser ? dbUser.username || "Профиль" : "Войти"}</span>
            </Link>
          </div>
        </div>

        {/* MOBILE */}
        <div className="flex md:hidden items-center justify-between h-full">
          <button 
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground text-xl"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
          <Link href="/bio30" className="w-12 h-12 rounded-full bg-gradient-to-br from-[hsl(var(--brand-red-orange))] to-[hsl(var(--brand-gold))] flex items-center justify-center text-white font-bold text-xl">
            🧬
          </Link>
          <div className="relative">
            <Link href="/bio30/cart" className="bg-card text-foreground px-3 py-1.5 rounded-md border border-border font-medium">
              Корзина
            </Link>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {cartCount}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed top-16 left-0 right-0 bottom-0 bg-background/95 backdrop-blur-md z-40 md:hidden overflow-y-auto"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-6">
              <nav className="mb-6">
                <ul className="flex flex-col gap-2">
                  <li>
                    <Link 
                      href="/bio30/categories" 
                      onClick={() => setMenuOpen(false)} 
                      className="block p-3 text-foreground hover:bg-muted/50 rounded-md transition-colors font-medium"
                    >
                      Продукты
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/bio30/delivery" 
                      onClick={() => setMenuOpen(false)} 
                      className="block p-3 text-foreground hover:bg-muted/50 rounded-md transition-colors font-medium"
                    >
                      Доставка
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/bio30/referral" 
                      onClick={() => setMenuOpen(false)} 
                      className="block p-3 text-foreground hover:bg-muted/50 rounded-md transition-colors font-medium"
                    >
                      Реферальная программа
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/bio30/cart" 
                      onClick={() => setMenuOpen(false)} 
                      className="block p-3 text-foreground hover:bg-muted/50 rounded-md transition-colors font-medium"
                    >
                      Корзина
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/profile" 
                      onClick={() => setMenuOpen(false)} 
                      className="block p-3 text-foreground hover:bg-muted/50 rounded-md transition-colors font-medium"
                    >
                      Профиль
                    </Link>
                  </li>
                </ul>
              </nav>
              <div className="border-t border-border pt-6">
                <a href="tel:88001000000" className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors font-medium w-full justify-center">
                  <span>📞</span>
                  <span>8 800 100 00 00</span>
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;