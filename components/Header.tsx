"use client";

import Link from "next/link";
import { LayoutGrid, X, Search, Globe } from "lucide-react"; // Base Lucide icons
import React, { useState, useEffect, useMemo, useCallback } from "react";
import UserInfo from "@/components/user-info";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { debugLogger as logger } from "@/lib/debugLogger";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { QUEST_ORDER, fetchUserCyberFitnessProfile, isQuestUnlocked as checkQuestUnlockedFromHook, CyberFitnessProfile } from '@/hooks/cyberFitnessSupabase';
import * as Fa6Icons from "react-icons/fa6";
import { iconNameMap } from "@/lib/iconNameMap";

interface PageInfo {
  path: string;
  name: string;
  icon?: keyof typeof Fa6Icons | string;
  isImportant?: boolean;
  isAdminOnly?: boolean;
  isHot?: boolean;
  color?: 'purple' | 'blue' | 'yellow' | 'lime' | 'green' | 'pink' | 'cyan' | 'red' | 'orange' | 'gray';
  group?: string;
  translatedName?: string;
  questId?: string;
  minLevel?: number;
  supportOnly?: boolean; // Added for Leads HQ
}

const allPages: PageInfo[] = [
  // Vibe HQ
  { path: "/repo-xml", name: "SUPERVIBE Studio", icon: "FaWandMagicSparkles", group: "Vibe HQ", isImportant: true, color: "purple", isHot: true, minLevel: 1 },
  { path: "/leads", name: "Leads HQ", icon: "FaCrosshairs", group: "Vibe HQ", isImportant: true, color: "orange", isHot: true, minLevel: 2, supportOnly: true },
  { path: "/hotvibes", name: "Hot Vibes", icon: "FaFire", group: "Vibe HQ", isImportant: true, color: "red", isHot: true, minLevel: 0 },

  // Core Vibe
  { path: "/", name: "Home", icon: "FaBrain", group: "Core Vibe", isImportant: true, color: "cyan", minLevel: 0 },
  { path: "/selfdev", name: "SelfDev Path", icon: "FaRoad", group: "Core Vibe", isImportant: true, color: "green", minLevel: 0 },
  { path: "/p-plan", name: "VIBE Plan", icon: "FaUserNinja", group: "Core Vibe", isImportant: true, isHot: true, color: "yellow", minLevel: 1 },
  { path: "/game-plan", name: "Game Plan", icon: "FaFilm", group: "Core Vibe", isImportant: true, color: "orange", isHot: true, minLevel: 1 },
  { path: "/selfdev/gamified", name: "CyberDev OS", icon: "FaGamepad", group: "Core Vibe", isImportant: true, color: "pink", isHot: true, minLevel: 0 },
  { path: "/cybervibe", name: "CyberVibe Upgrade", icon: "FaBolt", group: "Core Vibe", isImportant: true, color: "yellow", isHot: true, minLevel: 2 },

  // GTA Vibe Missions
  { path: "/start-training", name: "Start Training", icon: "FaDumbbell", group: "GTA Vibe Missions", color: "green", isImportant: true, minLevel: 0}, // MOVED HERE
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
  // "/start-training" MOVED to GTA Vibe Missions
  { path: "/settings", name: "System Config", icon: "FaGears", group: "CyberFitness", color: "blue", minLevel: 1 },
  { path: "/partner", name: "Alliance Perks", icon: "FaUsers", group: "CyberFitness", color: "purple", minLevel: 2},

  // Content & Tools
  { path: "/jumpstart", name: "Jumpstart Kit", icon: "FaRocket", group: "Content & Tools", isImportant: true, color: "lime", minLevel: 0 },
  { path: "/purpose-profit", name: "Purpose & Profit", icon: "FaBookOpen", group: "Content & Tools", color: "purple", minLevel: 0 },
  { path: "/ai-work-future", name: "AI & Future of Work", icon: "FaNetworkWired", group: "Content & Tools", color: "cyan", minLevel: 0 },
  { path: "/advice", name: "Advice Archive", icon: "FaRegLightbulb", group: "Content & Tools", color: "orange", minLevel: 0 },
  { path: "/expmind", name: "Experimental Mindset", icon: "FaBrain", group: "Content & Tools", color: "pink", minLevel: 0 },
  { path: "/veritasium", name: "Veritasium Insights", icon: "FaBookAtlas", group: "Content & Tools", color: "cyan", isImportant: true, isHot: true, minLevel: 0 },
  { path: "/style-guide", name: "Style Guide", icon: "FaPalette", group: "Content & Tools", color: "gray", minLevel: 0 },
  { path: "/onesitepls", name: "oneSitePls Info", icon: "FaCircleInfo", group: "Content & Tools", color: "gray", minLevel: 0 },
  { path: "/finance-literacy-memo", name: "Finance Literacy Memo", icon: "FaDollarSign", group: "Content & Tools", color: "green", minLevel: 0},
  { path: "/topdf", name: "XLSX-2-PDF Converter", icon: "FaFilePdf", group: "Content & Tools", color: "red", isHot: true, minLevel: 0 },

  // Misc
  { path: "/cartest", name: "Cyber Garage", icon: "FaCarOn", group: "Misc", color: "blue", minLevel: 0 },
  { path: "/botbusters", name: "Bot Busters", icon: "FaRobot", group: "Misc", color: "blue", minLevel: 0},
  { path: "/bullshitdetector", name: "BS Detector", icon: "FaMagnifyingGlass", group: "Misc", color: "yellow", minLevel: 0 },
  { path: "/wheel-of-fortune", name: "Wheel of Fortune", icon: "FaGift", group: "Misc", color: "lime", minLevel: 0 },
  { path: "/invoices", name: "My Invoices", icon: "FaFileInvoiceDollar", group: "Misc", color: "green", minLevel: 1 },
  { path: "/donate", name: "Donate", icon: "FaHeart", group: "Misc", color: "red", minLevel: 0 },
  { path: "/onesiteplsinstructions", name: "oneSitePls How-To", icon: "FaListCheck", group: "Misc", color: "gray", minLevel: 0 },
  { path: "/rent-car", name: "Rent a Car", icon: "FaCarOn", group: "Misc", color: "yellow", minLevel: 0 },
  { path: "/vpr-tests", name: "VPR Tests", icon: "FaListCheck", group: "Misc", color: 'pink', minLevel: 0 },
  { path: "/vpr/geography/6/cheatsheet", name: "Geo Cheatsheet 6", icon: "FaGlobe", group: "Misc", color: 'green', minLevel: 0 },
  { path: "/vpr/history/6/cheatsheet", name: "History Cheatsheet 6", icon: "FaLandmarkDome", group: "Misc", color: 'yellow', minLevel: 0 },
  { path: "/vpr/biology/6/cheatsheet", name: "Biology Cheatsheet 6", icon: "FaLeaf", group: "Misc", color: 'lime', minLevel: 0 },

  // Admin Zone
  { path: "/admin", name: "Admin Panel", icon: "FaUserShield", group: "Admin Zone", isAdminOnly: true, color: "red", minLevel: 0 },
  { path: "/advice-upload", name: "Upload Advice", icon: "FaUpload", group: "Admin Zone", isAdminOnly: true, color: "red", minLevel: 0 },
  { path: "/shadow-fleet-admin", name: "Fleet Admin", icon: "FaCarOn", group: "Admin Zone", isAdminOnly: true, color: "red", minLevel: 0 },
  { path: "/youtubeAdmin", name: "YT Admin", icon: "FaYoutube", group: "Admin Zone", isAdminOnly: true, color: "red", minLevel: 0 },
];

