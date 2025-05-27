"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  FaBrain, FaUpLong, FaGithub, FaChartLine, FaUserNinja, FaCrosshairs, FaFire // Added FaFire
} from "react-icons/fa6";
import { cn } from "@/lib/utils";
import { debugLogger as logger } from "@/lib/debugLogger";
import { useAppContext } from '@/contexts/AppContext';
import type { CyberFitnessProfile } from '@/hooks/cyberFitnessSupabase';
import React, { useMemo } from 'react'; // Added React and useMemo

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
  isCentral?: boolean;
  centralColor?: string;
  minLevelShow: number; // Always show if currentLevel >= minLevelShow
  adminOnly?: boolean;
  supportOnly?: boolean;
  isFallback?: boolean; // To identify essential items for L0/guest
}

const ALL_POSSIBLE_NAV_ITEMS: NavItemConfig[] = [
  { href: "/", icon: FaBrain, label: "OS Home", color: "text-brand-pink", minLevelShow: 0, isFallback: true },
  { href: "/hotvibes", icon: FaFire, label: "HotVibes", isCentral: true, centralColor: "from-brand-red to-brand-orange", minLevelShow: 0, isFallback: true },
  { href: "/profile", icon: FaUserNinja, label: "AgentOS", color: "text-brand-yellow", minLevelShow: 0, isFallback: true },
  // Items for Lvl 1+
  { href: "/selfdev/gamified", icon: FaUpLong, label: "LevelUp", color: "text-brand-green", minLevelShow: 1 },
  { href: "/repo-xml", icon: FaGithub, label: "Studio", isCentral: true, centralColor: "from-brand-orange to-brand-yellow", minLevelShow: 1 },
  { href: "/p-plan", icon: FaChartLine, label: "VibePlan", color: "text-brand-cyan", minLevelShow: 1 },
  { href: "/leads", icon: FaCrosshairs, label: "Leads", isCentral: false, color: "text-brand-purple", minLevelShow: 2, supportOnly: true }, // No longer central by default
];

interface BottomNavigationProps {
  pathname: string;
}

