"use client";

import Link from "next/link";
import { LayoutGrid, X, Search, Globe, FaGamepad } from "lucide-react"; // FaGamepad for GTA Vibe Missions
import React, { useState, useEffect, useMemo, useCallback } from "react";
import UserInfo from "@/components/user-info";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { debugLogger as logger } from "@/lib/debugLogger";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { QUEST_ORDER, fetchUserCyberFitnessProfile, isQuestUnlocked } from '@/hooks/cyberFitnessSupabase'; // For checking unlocked missions
import type { CyberFitnessProfile } from '@/hooks/cyberFitnessSupabase';

interface PageInfo {
  path: string;
  name: string; 
  icon?: string; 
  isImportant?: boolean;
  isAdminOnly?: boolean;
  isHot?: boolean;
  color?: 'purple' | 'blue' | 'yellow' | 'lime' | 'green' | 'pink' | 'cyan' | 'red' | 'orange' | 'gray'; 
  group?: string; 
  translatedName?: string;
  questId?: string; // Added questId for tutorial missions
}

const allPages: PageInfo[] = [
  // Core Vibe
  { path: "/", name: "Home", icon: "FaBrain", group: "Core Vibe", isImportant: true, color: "cyan" },
  { path: "/repo-xml", name: "SUPERVIBE Studio", icon: "FaWandMagicSparkles", group: "Core Vibe", isImportant: true, color: "purple", isHot: true },
  { path: "/selfdev", name: "SelfDev Path", icon: "FaRoad", group: "Core Vibe", isImportant: true, color: "green" },
  { path: "/p-plan", name: "VIBE Plan", icon: "FaUserNinja", group: "Core Vibe", isImportant: true, isHot: true, color: "yellow" },
  { path: "/game-plan", name: "Game Plan", icon: "FaFilm", group: "Core Vibe", isImportant: true, color: "orange", isHot: true },
  { path: "/selfdev/gamified", name: "CyberDev OS", icon: "FaGamepad", group: "Core Vibe", isImportant: true, color: "pink", isHot: true },
  
  // GTA Vibe Missions (Tutorial Quests)
  { path: "/tutorials/image-swap", name: "Image Swap Mission", icon: "faexchangealt", group: "GTA Vibe Missions", isImportant: true, color: "green", isHot: true, questId: "image-swap-mission" }, 
  { path: "/tutorials/icon-swap", name: "Icon Demining Mission", icon: "FaBomb", group: "GTA Vibe Missions", isImportant: true, color: "red", isHot: true, questId: "icon-swap-mission" },
  { path: "/tutorials/video-swap", name: "Video Render Mission", icon: "FaVideo", group: "GTA Vibe Missions", isImportant: true, color: "cyan", isHot: true, questId: "video-swap-mission" },
  { path: "/tutorials/inception-swap", name: "Inception Swap Mission", icon: "FaInfinity", group: "GTA Vibe Missions", isImportant: true, color: "lime", isHot: true, questId: "inception-swap-mission" },
  { path: "/tutorials/the-fifth-door", name: "The Fifth Door Mission", icon: "FaKey", group: "GTA Vibe Missions", isImportant: true, color: "yellow", isHot: true, questId: "the-fifth-door-mission" },

  // CyberFitness
  { path: "/profile", name: "Agent Profile", icon: "FaCircleUser", group: "CyberFitness", color: "pink" },
  { path: "/buy-subscription", name: "OS Upgrades", icon: "FaCreditCard", group: "CyberFitness", color: "green" },
  { path: "/premium", name: "Premium Modules", icon: "FaStar", group: "CyberFitness", color: "yellow" }, 
  { path: "/nutrition", name: "Vibe Schematics", icon: "FaToolbox", group: "CyberFitness", color: "orange"},
  { path: "/start-training", name: "Start Training", icon: "FaDumbbell", group: "CyberFitness", color: "green", isImportant: true},
  { path: "/settings", name: "System Config", icon: "FaGears", group: "CyberFitness", color: "blue" },  
  { path: "/partner", name: "Alliance Perks", icon: "fabookuser", group: "CyberFitness", color: "purple"}, 
  
  // Content & Tools
  // ... (rest of the pages remain the same)
  { path: "/jumpstart", name: "Jumpstart Kit", icon: "FaRocket", group: "Content & Tools", isImportant: true, color: "lime" },
  { path: "/purpose-profit", name: "Purpose & Profit", icon: "FaBookOpen", group: "Content & Tools", color: "purple" },
  { path: "/ai-work-future", name: "AI & Future of Work", icon: "FaNetworkWired", group: "Content & Tools", color: "cyan" },
  { path: "/advice", name: "Advice Archive", icon: "FaRegLightbulb", group: "Content & Tools", color: "orange" },
  { path: "/expmind", name: "Experimental Mindset", icon: "FaBrain", group: "Content & Tools", color: "pink" },
  { path: "/style-guide", name: "Style Guide", icon: "FaPalette", group: "Content & Tools", color: "gray" },
  { path: "/onesitepls", name: "oneSitePls Info", icon: "FaCircleInfo", group: "Content & Tools", color: "gray" },
  { path: "/finance-literacy-memo", name: "Finance Literacy Memo", icon: "FaDollarSign", group: "Content & Tools", color: "green"},
  
  // Misc
  { path: "/cartest", name: "Cyber Garage", icon: "FaCarOn", group: "Misc", color: "blue" },
  { path: "/botbusters", name: "Bot Busters", icon: "FaRobot", group: "Misc", color: "blue"},
  { path: "/bullshitdetector", name: "BS Detector", icon: "FaMagnifyingGlass", group: "Misc", color: "yellow" },
  { path: "/wheel-of-fortune", name: "Wheel of Fortune", icon: "FaGift", group: "Misc", color: "lime" },
  { path: "/invoices", name: "My Invoices", icon: "FaFileInvoiceDollar", group: "Misc", color: "green" },
  { path: "/donate", name: "Donate", icon: "FaHeart", group: "Misc", color: "red" },
  { path: "/onesiteplsinstructions", name: "oneSitePls How-To", icon: "FaListCheck", group: "Misc", color: "gray" },
  { path: "/rent-car", name: "Rent a Car", icon: "FaCarOn", group: "Misc", color: "yellow" },
  { path: "/vpr-tests", name: "VPR Tests", icon: "FaListCheck", group: "Misc", color: 'pink' },
  { path: "/vpr/geography/6/cheatsheet", name: "Geo Cheatsheet 6", icon: "FaGlobe", group: "Misc", color: 'green' },
  { path: "/vpr/history/6/cheatsheet", name: "History Cheatsheet 6", icon: "FaLandmarkDome", group: "Misc", color: 'yellow' },
  { path: "/vpr/biology/6/cheatsheet", name: "Biology Cheatsheet 6", icon: "FaLeaf", group: "Misc", color: 'lime' },
  
  // Admin Zone
  { path: "/admin", name: "Admin Panel", icon: "FaUserShield", group: "Admin Zone", isAdminOnly: true, color: "red" },
  { path: "/advice-upload", name: "Upload Advice", icon: "FaUpload", group: "Admin Zone", isAdminOnly: true, color: "red" },
  { path: "/shadow-fleet-admin", name: "Fleet Admin", icon: "FaCarOn", group: "Admin Zone", isAdminOnly: true, color: "red" },
  { path: "/youtubeAdmin", name: "YT Admin", icon: "FaYoutube", group: "Admin Zone", isAdminOnly: true, color: "red" },
];

