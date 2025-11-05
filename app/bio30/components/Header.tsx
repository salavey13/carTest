"use client";

import React, { useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { ShoppingCart, User, Menu } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
//import { useBio30ThemeFix } from "../hooks/useBio30ThemeFix";

const Header: React.FC = () => {
  const { dbUser } = useAppContext();
  const cartCount = dbUser?.metadata?.cart?.length || 0;
  const [menuOpen, setMenuOpen] = useState(false);
//  useBio30ThemeFix();

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side: burger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-md hover:bg-muted"
            aria-label="menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Center: logo */}
          <Link href="/bio30" className="flex items-center gap-2 mx-auto md:mx-0">
            <span className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-full"></span>
            <span className="text-lg font-bold gradient-text hidden sm:block">
              BIO 3.0
            </span>
          </Link>

          {/* Right side: cart + profile */}
          <div className="flex items-center gap-3">
            <Link href="/bio30/cart" className="relative p-2 rounded-full hover:bg-muted">
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.2rem] h-[1.2rem] flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
            <Link href="/profile" className="flex items-center gap-1 p-2 rounded-full hover:bg-muted">
              <User className="w-5 h-5" />
              <span className="hidden sm:block text-sm font-medium">
                {dbUser ? dbUser.username || "Профиль" : "Войти"}
              </span>
            </Link>
          </div>
        </div>

        {/* Mobile dropdown */}
        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center gap-4 py-4 md:hidden border-t"
            >
              <Link href="/bio30/categories" onClick={() => setMenuOpen(false)}>
                Продукты
              </Link>
              <Link href="/bio30/delivery" onClick={() => setMenuOpen(false)}>
                Доставка
              </Link>
              <Link href="/bio30/referal" onClick={() => setMenuOpen(false)}>
                Реферальная программа
              </Link>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};

export default Header;