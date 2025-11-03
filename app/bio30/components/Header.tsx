"use client";

import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import '../styles.css';

const Header: React.FC = () => {
  const { dbUser } = useAppContext();
  const cartCount = dbUser?.metadata?.cart?.length || 0;

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/bio30" className="flex items-center gap-2">
            <span className="logo w-8 h-8 bg-primary rounded-full"></span>
            <span className="text-lg font-bold gradient-text">BIO 3.0</span>
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
            <Link href="/bio30/cart" className="relative">
              <ShoppingCart className="w-6 h-6" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-white text-xs rounded-full px-2 py-1">
                  {cartCount}
                </span>
              )}
            </Link>
            <Link href="/profile" className="text-sm font-medium">
              {dbUser ? dbUser.username || 'Профиль' : 'Войти'}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;