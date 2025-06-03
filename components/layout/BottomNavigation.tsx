"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  FaBrain, FaUpLong, FaGithub, FaChartLine, FaUserNinja, FaCrosshairs, FaFire
} from "react-icons/fa6";
import { cn } from "@/lib/utils";
import { debugLogger as logger } from "@/lib/debugLogger";
import { useAppContext } from '@/contexts/AppContext';
import type { CyberFitnessProfile } from '@/hooks/cyberFitnessSupabase';
import React, { useMemo,useCallback  } from 'react';

const bottomNavVariants = {
  hidden: { y: 100, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 120, damping: 25, delay: 0.5 },
  },
};

interface NavItemConfig {
  href: string;
  icon: React.ElementType;
  label: string; 
  color?: string;
  isCentralCandidate?: boolean; 
  centralColor?: string;
  minLevelShow: number;
  adminOnly?: boolean;
  supportOnly?: boolean;
  isFallback?: boolean;
  isActuallyCentral?: boolean;
}

const ALL_POSSIBLE_NAV_ITEMS: NavItemConfig[] = [
  { href: "/", icon: FaBrain, label: "OS Home", color: "text-brand-pink", minLevelShow: 0, isFallback: true },
  { href: "/hotvibes", icon: FaFire, label: "HotVibes", color: "text-brand-orange", minLevelShow: 0, isFallback: true, isCentralCandidate: true, centralColor: "from-brand-orange to-brand-pink" }, 
  { href: "/profile", icon: FaUserNinja, label: "AgentOS", color: "text-brand-yellow", minLevelShow: 0, isFallback: true },
  { href: "/selfdev/gamified", icon: FaUpLong, label: "LevelUp", color: "text-brand-green", minLevelShow: 1 },
  { href: "/repo-xml", icon: FaGithub, label: "Studio", isCentralCandidate: true, centralColor: "from-brand-cyan to-brand-blue", minLevelShow: 1 }, 
  { href: "/p-plan", icon: FaChartLine, label: "VibePlan", color: "text-brand-cyan", minLevelShow: 1 },
  { href: "/leads", icon: FaCrosshairs, label: "Leads", isCentralCandidate: true, centralColor: "from-brand-lime to-brand-green", minLevelShow: 2, supportOnly: true },
];

const navTranslations: Record<string, Record<string, string>> = {
  en: {
    "OS Home": "OS Home", "HotVibes": "HotVibes", "AgentOS": "AgentOS",
    "LevelUp": "LevelUp", "Studio": "Studio", "VibePlan": "VibePlan", "Leads": "Leads"
  },
  ru: {
    "OS Home": "ОС Дом", "HotVibes": "Огонь!", "AgentOS": "АгентОС",
    "LevelUp": "Прокачка", "Studio": "Студия", "VibePlan": "VIBE План", "Leads": "Лиды"
  }
};

interface BottomNavigationProps {
  pathname: string;
}