const groupOrder = ["Core Vibe", "GTA Vibe Missions", "CyberFitness", "Content & Tools", "Misc", "Admin Zone"];
const groupIcons: Record<string, string> = {
    "Core Vibe": "FaBolt",
    "GTA Vibe Missions": "FaGamepad", // Changed Icon
    "CyberFitness": "FaDumbbell", 
    "Content & Tools": "FaPuzzlePiece",
    "Misc": "FaLayerGroup", 
    "Admin Zone": "FaShieldHalved",
};

const translations: Record<string, Record<string, string>> = {
  en: {
    // ... (other translations remain the same)
    "Image Swap Mission": "Image Swap Mission", "Icon Demining Mission": "Icon Demining Mission", "Video Render Mission": "Video Render Mission", "Inception Swap Mission": "Inception Swap Mission", "The Fifth Door Mission": "The Fifth Door Mission",
    "Start Training": "Start Training",
    "Tutorial Quests": "Tutorial Quests", // Keep old key for safety, new key below
    "GTA Vibe Missions": "GTA Vibe Missions",
    // ... (other translations remain the same)
  },
  ru: {
    // ... (other translations remain the same)
    "Image Swap Mission": "Миссия: Битый Пиксель", "Icon Demining Mission": "Миссия: Сапёр Иконок", "Video Render Mission": "Миссия: Видео-Рендер", "Inception Swap Mission": "Миссия: Inception Swap", "The Fifth Door Mission": "Миссия: Пятая Дверь",
    "Start Training": "Начать Тренировку",
    "Tutorial Quests": "Учебные Миссии", // Keep old key
    "GTA Vibe Missions": "GTA Vibe Миссии",
    // ... (other translations remain the same)
  }
};
// Ensure all English and Russian keys from allPages are present in translations above.

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
  const { isAdmin, user, dbUser, isLoading: appContextLoading } = useAppContext(); // Added dbUser
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

  const fetchProfile = useCallback(async () => {
    if (dbUser?.user_id) {
      setProfileLoading(true);
      const profileData = await fetchUserCyberFitnessProfile(dbUser.user_id);
      if (profileData.success && profileData.data) {
        setCyberProfile(profileData.data);
      }
      setProfileLoading(false);
    } else {
      setProfileLoading(false);
    }
  }, [dbUser?.user_id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const t = useCallback((key: string): string => translations[currentLang]?.[key] || translations['en']?.[key] || key, [currentLang]);
  const toggleLang = useCallback(() => setCurrentLang(prevLang => prevLang === 'en' ? 'ru' : 'en'), []);

  const currentLogoText = useMemo(() => {
    const page = allPages.find(p => p.path === pathname);
    if (pathname?.startsWith('/vpr')) return "VPR";
    if (pathname?.startsWith('/tutorials')) { 
        const tutorialName = t(page?.name || "Missions");
        return tutorialName.length > 10 ? "MISSIONS" : tutorialName.toUpperCase();
    }
    if (page?.name) {
        const translatedPageName = t(page.name);
        const firstWord = translatedPageName.split(' ')[0];
        if (firstWord.length <= 6) return firstWord.toUpperCase(); 
        if (page.name.length <= 6) return page.name.toUpperCase(); 
    }
    return "CYBERVIBE"; 
  }, [pathname, t]);
  
  const logoCyberPart = currentLogoText === "CYBERVIBE" ? "CYBER" : currentLogoText;
  const logoVicePart = currentLogoText === "CYBERVIBE" ? "VIBE" : "";

  const groupedAndFilteredPages = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    let currentIsAdminReal = false;
    if (!appContextLoading && typeof isAdmin === 'function') {
      currentIsAdminReal = isAdmin();
    }
    
    const filtered = allPages
      .filter(page => {
        if (page.isAdminOnly && !currentIsAdminReal) return false;
        if (page.group === "GTA Vibe Missions" && page.questId && cyberProfile && !profileLoading) {
          return isQuestUnlocked(page.questId, cyberProfile.completedTutorials, QUEST_ORDER);
        }
        return true;
      })
      .map(page => ({ ...page, translatedName: t(page.name) }))
      .filter(page => page.translatedName!.toLowerCase().includes(lowerSearchTerm));

    const groups: Record<string, PageInfo[]> = {};
    groupOrder.forEach(groupName => {
        if (groupName === "Admin Zone" && !currentIsAdminReal && !appContextLoading) {
            return; 
        }
        groups[groupName] = [];
    });

    filtered.forEach(page => {
      const groupName = page.group || "Misc";
      if (!groups[groupName] && groupName === "Admin Zone" && currentIsAdminReal) {
        groups[groupName] = [];
      } else if (!groups[groupName] && groupName !== "Admin Zone") {
        groups[groupName] = [];
      }
      
      if (groups[groupName]) {
        groups[groupName].push(page);
      }
    });
    return groups;
  }, [searchTerm, isAdmin, t, appContextLoading, cyberProfile, profileLoading]);

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

  const RenderIcon = ({ icon, className }: { icon?: string; className?: string }) => {
    if (!icon) return null;
    return <VibeContentRenderer content={`::${icon}::`} className={className || ''} />;
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
                {profileLoading && !cyberProfile && <div className="text-center text-brand-cyan font-mono"><VibeContentRenderer content="::FaSpinner className='animate-spin':: Загрузка профиля агента..."/></div>}
                {groupOrder.map(groupName => {
                  const pagesInGroup = groupedAndFilteredPages[groupName];
                  if (!pagesInGroup || pagesInGroup.length === 0) return null; 
                  
                  const groupIconName = groupIcons[groupName];
                  const isGtaVibeGroup = groupName === "GTA Vibe Missions";

                  return (
                    <div key={groupName}>
                      <h3 className={cn(
                        "text-lg font-orbitron mb-3 flex items-center gap-2",
                        isGtaVibeGroup ? "gta-vibe-text-effect text-2xl justify-center py-2" : "text-brand-purple"
                        )}>
                        {groupIconName && !isGtaVibeGroup && <RenderIcon icon={groupIconName} className="w-6 h-6 opacity-80" />} 
                        {isGtaVibeGroup && <FaGamepad className={cn("w-7 h-7 mr-2", "text-transparent")} /> /* Invisible but takes space for gta-vibe-text-effect */}
                        {t(groupName)}
                         {isGtaVibeGroup && <FaGamepad className={cn("w-7 h-7 ml-2", "text-transparent")} />}
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