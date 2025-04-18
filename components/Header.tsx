"use client";

import Link from "next/link";
import { LayoutGrid, X, Search } from "lucide-react";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import UserInfo from "@/components/user-info";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import {
  FaCar, FaCircleUser, FaWandMagicSparkles, FaRocket, FaRoad, FaBookOpen,
  FaBrain, FaRobot, FaMagnifyingGlass, FaGift, FaUserShield, FaCarOn,
  FaYoutube, FaFileInvoiceDollar, FaCreditCard, FaHeart, FaPalette,
  FaCircleInfo, FaListCheck, FaNetworkWired, FaRegLightbulb, FaUpload // Added FaRegLightbulb, FaUpload
} from "react-icons/fa6";

// --- Page Definitions ---
interface PageInfo {
  path: string;
  name: string; // English name acts as the key for translations
  icon?: React.ComponentType<{ className?: string }>;
  isImportant?: boolean;
  isAdminOnly?: boolean;
  color?: 'purple' | 'blue' | 'yellow' | 'lime' | 'green' | 'pink' | 'cyan' | 'red';
}

// .. Updated allPages array with English names as keys and new pages
const allPages: PageInfo[] = [
  { path: "/", name: "Cyber Garage", icon: FaCar, isImportant: true, color: "cyan" },
  { path: "/about", name: "About Me", icon: FaCircleUser, isImportant: true, color: "blue" },
  { path: "/repo-xml", name: "SUPERVIBE Studio", icon: FaWandMagicSparkles, isImportant: true, color: "yellow" },
  { path: "/jumpstart", name: "Jumpstart Kit", icon: FaRocket, isImportant: true, color: "lime" },
  { path: "/selfdev", name: "SelfDev Path", icon: FaRoad, isImportant: true, color: "green" },
  // .. Added new 'Advice' page link and marked as important:
  { path: "/advice", name: "Advice", icon: FaRegLightbulb, isImportant: true, color: "purple" },
  { path: "/purpose-profit", name: "Purpose & Profit", icon: FaBookOpen, color: "purple" },
  { path: "/expmind", name: "Experimental Mindset", icon: FaBrain, color: "pink" },
  { path: "/ai-work-future", name: "AI & Future of Work", icon: FaNetworkWired, color: "cyan", isImportant: true },
  { path: "/botbusters", name: "Bot Busters", icon: FaRobot },
  { path: "/bullshitdetector", name: "BS Detector", icon: FaMagnifyingGlass },
  { path: "/wheel-of-fortune", name: "Wheel of Fortune", icon: FaGift },
  // .. Added new 'Upload Advice' admin page link and marked as important:
  { path: "/admin/advice-upload", name: "Upload Advice", icon: FaUpload, isAdminOnly: true, isImportant: true, color: "red" },
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
  // { path: "/tasks", name: "Tasks", icon: FaListCheck },
];

// --- Translations ---
const translations: Record<string, Record<string, string>> = {
  en: {
    "Cyber Garage": "Cyber Garage",
    "About Me": "About Me",
    "SUPERVIBE Studio": "SUPERVIBE Studio",
    "Jumpstart Kit": "Jumpstart Kit",
    "SelfDev Path": "SelfDev Path",
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
  },
  ru: {
    "Cyber Garage": "Кибер Гараж",
    "About Me": "Обо мне",
    "SUPERVIBE Studio": "SUPERVIBE Studio",
    "Jumpstart Kit": "Набор Jumpstart",
    "SelfDev Path": "Путь Саморазвития",
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
  }
};


