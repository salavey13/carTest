"use client";

import { motion } from "framer-motion";

export const StrikeballBackground = () => {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-[#050000] pointer-events-none">
      {/* 1. Deep Atmospheric Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.95)_90%)] z-10" />

      {/* 2. The "Void" Grid - Perspective Floor */}
      <div 
        className="absolute inset-0 opacity-20 z-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(150, 0, 0, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(150, 0, 0, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'linear-gradient(to bottom, transparent 20%, black 100%)',
          transform: 'perspective(500px) rotateX(20deg) scale(1.5)'
        }}
      />

      {/* 3. The ARENA LOGO (The "Tribal Q") */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] h-[90vw] max-w-[600px] max-h-[600px] z-0"
      >
        <motion.svg
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_0_30px_rgba(200,0,0,0.3)]"
          animate={{ rotate: 360 }}
          transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
        >
          <defs>
            <linearGradient id="rustGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7f1d1d" /> {/* Red 900 */}
              <stop offset="50%" stopColor="#991b1b" /> {/* Red 800 */}
              <stop offset="100%" stopColor="#450a0a" /> {/* Red 950 */}
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Grouping for internal pulse */}
          <motion.g
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* The Central Spike (Vertical) */}
            <path 
              d="M100 20 L110 50 L100 180 L90 50 Z" 
              fill="url(#rustGradient)" 
              stroke="#ef4444" 
              strokeWidth="1"
              filter="url(#glow)"
            />

            {/* Top Left Claw */}
            <path 
              d="M100 20 Q 40 20 20 80 L 40 90 Q 60 50 100 50 Z" 
              fill="url(#rustGradient)" 
              stroke="#ef4444" 
              strokeWidth="1"
              opacity="0.9"
            />

            {/* Right Claw */}
            <path 
              d="M100 20 Q 160 20 180 80 L 160 90 Q 140 50 100 50 Z" 
              fill="url(#rustGradient)" 
              stroke="#ef4444" 
              strokeWidth="1"
              opacity="0.9"
            />

            {/* Bottom Curve (The "Tail") */}
            <path 
              d="M100 180 Q 160 160 140 100 L 120 110 Q 130 140 100 150 Z" 
              fill="url(#rustGradient)" 
              stroke="#ef4444" 
              strokeWidth="1"
              opacity="0.8"
            />
            
            {/* Inner Ring (The Binding) */}
            <circle cx="100" cy="100" r="30" stroke="#ef4444" strokeWidth="2" fill="none" opacity="0.5" strokeDasharray="5 5" />
          </motion.g>
        </motion.svg>
      </motion.div>

      {/* 4. CRT Scanlines & Noise Texture */}
      <div className="absolute inset-0 z-20 pointer-events-none opacity-10 mix-blend-overlay"
           style={{ backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, #ff0000 3px)` }}
      />
      <div className="absolute inset-0 z-20 pointer-events-none opacity-5 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />

      {/* 5. Floating Dust Particles (CSS Animation) */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute bg-red-600 rounded-full blur-[1px]"
          style={{
            width: Math.random() * 3 + 1 + 'px',
            height: Math.random() * 3 + 1 + 'px',
            left: Math.random() * 100 + '%',
            top: Math.random() * 100 + '%',
          }}
          animate={{
            y: [0, -100],
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: Math.random() * 5 + 5,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "linear"
          }}
        />
      ))}
    </div>
  );
};