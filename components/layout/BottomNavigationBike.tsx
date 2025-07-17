"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  FaMotorcycle,
  FaUsers,
  FaRankingStar,
  FaPlusCircle,
  FaWarehouse
} from "react-icons/fa6";
import { cn } from "@/lib/utils";
import { debugLogger as logger } from "@/lib/debugLogger";
import { useAppContext } from '@/contexts/AppContext';
import React, { useMemo, useCallback } from 'react';

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
  adminOnly?: boolean;
  isActuallyCentral?: boolean;
}

// Configuration for the bike rental navigation
const ALL_POSSIBLE_NAV_ITEMS: NavItemConfig[] = [
  { href: "/leaderboard", icon: FaRankingStar, label: "Leaderboard", color: "text-brand-yellow" },
  { href: "/crews", icon: FaUsers, label: "Crews", color: "text-brand-green" },
  { href: "/paddock", icon: FaWarehouse, label: "Paddock", color: "text-brand-cyan", adminOnly: true },
  { href: "/admin", icon: FaPlusCircle, label: "Admin", color: "text-brand-pink", adminOnly: false },
  // Central item is defined here, the layout logic will place it in the middle
  { href: "/rent-bike", icon: FaMotorcycle, label: "Rent", isCentralCandidate: true, centralColor: "from-amber-400 to-orange-500" },
];

const navTranslations: Record<string, Record<string, string>> = {
  en: {
    "Leaderboard": "Leaders",
    "Crews": "Crews",
    "Rent": "Rent",
    "Paddock": "Paddock",
    "Admin": "Admin",
  },
  ru: {
    "Leaderboard": "Лидеры",
    "Crews": "Команды",
    "Rent": "Аренда",
    "Paddock": "Паддок",
    "Admin": "Админ",
  }
};

interface BottomNavigationProps {
  pathname: string;
}

export default function BottomNavigation({ pathname }: BottomNavigationProps) {
  const { dbUser, isLoading: appCtxLoading, isAuthenticating, isAdmin: isAdminFunc, user: tgUser } = useAppContext();

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
    if (appCtxLoading || isAuthenticating || !dbUser) {
      logger.debug("[BottomNav] Context/dbUser loading or not available, returning no items yet.");
      return [];
    }

    logger.debug(`[BottomNav] Filtering bike rental items. IsAdmin: ${isAdmin}`);

    const availableItems = ALL_POSSIBLE_NAV_ITEMS.filter(item => {
      return !(item.adminOnly && !isAdmin);
    });

    let finalLayout: NavItemConfig[] = [];
    const maxItems = 5;

    let centralItem: NavItemConfig | undefined = availableItems.find(i => i.isCentralCandidate);
    
    if (centralItem) {
      centralItem = { ...centralItem, isActuallyCentral: true };
    }

    let otherItems = availableItems.filter(i => !i.isCentralCandidate);

    const desiredTotal = Math.min(availableItems.length, maxItems);
    let numNonCentral = centralItem ? desiredTotal - 1 : desiredTotal;
    numNonCentral = Math.max(0, numNonCentral);
    
    // Ensure `otherItems` does not cause the total to exceed maxItems
    otherItems = otherItems.slice(0, numNonCentral);

    if (centralItem) {
      const leftCount = Math.ceil(otherItems.length / 2);
      
      finalLayout.push(...otherItems.slice(0, leftCount));
      finalLayout.push(centralItem);
      finalLayout.push(...otherItems.slice(leftCount));
    } else {
      finalLayout.push(...otherItems.slice(0, desiredTotal));
    }

    logger.debug(`[BottomNav] Final layout:`, finalLayout.map(i => `${i.label}${i.isActuallyCentral ? " (C)" : ""}`));
    return finalLayout;

  }, [dbUser, appCtxLoading, isAuthenticating, isAdmin]);

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
                <IconComponent className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
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