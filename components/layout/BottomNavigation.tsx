// /components/layout/BottomNavigation.tsx
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
  label: string; // This will be the key for translation
  color?: string;
  isCentral?: boolean;
  centralColor?: string;
  minLevelShow: number;
  adminOnly?: boolean;
  supportOnly?: boolean;
  isFallback?: boolean;
}

// Define all possible items that COULD be in the bottom nav
const ALL_POSSIBLE_NAV_ITEMS: NavItemConfig[] = [
  { href: "/", icon: FaBrain, label: "OS Home", color: "text-brand-pink", minLevelShow: 0, isFallback: true },
  { href: "/hotvibes", icon: FaFire, label: "HotVibes", isCentral: true, centralColor: "from-brand-purple to-brand-orange", minLevelShow: 0, isFallback: true },
  { href: "/profile", icon: FaUserNinja, label: "AgentOS", color: "text-brand-yellow", minLevelShow: 0, isFallback: true },
  { href: "/selfdev/gamified", icon: FaUpLong, label: "LevelUp", color: "text-brand-green", minLevelShow: 1 },
  { href: "/repo-xml", icon: FaGithub, label: "Studio", isCentral: true, centralColor: "from-brand-orange to-brand-yellow", minLevelShow: 1 },
  { href: "/p-plan", icon: FaChartLine, label: "VibePlan", color: "text-brand-cyan", minLevelShow: 1 },
  { href: "/leads", icon: FaCrosshairs, label: "Leads", isCentral: false, color: "text-brand-purple", minLevelShow: 2, supportOnly: true },
];

