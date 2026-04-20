"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import {
  Globe2,
  Mountain,
  Thermometer,
  Compass,
  Droplets,
  Wind,
  Map,
  TreePine,
  ArrowLeft,
  Eye,
  MousePointerClick,
  Layers,
  Sun,
  Snowflake,
  CloudRain,
  Waves,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SVG COMPONENTS â€” Rich, animated geographic visualizations
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

const GlobeSVG = () => (
  <svg viewBox="0 0 300 300" className="w-full h-full" style={{ fontFamily: "sans-serif" }}>
    <defs>
      <radialGradient id="globeGrad" cx="40%" cy="35%" r="60%">
        <stop offset="0%" stopColor="#1a6b4a" />
        <stop offset="60%" stopColor="#0f4a33" />
        <stop offset="100%" stopColor="#0a2e20" />
      </radialGradient>
      <clipPath id="globeClip">
        <circle cx="150" cy="150" r="120" />
      </clipPath>
      <filter id="glow">
        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    {/* Outer glow */}
    <circle cx="150" cy="150" r="130" fill="none" stroke="#10b981" strokeWidth="1" opacity="0.3" filter="url(#glow)" />

    {/* Globe body */}
    <circle cx="150" cy="150" r="120" fill="url(#globeGrad)" stroke="#10b981" strokeWidth="2" />

    {/* Continents (simplified shapes) */}
    <g clipPath="url(#globeClip)" opacity="0.6">
      {/* Eurasia */}
      <path d="M 100 80 Q 120 70 160 75 Q 200 80 220 90 Q 230 95 240 100 L 230 110 Q 200 100 180 105 Q 160 100 140 110 Q 120 115 100 105 Z" fill="#22c55e" opacity="0.5" />
      {/* Africa */}
      <path d="M 140 120 Q 155 115 165 125 Q 170 140 165 160 Q 160 175 150 180 Q 140 175 135 160 Q 130 140 135 125 Z" fill="#22c55e" opacity="0.5" />
      {/* South America */}
      <path d="M 80 140 Q 90 130 95 145 Q 100 165 95 185 Q 85 195 75 185 Q 70 170 75 155 Z" fill="#22c55e" opacity="0.5" />
      {/* North America */}
      <path d="M 60 70 Q 80 55 95 65 Q 100 80 95 100 Q 85 110 70 105 Q 55 95 55 80 Z" fill="#22c55e" opacity="0.5" />
      {/* Australia */}
      <ellipse cx="220" cy="175" rx="20" ry="15" fill="#22c55e" opacity="0.5" />
    </g>

    {/* Latitude lines */}
    <g clipPath="url(#globeClip)" opacity="0.25">
      <ellipse cx="150" cy="150" rx="120" ry="120" fill="none" stroke="#6ee7b7" strokeWidth="0.5" /> {/* equator */}
      <ellipse cx="150" cy="110" rx="108" ry="108" fill="none" stroke="#6ee7b7" strokeWidth="0.5" />
      <ellipse cx="150" cy="190" rx="108" ry="108" fill="none" stroke="#6ee7b7" strokeWidth="0.5" />
      <ellipse cx="150" cy="70" rx="80" ry="80" fill="none" stroke="#6ee7b7" strokeWidth="0.5" />
      <ellipse cx="150" cy="230" rx="80" ry="80" fill="none" stroke="#6ee7b7" strokeWidth="0.5" />
    </g>

    {/* Longitude lines */}
    <g clipPath="url(#globeClip)" opacity="0.2">
      <ellipse cx="150" cy="150" rx="60" ry="120" fill="none" stroke="#6ee7b7" strokeWidth="0.5" />
      <ellipse cx="150" cy="150" rx="110" ry="120" fill="none" stroke="#6ee7b7" strokeWidth="0.5" />
      <line x1="150" y1="30" x2="150" y2="270" stroke="#6ee7b7" strokeWidth="0.5" />
    </g>

    {/* Equator highlight */}
    <ellipse cx="150" cy="150" rx="120" ry="4" fill="none" stroke="#fbbf24" strokeWidth="1.5" opacity="0.6" filter="url(#glow)" />

    {/* Labels */}
    <text x="155" y="148" fill="#fbbf24" fontSize="8" fontWeight="bold" opacity="0.8">0Â°</text>
    <text x="248" y="95" fill="#6ee7b7" fontSize="7" opacity="0.6">60Â°N</text>
    <text x="248" y="210" fill="#6ee7b7" fontSize="7" opacity="0.6">60Â°S</text>
    <text x="150" y="22" fill="#94a3b8" fontSize="9" textAnchor="middle" fontWeight="bold">Ð¡</text>
    <text x="150" y="285" fill="#94a3b8" fontSize="9" textAnchor="middle" fontWeight="bold">Ð®</text>

    {/* Animated pulse on equator */}
    <circle cx="150" cy="150" r="4" fill="#fbbf24" opacity="0.8">
      <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite" />
    </circle>
  </svg>
);

const EarthLayersSVG = ({ activeLayer, setActiveLayer }: { activeLayer: number | null; setActiveLayer: (n: number | null) => void }) => {
  const layers = [
    { r: 120, color: "#92400e", label: "Ð—ÐµÐ¼Ð½Ð°Ñ ÐºÐ¾Ñ€Ð°", depth: "0-70 ÐºÐ¼", temp: "Ð´Ð¾ 800Â°C", idx: 0 },
    { r: 100, color: "#b45309", label: "ÐœÐ°Ð½Ñ‚Ð¸Ñ", depth: "70-2900 ÐºÐ¼", temp: "Ð´Ð¾ 3700Â°C", idx: 1 },
    { r: 70, color: "#dc2626", label: "Ð’Ð½ÐµÑˆÐ½ÐµÐµ ÑÐ´Ñ€Ð¾", depth: "2900-5100 ÐºÐ¼", temp: "Ð´Ð¾ 4500Â°C", idx: 2 },
    { r: 40, color: "#fbbf24", label: "Ð’Ð½ÑƒÑ‚Ñ€ÐµÐ½Ð½ÐµÐµ ÑÐ´Ñ€Ð¾", depth: "5100-6371 ÐºÐ¼", temp: "Ð´Ð¾ 6000Â°C", idx: 3 },
  ];

  return (
    <svg viewBox="0 0 320 320" className="w-full h-full cursor-pointer" style={{ fontFamily: "sans-serif" }}>
      <defs>
        <radialGradient id="coreGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <filter id="layerGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {layers.map((layer) => (
        <g key={layer.idx} onMouseEnter={() => setActiveLayer(layer.idx)} onMouseLeave={() => setActiveLayer(null)}>
          <circle cx="160" cy="160" r={layer.r} fill={layer.color} opacity={activeLayer === null || activeLayer === layer.idx ? 0.7 : 0.2} stroke={activeLayer === layer.idx ? "#fff" : "none"} strokeWidth="2" style={{ transition: "all 0.3s ease" }} />
        </g>
      ))}

      {/* Inner core special */}
      <circle cx="160" cy="160" r="40" fill="url(#coreGrad)" opacity={activeLayer === null || activeLayer === 3 ? 1 : 0.3} style={{ transition: "opacity 0.3s" }} />

      {/* Active layer info */}
      {activeLayer !== null && (
        <g>
          <rect x="10" y="10" width="140" height="60" rx="8" fill="rgba(0,0,0,0.8)" stroke="#10b981" strokeWidth="1" />
          <text x="20" y="30" fill="#fff" fontSize="11" fontWeight="bold">{layers[activeLayer].label}</text>
          <text x="20" y="45" fill="#6ee7b7" fontSize="9">{layers[activeLayer].depth}</text>
          <text x="20" y="60" fill="#fca5a5" fontSize="9">{layers[activeLayer].temp}</text>
        </g>
      )}

      {activeLayer === null && (
        <text x="160" y="300" fill="#94a3b8" fontSize="10" textAnchor="middle" opacity="0.6">ÐÐ°Ð²ÐµÐ´Ð¸ Ð½Ð° ÑÐ»Ð¾Ð¹ â€” ÑƒÐ²Ð¸Ð´Ð¸ÑˆÑŒ Ð´ÐµÑ‚Ð°Ð»Ð¸</text>
      )}
    </svg>
  );
};

