"use client";

import Link from "next/link";
import { LayoutGrid, X, Search } from "lucide-react";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import UserInfo from "@/components/user-info";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
// Убедимся, что FaUserNinja импортирован
import {
  FaCar, FaCircleUser, FaWandMagicSparkles, FaRocket, FaRoad, FaBookOpen,
  FaBrain, FaRobot, FaMagnifyingGlass, FaGift, FaUserShield, FaCarOn,
  FaYoutube, FaFileInvoiceDollar, FaCreditCard, FaHeart, FaPalette,
  FaCircleInfo, FaListCheck, FaNetworkWired, FaRegLightbulb, FaUpload,
  FaUserNinja // <-- Добавлен импорт
} from "react-icons/fa6";

// --- Page Definitions ---
interface PageInfo {
  path: string;
  name: string; // English name acts as the key for translations
  icon?: React.ComponentType<{ className?: string }>;
  isImportant?: boolean;
  isAdminOnly?: boolean;
  isHot?: boolean; // <-- Флаг для новинок
  color?: 'purple' | 'blue' | 'yellow' | 'lime' | 'green' | 'pink' | 'cyan' | 'red';
}

// .. Добавляем VIBE Plan рядом с важными ссылками
const allPages: PageInfo[] = [
  { path: "/", name: "Cyber Garage", icon: FaCar, isImportant: true, color: "cyan" },
  { path: "/about", name: "About Me", icon: FaCircleUser, isImportant: true, color: "blue" },
  { path: "/repo-xml", name: "SUPERVIBE Studio", icon: FaWandMagicSparkles, isImportant: true, color: "yellow" },
  { path: "/jumpstart", name: "Jumpstart Kit", icon: FaRocket, isImportant: true, color: "lime" },
  { path: "/selfdev", name: "SelfDev Path", icon: FaRoad, isImportant: true, color: "green" },
  // --- Новая страница VIBE Plan ---
  { path: "/p-plan", name: "VIBE Plan", icon: FaUserNinja, isImportant: true, isHot: true, color: "yellow" },
  // --------------------------------
  { path: "/advice", name: "Advice", icon: FaRegLightbulb, isImportant: true, color: "purple" },
  { path: "/purpose-profit", name: "Purpose & Profit", icon: FaBookOpen, color: "purple" },
  { path: "/expmind", name: "Experimental Mindset", icon: FaBrain, color: "pink" },
  { path: "/ai-work-future", name: "AI & Future of Work", icon: FaNetworkWired, color: "cyan", isImportant: true },
  { path: "/botbusters", name: "Bot Busters", icon: FaRobot },
  { path: "/bullshitdetector", name: "BS Detector", icon: FaMagnifyingGlass },
  { path: "/wheel-of-fortune", name: "Wheel of Fortune", icon: FaGift },
  { path: "/advice-upload", name: "Upload Advice", icon: FaUpload, isAdminOnly: true, isImportant: true, color: "red" },
  { path: "/admin", name: "Admin Panel", icon: FaUserShield, isAdminOnly: true, color: "red" },
  { path: "/shadow-fleet-admin", name: "Fleet Admin", icon: FaCarOn, isAdminOnly: true, color: "red" },
  { path: "/youtubeAdmin", name: "YT Admin", icon: FaYoutube, isAdminOnly: true, color: "red" },
  { path: "/invoices", name: "My Invoices", icon: FaFileInvoiceDollar },
  { path: "/buy-subscription", name: "Subscribe", icon: FaCreditCard },
  { path: "/donate", name: "Donate", icon: FaHeart, color: "red" },
  { path: "/style-guide", name: "Style Guide", icon: FaPalette },
  { path: "/onesitepls", name: "oneSitePls Info", icon: FaCircleInfo },
  { path: "/onesiteplsinstructions", name: "oneSitePls How-To", icon: FaListCheck },
  { path: "/rent-car", name: "Rent a Car", icon: FaCar },
];

