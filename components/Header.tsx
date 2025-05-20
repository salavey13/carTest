"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";
import { Menu, X, Search, ChevronDown, ChevronUp, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { UserProfile, CyberFitnessProfile } from '@/hooks/cyberFitnessSupabase';
import * as Fa6Icons from "react-icons/fa6"; 
import { iconNameMap } from "@/lib/iconNameMap";


interface PageInfo {
  path: string;
  name: string; 
  icon?: keyof typeof Fa6Icons | string; 
  group: string;
  isImportant?: boolean;
  isAdminOnly?: boolean;
  isUnavailable?: boolean;
  isHot?: boolean;
  color?: 'purple' | 'pink' | 'cyan' | 'orange' | 'yellow' | 'green' | 'blue' | 'lime' | 'red' | 'default';
  questId?: string; 
  isCompleted?: boolean;
  translatedName?: string;
}

const allPages: PageInfo[] = [
  // Vibe HQ
  { path: "/repo-xml", name: "SUPERVIBE Studio", icon: "FaWandMagicSparkles", group: "Vibe HQ", isImportant: true, color: "purple", isHot: true },
  { path: "/leads", name: "Leads HQ", icon: "FaCrosshairs", group: "Vibe HQ", isImportant: true, color: "orange", isHot: true },

  // Core Vibe
  { path: "/", name: "Home", icon: "FaBrain", group: "Core Vibe", isImportant: true, color: "cyan" },
  { path: "/selfdev", name: "SelfDev Path", icon: "FaRoad", group: "Core Vibe", isImportant: true, color: "green" },
  { path: "/p-plan", name: "VIBE Plan", icon: "FaUserNinja", group: "Core Vibe", isImportant: true, isHot: true, color: "yellow" },
  { path: "/game-plan", name: "Game Plan", icon: "FaFilm", group: "Core Vibe", isImportant: true, color: "orange", isHot: true },
  { path: "/selfdev/gamified", name: "CyberDev OS", icon: "FaGamepad", group: "Core Vibe", isImportant: true, color: "pink", isHot: true },
  
  // GTA Vibe Missions
  { path: "/tutorials/image-swap", name: "Image Swap Mission", icon: "FaArrowRightArrowLeft", group: "GTA Vibe Missions", isImportant: true, color: "green", isHot: true, questId: "image-swap-mission" }, 
  { path: "/tutorials/icon-swap", name: "Icon Demining Mission", icon: "FaBomb", group: "GTA Vibe Missions", isImportant: true, color: "red", isHot: true, questId: "icon-swap-mission" },
  { path: "/tutorials/video-swap", name: "Video Render Mission", icon: "FaVideo", group: "GTA Vibe Missions", isImportant: true, color: "cyan", isHot: true, questId: "video-swap-mission" },
  { path: "/tutorials/inception-swap", name: "Inception Swap Mission", icon: "FaInfinity", group: "GTA Vibe Missions", isImportant: true, color: "lime", isHot: true, questId: "inception-swap-mission" },
  { path: "/tutorials/fifth-door", name: "The Fifth Door Mission", icon: "FaDoorOpen", group: "GTA Vibe Missions", color: "purple", isHot: true, questId: "fifth-door-mission" },

  // CyberFitness
  { path: "/profile", name: "Agent Profile", icon: "FaUserSecret", group: "CyberFitness", color: "pink" },
  { path: "/os-upgrades", name: "OS Upgrades", icon: "FaArrowUpRightDots", group: "CyberFitness", color: "yellow" },
  { path: "/premium-modules", name: "Premium Modules", icon: "FaCubesStacked", group: "CyberFitness", color: "cyan"},
  { path: "/nutrition", name: "Vibe Schematics", icon: "FaToolbox", group: "CyberFitness", color: "orange"},
  { path: "/start-training", name: "Start Training", icon: "FaDumbbell", group: "CyberFitness", color: "green", isImportant: true},
  { path: "/settings", name: "System Config", icon: "FaGears", group: "CyberFitness", color: "blue" },  
  { path: "/partner", name: "Alliance Perks", icon: "FaUsers", group: "CyberFitness", color: "purple"}, 
  
  // Content & Tools
  { path: "/jumpstart", name: "Jumpstart Kit", icon: "FaRocket", group: "Content & Tools", isImportant: true, color: "lime" },
  { path: "/style-guide", name: "Style Guide", icon: "FaPalette", group: "Content & Tools", color: "blue" },
  { path: "/cyber-garage", name: "Cyber Garage", icon: "FaCar", group: "Content & Tools", color: "orange"},
  { path: "/bot-busters", name: "Bot Busters", icon: "FaGhost", group: "Content & Tools", isUnavailable: true, color: "red" },
  { path: "/bs-detector", name: "BS Detector", icon: "FaSearch", group: "Content & Tools", isUnavailable: true, color: "yellow" },
  { path: "/wheel-of-fortune", name: "Wheel of Fortune", icon: "FaBullseye", group: "Content & Tools", isUnavailable: true, color: "pink" },
  
  // Misc
  { path: "/invoices", name: "My Invoices", icon: "FaFileInvoiceDollar", group: "Misc", color: "green" },
  { path: "/donate", name: "Donate", icon: "FaHeart", group: "Misc", color: "pink" },
  { path: "/howto", name: "oneSitePls How-To", icon: "FaQuestionCircle", group: "Misc", color: "cyan" },
  { path: "/rent-a-car", name: "Rent a Car", icon: "FaCarSide", group: "Misc", color: "blue", isHot: true },
  { path: "/vpr/*", name: "VPR Tests", icon: "FaGraduationCap", group: "Misc", color: "purple", isHot: true },
  { path: "/geo-cheatsheet-6", name: "Geo Cheatsheet 6", icon: "FaGlobeAmericas", group: "Misc", color: "green"},
  { path: "/history-cheatsheet-6", name: "History Cheatsheet 6", icon: "FaLandmark", group: "Misc", color: "orange" },
  { path: "/biology-cheatsheet-6", name: "Biology Cheatsheet 6", icon: "FaDna", group: "Misc", color: "lime" },
  
  // Admin Zone
  { path: "/admin", name: "Admin Panel", icon: "FaUserShield", group: "Admin Zone", isAdminOnly: true, color: "red" },
  { path: "/uploadAdvice", name: "Upload Advice", icon: "FaUpload", group: "Admin Zone", isAdminOnly: true, color: "yellow" },
  { path: "/admin/fleet", name: "Fleet Admin", icon: "FaCaravan", group: "Admin Zone", isAdminOnly: true, color: "orange" },
  { path: "/youtubeAdmin", name: "YT Admin", icon: "FaYoutube", group: "Admin Zone", isAdminOnly: true, color: "red" },
];

const groupOrder = ["Vibe HQ", "Core Vibe", "GTA Vibe Missions", "CyberFitness", "Content & Tools", "Misc", "Admin Zone"];

const groupIcons: Record<string, keyof typeof Fa6Icons | undefined> = {
    "Vibe HQ": "FaStar",
    "Core Vibe": "FaBolt",
    "GTA Vibe Missions": "FaGamepad", 
    "CyberFitness": "FaDumbbell", 
    "Content & Tools": "FaToolbox", 
    "Misc": "FaLayerGroup",
    "Admin Zone": "FaUserCog" 
};

const translations: Record<string, Record<string, string>> = {
  en: {
    "Home": "Home", "SUPERVIBE Studio": "SUPERVIBE Studio", "Leads HQ": "Leads HQ", "SelfDev Path": "SelfDev Path", "VIBE Plan": "VIBE Plan", "Game Plan": "Game Plan", "CyberDev OS": "CyberDev OS", 
    "Image Swap Mission": "Image Swap Mission", "Icon Demining Mission": "Icon Demining Mission", "Video Render Mission": "Video Render Mission", "Inception Swap Mission": "Inception Swap Mission", "The Fifth Door Mission": "The Fifth Door Mission",
    "Agent Profile": "Agent Profile", "OS Upgrades": "OS Upgrades", "Premium Modules": "Premium Modules", 
    "Vibe Schematics": "Vibe Schematics", "Start Training": "Start Training", "System Config": "System Config", "Alliance Perks": "Alliance Perks",
    "Jumpstart Kit": "Jumpstart Kit", "Style Guide": "Style Guide", 
    "Cyber Garage": "Cyber Garage", "Bot Busters": "Bot Busters", "BS Detector": "BS Detector", "Wheel of Fortune": "Wheel of Fortune", "My Invoices": "My Invoices", "Donate": "Donate", "oneSitePls How-To": "oneSitePls How-To", "Rent a Car": "Rent a Car", "VPR Tests": "VPR Tests", "Geo Cheatsheet 6": "Geo Cheatsheet 6", "History Cheatsheet 6": "History Cheatsheet 6", "Biology Cheatsheet 6": "Biology Cheatsheet 6",
    "Admin Panel": "Admin Panel", "Upload Advice": "Upload Advice", "Fleet Admin": "Fleet Admin", "YT Admin": "YT Admin",
    "Search pages...": "Search pages...", "No pages found matching": "No pages found matching", "Admin Only": "Admin Only", "Toggle Language": "Toggle Language", "Open navigation": "Open navigation", "Close navigation": "Close navigation", "Hot": "Hot",
    "Vibe HQ": "Vibe HQ", "Core Vibe": "Core Vibe", "GTA Vibe Missions": "GTA Vibe Missions", "CyberFitness": "CyberFitness", "Content & Tools": "Content & Tools", "Misc": "Misc", "Admin Zone": "Admin Zone"
  },
  ru: {
    "Home": "Главная", "SUPERVIBE Studio": "SUPERVIBE Studio", "Leads HQ": "КОЦ 'Дозор'", "SelfDev Path": "Путь SelfDev", "VIBE Plan": "VIBE План", "Game Plan": "Гейм План", "CyberDev OS": "CyberDev OS",
    "Image Swap Mission": "Миссия: Битый Пиксель", "Icon Demining Mission": "Миссия: Сапёр Иконок", "Video Render Mission": "Миссия: Видео-Рендер", "Inception Swap Mission": "Миссия: Inception Swap", "The Fifth Door Mission": "Миссия: Пятая Дверь",
    "Agent Profile": "Профиль Агента", "OS Upgrades": "Апгрейды ОС", "Premium Modules": "Премиум Модули", 
    "Vibe Schematics": "Схемы Вайба", "Start Training": "Начать Тренировку", "System Config": "Настройки Системы", "Alliance Perks": "Бонусы Альянса",
    "Jumpstart Kit": "Jumpstart Kit", "Style Guide": "Стайлгайд",
    "Cyber Garage": "Кибер Гараж", "Bot Busters": "Охотники за Ботами", "BS Detector": "BS Детектор", "Wheel of Fortune": "Колесо Фортуны", "My Invoices": "Мои Счета", "Donate": "Поддержать", "oneSitePls How-To": "Как юзать oneSitePls", "Rent a Car": "Аренда Авто", "VPR Tests": "ВПР Тесты", "Geo Cheatsheet 6": "Шпаргалка Гео 6", "History Cheatsheet 6": "Шпаргалка Ист 6", "Biology Cheatsheet 6": "Шпаргалка Био 6",
    "Admin Panel": "Админ Панель", "Upload Advice": "Загрузить Совет", "Fleet Admin": "Админ Автопарка", "YT Admin": "Админ YT",
    "Search pages...": "Поиск страниц...", "No pages found matching": "Страницы не найдены по запросу", "Admin Only": "Только для админа", "Toggle Language": "Переключить язык", "Open navigation": "Открыть навигацию", "Close navigation": "Закрыть навигацию", "Hot": "🔥",
    "Vibe HQ": "Vibe HQ", "Core Vibe": "Ядро Вайба", "GTA Vibe Missions": "GTA Vibe Миссии", "CyberFitness": "КиберФитнес", "Content & Tools": "Контент и Тулзы", "Misc": "Разное", "Admin Zone": "Зона Админа"
  }
};

const tileColorClasses: Record<string, { border: string, shadow: string, text?: string, bg?: string }> = {
  purple: { border: "border-brand-purple/70", shadow: "hover:shadow-[0_0_15px_rgba(133,76,222,0.5)]", text: "text-brand-purple" },
  pink: { border: "border-brand-pink/70", shadow: "hover:shadow-[0_0_15px_rgba(245,100,169,0.5)]", text: "text-brand-pink" },
  cyan: { border: "border-brand-cyan/70", shadow: "hover:shadow-[0_0_15px_rgba(52,211,232,0.5)]", text: "text-brand-cyan" },
  orange: { border: "border-brand-orange/70", shadow: "hover:shadow-[0_0_15px_rgba(255,108,0,0.5)]", text: "text-brand-orange" },
  yellow: { border: "border-brand-yellow/70", shadow: "hover:shadow-[0_0_15px_rgba(255,217,74,0.5)]", text: "text-brand-yellow" },
  green: { border: "border-brand-green/70", shadow: "hover:shadow-[0_0_15px_rgba(76,175,80,0.5)]", text: "text-brand-green" },
  blue: { border: "border-brand-blue/70", shadow: "hover:shadow-[0_0_15px_rgba(74,144,226,0.5)]", text: "text-brand-blue" },
  lime: { border: "border-brand-lime/70", shadow: "hover:shadow-[0_0_15px_rgba(169,216,107,0.5)]", text: "text-brand-lime" },
  red: { border: "border-destructive/70", shadow: "hover:shadow-[0_0_15px_rgba(217,74,74,0.5)]", text: "text-destructive" },
  default: { border: "border-border/70", shadow: "hover:shadow-md" },
};

const RenderIconFromPage = ({ icon, className }: { icon?: keyof typeof Fa6Icons | string; className?: string }) => {
  if (!icon) return null;
  const IconComponent = isValidFa6Icon(icon as string) ? Fa6Icons[icon as keyof typeof Fa6Icons] : null;
  if (IconComponent) {
    return <IconComponent className={cn("gta-icon-fix", className)} />;
  }
  // Fallback for string names that might be in iconNameMap or ::faSyntax::
  return <VibeContentRenderer content={`::${icon}::`} className={className} />;
};

function isValidFa6Icon(iconName: string): iconName is keyof typeof Fa6Icons {
  return typeof iconName === 'string' && iconName.startsWith('Fa') && iconName in Fa6Icons;
}

export default function Header() {
  const { 
    userProfile, cyberFitnessProfile, profileLoading, isAdmin,
    language, toggleLanguage, 
    completedQuests, globalHeaderSettings 
  } = useAppContext();
  const pathname = usePathname();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  const t = useCallback((key: string) => {
    return translations[language][key] || translations['en'][key] || key;
  }, [language]);

  useEffect(() => {
    setIsMounted(true);
    document.documentElement.style.setProperty('--header-height', globalHeaderSettings.isSticky ? (window.innerWidth < 640 ? '60px' : '70px') : '0px');
    return () => {
      document.documentElement.style.setProperty('--header-height', '0px'); // Reset on unmount
    };
  }, [globalHeaderSettings.isSticky]);
  
  useEffect(() => {
    if (isNavOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isNavOpen]);

  const processedPages = useMemo(() => {
    return allPages
      .filter(page => !page.isAdminOnly || (page.isAdminOnly && isAdmin))
      .map(page => ({
        ...page,
        translatedName: t(page.name),
        isCompleted: page.questId ? completedQuests.includes(page.questId) : undefined,
      }))
      .sort((a, b) => {
        if (a.isImportant && !b.isImportant) return -1;
        if (!a.isImportant && b.isImportant) return 1;
        return (a.translatedName || a.name).localeCompare(b.translatedName || b.name);
      });
  }, [isAdmin, t, completedQuests]);

  const filteredAndSortedPages = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    if (!lowerSearchTerm) return processedPages;
    return processedPages.filter(page =>
      (page.translatedName || page.name).toLowerCase().includes(lowerSearchTerm) ||
      page.path.toLowerCase().includes(lowerSearchTerm) ||
      t(page.group).toLowerCase().includes(lowerSearchTerm)
    );
  }, [searchTerm, processedPages, t]);

  const groupedAndFilteredPages = useMemo(() => {
    const groups: Record<string, PageInfo[]> = {};
    filteredAndSortedPages.forEach(page => {
      if (!groups[page.group]) {
        groups[page.group] = [];
      }
      groups[page.group].push(page);
    });
    return groups;
  }, [filteredAndSortedPages]);

  if (!isMounted) {
    return (
      <header className={cn(
          "bg-black/80 backdrop-blur-md text-foreground fixed top-0 left-0 right-0 z-40 transition-all duration-300 ease-out border-b border-border/30",
          globalHeaderSettings.isSticky ? "translate-y-0" : "-translate-y-full",
          globalHeaderSettings.isTransparent && pathname === '/' && !isNavOpen ? "bg-transparent border-transparent" : "bg-black/80 border-border/30"
        )}
        style={{ height: 'var(--header-height)' }}
      >
        <div className="container mx-auto px-4 h-full flex justify-between items-center">
          {/* Placeholder for logo or site name */}
          <Link href="/" className="text-xl font-orbitron font-bold text-brand-cyan hover:text-brand-pink transition-colors gta-vibe-text-effect gta-vibe-text-cyan">
            oneSitePls
          </Link>
          {/* Placeholder for navigation toggle */}
          <div className="h-8 w-8 bg-gray-700 rounded sm:hidden"></div>
          <div className="hidden sm:flex h-8 w-20 bg-gray-700 rounded"></div>
        </div>
      </header>
    );
  }
  
  const currentTitle = processedPages.find(p => p.path === pathname)?.translatedName || "oneSitePls";

  return (
    <>
      <header 
        className={cn(
          "bg-black/80 backdrop-blur-md text-foreground fixed top-0 left-0 right-0 z-40 transition-all duration-300 ease-out border-b",
          globalHeaderSettings.isSticky && !isNavOpen ? "translate-y-0" : "-translate-y-full",
          globalHeaderSettings.isTransparent && pathname === '/' && !isNavOpen ? "bg-transparent border-transparent" : "bg-black/80 border-border/30"
        )}
        style={{ height: 'var(--header-height)' }}
      >
        <div className="container mx-auto px-4 h-full flex justify-between items-center">
          <Link href="/" className="text-lg sm:text-xl font-orbitron font-bold text-brand-cyan hover:text-brand-pink transition-colors gta-vibe-text-effect gta-vibe-text-cyan">
             {currentTitle === "oneSitePls" ? "oneSitePls" : <VibeContentRenderer content={`::${allPages.find(p=>p.path === pathname)?.icon || "FaHome"}:: ${currentTitle}`} />}
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="icon" onClick={toggleLanguage} aria-label={t("Toggle Language")} className="text-brand-yellow hover:text-yellow-300 hover:bg-yellow-400/10 w-8 h-8 sm:w-9 sm:h-9">
              {language === 'ru' ? 'RU' : 'EN'}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setIsNavOpen(!isNavOpen)} aria-label={t("Open navigation")} className="text-brand-pink hover:text-pink-300 hover:bg-pink-500/10 w-8 h-8 sm:w-9 sm:h-9">
              {isNavOpen ? <X className="h-5 w-5 sm:h-6 sm:w-6" /> : <Menu className="h-5 w-5 sm:h-6 sm:w-6" />}
            </Button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isNavOpen && (
          <motion.div
            initial={{ opacity: 0, clipPath: 'circle(0% at calc(100% - 3rem) 3rem)' }}
            animate={{ opacity: 1, clipPath: 'circle(150% at calc(100% - 3rem) 3rem)' }}
            exit={{ opacity: 0, clipPath: 'circle(0% at calc(100% - 3rem) 3rem)' }}
            transition={{ type: "tween", ease: "easeOut", duration: 0.3 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-lg overflow-y-auto pt-16 md:pt-20 pb-10 px-4 simple-scrollbar max-h-[85vh] sm:max-h-screen" 
          >
            <button
              onClick={() => setIsNavOpen(false)}
              className="fixed top-3 left-1/2 -translate-x-1/2 z-[51] p-1.5 sm:p-2 text-brand-pink hover:text-brand-pink/80 focus:outline-none focus:ring-2 focus:ring-brand-pink focus:ring-offset-2 focus:ring-offset-black rounded-full transition-all duration-200 hover:bg-brand-pink/10" 
              aria-label={t("Close navigation")}
            ><X className="h-5 w-5 sm:h-6 sm:w-6" /></button>

            <div className="container mx-auto max-w-4xl xl:max-w-5xl mt-4 sm:mt-8"> 
              <div className="relative mb-4 sm:mb-6">
                <input
                  type="search" placeholder={t("Search pages...")} value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 bg-dark-card/80 border-2 border-brand-cyan/50 rounded-lg text-foreground placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-cyan focus:border-transparent text-sm sm:text-base font-mono shadow-md"
                  aria-label={t("Search pages...")}
                />
                <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-brand-cyan/70 pointer-events-none" />
              </div>
              
              <div className="space-y-4 sm:space-y-6">
                {profileLoading && <div className="text-center text-brand-cyan font-mono"><VibeContentRenderer content="::FaSpinner className='animate-spin':: Загрузка профиля агента..."/></div>}
                {!profileLoading && groupOrder.map(groupName => {
                  const pagesInGroup = groupedAndFilteredPages[groupName];
                  if (!pagesInGroup || pagesInGroup.length === 0) return null;

                  const groupIconKey = groupIcons[groupName] as keyof typeof Fa6Icons | undefined;
                  const IconComponent = groupIconKey ? Fa6Icons[groupIconKey] : null;
                  const isGtaVibeGroup = groupName === "GTA Vibe Missions";
                  const isVibeHQGroup = groupName === "Vibe HQ";


                  return (
                    <div key={groupName}>
                       <h3 className={cn(
                        "text-lg sm:text-xl font-orbitron mb-2 sm:mb-3 flex items-center gap-x-2 sm:gap-x-2.5 justify-center py-1.5 sm:py-2",
                        "gta-vibe-text-effect"
                        )}>
                        {IconComponent && (
                          <IconComponent className={cn("w-5 h-5 sm:w-6 sm:h-6 gta-icon-fix", tileColorClasses[isGtaVibeGroup ? 'pink' : (isVibeHQGroup ? 'yellow' : 'purple')]?.text || 'text-brand-cyan')} />
                        )}
                        <span>{t(groupName)}</span>
                        {IconComponent && (isGtaVibeGroup || isVibeHQGroup) && ( 
                           <IconComponent className={cn("w-5 h-5 sm:w-6 sm:h-6 gta-icon-fix", tileColorClasses[isGtaVibeGroup ? 'pink' : (isVibeHQGroup ? 'yellow' : 'purple')]?.text || 'text-brand-cyan')} />
                        )}
                      </h3>
                      <div className={cn(
                        "grid gap-1.5 sm:gap-2 md:gap-2.5",
                        "grid-cols-2", // Base for smallest screens
                        "sm:grid-cols-2", // Small screens
                        "md:grid-cols-3", // Medium screens
                        "lg:grid-cols-4", // Large screens
                        "xl:grid-cols-5", // Extra large screens
                        "2xl:grid-cols-6"  // 2XL screens
                      )}>
                        {pagesInGroup.map((page) => {
                          const isCurrentPage = page.path === pathname;
                          const tileBaseColorClass = tileColorClasses[page.color || 'default'];
                          const tileBorder = page.isCompleted ? "border-green-500" : (isCurrentPage ? `border-brand-${page.color || 'cyan'}` : tileBaseColorClass.border);
                          const tileShadow = isCurrentPage ? `shadow-[0_0_20px_var(--${page.color || 'cyan'}-glow-color)]` : tileBaseColorClass.shadow;
                          
                          return (
                            <Link
                              key={page.path}
                              href={page.path}
                              onClick={() => setIsNavOpen(false)}
                              className={cn(
                                "group relative flex flex-col items-center justify-center rounded-lg border-2 transition-all duration-200 aspect-square text-center hover:scale-[1.02] hover:-translate-y-0.5 shadow-md hover:shadow-lg",
                                "p-1 sm:p-1.5", 
                                page.isImportant && groupName === "Vibe HQ" ? "col-span-2" : // Vibe HQ important links take full width on smallest
                                page.isImportant ? "sm:col-span-2 col-span-1" : "col-span-1", // Other important links take more space on sm+
                                page.isImportant 
                                  ? "bg-gradient-to-br from-purple-800/40 via-black/60 to-blue-800/40 shadow-lg hover:shadow-xl" 
                                  : "bg-dark-card/70 hover:bg-dark-card/90",
                                tileBaseColorClass.bg,
                                tileBorder, 
                                tileShadow, 
                                page.isUnavailable ? "opacity-50 cursor-not-allowed pointer-events-none" : "opacity-100"
                              )}
                              title={page.translatedName}
                            >
                              {page.isHot && (
                                <span title={t("Hot")} className="absolute top-0.5 sm:top-1 right-0.5 sm:right-1 text-sm sm:text-base text-brand-orange animate-pulse" aria-label={t("Hot")}>
                                  <VibeContentRenderer content="::FaFire::" />
                                </span>
                              )}
                              {page.icon && (
                                <RenderIconFromPage 
                                    icon={page.icon} 
                                    className={cn(
                                        "transition-transform duration-200 group-hover:scale-110 mb-1 sm:mb-1.5", 
                                        page.isImportant 
                                            ? "h-6 w-6 sm:h-7 sm:h-7 md:h-8 md:w-8" 
                                            : "h-5 w-5 sm:h-6 sm:h-6 md:h-7 md:w-7" 
                                    )}
                                />
                              )}
                              <span className={cn(
                                "font-orbitron font-medium transition-colors leading-tight text-center block",
                                page.isImportant 
                                    ? "text-white text-[0.75rem] sm:text-[0.85rem] md:text-base" 
                                    : "text-light-text/90 group-hover:text-white text-[0.65rem] sm:text-xs md:text-sm" 
                              )}>
                                {page.translatedName}
                              </span>
                              {page.isAdminOnly && (
                                <span title={t("Admin Only")} className="absolute bottom-0.5 sm:bottom-1 right-0.5 sm:right-1 text-[0.6rem] sm:text-[0.65rem] text-red-400/80 bg-black/60 rounded-full px-0.5 sm:px-1 py-0.5 leading-none">
                                  ADMIN
                                </span>
                              )}
                               {page.isCompleted && (
                                <CheckCircle className="absolute top-1 left-1 h-4 w-4 text-green-400" title="Quest Completed"/>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                      {groupOrder.indexOf(groupName) < groupOrder.length -1 && Object.values(groupedAndFilteredPages).filter(g => g && g.length > 0).indexOf(pagesInGroup) < Object.values(groupedAndFilteredPages).filter(g => g && g.length > 0).length -1 && (
                        <hr className="my-3 sm:my-4 border-gray-700/50"/>
                      )}
                    </div>
                  );
                })}
                {!profileLoading && Object.values(groupedAndFilteredPages).every(g => !g || g.length === 0) && (
                  <p className="text-center text-gray-500 text-xs sm:text-sm md:text-base mt-4 sm:mt-6 md:mt-8 font-mono">
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