export default function BottomNavigation({ pathname }: BottomNavigationProps) {
  const appContext = useAppContext();
  const { dbUser, isLoading: appCtxLoading, isAuthenticating, isAdmin: isAdminFunc, user: tgUser } = appContext;

  const currentLang = useMemo(() => (tgUser?.language_code === 'ru' ? 'ru' : 'en'), [tgUser?.language_code]);

  const tNav = useCallback((labelKey: string): string => {
    return navTranslations[currentLang]?.[labelKey] || navTranslations['en']?.[labelKey] || labelKey;
  }, [currentLang]);

  const isAdmin = useMemo(() => {
    if (typeof isAdminFunc === 'function') return isAdminFunc();
    logger.warn("[BottomNav] isAdminFunc not available on context");
    return false;
  }, [isAdminFunc]);

  const navItemsToDisplay = useMemo(() => {
    if (appCtxLoading || isAuthenticating || !appContext.dbUser) { 
      logger.debug("[BottomNav] Context/dbUser loading or not available, returning no items yet.");
      return [];
    }

    const cyberProfile = appContext.dbUser?.metadata?.cyberFitness as CyberFitnessProfile | undefined;
    const userLevel = cyberProfile?.level ?? 0;
    const userRole = appContext.dbUser?.role;

    logger.debug(`[BottomNav] Filtering items. UserLevel: ${userLevel}, IsAdmin: ${isAdmin}, Role: ${userRole}`);

    let availableItems = ALL_POSSIBLE_NAV_ITEMS.filter(item => {
        if (item.adminOnly && !isAdmin) return false;
        if (item.supportOnly && !(isAdmin || userRole === 'support')) return false;
        return userLevel >= item.minLevelShow || isAdmin;
    });
    
    if (availableItems.length === 0 && !isAdmin) { 
        availableItems = ALL_POSSIBLE_NAV_ITEMS.filter(item => item.isFallback);
        logger.debug("[BottomNav] No specific items after filtering, showing fallback items for non-admin:", availableItems.map(i => i.label));
    }

    let finalLayout: NavItemConfig[] = [];
    const maxItems = 5;

    let centralItem: NavItemConfig | undefined = undefined;
    const studioItem = availableItems.find(i => i.label === "Studio");
    const leadsItem = availableItems.find(i => i.label === "Leads");
    const hotVibesItem = availableItems.find(i => i.label === "HotVibes");

    if (studioItem) {
        centralItem = { ...studioItem, isActuallyCentral: true };
    } else if (leadsItem) {
        centralItem = { ...leadsItem, isActuallyCentral: true };
    } else if (hotVibesItem) {
        centralItem = { ...hotVibesItem, isActuallyCentral: true };
    }
    
    let otherItems = availableItems.filter(i => i.label !== centralItem?.label);
    
    const desiredTotal = Math.min(availableItems.length, maxItems);
    let numNonCentral = centralItem ? desiredTotal - 1 : desiredTotal;
    numNonCentral = Math.max(0, numNonCentral);

    if (centralItem) {
        const leftCount = Math.ceil(numNonCentral / 2);
        const rightCount = numNonCentral - leftCount;
        finalLayout.push(...otherItems.slice(0, leftCount));
        finalLayout.push(centralItem); 
        finalLayout.push(...otherItems.slice(leftCount, leftCount + rightCount));
    } else {
        finalLayout.push(...otherItems.slice(0, desiredTotal));
    }
    
    finalLayout = finalLayout.slice(0, Math.min(finalLayout.length, maxItems));

    logger.debug(`[BottomNav] Final layout for level ${userLevel}, admin ${isAdmin}, role ${userRole}:`, finalLayout.map(i => `${i.label}${i.isActuallyCentral ? " (C)" : ""}`));
    return finalLayout;

  }, [appContext.dbUser, appCtxLoading, isAuthenticating, isAdmin, appContext.user?.language_code]);

  if (appCtxLoading || isAuthenticating || !dbUser || navItemsToDisplay.length === 0) {
    logger.debug("[BottomNav] Either loading, no dbUser, or no items to display. Returning null.");
    return null;
  }

  return (
    <motion.div
      key={navItemsToDisplay.map(item => item.href).join('-')} 
      variants={bottomNavVariants}
      initial="hidden"
      animate="visible"
      className="bottom-nav-cyber"
    >
      <div className={cn(
          "container mx-auto flex justify-around items-center px-1",
          navItemsToDisplay.length <= 3 ? "max-w-[280px]" : 
          navItemsToDisplay.length === 4 ? "max-w-xs" : 
          navItemsToDisplay.length === 5 ? "max-w-sm" : 
          "max-w-md sm:max-w-lg"
      )}>
        {navItemsToDisplay.map((item) => {
          const isActive = item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);
          const IconComponent = item.icon;

          return item.isActuallyCentral ? ( 
            <Button
              asChild
              size="icon"
              className={cn(
                `bottom-nav-item-central bg-gradient-to-br ${item.centralColor || 'from-gray-700 to-gray-900'} mx-0.5 sm:mx-1`, 
                isActive && "ring-4 ring-brand-cyan/80 ring-offset-2 ring-offset-black shadow-lg shadow-brand-cyan/60"
              )}
              key={item.label}
              aria-current={isActive ? "page" : undefined}
              title={tNav(item.label)}
            >
              <Link href={item.href}>
                <IconComponent className="w-6 h-6 sm:w-7 sm:h-7 text-black" />
                <span className="sr-only">{tNav(item.label)}</span>
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              variant="ghost"
              className={cn(
                "bottom-nav-item flex-1 px-0.5 py-1 sm:px-1", 
                isActive && "active-bottom-link"
              )}
              key={item.label}
              aria-current={isActive ? "page" : undefined}
              title={tNav(item.label)}
            >
              <Link href={item.href} className={cn(
                "flex flex-col items-center justify-center w-full h-full",
                 item.color,
                 isActive ? "opacity-100 current-nav-glow" : "opacity-70 hover:opacity-100"
              )}>
                <IconComponent className="w-5 h-5 sm:w-[22px] sm:h-[22px] mb-0.5" /> 
                <span className="text-[0.55rem] sm:text-[0.6rem] font-orbitron tracking-tight leading-none text-center line-clamp-1"> 
                  {tNav(item.label)}
                </span>
              </Link>
            </Button>
          );
        })}
      </div>
    </motion.div>
  );
}