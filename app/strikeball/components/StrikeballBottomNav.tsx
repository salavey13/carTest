"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { FaCrosshairs, FaUsers, FaShieldHalved, FaSkull, FaUserShield } from "react-icons/fa6";
import { useAppContext } from "@/contexts/AppContext";

const navItems = [
  { href: "/strikeball", label: "ГЛАВНАЯ", key: "1", icon: FaCrosshairs, color: "text-red-500" },
  { href: "/strikeball/lobbies", label: "ОТРЯДЫ", key: "2", icon: FaUsers, color: "text-cyan-400" },
  { href: "/strikeball/shop", label: "АРСЕНАЛ", key: "3", icon: FaShieldHalved, color: "text-emerald-400" },
  { href: "/strikeball/stats", label: "СТАТА", key: "4", icon: FaSkull, color: "text-amber-400" }
];

export default function StrikeballBottomNav() {
  const pathname = usePathname();
  const { dbUser, isAdmin } = useAppContext();
  
  // Check admin status
  const isUserAdmin = isAdmin && isAdmin();

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
            <Link key={item.href} href={item.href} className="relative group w-20 sm:w-24 h-16 sm:h-20 border-r border-zinc-800 last:border-r-0">
              <div className={cn("absolute inset-0 bg-gradient-to-t from-white/10 to-transparent transition-opacity duration-200", isActive ? "opacity-100" : "opacity-0 group-hover:opacity-50")} />
              {isActive && (
                <motion.div layoutId="weapon-select" className={cn("absolute top-0 left-0 right-0 h-1 shadow-[0_0_10px_currentColor]", item.color.replace('text-', 'bg-'))} />
              )}
              <div className="flex flex-col items-center justify-between h-full p-2">
                <span className="self-start text-[8px] font-mono text-zinc-600 font-bold">[{item.key}]</span>
                <Icon className={cn("w-6 h-6 transition-all duration-200", isActive ? `scale-110 ${item.color} drop-shadow-[0_0_8px_currentColor]` : "text-zinc-600 group-hover:text-zinc-400")} />
                <span className={cn("text-[9px] font-orbitron font-bold tracking-widest uppercase", isActive ? "text-white" : "text-zinc-600")}>{item.label}</span>
              </div>
            </Link>
          );
        })}

        {/* ADMIN BUTTON */}
        {isUserAdmin && (
            <Link href="/strikeball/admin" className="relative group w-20 sm:w-24 h-16 sm:h-20 border-l border-zinc-800">
               <div className={cn("absolute inset-0 bg-gradient-to-t from-red-900/40 to-transparent transition-opacity duration-200", pathname === "/strikeball/admin" ? "opacity-100" : "opacity-0 group-hover:opacity-50")} />
               {pathname === "/strikeball/admin" && (
                   <motion.div layoutId="weapon-select" className="absolute top-0 left-0 right-0 h-1 bg-red-600 shadow-[0_0_10px_red]" />
               )}
               <div className="flex flex-col items-center justify-between h-full p-2">
                   <span className="self-start text-[8px] font-mono text-red-700 font-bold">[0]</span>
                   <FaUserShield className={cn("w-6 h-6 transition-all", pathname === "/strikeball/admin" ? "text-red-500 scale-110" : "text-zinc-600")} />
                   <span className={cn("text-[9px] font-orbitron font-bold tracking-widest uppercase", pathname === "/strikeball/admin" ? "text-white" : "text-zinc-600")}>ADMIN</span>
               </div>
            </Link>
        )}
      </motion.nav>
    </div>
  );
}