"use client";

import Link from "next/link";
import { LayoutGrid, X, Search, Globe, Rocket, ShieldCheck } from "lucide-react";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import UserInfo from "@/components/user-info";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { debugLogger as logger } from "@/lib/debugLogger";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import {
    QUEST_ORDER,
    fetchUserCyberFitnessProfile,
    isQuestUnlocked as checkQuestUnlockedFromHook,
    CyberFitnessProfile
} from '@/hooks/cyberFitnessSupabase';

// --- Types ---
type ColorKey = 'purple' | 'blue' | 'yellow' | 'lime' | 'green' | 'pink' | 'cyan' | 'red' | 'orange' | 'gray';

interface PageInfo {
  path: string;
  name: string; // Translation key
  icon?: string;
  isImportant?: boolean;
  isAdminOnly?: boolean;
  isHot?: boolean;
  color?: ColorKey;
  group?: string; // Translation key
  translatedName?: string; 
  questId?: string;
  minLevel?: number;
  supportOnly?: boolean;
}

// --- PAGE DATA (The Map of the City) ---
const allPages: PageInfo[] = [
  // Vibe HQ
  { path: "/repo-xml", name: "SUPERVIBE Studio", icon: "FaWandMagicSparkles", group: "Vibe HQ", isImportant: true, color: "purple", isHot: true, minLevel: 1 },
  { path: "/nexus", name: "VIBE NEXUS", icon: "FaNetworkWired", group: "Vibe HQ", isImportant: true, color: "orange", isHot: true, minLevel: 0 }, 
  { path: "/leads", name: "Leads HQ", icon: "FaCrosshairs", group: "Vibe HQ", isImportant: true, color: "orange", isHot: true, minLevel: 2, supportOnly: true },
  { path: "/hotvibes", name: "Hot Vibes", icon: "FaFire", group: "Vibe HQ", isImportant: true, color: "red", isHot: true, minLevel: 0 },

  // Core Vibe
  { path: "/", name: "Home", icon: "FaBrain", group: "Core Vibe", isImportant: true, color: "cyan", minLevel: 0 },
  { path: "/selfdev", name: "SelfDev Path", icon: "FaRoad", group: "Core Vibe", isImportant: true, color: "green", minLevel: 0 },
  { path: "/p-plan", name: "VIBE Plan", icon: "FaUserNinja", group: "Core Vibe", isImportant: true, isHot: true, color: "yellow", minLevel: 1 },
  { path: "/game-plan", name: "Game Plan", icon: "FaFilm", group: "Core Vibe", isImportant: true, color: "orange", isHot: true, minLevel: 1 },
  { path: "/selfdev/gamified", name: "CyberDev OS", icon: "FaGamepad", group: "Core Vibe", isImportant: true, color: "pink", isHot: true, minLevel: 0 },
  { path: "/cybervibe", name: "CyberVibe Upgrade", icon: "FaBolt", group: "Core Vibe", isImportant: true, color: "yellow", isHot: true, minLevel: 2 },
  { path: "/wblanding", name: "WB Logistics", icon: "FaBoxOpen", group: "Core Vibe", isImportant: true, color: "blue", minLevel: 0 },

  // GTA Vibe Missions
  { path: "/start-training", name: "Start Training", icon: "FaDumbbell", group: "GTA Vibe Missions", color: "green", isImportant: true, minLevel: 0},
  { path: "/tutorials/image-swap", name: "Image Swap Mission", icon: "FaArrowRightArrowLeft", group: "GTA Vibe Missions", isImportant: true, color: "green", isHot: true, questId: "image-swap-mission" },
  { path: "/tutorials/icon-swap", name: "Icon Demining Mission", icon: "FaBomb", group: "GTA Vibe Missions", isImportant: true, color: "red", isHot: true, questId: "icon-swap-mission" },
  { path: "/tutorials/video-swap", name: "Video Render Mission", icon: "FaVideo", group: "GTA Vibe Missions", isImportant: true, color: "cyan", isHot: true, questId: "video-swap-mission" },
  { path: "/tutorials/inception-swap", name: "Inception Swap Mission", icon: "FaInfinity", group: "GTA Vibe Missions", isImportant: true, color: "lime", isHot: true, questId: "inception-swap-mission" },
  { path: "/tutorials/the-fifth-door", name: "The Fifth Door Mission", icon: "FaKey", group: "GTA Vibe Missions", isImportant: true, color: "yellow", isHot: true, questId: "the-fifth-door-mission" },

  // CyberFitness
  { path: "/profile", name: "Agent Profile", icon: "FaCircleUser", group: "CyberFitness", color: "pink", minLevel: 0 },
  { path: "/buy-subscription", name: "OS Upgrades", icon: "FaCreditCard", group: "CyberFitness", color: "green", minLevel: 1 },
  { path: "/premium", name: "Premium Modules", icon: "FaStar", group: "CyberFitness", color: "yellow", minLevel: 3 },
  { path: "/nutrition", name: "Vibe Schematics", icon: "FaToolbox", group: "CyberFitness", color: "orange", minLevel: 1},
  { path: "/settings", name: "System Config", icon: "FaGears", group: "CyberFitness", color: "blue", minLevel: 1 },
  { path: "/partner", name: "Alliance Perks", icon: "FaUsers", group: "CyberFitness", color: "purple", minLevel: 2},

  // Content & Tools
  { path: "/jumpstart", name: "Jumpstart Kit", icon: "FaRocket", group: "Content & Tools", isImportant: true, color: "lime", minLevel: 0 },
  { path: "/purpose-profit", name: "Purpose & Profit", icon: "FaBookOpen", group: "Content & Tools", color: "purple", minLevel: 0 },
  { path: "/ai-work-future", name: "AI & Future of Work", icon: "FaNetworkWired", group: "Content & Tools", color: "cyan", minLevel: 0 },
  { path: "/advice", name: "Advice Archive", icon: "FaRegLightbulb", group: "Content & Tools", color: "orange", minLevel: 0 },
  { path: "/expmind", name: "Experimental Mindset", icon: "FaBrain", group: "Content & Tools", color: "pink", minLevel: 0 },
  { path: "/veritasium", name: "Veritasium Insights", icon: "FaBookAtlas", group: "Content & Tools", color: "cyan", isImportant: true, isHot: true, minLevel: 0 },
  { path: "/style-guide", name: "Style Guide", icon: "FaPalette", group: "Content & Tools", color: "lime", minLevel: 0 },
  { path: "/onesitepls", name: "oneSitePls Info", icon: "FaCircleInfo", group: "Content & Tools", color: "gray", minLevel: 0 },
  { path: "/finance-literacy-memo", name: "Finance Literacy Memo", icon: "FaDollarSign", group: "Content & Tools", color: "green", minLevel: 0},
  
  // Misc
  { path: "/rent-bike", name: "Cyber Garage", icon: "FaMotorcycle", group: "Misc", color: "blue", minLevel: 0 },
  { path: "/crews", name: "Crews", icon: "FaUsers", group: "Misc", color: "green", minLevel: 0 },
  { path: "/paddock", name: "My Paddock", icon: "FaWarehouse", group: "Misc", color: "orange", minLevel: 0, isAdminOnly: true },
  { path: "/botbusters", name: "Bot Busters", icon: "FaRobot", group: "Misc", color: "blue", minLevel: 0},
  { path: "/bullshitdetector", name: "BS Detector", icon: "FaMagnifyingGlass", group: "Misc", color: "yellow", minLevel: 0 },
  { path: "/wheel-of-fortune", name: "Wheel of Fortune", icon: "FaGift", group: "Misc", color: "lime", minLevel: 0 },
  { path: "/invoices", name: "My Invoices", icon: "FaFileInvoiceDollar", group: "Misc", color: "green", minLevel: 1 },
  { path: "/donate", name: "Donate", icon: "FaHeart", group: "Misc", color: "red", minLevel: 0 },
  { path: "/onesiteplsinstructions", name: "oneSitePls How-To", icon: "FaListCheck", group: "Misc", color: "gray", minLevel: 0 },
  { path: "/rent-car", name: "Rent a Car", icon: "FaCarOn", group: "Misc", color: "yellow", minLevel: 0 },
  { path: "/vpr-tests", name: "VPR Tests", icon: "FaListCheck", group: "Misc", color: 'pink', minLevel: 0, isImportant: true },
  { path: "/vpr/geography/6/cheatsheet", name: "Geo Cheatsheet 6", icon: "FaGlobe", group: "Misc", color: 'green', minLevel: 0 },
  { path: "/vpr/history/6/cheatsheet", name: "History Cheatsheet 6", icon: "FaLandmarkDome", group: "Misc", color: 'yellow', minLevel: 0 },
  { path: "/vpr/biology/6/cheatsheet", name: "Biology Cheatsheet 6", icon: "FaLeaf", group: "Misc", color: 'lime', minLevel: 0 },
  { path: "/vpr/informatics/7/cheatsheet", name: "Informatics Cheat", icon: "FaTerminal", group: "Misc", color: 'cyan', minLevel: 0 },
  { path: "/topdf", name: "XLSX-2-PDF Converter", icon: "FaFilePdf", group: "Misc", color: "red", isHot: true, minLevel: 0 },

  // Admin Zone
  { path: "/admin", name: "Admin Panel", icon: "FaUserShield", group: "Admin Zone", isAdminOnly: true, color: "red", minLevel: 0 },
  { path: "/arbitrage-test-agent", name: "Alpha Engine Deck", icon: "FaTerminal", group: "Admin Zone", isAdminOnly: true, color: "red", minLevel: 0 },
  { path: "/arbitrage-live-scanner", name: "Live Seeker", icon: "FaMagnifyingGlassDollar", group: "Admin Zone", isAdminOnly: true, color: "orange", minLevel: 0},
  { path: "/advice-upload", name: "Upload Advice", icon: "FaUpload", group: "Admin Zone", isAdminOnly: true, color: "red", minLevel: 0 },
  { path: "/shadow-fleet-admin", name: "Fleet Admin", icon: "FaCarOn", group: "Admin Zone", isAdminOnly: true, color: "red", minLevel: 0 },
  { path: "/youtubeAdmin", name: "YT Admin", icon: "FaYoutube", group: "Admin Zone", isAdminOnly: true, color: "red", minLevel: 0 },
];