export default function BottomNavigation({ pathname }: BottomNavigationProps) {
  const appContext = useAppContext(); // Get full context
  const { dbUser, isLoading: appCtxLoading, isAuthenticating, isAdmin: isAdminFunc } = appContext;

  const isAdmin = useMemo(() => {
    if (typeof isAdminFunc === 'function') return isAdminFunc();
    return false;
  }, [isAdminFunc]);

  const navItemsToDisplay = useMemo(() => {
    if (appCtxLoading || isAuthenticating) {
      return []; // Render nothing while context is loading
    }

    const cyberProfile = dbUser?.metadata?.cyberFitness as CyberFitnessProfile | undefined;
    const userLevel = cyberProfile?.level ?? 0;
    const userRole = dbUser?.role;
    const userStatus = dbUser?.status;

    let items: NavItemConfig[];

    if (!dbUser || userLevel === 0 && !isAdmin) { // Guest or True Level 0 non-admin
      items = ALL_POSSIBLE_NAV_ITEMS.filter(item => item.isFallback);
    } else {
      items = ALL_POSSIBLE_NAV_ITEMS.filter(item => {
        if (item.adminOnly && !isAdmin) return false;
        if (item.supportOnly && !(isAdmin || userRole === 'support')) return false; // Admin can see supportOnly
        return userLevel >= item.minLevelShow || isAdmin; // Admin sees all past minLevel
      });
    }
    
    // Simple logic: if more than 5 items, it might get crowded.
    // This example just takes the first 5-6 most relevant based on filtering.
    // More sophisticated logic could be added to prioritize central items or balance the layout.
    // For now, if we have Studio and HotVibes, let's try to make them central.
    // This is a basic example of trying to balance the bottom nav.
    const centralCandidates = items.filter(i => i.isCentral);
    const nonCentralItems = items.filter(i => !i.isCentral);

    let finalLayout: NavItemConfig[] = [];
    const maxItems = 5; // Max items for a clean look, adjust as needed

    if (items.length <= maxItems) {
        finalLayout = [...items]; // If few enough, use all filtered
    } else {
        // Prioritize: Home, Profile, HotVibes, Studio, then others if space
        const priorityOrder = ["OS Home", "HotVibes", "Studio", "AgentOS", "LevelUp", "VibePlan", "Leads"];
        priorityOrder.forEach(label => {
            if (finalLayout.length < maxItems) {
                const item = items.find(i => i.label === label);
                if (item && !finalLayout.some(fi => fi.label === item.label)) {
                    finalLayout.push(item);
                }
            }
        });
         // Ensure HotVibes and Studio get central styling if present
        finalLayout = finalLayout.map(item => {
            if ((item.label === "HotVibes" || item.label === "Studio") && centralCandidates.find(ci => ci.label === item.label)) {
                return {...item, isCentral: true, centralColor: centralCandidates.find(ci => ci.label === item.label)?.centralColor};
            }
            return {...item, isCentral: false}; // ensure others are not central
        });
    }
    // Sort to attempt putting central items towards the middle for odd numbers of items
    finalLayout.sort((a, b) => (a.isCentral ? -1 : 1) - (b.isCentral ? -1 : 1));
    if (finalLayout.length === 5 && finalLayout[2].isCentral && finalLayout[1].isCentral){ // if two central, try to space them
        // This is a hacky way to arrange 2 central items among 5. Better: predefined slots.
        const studio = finalLayout.find(i => i.label === 'Studio');
        const hotvibes = finalLayout.find(i => i.label === 'HotVibes');
        const others = finalLayout.filter(i => i.label !== 'Studio' && i.label !== 'HotVibes');
        if(studio && hotvibes && others.length === 3){
            finalLayout = [others[0], studio, others[1], hotvibes, others[2]];
        }
    } else if (finalLayout.length === 4 && finalLayout[1].isCentral && finalLayout[2].isCentral){
        const studio = finalLayout.find(i => i.label === 'Studio');
        const hotvibes = finalLayout.find(i => i.label === 'HotVibes');
        const others = finalLayout.filter(i => i.label !== 'Studio' && i.label !== 'HotVibes');
         if(studio && hotvibes && others.length === 2){
            finalLayout = [others[0], studio, hotvibes, others[1]];
        }
    }


    logger.debug(`[BottomNavigation] Final items to display for level ${userLevel}, admin ${isAdmin}:`, finalLayout.map(i => i.label));
    return finalLayout;

  }, [dbUser, appCtxLoading, isAuthenticating, isAdmin]);

  if (appCtxLoading || isAuthenticating || navItemsToDisplay.length === 0) {
    return null; 
  }

  return (
    <motion.div
      variants={bottomNavVariants}
      initial="hidden"
      animate="visible"
      className="bottom-nav-cyber"
    >
      <div className={cn(
          "container mx-auto flex justify-around items-center px-1",
          navItemsToDisplay.length <= 3 ? "max-w-xs" : navItemsToDisplay.length <= 5 ? "max-w-md" : "max-w-lg sm:max-w-xl" // Adjust width based on item count
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
                isActive && "ring-4 ring-brand-cyan/80 ring-offset-2 ring-offset-black shadow-lg shadow-brand-cyan/60" // Ensure --offset-dark-bg or similar var exists
              )}
              key={item.label}
              aria-current={isActive ? "page" : undefined}
              title={item.label} // Added title for accessibility
            >
              <Link href={item.href}>
                <IconComponent className="w-6 h-6 sm:w-7 sm:h-7 text-black" />
                <span className="sr-only">{item.label}</span>
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              variant="ghost"
              className={cn(
                "bottom-nav-item flex-1", // Added flex-1 for better spacing
                isActive && "active-bottom-link"
              )}
_              key={item.label}
              aria-current={isActive ? "page" : undefined}
              title={item.label} // Added title
            >
              <Link href={item.href} className={cn(
                "flex flex-col items-center justify-center w-full h-full",
                 item.color,
                 isActive ? "opacity-100 current-nav-glow" : "opacity-70 hover:opacity-100"
              )}>
                <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 mb-0.5" />
                <span className="text-[0.6rem] sm:text-[0.65rem] font-orbitron tracking-tighter leading-none text-center line-clamp-1"> {/* Adjusted font-size, added text-center and line-clamp */}
                  {item.label}
                </span>
              </Link>
            </Button>
          );
        })}
      </div>
    </motion.div>
  );
}