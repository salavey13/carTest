"use client";

import Link from "next/link";
import { LayoutGrid, X, Search, Globe, Layers, Zap, Puzzle, BookUser, Settings2, ShieldCheck, Users, Star as LucideStar, DraftingCompass } from "lucide-react"; // Added DraftingCompass
import React, { useState, useEffect, useMemo, useCallback } from "react";
import UserInfo from "@/components/user-info";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
// Removed direct Fa6 imports if VibeContentRenderer is used for nav icons,
// but keeping them here as `allPages` still defines them directly.
// For nav items, we will eventually pass icon *names* to VibeContentRenderer.
import { 
  FaGears, 
  FaScrewdriverWrench,
  FaDumbbell, FaCircleUser, FaWandMagicSparkles, FaRocket, FaRoad, FaBookOpen,
  FaBrain, FaRobot, FaMagnifyingGlass, FaGift, FaUserShield, FaCarOn,
  FaYoutube, FaFileInvoiceDollar, FaCreditCard, FaHeart, FaPalette,
  FaCircleInfo, FaListCheck, FaNetworkWired, FaRegLightbulb, FaUpload,
  FaUserNinja, FaLandmarkDome, FaLeaf, FaFire, FaChartLine, FaDollarSign, FaShieldVirus, FaStar, FaGamepad, FaFilm, FaPiggyBank,
  FaTools // Added FaTools as an alternative for Schematics
} from "react-icons/fa6";
import { debugLogger as logger } from "@/lib/debugLogger";
import VibeContentRenderer from "@/components/VibeContentRenderer"; // Import VCR

interface PageInfo {
  path: string;
  name: string;
  icon?: React.ComponentType<{ className?: string }> | string; // Allow string for VCR
  isImportant?: boolean;
  isAdminOnly?: boolean;
  isHot?: boolean;
  color?: 'purple' | 'blue' | 'yellow' | 'lime' | 'green' | 'pink' | 'cyan' | 'red' | 'orange' | 'gray'; 
  group?: string; 
  translatedName?: string; 
}

const allPages: PageInfo[] = [
  { path: "/", name: "Home", icon: "FaBrain", group: "Core Vibe", isImportant: true, color: "cyan" },
  { path: "/repo-xml", name: "SUPERVIBE Studio", icon: "FaWandMagicSparkles", group: "Core Vibe", isImportant: true, color: "purple", isHot: true },
  { path: "/selfdev", name: "SelfDev Path", icon: "FaRoad", group: "Core Vibe", isImportant: true, color: "green" },
  { path: "/p-plan", name: "VIBE Plan", icon: "FaUserNinja", group: "Core Vibe", isImportant: true, isHot: true, color: "yellow" },
  { path: "/game-plan", name: "Game Plan", icon: "FaFilm", group: "Core Vibe", isImportant: true, color: "orange", isHot: true },
  { path: "/selfdev/gamified", name: "CyberDev OS", icon: "FaGamepad", group: "Core Vibe", isImportant: true, color: "pink", isHot: true },
  
  { path: "/profile", name: "Agent Profile", icon: "FaCircleUser", group: "CyberFitness", color: "pink" },
  { path: "/buy-subscription", name: "OS Upgrades", icon: "FaCreditCard", group: "CyberFitness", color: "green" },
  { path: "/premium", name: "Premium Modules", icon: "FaStar", group: "CyberFitness", color: "yellow" }, 
  { path: "/nutrition", name: "Vibe Schematics", icon: "FaTools", group: "CyberFitness", color: "orange"}, // CHANGED name and icon
  { path: "/settings", name: "System Config", icon: "FaGears", group: "CyberFitness", color: "blue" },  
  { path: "/partner", name: "Alliance Perks", icon: Users, group: "CyberFitness", color: "purple"}, // Lucide icon here
  
  { path: "/jumpstart", name: "Jumpstart Kit", icon: "FaRocket", group: "Content & Tools", isImportant: true, color: "lime" },
  { path: "/purpose-profit", name: "Purpose & Profit", icon: "FaBookOpen", group: "Content & Tools", color: "purple" },
  { path: "/ai-work-future", name: "AI & Future of Work", icon: "FaNetworkWired", group: "Content & Tools", color: "cyan" },
  { path: "/advice", name: "Advice Archive", icon: "FaRegLightbulb", group: "Content & Tools", color: "orange" },
  { path: "/expmind", name: "Experimental Mindset", icon: "FaBrain", group: "Content & Tools", color: "pink" },
  { path: "/style-guide", name: "Style Guide", icon: "FaPalette", group: "Content & Tools", color: "gray" },
  { path: "/onesitepls", name: "oneSitePls Info", icon: "FaCircleInfo", group: "Content & Tools", color: "gray" },
  { path: "/finance-literacy-memo", name: "Finance Literacy Memo", icon: "FaDollarSign", group: "Content & Tools", color: "green"},
  
  { path: "/cartest", name: "Cyber Garage", icon: "FaCarOn", group: "Misc", color: "blue" },
  { path: "/botbusters", name: "Bot Busters", icon: "FaRobot", group: "Misc", color: "blue"},
  { path: "/bullshitdetector", name: "BS Detector", icon: "FaMagnifyingGlass", group: "Misc", color: "yellow" },
  { path: "/wheel-of-fortune", name: "Wheel of Fortune", icon: "FaGift", group: "Misc", color: "lime" },
  { path: "/invoices", name: "My Invoices", icon: "FaFileInvoiceDollar", group: "Misc", color: "green" },
  { path: "/donate", name: "Donate", icon: "FaHeart", group: "Misc", color: "red" },
  { path: "/onesiteplsinstructions", name: "oneSitePls How-To", icon: "FaListCheck", group: "Misc", color: "gray" },
  { path: "/rent-car", name: "Rent a Car", icon: "FaCarOn", group: "Misc", color: "yellow" },
  { path: "/vpr-tests", name: "VPR Tests", icon: "FaListCheck", group: "Misc", color: 'pink' },
  { path: "/vpr/geography/6/cheatsheet", name: "Geo Cheatsheet 6", icon: Globe, group: "Misc", color: 'green' }, // Lucide
  { path: "/vpr/history/6/cheatsheet", name: "History Cheatsheet 6", icon: "FaLandmarkDome", group: "Misc", color: 'yellow' },
  { path: "/vpr/biology/6/cheatsheet", name: "Biology Cheatsheet 6", icon: "FaLeaf", group: "Misc", color: 'lime' },
  
  { path: "/admin", name: "Admin Panel", icon: "FaUserShield", group: "Admin Zone", isAdminOnly: true, color: "red" },
  { path: "/advice-upload", name: "Upload Advice", icon: "FaUpload", group: "Admin Zone", isAdminOnly: true, color: "red" },
  { path: "/shadow-fleet-admin", name: "Fleet Admin", icon: "FaCarOn", group: "Admin Zone", isAdminOnly: true, color: "red" },
  { path: "/youtubeAdmin", name: "YT Admin", icon: "FaYoutube", group: "Admin Zone", isAdminOnly: true, color: "red" },
];