const groupOrder = ["Vibe HQ", "Core Vibe", "GTA Vibe Missions", "CyberFitness", "Content & Tools", "Misc", "Admin Zone"];

const groupIcons: Record<string, keyof typeof Fa6Icons | undefined> = {
    "Vibe HQ": "FaCrosshairs",
    "Core Vibe": "FaBolt",
    "GTA Vibe Missions": "FaGamepad", // Kept Gamepad as it's iconic for missions
    "CyberFitness": "FaDumbbell",
    "Content & Tools": "FaPuzzlePiece",
    "Misc": "FaLayerGroup",
    "Admin Zone": "FaShieldHalved",
};

const groupIconColors: Record<string, string> = {
  "Vibe HQ": "text-brand-red",
  "Core Vibe": "text-brand-cyan",
  "GTA Vibe Missions": "text-brand-green", // Changed to green as Start Training is green
  "CyberFitness": "text-neon-lime",
  "Content & Tools": "text-brand-orange",
  "Misc": "text-muted-foreground",
  "Admin Zone": "text-destructive",
};

// Ensure all names from allPages are in BOTH en and ru translations
const translations: Record<string, Record<string, string>> = {
  en: {
    "Home": "Home", "SUPERVIBE Studio": "SUPERVIBE Studio", "Leads HQ": "Leads HQ", "Hot Vibes": "Hot Vibes",
    "SelfDev Path": "SelfDev Path", "VIBE Plan": "VIBE Plan", "Game Plan": "Game Plan", "CyberDev OS": "CyberDev OS", "CyberVibe Upgrade": "CyberVibe Upgrade",
    "Start Training": "Start Training", "Image Swap Mission": "Image Swap Mission", "Icon Demining Mission": "Icon Demining Mission", "Video Render Mission": "Video Render Mission", "Inception Swap Mission": "Inception Swap Mission", "The Fifth Door Mission": "The Fifth Door Mission",
    "Agent Profile": "Agent Profile", "OS Upgrades": "OS Upgrades", "Premium Modules": "Premium Modules",
    "Vibe Schematics": "Vibe Schematics", "System Config": "System Config", "Alliance Perks": "Alliance Perks",
    "Jumpstart Kit": "Jumpstart Kit", "Purpose & Profit": "Purpose & Profit", "AI & Future of Work": "AI & Future of Work", "Advice Archive": "Advice Archive", "Experimental Mindset": "Experimental Mindset", "Veritasium Insights": "Veritasium Insights", "Style Guide": "Style Guide", "oneSitePls Info": "oneSitePls Info", "Finance Literacy Memo": "Finance Literacy Memo", "XLSX-2-PDF Converter": "XLSX-2-PDF Converter",
    "Cyber Garage": "Cyber Garage", "Bot Busters": "Bot Busters", "BS Detector": "BS Detector", "Wheel of Fortune": "Wheel of Fortune", "My Invoices": "My Invoices", "Donate": "Donate", "oneSitePls How-To": "oneSitePls How-To", "Rent a Car": "Rent a Car", "VPR Tests": "VPR Tests", "Geo Cheatsheet 6": "Geo Cheatsheet 6", "History Cheatsheet 6": "History Cheatsheet 6", "Biology Cheatsheet 6": "Biology Cheatsheet 6",
    "Admin Panel": "Admin Panel", "Upload Advice": "Upload Advice", "Fleet Admin": "Fleet Admin", "YT Admin": "YT Admin",
    "Search pages...": "Search pages...", "No pages found matching": "No pages found matching", "Admin Only": "Admin Only", "Toggle Language": "Toggle Language", "Open navigation": "Open navigation", "Close navigation": "Close navigation", "Hot": "Hot", "Missions": "Missions", // Added Missions for tutorial path
    "Vibe HQ": "Vibe HQ", "Core Vibe": "Core Vibe", "GTA Vibe Missions": "GTA Vibe Missions", "CyberFitness": "CyberFitness", "Content & Tools": "Content & Tools", "Misc": "Misc", "Admin Zone": "Admin Zone"
  },
  ru: {
    "Home": "Главная", "SUPERVIBE Studio": "SUPERVIBE Studio", "Leads HQ": "КОЦ 'Дозор'", "Hot Vibes": "Горячие Вайбы",
    "SelfDev Path": "Путь SelfDev", "VIBE Plan": "VIBE План", "Game Plan": "Гейм План", "CyberDev OS": "CyberDev OS", "CyberVibe Upgrade": "КиберВайб Апгрейд",
    "Start Training": "Начать Тренировку", "Image Swap Mission": "Миссия: Битый Пиксель", "Icon Demining Mission": "Миссия: Сапёр Иконок", "Video Render Mission": "Миссия: Видео-Рендер", "Inception Swap Mission": "Миссия: Inception Swap", "The Fifth Door Mission": "Миссия: Пятая Дверь",
    "Agent Profile": "Профиль Агента", "OS Upgrades": "Апгрейды ОС", "Premium Modules": "Премиум Модули",
    "Vibe Schematics": "Схемы Вайба", "System Config": "Настройки Системы", "Alliance Perks": "Бонусы Альянса",
    "Jumpstart Kit": "Jumpstart Kit", "Purpose & Profit": "Цель и Прибыль", "AI & Future of Work": "AI и Будущее Работы", "Advice Archive": "Архив Советов", "Experimental Mindset": "Эксперим. Мышление", "Veritasium Insights": "Озарения Veritasium", "Style Guide": "Гайд по Стилю", "oneSitePls Info": "Инфо oneSitePls", "Finance Literacy Memo": "Памятка Фин. Грамотности", "XLSX-2-PDF Converter": "XLSX-2-PDF Конвертер",
    "Cyber Garage": "Кибер Гараж", "Bot Busters": "Охотники за Ботами", "BS Detector": "BS Детектор", "Wheel of Fortune": "Колесо Фортуны", "My Invoices": "Мои Счета", "Donate": "Поддержать", "oneSitePls How-To": "Как юзать oneSitePls", "Rent a Car": "Аренда Авто", "VPR Tests": "ВПР Тесты", "Geo Cheatsheet 6": "Шпаргалка Гео 6", "History Cheatsheet 6": "Шпаргалка Ист 6", "Biology Cheatsheet 6": "Шпаргалка Био 6",
    "Admin Panel": "Админ Панель", "Upload Advice": "Загрузить Совет", "Fleet Admin": "Админ Автопарка", "YT Admin": "Админ YT",
    "Search pages...": "Поиск страниц...", "No pages found matching": "Страницы не найдены по запросу", "Admin Only": "Только для админа", "Toggle Language": "Переключить язык", "Open navigation": "Открыть навигацию", "Close navigation": "Закрыть навигацию", "Hot": "🔥", "Missions": "Миссии",
    "Vibe HQ": "Vibe HQ", "Core Vibe": "Ядро Вайба", "GTA Vibe Missions": "GTA Vibe Миссии", "CyberFitness": "КиберФитнес", "Content & Tools": "Контент и Тулзы", "Misc": "Разное", "Admin Zone": "Зона Админа"
  }
};

