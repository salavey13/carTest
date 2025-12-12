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
    label: "MAIN", 
    number: "1",
    icon: FaCrosshairs,
    color: "text-red-500"
  },
  { 
    href: "/strikeball/lobbies", 
    label: "SQUADS", 
    number: "2",
    icon: FaUsers,
    color: "text-cyan-500"
  },
  { 
    href: "/strikeball/shop", 
    label: "ARMORY", 
    number: "3",
    icon: FaShieldHalved,
    color: "text-emerald-500"
  },
  {
    href: "/strikeball/history", // Future feature
    label: "LOGS",
    number: "4",
    icon: FaBookSkull,
    color: "text-amber-500"
  }
];

export default function StrikeballBottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-2 pointer-events-none flex justify-center pb-4 sm:pb-6">
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="pointer-events-auto flex gap-1 bg-black/80 backdrop-blur-xl border border-zinc-800 p-1 rounded-none shadow-[0_0_50px_rgba(0,0,0,0.8)]"
      >
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link 
              key={item.href} 
              href={item.href}
              className="relative group"
            >
              <div className={cn(
                "flex flex-col items-center justify-between w-16 sm:w-20 h-14 sm:h-16 p-1 border-2 transition-all duration-100 ease-out clip-path-slant",
                isActive 
                  ? "bg-zinc-800 border-red-500 scale-105 z-10" 
                  : "bg-zinc-900/80 border-zinc-700 hover:bg-zinc-800 hover:border-zinc-500"
              )}>
                
                {/* Number Key (Classic FPS style) */}
                <div className="self-start text-[8px] font-mono text-zinc-500 leading-none px-1">
                  {item.number}
                </div>

                <Icon className={cn(
                  "w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-200",
                  isActive ? `scale-110 ${item.color} drop-shadow-[0_0_5px_currentColor]` : "text-zinc-600"
                )} />
                
                <span className={cn(
                  "text-[8px] font-orbitron tracking-tighter font-bold uppercase",
                  isActive ? "text-zinc-100" : "text-zinc-600"
                )}>
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </motion.div>
    </div>
  );
}