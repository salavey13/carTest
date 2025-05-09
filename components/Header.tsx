"use client";

import Link from "next/link";
import { LayoutGrid, X, Search, Globe } from "lucide-react"; // Added Globe for lang toggle
import React, { useState, useEffect, useMemo, useCallback } from "react";
import UserInfo from "@/components/user-info";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import {
  FaDumbbell, FaCircleUser, FaWandMagicSparkles, FaRocket, FaRoad, FaBookOpen,
  FaBrain, FaRobot, FaMagnifyingGlass, FaGift, FaUserShield, FaCarOn,
  FaYoutube, FaFileInvoiceDollar, FaCreditCard, FaHeart, FaPalette,
  FaCircleInfo, FaListCheck, FaNetworkWired, FaRegLightbulb, FaUpload,
  FaUserNinja, FaLandmarkDome, FaLeaf, FaFire // FaFire for Hot
} from "react-icons/fa6";
import { debugLogger as logger } from "@/lib/debugLogger";

interface PageInfo {
  path: string;
  name: string;
  icon?: React.ComponentType<{ className?: string }>;
  isImportant?: boolean;
  isAdminOnly?: boolean;
  isHot?: boolean;
  color?: 'purple' | 'blue' | 'yellow' | 'lime' | 'green' | 'pink' | 'cyan' | 'red' | 'orange';
}

const allPages: PageInfo[] = [
  { path: "/", name: "Fix13min", icon: FaDumbbell, isImportant: true, color: "cyan" },
  { path: "/cartest", name: "Cyber Garage", icon: FaCarOn, isImportant: true, color: "blue" },
  { path: "/about", name: "About Me", icon: FaCircleUser, isImportant: true, color: "pink" },
  { path: "/repo-xml", name: "SUPERVIBE Studio", icon: FaWandMagicSparkles, isImportant: true, color: "purple", isHot: true },
  { path: "/jumpstart", name: "Jumpstart Kit", icon: FaRocket, isImportant: true, color: "lime" },
  { path: "/selfdev", name: "SelfDev Path", icon: FaRoad, isImportant: true, color: "green" },
  { path: "/p-plan", name: "VIBE Plan", icon: FaUserNinja, isImportant: true, isHot: true, color: "yellow" },
  { path: "/ai-work-future", name: "AI & Future of Work", icon: FaNetworkWired, color: "cyan", isImportant: true },
  { path: "/advice", name: "Advice", icon: FaRegLightbulb, isImportant: true, color: "orange" },
  { path: "/vpr-tests", name: "VPR Tests", icon: FaListCheck, isImportant: true, color: 'pink' },
  
  { path: "/purpose-profit", name: "Purpose & Profit", icon: FaBookOpen, color: "purple" },
  { path: "/expmind", name: "Experimental Mindset", icon: FaBrain, color: "pink" },
  { path: "/botbusters", name: "Bot Busters", icon: FaRobot, color: "blue"},
  { path: "/bullshitdetector", name: "BS Detector", icon: FaMagnifyingGlass, color: "yellow" },
  { path: "/wheel-of-fortune", name: "Wheel of Fortune", icon: FaGift, color: "lime" },
  { path: "/invoices", name: "My Invoices", icon: FaFileInvoiceDollar, color: "green" },
  { path: "/buy-subscription", name: "Subscribe", icon: FaCreditCard, color: "pink" },
  { path: "/donate", name: "Donate", icon: FaHeart, color: "red" },
  { path: "/style-guide", name: "Style Guide", icon: FaPalette, color: "cyan" },
  { path: "/onesitepls", name: "oneSitePls Info", icon: FaCircleInfo, color: "purple" },
  { path: "/onesiteplsinstructions", name: "oneSitePls How-To", icon: FaListCheck, color: "blue" },
  { path: "/rent-car", name: "Rent a Car", icon: FaCarOn, color: "yellow" },

  { path: "/vpr/geography/6/cheatsheet", name: "Geo Cheatsheet 6", icon: Globe, color: 'green' }, // Globe from lucide
  { path: "/vpr/history/6/cheatsheet", name: "History Cheatsheet 6", icon: FaLandmarkDome, color: 'yellow' },
  { path: "/vpr/biology/6/cheatsheet", name: "Biology Cheatsheet 6", icon: FaLeaf, color: 'lime' },
  
  { path: "/advice-upload", name: "Upload Advice", icon: FaUpload, isAdminOnly: true, isImportant: true, color: "red" },
  { path: "/admin", name: "Admin Panel", icon: FaUserShield, isAdminOnly: true, color: "red" },
  { path: "/shadow-fleet-admin", name: "Fleet Admin", icon: FaCarOn, isAdminOnly: true, color: "red" },
  { path: "/youtubeAdmin", name: "YT Admin", icon: FaYoutube, isAdminOnly: true, color: "red" },
];

