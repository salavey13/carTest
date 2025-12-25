"use client";
import { FaCrosshairs, FaHandFist, FaSkullCrossbones } from "react-icons/fa6";
import { useState, useRef, useEffect } from "react";
import { useGameSounds } from "../hooks/useGameSounds";
import { cn } from "@/lib/utils";

interface VirtualBlasterProps {
  onHit: () => void;
  onDeath?: () => void;
}

export function VirtualBlaster({ onHit, onDeath }: VirtualBlasterProps) {
  const sounds = useGameSounds();
  const [mode, setMode] = useState<"ranged" | "melee">("ranged");
  const [isCharging, setIsCharging] = useState(false);
  const chargeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const energyRef = useRef<HTMLDivElement>(null);

  const toggleMode = () => {
    setMode(prev => (prev === "ranged" ? "melee" : "ranged"));
  };

  const startCharge = () => {
    setIsCharging(true);
    let energy = 0;
    if (energyRef.current) energyRef.current.style.width = "0%";

    chargeIntervalRef.current = setInterval(() => {
      energy += 2;
      if (energy >= 100) energy = 100;
      if (energyRef.current) energyRef.current.style.width = `${energy}%`;
    }, 30);
  };

  const stopCharge = () => {
    if (chargeIntervalRef.current) {
      clearInterval(chargeIntervalRef.current);
      chargeIntervalRef.current = null;
    }
    setIsCharging(false);

    // Fire after short delay (simulate release)
    setTimeout(() => {
      handleAction();
      if (energyRef.current) energyRef.current.style.width = "0%";
    }, 100);
  };

  const handleAction = () => {
    if (mode === "ranged") {
      sounds.fire();
    } else {
      sounds.meleeAttack();
    }
  };

  const handleDeath = () => {
    sounds.death();
    onHit();
    onDeath?.();

    // Death flash overlay
    const flash = document.createElement("div");
    flash.className = "fixed inset-0 bg-red-500/30 z-50 pointer-events-none";
    document.body.appendChild(flash);
    setTimeout(() => {
      flash.style.transition = "opacity 300ms";
      flash.style.opacity = "0";
      setTimeout(() => flash.remove(), 300);
    }, 100);
  };

  return (
    <div className="relative">
      {/* Outer glow frame */}
      <div className="absolute -inset-1 bg-gradient-to-r from-brand-cyan via-brand-purple to-brand-cyan rounded-xl opacity-30 blur-md pointer-events-none" />

      <div
        className={cn(
          "relative bg-black/40 backdrop-blur-xl border-2 rounded-xl overflow-hidden transition-all duration-300",
          mode === "ranged"
            ? "border-brand-cyan/50 shadow-panel-glow"
            : "border-brand-gold/50 shadow-[0_0_30px_rgba(234,179,8,0.2)]"
        )}
      >
        {/* Top Status Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-black/20">
          <div className="flex items-center gap-2">
            <i className="fas fa-satellite-dish text-brand-cyan text-xs animate-pulse" />
            <span className="text-xs font-orbitron text-brand-cyan tracking-wider">
              SYSTEM ONLINE
            </span>
          </div>
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]" />
            <div className="w-2 h-2 rounded-full bg-brand-cyan/30" />
            <div className="w-2 h-2 rounded-full bg-brand-cyan/30" />
          </div>
        </div>

        {/* Main Button Grid */}
        <div className="p-4 grid grid-cols-2 gap-4 relative">
          {/* Action Button */}
          <button
            onMouseDown={startCharge}
            onMouseUp={stopCharge}
            onMouseLeave={stopCharge}
            onTouchStart={startCharge}
            onTouchEnd={stopCharge}
            className="relative group w-full aspect-square focus:outline-none"
          >
            {/* Hover glow */}
            <div
              className={cn(
                "absolute inset-0 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full",
                mode === "ranged" ? "bg-brand-cyan/20" : "bg-brand-gold/20"
              )}
            />
            {/* Button shape */}
            <div
              className={cn(
                "cyber-clip w-full h-full bg-gradient-to-br from-[#1a202c] to-[#2d3748] border relative overflow-hidden transition-all duration-200 active:scale-95 shadow-lg",
                mode === "ranged"
                  ? "border-brand-cyan/30 group-hover:border-brand-cyan/80"
                  : "border-brand-gold/30 group-hover:border-brand-gold/80"
              )}
            >
              {/* Inner detail line */}
              <div className="absolute inset-2 border border-white/5 cyber-clip pointer-events-none" />
              {/* Icon & text */}
              <div className="flex flex-col items-center justify-center h-full gap-2 relative z-10">
                <div
                  className={cn(
                    "text-4xl drop-shadow-md transition-transform duration-200 group-active:scale-90",
                    mode === "ranged"
                      ? "text-brand-cyan drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]"
                      : "text-brand-gold drop-shadow-[0_0_10px_rgba(234,179,8,0.6)]"
                  )}
                >
                  {mode === "ranged" ? <FaCrosshairs /> : <FaHandFist />}
                </div>
                <span className="font-orbitron font-black text-lg tracking-widest text-white">
                  {mode === "ranged" ? "FIRE" : "STRIKE"}
                </span>
                <span className="text-[9px] uppercase tracking-widest font-mono text-opacity-60">
                  {mode === "ranged" ? "Hold to Charge" : "Swipe to Attack"}
                </span>
              </div>
              {/* Energy bar */}
              <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10">
                <div
                  ref={energyRef}
                  className={cn(
                    "h-full shadow-[0_0_10px]",
                    mode === "ranged" ? "bg-brand-cyan shadow-[0_0_10px_rgba(34,211,238,0.8)]" : "bg-brand-gold shadow-[0_0_10px_rgba(234,179,8,0.8)]"
                  )}
                  style={{ width: "0%" }}
                />
              </div>
            </div>
          </button>

          {/* Death Button (offset for asymmetry) */}
          <button
            onClick={handleDeath}
            className="relative group w-full aspect-square focus:outline-none mt-12"
          >
            <div className="absolute inset-0 bg-red-600/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full" />
            <div className="cyber-clip-reverse w-full h-full bg-gradient-to-br from-[#2a0a0a] to-[#1a0505] border border-red-600/30 relative overflow-hidden transition-all duration-200 active:scale-95 group-hover:border-red-600/80 shadow-lg group-hover:shadow-[0_0_20px_rgba(220,38,38,0.3)]">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 10px, #000 10px, #000 20px)" }} />
              <div className="flex flex-col items-center justify-center h-full gap-2 relative z-10">
                <div className="text-red-500 text-4xl drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse">
                  <FaSkullCrossbones />
                </div>
                <span className="font-orbitron font-black text-lg tracking-widest text-red-500">
                  KILLED
                </span>
                <span className="text-[9px] text-red-500/60 uppercase tracking-widest font-mono">
                  Emergency
                </span>
              </div>
              <div className="absolute inset-0 bg-red-500 mix-blend-overlay opacity-0 group-active:opacity-20 transition-opacity" />
            </div>
          </button>

          {/* Center HUD ornament */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border border-white/5 bg-[#0a0c10] shadow-[inset_0_0_10px_black] z-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border border-brand-cyan/20 border-dashed animate-[spin_10s_linear_infinite]" />
          </div>
        </div>

        {/* Bottom Mode Indicator */}
        <div className="bg-black/40 border-t border-white/10 p-3 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 font-mono mb-1">CURRENT MODE</span>
            <div className="flex items-center gap-2">
              <span
                onClick={toggleMode}
                className={cn(
                  "font-orbitron font-bold tracking-widest cursor-pointer",
                  mode === "ranged" ? "text-brand-cyan" : "text-brand-gold"
                )}
              >
                {mode === "ranged" ? "RANGED" : "MELEE"}
              </span>
              <div className="w-px h-3 bg-gray-600" />
              <span className="text-xs text-gray-400 font-mono">
                {mode === "ranged" ? "Laser Optics" : "Plasma Blade"}
              </span>
            </div>
          </div>

          {/* Ammo/Health Bars */}
          <div className="flex gap-0.5 items-end">
            {[6, 5, 4, 3, 2].map((h, i) => (
              <div
                key={i}
                className={cn(
                  "w-1 rounded-sm shadow-[0_0_5px]",
                  i < 3
                    ? "bg-brand-cyan shadow-[0_0_5px_rgba(34,211,238,0.5)]"
                    : "bg-brand-cyan/30"
                )}
                style={{ height: `${h * 4}px` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}