const groupOrder = ["Vibe HQ", "Core Vibe", "GTA Vibe Missions", "CyberFitness", "Content & Tools", "Misc", "Admin Zone"];

// --- Styles & Colors ---
const tileColorClasses: Record<ColorKey | 'default', string> = {
  purple: "border-brand-purple/50 text-brand-purple hover:bg-brand-purple/10",
  blue: "border-brand-blue/50 text-brand-blue hover:bg-brand-blue/10",
  yellow: "border-brand-gold/50 text-brand-gold hover:bg-brand-gold/10",
  lime: "border-neon-lime/50 text-neon-lime hover:bg-neon-lime/10",
  green: "border-brand-green/50 text-brand-green hover:bg-brand-green/10",
  pink: "border-brand-pink/50 text-brand-pink hover:bg-brand-pink/10",
  cyan: "border-brand-cyan/50 text-brand-cyan hover:bg-brand-cyan/10",
  red: "border-destructive/50 text-destructive hover:bg-destructive/10",
  orange: "border-brand-red-orange/50 text-brand-red-orange hover:bg-brand-red-orange/10",
  gray: "border-muted/50 text-muted-foreground hover:bg-muted/10",
  default: "border-border text-foreground hover:bg-accent/10"
};

// --- Translations ---
const translations: Record<string, Record<string, string>> = {
  en: {
    "VIBE NEXUS": "VIBE NEXUS",
    "Informatics Cheat": "Informatics Cheatsheet",
    "WB Logistics": "WB Logistics",
    "Home": "Home", "SUPERVIBE Studio": "SUPERVIBE Studio", "Leads HQ": "Leads HQ", "Hot Vibes": "Hot Vibes",
    "SelfDev Path": "SelfDev Path", "VIBE Plan": "VIBE Plan", "Game Plan": "Game Plan", "CyberDev OS": "CyberDev OS", "CyberVibe Upgrade": "CyberVibe Upgrade",
    "Start Training": "Start Training", "Image Swap Mission": "Image Swap Mission", "Icon Demining Mission": "Icon Demining Mission", "Video Render Mission": "Video Render Mission", "Inception Swap Mission": "Inception Swap Mission", "The Fifth Door Mission": "The Fifth Door Mission",
    "Agent Profile": "Agent Profile", "OS Upgrades": "OS Upgrades", "My Paddock": "My Paddock", "Premium Modules": "Premium Modules",
    "Vibe Schematics": "Vibe Schematics", "System Config": "System Config", "Alliance Perks": "Alliance Perks",
    "Jumpstart Kit": "Jumpstart Kit", "Purpose & Profit": "Purpose & Profit", "AI & Future of Work": "AI & Future of Work", "Advice Archive": "Advice Archive", "Experimental Mindset": "Experimental Mindset", "Veritasium Insights": "Veritasium Insights", "Style Guide": "Style Guide", "oneSitePls Info": "oneSitePls Info", "Finance Literacy Memo": "Finance Literacy Memo", "XLSX-2-PDF Converter": "XLSX-2-PDF Converter",
    "Cyber Garage": "Cyber Garage", "Crews": "Crews", "Bot Busters": "Bot Busters", "BS Detector": "BS Detector", "Wheel of Fortune": "Wheel of Fortune", "My Invoices": "My Invoices", "Donate": "Donate", "oneSitePls How-To": "oneSitePls How-To", "Rent a Car": "Rent a Car", "VPR Tests": "VPR Tests", "Geo Cheatsheet 6": "Geo Cheatsheet 6", "History Cheatsheet 6": "History Cheatsheet 6", "Biology Cheatsheet 6": "Biology Cheatsheet 6",
    "Admin Panel": "Admin Panel", "Alpha Engine Deck": "Alpha Engine Deck", "Upload Advice": "Upload Advice", "Fleet Admin": "Fleet Admin", "YT Admin": "YT Admin",
    "Search pages...": "Search pages...", "No pages found matching": "No pages found matching", "Admin Only": "Admin Only", "Toggle Language": "Toggle Language", "Open navigation": "Open navigation", "Close navigation": "Close navigation", "Hot": "Hot", "Missions": "Missions",
    "Vibe HQ": "Vibe HQ", "Core Vibe": "Core Vibe", "GTA Vibe Missions": "GTA Vibe Missions", "CyberFitness": "CyberFitness", "Content & Tools": "Content & Tools", "Misc": "Misc", "Admin Zone": "Admin Zone",
    "Live Seeker": "Live Seeker"
  },
  ru: {
    "VIBE NEXUS": "VIBE NEXUS",
    "Informatics Cheat": "Информатика Шпора",
    "WB Logistics": "WB Логистика",
    "Alpha Engine Deck": "Пульт Альфа-Движка",
    "Live Seeker": "Live-Искатель",
    "Home": "Главная", "SUPERVIBE Studio": "SUPERVIBE Studio", "Leads HQ": "КОЦ 'Дозор'", "Hot Vibes": "Горячие Вайбы",
    "SelfDev Path": "Путь SelfDev", "VIBE Plan": "VIBE План", "Game Plan": "Гейм План", "CyberDev OS": "CyberDev OS", "CyberVibe Upgrade": "КиберВайб Апгрейд",
    "Start Training": "Начать Тренировку", "Image Swap Mission": "Миссия: Битый Пиксель", "Icon Demining Mission": "Миссия: Сапёр Иконок", "Video Render Mission": "Миссия: Видео-Рендер", "Inception Swap Mission": "Миссия: Inception Swap", "The Fifth Door Mission": "Миссия: Пятая Дверь",
    "Agent Profile": "Профиль Агента", "OS Upgrades": "Апгрейды ОС", "My Paddock": "Мой Паддок", "Premium Modules": "Премиум Модули",
    "Vibe Schematics": "Схемы Вайба", "System Config": "Настройки Системы", "Alliance Perks": "Бонусы Альянса",
    "Jumpstart Kit": "Jumpstart Kit", "Purpose & Profit": "Цель и Прибыль", "AI & Future of Work": "AI и Будущее Работы", "Advice Archive": "Архив Советов", "Experimental Mindset": "Эксперим. Мышление", "Озарения Veritasium": "Veritasium Insights", "Style Guide": "Гайд по Стилю", "oneSitePls Info": "Инфо oneSitePls", "Finance Literacy Memo": "Памятка Фин. Грамотности", "XLSX-2-PDF Converter": "XLSX-2-PDF Конвертер",
    "Cyber Garage": "Кибер Гараж", "Crews": "Экипажи", "Bot Busters": "Охотники за Ботами", "BS Detector": "BS Детектор", "Wheel of Fortune": "Колесо Фортуны", "My Invoices": "Мои Счета", "Donate": "Donate", "oneSitePls How-To": "Как юзать oneSitePls", "Rent a Car": "Аренда Авто", "VPR Tests": "ВПР Тесты", "Geo Cheatsheet 6": "Шпаргалка Гео 6", "History Cheatsheet 6": "Шпаргалка Ист 6", "Biology Cheatsheet 6": "Шпаргалка Био 6",
    "Admin Panel": "Админ Панель", "Alpha Engine Deck": "Пульт Альфа-Движка", "Upload Advice": "Загрузить Совет", "Fleet Admin": "Админ Автопарка", "YT Admin": "Админ YT",
    "Search pages...": "Поиск страниц...", "No pages found matching": "Страницы не найдены по запросу", "Admin Only": "Только для админа", "Toggle Language": "Переключить язык", "Open navigation": "Открыть навигацию", "Close navigation": "Закрыть навигацию", "Hot": "🔥", "Missions": "Миссии",
    "Vibe HQ": "Штаб Vibe", "Core Vibe": "Ядро", "GTA Vibe Missions": "GTA Миссии", "CyberFitness": "КиберФитнес", "Content & Tools": "Инструменты", "Misc": "Разное", "Admin Zone": "Админка"
  }
};