const groupOrder = ["Core Vibe", "CyberFitness", "Content & Tools", "Misc", "Admin Zone"];
// Using string names for Fa6 icons for groupIcons now
const groupIcons: Record<string, string> = {
    "Core Vibe": "FaZap", // Changed from Zap (lucide) to FaZap for VCR
    "CyberFitness": "FaBookUser", 
    "Content & Tools": "FaPuzzlePiece", // Changed from Puzzle (lucide) to FaPuzzlePiece
    "Misc": "FaLayers", 
    "Admin Zone": "FaShieldCheck",
};

const translations: Record<string, Record<string, string>> = {
  en: {
    "Home": "Home", "SUPERVIBE Studio": "SUPERVIBE Studio", "SelfDev Path": "SelfDev Path", "VIBE Plan": "VIBE Plan", "Game Plan": "Game Plan", "CyberDev OS": "CyberDev OS", 
    "Agent Profile": "Agent Profile", "OS Upgrades": "OS Upgrades", "Premium Modules": "Premium Modules", 
    "Vibe Schematics": "Vibe Schematics", // CHANGED
    "System Config": "System Config", "Alliance Perks": "Alliance Perks",
    "Jumpstart Kit": "Jumpstart Kit", "Purpose & Profit": "Purpose & Profit", "AI & Future of Work": "AI & Future of Work", "Advice Archive": "Advice Archive", "Experimental Mindset": "Experimental Mindset", "Style Guide": "Style Guide", "oneSitePls Info": "oneSitePls Info", "Finance Literacy Memo": "Finance Literacy Memo",
    "Cyber Garage": "Cyber Garage", "Bot Busters": "Bot Busters", "BS Detector": "BS Detector", "Wheel of Fortune": "Wheel of Fortune", "My Invoices": "My Invoices", "Donate": "Donate", "oneSitePls How-To": "oneSitePls How-To", "Rent a Car": "Rent a Car", "VPR Tests": "VPR Tests", "Geo Cheatsheet 6": "Geo Cheatsheet 6", "History Cheatsheet 6": "History Cheatsheet 6", "Biology Cheatsheet 6": "Biology Cheatsheet 6",
    "Admin Panel": "Admin Panel", "Upload Advice": "Upload Advice", "Fleet Admin": "Fleet Admin", "YT Admin": "YT Admin", "Fix13min": "Fix13min", "About Me": "About Me", "Subscribe": "Subscribe",
    "Search pages...": "Search pages...", "No pages found matching": "No pages found matching", "Admin Only": "Admin Only", "Toggle Language": "Toggle Language", "Open navigation": "Open navigation", "Close navigation": "Close navigation", "Hot": "Hot",
    "Core Vibe": "Core Vibe", "CyberFitness": "CyberFitness", "Content & Tools": "Content & Tools", "Misc": "Misc", "Admin Zone": "Admin Zone"
  },
  ru: {
    "Home": "Главная", "SUPERVIBE Studio": "SUPERVIBE Studio", "SelfDev Path": "Путь SelfDev", "VIBE Plan": "VIBE План", "Game Plan": "Гейм План", "CyberDev OS": "CyberDev OS",
    "Agent Profile": "Профиль Агента", "OS Upgrades": "Апгрейды ОС", "Premium Modules": "Премиум Модули", 
    "Vibe Schematics": "Схемы Вайба", // CHANGED
    "System Config": "Настройки Системы", "Alliance Perks": "Бонусы Альянса",
    "Jumpstart Kit": "Jumpstart Kit", "Purpose & Profit": "Цель и Прибыль", "AI & Future of Work": "AI и Будущее Работы", "Advice Archive": "Архив Советов", "Experimental Mindset": "Эксперим. Мышление", "Style Guide": "Гайд по Стилю", "oneSitePls Info": "Инфо oneSitePls", "Finance Literacy Memo": "Памятка Фин. Грамотности",
    "Cyber Garage": "Кибер Гараж", "Bot Busters": "Охотники за Ботами", "BS Detector": "BS Детектор", "Wheel of Fortune": "Колесо Фортуны", "My Invoices": "Мои Счета", "Donate": "Поддержать", "oneSitePls How-To": "Как юзать oneSitePls", "Rent a Car": "Аренда Авто", "VPR Tests": "ВПР Тесты", "Geo Cheatsheet 6": "Шпаргалка Гео 6", "History Cheatsheet 6": "Шпаргалка Ист 6", "Biology Cheatsheet 6": "Шпаргалка Био 6",
    "Admin Panel": "Админ Панель", "Upload Advice": "Загрузить Совет", "Fleet Admin": "Админ Автопарка", "YT Admin": "Админ YT", "Fix13min": "Fix13min", "About Me": "Обо мне", "Subscribe": "Подписаться",
    "Search pages...": "Поиск страниц...", "No pages found matching": "Страницы не найдены по запросу", "Admin Only": "Только для админа", "Toggle Language": "Переключить язык", "Open navigation": "Открыть навигацию", "Close navigation": "Закрыть навигацию", "Hot": "🔥",
    "Core Vibe": "Ядро Вайба", "CyberFitness": "КиберФитнес", "Content & Tools": "Контент и Тулзы", "Misc": "Разное", "Admin Zone": "Зона Админа"
  }
};