const ClimateZonesSVG = () => (
  <svg viewBox="0 0 700 200" className="w-full h-full" style={{ fontFamily: "sans-serif" }}>
    <defs>
      <linearGradient id="tropical" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#dc2626" />
        <stop offset="100%" stopColor="#ef4444" />
      </linearGradient>
      <linearGradient id="subtropical" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f97316" />
        <stop offset="100%" stopColor="#fb923c" />
      </linearGradient>
      <linearGradient id="temperate" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#22c55e" />
        <stop offset="100%" stopColor="#4ade80" />
      </linearGradient>
      <linearGradient id="subarctic" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#60a5fa" />
      </linearGradient>
      <linearGradient id="arctic" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#a5b4fc" />
        <stop offset="100%" stopColor="#c7d2fe" />
      </linearGradient>
    </defs>

    <rect width="700" height="200" fill="#0a1a14" rx="12" />

    {/* Temperature bar */}
    <rect x="20" y="130" width="660" height="30" rx="6" fill="#1a2e24" />

    {/* Zone blocks - mirror layout for north/south */}
    {[
      { x: 20, w: 90, label: "ÐÑ€ÐºÑ‚Ð¸Ñ‡ÐµÑÐºÐ¸Ð¹", grad: "url(#arctic)", temp: "Ð´Ð¾ -40Â°C", icon: "â„ï¸" },
      { x: 115, w: 120, label: "Ð¡ÑƒÐ±Ð°Ñ€ÐºÑ‚Ð¸Ñ‡ÐµÑÐºÐ¸Ð¹", grad: "url(#subarctic)", temp: "Ð´Ð¾ -20Â°C", icon: "ðŸ§Š" },
      { x: 240, w: 140, label: "Ð£Ð¼ÐµÑ€ÐµÐ½Ð½Ñ‹Ð¹", grad: "url(#temperate)", temp: "0-25Â°C", icon: "ðŸŒ¿" },
      { x: 385, w: 120, label: "Ð¡ÑƒÐ±Ñ‚Ñ€Ð¾Ð¿Ð¸Ñ‡ÐµÑÐºÐ¸Ð¹", grad: "url(#subtropical)", temp: "15-35Â°C", icon: "â˜€ï¸" },
      { x: 510, w: 170, label: "Ð¢Ñ€Ð¾Ð¿Ð¸Ñ‡ÐµÑÐºÐ¸Ð¹", grad: "url(#tropical)", temp: "25-35Â°C", icon: "ðŸŒ´" },
    ].map((zone, i) => (
      <g key={i}>
        {/* North */}
        <rect x={zone.x} y={20} width={zone.w} height={50} rx="6" fill={zone.grad} opacity="0.8" />
        <text x={zone.x + zone.w / 2} y={42} fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">{zone.icon}</text>
        <text x={zone.x + zone.w / 2} y={58} fill="rgba(255,255,255,0.8)" fontSize="8" textAnchor="middle">{zone.label}</text>
        {/* South (mirror) */}
        <rect x={zone.x} y={75} width={zone.w} height={30} rx="4" fill={zone.grad} opacity="0.4" />

        {/* Temperature bar fill */}
        <rect x={zone.x} y={133} width={zone.w} height={24} rx="4" fill={zone.grad} opacity="0.7" />
        <text x={zone.x + zone.w / 2} y={150} fill="#fff" fontSize="8" fontWeight="bold" textAnchor="middle">{zone.temp}</text>
      </g>
    ))}

    {/* Equator line */}
    <line x1="20" y1="170" x2="680" y2="170" stroke="#fbbf24" strokeWidth="2" strokeDasharray="6 3" />
    <text x="350" y="185" fill="#fbbf24" fontSize="10" textAnchor="middle" fontWeight="bold">Ð­ÐšÐ’ÐÐ¢ÐžÐ  (0Â°)</text>

    {/* Labels */}
    <text x="350" y="12" fill="#94a3b8" fontSize="8" textAnchor="middle">Ð¡Ð•Ð’Ð•Ð ÐÐžÐ• ÐŸÐžÐ›Ð£Ð¨ÐÐ Ð˜Ð•</text>
  </svg>
);

const WaterCycleSVG = () => (
  <svg viewBox="0 0 600 280" className="w-full h-full" style={{ fontFamily: "sans-serif" }}>
    <defs>
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#0c1e2e" />
        <stop offset="100%" stopColor="#0a1a14" />
      </linearGradient>
      <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#0ea5e9" />
        <stop offset="100%" stopColor="#0369a1" />
      </linearGradient>
      <marker id="arrowGreen2" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
        <path d="M0,0 L0,6 L7,3 z" fill="#22c55e" />
      </marker>
      <marker id="arrowCyan" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
        <path d="M0,0 L0,6 L7,3 z" fill="#22d3ee" />
      </marker>
      <marker id="arrowBlue" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
        <path d="M0,0 L0,6 L7,3 z" fill="#3b82f6" />
      </marker>
    </defs>

    <rect width="600" height="280" fill="url(#skyGrad)" rx="12" />

    {/* Sun */}
    <circle cx="520" cy="50" r="25" fill="#fbbf24" opacity="0.3" />
    <circle cx="520" cy="50" r="15" fill="#fbbf24" opacity="0.8">
      <animate attributeName="r" values="15;17;15" dur="3s" repeatCount="indefinite" />
    </circle>

    {/* Mountain */}
    <polygon points="80,220 160,100 240,220" fill="#1a3a2a" stroke="#22c55e" strokeWidth="1" opacity="0.6" />
    <polygon points="160,100 165,95 155,95" fill="#e2e8f0" opacity="0.5" /> {/* snow cap */}

    {/* Ocean */}
    <rect x="280" y="200" width="280" height="60" fill="url(#waterGrad)" opacity="0.4" rx="0 0 12 12" />
    <path d="M 280 200 Q 310 195 340 200 Q 370 205 400 200 Q 430 195 460 200 Q 490 205 520 200 Q 540 195 560 200" fill="none" stroke="#22d3ee" strokeWidth="2" opacity="0.6">
      <animate attributeName="d" values="M 280 200 Q 310 195 340 200 Q 370 205 400 200 Q 430 195 460 200 Q 490 205 520 200 Q 540 195 560 200;M 280 200 Q 310 205 340 200 Q 370 195 400 200 Q 430 205 460 200 Q 490 195 520 200 Q 540 205 560 200;M 280 200 Q 310 195 340 200 Q 370 205 400 200 Q 430 195 460 200 Q 490 205 520 200 Q 540 195 560 200" dur="4s" repeatCount="indefinite" />
    </path>

    {/* Cloud */}
    <g opacity="0.7">
      <ellipse cx="200" cy="55" rx="40" ry="20" fill="#475569" />
      <ellipse cx="230" cy="50" rx="35" ry="22" fill="#64748b" />
      <ellipse cx="180" cy="50" rx="30" ry="18" fill="#64748b" />
    </g>

    {/* Rain drops */}
    {[190, 210, 225, 240].map((x, i) => (
      <line key={i} x1={x} y1={75} x2={x - 3} y2={95} stroke="#60a5fa" strokeWidth="1.5" opacity="0.6">
        <animate attributeName="y1" values="75;95;75" dur={`${1 + i * 0.3}s`} repeatCount="indefinite" />
        <animate attributeName="y2" values="95;115;95" dur={`${1 + i * 0.3}s`} repeatCount="indefinite" />
      </line>
    ))}

    {/* Evaporation arrows */}
    <path d="M 380 190 Q 375 150 360 110" fill="none" stroke="#22d3ee" strokeWidth="2" markerEnd="url(#arrowCyan)" strokeDasharray="4 3" />
    <path d="M 440 190 Q 445 150 460 110" fill="none" stroke="#22d3ee" strokeWidth="2" markerEnd="url(#arrowCyan)" strokeDasharray="4 3" />

    {/* Condensation arrow to cloud */}
    <path d="M 360 110 Q 300 70 240 60" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3" />

    {/* Runoff arrow */}
    <path d="M 160 220 Q 220 230 280 215" fill="none" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arrowBlue)" />

    {/* Labels */}
    <text x="395" y="100" fill="#22d3ee" fontSize="9" fontWeight="bold" textAnchor="middle">Ð˜Ð¡ÐŸÐÐ Ð•ÐÐ˜Ð•</text>
    <text x="195" y="120" fill="#60a5fa" fontSize="9" fontWeight="bold" textAnchor="middle">ÐžÐ¡ÐÐ”ÐšÐ˜</text>
    <text x="220" y="245" fill="#3b82f6" fontSize="9" fontWeight="bold" textAnchor="middle">Ð¡Ð¢ÐžÐš</text>
    <text x="530" y="40" fill="#fbbf24" fontSize="9" fontWeight="bold">Ð¡ÐžÐ›ÐÐ¦Ð•</text>

    {/* Infiltration */}
    <path d="M 130 220 L 130 260" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="3 2" markerEnd="url(#arrowGreen2)" />
    <text x="115" y="275" fill="#22c55e" fontSize="7">Ð˜Ð½Ñ„Ð¸Ð»ÑŒÑ‚Ñ€Ð°Ñ†Ð¸Ñ</text>
  </svg>
);