const RenderIconFromPage = React.memo(({ icon, className }: { icon?: string; className?: string }) => {
  if (!icon) return null;
  const iconString = icon.startsWith("::") ? icon : `::${icon}::`;
  return <VibeContentRenderer content={iconString} className={className || ''} />;
});
RenderIconFromPage.displayName = "RenderIconFromPage";

const gridContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.02, delayChildren: 0.05 }, // Faster animation
  },
};

const tileItemVariants = {
  hidden: { y: 10, opacity: 0, scale: 0.95 },
  visible: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 200, damping: 15 },
  },
};

const MotionLink = motion(Link);

export default function Header() {
  const appContext = useAppContext();
  const { isAdmin: isAdminFunc, user, dbUser, isLoading: appContextLoading } = appContext;
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const pathname = usePathname();

  const initialLang = useMemo(() => (user?.language_code === 'ru' ? 'ru' : 'en'), [user?.language_code]);
  const [currentLang, setCurrentLang] = useState<'en' | 'ru'>(initialLang);
  const [cyberProfile, setCyberProfile] = useState<CyberFitnessProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const isAdmin = useMemo(() => {
    return typeof isAdminFunc === 'function' ? isAdminFunc() : false;
  }, [isAdminFunc]);

  const t = useCallback((key: string): string => {
    const dict = translations[currentLang] || translations['en'];
    return dict[key] || key;
  }, [currentLang]);

  // Fetch profile on nav open to update locked status
  useEffect(() => {
    if (isNavOpen && dbUser?.user_id) {
        setProfileLoading(true);
        fetchUserCyberFitnessProfile(dbUser.user_id).then(res => {
            if (res.success && res.data) setCyberProfile(res.data);
            setProfileLoading(false);
        });
    } else {
        setProfileLoading(false);
    }
  }, [isNavOpen, dbUser?.user_id]);

  const groupedPages = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    const userLevel = cyberProfile?.level ?? 0;

    const filtered = allPages.filter(page => {
      // Permission checks
      if (page.isAdminOnly && !isAdmin) return false;
      if (page.supportOnly && dbUser?.role !== 'support' && !isAdmin) return false;
      
      // Level checks (Unlockable missions)
      if (page.questId && cyberProfile && !isAdmin) {
         return checkQuestUnlockedFromHook(page.questId, cyberProfile.completedQuests || [], QUEST_ORDER);
      }
      if (page.minLevel && userLevel < page.minLevel && !isAdmin) return false;

      // Search filter
      const transName = t(page.name);
      return transName.toLowerCase().includes(lowerSearch) || 
             page.path.toLowerCase().includes(lowerSearch);
    });

    const groups: Record<string, PageInfo[]> = {};
    groupOrder.forEach(g => groups[g] = []); 
    
    filtered.forEach(page => {
      const g = page.group || "Misc";
      if (groups[g]) groups[g].push({ ...page, translatedName: t(page.name) });
    });

    return groups;
  }, [searchTerm, isAdmin, cyberProfile, dbUser, t, profileLoading]);

  const handleScroll = useCallback(() => {
    if (isNavOpen) return;
    const currentScrollY = window.scrollY;
    if (currentScrollY > lastScrollY && currentScrollY > 60) setIsHeaderVisible(false);
    else if (currentScrollY < lastScrollY) setIsHeaderVisible(true);
    setLastScrollY(currentScrollY);
  }, [lastScrollY, isNavOpen]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const logoText = useMemo(() => {
    if (pathname.includes('/vpr')) return "VPR MASTER";
    if (pathname.includes('/wb')) return "WB SYSTEM";
    if (pathname.includes('/nexus')) return "VIBE NEXUS";
    return "CYBERVIBE";
  }, [pathname]);

  return (
    <>
      <motion.header
        className={cn("fixed top-0 left-0 right-0 z-40 bg-background/80 border-b border-border shadow-sm backdrop-blur-md transition-transform duration-300")}
        animate={{ y: isHeaderVisible ? 0 : "-100%" }}
      >
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group" onClick={() => setIsNavOpen(false)}>
            <div className="w-8 h-8 rounded bg-brand-red-orange/20 flex items-center justify-center border border-brand-red-orange/50 group-hover:rotate-12 transition-transform">
               <Rocket className="w-5 h-5 text-brand-red-orange" />
            </div>
            <span className="font-orbitron font-bold text-xl tracking-wider text-foreground">
              {logoText}
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggleButton />
            <button 
              onClick={() => setCurrentLang(l => l === 'en' ? 'ru' : 'en')}
              className="p-2 rounded-md hover:bg-accent text-xs font-bold hidden sm:block"
            >
              {currentLang.toUpperCase()}
            </button>
            <button
              onClick={() => setIsNavOpen(true)}
              className="p-2 text-brand-green hover:bg-brand-green/10 rounded-md transition-colors"
            >
              <LayoutGrid className="h-6 w-6" />
            </button>
            <UserInfo />
          </div>
        </div>
      </motion.header>

      {/* --- MEGA MENU OVERLAY --- */}
      <AnimatePresence>
        {isNavOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl overflow-y-auto pb-10"
          >
            <div className="container mx-auto px-4 pt-4 pb-10">
              
              {/* Menu Header with Close */}
              <div className="flex justify-between items-center mb-6 sticky top-0 bg-background/95 backdrop-blur-md py-4 z-10 -mx-4 px-4 border-b border-border/50">
                <h2 className="text-2xl font-bold font-orbitron text-foreground">NAVIGATION</h2>
                <button 
                  onClick={() => setIsNavOpen(false)}
                  className="p-2 rounded-full bg-accent/50 hover:bg-accent text-foreground transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Search */}
              <div className="relative mb-8 max-w-2xl mx-auto w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder={t("Search pages...")} 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-accent/20 border border-border rounded-xl py-3 pl-10 pr-4 text-foreground focus:ring-2 focus:ring-brand-purple outline-none transition-all"
                />
              </div>

              <div className="space-y-12">
                {groupOrder.map(group => {
                  const pages = groupedPages[group];
                  if (!pages || pages.length === 0) return null;

                  return (
                    <div key={group} className="max-w-6xl mx-auto">
                      <div className="flex items-center gap-4 mb-4">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">{t(group)}</h3>
                        <div className="h-px bg-border flex-1" />
                      </div>
                      
                      {/* Grid: 3 cols on mobile, 4 on sm, 6 on lg */}
                      <motion.div
                        className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4"
                        variants={gridContainerVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        {pages.map(page => {
                          const style = tileColorClasses[page.color || 'default'];
                          const isBig = page.isImportant;

                          return (
                            <MotionLink 
                              key={page.path} 
                              href={page.path}
                              onClick={() => setIsNavOpen(false)}
                              variants={tileItemVariants}
                              className={cn(
                                "relative flex flex-col items-center justify-center rounded-xl border transition-all hover:scale-[1.02] active:scale-95 text-center gap-1 group",
                                // Smaller padding for mobile, larger for desktop
                                "p-2 sm:p-4",
                                style,
                                // Sizing logic: Big items take 2 cols on mobile/desktop. Regular items take 1.
                                isBig ? "col-span-2 aspect-[2/1] sm:aspect-auto sm:h-auto" : "col-span-1 aspect-square sm:aspect-square",
                                // Ensure big items have enough height on mobile if they wrap text
                                isBig && "min-h-[80px]"
                              )}
                            >
                              {/* Hot Badge */}
                              {page.isHot && (
                                <span className="absolute top-1 right-1 sm:top-2 sm:right-2 flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-full w-full bg-red-500"></span>
                                </span>
                              )}

                              {/* Icon - Smaller on mobile */}
                              <div className="text-xl sm:text-3xl mb-1 group-hover:-translate-y-1 transition-transform duration-300">
                                <RenderIconFromPage icon={page.icon} />
                              </div>

                              {/* Title - Tiny on mobile, normal on desktop */}
                              <span className="font-semibold text-[0.65rem] sm:text-sm leading-tight line-clamp-2">
                                {page.translatedName}
                              </span>

                              {/* Admin Tag */}
                              {page.isAdminOnly && (
                                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] sm:text-[10px] font-mono opacity-60 bg-black/20 px-1 py-0.5 rounded-full">
                                  ADMIN
                                </span>
                              )}
                            </MotionLink>
                          );
                        })}
                      </motion.div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}