"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { FaCrosshairs, FaUsers, FaShieldHalved, FaBookSkull } from "react-icons/fa6";

const navItems = [
  { 
    href: "/strikeball", 
    label: "DEPLOY", 
    icon: FaCrosshairs,
    color: "text-red-500"
  },
  { 
    href: "/strikeball/lobbies", 
    label: "SQUADS", 
    icon: FaUsers,
    color: "text-cyan-500"
  },
  { 
    href: "/strikeball/shop", 
    label: "ARMORY", 
    icon: FaShieldHalved,
    color: "text-emerald-500"
  },
  {
    href: "/strikeball/history", // Conceptual page
    label: "LOGS",
    icon: FaBookSkull,
    color: "text-amber-500"
  }
];

export default function StrikeballBottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-2 sm:p-4 pointer-events-none flex justify-center">
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="pointer-events-auto bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-none sm:rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] w-full max-w-lg flex items-stretch relative overflow-hidden"
      >
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-zinc-800 via-red-900 to-zinc-800" />

        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link 
              key={item.href} 
              href={item.href}
              className="flex-1 group relative"
            >
              <div className={cn(
                "flex flex-col items-center justify-center py-3 sm:py-4 transition-all duration-300 h-full",
                isActive ? "bg-white/5" : "hover:bg-white/5"
              )}>
                {/* Active Indicator Bar */}
                {isActive && (
                  <motion.div 
                    layoutId="sb-nav-indicator"
                    className="absolute top-0 left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"
                  />
                )}

                <Icon className={cn(
                  "w-5 h-5 mb-1 transition-transform duration-300",
                  isActive ? `scale-110 ${item.color} drop-shadow-[0_0_8px_currentColor]` : "text-zinc-500 group-hover:text-zinc-300"
                )} />
                
                <span className={cn(
                  "text-[9px] font-orbitron tracking-widest font-bold",
                  isActive ? "text-zinc-100" : "text-zinc-600 group-hover:text-zinc-400"
                )}>
                  {item.label}
                </span>
              </div>
              
              {/* Divider */}
              <div className="absolute right-0 top-3 bottom-3 w-px bg-zinc-800 last:hidden pointer-events-none" />
            </Link>
          );
        })}
      </motion.div>
    </div>
  );
}