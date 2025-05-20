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
  FaCrosshairs, // Added for Leads
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
  { href: "/leads", icon: FaCrosshairs, label: "Leads", isCentral: true, centralColor: "from-brand-purple to-brand-pink"}, // Added Leads item
  { href: "/p-plan", icon: FaChartLine, label: "VibePlan", color: "text-brand-cyan" },
  { href: "/profile", icon: FaUserNinja, label: "AgentOS", color: "text-brand-yellow" },
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
      className="bottom-nav-cyber" 
    >
      <div className="container mx-auto flex justify-around items-center max-w-md sm:max-w-lg px-1"> {/* Adjusted max-w for 6 items */}
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);
          
          return item.isCentral ? (
            <Button
              asChild
              size="icon"
              className={cn(
                `bottom-nav-item-central bg-gradient-to-br ${item.centralColor} mx-0.5 sm:mx-1`, 
                isActive && "ring-4 ring-brand-cyan/80 ring-offset-2 ring-offset-dark-bg shadow-lg shadow-brand-cyan/60"
              )}
              key={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Link href={item.href}>
                <item.icon className="w-6 h-6 sm:w-7 sm:h-7 text-black" /> 
                <span className="sr-only">{item.label}</span>
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              variant="ghost"
              className={cn(
                "bottom-nav-item", 
                isActive && "active-bottom-link" 
              )}
              key={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Link href={item.href} className={cn(
                "flex flex-col items-center justify-center w-full h-full",
                 item.color, 
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