// /app/bio30/components/Header.tsx
"use client";

import React, { useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { ShoppingCart, User, Menu } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useBio30ThemeFix } from "../hooks/useBio30ThemeFix";

const Header: React.FC = () => {
  const { dbUser } = useAppContext();
  const cartCount = dbUser?.metadata?.cart?.length || 0;
  const [menuOpen, setMenuOpen] = useState(false);
  useBio30ThemeFix();

  return (
    <header className="fixed top-0 z-50 bg-background/95 backdrop-blur-md border-b">
      <div className="web row ctr gp gp--xs">
        <div className="row ctr gp gp--xl">
          <Link href="/bio30" className="ctr">
            <span className="logo"></span>
            <span className="title fw__md gradient mg mg__sm--lft slogan opc opc--75">МАГАЗИН БИОЛОГИЧЕСКИ АКТИВНЫХ ДОБАВОК</span>
          </Link>
          <div className="row ctr gp gp--lg">
            <Link href="/bio30/categories" className="link fs__md fw__md opc opc--50 anmt">
              Продукты
            </Link>
            <Link href="/bio30/delivery" className="link fs__md fw__md opc opc--50 anmt">
              Доставка
            </Link>
            <Link href="/bio30/referal" className="link fs__md fw__md opc opc--50 anmt">
              Реферальная программа
            </Link>
          </div>
        </div>
        <div className="ctr rgt">
          <div className="cart-container pd pd__sm--rgt">
            <Link href="/bio30/cart" className="link fs__md fw__md opc opc--50 anmt">
              Корзина
            </Link>
            {cartCount > 0 && (
              <span className="count--cart">{cartCount}</span>
            )}
          </div>
          <Link href="/profile" className="btn btn--blk btn__primary">
            <div className="row ctr gp gp--xs">
              <span className="profile"></span>
              <span className="title ft__sm fw__bd pd__xs--rgt">{dbUser ? dbUser.username || "Профиль" : "Войти"}</span>
            </div>
          </Link>
        </div>
      </div>
      <div className="mobile">
        <button className="menu-icon circle grey"></button>
        <Link href="/bio30" className="logo_mobile"></Link>
        <div className="cart-container">
          <Link href="/bio30/cart" className="btn btn--wht btn__secondary ctr">
            Корзина
          </Link>
          {cartCount > 0 && (
            <span className="count--cart">{cartCount}</span>
          )}
        </div>
      </div>
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="mobile-menu"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="mobile-menu-content">
              <div className="col col--header">
                <nav className="nav--mobile">
                  <ul>
                    <li><Link href="/bio30/categories" onClick={() => setMenuOpen(false)}>Продукты</Link></li>
                    <li><Link href="/bio30/delivery" onClick={() => setMenuOpen(false)}>Доставка</Link></li>
                    <li><Link href="/bio30/referal" onClick={() => setMenuOpen(false)}>Реферальная программа</Link></li>
                    <li><Link href="/bio30/cart" onClick={() => setMenuOpen(false)}>Корзина</Link></li>
                    <li><Link href="/profile" onClick={() => setMenuOpen(false)}>Профиль</Link></li>
                  </ul>
                </nav>
              </div>
              <div className="mobile-menu-footer">
                <a href="tel:88001000000" className="btn btn--blk btn__primary fill mg mg__lg--btm">
                  <span className="phone"></span>
                  <span>8 800 100 00 00</span>
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;