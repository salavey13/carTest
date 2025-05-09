"use client";

import Link from "next/link";
import { LayoutGrid, X, Search, Globe, Layers, Zap, Puzzle, BookUser, Settings2, ShieldCheck, Users, Star as LucideStar } from "lucide-react"; 
import React, { useState, useEffect, useMemo, useCallback } from "react";
import UserInfo from "@/components/user-info";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { 
  FaGears, 
  FaScrewdriverWrench 
} from "react-icons/fa6"; 
import {
  FaDumbbell, FaCircleUser, FaWandMagicSparkles, FaRocket, FaRoad, FaBookOpen,
  FaBrain, FaRobot, FaMagnifyingGlass, FaGift, FaUserShield, FaCarOn,
  FaYoutube, FaFileInvoiceDollar, FaCreditCard, FaHeart, FaPalette,
  FaCircleInfo, FaListCheck, FaNetworkWired, FaRegLightbulb, FaUpload,
  FaUserNinja, FaLandmarkDome, FaLeaf, FaFire, FaChartLine, FaDollarSign, FaShieldVirus, FaStar, FaGamepad
} from "react-icons/fa6";
import { debugLogger as logger } from "@/lib/debugLogger";

interface PageInfo {
  path: string;
  name: string;
  icon?: React.ComponentType<{ className?: string }>;
  isImportant?: boolean;
  isAdminOnly?: boolean;
  isHot?: boolean;
  color?: 'purple' | 'blue' | 'yellow' | 'lime' | 'green' | 'pink' | 'cyan' | 'red' | 'orange' | 'gray'; 
  group?: string; 
}

const allPages: PageInfo[] = [
  // --- Core Vibe ---
  { path: "/", name: "Home", icon: FaBrain, group: "Core Vibe", isImportant: true, color: "cyan" },
  { path: "/repo-xml", name: "SUPERVIBE Studio", icon: FaWandMagicSparkles, group: "Core Vibe", isImportant: true, color: "purple", isHot: true },
  { path: "/selfdev", name: "SelfDev Path", icon: FaRoad, group: "Core Vibe", isImportant: true, color: "green" },
  { path: "/p-plan", name: "VIBE Plan", icon: FaUserNinja, group: "Core Vibe", isImportant: true, isHot: true, color: "yellow" },
  { path: "/selfdev/gamified", name: "CyberDev OS", icon: FaGamepad, group: "Core Vibe", isImportant: true, color: "pink", isHot: true },
  
  // --- CyberFitness ---
  { path: "/profile", name: "Agent Profile", icon: FaCircleUser, group: "CyberFitness", color: "pink" },
  { path: "/buy-subscription", name: "OS Upgrades", icon: FaCreditCard, group: "CyberFitness", color: "green" },
  { path: "/premium", name: "Premium Modules", icon: FaStar, group: "CyberFitness", color: "yellow" }, 
  { path: "/nutrition", name: "Cognitive Fuel", icon: FaScrewdriverWrench, group: "CyberFitness", color: "orange"}, 
  { path: "/settings", name: "System Config", icon: FaGears, group: "CyberFitness", color: "blue" },  
  { path: "/partner", name: "Alliance Perks", icon: Users, group: "CyberFitness", color: "purple"}, 

  // --- Content & Tools ---
  { path: "/jumpstart", name: "Jumpstart Kit", icon: FaRocket, group: "Content & Tools", isImportant: true, color: "lime" },
  { path: "/purpose-profit", name: "Purpose & Profit", icon: FaBookOpen, group: "Content & Tools", color: "purple" },
  { path: "/ai-work-future", name: "AI & Future of Work", icon: FaNetworkWired, group: "Content & Tools", color: "cyan" },
  { path: "/advice", name: "Advice Archive", icon: FaRegLightbulb, group: "Content & Tools", color: "orange" },
  { path: "/expmind", name: "Experimental Mindset", icon: FaBrain, group: "Content & Tools", color: "pink" },
  { path: "/style-guide", name: "Style Guide", icon: FaPalette, group: "Content & Tools", color: "gray" },
  { path: "/onesitepls", name: "oneSitePls Info", icon: FaCircleInfo, group: "Content & Tools", color: "gray" },
  
  // --- Misc & Old (can be hidden or moved to a "Legacy" group if needed) ---
  { path: "/cartest", name: "Cyber Garage", icon: FaCarOn, group: "Misc", color: "blue" },
  { path: "/botbusters", name: "Bot Busters", icon: FaRobot, group: "Misc", color: "blue"},
  { path: "/bullshitdetector", name: "BS Detector", icon: FaMagnifyingGlass, group: "Misc", color: "yellow" },
  { path: "/wheel-of-fortune", name: "Wheel of Fortune", icon: FaGift, group: "Misc", color: "lime" },
  { path: "/invoices", name: "My Invoices", icon: FaFileInvoiceDollar, group: "Misc", color: "green" },
  { path: "/donate", name: "Donate", icon: FaHeart, group: "Misc", color: "red" },
  { path: "/onesiteplsinstructions", name: "oneSitePls How-To", icon: FaListCheck, group: "Misc", color: "gray" },
  { path: "/rent-car", name: "Rent a Car", icon: FaCarOn, group: "Misc", color: "yellow" },
  { path: "/vpr-tests", name: "VPR Tests", icon: FaListCheck, group: "Misc", color: 'pink' },
  { path: "/vpr/geography/6/cheatsheet", name: "Geo Cheatsheet 6", icon: Globe, group: "Misc", color: 'green' },
  { path: "/vpr/history/6/cheatsheet", name: "History Cheatsheet 6", icon: FaLandmarkDome, group: "Misc", color: 'yellow' },
  { path: "/vpr/biology/6/cheatsheet", name: "Biology Cheatsheet 6", icon: FaLeaf, group: "Misc", color: 'lime' },

  // --- Admin Zone ---
  { path: "/admin", name: "Admin Panel", icon: FaUserShield, group: "Admin Zone", isAdminOnly: true, color: "red" },
  { path: "/advice-upload", name: "Upload Advice", icon: FaUpload, group: "Admin Zone", isAdminOnly: true, color: "red" },
  { path: "/shadow-fleet-admin", name: "Fleet Admin", icon: FaCarOn, group: "Admin Zone", isAdminOnly: true, color: "red" },
  { path: "/youtubeAdmin", name: "YT Admin", icon: FaYoutube, group: "Admin Zone", isAdminOnly: true, color: "red" },
];

