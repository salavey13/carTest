"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/contexts/AppContext";
import { CreateLobbyForm } from "./components/CreateLobbyForm";
import { cn } from "@/lib/utils";

// Q3 Style Menu Item
const Q3MenuItem = ({ 
  label, 
  subLabel, 
  href, 
  onClick, 
  disabled = false,
  isActive = false
}: { 
  label: string; 
  subLabel?: string; 
  href?: string; 
  onClick?: () => void; 
  disabled?: boolean;
  isActive?: boolean;
}) => {
  const [hovered, setHovered] = useState(false);

  const content = (
    <div 
      className={cn(
        "relative group flex items-center justify-between w-full py-5 px-6 border-b-2 transition-all duration-100 uppercase cursor-pointer select-none",
        disabled ? "opacity-50 cursor-not-allowed border-zinc-900" : 
        hovered || isActive ? "bg-red-950/60 border-red-600 pl-10" : "bg-black/60 border-zinc-800"
      )}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={!disabled ? onClick : undefined}
    >
      {/* "Selector" graphic */}
      {(hovered || isActive) && (
        <motion.div 
          layoutId="q3-selector"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500 text-3xl font-black"
        >
          ►
        </motion.div>
      )}

      <div className="flex flex-col">
        <span className={cn(
          "font-orbitron font-black text-2xl sm:text-3xl tracking-widest transition-colors shadow-black drop-shadow-md",
          hovered || isActive ? "text-red-500 scale-105 origin-left" : "text-zinc-400"
        )}>
          {label}
        </span>
        {subLabel && (
          <span className="text-[10px] sm:text-xs font-mono text-zinc-500 tracking-[0.2em]">
            {subLabel}
          </span>
        )}
      </div>

      {/* Industrial Scanline BG */}
      <div className="absolute inset-0 z-[-1] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.5)_3px)] pointer-events-none" />
    </div>
  );

  if (href && !disabled) {
    return <Link href={href} className="w-full">{content}</Link>;
  }
  return content;
};

export default function StrikeballDashboard() {
  const { user } = useAppContext();
  const [menuStep, setMenuStep] = useState<'main' | 'create'>('main');

  return (
    // Added pt-24 for top padding, pb-32 for bottom nav
    <div className="min-h-screen bg-zinc-950 text-white pt-24 pb-32 overflow-hidden relative font-orbitron">
      
      {/* Grungy Texture Overlay */}
      <div className="fixed inset-0 z-0 opacity-10 pointer-events-none" 
           style={{ 
             backgroundImage: `radial-gradient(circle, #330000 0%, #000000 80%)`
           }} 
      />
      
      {/* Header */}
      <div className="relative z-10 container mx-auto px-4 mb-10 text-center">
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-5xl sm:text-7xl font-black italic tracking-tighter text-zinc-300 drop-shadow-lg transform -skew-x-12">
            STRIKE<span className="text-red-600">BALL</span>
          </h1>
          <div className="mt-2 flex justify-center">
             <div className="bg-red-900/30 border-x-4 border-red-600 px-6 py-1 transform skew-x-12">
                <h2 className="text-xs sm:text-sm font-mono text-red-400 tracking-[0.3em] uppercase transform -skew-x-12">
                  Operator: {user?.username || "GUEST"}
                </h2>
             </div>
          </div>
        </motion.div>
      </div>

      {/* Main Menu Box */}
      <div className="relative z-10 max-w-lg mx-auto px-2 sm:px-4">
        <div className="border-4 border-zinc-800 bg-zinc-900/90 backdrop-blur-md p-1 shadow-[0_0_60px_rgba(100,0,0,0.3)] rounded-sm">
          <div className="border-2 border-red-900/30 p-1">
            
            <AnimatePresence mode="wait">
              {menuStep === 'main' ? (
                <motion.div 
                  key="main-menu"
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  className="space-y-3"
                >
                  <Q3MenuItem 
                    label="MULTIPLAYER" 
                    subLabel="BROWSE ACTIVE SQUADS" 
                    href="/strikeball/lobbies" 
                  />
                  
                  <Q3MenuItem 
                    label="CREATE SERVER" 
                    subLabel="HOST A NEW SKIRMISH" 
                    onClick={() => setMenuStep('create')} 
                  />
                  
                  <Q3MenuItem 
                    label="ARMORY" 
                    subLabel="RENTAL GEAR & UPGRADES" 
                    href="/strikeball/shop" 
                  />
                  
                  <div className="h-2" />

                  <Q3MenuItem 
                    label="QR CONNECT" 
                    subLabel="JOIN VIA FIELD SCAN" 
                    onClick={() => alert("Initializing Optical Sensors...")}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="create-menu"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 20, opacity: 0 }}
                >
                  <div className="bg-black/80 p-6 mb-4 border border-zinc-700">
                    <h3 className="text-red-500 text-xl font-black mb-4 uppercase tracking-widest border-b border-red-900 pb-2">Match Settings</h3>
                    <CreateLobbyForm />
                  </div>
                  
                  <Q3MenuItem 
                    label="BACK" 
                    subLabel="RETURN TO BASE" 
                    onClick={() => setMenuStep('main')} 
                  />
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="fixed bottom-20 left-0 right-0 p-4 text-center z-0 pointer-events-none">
         <p className="text-[10px] text-zinc-600 font-mono tracking-widest">
            SYSTEM READY. WAITING FOR COMMAND.
         </p>
      </div>

    </div>
  );
}