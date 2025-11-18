"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Menu, X, User, Bell, Search, LogOut, Settings, ChevronDown, Zap, Terminal, Sparkles, Box } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";
import { motion, AnimatePresence } from "framer-motion";

interface NavLink {
  href: string;
  label: string;
  external?: boolean;
  icon?: React.ReactNode;
  badge?: string;
}

export function FixedHeader() {
  const { dbUser, isAdmin } = useAppContext();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const navLinks: NavLink[] = useMemo(
    () => [
      { href: "#features", label: "Фишки", icon: <Zap className="w-4 h-4" /> },
      { href: "#pricing", label: "Цены", icon: <Sparkles className="w-4 h-4" /> },
      { href: "#audit-tool", label: "Калькулятор", badge: "FREE" },
      { 
        href: "https://github.com/salavey13/carTest", 
        label: "Исходный код", 
        external: true,
      },
    ],
    []
  );

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <header
        ref={headerRef}
        className={`
          fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out
          ${isScrolled 
            ? "bg-black/80 backdrop-blur-xl border-b border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)]" 
            : "bg-transparent border-b border-transparent"
          }
        `}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo Section */}
            <motion.div 
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <Link href="/" className="group relative flex items-center gap-3">
                <div className="relative">
                   <div className="absolute inset-0 bg-indigo-500 blur-md opacity-50 group-hover:opacity-100 transition-opacity"/>
                  <Image 
                    src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250623_004400_844-152720e6-ad84-48d1-b4e7-e0f238b7442b.png"
                    alt="Logo" 
                    width={32} 
                    height={32} 
                    className="rounded-full relative z-10"
                  />
                </div>
                <span className="font-mono font-bold text-lg text-white tracking-tighter">
                  WAREHOUSE<span className="text-indigo-500">BOT</span>
                </span>
              </Link>
            </motion.div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  className="relative group flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
                >
                  {link.icon}
                  <span>{link.label}</span>
                  {link.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-500 text-white">
                      {link.badge}
                    </span>
                  )}
                </Link>
              ))}
            </nav>

            {/* Right Section */}
            <div className="flex items-center gap-4">
              {dbUser ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-white/10 hover:border-indigo-500/50 transition-colors"
                  >
                    <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-xs text-white font-bold">
                        {dbUser.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className="hidden sm:inline text-sm font-medium text-gray-200">
                      {dbUser.username}
                    </span>
                  </button>

                  <AnimatePresence>
                    {isUserMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-56 rounded-xl bg-zinc-950 border border-white/10 shadow-2xl overflow-hidden z-50"
                      >
                        <div className="p-3 border-b border-white/10">
                           <p className="text-xs text-gray-500 uppercase tracking-wider">Вы вошли как</p>
                           <p className="text-sm text-white font-mono truncate">{dbUser.username || 'User'}</p>
                        </div>
                        <div className="p-1">
                           <Link href="/settings" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg">
                              <Settings className="w-4 h-4"/> Настройки
                           </Link>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link href="/wb">
                    <Button className="bg-white text-black hover:bg-gray-200 font-bold rounded-full px-6">
                    Войти
                    </Button>
                </Link>
              )}

              {/* Mobile Menu Button */}
              <button
                className="md:hidden p-2 text-gray-300"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-black pt-24 px-4 md:hidden"
          >
             <div className="flex flex-col gap-4">
                {navLinks.map(link => (
                   <Link 
                     key={link.href} 
                     href={link.href} 
                     onClick={() => setIsMenuOpen(false)}
                     className="text-2xl font-black text-white py-4 border-b border-white/10"
                   >
                      {link.label}
                   </Link>
                ))}
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}