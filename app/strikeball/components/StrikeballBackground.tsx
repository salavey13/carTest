"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

/**
 * StrikeballBackground — улучшенный фон / логотип в духе Quake III.
 * - детерминированные частицы (нет Math.random() в SSR)
 * - мощные SVG фильтры (multi blur bloom + chromatic aberration)
 * - feTurbulence для шума/пятен
 * - безопасно для Next.js / SSR (весь клиентский код запускается в useEffect)
 *
 * NOTE: компонент использует `useEffect` для измерений viewport'а — без window.* в начальном рендере.
 */

const PARTICLE_COUNT = 10;

type Particle = {
  id: number;
  left: number; // % from left
  size: number; // px
  delay: number; // seconds
  drift: number; // px horizontal drift
  duration: number; // seconds
  blur: number; // px blur
};

export const StrikeballBackground: React.FC = () => {
  // avoid hydration mismatch: default values for client-only measurements
  const [vh, setVh] = useState<number>(800);
  const [mounted, setMounted] = useState(false);

  // deterministic RNG (seeded) so repeated renders produce same results (avoids SSR drift)
  function mulberry32(a: number) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // seed from a fixed const so particles are stable across runs — change seed if you want new layout
  const particles = useMemo<Particle[]>(() => {
    const rnd = mulberry32(1337);
    return new Array(PARTICLE_COUNT).fill(0).map((_, i) => ({
      id: i,
      left: Math.round(rnd() * 10000) / 100, // 0..100 with 2 decimals
      size: Math.round(2 + rnd() * 6),
      delay: Math.round(rnd() * 500) / 100, // 0..5s
      drift: Math.round((rnd() - 0.5) * 220),
      duration: Math.round(6 + rnd() * 8),
      blur: Math.round(0 + rnd() * 4),
    }));
  }, []);

  useEffect(() => {
    setMounted(true);
    const setV = () => setVh(Math.max(600, window.innerHeight));
    setV();
    window.addEventListener("resize", setV);
    return () => window.removeEventListener("resize", setV);
  }, []);

  // refs for subtle hover parallax (optional)
  const rootRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden bg-[#040203]"
      aria-hidden
    >
      {/* === SVG: filters + tribal Q shape + grid as SVG layer === */}
      <svg
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Strong multi-stage bloom/glow */}
          <filter id="bloom" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="b2" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="b3" />
            <feMerge result="mergedBloom">
              <feMergeNode in="b3" />
              <feMergeNode in="b2" />
              <feMergeNode in="b1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
            {/* boost brightness of bloom a bit */}
            <feComponentTransfer in="mergedBloom">
              <feFuncA type="table" tableValues="0 0.9" />
              <feFuncR type="gamma" amplitude="1" exponent="0.9" offset="0" />
              <feFuncG type="gamma" amplitude="1" exponent="0.9" offset="0" />
              <feFuncB type="gamma" amplitude="1" exponent="0.9" offset="0" />
            </feComponentTransfer>
          </filter>

          {/* Chromatic aberration: split channels slightly and recombine */}
          <filter id="chroma" x="-20%" y="-20%" width="140%" height="140%">
            {/* red channel offset */}
            <feOffset in="SourceGraphic" dx="-0.6" dy="0" result="offR" />
            <feColorMatrix
              in="offR"
              type="matrix"
              values="1 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0"
              result="rOnly"
            />
            {/* green channel (center) */}
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="0 0 0 0 0
                      0 1 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0"
              result="gOnly"
            />
            {/* blue channel offset */}
            <feOffset in="SourceGraphic" dx="0.9" dy="0.2" result="offB" />
            <feColorMatrix
              in="offB"
              type="matrix"
              values="0 0 0 0 0
                      0 0 0 0 0
                      0 0 1 0 0
                      0 0 0 1 0"
              result="bOnly"
            />
            <feBlend in="rOnly" in2="gOnly" mode="screen" result="rg" />
            <feBlend in="rg" in2="bOnly" mode="screen" />
          </filter>

          {/* subtle film noise / dust using SVG turbulence (no external image) */}
          <filter id="noise" x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.8"
              numOctaves="1"
              stitchTiles="stitch"
              result="turb"
            />
            <feColorMatrix
              in="turb"
              type="saturate"
              values="0"
              result="turbGray"
            />
            <feComponentTransfer in="turbGray" result="turbAlpha">
              <feFuncA type="table" tableValues="0 0.06" />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" in2="turbGray" mode="overlay" />
          </filter>

          {/* grid pattern for perspective floor */}
          <pattern id="grid" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M0 60 L60 60" stroke="rgba(180,20,20,0.14)" strokeWidth="1" />
            <path d="M60 0 L60 60" stroke="rgba(180,20,20,0.14)" strokeWidth="1" />
          </pattern>

          {/* radial vignette mask */}
          <radialGradient id="vign" cx="50%" cy="45%">
            <stop offset="40%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.95)" />
          </radialGradient>

          {/* main red gradient for tribal Q */}
          <linearGradient id="tribalGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff6666" />
            <stop offset="50%" stopColor="#e10000" />
            <stop offset="100%" stopColor="#500000" />
          </linearGradient>
        </defs>

        {/* background vignette */}
        <rect x="0" y="0" width="1200" height="800" fill="url(#vign)" opacity={1} />

        {/* perspective grid: placed lower, scaled and skewed */}
        <g transform="translate(600,720) scale(1,0.5) rotate(0)">
          <rect x="-1200" y="-400" width="2400" height="800" fill="url(#grid)" opacity={0.18} style={{ transformOrigin: "center" }} />
        </g>

        {/* faint radial red spot behind logo */}
        <ellipse cx="600" cy="360" rx="340" ry="220" fill="url(#tribalGrad)" opacity="0.08" filter="url(#bloom)" />

        {/* ---------- TRIBAL Q SYMBOL (improved path fidelity) ---------- */}
        <g transform="translate(600,360)">
          {/* backing bloom copy for heavy glow */}
          <path
            d="M0,-175 L25,-80 C120,-18 120,18 60,70 C95,120 60,180 0,150 C-50,180 -85,120 -50,70 C-110,18 -110,-18 -25,-80 Z"
            // silhouette for bloom
            fill="#880000"
            transform="scale(1.1)"
            filter="url(#bloom)"
            opacity={0.85}
          />

          {/* actual tribal shape (top spike + claws + tail) */}
          <g filter="url(#chroma)">
            <path
              d="M0 -160 L28 -60 C120 -12 120 22 64 68 C98 114 66 162 4 144 C-50 162 -88 114 -54 68 C-112 22 -112 -12 -28 -60 Z"
              fill="url(#tribalGrad)"
              stroke="#ff3030"
              strokeWidth="2"
              style={{ transformOrigin: "center" }}
            />
          </g>

          {/* inner ring - glowing, dashed */}
          <circle
            cx={0}
            cy={0}
            r={72}
            fill="none"
            stroke="#ff4d4d"
            strokeWidth={3}
            strokeDasharray="6 6"
            opacity={0.55}
            filter="url(#bloom)"
          />
        </g>

        {/* noise overlay using filter (subtle) */}
        <rect x="0" y="0" width="1200" height="800" fill="rgba(0,0,0,0)" filter="url(#noise)" opacity={0.08} />
      </svg>

      {/* === CSS scanlines + flicker (kept outside SVG to use CSS blending) === */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          mixBlendMode: "soft-light",
          background: `repeating-linear-gradient(0deg, rgba(0,0,0,0) 0, rgba(0,0,0,0) 2px, rgba(255,0,0,0.06) 2px, rgba(255,0,0,0.08) 3.5px)`,
          opacity: 0.12,
        }}
      />

      {/* subtle red flicker */}
      <motion.div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ mixBlendMode: "overlay", background: "radial-gradient(circle at 50% 40%, rgba(255,40,40,0.06), transparent 25%)" }}
        animate={{ opacity: [0.02, 0.09, 0.02] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* === Ember particles — client-only, deterministic positions === */}
      {mounted &&
        particles.map((p) => {
          const startY = vh + 40;
          // motion animation values: from bottom (startY) to -120 (off top)
          return (
            <motion.div
              key={p.id}
              aria-hidden
              className="absolute rounded-full"
              style={{
                left: `${p.left}%`,
                width: p.size,
                height: p.size,
                bottom: -20,
                boxShadow: `0 0 ${8 + p.blur}px rgba(255,60,60,0.9)`,
                background: "radial-gradient(circle, #ff7b7b 0%, #bb0000 60%, rgba(0,0,0,0) 100%)",
                filter: `blur(${p.blur}px)`,
                transform: "translateZ(0)", // GPU hint
                willChange: "transform, opacity",
              }}
              initial={{ y: 0, opacity: 0 }}
              animate={{
                y: [-10, -(startY + 200)],
                x: [0, p.drift],
                opacity: [0, 1, 0.6, 0],
                scale: [0.8, 1, 0.9],
              }}
              transition={{
                duration: p.duration,
                repeat: Infinity,
                ease: "linear",
                delay: p.delay,
              }}
            />
          );
        })}

      {/* Small accessibility note hidden visually */}
      <span style={{ position: "absolute", left: -9999, top: -9999 }}>Decorative background</span>
    </div>
  );
};

export default StrikeballBackground;