const groupOrder = ["Core Vibe", "CyberFitness", "Content & Tools", "Misc", "Admin Zone"];
const groupIcons: Record<string, React.ComponentType<{className?: string}>> = {
    "Core Vibe": Zap,
    "CyberFitness": BookUser, 
    "Content & Tools": Puzzle,
    "Misc": Layers,
    "Admin Zone": ShieldCheck,
};

const translations: Record<string, Record<string, string>> = {
  en: {
    "Home": "Home", "SUPERVIBE Studio": "SUPERVIBE Studio", "SelfDev Path": "SelfDev Path", "VIBE Plan": "VIBE Plan", "CyberDev OS": "CyberDev OS", 
    "Agent Profile": "Agent Profile", "OS Upgrades": "OS Upgrades", "Premium Modules": "Premium Modules", "Cognitive Fuel": "Cognitive Fuel", "System Config": "System Config", "Alliance Perks": "Alliance Perks",
    "Jumpstart Kit": "Jumpstart Kit", "Purpose & Profit": "Purpose & Profit", "AI & Future of Work": "AI & Future of Work", "Advice Archive": "Advice Archive", "Experimental Mindset": "Experimental Mindset", "Style Guide": "Style Guide", "oneSitePls Info": "oneSitePls Info",
    "Cyber Garage": "Cyber Garage", "Bot Busters": "Bot Busters", "BS Detector": "BS Detector", "Wheel of Fortune": "Wheel of Fortune", "My Invoices": "My Invoices", "Donate": "Donate", "oneSitePls How-To": "oneSitePls How-To", "Rent a Car": "Rent a Car", "VPR Tests": "VPR Tests", "Geo Cheatsheet 6": "Geo Cheatsheet 6", "History Cheatsheet 6": "History Cheatsheet 6", "Biology Cheatsheet 6": "Biology Cheatsheet 6",
    "Admin Panel": "Admin Panel", "Upload Advice": "Upload Advice", "Fleet Admin": "Fleet Admin", "YT Admin": "YT Admin", "Fix13min": "Fix13min", "About Me": "About Me", "Subscribe": "Subscribe",
    "Search pages...": "Search pages...", "No pages found matching": "No pages found matching", "Admin Only": "Admin Only", "Toggle Language": "Toggle Language", "Open navigation": "Open navigation", "Close navigation": "Close navigation", "Hot": "Hot",
    "Core Vibe": "Core Vibe", "CyberFitness": "CyberFitness", "Content & Tools": "Content & Tools", "Misc": "Misc", "Admin Zone": "Admin Zone"
  },
  ru: {
    "Home": "Главная", "SUPERVIBE Studio": "SUPERVIBE Studio", "SelfDev Path": "Путь SelfDev", "VIBE Plan": "VIBE План", "CyberDev OS": "CyberDev OS",
    "Agent Profile": "Профиль Агента", "OS Upgrades": "Апгрейды ОС", "Premium Modules": "Премиум Модули", "Cognitive Fuel": "Когнитивное Топливо", "System Config": "Настройки Системы", "Alliance Perks": "Бонусы Альянса",
    "Jumpstart Kit": "Jumpstart Kit", "Purpose & Profit": "Цель и Прибыль", "AI & Future of Work": "AI и Будущее Работы", "Advice Archive": "Архив Советов", "Experimental Mindset": "Эксперим. Мышление", "Style Guide": "Гайд по Стилю", "oneSitePls Info": "Инфо oneSitePls",
    "Cyber Garage": "Кибер Гараж", "Bot Busters": "Охотники за Ботами", "BS Detector": "BS Детектор", "Wheel of Fortune": "Колесо Фортуны", "My Invoices": "Мои Счета", "Donate": "Поддержать", "oneSitePls How-To": "Как юзать oneSitePls", "Rent a Car": "Аренда Авто", "VPR Tests": "ВПР Тесты", "Geo Cheatsheet 6": "Шпаргалка Гео 6", "History Cheatsheet 6": "Шпаргалка Ист 6", "Biology Cheatsheet 6": "Шпаргалка Био 6",
    "Admin Panel": "Админ Панель", "Upload Advice": "Загрузить Совет", "Fleet Admin": "Админ Автопарка", "YT Admin": "Админ YT", "Fix13min": "Fix13min", "About Me": "Обо мне", "Subscribe": "Подписаться",
    "Search pages...": "Поиск страниц...", "No pages found matching": "Страницы не найдены по запросу", "Admin Only": "Только для админа", "Toggle Language": "Переключить язык", "Open navigation": "Открыть навигацию", "Close navigation": "Закрыть навигацию", "Hot": "🔥",
    "Core Vibe": "Ядро Вайба", "CyberFitness": "КиберФитнес", "Content & Tools": "Контент и Тулзы", "Misc": "Разное", "Admin Zone": "Зона Админа"
  }
};