const colorVarMap: Record<string, string> = {
  purple: "var(--brand-purple-rgb)", blue: "var(--brand-blue-rgb)", yellow: "var(--brand-yellow-rgb)",
  lime: "var(--neon-lime-rgb)", green: "var(--brand-green-rgb)", pink: "var(--brand-pink-rgb)",
  cyan: "var(--brand-cyan-rgb)", red: "var(--red-500-rgb)", orange: "var(--brand-orange-rgb)",
  gray: "var(--gray-500-rgb)", 
};

const tileColorClasses: Record<Required<PageInfo>['color'] | 'default', string> = {
  purple: "border-brand-purple/70 hover:border-brand-purple text-brand-purple",
  blue: "border-brand-blue/70 hover:border-brand-blue text-brand-blue",
  yellow: "border-brand-yellow/70 hover:border-brand-yellow text-brand-yellow",
  lime: "border-neon-lime/70 hover:border-neon-lime text-neon-lime",
  green: "border-brand-green/70 hover:border-brand-green text-brand-green",
  pink: "border-brand-pink/70 hover:border-brand-pink text-brand-pink",
  cyan: "border-brand-cyan/70 hover:border-brand-cyan text-brand-cyan",
  red: "border-destructive/70 hover:border-destructive text-destructive", 
  orange: "border-brand-orange/70 hover:border-brand-orange text-brand-orange",
  gray: "border-muted/70 hover:border-muted text-muted-foreground", 
  default: "border-border hover:border-primary/80 text-muted-foreground hover:text-primary" 
};

