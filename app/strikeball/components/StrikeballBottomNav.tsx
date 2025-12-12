"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { FaCrosshairs, FaUsers, FaShieldHalved, FaSkull } from "react-icons/fa6";

const navItems = [
  { 
    href: "/strikeball", 
    label: "MAIN", 
    key: "1",
    icon: FaCrosshairs,
    color: "text-red-500" // Plasma/Rocket Red
  },
  { 
    href: "/strikeball/lobbies", 
    label: "SQUADS", 
    key: "2",
    icon: FaUsers,
    color: "text-cyan-400" // Railgun Blue
  },
  { 
    href: "/strikeball/shop", 
    label: "ARMORY", 
    key: "3",
    icon: FaShieldHalved,
    color: "text-emerald-400" // Health Green
  },
  {
    href: "/strikeball/stats", 
    label: "FRAGS", 
    key: "4",
    icon: FaSkull,
    color: "text-amber-400" // Armor Yellow
  }
];

export default function StrikeballBottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-4 px-2 pointer-events-none">
      <motion.nav
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
        className="pointer-events-auto bg-black/90 backdrop-blur-xl border border-zinc-800 rounded-lg shadow-[0_0_40px_rgba(0,0,0,0.8)] overflow-hidden flex"
      >
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link 
              key={item.href} 
              href={item.href}
              className="relative group w-20 sm:w-24 h-16 sm:h-20 border-r border-zinc-800 last:border-r-0"
            >
              {/* Active Background Glow */}
              <div className={cn(
                "absolute inset-0 bg-gradient-to-t from-white/10 to-transparent transition-opacity duration-200",
                isActive ? "opacity-100" : "opacity-0 group-hover:opacity-50"
              )} />

              {/* The "Selected Weapon" Indicator Bar */}
              {isActive && (
                <motion.div 
                  layoutId="weapon-select"
                  className={cn("absolute top-0 left-0 right-0 h-1 shadow-[0_0_10px_currentColor]", item.color.replace('text-', 'bg-'))}
                />
              )}

              <div className="flex flex-col items-center justify-between h-full p-2">
                {/* Hotkey Number */}
                <span className="self-start text-[8px] font-mono text-zinc-600 font-bold">[{item.key}]</span>
                
                {/* Icon */}
                <Icon className={cn(
                  "w-6 h-6 transition-all duration-200",
                  isActive ? `scale-110 ${item.color} drop-shadow-[0_0_8px_currentColor]` : "text-zinc-600 group-hover:text-zinc-400"
                )} />

                {/* Label */}
                <span className={cn(
                  "text-[9px] font-orbitron font-bold tracking-widest uppercase",
                  isActive ? "text-white" : "text-zinc-600"
                )}>
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </motion.nav>
    </div>
  );
}