export default function Header() {
  const { isAdmin, user } = useAppContext();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const pathname = usePathname();
  
  const initialLang = useMemo(() => (user?.language_code === 'ru' ? 'ru' : 'en'), [user?.language_code]);
  const [currentLang, setCurrentLang] = useState<'en' | 'ru'>(initialLang);
  
  useEffect(() => {
    const newLangBasedOnUser = user?.language_code === 'ru' ? 'ru' : 'en';
    if (newLangBasedOnUser !== currentLang) {
       setCurrentLang(newLangBasedOnUser);
    }
  }, [user?.language_code, currentLang]);

  const t = useCallback((key: string): string => translations[currentLang]?.[key] || translations['en']?.[key] || key, [currentLang]);
  const toggleLang = useCallback(() => setCurrentLang(prevLang => prevLang === 'en' ? 'ru' : 'en'), []);

  const currentLogoText = useMemo(() => {
    const currentPage = allPages.find(p => p.path === pathname);
    if (pathname?.startsWith('/vpr')) return "VPR";
    const baseName = currentPage?.name || "Home"; 
    const translatedFirstName = t(baseName)?.split(' ')[0];
    return translatedFirstName || baseName.split(' ')[0] || "VIBE";
  }, [pathname, t]);

  const groupedAndFilteredPages = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = allPages
      .filter(page => !(page.isAdminOnly && !isAdmin))
      .map(page => ({ ...page, translatedName: t(page.name) }))
      .filter(page => page.translatedName.toLowerCase().includes(lowerSearchTerm));

    const groups: Record<string, PageInfo[]> = {};
    groupOrder.forEach(groupName => groups[groupName] = []);

    filtered.forEach(page => {
      const groupName = page.group || "Misc";
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(page);
    });
    return groups;
  }, [searchTerm, isAdmin, t]);

  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    if (isNavOpen) {
      if (!isHeaderVisible) setIsHeaderVisible(true);
      setLastScrollY(currentScrollY); return;
    }
    if (currentScrollY > lastScrollY && currentScrollY > 60) {
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
    if (isNavOpen) { setIsNavOpen(false); setSearchTerm(""); }
  }, [pathname]); 

  useEffect(() => {
    const originalStyle = document.body.style.overflow;
    if (isNavOpen) { document.body.style.overflow = 'hidden'; } 
    else { document.body.style.overflow = originalStyle; }
    return () => { document.body.style.overflow = originalStyle; };
  }, [isNavOpen]);

  const tileColorClasses: Record<Required<PageInfo>['color'] | 'default', string> = {
    purple: "border-brand-purple/60 hover:border-brand-purple hover:shadow-[0_0_15px_theme(colors.brand-purple/50%)] text-brand-purple",
    blue: "border-brand-blue/60 hover:border-brand-blue hover:shadow-[0_0_15px_theme(colors.brand-blue/50%)] text-brand-blue",
    yellow: "border-brand-yellow/60 hover:border-brand-yellow hover:shadow-[0_0_15px_theme(colors.brand-yellow/50%)] text-brand-yellow",
    lime: "border-neon-lime/60 hover:border-neon-lime hover:shadow-[0_0_15px_theme(colors.neon-lime/50%)] text-neon-lime",
    green: "border-brand-green/60 hover:border-brand-green hover:shadow-[0_0_15px_theme(colors.brand-green/50%)] text-brand-green",
    pink: "border-brand-pink/60 hover:border-brand-pink hover:shadow-[0_0_15px_theme(colors.brand-pink/50%)] text-brand-pink",
    cyan: "border-brand-cyan/60 hover:border-brand-cyan hover:shadow-[0_0_15px_theme(colors.brand-cyan/50%)] text-brand-cyan",
    red: "border-red-500/60 hover:border-red-500 hover:shadow-[0_0_15px_theme(colors.red.500/50%)] text-red-500",
    orange: "border-brand-orange/60 hover:border-brand-orange hover:shadow-[0_0_15px_theme(colors.brand-orange/50%)] text-brand-orange",
    gray: "border-gray-600/60 hover:border-gray-500 hover:shadow-[0_0_15px_theme(colors.gray.500/50%)] text-gray-400",
    default: "border-gray-700 hover:border-brand-green/80 text-gray-400 hover:text-brand-green"
  };

  return (
    <>
      <motion.header
        className={cn("fixed top-0 left-0 right-0 z-40 bg-black/80 border-b border-brand-purple/40 shadow-lg backdrop-blur-lg", "transition-transform duration-300 ease-in-out")}
        initial={{ y: 0 }} animate={{ y: isHeaderVisible ? 0 : "-100%" }} transition={{ type: "tween", duration: 0.3 }}
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
              ><Globe className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> <span className="hidden sm:inline">{currentLang === 'en' ? 'RU' : 'EN'}</span></button>
              {!isNavOpen && (
                <button
                  onClick={() => setIsNavOpen(true)}
                  className="p-2 text-brand-green hover:text-brand-green/70 focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2 focus:ring-offset-black rounded-md transition-all duration-200 hover:bg-brand-green/10"
                  aria-label={t("Open navigation")} aria-expanded={isNavOpen}
                ><LayoutGrid className="h-5 w-5 sm:h-6 sm:w-6" /></button>
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
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl overflow-y-auto pt-20 pb-10 px-4 md:pt-24 simple-scrollbar"
          >
            <button
              onClick={() => setIsNavOpen(false)}
              className="fixed top-5 right-5 z-[51] p-2 text-brand-pink hover:text-brand-pink/80 focus:outline-none focus:ring-2 focus:ring-brand-pink focus:ring-offset-2 focus:ring-offset-black rounded-full transition-all duration-200 hover:bg-brand-pink/10"
              aria-label={t("Close navigation")}
            ><X className="h-6 w-6 sm:h-7 sm:w-7" /></button>

            <div className="container mx-auto max-w-4xl xl:max-w-5xl">
              <div className="relative mb-6">
                <input
                  type="search" placeholder={t("Search pages...")} value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-dark-card/80 border-2 border-brand-cyan/50 rounded-lg text-foreground placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-cyan focus:border-transparent text-base font-mono shadow-lg"
                  aria-label={t("Search pages...")}
                />
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-brand-cyan/70 pointer-events-none" />
              </div>
              
              <div className="space-y-6">
                {groupOrder.map(groupName => {
                  const pagesInGroup = groupedAndFilteredPages[groupName];
                  if (!pagesInGroup || pagesInGroup.length === 0) return null;
                  const GroupIcon = groupIcons[groupName];

                  return (
                    <div key={groupName}>
                      <h3 className="text-lg font-orbitron text-brand-purple mb-3 flex items-center gap-2">
                        {GroupIcon && <GroupIcon className="w-6 h-6 opacity-80" />} 
                        {t(groupName)}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-2.5">
                        {pagesInGroup.map((page) => {
                          const PageIcon = page.icon;
                          const isCurrentPage = page.path === pathname;
                          const tileColorClass = tileColorClasses[page.color || 'default'];

                          return (
                            <Link
                              key={page.path} href={page.path}
                              onClick={() => setIsNavOpen(false)}
                              className={cn(
                                "group relative flex flex-col items-center justify-center rounded-lg border-2 transition-all duration-200 aspect-square text-center hover:scale-[1.03] hover:-translate-y-0.5",
                                "p-1", 
                                page.isImportant 
                                  ? "bg-gradient-to-br from-purple-800/30 via-black/50 to-blue-800/30 col-span-2 shadow-md" 
                                  : "bg-dark-card/60 hover:bg-dark-card/80 col-span-1",
                                tileColorClass,
                                isCurrentPage ? `ring-2 ring-offset-2 ring-offset-black ${page.color === 'lime' || page.color === 'yellow' || page.color === 'orange' ? 'ring-black/70' : 'ring-white/90'}` : 'ring-transparent'
                              )}
                              title={page.translatedName}
                            >
                              {page.isHot && (
                                <span title={t("Hot")} className="absolute top-1 right-1 text-sm text-brand-red animate-pulse" aria-label={t("Hot")}>
                                  <FaFire/>
                                </span>
                              )}
                              {PageIcon && (
                                <PageIcon className={cn(
                                  "mb-1 transition-transform duration-200 group-hover:scale-110", 
                                  page.isImportant 
                                      ? "h-6 w-6 sm:h-7 sm:w-7" 
                                      : "h-4 w-4"             
                                )} />
                              )}
                              <span className={cn(
                                "font-orbitron font-medium transition-colors leading-tight text-center",
                                page.isImportant 
                                    ? "text-white text-[1.6rem] xs:text-[1.65rem] sm:text-[1.7rem] md:text-[1.75rem] lg:text-[1.8rem]" 
                                    : "text-gray-300 group-hover:text-inherit text-[1.1rem] xs:text-[1.1rem] sm:text-[1.125rem] md:text-[1.15rem] lg:text-[1.175rem]"
                              )}>
                                {page.translatedName}
                              </span>
                              {page.isAdminOnly && (
                                <span title={t("Admin Only")} className="absolute bottom-1 right-1 text-[0.65rem] text-red-400/80 bg-black/60 rounded-full px-1 py-0.5 leading-none">
                                  ADMIN
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                      {groupOrder.indexOf(groupName) < groupOrder.length -1 && Object.values(groupedAndFilteredPages).filter(g => g && g.length > 0).indexOf(pagesInGroup) < Object.values(groupedAndFilteredPages).filter(g => g && g.length > 0).length -1 && (
                        <hr className="my-4 border-gray-700/50"/>
                      )}
                    </div>
                  );
                })}
                {Object.values(groupedAndFilteredPages).every(g => !g || g.length === 0) && (
                  <p className="text-center text-gray-500 text-sm md:text-base mt-6 md:mt-8 font-mono">
                    {t("No pages found matching")} "{searchTerm}"
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}