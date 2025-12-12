"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

const PARTICLE_COUNT = 8; // Optimized for mobile

export const StrikeballBackground: React.FC = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-[#0a0000] pointer-events-none select-none">
      
      {/* 1. The Void Grid */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, #400 1px, transparent 1px),
            linear-gradient(to bottom, #400 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'linear-gradient(to bottom, transparent 10%, black 90%)',
          transform: 'perspective(500px) rotateX(20deg) scale(1.5)'
        }}
      />

      {/* 2. The Tribal "Q" Rune - SVG Path Reconstruction */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, ease: "easeOut" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] h-[90vw] max-w-[600px] max-h-[600px] opacity-30"
      >
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-red-900 drop-shadow-[0_0_15px_rgba(255,0,0,0.5)]">
          <motion.g 
            animate={{ rotate: 360 }} 
            transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
            className="origin-center"
          >
            {/* The Claws */}
            <path d="M100 20 Q 150 20 180 80 L 160 90 Q 140 50 100 50 Z" fill="currentColor" />
            <path d="M100 20 Q 50 20 20 80 L 40 90 Q 60 50 100 50 Z" fill="currentColor" />
            {/* The Spike */}
            <path d="M100 180 L 110 50 L 90 50 Z" fill="currentColor" />
            {/* The Ring */}
            <circle cx="100" cy="100" r="40" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5" strokeDasharray="4 4" />
          </motion.g>
        </svg>
      </motion.div>

      {/* 3. Scanlines (High Contrast CSS) */}
      <div 
        className="absolute inset-0 z-10"
        style={{
          background: "linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.4))",
          backgroundSize: "100% 4px"
        }}
      />

      {/* 4. Vignette */}
      <div className="absolute inset-0 z-20 bg-[radial-gradient(circle_at_center,transparent_40%,#000_100%)]" />

      {/* 5. Floating Ember Particles */}
      {mounted && [...Array(PARTICLE_COUNT)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute bg-red-600 rounded-full blur-[2px]"
          style={{
            width: Math.random() * 4 + 2 + 'px',
            height: Math.random() * 4 + 2 + 'px',
            left: Math.random() * 100 + '%',
            top: '100%',
          }}
          animate={{
            y: -1000, // Float up off screen
            opacity: [0, 0.8, 0],
            x: Math.random() * 100 - 50, // Drift
          }}
          transition={{
            duration: Math.random() * 10 + 10,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "linear"
          }}
        />
      ))}
    </div>
  );
};