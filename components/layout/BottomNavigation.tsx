"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  FaBrain,
  FaUpLong,
  FaGithub,
  FaChartLine,
  FaUserNinja,
} from "react-icons/fa6";
import { cn } from "@/lib/utils";
import { debugLogger as logger } from "@/lib/debugLogger";

const bottomNavVariants = {
  hidden: { y: 100, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 120, damping: 25, delay: 0.5 },
  },
};

const navItems = [
  { href: "/", icon: FaBrain, label: "OS Home", color: "text-brand-pink" },
  { href: "/selfdev/gamified", icon: FaUpLong, label: "LevelUp", color: "text-brand-green" },
  { href: "/repo-xml", icon: FaGithub, label: "Studio", isCentral: true, centralColor: "from-brand-orange to-brand-yellow"},
  { href: "/p-plan", icon: FaChartLine, label: "VibePlan", color: "text-brand-cyan" },
  { href: "/profile", icon: FaUserNinja, label: "AgentOS", color: "text-brand-yellow" }, // Added Profile link
];

interface BottomNavigationProps {
  pathname: string;
}

export default function BottomNavigation({ pathname }: BottomNavigationProps) {
  logger.debug(`[BottomNavigation] Rendering for pathname: ${pathname}`);
  return (
    <motion.div
      variants={bottomNavVariants}
      initial="hidden"
      animate="visible"
      className="bottom-nav-cyber" // This class is defined in globals.css and handles fixed positioning
    >
      <div className="container mx-auto flex justify-around items-center max-w-xs sm:max-w-sm">
        {navItems.map((item) => {
          // For exact match on "/", otherwise startsWith for nested routes
          const isActive = item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);
          // logger.debug(`[BottomNavigation] Item: ${item.label}, href: ${item.href}, isActive: ${isActive}`); // Reduced verbosity
          
          return item.isCentral ? (
            <Button
              asChild
              size="icon"
              className={cn(
                `bottom-nav-item-central bg-gradient-to-br ${item.centralColor}`,
                isActive && "ring-4 ring-brand-cyan/80 ring-offset-2 ring-offset-dark-bg shadow-lg shadow-brand-cyan/60"
              )}
              key={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Link href={item.href}>
                <item.icon className="w-6 h-6 sm:w-7 sm:h-7" />
                <span className="sr-only">{item.label}</span>
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              variant="ghost"
              className={cn(
                "bottom-nav-item", // Base styles from globals.css
                isActive && "active-bottom-link" // Generic active class for background
              )}
              key={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Link href={item.href} className={cn(
                "flex flex-col items-center justify-center w-full h-full",
                 item.color, // Apply color class for text/icon
                 isActive ? "opacity-100 current-nav-glow" : "opacity-70 hover:opacity-100"
              )}>
                <item.icon className="w-5 h-5 sm:w-6 sm:h-6 mb-0.5" />
                <span className="text-[0.6rem] sm:text-xs font-orbitron tracking-tighter leading-none">
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