// --- Translations ---
const translations: Record<string, Record<string, string>> = {
  en: {
    "Cyber Garage": "Cyber Garage",
    "About Me": "About Me",
    "SUPERVIBE Studio": "SUPERVIBE Studio",
    "Jumpstart Kit": "Jumpstart Kit",
    "SelfDev Path": "SelfDev Path",
    "VIBE Plan": "VIBE Plan", // <-- Добавлен перевод EN
    "Advice": "Advice",
    "Purpose & Profit": "Purpose & Profit",
    "Experimental Mindset": "Experimental Mindset",
    "AI & Future of Work": "AI & Future of Work",
    "Bot Busters": "Bot Busters",
    "BS Detector": "BS Detector",
    "Wheel of Fortune": "Wheel of Fortune",
    "Upload Advice": "Upload Advice",
    "Admin Panel": "Admin Panel",
    "Fleet Admin": "Fleet Admin",
    "YT Admin": "YT Admin",
    "My Invoices": "My Invoices",
    "Subscribe": "Subscribe",
    "Donate": "Donate",
    "Style Guide": "Style Guide",
    "oneSitePls Info": "oneSitePls Info",
    "oneSitePls How-To": "oneSitePls How-To",
    "Rent a Car": "Rent a Car",
    "Search pages...": "Search pages...",
    "No pages found matching": "No pages found matching",
    "Admin Only": "Admin Only",
    "Toggle Language": "Toggle Language",
    "Open navigation": "Open navigation",
    "Close navigation": "Close navigation",
    "Hot": "Hot", // <-- Добавлен перевод для title/aria-label
  },
  ru: {
    "Cyber Garage": "Кибер Гараж",
    "About Me": "Обо мне",
    "SUPERVIBE Studio": "SUPERVIBE Studio",
    "Jumpstart Kit": "Набор Jumpstart",
    "SelfDev Path": "Путь Саморазвития",
    "VIBE Plan": "VIBE План", // <-- Добавлен перевод RU
    "Advice": "Советы",
    "Purpose & Profit": "Цель и Прибыль",
    "Experimental Mindset": "Эксперим. Мышление",
    "AI & Future of Work": "ИИ и Будущее Работы",
    "Bot Busters": "Охотники за Ботами",
    "BS Detector": "Детектор Чуши",
    "Wheel of Fortune": "Колесо Фортуны",
    "Upload Advice": "Загрузить Совет",
    "Admin Panel": "Админ Панель",
    "Fleet Admin": "Админ Автопарка",
    "YT Admin": "Админ YT",
    "My Invoices": "Мои Счета",
    "Subscribe": "Подписаться",
    "Donate": "Поддержать",
    "Style Guide": "Гайд по Стилю",
    "oneSitePls Info": "Инфо oneSitePls",
    "oneSitePls How-To": "Как юзать oneSitePls",
    "Rent a Car": "Аренда Авто",
    "Search pages...": "Поиск страниц...",
    "No pages found matching": "Страницы не найдены по запросу",
    "Admin Only": "Только для админа",
    "Toggle Language": "Переключить язык",
    "Open navigation": "Открыть навигацию",
    "Close navigation": "Закрыть навигацию",
    "Hot": "Новинка", // <-- Добавлен перевод для title/aria-label
  }
};