const translations: Record<string, Record<string, string>> = {
  en: {
    "Fix13min": "Fix13min", // Added this key
    "Cyber Garage": "Cyber Garage", "About Me": "About Me", "SUPERVIBE Studio": "SUPERVIBE Studio", "Jumpstart Kit": "Jumpstart Kit", "SelfDev Path": "SelfDev Path", "VIBE Plan": "VIBE Plan", "Advice": "Advice", "AI & Future of Work": "AI & Future of Work", "VPR Tests": "VPR Tests", "Purpose & Profit": "Purpose & Profit", "Experimental Mindset": "Experimental Mindset", "Bot Busters": "Bot Busters", "BS Detector": "BS Detector", "Wheel of Fortune": "Wheel of Fortune", "My Invoices": "My Invoices", "Subscribe": "Subscribe", "Donate": "Donate", "Style Guide": "Style Guide", "oneSitePls Info": "oneSitePls Info", "oneSitePls How-To": "oneSitePls How-To", "Rent a Car": "Rent a Car", "Geo Cheatsheet 6": "Geo Cheatsheet 6", "History Cheatsheet 6": "History Cheatsheet 6", "Biology Cheatsheet 6": "Biology Cheatsheet 6", "Upload Advice": "Upload Advice", "Admin Panel": "Admin Panel", "Fleet Admin": "Fleet Admin", "YT Admin": "YT Admin", "Search pages...": "Search pages...", "No pages found matching": "No pages found matching", "Admin Only": "Admin Only", "Toggle Language": "Toggle Language", "Open navigation": "Open navigation", "Close navigation": "Close navigation", "Hot": "Hot",
  },
  ru: {
    "Fix13min": "Fix13min", // Added this key
    "Cyber Garage": "Кибер Гараж", "About Me": "Обо мне", "SUPERVIBE Studio": "SUPERVIBE Studio", "Jumpstart Kit": "Набор Jumpstart", "SelfDev Path": "Путь Саморазвития", "VIBE Plan": "VIBE План", "Advice": "Советы", "AI & Future of Work": "ИИ и Будущее Работы", "VPR Tests": "ВПР Тесты", "Purpose & Profit": "Цель и Прибыль", "Experimental Mindset": "Эксперим. Мышление", "Bot Busters": "Охотники за Ботами", "BS Detector": "Детектор Чуши", "Wheel of Fortune": "Колесо Фортуны", "My Invoices": "Мои Счета", "Subscribe": "Подписаться", "Donate": "Поддержать", "Style Guide": "Гайд по Стилю", "oneSitePls Info": "Инфо oneSitePls", "oneSitePls How-To": "Как юзать oneSitePls", "Rent a Car": "Аренда Авто", "Geo Cheatsheet 6": "Шпаргалка Гео 6", "History Cheatsheet 6": "Шпаргалка Ист 6", "Biology Cheatsheet 6": "Шпаргалка Био 6", "Upload Advice": "Загрузить Совет", "Admin Panel": "Админ Панель", "Fleet Admin": "Админ Автопарка", "YT Admin": "Админ YT", "Search pages...": "Поиск страниц...", "No pages found matching": "Страницы не найдены по запросу", "Admin Only": "Только для админа", "Toggle Language": "Переключить язык", "Open navigation": "Открыть навигацию", "Close navigation": "Закрыть навигацию", "Hot": "Горячо",
  }
};