const CoordinateSVG = () => (
  <svg viewBox="0 0 400 240" className="w-full h-full" style={{ fontFamily: "sans-serif" }}>
    <rect width="400" height="240" fill="#0a1a14" rx="10" />

    {/* Grid */}
    <g opacity="0.15">
      {[40, 80, 120, 160, 200, 240, 280, 320, 360].map((x) => (
        <line key={x} x1={x} y1="10" x2={x} y2="230" stroke="#6ee7b7" strokeWidth="0.5" />
      ))}
      {[20, 50, 80, 110, 140, 170, 200, 230].map((y) => (
        <line key={y} x1="10" y1={y} x2="390" y2={y} stroke="#6ee7b7" strokeWidth="0.5" />
      ))}
    </g>

    {/* Equator */}
    <line x1="10" y1="120" x2="390" y2="120" stroke="#fbbf24" strokeWidth="1.5" opacity="0.6" />
    <text x="392" y="124" fill="#fbbf24" fontSize="8">0Â°</text>

    {/* Prime Meridian */}
    <line x1="200" y1="10" x2="200" y2="230" stroke="#f472b6" strokeWidth="1.5" opacity="0.6" />
    <text x="195" y="8" fill="#f472b6" fontSize="8">0Â°</text>

    {/* Latitude label */}
    <text x="20" y="20" fill="#6ee7b7" fontSize="9" fontWeight="bold">Ð¨Ð˜Ð ÐžÐ¢Ð</text>
    <text x="20" y="32" fill="#94a3b8" fontSize="7">(ÑÐµÐ²ÐµÑ€-ÑŽÐ³)</text>

    {/* Longitude label */}
    <text x="320" y="225" fill="#f472b6" fontSize="9" fontWeight="bold">Ð”ÐžÐ›Ð“ÐžÐ¢Ð</text>
    <text x="320" y="237" fill="#94a3b8" fontSize="7">(Ð·Ð°Ð¿Ð°Ð´-Ð²Ð¾ÑÑ‚Ð¾Ðº)</text>

    {/* Moscow point */}
    <circle cx="240" cy="75" r="5" fill="#ef4444" stroke="#fff" strokeWidth="1">
      <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
    </circle>
    <line x1="240" y1="75" x2="240" y2="120" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 2" opacity="0.5" />
    <line x1="240" y1="75" x2="200" y2="75" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 2" opacity="0.5" />

    <rect x="248" y="60" width="120" height="30" rx="4" fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth="1" />
    <text x="308" y="73" fill="#fff" fontSize="8" fontWeight="bold" textAnchor="middle">ÐœÐ¾ÑÐºÐ²Ð°</text>
    <text x="308" y="84" fill="#fca5a5" fontSize="7" textAnchor="middle">56Â°N  37Â°E</text>

    {/* Direction labels */}
    <text x="200" y="18" fill="#94a3b8" fontSize="8" textAnchor="middle">Ð¡Ð•Ð’Ð•Ð  (+)</text>
    <text x="200" y="238" fill="#94a3b8" fontSize="8" textAnchor="middle">Ð®Ð“ (-)</text>
    <text x="15" y="124" fill="#94a3b8" fontSize="8">Ð—ÐÐŸÐÐ”</text>
    <text x="355" y="124" fill="#94a3b8" fontSize="8">Ð’ÐžÐ¡Ð¢ÐžÐš</text>
  </svg>
);


/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   DATA
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

const continents = [
  { name: "Ð•Ð²Ñ€Ð°Ð·Ð¸Ñ", area: 54.6, population: "5.3 Ð¼Ð»Ñ€Ð´", highest: "Ð­Ð²ÐµÑ€ÐµÑÑ‚ 8848Ð¼", color: "#22c55e" },
  { name: "ÐÑ„Ñ€Ð¸ÐºÐ°", area: 30.3, population: "1.4 Ð¼Ð»Ñ€Ð´", highest: "ÐšÐ¸Ð»Ð¸Ð¼Ð°Ð½Ð´Ð¶Ð°Ñ€Ð¾ 5895Ð¼", color: "#f59e0b" },
  { name: "Ð¡ÐµÐ². ÐÐ¼ÐµÑ€Ð¸ÐºÐ°", area: 24.4, population: "580 Ð¼Ð»Ð½", highest: "ÐœÐ°ÐºÐ¸Ð½Ð»Ð¸ 6190Ð¼", color: "#3b82f6" },
  { name: "Ð®Ð¶. ÐÐ¼ÐµÑ€Ð¸ÐºÐ°", area: 17.8, population: "430 Ð¼Ð»Ð½", highest: "ÐÐºÐ¾Ð½ÐºÐ°Ð³ÑƒÐ° 6962Ð¼", color: "#ef4444" },
  { name: "ÐÐ½Ñ‚Ð°Ñ€ÐºÑ‚Ð¸Ð´Ð°", area: 14.1, population: "~1000 (Ð½.-Ð¿.)", highest: "Ð’Ð¸Ð½ÑÐ¾Ð½ 4892Ð¼", color: "#a5b4fc" },
  { name: "ÐÐ²ÑÑ‚Ñ€Ð°Ð»Ð¸Ñ", area: 7.7, population: "43 Ð¼Ð»Ð½", highest: "ÐšÐ¾ÑÑ†ÑŽÑˆÐºÐ¾ 2228Ð¼", color: "#f472b6" },
];

const mapTypes = [
  { name: "Ð¤Ð¸Ð·Ð¸Ñ‡ÐµÑÐºÐ°Ñ", desc: "Ð ÐµÐ»ÑŒÐµÑ„, Ñ€ÐµÐºÐ¸, Ð³Ð¾Ñ€Ñ‹, Ð¼Ð¾Ñ€Ñ", icon: Mountain, color: "border-emerald-500", textColor: "text-emerald-400" },
  { name: "ÐŸÐ¾Ð»Ð¸Ñ‚Ð¸Ñ‡ÐµÑÐºÐ°Ñ", desc: "Ð¡Ñ‚Ñ€Ð°Ð½Ñ‹, Ð³Ñ€Ð°Ð½Ð¸Ñ†Ñ‹, ÑÑ‚Ð¾Ð»Ð¸Ñ†Ñ‹", icon: Globe2, color: "border-amber-500", textColor: "text-amber-400" },
  { name: "Ð¢ÐµÐ¼Ð°Ñ‚Ð¸Ñ‡ÐµÑÐºÐ°Ñ", desc: "ÐšÐ»Ð¸Ð¼Ð°Ñ‚, Ð½Ð°ÑÐµÐ»ÐµÐ½Ð¸Ðµ, Ñ€ÐµÑÑƒÑ€ÑÑ‹", icon: Map, color: "border-sky-500", textColor: "text-sky-400" },
];

const atmosphereLayers = [
  { name: "Ð¢Ñ€Ð¾Ð¿Ð¾ÑÑ„ÐµÑ€Ð°", height: "0-12 ÐºÐ¼", fact: "Ð—Ð´ÐµÑÑŒ Ð¼Ñ‹ Ð¶Ð¸Ð²Ñ‘Ð¼! Ð’ÑÑ Ð¿Ð¾Ð³Ð¾Ð´Ð° Ñ‚ÑƒÑ‚.", color: "#22c55e", pct: 100 },
  { name: "Ð¡Ñ‚Ñ€Ð°Ñ‚Ð¾ÑÑ„ÐµÑ€Ð°", height: "12-50 ÐºÐ¼", fact: "ÐžÐ·Ð¾Ð½Ð¾Ð²Ñ‹Ð¹ ÑÐ»Ð¾Ð¹ â€” Ð½Ð°Ñˆ Ñ‰Ð¸Ñ‚ Ð¾Ñ‚ Ð£Ð¤.", color: "#3b82f6", pct: 75 },
  { name: "ÐœÐµÐ·Ð¾ÑÑ„ÐµÑ€Ð°", height: "50-80 ÐºÐ¼", fact: "ÐœÐµÑ‚ÐµÐ¾Ñ€Ñ‹ ÑÐ³Ð¾Ñ€Ð°ÑŽÑ‚ Ð·Ð´ÐµÑÑŒ.", color: "#8b5cf6", pct: 50 },
  { name: "Ð¢ÐµÑ€Ð¼Ð¾ÑÑ„ÐµÑ€Ð°", height: "80-700 ÐºÐ¼", fact: "ÐœÐšÐ¡ Ð»ÐµÑ‚Ð°ÐµÑ‚ Ñ‚ÑƒÑ‚. ÐžÑ‡ÐµÐ½ÑŒ Ð¶Ð°Ñ€ÐºÐ¾!", color: "#f59e0b", pct: 35 },
  { name: "Ð­ÐºÐ·Ð¾ÑÑ„ÐµÑ€Ð°", height: "700+ ÐºÐ¼", fact: "ÐŸÐµÑ€ÐµÑ…Ð¾Ð´ Ð² ÐºÐ¾ÑÐ¼Ð¾Ñ. ÐŸÐ¾Ñ‡Ñ‚Ð¸ Ð²Ð°ÐºÑƒÑƒÐ¼.", color: "#94a3b8", pct: 20 },
];

