"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Menu, X, User, Bell, Search, LogOut, Settings, ChevronDown, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const headerRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Enhanced nav links with icons and badges
  const navLinks: NavLink[] = useMemo(
    () => [
      { href: "#", label: "Главная", icon: <Sparkles className="w-4 h-4" /> },
      { href: "#features", label: "Возможности" },
      { href: "#pricing", label: "Тарифы" },
      { href: "#faq", label: "FAQ" },
      { href: "#testimonials", label: "Отзывы" },
      { href: "#audit-tool", label: "Аудит" },
      { href: "#invite", label: "Пригласить команду" },
      { 
        href: "https://github.com/salavey13/carTest", 
        label: "GitHub", 
        external: true,
        badge: "NEW"
      },
    ],
    []
  );

  // Scroll effect for header background
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  const isActiveLink = (href: string) => {
    if (href.startsWith("#")) {
      return false; // Handle hash links separately if needed
    }
    return pathname === href;
  };

  // Animation variants
  const menuVariants = {
    closed: { opacity: 0, y: -20 },
    open: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } },
  };

  const linkVariants = {
    initial: { opacity: 0, x: -20 },
    animate: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: { delay: i * 0.05, type: "spring", stiffness: 400, damping: 25 },
    }),
  };

  const userMenuVariants = {
    closed: { opacity: 0, y: -10, scale: 0.95 },
    open: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 400, damping: 25 } },
  };

  return (
    <>
      <header
        ref={headerRef}
        className={`
          fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out
          ${isScrolled 
            ? "bg-background/95 backdrop-blur-xl shadow-lg border-b border-border" 
            : "bg-background/80 backdrop-blur-md shadow-sm border-b border-border/50"
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
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <Link href="/" className="group relative flex items-center gap-3">
                <div className="relative">
                  <Image 
                    src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250623_004400_844-152720e6-ad84-48d1-b4e7-e0f238b7442b.png"
                    alt="Логотип" 
                    width={40} 
                    height={40} 
                    className="rounded-full transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"
                  />
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-brand-red-orange/20 to-brand-gold/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <span className="font-orbitron font-bold text-xl md:text-2xl bg-gradient-to-r from-brand-red-orange via-brand-gold to-brand-cyan bg-clip-text text-transparent hover:animate-gradient-text-flow">
                  WarehouseBot
                </span>
              </Link>
            </motion.div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-2">
              <AnimatePresence>
                {navLinks.map((link, i) => (
                  <motion.div
                    key={link.href}
                    custom={i}
                    variants={linkVariants}
                    initial="initial"
                    animate="animate"
                    exit="initial"
                  >
                    <Link
                      href={link.href}
                      target={link.external ? "_blank" : undefined}
                      rel={link.external ? "noopener noreferrer" : undefined}
                      className={`
                        relative group flex items-center gap-2 px-3 py-2 rounded-lg
                        transition-all duration-300 ease-out
                        ${isActiveLink(link.href)
                          ? "text-primary font-semibold bg-primary/10"
                          : "text-foreground hover:text-primary"
                        }
                      `}
                    >
                      {link.icon}
                      <span>{link.label}</span>
                      {link.badge && (
                        <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-brand-red-orange text-white animate-pulse-slow">
                          {link.badge}
                        </span>
                      )}
                      
                      {/* Hover underline effect */}
                      <span className={`
                        absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5
                        bg-gradient-to-r from-brand-red-orange to-brand-gold
                        transition-all duration-300 group-hover:w-3/4
                        ${isActiveLink(link.href) ? "w-3/4" : ""}
                      `} />
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Search Toggle */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="ml-2 p-2 rounded-lg text-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <Search className="w-5 h-5" />
              </motion.button>
            </nav>

            {/* Right Section */}
            <div className="flex items-center gap-4">
              {/* Notifications */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative p-2 rounded-lg text-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                <AnimatePresence>
                  {dbUser && (
                    <motion.span
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute -top-1 -right-1 w-3 h-3 bg-brand-red-orange rounded-full animate-pulse"
                    />
                  )}
                </AnimatePresence>
              </motion.button>

              {/* User Menu or Login */}
              {dbUser ? (
                <div className="relative" ref={userMenuRef}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
                  >
                    <User className="w-5 h-5 text-primary" />
                    <span className="hidden sm:inline text-sm font-medium text-foreground">
                      {dbUser.username || 'Профиль'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-foreground transition-transform duration-300 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  </motion.button>

                  <AnimatePresence>
                    {isUserMenuOpen && (
                      <motion.div
                        variants={userMenuVariants}
                        initial="closed"
                        animate="open"
                        exit="closed"
                        className="absolute right-0 mt-2 w-64 rounded-xl bg-card border border-border shadow-xl overflow-hidden backdrop-blur-lg"
                      >
                        <div className="p-4 border-b border-border">
                          <p className="font-semibold text-foreground">{dbUser.username || 'Пользователь'}</p>
                          <p className="text-sm text-muted-foreground">{dbUser.email || 'email@example.com'}</p>
                          {isAdmin?.() && (
                            <span className="inline-block mt-2 px-2 py-1 text-xs rounded-full bg-brand-red-orange text-white">
                              Администратор
                            </span>
                          )}
                        </div>
                        
                        <div className="py-2">
                          <Link href="/profile" className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-primary/10 transition-colors">
                            <User className="w-4 h-4" />
                            Профиль
                          </Link>
                          <Link href="/settings" className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-primary/10 transition-colors">
                            <Settings className="w-4 h-4" />
                            Настройки
                          </Link>
                        </div>
                        
                        <div className="py-2 border-t border-border">
                          <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                            <LogOut className="w-4 h-4" />
                            Выйти
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button 
                    variant="glow" 
                    className="relative overflow-hidden group"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-brand-red-orange to-brand-gold transform -translate-x-full group-hover:translate-x-full transition-transform duration-500" />
                    <span className="relative">Войти</span>
                  </Button>
                </motion.div>
              )}

              {/* Mobile Menu Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="md:hidden p-2 rounded-lg text-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label="Toggle menu"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={isMenuOpen ? "close" : "menu"}
                    initial={{ rotate: -180, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 180, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                  </motion.div>
                </AnimatePresence>
              </motion.button>
            </div>
          </div>
        </div>

        {/* Search Bar (Collapsible) */}
        <AnimatePresence>
          {isSearchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="border-t border-border overflow-hidden"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск по WarehouseBot..."
                    className="w-full pl-10 pr-4 py-2 bg-input border border-input-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-all duration-200"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur-lg md:hidden"
              onClick={() => setIsMenuOpen(false)}
            />
            
            <motion.nav
              variants={menuVariants}
              initial="closed"
              animate="open"
              exit="closed"
              className="fixed top-16 left-0 right-0 z-50 md:hidden bg-card/95 backdrop-blur-xl border-b border-border shadow-2xl"
            >
              <div className="px-4 py-6 space-y-2">
                {navLinks.map((link, i) => (
                  <motion.div
                    key={`mobile-${link.href}`}
                    custom={i}
                    variants={linkVariants}
                    initial="initial"
                    animate="animate"
                    exit="initial"
                  >
                    <Link
                      href={link.href}
                      target={link.external ? "_blank" : undefined}
                      rel={link.external ? "noopener noreferrer" : undefined}
                      className={`
                        flex items-center justify-between w-full px-4 py-3 rounded-lg
                        transition-all duration-300
                        ${isActiveLink(link.href)
                          ? "text-primary font-semibold bg-primary/10"
                          : "text-foreground hover:text-primary hover:bg-primary/10"
                        }
                      `}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <div className="flex items-center gap-3">
                        {link.icon}
                        <span>{link.label}</span>
                      </div>
                      {link.badge && (
                        <span className="px-2 py-1 text-xs font-bold rounded-full bg-brand-red-orange text-white animate-pulse-slow">
                          {link.badge}
                        </span>
                      )}
                    </Link>
                  </motion.div>
                ))}
                
                {dbUser && (
                  <>
                    <div className="h-px bg-border my-2" />
                    <Link
                      href="/profile"
                      className="flex items-center gap-3 px-4 py-3 rounded-lg text-foreground hover:text-primary hover:bg-primary/10 transition-all duration-300"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <User className="w-5 h-5" />
                      <span>Профиль</span>
                    </Link>
                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-destructive hover:bg-destructive/10 transition-all duration-300">
                      <LogOut className="w-5 h-5" />
                      <span>Выйти</span>
                    </button>
                  </>
                )}
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      {/* Invisible spacer to prevent content overlap */}
      <div className="h-16" />
    </>
  );
}

export default FixedHeader;