// --- Header Component ---
export default function Header() {
  const { isAdmin, user } = useAppContext(); // Get user from context
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const pathname = usePathname();

  // .. Determine initial language based on user preference or default to 'en'
  const initialLang = useMemo(() => {
    const userLang = user?.language_code;
    return userLang === 'ru' ? 'ru' : 'en';
  }, [user?.language_code]);
  const [currentLang, setCurrentLang] = useState<'en' | 'ru'>(initialLang);

  // .. Update language state if user language code changes after initial load
  // .. This handles cases where context might update after initial render
  useEffect(() => {
      const userLang = user?.language_code;
      const newLang = userLang === 'ru' ? 'ru' : 'en';
      if (newLang !== currentLang) {
          setCurrentLang(newLang);
      }
  }, [user?.language_code, currentLang]);


  // .. Function to get translated text
  const t = useCallback((key: string): string => {
    return translations[currentLang]?.[key] || translations['en']?.[key] || key; // Fallback chain: current -> en -> key
  }, [currentLang]);

  // .. Function to toggle language
  const toggleLang = useCallback(() => {
    setCurrentLang(prevLang => prevLang === 'en' ? 'ru' : 'en');
  }, []);

  // .. Memoize current logo text based on pathname and language
  const currentLogoText = useMemo(() => {
    const currentPage = allPages.find(p => p.path === pathname);
    const baseName = currentPage?.name || "VIBE"; // Use English name as base
    // Only translate if it's a known page name, otherwise keep base/default
    const translatedFirstName = t(baseName)?.split(' ')[0];
    return translatedFirstName || baseName.split(' ')[0] || "VIBE"; // Use first word of translated name or base name
  }, [pathname, t]); // Depends on t, which depends on currentLang

  // .. Memoize filtered pages based on search term, admin status, and language
  const filteredPages = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return allPages
      .filter(page => {
        const isAdminPage = page.isAdminOnly === true;
        return !(isAdminPage && !isAdmin); // Filter out admin pages if not admin
      })
      .map(page => ({
        ...page,
        translatedName: t(page.name) // Add translated name using the t function
      }))
      .filter(page => {
        // Search in translated name
        return page.translatedName.toLowerCase().includes(lowerSearchTerm);
      });
  }, [searchTerm, isAdmin, t]); // Depends on t, which depends on currentLang

  // .. Callback to handle scroll events for showing/hiding the header
  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    // .. Keep header visible if nav is open
    if (isNavOpen) {
      setIsHeaderVisible(true);
      setLastScrollY(currentScrollY);
      return;
    }
    // .. Hide header on scroll down, show on scroll up
    if (currentScrollY > lastScrollY && currentScrollY > 50) { // Hides only after scrolling 50px down
      setIsHeaderVisible(false);
    } else if (currentScrollY < lastScrollY) {
      setIsHeaderVisible(true);
    }
    setLastScrollY(currentScrollY);
  }, [lastScrollY, isNavOpen]);

  // .. Effect to add/remove scroll listener
  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  // .. Effect to close nav and clear search when route changes
  useEffect(() => {
    setIsNavOpen(false);
    setSearchTerm("");
  }, [pathname]);

   // .. Effect to prevent body scroll when nav overlay is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    if (isNavOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = originalStyle; // Restore original style
    }
    // .. Cleanup function to restore original style on unmount
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isNavOpen]);

  // .. Define tile colors map - Tailwind classes
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
            <div className="flex items-center gap-3 md:gap-4"> {/* Adjusted gap */}
              {/* Language Toggle Button */}
              <button
                 onClick={toggleLang}
                 className="p-1 sm:p-2 text-xs sm:text-sm font-semibold text-brand-cyan hover:text-brand-cyan/80 transition-colors focus:outline-none focus:ring-1 focus:ring-brand-cyan focus:ring-offset-2 focus:ring-offset-black rounded-md" // Adjusted padding and ring
                 aria-label={t("Toggle Language")}
                 title={t("Toggle Language")}
              >
                {currentLang === 'en' ? 'RU' : 'EN'}
              </button>

              {/* Navigation Toggle Button (Only shows Menu icon here) */}
              {!isNavOpen && (
                <button
                  onClick={() => setIsNavOpen(true)}
                  className="p-2 text-brand-green hover:text-brand-green/80 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2 focus:ring-offset-black rounded-md"
                  aria-label={t("Open navigation")}
                  aria-expanded={isNavOpen} // Should be false here, technically, but used for clarity
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
            // .. Animate from top-right corner area for a smoother feel
            initial={{ opacity: 0, clipPath: 'circle(0% at calc(100% - 2rem) 2rem)' }}
            animate={{ opacity: 1, clipPath: 'circle(150% at calc(100% - 2rem) 2rem)' }}
            exit={{ opacity: 0, clipPath: 'circle(0% at calc(100% - 2rem) 2rem)' }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            // .. Ensure it covers header (z-50 > z-40) and allows scrolling within
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl overflow-y-auto pt-20 pb-10 px-4 md:pt-24"
          >
            {/* Close Button (Moved inside overlay, high z-index) */}
            <button
              onClick={() => setIsNavOpen(false)}
              // .. Position fixed top-right, high z-index within overlay context
              className="fixed top-4 right-4 z-60 p-2 text-brand-green hover:text-brand-green/80 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2 focus:ring-offset-black rounded-md"
              aria-label={t("Close navigation")}
            >
              <X className="h-6 w-6" />
            </button>

            <div className="container mx-auto max-w-3xl xl:max-w-4xl">
              {/* Search Input with Translation */}
              <div className="relative mb-6 md:mb-8">
                <input
                  type="search"
                  placeholder={t("Search pages...")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-800/60 border border-brand-green/40 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent text-sm md:text-base"
                  aria-label={t("Search pages...")} // Use translated label
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
                        onClick={() => setIsNavOpen(false)} // Close nav on link click
                        className={cn(
                          "group relative flex flex-col items-center justify-center rounded-md border transition-all duration-300 aspect-square text-center hover:scale-[1.03]",
                          "p-1.5 sm:p-2 md:p-1.5", // Dense padding
                          page.isImportant
                            ? "bg-gradient-to-br from-purple-900/30 via-black/50 to-blue-900/30 col-span-2" // Always span 2 if important
                            : "bg-gray-800/70 hover:bg-gray-700/90 col-span-1", // Regular tiles span 1
                          tileColorClass, // Apply color styles
                          isCurrentPage ? 'ring-1 ring-offset-1 ring-offset-black ring-brand-green' : '' // Current page highlight
                        )}
                      >
                        {PageIcon && (
                            <PageIcon className={cn(
                                // Responsive icons, smaller base size
                                "h-4 w-4 sm:h-5 sm:w-5 md:h-4 md:w-4 mb-0.5 transition-transform duration-300 group-hover:scale-110",
                                // Larger icons for important tiles
                                page.isImportant ? "text-brand-yellow h-5 w-5 sm:h-6 sm:w-6 md:h-5 md:w-5" : "inherit"
                            )} />
                        )}
                        {/* Display translated name */}
                        <span className={cn(
                            "font-semibold transition-colors leading-tight", // Tight leading
                            // Responsive text, smaller base size
                            "text-[0.6rem] sm:text-xs md:text-[0.6rem] md:leading-none", // Even smaller text on md+ for density
                            // Larger text for important tiles
                            page.isImportant ? "text-white text-[0.7rem] sm:text-sm md:text-xs" : "text-gray-300 group-hover:text-white"
                        )}>
                          {page.translatedName}
                        </span>
                        {page.isAdminOnly && ( // Admin badge with translated tooltip
                           <span title={t("Admin Only")} className="absolute top-0.5 right-0.5 text-[0.5rem] text-red-400 bg-black/60 rounded-full px-1 py-0 leading-none">🛡️</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ) : ( // Translated "No results" message
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