// Translations for bottom nav labels specifically
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
    if (appCtxLoading || isAuthenticating) {
      logger.debug("[BottomNav] Context loading/authenticating, returning no items yet.");
      return [];
    }

    const cyberProfile = dbUser?.metadata?.cyberFitness as CyberFitnessProfile | undefined;
    const userLevel = cyberProfile?.level ?? 0;
    const userRole = dbUser?.role;

    logger.debug(`[BottomNav] Filtering items. UserLevel: ${userLevel}, IsAdmin: ${isAdmin}, Role: ${userRole}`);

    let items: NavItemConfig[];

    if (!dbUser && !isAdmin) { // Guest user (not authenticated and not overridden as admin for dev)
      items = ALL_POSSIBLE_NAV_ITEMS.filter(item => item.isFallback);
      logger.debug("[BottomNav] Guest user, showing fallback items:", items.map(i => i.label));
    } else if (userLevel === 0 && !isAdmin && !dbUser?.role?.includes('support')) { // True Level 0 non-admin, non-support
      items = ALL_POSSIBLE_NAV_ITEMS.filter(item => item.isFallback);
       logger.debug(`[BottomNav] Level 0 user (not admin/support), showing fallback items:`, items.map(i => i.label));
    }
     else { // Authenticated users with level > 0, or admin, or support
      items = ALL_POSSIBLE_NAV_ITEMS.filter(item => {
        if (item.adminOnly && !isAdmin) return false;
        if (item.supportOnly && !(isAdmin || userRole === 'support')) return false;
        return userLevel >= item.minLevelShow || isAdmin;
      });
      logger.debug("[BottomNav] Authenticated/Admin/Support user, showing filtered items:", items.map(i => i.label));
    }

    // Attempt to balance and prioritize central items
    let finalLayout: NavItemConfig[] = [];
    const maxItems = 5; // Target max items

    const centralItemsFromFiltered = items.filter(i => i.isCentral);
    const nonCentralItemsFromFiltered = items.filter(i => !i.isCentral);

    // Priority for central display: HotVibes, then Studio
    const hotVibesCentral = centralItemsFromFiltered.find(i => i.label === "HotVibes");
    const studioCentral = centralItemsFromFiltered.find(i => i.label === "Studio");
    
    const chosenCentralItems: NavItemConfig[] = [];
    if (hotVibesCentral) chosenCentralItems.push(hotVibesCentral);
    if (studioCentral && chosenCentralItems.length < 2 && studioCentral.label !== hotVibesCentral?.label) {
         chosenCentralItems.push(studioCentral);
    }

    // Start building the layout
    const otherItems = nonCentralItemsFromFiltered.filter(
        ni => !chosenCentralItems.some(ci => ci.label === ni.label)
    );

    // Distribute non-central items around central ones
    // This is a simplified distribution logic aiming for 5 items with 1 or 2 central.
    // If 1 central item, it's [NC, NC, C, NC, NC]
    // If 2 central items, it's [NC, C, NC, C, NC] or [NC, C, C, NC, NC] depending on count
    
    const desiredTotal = Math.min(items.length, maxItems);
    const numNonCentral = desiredTotal - chosenCentralItems.length;

    if (chosenCentralItems.length === 1) {
        const centralItem = chosenCentralItems[0];
        const leftCount = Math.ceil(numNonCentral / 2);
        const rightCount = numNonCentral - leftCount;
        finalLayout.push(...otherItems.slice(0, leftCount));
        finalLayout.push(centralItem);
        finalLayout.push(...otherItems.slice(leftCount, leftCount + rightCount));
    } else if (chosenCentralItems.length >= 2) {
        // Take first two central for this example layout
        const c1 = chosenCentralItems[0];
        const c2 = chosenCentralItems[1];
        const leftCount = Math.floor(numNonCentral / 2) > 0 ? 1 : 0; // Max 1 on left of first central
        const middleCount = Math.max(0, numNonCentral - leftCount - (numNonCentral > leftCount ? 1: 0) ); // Max 1 in middle
        const rightCount = Math.max(0, numNonCentral - leftCount - middleCount);

        finalLayout.push(...otherItems.slice(0, leftCount));
        finalLayout.push(c1);
        finalLayout.push(...otherItems.slice(leftCount, leftCount + middleCount));
        finalLayout.push(c2);
        finalLayout.push(...otherItems.slice(leftCount + middleCount, leftCount + middleCount + rightCount));
    } else { // No central items (should not happen with HotVibes as fallback)
        finalLayout.push(...otherItems.slice(0, desiredTotal));
    }
    
    // Ensure the total doesn't exceed maxItems, unless fewer were available
    finalLayout = finalLayout.slice(0, desiredTotal);

    logger.debug(`[BottomNav] Final layout for level ${userLevel}, admin ${isAdmin}:`, finalLayout.map(i => i.label));
    return finalLayout;

  }, [dbUser, appCtxLoading, isAuthenticating, isAdmin]);

  if (appCtxLoading || isAuthenticating || navItemsToDisplay.length === 0) {
    logger.debug("[BottomNav] Either loading or no items to display. Returning null.");
    return null;
  }

  return (
    <motion.div
      key={navItemsToDisplay.map(item => item.href).join('-')} // Add key to force re-render on item change
      variants={bottomNavVariants}
      initial="hidden"
      animate="visible"
      className="bottom-nav-cyber"
    >
      <div className={cn(
          "container mx-auto flex justify-around items-center px-1",
          navItemsToDisplay.length <= 3 ? "max-w-[280px]" : // Tighter for 3 items
          navItemsToDisplay.length === 4 ? "max-w-xs" : 
          navItemsToDisplay.length === 5 ? "max-w-sm" : 
          "max-w-md sm:max-w-lg"
      )}>
        {navItemsToDisplay.map((item) => {
          const isActive = item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);
          const IconComponent = item.icon;

          return item.isCentral ? (
            <Button
              asChild
              size="icon"
              className={cn(
                `bottom-nav-item-central bg-gradient-to-br ${item.centralColor} mx-0.5 sm:mx-1`,
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
                "bottom-nav-item flex-1 px-0.5 py-1 sm:px-1", // Adjusted padding
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
                <IconComponent className="w-5 h-5 sm:w-[22px] sm:h-[22px] mb-0.5" /> {/* Slightly smaller icon for non-central */}
                <span className="text-[0.55rem] sm:text-[0.6rem] font-orbitron tracking-tight leading-none text-center line-clamp-1"> {/* even smaller text */}
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