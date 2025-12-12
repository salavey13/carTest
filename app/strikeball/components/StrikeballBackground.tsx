"use client";

import { motion } from "framer-motion";

export const StrikeballBackground = () => {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-[#050000] pointer-events-none">
      {/* 1. Deep Atmospheric Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.98)_100%)] z-10" />

      {/* 2. Perspective Void Grid */}
      <div 
        className="absolute inset-0 opacity-25 z-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(180, 20, 20, 0.15) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(180, 20, 20, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          maskImage: 'linear-gradient(to bottom, transparent 10%, black 80%)',
          transform: 'perspective(800px) rotateX(35deg) scale(2) translateY(200px)'
        }}
      />

      {/* 3. The Tribal Q Logo - Much Closer to Original */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, ease: "easeOut" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] h-[90vw] max-w-[700px] max-h-[700px] z-0"
      >
        <motion.svg
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <defs>
            {/* Intense Red Gradient */}
            <linearGradient id="tribalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff3333" />
              <stop offset="50%" stopColor="#cc0000" />
              <stop offset="100%" stopColor="#660000" />
            </linearGradient>

            {/* Strong Multi-Layer Glow */}
            <filter id="intenseGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur1"/>
              <feGaussianBlur stdDeviation="8" result="blur2"/>
              <feGaussianBlur stdDeviation="16" result="blur3"/>
              <feMerge>
                <feMergeNode in="blur3"/>
                <feMergeNode in="blur2"/>
                <feMergeNode in="blur1"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>

            {/* Subtle inner glow */}
            <filter id="softGlow">
              <feGaussianBlur stdDeviation="2" result="glow"/>
              <feMerge>
                <feMergeNode in="glow"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Slow eternal rotation */}
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: 180, repeat: Infinity, ease: "linear" }}
          >
            {/* Pulsing core group */}
            <motion.g
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* Central Vertical Spike - Sharper */}
              <path
                d="M100 15 L108 55 L104 185 L96 185 L92 55 Z"
                fill="url(#tribalGradient)"
                stroke="#ff4444"
                strokeWidth="2"
                filter="url(#intenseGlow)"
              />

              {/* Top-Left Claw - More Aggressive Curve */}
              <path
                d="M100 15 Q 50 10 25 65 L45 85 Q65 55 100 55 Z"
                fill="url(#tribalGradient)"
                stroke="#ff2222"
                strokeWidth="1.5"
                filter="url(#softGlow)"
                opacity="0.95"
              />

              {/* Top-Right Claw */}
              <path
                d="M100 15 Q 150 10 175 65 L155 85 Q135 55 100 55 Z"
                fill="url(#tribalGradient)"
                stroke="#ff2222"
                strokeWidth="1.5"
                filter="url(#softGlow)"
                opacity="0.95"
              />

              {/* Bottom Tail Curve - More Fluid */}
              <path
                d="M100 185 Q 160 170 145 120 L125 125 Q135 155 100 160 Z"
                fill="url(#tribalGradient)"
                stroke="#cc0000"
                strokeWidth="1.5"
                filter="url(#softGlow)"
                opacity="0.9"
              />

              {/* Inner Binding Ring - Pulsing */}
              <motion.circle
                cx="100"
                cy="100"
                r="35"
                stroke="#ff3333"
                strokeWidth="2"
                fill="none"
                opacity="0.6"
                strokeDasharray="8 6"
                filter="url(#softGlow)"
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
            </motion.g>
          </motion.g>
        </motion.svg>
      </motion.div>

      {/* 4. Enhanced CRT Effects */}
      {/* Scanlines */}
      <div 
        className="absolute inset-0 z-20 pointer-events-none opacity-15 mix-blend-soft-light"
        style={{
          background: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,0,0,0.1) 2px, rgba(255,0,0,0.15) 4px)`,
        }}
      />

      {/* Subtle flicker overlay */}
      <motion.div
        className="absolute inset-0 z-20 pointer-events-none opacity-5 bg-red-900 mix-blend-overlay"
        animate={{ opacity: [0.03, 0.08, 0.03] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Noise texture */}
      <div className="absolute inset-0 z-20 pointer-events-none opacity-8 mix-blend-soft-light bg-[url('https://www.transparenttextures.com/patterns/noise.png')]" />

      {/* 5. Glowing Ember Particles */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 4 + 2 + 'px',
            height: Math.random() * 4 + 2 + 'px',
            left: Math.random() * 100 + '%',
            top: '100%',
            background: '#ff3333',
            boxShadow: '0 0 10px #ff0000',
            filter: 'blur(1px)',
          }}
          animate={{
            y: [0, -window.innerHeight - 100],
            x: [0, (Math.random() - 0.5) * 200],
            opacity: [0, 1, 0.7, 0],
          }}
          transition={{
            duration: Math.random() * 8 + 8,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "linear"
          }}
        />
      ))}
    </div>
  );
};