// --- Header Component ---
export default function Header() {
  const { isAdmin, user } = useAppContext();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const pathname = usePathname();

  const initialLang = useMemo(() => {
    const userLang = user?.language_code;
    return userLang === 'ru' ? 'ru' : 'en';
  }, [user?.language_code]);
  const [currentLang, setCurrentLang] = useState<'en' | 'ru'>(initialLang);

  useEffect(() => {
      const userLang = user?.language_code;
      const newLangBasedOnUser = userLang === 'ru' ? 'ru' : 'en';
      if (newLangBasedOnUser !== currentLang) {
           // console.log(`Header: User language changed to ${userLang}, updating state to ${newLangBasedOnUser}`); // Commented out for cleaner logs
           setCurrentLang(newLangBasedOnUser);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.language_code]);


  const t = useCallback((key: string): string => {
    return translations[currentLang]?.[key] || translations['en']?.[key] || key;
  }, [currentLang]);

  const toggleLang = useCallback(() => {
    setCurrentLang(prevLang => prevLang === 'en' ? 'ru' : 'en');
    // console.log(`Header: Language manually toggled to ${currentLang === 'en' ? 'ru' : 'en'}`); // Commented out for cleaner logs
  }, [currentLang]);

  const currentLogoText = useMemo(() => {
    const currentPage = allPages.find(p => p.path === pathname);
    const baseName = currentPage?.name || "VIBE";
    const translatedFirstName = t(baseName)?.split(' ')[0];
    return translatedFirstName || baseName.split(' ')[0] || "VIBE";
  }, [pathname, t]);

  const filteredPages = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return allPages
      .filter(page => !(page.isAdminOnly && !isAdmin)) // Filter admin pages if not admin
      .map(page => ({
        ...page,
        translatedName: t(page.name) // Translate name
      }))
      .filter(page => page.translatedName.toLowerCase().includes(lowerSearchTerm)); // Search in translated name
  }, [searchTerm, isAdmin, t]);

  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    if (isNavOpen) {
      setIsHeaderVisible(true);
      setLastScrollY(currentScrollY);
      return;
    }
    if (currentScrollY > lastScrollY && currentScrollY > 50) {
      setIsHeaderVisible(false);
    } else if (currentScrollY < lastScrollY) {
      setIsHeaderVisible(true);
    }
    setLastScrollY(currentScrollY);
  }, [lastScrollY, isNavOpen]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  useEffect(() => {
    setIsNavOpen(false);
    setSearchTerm("");
  }, [pathname]);

  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    if (isNavOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = originalStyle;
    }
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isNavOpen]);

  const tileColorClasses: Record<Required<PageInfo>['color'] | 'default', string> = {
    purple: "border-brand-purple/50 hover:border-brand-purple hover:shadow-[0_0_15px_rgba(157,0,255,0.5)] text-brand-purple",
    blue: "border-brand-blue/50 hover:border-brand-blue hover:shadow-[0_0_15px_rgba(0,194,255,0.5)] text-brand-blue",
    yellow: "border-brand-yellow/50 hover:border-brand-yellow hover:shadow-[0_0_15px_rgba(255,193,7,0.5)] text-brand-yellow",
    lime: "border-neon-lime/50 hover:border-neon-lime hover:shadow-[0_0_15px_rgba(174,255,0,0.5)] text-neon-lime",
    green: "border-brand-green/50 hover:border-brand-green hover:shadow-[0_0_15px_rgba(0,255,157,0.5)] text-brand-green",
    pink: "border-brand-pink/50 hover:border-brand-pink hover:shadow-[0_0_15px_rgba(255,0,122,0.5)] text-brand-pink",
    cyan: "border-brand-cyan/50 hover:border-brand-cyan hover:shadow-[0_0_15px_rgba(0,224,255,0.5)] text-brand-cyan",
    red: "border-red-500/50 hover:border-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] text-red-500",
    default: "border-gray-700/80 hover:border-brand-green/70 text-gray-400 hover:text-brand-green"
  };


  return (
    <>
      {/* Header Bar */}
      <motion.header
        className={`fixed top-0 left-0 right-0 z-40 bg-black/70 border-b border-brand-purple/30 shadow-lg backdrop-blur-md transition-transform duration-300 ease-in-out`}
        initial={{ y: 0 }}
        animate={{ y: isHeaderVisible ? 0 : "-100%" }}
        transition={{ type: "tween", duration: 0.3 }}
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl md:text-3xl font-bold text-brand-purple cyber-text glitch hover:text-glow" data-text={currentLogoText}>
              {currentLogoText}
            </Link>
            <div className="flex items-center gap-3 md:gap-4">
              {/* Language Toggle Button */}
              <button
                 onClick={toggleLang}
                 className="p-1 sm:p-2 text-xs sm:text-sm font-semibold text-brand-cyan hover:text-brand-cyan/80 transition-colors focus:outline-none focus:ring-1 focus:ring-brand-cyan focus:ring-offset-2 focus:ring-offset-black rounded-md"
                 aria-label={t("Toggle Language")}
                 title={t("Toggle Language")}
              >
                {currentLang === 'en' ? 'RU' : 'EN'}
              </button>

              {/* Navigation Toggle Button */}
              {!isNavOpen && (
                <button
                  onClick={() => setIsNavOpen(true)}
                  className="p-2 text-brand-green hover:text-brand-green/80 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2 focus:ring-offset-black rounded-md"
                  aria-label={t("Open navigation")}
                  aria-expanded={isNavOpen}
                >
                  <LayoutGrid className="h-6 w-6" />
                </button>
              )}
              {/* User Info */}
              <UserInfo />
            </div>
          </div>
        </div>
      </motion.header>

      {/* Navigation Overlay */}
      <AnimatePresence>
        {isNavOpen && (
          <motion.div
            key="nav-overlay"
            initial={{ opacity: 0, clipPath: 'circle(0% at calc(100% - 2rem) 2rem)' }}
            animate={{ opacity: 1, clipPath: 'circle(150% at calc(100% - 2rem) 2rem)' }}
            exit={{ opacity: 0, clipPath: 'circle(0% at calc(100% - 2rem) 2rem)' }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl overflow-y-auto pt-20 pb-10 px-4 md:pt-24"
          >
            {/* Close Button */}
            <button
              onClick={() => setIsNavOpen(false)}
              className="fixed top-4 right-4 z-60 p-2 text-brand-green hover:text-brand-green/80 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2 focus:ring-offset-black rounded-md"
              aria-label={t("Close navigation")}
            >
              <X className="h-6 w-6" />
            </button>

            <div className="container mx-auto max-w-3xl xl:max-w-4xl">
              {/* Search Input */}
              <div className="relative mb-6 md:mb-8">
                <input
                  type="search"
                  placeholder={t("Search pages...")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-800/60 border border-brand-green/40 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent text-sm md:text-base"
                  aria-label={t("Search pages...")}
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
              </div>

              {/* Page Tiles Grid */}
              {filteredPages.length > 0 ? (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5 sm:gap-2">
                  {filteredPages.map((page) => {
                    const PageIcon = page.icon;
                    const isCurrentPage = page.path === pathname;
                    const tileColorClass = tileColorClasses[page.color || 'default'];

                    return (
                      <Link
                        key={page.path}
                        href={page.path}
                        onClick={() => setIsNavOpen(false)}
                        className={cn(
                          "group relative flex flex-col items-center justify-center rounded-md border transition-all duration-300 aspect-square text-center hover:scale-[1.03]",
                          "p-1.5 sm:p-2 md:p-1.5",
                          page.isImportant ? "bg-gradient-to-br from-purple-900/30 via-black/50 to-blue-900/30 col-span-2" : "bg-gray-800/70 hover:bg-gray-700/90 col-span-1",
                          tileColorClass,
                          isCurrentPage ? 'ring-1 ring-offset-1 ring-offset-black ring-brand-green' : ''
                        )}
                      >
                        {/* --- Иконка Новинки (Hot) --- */}
                        {page.isHot && (
                          <span
                             title={t("Hot")} // Используем перевод для title
                             className="absolute top-0.5 left-0.5 text-[0.5rem] bg-red-500/80 text-white rounded-full px-1 py-0 leading-none animate-pulse"
                             aria-label={t("Hot")} // aria-label для доступности
                          >
                            🔥
                          </span>
                        )}
                        {/* ---------------------------- */}
                        {PageIcon && (
                            <PageIcon className={cn(
                                "h-4 w-4 sm:h-5 sm:w-5 md:h-4 md:w-4 mb-0.5 transition-transform duration-300 group-hover:scale-110",
                                page.isImportant ? "text-brand-yellow h-5 w-5 sm:h-6 sm:w-6 md:h-5 md:w-5" : "inherit"
                            )} />
                        )}
                        <span className={cn(
                            "font-semibold transition-colors leading-tight",
                            "text-[0.6rem] sm:text-xs md:text-[0.6rem] md:leading-none",
                            page.isImportant ? "text-white text-[0.7rem] sm:text-sm md:text-xs" : "text-gray-300 group-hover:text-white"
                        )}>
                          {page.translatedName}
                        </span>
                        {/* Иконка Админа (сдвинута немного правее, чтобы не перекрывать новинку) */}
                        {page.isAdminOnly && (
                           <span title={t("Admin Only")} className="absolute top-0.5 right-0.5 text-[0.5rem] text-red-400 bg-black/60 rounded-full px-1 py-0 leading-none">🛡️</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                 <p className="text-center text-gray-500 text-sm md:text-base mt-6 md:mt-8">
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