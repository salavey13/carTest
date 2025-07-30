"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";
import { useAppContext } from '@/contexts/AppContext';
import React from 'react';

const bottomNavVariants = {
  hidden: { y: 100, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 120, damping: 25, delay: 0.5 } },
};

interface NavItemConfig {
  href: string;
  icon: string;
  label: string;
  color?: string;
}

const SAUNA_NAV_ITEMS: NavItemConfig[] = [
  { href: "/sauna-rent", icon: "FaHome", label: "Главная", color: "text-amber-300" },
  { href: "/sauna-rent#cabins", icon: "FaHotTubPerson", label: "Парилки", color: "text-amber-300" },
  { href: "/sauna-rent#rules", icon: "FaClipboardList", label: "Правила", color: "text-amber-300" },
  { href: "/sauna-rent#faq", icon: "FaQuestionCircle", label: "FAQ", color: "text-amber-300" },
];

interface BottomNavigationProps {
  pathname: string;
}

export default function BottomNavigationSauna({ pathname }: BottomNavigationProps) {
  const { dbUser, isLoading: appCtxLoading, isAuthenticating } = useAppContext();

  const navItemsToDisplay = SAUNA_NAV_ITEMS;

  if (appCtxLoading || isAuthenticating || !dbUser || navItemsToDisplay.length === 0) {
    return null;
  }

  return (
    <motion.div
      key="sauna-nav"
      variants={bottomNavVariants}
      initial="hidden"
      animate="visible"
      className="bottom-nav-cyber"
    >
      <div className="container mx-auto flex justify-around items-center px-1 max-w-sm">
        {navItemsToDisplay.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Button
              asChild
              variant="ghost"
              className={cn("bottom-nav-item flex-1", isActive && "active-bottom-link")}
              key={item.label}
              title={item.label}
            >
              <Link href={item.href} className={cn(
                "flex flex-col items-center justify-center w-full h-full",
                item.color,
                isActive ? "opacity-100 current-nav-glow" : "opacity-70 hover:opacity-100"
              )}>
                <VibeContentRenderer content={`::${item.icon}::`} className="w-6 h-6 mb-0.5" />
                <span className="text-[0.6rem] font-sans tracking-tight leading-none text-center">
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