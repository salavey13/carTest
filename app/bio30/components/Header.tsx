// /app/bio30/components/Header.tsx
"use client";

import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { ShoppingCart, User } from 'lucide-react';
import Link from 'next/link';

const Header: React.FC = () => {
  const { dbUser } = useAppContext();
  const cartCount = dbUser?.metadata?.cart?.length || 0;

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/bio30" className="flex items-center gap-2">
            <span className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-full"></span>
            <span className="text-lg font-bold gradient-text hidden sm:block">BIO 3.0</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/bio30/categories" className="text-sm font-medium hover:underline">
              Продукты
            </Link>
            <Link href="/bio30/delivery" className="text-sm font-medium hover:underline">
              Доставка
            </Link>
            <Link href="/bio30/referal" className="text-sm font-medium hover:underline">
              Реферальная программа
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/bio30/cart" className="relative p-2 rounded-full hover:bg-muted">
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.2rem] h-[1.2rem] flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
            <Link href="/profile" className="flex items-center gap-2 p-2 rounded-full hover:bg-muted">
              <User className="w-5 h-5" />
              <span className="hidden sm:block text-sm font-medium">
                {dbUser ? dbUser.username || 'Профиль' : 'Войти'}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;