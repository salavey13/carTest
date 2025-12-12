"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/contexts/AppContext";
import { CreateLobbyForm } from "./components/CreateLobbyForm";
import { cn } from "@/lib/utils";
import { FaShieldHalved, FaUsers, FaCrosshairs, FaSkull, FaQrcode } from "react-icons/fa6";

// Q3 Style Menu Item Component
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
        "relative group flex items-center justify-between w-full p-4 border-b-2 transition-all duration-75 uppercase cursor-pointer select-none",
        disabled ? "opacity-50 cursor-not-allowed border-zinc-800" : 
        hovered || isActive ? "bg-red-900/40 border-red-500 pl-8" : "bg-black/40 border-zinc-700 pl-4"
      )}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={!disabled ? onClick : undefined}
    >
      {/* "Selector" graphic on the left */}
      {(hovered || isActive) && (
        <motion.div 
          layoutId="q3-selector"
          className="absolute left-2 top-1/2 -translate-y-1/2 text-red-500 text-2xl font-black"
        >
          ►
        </motion.div>
      )}

      <div className="flex flex-col">
        <span className={cn(
          "font-orbitron font-black text-2xl tracking-widest transition-colors shadow-black drop-shadow-md",
          hovered || isActive ? "text-red-500" : "text-zinc-400"
        )}>
          {label}
        </span>
        {subLabel && (
          <span className="text-[10px] font-mono text-zinc-500 tracking-widest">
            {subLabel}
          </span>
        )}
      </div>

      {/* Background Scanline Effect (CSS handled via tailwind arbitrary values or global css) */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-[-1] bg-[length:100%_4px,6px_100%] pointer-events-none" />
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

  // Background Ambience Sound (Conceptual - browsers block autoplay)
  // useEffect(() => { const audio = new Audio('/sounds/drone.mp3'); ... }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white pt-20 pb-24 overflow-hidden relative font-orbitron">
      
      {/* Background Texture (Rust/Metal Vibe) */}
      <div className="fixed inset-0 z-0 opacity-20 pointer-events-none" 
           style={{ 
             backgroundImage: `url("https://www.transparenttextures.com/patterns/dark-matter.png")`, // Or a local asset
             filter: 'contrast(120%) brightness(80%)' 
           }} 
      />
      
      {/* Vignette */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)] pointer-events-none" />

      {/* Header Container */}
      <div className="relative z-10 container mx-auto px-4 mb-12 text-center">
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-zinc-300 drop-shadow-[0_0_15px_rgba(255,0,0,0.5)]">
            STRIKE<span className="text-red-600">BALL</span>
          </h1>
          <h2 className="text-sm md:text-lg font-mono text-red-500/80 tracking-[0.5em] mt-2 uppercase border-t border-b border-red-900/30 py-1 inline-block">
            Tactical Operations // {user?.username || "GUEST"}
          </h2>
        </motion.div>
      </div>

      {/* Main Menu Container */}
      <div className="relative z-10 max-w-md mx-auto px-4">
        <div className="border-4 border-zinc-800 bg-zinc-900/80 backdrop-blur-sm p-1 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
          <div className="border border-red-900/20 p-2">
            
            <AnimatePresence mode="wait">
              {menuStep === 'main' ? (
                <motion.div 
                  key="main-menu"
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  className="space-y-2"
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
                  
                  <div className="h-4" /> {/* Spacer */}

                  <Q3MenuItem 
                    label="QR CONNECT" 
                    subLabel="JOIN VIA FIELD SCAN" 
                    onClick={() => alert("Simulating Camera Open...")}
                  />
                  
                  <Q3MenuItem 
                    label="EXIT" 
                    subLabel="RETURN TO OS" 
                    href="/" 
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="create-menu"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 20, opacity: 0 }}
                >
                  <div className="bg-black/50 p-4 mb-4 border border-zinc-700">
                    <h3 className="text-red-500 text-xl font-black mb-4 uppercase">Match Settings</h3>
                    <CreateLobbyForm />
                  </div>
                  
                  <Q3MenuItem 
                    label="BACK" 
                    subLabel="RETURN TO MAIN MENU" 
                    onClick={() => setMenuStep('main')} 
                  />
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>
      </div>

      {/* Footer Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t-2 border-zinc-800 p-2 z-20">
        <div className="container mx-auto flex justify-between items-center text-[10px] font-mono text-zinc-500 uppercase">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            NET: ONLINE
          </div>
          <div>
            VER: 0.9.1 BETA
          </div>
        </div>
      </div>

    </div>
  );
}