const oceanFacts = [
  { name: "Ð¢Ð¸Ñ…Ð¸Ð¹", area: "165.3 Ð¼Ð»Ð½ ÐºÐ¼Â²", depth: "10 994 Ð¼ (ÐœÐ°Ñ€Ð¸Ð°Ð½ÑÐºÐ°Ñ Ð²Ð¿Ð°Ð´Ð¸Ð½Ð°)", color: "#0ea5e9" },
  { name: "ÐÑ‚Ð»Ð°Ð½Ñ‚Ð¸Ñ‡ÐµÑÐºÐ¸Ð¹", area: "91.7 Ð¼Ð»Ð½ ÐºÐ¼Â²", depth: "8 742 Ð¼", color: "#3b82f6" },
  { name: "Ð˜Ð½Ð´Ð¸Ð¹ÑÐºÐ¸Ð¹", area: "73.6 Ð¼Ð»Ð½ ÐºÐ¼Â²", depth: "7 258 Ð¼", color: "#6366f1" },
  { name: "Ð¡ÐµÐ²ÐµÑ€Ð½Ñ‹Ð¹ Ð›ÐµÐ´Ð¾Ð²Ð¸Ñ‚Ñ‹Ð¹", area: "14.8 Ð¼Ð»Ð½ ÐºÐ¼Â²", depth: "5 527 Ð¼", color: "#a5b4fc" },
];


/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MAIN PAGE COMPONENT
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

