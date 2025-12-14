"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

const PARTICLE_COUNT = 8; // Optimized for mobile

export const StrikeballBackground: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [vh, setVh] = useState(800);

  useEffect(() => {
    setMounted(true);
    setVh(window.innerHeight);
    const handleResize = () => setVh(window.innerHeight);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-[#050000] pointer-events-none select-none">
      
      {/* 1. The Void Grid (Perspective Floor) */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(to right, #400 1px, transparent 1px),
            linear-gradient(to bottom, #400 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'linear-gradient(to bottom, transparent 10%, black 90%)',
          transform: 'perspective(500px) rotateX(20deg) scale(1.5) translateY(-50px)'
        }}
      />

      {/* 2. The "Quake 3" Rune - Updated Geometry */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, ease: "easeOut" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] h-[90vw] max-w-[600px] max-h-[600px] opacity-40 mix-blend-screen"
      >
        <svg 
          viewBox="0 0 300 300" 
          xmlns="http://www.w3.org/2000/svg" 
          className="w-full h-full text-red-800 drop-shadow-[0_0_25px_rgba(255,0,0,0.6)]"
        >
          <defs>
            {/* Roughness Filter for that authentic 1999 texture */}
            <filter id="q3-rough">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" />
            </filter>
          </defs>

          <motion.g 
            filter="url(#q3-rough)"
            style={{ transformOrigin: "150px 150px" }}
            animate={{ 
              scale: [1, 1.02, 1],
              rotate: [0, 1, 0, -1, 0] // Subtle jitter instead of full rotation for more menacing look
            }}
            transition={{ 
              duration: 6, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
          >
            {/* INVERTED ARC — concave UP, convex DOWN */}
            <path
              d="M48 96 L78 104 C124 118, 176 118, 222 104 L252 96 L228 90 C176 104, 124 104, 72 90 Z"
              fill="currentColor"
            />

            {/* CENTER SPIKE — ultra thin, extends into arc */}
            <path
              d="M148 58 L152 58 L151 238 L150 262 L149 238 Z"
              fill="currentColor"
            />

            {/* LEFT SPIKE — thinner */}
            <path
              d="M120 132 L124 132 L123 222 L122 242 L121 222 Z"
              fill="currentColor"
            />

            {/* RIGHT SPIKE — mirror */}
            <path
              d="M176 132 L180 132 L179 222 L178 242 L177 222 Z"
              fill="currentColor"
            />
          </motion.g>
        </svg>
      </motion.div>

      {/* 3. High-Vis Scanlines */}
      <div 
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, rgba(0,0,0,0) 50%, rgba(0,0,0,0.5) 50%)",
          backgroundSize: "100% 4px",
          opacity: 0.4
        }}
      />

      {/* 4. Heavy Vignette */}
      <div className="absolute inset-0 z-20 bg-[radial-gradient(circle_at_center,transparent_30%,#000_100%)]" />

      {/* 5. Floating Ember Particles */}
      {mounted && [...Array(PARTICLE_COUNT)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute bg-red-500 rounded-full"
          style={{
            width: Math.random() * 3 + 2 + 'px',
            height: Math.random() * 3 + 2 + 'px',
            left: Math.random() * 100 + '%',
            top: '110%',
            boxShadow: '0 0 10px red'
          }}
          animate={{
            y: -1200, // Float up off screen
            x: Math.random() * 200 - 100,
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: Math.random() * 10 + 15,
            repeat: Infinity,
            delay: Math.random() * 10,
            ease: "linear"
          }}
        />
      ))}
    </div>
  );
};