// ... (rest of the Header component from previous response, including colorVarMap, tileColorClasses, gridContainerVariants, tileItemVariants, MotionLink, RenderIconFromPage, and the main Header function with its hooks and logic)
// The filtering logic for groupedAndFilteredPages already uses minLevel and isAdmin, which is correct.
// The questId check for GTA Vibe Missions also remains correct.
// No further changes needed in the main Header function body beyond the allPages and translations update above.
// Make sure the dynamic logo logic correctly uses the new t("Missions") for the tutorial path.
// Inside useMemo for currentLogoText:
// ...
    if (pathname?.startsWith('/tutorials')) {
        const tutorialName = t(page?.name || "Missions"); // Ensure "Missions" has translation
        // Adjusted to use the generic "Missions" if specific tutorial name is too long
        return tutorialName.length > 10 ? t("Missions").toUpperCase() : tutorialName.toUpperCase();
    }
// ...

// Main Header function structure (repeated for completeness, ensure it merges with your existing logic)
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

  useEffect(() => {
    const newLangBasedOnUser = user?.language_code === 'ru' ? 'ru' : 'en';
    if (newLangBasedOnUser !== currentLang) {
       setCurrentLang(newLangBasedOnUser);
    }
  }, [user?.language_code, currentLang]);

  const isAdmin = useMemo(() => {
    if (typeof isAdminFunc === 'function') {
        return isAdminFunc();
    }
    logger.warn("[Header] isAdmin function not available on context. Defaulting to false.");
    return false;
  }, [isAdminFunc]);

  const fetchProfile = useCallback(async () => {
    if (dbUser?.user_id) {
      setProfileLoading(true);
      logger.debug(`[Header] Fetching profile for user_id: ${dbUser.user_id}`);
      const profileData = await fetchUserCyberFitnessProfile(dbUser.user_id);
      if (profileData.success && profileData.data) {
        setCyberProfile(profileData.data);
        logger.debug(`[Header] Profile fetched: Level ${profileData.data.level}, Quests: ${profileData.data.completedQuests?.join(',')}`);
      } else {
        logger.warn(`[Header] Failed to fetch profile: ${profileData.error}`);
      }
      setProfileLoading(false);
    } else {
      logger.debug("[Header] No dbUser.user_id, profile not fetched.");
      setCyberProfile(null);
      setProfileLoading(false);
    }
  }, [dbUser?.user_id]);

  useEffect(() => {
    if(isNavOpen && !appContextLoading){
      fetchProfile();
    }
  }, [isNavOpen, fetchProfile, appContextLoading]);

  const t = useCallback((key: string): string => {
    const langDict = translations[currentLang];
    if (langDict && langDict[key] !== undefined) return langDict[key];
    const enDict = translations['en'];
    if (enDict && enDict[key] !== undefined) return enDict[key];
    logger.warn(`[Header t] Translation missing for key: "${key}" in lang: "${currentLang}". Returning key.`);
    return key;
  }, [currentLang]);

  const toggleLang = useCallback(() => setCurrentLang(prevLang => prevLang === 'en' ? 'ru' : 'en'), []);

  const currentLogoText = useMemo(() => {
    const page = allPages.find(p => p.path === pathname);
    if (pathname?.startsWith('/vpr')) return "VPR";
    if (pathname?.startsWith('/tutorials') || pathname === '/start-training') { // Added /start-training
        const pageNameOrDefault = page?.name || "Missions"; // Default to "Missions" if page not found (e.g. /start-training)
        const tutorialName = t(pageNameOrDefault);
        return tutorialName.length > 10 ? t("Missions").toUpperCase() : tutorialName.toUpperCase();
    }
    if (page?.name) {
        const translatedPageName = t(page.name);
        const firstWord = translatedPageName.split(' ')[0];
        if (firstWord.length <= 6 && firstWord.length > 0) return firstWord.toUpperCase();
        if (page.name.length <= 6 && page.name.length > 0) return page.name.toUpperCase();
    }
    return "CYBERVIBE";
  }, [pathname, t]);

  const logoCyberPart = currentLogoText === "CYBERVIBE" ? "CYBER" : currentLogoText;
  const logoVibePart = currentLogoText === "CYBERVIBE" ? "VIBE" : "";

  const groupedAndFilteredPages = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    const userLevel = cyberProfile?.level ?? 0;

    logger.debug(`[Header Filtering] Search: "${lowerSearchTerm}", Admin: ${isAdmin}, Level: ${userLevel}, Profile Loading: ${profileLoading}, AppCtx Loading: ${appContextLoading}`);
    
    const filtered = allPages
      .filter(page => {
        if (page.isAdminOnly && !isAdmin) return false;
        if (!isAdmin && page.minLevel !== undefined && userLevel < page.minLevel) return false;
        if (!isAdmin && page.supportOnly && !(dbUser?.role === 'support')) return false;


        if (page.group === "GTA Vibe Missions" && page.questId && cyberProfile && !profileLoading) {
          const unlocked = checkQuestUnlockedFromHook(page.questId, cyberProfile.completedQuests, QUEST_ORDER);
          return unlocked;
        }
        return true;
      })
      .map(page => ({ ...page, translatedName: t(page.name) }))
      .filter(page =>
        (page.translatedName || '').toLowerCase().includes(lowerSearchTerm) ||
        (page.path || '').toLowerCase().includes(lowerSearchTerm) ||
        (t(page.group || '') || '').toLowerCase().includes(lowerSearchTerm)
      );

    const groups: Record<string, PageInfo[]> = {};
    groupOrder.forEach(groupName => {
      if (groupName === "Admin Zone" && !isAdmin && !appContextLoading) return;
      // Ensure "GTA Vibe Missions" group is always created if it might contain "Start Training"
      if (groupName === "GTA Vibe Missions" || (groups[groupName] !== undefined) || filtered.some(p => p.group === groupName) ) {
         groups[groupName] = [];
      }
    });
    // Special handling for Start Training if it's not naturally in a visible group due to questId filtering
    const startTrainingPage = allPages.find(p => p.path === "/start-training");
    if (startTrainingPage && !filtered.some(p => p.path === "/start-training")) {
        const translatedStartTraining = {...startTrainingPage, translatedName: t(startTrainingPage.name) };
        if ( (translatedStartTraining.translatedName || '').toLowerCase().includes(lowerSearchTerm) ||
             (translatedStartTraining.path || '').toLowerCase().includes(lowerSearchTerm) ||
             (t(translatedStartTraining.group || '') || '').toLowerCase().includes(lowerSearchTerm)
        ) {
             if (!groups["GTA Vibe Missions"]) groups["GTA Vibe Missions"] = [];
             groups["GTA Vibe Missions"].push(translatedStartTraining);
        }
    }


    filtered.forEach(page => {
      const groupName = page.group || "Misc";
      if (!groups[groupName]) groups[groupName] = [];
      if (!groups[groupName].some(p => p.path === page.path)) { // Avoid duplicates if start-training was manually added
        groups[groupName].push(page);
      }
    });
    return groups;
  }, [searchTerm, isAdmin, t, appContextLoading, cyberProfile, profileLoading, dbUser?.role]);

  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    if (isNavOpen) { if (!isHeaderVisible) setIsHeaderVisible(true); setLastScrollY(currentScrollY); return; }
    if (currentScrollY > lastScrollY && currentScrollY > 60) { if (isHeaderVisible) setIsHeaderVisible(false); }
    else if (currentScrollY < lastScrollY || currentScrollY <= 60) { if (!isHeaderVisible) setIsHeaderVisible(true); }
    setLastScrollY(currentScrollY);
  }, [lastScrollY, isNavOpen, isHeaderVisible]);

  useEffect(() => { window.addEventListener("scroll", handleScroll, { passive: true }); return () => window.removeEventListener("scroll", handleScroll); }, [handleScroll]);
  useEffect(() => { if (isNavOpen) { setSearchTerm(""); } }, [pathname, isNavOpen]);
  useEffect(() => { const originalStyle = document.body.style.overflow; if (isNavOpen) { document.body.style.overflow = 'hidden'; } else { document.body.style.overflow = originalStyle; } return () => { document.body.style.overflow = originalStyle; }; }, [isNavOpen]);

  return (
    <>
      <motion.header /* ... same as before ... */ >
         {/* ... content of header ... */}
      </motion.header>

      <AnimatePresence>
        {isNavOpen && (
          <motion.div /* ... same as before ... */ >
            {/* ... content of nav overlay ... */}
            {/* The mapping logic for pagesInGroup within groupOrder.map will use the updated groupedAndFilteredPages */}
            {/* Ensure RenderIconFromPage correctly handles icon names from Fa6Icons */}
            {/* Inside groupOrder.map, when rendering tiles: */}
            {/* ...
            {pagesInGroup.map((page) => {
                // ...
                {page.icon && (
                    <RenderIconFromPage
                        icon={page.icon as keyof typeof Fa6Icons} // Critical: Ensure page.icon is a valid key
                        className={cn(
                            // ...
                        )}
                    />
                )}
                // ...
            })}
            ... */}
             <div className="container mx-auto max-w-4xl xl:max-w-5xl pt-16 md:pt-20">
              <div className="relative mb-4 sm:mb-6">
                {/* Search input same as before */}
                 <input
                  type="search" placeholder={t("Search pages...")} value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 bg-dark-card/80 border-2 border-brand-cyan/50 rounded-lg text-foreground placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-cyan focus:border-transparent text-sm sm:text-base font-mono shadow-md"
                  aria-label={t("Search pages...")}
                />
                <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-brand-cyan/70 pointer-events-none" />
              </div>

              <div className="space-y-4 sm:space-y-6">
                {(profileLoading && !appContextLoading && !isAdmin) && <div className="text-center text-brand-cyan font-mono"><VibeContentRenderer content="::FaSpinner className='animate-spin':: Загрузка профиля агента..."/></div>}
                {(!profileLoading || appContextLoading || isAdmin) && groupOrder.map(groupName => {
                  const pagesInGroup = groupedAndFilteredPages[groupName];
                  if (!pagesInGroup || pagesInGroup.length === 0) return null;

                  const groupIconKey = groupIcons[groupName] as keyof typeof Fa6Icons | undefined;
                  const IconComponent = groupIconKey ? Fa6Icons[groupIconKey] : undefined;

                  return (
                    <div key={groupName}>
                       <h3 className={cn(
                        "text-lg sm:text-xl font-orbitron mb-2 sm:mb-3 flex items-center gap-x-2 sm:gap-x-2.5 justify-center py-1.5 sm:py-2",
                        "gta-vibe-text-effect",
                        groupIconColors[groupName] || "text-brand-purple"
                        )}>
                        {IconComponent && (
                          <IconComponent className={cn("w-5 h-5 sm:w-6 sm:h-6 gta-icon-fix", groupIconColors[groupName] || "text-brand-purple")} />
                        )}
                        <span>{t(groupName)}</span>
                        {IconComponent && (groupName === "GTA Vibe Missions" || groupName === "Vibe HQ") && (
                           <IconComponent className={cn("w-5 h-5 sm:w-6 sm:h-6 gta-icon-fix", groupIconColors[groupName] || "text-brand-purple")} />
                        )}
                      </h3>
                      <motion.div
                        className={cn(
                          "grid gap-1.5 sm:gap-2 md:gap-2.5",
                          "grid-cols-3 xs:grid-cols-3",
                          "sm:grid-cols-4",
                          "md:grid-cols-4",
                          "lg:grid-cols-5",
                          "xl:grid-cols-6"
                        )}
                        variants={gridContainerVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        {pagesInGroup.map((page) => {
                          const isCurrentPage = page.path === pathname;
                          const tileBaseColorClass = tileColorClasses[page.color || 'default'];
                          // @ts-ignore
                          const rgbVarName = page.color ? `--${page.color}-rgb` : '--default-glow-rgb';
                          const rgbVar = colorVarMap[page.color || 'default']; // Use the map
                          const tileShadow = rgbVar ? `hover:shadow-[0_0_12px_2px_rgba(${rgbVar},0.4)]` : 'hover:shadow-xl';


                          return (
                            <MotionLink
                              key={page.path} href={page.path}
                              onClick={() => setIsNavOpen(false)}
                              variants={tileItemVariants}
                              className={cn(
                                "group relative flex flex-col items-center justify-center rounded-lg border-2 transition-all duration-200 aspect-square text-center hover:scale-[1.02] hover:-translate-y-0.5 shadow-md hover:shadow-lg",
                                "p-1 sm:p-1.5",
                                page.isImportant
                                  ? "bg-gradient-to-br from-purple-800/40 via-black/60 to-blue-800/40 col-span-1 xs:col-span-1 sm:col-span-2 shadow-lg hover:shadow-xl"
                                  : "bg-dark-card/70 hover:bg-dark-card/90 col-span-1",
                                tileBaseColorClass,
                                tileShadow,
                                isCurrentPage ? `ring-2 ring-offset-2 ring-offset-black ${page.color === 'lime' || page.color === 'yellow' || page.color === 'orange' ? 'ring-black/80' : 'ring-white/90'}` : 'ring-transparent'
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
                                    icon={page.icon as keyof typeof Fa6Icons}
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
                                    ? "text-white text-[0.65rem] xs:text-[0.7rem] sm:text-[0.8rem] md:text-[0.85rem]"
                                    : "text-light-text/90 group-hover:text-white text-[0.55rem] xs:text-[0.6rem] sm:text-[0.7rem] md:text-xs"
                              )}>
                                {page.translatedName}
                              </span>
                              {page.isAdminOnly && (
                                <span title={t("Admin Only")} className="absolute bottom-0.5 sm:bottom-1 right-0.5 sm:right-1 text-[0.6rem] sm:text-[0.65rem] text-red-400/80 bg-black/60 rounded-full px-0.5 sm:px-1 py-0.5 leading-none">
                                  ADMIN
                                </span>
                              )}
                            </MotionLink>
                          );
                        })}
                      </motion.div>
                      {groupOrder.indexOf(groupName) < groupOrder.length -1 && Object.values(groupedAndFilteredPages).filter(g => g && g.length > 0).indexOf(pagesInGroup) < Object.values(groupedAndFilteredPages).filter(g => g && g.length > 0).length -1 && (
                        <hr className="my-3 sm:my-4 border-gray-700/50"/>
                      )}
                    </div>
                  );
                })}
                {(!profileLoading || appContextLoading || isAdmin) && Object.values(groupedAndFilteredPages).every(g => !g || g.length === 0) && (
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