export default function Header() {
  const { isAdmin, user } = useAppContext();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const pathname = usePathname();
  logger.log(`[Header] Render start. Path: ${pathname}, NavOpen: ${isNavOpen}`);

  const initialLang = useMemo(() => (user?.language_code === 'ru' ? 'ru' : 'en'), [user?.language_code]);
  const [currentLang, setCurrentLang] = useState<'en' | 'ru'>(initialLang);
  
  useEffect(() => {
    const newLangBasedOnUser = user?.language_code === 'ru' ? 'ru' : 'en';
    if (newLangBasedOnUser !== currentLang) {
       logger.log(`[Header Effect Lang] Updating language based on user: ${newLangBasedOnUser}`);
       setCurrentLang(newLangBasedOnUser);
    }
  }, [user?.language_code, currentLang]);

  const t = useCallback((key: string): string => translations[currentLang]?.[key] || translations['en']?.[key] || key, [currentLang]);
  const toggleLang = useCallback(() => setCurrentLang(prevLang => prevLang === 'en' ? 'ru' : 'en'), []);

  const currentLogoText = useMemo(() => {
    const currentPage = allPages.find(p => p.path === pathname);
    if (pathname?.startsWith('/vpr')) return "VPR";
    const baseName = currentPage?.name || "Fix13min"; // Default to Fix13min
    const translatedFirstName = t(baseName)?.split(' ')[0];
    return translatedFirstName || baseName.split(' ')[0] || "VIBE";
  }, [pathname, t]);

  const filteredPages = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return allPages
      .filter(page => !(page.isAdminOnly && !isAdmin))
      .map(page => ({ ...page, translatedName: t(page.name) }))
      .filter(page => page.translatedName.toLowerCase().includes(lowerSearchTerm));
  }, [searchTerm, isAdmin, t]);

  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    if (isNavOpen) {
      if (!isHeaderVisible) setIsHeaderVisible(true);
      setLastScrollY(currentScrollY);
      return;
    }
    if (currentScrollY > lastScrollY && currentScrollY > 60) { // Slightly larger threshold
      if (isHeaderVisible) setIsHeaderVisible(false);
    } else if (currentScrollY < lastScrollY || currentScrollY <= 60) {
      if (!isHeaderVisible) setIsHeaderVisible(true);
    }
    setLastScrollY(currentScrollY);
  }, [lastScrollY, isNavOpen, isHeaderVisible]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (isNavOpen) {
      logger.log(`[Header Effect Path] Path changed to ${pathname}, closing nav.`);
      setIsNavOpen(false);
      setSearchTerm("");
    }
  }, [pathname, isNavOpen]); // isNavOpen added to dependency array

  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    if (isNavOpen) {
      logger.log("[Header Effect Nav Overflow] Nav open, hiding body overflow.");
      document.body.style.overflow = 'hidden';
    } else {
      if (document.body.style.overflow === 'hidden') {
         logger.log("[Header Effect Nav Overflow] Nav closed, restoring body overflow.");
         document.body.style.overflow = originalStyle;
      }
    }
    return () => {
      if (document.body.style.overflow === 'hidden') {
        logger.log("[Header Effect Nav Overflow Cleanup] Restoring body overflow on unmount/close.");
        document.body.style.overflow = originalStyle;
      }
    };
  }, [isNavOpen]);

  const tileColorClasses: Record<Required<PageInfo>['color'] | 'default', string> = {
    purple: "border-brand-purple/60 hover:border-brand-purple hover:shadow-[0_0_18px_theme(colors.brand-purple/60%)] text-brand-purple",
    blue: "border-brand-blue/60 hover:border-brand-blue hover:shadow-[0_0_18px_theme(colors.brand-blue/60%)] text-brand-blue",
    yellow: "border-brand-yellow/60 hover:border-brand-yellow hover:shadow-[0_0_18px_theme(colors.brand-yellow/60%)] text-brand-yellow",
    lime: "border-neon-lime/60 hover:border-neon-lime hover:shadow-[0_0_18px_theme(colors.neon-lime/60%)] text-neon-lime",
    green: "border-brand-green/60 hover:border-brand-green hover:shadow-[0_0_18px_theme(colors.brand-green/60%)] text-brand-green",
    pink: "border-brand-pink/60 hover:border-brand-pink hover:shadow-[0_0_18px_theme(colors.brand-pink/60%)] text-brand-pink",
    cyan: "border-brand-cyan/60 hover:border-brand-cyan hover:shadow-[0_0_18px_theme(colors.brand-cyan/60%)] text-brand-cyan",
    red: "border-red-500/60 hover:border-red-500 hover:shadow-[0_0_18px_theme(colors.red.500/60%)] text-red-500",
    orange: "border-brand-orange/60 hover:border-brand-orange hover:shadow-[0_0_18px_theme(colors.brand-orange/60%)] text-brand-orange",
    default: "border-gray-700 hover:border-brand-green/80 text-gray-400 hover:text-brand-green"
  };

  return (
    <>
      <motion.header
        className={cn(
            "fixed top-0 left-0 right-0 z-40 bg-black/80 border-b border-brand-purple/40 shadow-lg backdrop-blur-lg",
            "transition-transform duration-300 ease-in-out" // Ensure transform transition is applied
        )}
        initial={{ y: 0 }}
        animate={{ y: isHeaderVisible ? 0 : "-100%" }}
        transition={{ type: "tween", duration: 0.3 }}
      >
        <div className="container mx-auto px-4 py-2.5 sm:py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl md:text-3xl font-orbitron font-bold text-brand-purple cyber-text glitch hover:text-glow transition-all duration-300 hover:brightness-125" data-text={currentLogoText}>
              {currentLogoText}
            </Link>

            <div className="flex items-center gap-2 md:gap-3">
              <button
                onClick={toggleLang}
                className="p-1.5 sm:p-2 text-xs font-semibold text-brand-cyan hover:text-brand-cyan/70 focus:outline-none focus:ring-1 focus:ring-brand-cyan focus:ring-offset-2 focus:ring-offset-black rounded-md transition-all duration-200 hover:bg-brand-cyan/10 flex items-center gap-1"
                aria-label={t("Toggle Language")} title={t("Toggle Language")}
              >
                <Globe className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">{currentLang === 'en' ? 'RU' : 'EN'}</span>
              </button>

              {!isNavOpen && (
                <button
                  onClick={() => setIsNavOpen(true)}
                  className="p-2 text-brand-green hover:text-brand-green/70 focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2 focus:ring-offset-black rounded-md transition-all duration-200 hover:bg-brand-green/10"
                  aria-label={t("Open navigation")} aria-expanded={isNavOpen}
                >
                  <LayoutGrid className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
              )}
              <UserInfo />
            </div>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {isNavOpen && (
          <motion.div
            key="nav-overlay"
            initial={{ opacity: 0, clipPath: 'circle(0% at calc(100% - 3rem) 3rem)' }}
            animate={{ opacity: 1, clipPath: 'circle(150% at calc(100% - 3rem) 3rem)' }}
            exit={{ opacity: 0, clipPath: 'circle(0% at calc(100% - 3rem) 3rem)' }}
            transition={{ type: "spring", stiffness: 300, damping: 35, duration: 0.5 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl overflow-y-auto pt-20 pb-10 px-4 md:pt-24"
          >
            <button
              onClick={() => setIsNavOpen(false)}
              className="fixed top-5 right-5 z-[51] p-2 text-brand-pink hover:text-brand-pink/80 focus:outline-none focus:ring-2 focus:ring-brand-pink focus:ring-offset-2 focus:ring-offset-black rounded-full transition-all duration-200 hover:bg-brand-pink/10"
              aria-label={t("Close navigation")}
            >
              <X className="h-6 w-6 sm:h-7 sm:w-7" />
            </button>

            <div className="container mx-auto max-w-3xl xl:max-w-4xl">
              <div className="relative mb-6 md:mb-8">
                <input
                  type="search" placeholder={t("Search pages...")} value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-dark-card/80 border-2 border-brand-cyan/50 rounded-lg text-light-text placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-cyan focus:border-transparent text-base font-mono shadow-lg"
                  aria-label={t("Search pages...")}
                />
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-brand-cyan/70 pointer-events-none" />
              </div>

              {filteredPages.length > 0 ? (
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
                  {filteredPages.map((page) => {
                    const PageIcon = page.icon;
                    const isCurrentPage = page.path === pathname;
                    const tileColorClass = tileColorClasses[page.color || 'default'];

                    return (
                      <Link
                        key={page.path} href={page.path}
                        onClick={() => setIsNavOpen(false)}
                        className={cn(
                          "group relative flex flex-col items-center justify-center rounded-lg border-2 transition-all duration-300 aspect-square text-center hover:scale-[1.04] hover:-translate-y-0.5",
                          "p-2 sm:p-3",
                          page.isImportant 
                            ? "bg-gradient-to-br from-purple-800/40 via-black/60 to-blue-800/40 col-span-full xs:col-span-1 sm:col-span-2 shadow-lg" 
                            : "bg-dark-card/70 hover:bg-dark-card/90 col-span-1",
                          tileColorClass,
                          isCurrentPage ? `ring-2 ring-offset-2 ring-offset-black ${page.color === 'lime' || page.color === 'yellow' ? 'ring-black/70' : 'ring-white/90'}` : 'ring-transparent'
                        )}
                        title={page.translatedName}
                      >
                        {page.isHot && (
                          <span title={t("Hot")} className="absolute top-1 right-1 text-xs text-red-400 animate-pulse" aria-label={t("Hot")}>
                            <FaFire/>
                          </span>
                        )}
                        {PageIcon && (
                          <PageIcon className={cn(
                            "h-5 w-5 sm:h-6 sm:w-6 md:h-5 md:w-5 mb-1 transition-transform duration-300 group-hover:scale-110",
                            page.isImportant ? "text-inherit h-6 w-6 sm:h-7 sm:h-7 md:h-6 md:w-6" : "inherit"
                          )} />
                        )}
                        <span className={cn(
                          "font-orbitron font-medium transition-colors leading-tight",
                          "text-[0.65rem] sm:text-xs",
                          page.isImportant ? "text-light-text text-[0.7rem] sm:text-xs" : "text-gray-300 group-hover:text-inherit"
                        )}>
                          {page.translatedName}
                        </span>
                        {page.isAdminOnly && (
                          <span title={t("Admin Only")} className="absolute bottom-1 right-1 text-[0.5rem] text-red-400/80 bg-black/50 rounded-full px-1.5 py-0.5 leading-none">
                            ADMIN
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-gray-500 text-sm md:text-base mt-6 md:mt-8 font-mono">
                  {t("No pages found matching")} "{searchTerm}"
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}