"use client";

import React from "react";
import Link from "next/link";
import { ShoppingCart, User } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";

const Header: React.FC = () => {
  const { dbUser, isInTelegramContext, isAuthenticated } = useAppContext();
  const cartCount = dbUser?.metadata?.cart?.length || 0;
  const userName = dbUser?.username || "Профиль";
  const showProfileLink = isAuthenticated || isInTelegramContext;

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Логотип */}
          <Link href="/bio30" className="flex items-center gap-2">
            <span className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-full shadow-md"></span>
            <span className="text-lg font-bold gradient-text hidden sm:block tracking-wide">
              BIO 3.0
            </span>
          </Link>

          {/* Навигация */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/bio30/categories"
              className="text-sm font-medium text-foreground/90 hover:text-primary transition-colors"
            >
              Продукты
            </Link>
            <Link
              href="/bio30/delivery"
              className="text-sm font-medium text-foreground/90 hover:text-primary transition-colors"
            >
              Доставка
            </Link>
            <Link
              href="/bio30/referal"
              className="text-sm font-medium text-foreground/90 hover:text-primary transition-colors"
            >
              Реферальная программа
            </Link>
          </nav>

          {/* Правый блок: корзина + профиль */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Корзина */}
            <Link
              href="/bio30/cart"
              className="relative p-2 rounded-full hover:bg-muted transition-colors"
            >
              <ShoppingCart className="w-5 h-5 text-foreground" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.2rem] h-[1.2rem] flex items-center justify-center shadow-md">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Профиль / Войти */}
            {showProfileLink ? (
              <Link
                href="/profile"
                className="flex items-center gap-2 p-2 rounded-full hover:bg-muted transition-colors"
              >
                <User className="w-5 h-5 text-foreground" />
                <span className="hidden sm:block text-sm font-medium">
                  {userName}
                </span>
              </Link>
            ) : (
              <Link
                href="/settings"
                className="flex items-center gap-2 p-2 rounded-full hover:bg-muted transition-colors"
              >
                <User className="w-5 h-5 text-foreground" />
                <span className="hidden sm:block text-sm font-medium">
                  Войти
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;