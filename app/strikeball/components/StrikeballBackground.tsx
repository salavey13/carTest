"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

const PARTICLE_COUNT = 15;

type Particle = {
  id: number;
  left: number; 
  size: number; 
  delay: number; 
  drift: number; 
  duration: number; 
  blur: number; 
};

export const StrikeballBackground: React.FC = () => {
  const [vh, setVh] = useState<number>(800);
  const [mounted, setMounted] = useState(false);

  // Deterministic RNG for consistent hydration
  function mulberry32(a: number) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const particles = useMemo<Particle[]>(() => {
    const rnd = mulberry32(1999);
    return new Array(PARTICLE_COUNT).fill(0).map((_, i) => ({
      id: i,
      left: Math.round(rnd() * 100), 
      size: Math.round(2 + rnd() * 4), 
      delay: Math.round(rnd() * 50) / 10,
      drift: Math.round((rnd() - 0.5) * 100), 
      duration: Math.round(10 + rnd() * 10), 
      blur: Math.round(1 + rnd() * 3),
    }));
  }, []);

  useEffect(() => {
    setMounted(true);
    const setV = () => setVh(Math.max(600, window.innerHeight));
    setV();
    window.addEventListener("resize", setV);
    return () => window.removeEventListener("resize", setV);
  }, []);

  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden bg-[#050000] select-none">
      
      {/* SVG LAYER: The Rune, The Glow, The Grid */}
      <svg
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="q3_bloom" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="b2" />
            <feMerge result="mergedBloom">
              <feMergeNode in="b2" />
              <feMergeNode in="b1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 0.8 0 0 0  0 0 0.8 0 0  0 0 0 1 0" in="mergedBloom" />
          </filter>

          <filter id="q3_chroma">
            <feOffset in="SourceGraphic" dx="-1.5" dy="0" result="offR" />
            <feColorMatrix in="offR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.7 0" result="r" />
            <feOffset in="SourceGraphic" dx="1.5" dy="0" result="offB" />
            <feColorMatrix in="offB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 0.7 0" result="b" />
            <feMerge>
              <feMergeNode in="r" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <pattern id="q3_grid" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M0 80 L80 80" stroke="#330000" strokeWidth="1" opacity="0.5" />
            <path d="M80 0 L80 80" stroke="#330000" strokeWidth="1" opacity="0.5" />
          </pattern>

          <linearGradient id="q3_metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff4444" />
            <stop offset="100%" stopColor="#880000" />
          </linearGradient>
        </defs>

        <g transform="translate(600, 600) scale(1.5, 0.8) perspective(500)">
           <rect x="-1000" y="-1000" width="2000" height="2000" fill="url(#q3_grid)" opacity="0.3" transform="rotateX(60)" />
        </g>

        <g transform="translate(600, 400) scale(1.2)" filter="url(#q3_bloom)">
           <g filter="url(#q3_chroma)">
              <motion.circle 
                cx="0" cy="0" r="60" 
                fill="none" stroke="#ff0000" strokeWidth="3" strokeDasharray="10 5"
                animate={{ rotate: -360, opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              />
              
              <motion.path 
                d="M0 -90 L20 -40 Q 80 -10 40 40 L 0 100 L -40 40 Q -80 -10 -20 -40 Z" 
                fill="url(#q3_metal)" 
                opacity="0.8"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
           </g>
        </g>
      </svg>

      {/* --- FIX: Improved Scanlines --- */}
      {/* 1. Explicit high-contrast scanlines */}
      <div 
        className="absolute inset-0 z-10 pointer-events-none" 
        style={{ 
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0) 50%, rgba(0,0,0,0.4) 50%)`,
          backgroundSize: '100% 4px',
          opacity: 0.6 // Increased opacity for visibility
        }} 
      />
      {/* 2. CRT Noise Texture overlay */}
      <div 
        className="absolute inset-0 z-20 pointer-events-none opacity-[0.03]" 
        style={{ 
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }} 
      />
      {/* 3. Vignette to darken corners */}
      <div className="absolute inset-0 z-30 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.6)_100%)] pointer-events-none" />

      {/* Particles */}
      {mounted && particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-red-600 mix-blend-screen"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            filter: `blur(${p.blur}px)`,
            boxShadow: `0 0 ${p.size * 2}px #ff0000`,
          }}
          initial={{ y: vh, opacity: 0 }}
          animate={{
            y: -100,
            x: p.drift,
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
};