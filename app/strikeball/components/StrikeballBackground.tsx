"use client";

import { motion } from "framer-motion";

export const StrikeballBackground = () => {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-zinc-950 pointer-events-none">
      {/* Base Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(60,0,0,0.3),rgba(0,0,0,1))]" />

      {/* Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,0,0,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-30" />

      {/* The "Arena Rune" - SVG Graphic */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[600px] max-h-[600px] opacity-20 blur-sm"
      >
        <motion.svg
          viewBox="0 0 100 100"
          fill="none"
          stroke="currentColor"
          className="w-full h-full text-red-900"
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        >
          {/* Outer Ring */}
          <circle cx="50" cy="50" r="45" strokeWidth="1" strokeDasharray="10 5" />
          <circle cx="50" cy="50" r="40" strokeWidth="0.5" />
          
          {/* Tribal Spikes */}
          <path d="M50 5 L55 20 L50 30 L45 20 Z" fill="currentColor" opacity="0.5" />
          <path d="M50 95 L55 80 L50 70 L45 80 Z" fill="currentColor" opacity="0.5" />
          <path d="M5 50 L20 45 L30 50 L20 55 Z" fill="currentColor" opacity="0.5" />
          <path d="M95 50 L80 45 L70 50 L80 55 Z" fill="currentColor" opacity="0.5" />
          
          {/* Inner Geometric */}
          <rect x="35" y="35" width="30" height="30" strokeWidth="1" transform="rotate(45 50 50)" />
        </motion.svg>
      </motion.div>

      {/* Floating Particles/Dust */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-pulse" />
    </div>
  );
};