export default function Header() {
  const { isAdmin, user, isLoading: appContextLoading } = useAppContext();
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
    const page = allPages.find(p => p.path === pathname);
    if (pathname?.startsWith('/vpr')) return "VPR";
    if (page?.name) {
        const translatedPageName = t(page.name);
        const firstWord = translatedPageName.split(' ')[0];
        if (firstWord.length <= 6) return firstWord.toUpperCase(); 
        if (page.name.length <= 6) return page.name.toUpperCase(); 
    }
    return "CYBERVICE"; 
  }, [pathname, t]);
  
  const logoCyberPart = currentLogoText === "CYBERVICE" ? "CYBER" : currentLogoText;
  const logoVicePart = currentLogoText === "CYBERVICE" ? "VICE" : "";

  const groupedAndFilteredPages = useMemo(() => {
    logger.debug("[Header] Recalculating groupedAndFilteredPages. appContextLoading:", appContextLoading, "isAdmin function exists:", typeof isAdmin === 'function');
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    let currentIsAdminReal = false;
    if (!appContextLoading && typeof isAdmin === 'function') {
      currentIsAdminReal = isAdmin();
      logger.debug("[Header] Admin status determined from context. isAdminReal:", currentIsAdminReal);
    } else {
      logger.debug("[Header] Admin status check deferred or isAdmin not ready. appContextLoading:", appContextLoading, "isAdmin type:", typeof isAdmin);
    }
    
    const filtered = allPages
      .filter(page => !(page.isAdminOnly && !currentIsAdminReal)) 
      .map(page => ({ ...page, translatedName: t(page.name) }))
      .filter(page => page.translatedName!.toLowerCase().includes(lowerSearchTerm));

    const groups: Record<string, PageInfo[]> = {};
    groupOrder.forEach(groupName => {
        if (groupName === "Admin Zone" && !currentIsAdminReal && !appContextLoading) { // Ensure admin zone is hidden if not admin and context loaded
            return; 
        }
        groups[groupName] = [];
    });

    filtered.forEach(page => {
      const groupName = page.group || "Misc";
      if (groups[groupName]) { groups[groupName].push(page); } 
      else if (groupName === "Admin Zone" && currentIsAdminReal) { groups[groupName] = [page];} 
      else if (groupName !== "Admin Zone") { groups[groupName] = [page];}
    });
    logger.debug("[Header] Final groups for nav:", Object.keys(groups).filter(gn => groups[gn]?.length > 0));
    return groups;
  }, [searchTerm, isAdmin, t, appContextLoading]);

  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    if (isNavOpen) { if (!isHeaderVisible) setIsHeaderVisible(true); setLastScrollY(currentScrollY); return; }
    if (currentScrollY > lastScrollY && currentScrollY > 60) { if (isHeaderVisible) setIsHeaderVisible(false); } 
    else if (currentScrollY < lastScrollY || currentScrollY <= 60) { if (!isHeaderVisible) setIsHeaderVisible(true); }
    setLastScrollY(currentScrollY);
  }, [lastScrollY, isNavOpen, isHeaderVisible]);

  useEffect(() => { window.addEventListener("scroll", handleScroll, { passive: true }); return () => window.removeEventListener("scroll", handleScroll); }, [handleScroll]);
  useEffect(() => { if (isNavOpen) { setIsNavOpen(false); setSearchTerm(""); } }, [pathname]); 
  useEffect(() => { const originalStyle = document.body.style.overflow; if (isNavOpen) { document.body.style.overflow = 'hidden'; } else { document.body.style.overflow = originalStyle; } return () => { document.body.style.overflow = originalStyle; }; }, [isNavOpen]);

  const RenderIcon = ({ icon, className }: { icon?: string | React.ComponentType<{ className?: string }>; className?: string }) => {
    if (!icon) return null;
    if (typeof icon === 'string') {
      return <VibeContentRenderer content={`::${icon} className='${className || ''}'::`} />;
    }
    // If it's a component (like Lucide icons)
    const IconComponent = icon;
    return <IconComponent className={className} />;
  };

  return (
    <>
      <motion.header
        className={cn("fixed top-0 left-0 right-0 z-40 bg-black/80 border-b border-brand-purple/40 shadow-md backdrop-blur-md", "transition-transform duration-300 ease-in-out")}
        initial={{ y: 0 }} animate={{ y: isHeaderVisible ? 0 : "-100%" }} transition={{ type: "tween", duration: 0.3 }}
      >
        <div className="container mx-auto px-4 py-2.5 sm:py-3">
          <div className="flex items-center justify-between">
            <Link 
              href="/" 
              className={cn(
                "text-2xl md:text-3xl font-orbitron font-bold uppercase tracking-wider",
                "transition-all duration-300 hover:brightness-125 flex items-baseline" 
              )}
            >
              <span 
                className="text-neon-lime glitch" 
                data-text={logoCyberPart}
              >
                {logoCyberPart}
              </span>
              {logoVicePart && (
                <span className="gta-vibe-text-effect">
                  {logoVicePart}
                </span>
              )}
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
            transition={{ type: "tween", ease: "easeOut", duration: 0.3 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-lg overflow-y-auto pt-16 pb-10 px-4 md:pt-20 simple-scrollbar" 
          >
            <button
              onClick={() => setIsNavOpen(false)}
              className="fixed top-3 left-1/2 -translate-x-1/2 z-[51] p-2 text-brand-pink hover:text-brand-pink/80 focus:outline-none focus:ring-2 focus:ring-brand-pink focus:ring-offset-2 focus:ring-offset-black rounded-full transition-all duration-200 hover:bg-brand-pink/10" 
              aria-label={t("Close navigation")}
            ><X className="h-6 w-6 sm:h-7 sm:w-7" /></button>

            <div className="container mx-auto max-w-4xl xl:max-w-5xl mt-8"> 
              <div className="relative mb-6">
                <input
                  type="search" placeholder={t("Search pages...")} value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-dark-card/80 border-2 border-brand-cyan/50 rounded-lg text-foreground placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-cyan focus:border-transparent text-base font-mono shadow-md"
                  aria-label={t("Search pages...")}
                />
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-brand-cyan/70 pointer-events-none" />
              </div>
              
              <div className="space-y-6">
                {groupOrder.map(groupName => {
                  const pagesInGroup = groupedAndFilteredPages[groupName];
                  if (!pagesInGroup || pagesInGroup.length === 0) return null; 
                  
                  const groupIconName = groupIcons[groupName];

                  return (
                    <div key={groupName}>
                      <h3 className="text-lg font-orbitron text-brand-purple mb-3 flex items-center gap-2">
                        {groupIconName && <RenderIcon icon={groupIconName} className="w-6 h-6 opacity-80" />} 
                        {t(groupName)}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-2.5">
                        {pagesInGroup.map((page) => {
                          const isCurrentPage = page.path === pathname;
                          const tileBaseColorClass = tileColorClasses[page.color || 'default'];
                          const rgbVar = colorVarMap[page.color || 'default'];
                          const tileShadow = rgbVar ? `hover:shadow-[0_0_12px_2px_rgba(${rgbVar},0.4)]` : 'hover:shadow-xl';
                          
                          return (
                            <Link
                              key={page.path} href={page.path}
                              onClick={() => setIsNavOpen(false)}
                              className={cn(
                                "group relative flex flex-col items-center justify-center rounded-lg border-2 transition-all duration-200 aspect-square text-center hover:scale-[1.02] hover:-translate-y-0.5 shadow-md hover:shadow-lg",
                                "p-1.5", 
                                page.isImportant 
                                  ? "bg-gradient-to-br from-purple-800/40 via-black/60 to-blue-800/40 col-span-1 sm:col-span-2 shadow-lg hover:shadow-xl" 
                                  : "bg-dark-card/70 hover:bg-dark-card/90 col-span-1",
                                tileBaseColorClass, 
                                tileShadow, 
                                isCurrentPage ? `ring-2 ring-offset-2 ring-offset-black ${page.color === 'lime' || page.color === 'yellow' || page.color === 'orange' ? 'ring-black/80' : 'ring-white/90'}` : 'ring-transparent'
                              )}
                              title={page.translatedName}
                            >
                              {page.isHot && (
                                <span title={t("Hot")} className="absolute top-1 right-1 text-base text-brand-orange animate-pulse" aria-label={t("Hot")}>
                                  <VibeContentRenderer content="::FaFire::" />
                                </span>
                              )}
                              {page.icon && (
                                <RenderIcon 
                                    icon={page.icon} 
                                    className={cn(
                                        "transition-transform duration-200 group-hover:scale-110 mb-1.5", 
                                        page.isImportant 
                                            ? "h-7 w-7 sm:h-8 sm:w-8" 
                                            : "h-6 w-6 sm:h-7 sm:w-7" 
                                    )}
                                />
                              )}
                              <span className={cn(
                                "font-orbitron font-medium transition-colors leading-tight text-center block",
                                page.isImportant 
                                    ? "text-white text-[0.9rem] md:text-base" 
                                    : "text-light-text/90 group-hover:text-white text-xs md:text-sm" 
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