export default function Geography7Cheatsheet() {
  const [activeEarthLayer, setActiveEarthLayer] = useState<number | null>(null);
  const [expandedOcean, setExpandedOcean] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"maps" | "coords">("maps");

  return (
    <div className="min-h-screen bg-[#070f0b] text-emerald-50 p-4 md:p-8 font-sans relative overflow-x-hidden selection:bg-emerald-500/30">
      {/* Topographic background */}
      <div
        className="absolute inset-0 z-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 50%, #10b981 1px, transparent 1px),
            radial-gradient(circle at 80% 20%, #10b981 1px, transparent 1px),
            linear-gradient(to right, #064e3b 1px, transparent 1px),
            linear-gradient(to bottom, #064e3b 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px, 60px 60px, 80px 80px, 80px 80px",
        }}
      />

      {/* Glow orbs */}
      <div className="absolute top-[-200px] left-[-100px] w-[700px] h-[700px] bg-emerald-700/8 blur-[200px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-300px] right-[-200px] w-[600px] h-[600px] bg-teal-700/6 blur-[180px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">

        {/* â•â•â•â•â•â•â•â• HEADER â•â•â•â•â•â•â•â• */}
        <motion.header
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mb-16 relative"
        >
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-48 h-48 md:w-56 md:h-56 flex-shrink-0">
              <GlobeSVG />
            </div>
            <div className="text-center md:text-left flex-1">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-900/30 border border-emerald-500/40 text-emerald-300 text-xs mb-4 uppercase tracking-[0.2em] font-bold">
                <Compass className="w-3.5 h-3.5" /> Expedition_Initiated
              </div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-3">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-green-400">
                  TERRA
                </span>{" "}
                <span className="text-white">EXPLORER</span>
              </h1>
              <p className="text-emerald-400/70 text-lg md:text-xl">
                7 ÐºÐ»Ð°ÑÑ // Ð›Ð¸Ñ‚Ð¾ÑÑ„ÐµÑ€Ð°, Ð“Ð¸Ð´Ñ€Ð¾ÑÑ„ÐµÑ€Ð°, ÐÑ‚Ð¼Ð¾ÑÑ„ÐµÑ€Ð°, Ð“ÐµÐ¾Ð³Ñ€Ð°Ñ„Ð¸Ñ‡ÐµÑÐºÐ°Ñ ÐºÐ°Ñ€Ñ‚Ð°
              </p>
              <div className="flex items-center gap-4 mt-4 justify-center md:justify-start text-xs text-emerald-500/60">
                <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3" /> Ð˜Ð½Ñ‚ÐµÑ€Ð°ÐºÑ‚Ð¸Ð²Ð½Ð¾</span>
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> ÐÐ°Ð²ÐµÐ´Ð¸ Ð¸ ÑƒÐ·Ð½Ð°ÐµÑˆÑŒ</span>
              </div>
            </div>
          </div>
        </motion.header>

        {/* â•â•â•â•â•â•â•â• SECTION 1: EARTH STRUCTURE â•â•â•â•â•â•â•â• */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-emerald-900/30 rounded-xl border border-emerald-700/40">
              <Layers className="text-amber-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Ð¡Ñ‚Ñ€Ð¾ÐµÐ½Ð¸Ðµ Ð—ÐµÐ¼Ð»Ð¸</h2>
              <p className="text-emerald-500/60 text-sm">Ð§Ñ‚Ð¾ Ñƒ Ð½Ð°Ñ Ð¿Ð¾Ð´ Ð½Ð¾Ð³Ð°Ð¼Ð¸? ÐÐ°Ð²ÐµÐ´Ð¸ Ð½Ð° ÑÐ»Ð¾Ð¸!</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-[#0a1a14] rounded-2xl border border-emerald-800/40 p-4 h-72 md:h-80"
            >
              <EarthLayersSVG activeLayer={activeEarthLayer} setActiveLayer={setActiveEarthLayer} />
            </motion.div>

            <div className="space-y-3">
              {[
                { name: "Ð—ÐµÐ¼Ð½Ð°Ñ ÐºÐ¾Ñ€Ð°", detail: "Ð¢Ð¾Ð½ÐºÐ°Ñ Ð¾Ð±Ð¾Ð»Ð¾Ñ‡ÐºÐ°. ÐšÐ¾Ð½Ñ‚Ð¸Ð½ÐµÐ½Ñ‚Ð°Ð»ÑŒÐ½Ð°Ñ (30-70 ÐºÐ¼), Ð¾ÐºÐµÐ°Ð½Ð¸Ñ‡ÐµÑÐºÐ°Ñ (5-10 ÐºÐ¼).", color: "border-l-amber-700", bg: "bg-amber-950/20" },
                { name: "ÐœÐ°Ð½Ñ‚Ð¸Ñ", detail: "Ð¡Ð°Ð¼Ñ‹Ð¹ Ñ‚Ð¾Ð»ÑÑ‚Ñ‹Ð¹ ÑÐ»Ð¾Ð¹ (~2900 ÐºÐ¼). Ð¢ÐµÐºÑƒÑ‡ÐµÐµ Ð²ÐµÑ‰ÐµÑÑ‚Ð²Ð¾ â€” Ð¼Ð°Ð³Ð¼Ð°.", color: "border-l-orange-600", bg: "bg-orange-950/20" },
                { name: "Ð’Ð½ÐµÑˆÐ½ÐµÐµ ÑÐ´Ñ€Ð¾", detail: "Ð–Ð¸Ð´ÐºÐ¾Ðµ! Ð˜Ð· Ð¶ÐµÐ»ÐµÐ·Ð° Ð¸ Ð½Ð¸ÐºÐµÐ»Ñ. Ð¡Ð¾Ð·Ð´Ð°Ñ‘Ñ‚ Ð¼Ð°Ð³Ð½Ð¸Ñ‚Ð½Ð¾Ðµ Ð¿Ð¾Ð»Ðµ Ð—ÐµÐ¼Ð»Ð¸.", color: "border-l-red-500", bg: "bg-red-950/20" },
                { name: "Ð’Ð½ÑƒÑ‚Ñ€ÐµÐ½Ð½ÐµÐµ ÑÐ´Ñ€Ð¾", detail: "Ð¢Ð²Ñ‘Ñ€Ð´Ð¾Ðµ! Ð”Ð°Ð²Ð»ÐµÐ½Ð¸Ðµ Ñ‚Ð°ÐºÐ¾Ðµ Ð¾Ð³Ñ€Ð¾Ð¼Ð½Ð¾Ðµ, Ñ‡Ñ‚Ð¾ Ð¶ÐµÐ»ÐµÐ·Ð¾ Ð½Ðµ Ð¿Ð»Ð°Ð²Ð¸Ñ‚ÑÑ.", color: "border-l-yellow-400", bg: "bg-yellow-950/20" },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  whileHover={{ x: 4 }}
                  className={`${item.bg} p-4 rounded-lg border-l-4 ${item.color} cursor-pointer transition-all hover:shadow-lg`}
                  onMouseEnter={() => setActiveEarthLayer(i)}
                  onMouseLeave={() => setActiveEarthLayer(null)}
                >
                  <h4 className="font-bold text-white text-sm">{item.name}</h4>
                  <p className="text-xs text-gray-400 mt-1">{item.detail}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* â•â•â•â•â•â•â•â• SECTION 2: CLIMATE ZONES â•â•â•â•â•â•â•â• */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-emerald-900/30 rounded-xl border border-emerald-700/40">
              <Thermometer className="text-red-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">ÐšÐ»Ð¸Ð¼Ð°Ñ‚Ð¸Ñ‡ÐµÑÐºÐ¸Ðµ ÐŸÐ¾ÑÑÐ°</h2>
              <p className="text-emerald-500/60 text-sm">ÐžÑ‚ Ð¶Ð°Ñ€Ñ‹ Ð´Ð¾ Ð²ÐµÑ‡Ð½Ð¾Ð¹ Ð¼ÐµÑ€Ð·Ð»Ð¾Ñ‚Ñ‹</p>
            </div>
          </div>

          <div className="bg-[#0a1a14] rounded-2xl border border-emerald-800/40 overflow-hidden">
            <ClimateZonesSVG />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
            {[
              { name: "ÐÑ€ÐºÑ‚Ð¸Ñ‡ÐµÑÐºÐ¸Ð¹", desc: "Ð›ÐµÐ´ÑÐ½Ð°Ñ Ð¿ÑƒÑÑ‚Ñ‹Ð½Ñ. ÐŸÐ¾Ð»ÑÑ€Ð½Ð°Ñ Ð½Ð¾Ñ‡ÑŒ.", icon: Snowflake, color: "text-indigo-300", bg: "bg-indigo-950/30", border: "border-indigo-500/30" },
              { name: "Ð¡ÑƒÐ±Ð°Ñ€ÐºÑ‚Ð¸Ñ‡ÐµÑÐºÐ¸Ð¹", desc: "Ð¢ÑƒÐ½Ð´Ñ€Ð°. ÐœÑ…Ð¸, Ð»Ð¸ÑˆÐ°Ð¹Ð½Ð¸ÐºÐ¸, Ð¾Ð»ÐµÐ½Ð¸.", icon: CloudRain, color: "text-blue-300", bg: "bg-blue-950/30", border: "border-blue-500/30" },
              { name: "Ð£Ð¼ÐµÑ€ÐµÐ½Ð½Ñ‹Ð¹", desc: "Ð Ð¾ÑÑÐ¸Ñ Ñ‚ÑƒÑ‚! 4 ÑÐµÐ·Ð¾Ð½Ð°, Ð»ÐµÑÐ°, Ð¿Ð¾Ð»Ñ.", icon: TreePine, color: "text-emerald-300", bg: "bg-emerald-950/30", border: "border-emerald-500/30" },
              { name: "Ð¡ÑƒÐ±Ñ‚Ñ€Ð¾Ð¿Ð¸Ñ‡ÐµÑÐºÐ¸Ð¹", desc: "Ð¡Ñ€ÐµÐ´Ð¸Ð·ÐµÐ¼Ð½Ð¾Ð¼Ð¾Ñ€ÑŒÐµ. ÐžÐ»Ð¸Ð²ÐºÐ¸, Ð²Ð¸Ð½Ð¾.", icon: Sun, color: "text-orange-300", bg: "bg-orange-950/30", border: "border-orange-500/30" },
              { name: "Ð¢Ñ€Ð¾Ð¿Ð¸Ñ‡ÐµÑÐºÐ¸Ð¹", desc: "Ð’ÐµÑ‡Ð½Ð¾Ðµ Ð»ÐµÑ‚Ð¾. Ð”Ð¶ÑƒÐ½Ð³Ð»Ð¸, ÑÐ°Ð²Ð°Ð½Ð½Ð°.", icon: Sun, color: "text-red-300", bg: "bg-red-950/30", border: "border-red-500/30" },
            ].map((zone, i) => {
              const Icon = zone.icon;
              return (
                <motion.div
                  key={i}
                  whileHover={{ y: -4, scale: 1.03 }}
                  className={`${zone.bg} p-4 rounded-xl border ${zone.border} cursor-pointer transition-shadow hover:shadow-lg`}
                >
                  <Icon className={`w-5 h-5 ${zone.color} mb-2`} />
                  <h4 className={`font-bold text-sm ${zone.color}`}>{zone.name}</h4>
                  <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{zone.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* â•â•â•â•â•â•â•â• SECTION 3: MAPS & COORDINATES (TABBED) â•â•â•â•â•â•â•â• */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-emerald-900/30 rounded-xl border border-emerald-700/40">
              <Compass className="text-emerald-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">ÐšÐ°Ñ€Ñ‚Ñ‹ Ð¸ ÐšÐ¾Ð¾Ñ€Ð´Ð¸Ð½Ð°Ñ‚Ñ‹</h2>
              <p className="text-emerald-500/60 text-sm">ÐšÐ°Ðº Ð½Ðµ Ð·Ð°Ð±Ð»ÑƒÐ´Ð¸Ñ‚ÑŒÑÑ Ð½Ð° Ð¿Ð»Ð°Ð½ÐµÑ‚Ðµ</p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab("maps")}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "maps" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/50" : "bg-emerald-950/30 text-emerald-500 hover:bg-emerald-900/30"}`}
            >
              <Map className="w-4 h-4 inline mr-1.5" />Ð¢Ð¸Ð¿Ñ‹ ÐšÐ°Ñ€Ñ‚
            </button>
            <button
              onClick={() => setActiveTab("coords")}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "coords" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/50" : "bg-emerald-950/30 text-emerald-500 hover:bg-emerald-900/30"}`}
            >
              <Globe2 className="w-4 h-4 inline mr-1.5" />ÐšÐ¾Ð¾Ñ€Ð´Ð¸Ð½Ð°Ñ‚Ñ‹
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === "maps" ? (
              <motion.div
                key="maps"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="grid md:grid-cols-3 gap-6">
                  {mapTypes.map((type, i) => {
                    const Icon = type.icon;
                    return (
                      <motion.div
                        key={i}
                        whileHover={{ y: -6 }}
                        className="bg-[#0a1a14] rounded-2xl border border-emerald-800/40 p-6 hover:shadow-2xl hover:shadow-emerald-900/20 transition-all"
                      >
                        <div className={`w-14 h-14 rounded-xl ${type.color} border-2 flex items-center justify-center mb-4 bg-black/30`}>
                          <Icon className={`w-7 h-7 ${type.textColor}`} />
                        </div>
                        <h3 className="font-bold text-white text-lg mb-2">{type.name}</h3>
                        <p className="text-sm text-gray-400">{type.desc}</p>
                        <div className="mt-4 pt-3 border-t border-emerald-900/30">
                          <p className="text-xs text-emerald-500/50">
                            {type.name === "Ð¤Ð¸Ð·Ð¸Ñ‡ÐµÑÐºÐ°Ñ" && "ÐœÐ°ÑÑˆÑ‚Ð°Ð± 1:1000000 â€” Ð² 1 ÑÐ¼ 10 ÐºÐ¼"}
                            {type.name === "ÐŸÐ¾Ð»Ð¸Ñ‚Ð¸Ñ‡ÐµÑÐºÐ°Ñ" && "Ð¡Ñ‚Ð¾Ð»Ð¸Ñ†Ñ‹ â€” ÐºÑ€Ð°ÑÐ½Ñ‹Ðµ Ñ‚Ð¾Ñ‡ÐºÐ¸ â˜…"}
                            {type.name === "Ð¢ÐµÐ¼Ð°Ñ‚Ð¸Ñ‡ÐµÑÐºÐ°Ñ" && "Ð˜Ð·Ð¾Ð»Ð¸Ð½Ð¸Ð¸ Ð¿Ð¾ÐºÐ°Ð·Ñ‹Ð²Ð°ÑŽÑ‚ Ð¾Ð´Ð¸Ð½Ð°ÐºÐ¾Ð²Ñ‹Ðµ Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ"}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Scale explanation */}
                <div className="mt-6 bg-[#0a1a14] p-5 rounded-xl border border-emerald-800/30">
                  <h4 className="font-bold text-white mb-3 flex items-center gap-2">
                    <Info className="w-4 h-4 text-emerald-400" /> ÐœÐ°ÑÑˆÑ‚Ð°Ð±
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="bg-black/20 p-3 rounded-lg border border-emerald-900/30">
                      <div className="text-emerald-400 font-bold font-mono">1:10000</div>
                      <div className="text-gray-400 text-xs">ÐšÑ€ÑƒÐ¿Ð½Ñ‹Ð¹. 1 ÑÐ¼ = 100 Ð¼</div>
                      <div className="text-gray-500 text-[10px] mt-1">Ð”ÐµÑ‚Ð°Ð»Ð¸ Ð·Ð´Ð°Ð½Ð¸Ð¹ Ð²Ð¸Ð´Ð½Ñ‹</div>
                    </div>
                    <div className="bg-black/20 p-3 rounded-lg border border-emerald-900/30">
                      <div className="text-emerald-400 font-bold font-mono">1:100000</div>
                      <div className="text-gray-400 text-xs">Ð¡Ñ€ÐµÐ´Ð½Ð¸Ð¹. 1 ÑÐ¼ = 1 ÐºÐ¼</div>
                      <div className="text-gray-500 text-[10px] mt-1">Ð“Ð¾Ñ€Ð¾Ð´Ð° Ð¸ Ð´Ð¾Ñ€Ð¾Ð³Ð¸</div>
                    </div>
                    <div className="bg-black/20 p-3 rounded-lg border border-emerald-900/30">
                      <div className="text-emerald-400 font-bold font-mono">1:1000000</div>
                      <div className="text-gray-400 text-xs">ÐœÐµÐ»ÐºÐ¸Ð¹. 1 ÑÐ¼ = 10 ÐºÐ¼</div>
                      <div className="text-gray-500 text-[10px] mt-1">ÐžÐ±Ð·Ð¾Ñ€ Ð¾Ð±Ð»Ð°ÑÑ‚ÐµÐ¹</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="coords"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  <div className="bg-[#0a1a14] rounded-2xl border border-emerald-800/40 overflow-hidden h-64">
                    <CoordinateSVG />
                  </div>
                  <div className="space-y-4">
                    <div className="bg-[#0a1a14] p-5 rounded-xl border border-pink-500/20">
                      <h4 className="font-bold text-pink-400 mb-2">Ð”Ð¾Ð»Ð³Ð¾Ñ‚Ð° (Î»)</h4>
                      <p className="text-sm text-gray-300">ÐžÑ‚ Ð“Ñ€Ð¸Ð½Ð²Ð¸Ñ‡Ð° (0Â°) Ð½Ð° Ð·Ð°Ð¿Ð°Ð´ Ð¸Ð»Ð¸ Ð²Ð¾ÑÑ‚Ð¾Ðº (Ð´Ð¾ 180Â°).</p>
                      <div className="mt-2 flex gap-2 text-xs">
                        <span className="bg-pink-900/30 text-pink-300 px-2 py-1 rounded">W (Ð·Ð°Ð¿Ð°Ð´)</span>
                        <span className="bg-pink-900/30 text-pink-300 px-2 py-1 rounded">E (Ð²Ð¾ÑÑ‚Ð¾Ðº)</span>
                      </div>
                    </div>
                    <div className="bg-[#0a1a14] p-5 rounded-xl border border-yellow-500/20">
                      <h4 className="font-bold text-yellow-400 mb-2">Ð¨Ð¸Ñ€Ð¾Ñ‚Ð° (Ï†)</h4>
                      <p className="text-sm text-gray-300">ÐžÑ‚ ÑÐºÐ²Ð°Ñ‚Ð¾Ñ€Ð° (0Â°) Ðº Ð¿Ð¾Ð»ÑŽÑÐ°Ð¼ (Ð´Ð¾ 90Â°).</p>
                      <div className="mt-2 flex gap-2 text-xs">
                        <span className="bg-yellow-900/30 text-yellow-300 px-2 py-1 rounded">N (ÑÐµÐ²ÐµÑ€)</span>
                        <span className="bg-yellow-900/30 text-yellow-300 px-2 py-1 rounded">S (ÑŽÐ³)</span>
                      </div>
                    </div>
                    <div className="bg-emerald-950/30 p-4 rounded-lg border border-emerald-700/30">
                      <p className="text-xs text-emerald-300">
                        <strong>Ð›Ð°Ð¹Ñ„Ñ…Ð°Ðº:</strong> Ð¨Ð¸Ñ€Ð¾Ñ‚Ð° â€” Ð³Ð¾Ñ€Ð¸Ð·Ð¾Ð½Ñ‚Ð°Ð»ÑŒÐ½Ñ‹Ðµ Ð»Ð¸Ð½Ð¸Ð¸ (ÐºÐ°Ðº ÑÑ‚ÑƒÐ¿ÐµÐ½ÑŒÐºÐ¸ Ð»ÐµÑÑ‚Ð½Ð¸Ñ†Ñ‹), Ð´Ð¾Ð»Ð³Ð¾Ñ‚Ð° â€” Ð²ÐµÑ€Ñ‚Ð¸ÐºÐ°Ð»ÑŒÐ½Ñ‹Ðµ (ÐºÐ°Ðº ÑÑ‚Ð¾Ð»Ð±Ñ‹ Ð·Ð°Ð±Ð¾Ñ€Ð°). Ð¡Ð½Ð°Ñ‡Ð°Ð»Ð° ÑˆÐ¸Ñ€Ð¾Ñ‚Ð°, Ð¿Ð¾Ñ‚Ð¾Ð¼ Ð´Ð¾Ð»Ð³Ð¾Ñ‚Ð°!
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* â•â•â•â•â•â•â•â• SECTION 4: CONTINENTS â•â•â•â•â•â•â•â• */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-emerald-900/30 rounded-xl border border-emerald-700/40">
              <Mountain className="text-emerald-300 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">ÐœÐ°Ñ‚ÐµÑ€Ð¸ÐºÐ¸</h2>
              <p className="text-emerald-500/60 text-sm">6 ÐºÑƒÑÐºÐ¾Ð² ÑÑƒÑˆÐ¸ â€” Ð³Ð»Ð°Ð²Ð½Ñ‹Ðµ Ñ„Ð°ÐºÑ‚Ñ‹</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {continents.map((c, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -5, scale: 1.02 }}
                className="bg-[#0a1a14] rounded-xl border border-emerald-800/40 p-5 hover:shadow-xl hover:shadow-emerald-900/10 transition-all group"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-white text-lg group-hover:text-emerald-300 transition-colors">{c.name}</h3>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                </div>

                {/* Area bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>ÐŸÐ»Ð¾Ñ‰Ð°Ð´ÑŒ</span>
                    <span>{c.area} Ð¼Ð»Ð½ ÐºÐ¼Â²</span>
                  </div>
                  <div className="h-2 bg-emerald-950/50 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(c.area / 55) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: i * 0.1 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">ÐÐ°ÑÐµÐ»ÐµÐ½Ð¸Ðµ</span>
                    <span className="text-gray-300">{c.population}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ð’Ñ‹ÑÑˆÐ°Ñ Ñ‚Ð¾Ñ‡ÐºÐ°</span>
                    <span className="text-gray-300">{c.highest}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* â•â•â•â•â•â•â•â• SECTION 5: OCEANS â•â•â•â•â•â•â•â• */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-emerald-900/30 rounded-xl border border-emerald-700/40">
              <Waves className="text-sky-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">ÐžÐºÐµÐ°Ð½Ñ‹</h2>
              <p className="text-emerald-500/60 text-sm">70% Ð¿Ð»Ð°Ð½ÐµÑ‚Ñ‹ â€” Ð²Ð¾Ð´Ð°. ÐšÐ»Ð¸ÐºÐ½Ð¸ Ð´Ð»Ñ Ð´ÐµÑ‚Ð°Ð»ÐµÐ¹!</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {oceanFacts.map((ocean, i) => (
              <motion.div
                key={i}
                layout
                onClick={() => setExpandedOcean(expandedOcean === i ? null : i)}
                className="bg-[#0a1a14] rounded-xl border border-sky-800/30 p-5 cursor-pointer hover:border-sky-600/50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${ocean.color}20` }}>
                      <Droplets className="w-5 h-5" style={{ color: ocean.color }} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{ocean.name} Ð¾ÐºÐµÐ°Ð½</h3>
                      <p className="text-xs text-gray-500">{ocean.area}</p>
                    </div>
                  </div>
                  {expandedOcean === i ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </div>

                <AnimatePresence>
                  {expandedOcean === i && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 pt-3 border-t border-sky-900/30 space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-sky-400 font-bold min-w-[70px]">Ð“Ð»ÑƒÐ±Ð¸Ð½Ð°:</span>
                          <span className="text-xs text-gray-300">{ocean.depth}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-sky-400 font-bold min-w-[70px]">Ð¤Ð°ÐºÑ‚:</span>
                          <span className="text-xs text-gray-300">
                            {i === 0 && "Ð¡Ð°Ð¼Ñ‹Ð¹ Ð±Ð¾Ð»ÑŒÑˆÐ¾Ð¹ Ð¸ Ð³Ð»ÑƒÐ±Ð¾ÐºÐ¸Ð¹. Ð’ Ð½Ñ‘Ð¼ Ð±Ð¾Ð»ÑŒÑˆÐµ Ð²Ð¾Ð´Ñ‹, Ñ‡ÐµÐ¼ Ð²Ð¾ Ð²ÑÐµÑ… Ð¾ÑÑ‚Ð°Ð»ÑŒÐ½Ñ‹Ñ… Ð²Ð¼ÐµÑÑ‚Ðµ Ð²Ð·ÑÑ‚Ñ‹Ñ…!"}
                            {i === 1 && "Ð’Ñ‚Ð¾Ñ€Ð¾Ð¹ Ð¿Ð¾ Ð²ÐµÐ»Ð¸Ñ‡Ð¸Ð½Ðµ. Ð§ÐµÑ€ÐµÐ· Ð½ÐµÐ³Ð¾ Ð¿Ñ€Ð¾Ñ…Ð¾Ð´Ð¸Ð» Ð·Ð½Ð°Ð¼ÐµÐ½Ð¸Ñ‚Ñ‹Ð¹ Ð¼Ð°Ñ€ÑˆÑ€ÑƒÑ‚ ÐšÐ¾Ð»ÑƒÐ¼Ð±Ð°."}
                            {i === 2 && "Ð¡Ð°Ð¼Ñ‹Ð¹ Ñ‚Ñ‘Ð¿Ð»Ñ‹Ð¹ Ð¾ÐºÐµÐ°Ð½. ÐœÑƒÑÑÐ¾Ð½Ð½Ñ‹Ðµ Ð²ÐµÑ‚Ñ€Ð° Ð¼ÐµÐ½ÑÑŽÑ‚ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ðµ Ð¿Ð¾ ÑÐµÐ·Ð¾Ð½Ð°Ð¼."}
                            {i === 3 && "Ð¡Ð°Ð¼Ñ‹Ð¹ Ð¼Ð°Ð»ÐµÐ½ÑŒÐºÐ¸Ð¹ Ð¸ Ð¼ÐµÐ»ÐºÐ¸Ð¹. ÐŸÐ¾Ñ‡Ñ‚Ð¸ Ð¿Ð¾Ð»Ð½Ð¾ÑÑ‚ÑŒÑŽ Ð¿Ð¾ÐºÑ€Ñ‹Ñ‚ Ð»ÑŒÐ´Ð¾Ð¼."}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* â•â•â•â•â•â•â•â• SECTION 6: WATER CYCLE â•â•â•â•â•â•â•â• */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-emerald-900/30 rounded-xl border border-emerald-700/40">
              <Droplets className="text-sky-300 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">ÐšÑ€ÑƒÐ³Ð¾Ð²Ð¾Ñ€Ð¾Ñ‚ Ð’Ð¾Ð´Ñ‹</h2>
              <p className="text-emerald-500/60 text-sm">Ð’Ð¾Ð´Ð° Ð½Ð¸ÐºÐ¾Ð³Ð´Ð° Ð½Ðµ Ð¸ÑÑ‡ÐµÐ·Ð°ÐµÑ‚ â€” Ð¾Ð½Ð° Ð¿ÑƒÑ‚ÐµÑˆÐµÑÑ‚Ð²ÑƒÐµÑ‚</p>
            </div>
          </div>

          <div className="bg-[#0a1a14] rounded-2xl border border-emerald-800/40 overflow-hidden h-64 md:h-72">
            <WaterCycleSVG />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {[
              { name: "Ð˜ÑÐ¿Ð°Ñ€ÐµÐ½Ð¸Ðµ", desc: "Ð¡Ð¾Ð»Ð½Ñ†Ðµ Ð³Ñ€ÐµÐµÑ‚ Ð²Ð¾Ð´Ñƒ â†’ Ð¿Ð°Ñ€ Ð¿Ð¾Ð´Ð½Ð¸Ð¼Ð°ÐµÑ‚ÑÑ", icon: Sun, color: "text-yellow-400", bg: "bg-yellow-950/20" },
              { name: "ÐšÐ¾Ð½Ð´ÐµÐ½ÑÐ°Ñ†Ð¸Ñ", desc: "ÐŸÐ°Ñ€ Ð¾ÑÑ‚Ñ‹Ð²Ð°ÐµÑ‚ â†’ Ð¾Ð±Ð»Ð°ÐºÐ°", icon: CloudRain, color: "text-gray-300", bg: "bg-gray-900/30" },
              { name: "ÐžÑÐ°Ð´ÐºÐ¸", desc: "ÐžÐ±Ð»Ð°ÐºÐ° Ñ‚ÑÐ¶ÐµÐ»ÐµÑŽÑ‚ â†’ Ð´Ð¾Ð¶Ð´ÑŒ/ÑÐ½ÐµÐ³", icon: Droplets, color: "text-blue-400", bg: "bg-blue-950/20" },
              { name: "Ð¡Ñ‚Ð¾Ðº", desc: "Ð’Ð¾Ð´Ð° Ð²Ð¾Ð·Ð²Ñ€Ð°Ñ‰Ð°ÐµÑ‚ÑÑ Ð² Ð¾ÐºÐµÐ°Ð½ Ð¿Ð¾ Ñ€ÐµÐºÐ°Ð¼", icon: Waves, color: "text-cyan-400", bg: "bg-cyan-950/20" },
            ].map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={i}
                  whileHover={{ y: -3 }}
                  className={`${step.bg} p-4 rounded-xl border border-emerald-800/20 text-center`}
                >
                  <Icon className={`w-6 h-6 ${step.color} mx-auto mb-2`} />
                  <h4 className="font-bold text-white text-sm">{step.name}</h4>
                  <p className="text-[10px] text-gray-500 mt-1">{step.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* â•â•â•â•â•â•â•â• SECTION 7: ATMOSPHERE â•â•â•â•â•â•â•â• */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-emerald-900/30 rounded-xl border border-emerald-700/40">
              <Wind className="text-teal-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Ð¡Ð»Ð¾Ð¸ ÐÑ‚Ð¼Ð¾ÑÑ„ÐµÑ€Ñ‹</h2>
              <p className="text-emerald-500/60 text-sm">Ð’Ð¾Ð·Ð´ÑƒÑ… Ð²Ð¾ÐºÑ€ÑƒÐ³ Ð½Ð°Ñ â€” Ð½Ðµ Ð¿Ñ€Ð¾ÑÑ‚Ð¾ Ð²Ð¾Ð·Ð´ÑƒÑ…</p>
            </div>
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="space-y-2">
              {atmosphereLayers.map((layer, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  whileHover={{ x: 8 }}
                  className="bg-[#0a1a14] rounded-lg border border-emerald-800/20 overflow-hidden cursor-pointer group"
                >
                  <div className="flex items-center gap-4 p-4">
                    {/* Height bar */}
                    <div className="flex flex-col items-center min-w-[70px]">
                      <span className="text-[10px] text-gray-500">Ð’Ñ‹ÑÐ¾Ñ‚Ð°</span>
                      <span className="text-xs font-mono font-bold text-white">{layer.height}</span>
                    </div>
                    {/* Color bar */}
                    <div className="h-10 rounded-lg flex items-center px-4 flex-1 transition-all" style={{ backgroundColor: `${layer.color}15`, borderLeft: `3px solid ${layer.color}` }}>
                      <div>
                        <h4 className="font-bold text-sm" style={{ color: layer.color }}>{layer.name}</h4>
                        <p className="text-[10px] text-gray-400 group-hover:text-gray-300 transition-colors">{layer.fact}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Key atmosphere fact */}
            <div className="mt-6 bg-emerald-950/20 p-4 rounded-xl border border-emerald-700/30">
              <p className="text-xs text-emerald-300">
                <strong>Ð—Ð°Ð¿Ð¾Ð¼Ð½Ð¸:</strong> ÐÑ‚Ð¼Ð¾ÑÑ„ÐµÑ€Ð½Ð¾Ðµ Ð´Ð°Ð²Ð»ÐµÐ½Ð¸Ðµ Ð½Ð° ÑƒÑ€Ð¾Ð²Ð½Ðµ Ð¼Ð¾Ñ€Ñ = 760 Ð¼Ð¼ Ñ€Ñ‚. ÑÑ‚. Ð¡ Ð²Ñ‹ÑÐ¾Ñ‚Ð¾Ð¹ Ð´Ð°Ð²Ð»ÐµÐ½Ð¸Ðµ Ð¿Ð°Ð´Ð°ÐµÑ‚! ÐÐ° Ð²ÐµÑ€ÑˆÐ¸Ð½Ðµ Ð­Ð²ÐµÑ€ÐµÑÑ‚Ð° Ð¾Ð½Ð¾ Ð² 3 Ñ€Ð°Ð·Ð° Ð¼ÐµÐ½ÑŒÑˆÐµ.
              </p>
            </div>
          </div>
        </motion.section>

        {/* â•â•â•â•â•â•â•â• SECTION 8: KEY FORMULAS & FACTS â•â•â•â•â•â•â•â• */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-emerald-900/30 rounded-xl border border-emerald-700/40">
              <Info className="text-yellow-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Ð¤Ð¾Ñ€Ð¼ÑƒÐ»Ñ‹ Ð¸ Ð¤Ð°ÐºÑ‚Ñ‹</h2>
              <p className="text-emerald-500/60 text-sm">Ð¨Ð¿Ð°Ñ€Ð³Ð°Ð»ÐºÐ° Ð² ÑˆÐ¿Ð°Ñ€Ð³Ð°Ð»ÐºÐµ â€” Ð¼ÐµÑ‚Ð°-ÑƒÑ€Ð¾Ð²ÐµÐ½ÑŒ</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Formulas */}
            <div className="bg-[#0a1a14] p-6 rounded-2xl border border-emerald-800/30">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />Ð¤Ð¾Ñ€Ð¼ÑƒÐ»Ñ‹
              </h3>
              <div className="space-y-3">
                {[
                  { formula: "L = Î» Ã— t", desc: "Ð”Ð»Ð¸Ð½Ð° Ð´ÑƒÐ³Ð¸ Ð¼ÐµÑ€Ð¸Ð´Ð¸Ð°Ð½Ð°", detail: "Î» â€” Ð´Ð»Ð¸Ð½Ð° 1Â° Ð´ÑƒÐ³Ð¸ (â‰ˆ111 ÐºÐ¼), t â€” Ñ€Ð°Ð·Ð½Ð¾ÑÑ‚ÑŒ ÑˆÐ¸Ñ€Ð¾Ñ‚" },
                  { formula: "h = t Ã— 6Â°C", desc: "ÐŸÐ°Ð´ÐµÐ½Ð¸Ðµ Ñ‚ÐµÐ¼Ð¿ÐµÑ€Ð°Ñ‚ÑƒÑ€Ñ‹ Ñ Ð²Ñ‹ÑÐ¾Ñ‚Ð¾Ð¹", detail: "ÐÐ° ÐºÐ°Ð¶Ð´Ñ‹Ð¹ 1 ÐºÐ¼ Ð²Ð²ÐµÑ€Ñ… â†’ -6Â°C" },
                  { formula: "P = Pâ‚€ - Î”h Ã— 1Ð¼Ð¼", desc: "Ð”Ð°Ð²Ð»ÐµÐ½Ð¸Ðµ Ñ Ð²Ñ‹ÑÐ¾Ñ‚Ð¾Ð¹", detail: "ÐÐ° ÐºÐ°Ð¶Ð´Ñ‹Ðµ 10,5 Ð¼ Ð²Ð²ÐµÑ€Ñ… â†’ -1 Ð¼Ð¼ Ñ€Ñ‚. ÑÑ‚." },
                  { formula: "ÐÐ±Ñ. Ð²Ñ‹ÑÐ¾Ñ‚Ð° = ÐžÑ‚Ð½. Ð²Ñ‹ÑÐ¾Ñ‚Ð° + h Ð¿Ð¾Ð´Ð½Ð¾Ð¶Ð¸Ñ", desc: "ÐÐ±ÑÐ¾Ð»ÑŽÑ‚Ð½Ð°Ñ Ð²Ñ‹ÑÐ¾Ñ‚Ð° Ð²ÐµÑ€ÑˆÐ¸Ð½Ñ‹", detail: "ÐžÑ‚ Ð¿Ð¾Ð´Ð½Ð¾Ð¶Ð¸Ñ Ð´Ð¾ Ð²ÐµÑ€ÑˆÐ¸Ð½Ñ‹ + Ð²Ñ‹ÑÐ¾Ñ‚Ð° Ð¿Ð¾Ð´Ð½Ð¾Ð¶Ð¸Ñ Ð½Ð°Ð´ ÑƒÑ€Ð¾Ð²Ð½ÐµÐ¼ Ð¼Ð¾Ñ€Ñ" },
                ].map((f, i) => (
                  <div key={i} className="bg-black/30 p-3 rounded-lg border border-emerald-900/20">
                    <div className="font-mono text-emerald-400 font-bold text-lg">{f.formula}</div>
                    <div className="text-sm text-gray-300 mt-1">{f.desc}</div>
                    <div className="text-[10px] text-gray-500 mt-1">{f.detail}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Facts */}
            <div className="bg-[#0a1a14] p-6 rounded-2xl border border-emerald-800/30">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400" />Ð‘Ñ‹ÑÑ‚Ñ€Ñ‹Ðµ Ð¤Ð°ÐºÑ‚Ñ‹
              </h3>
              <div className="space-y-3">
                {[
                  { label: "Ð Ð°Ð´Ð¸ÑƒÑ Ð—ÐµÐ¼Ð»Ð¸", value: "6 371 ÐºÐ¼" },
                  { label: "Ð”Ð»Ð¸Ð½Ð° ÑÐºÐ²Ð°Ñ‚Ð¾Ñ€Ð°", value: "40 075 ÐºÐ¼" },
                  { label: "Ð”Ð»Ð¸Ð½Ð° Ð¼ÐµÑ€Ð¸Ð´Ð¸Ð°Ð½Ð°", value: "20 004 ÐºÐ¼" },
                  { label: "1Â° Ð¼ÐµÑ€Ð¸Ð´Ð¸Ð°Ð½Ð°", value: "â‰ˆ 111 ÐºÐ¼" },
                  { label: "1Â° ÑÐºÐ²Ð°Ñ‚Ð¾Ñ€Ð°", value: "â‰ˆ 111,3 ÐºÐ¼" },
                  { label: "ÐœÐ°ÐºÑ. Ð²Ñ‹ÑÐ¾Ñ‚Ð° ÑÑƒÑˆÐ¸", value: "8 848 Ð¼ (Ð­Ð²ÐµÑ€ÐµÑÑ‚)" },
                  { label: "ÐœÐ°ÐºÑ. Ð³Ð»ÑƒÐ±Ð¸Ð½Ð° Ð¾ÐºÐµÐ°Ð½Ð°", value: "10 994 Ð¼ (ÐœÐ°Ñ€Ð¸Ð°Ð½ÑÐºÐ°Ñ)" },
                  { label: "Ð”Ð¾Ð»Ñ Ð²Ð¾Ð´Ñ‹ Ð½Ð° Ð—ÐµÐ¼Ð»Ðµ", value: "71% Ð¿Ð¾Ð²ÐµÑ€Ñ…Ð½Ð¾ÑÑ‚Ð¸" },
                  { label: "Ð”Ð¾Ð»Ñ Ð¿Ñ€ÐµÑÐ½Ð¾Ð¹ Ð²Ð¾Ð´Ñ‹", value: "~2.5% Ð¾Ñ‚ Ð²ÑÐµÐ¹ Ð²Ð¾Ð´Ñ‹" },
                ].map((fact, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-emerald-900/20 last:border-0">
                    <span className="text-sm text-gray-400">{fact.label}</span>
                    <span className="text-sm font-bold text-amber-300">{fact.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* â•â•â•â•â•â•â•â• FOOTER â•â•â•â•â•â•â•â• */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex justify-center pb-8"
        >
          <Link href="/">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group flex items-center gap-3 bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-4 px-10 rounded-full shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span>ÐÐÐ—ÐÐ” Ðš ÐšÐÐ Ð¢Ð•</span>
            </motion.div>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
