"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { 
  Activity, Server, Database, Globe, Cpu, 
  ShieldCheck, Zap, Box, GraduationCap, 
  DollarSign, Terminal, Lock, Play
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { useAppContext } from "@/contexts/AppContext";

// --- Types & Data ---

type SectorStatus = 'online' | 'offline' | 'warning' | 'building';

interface SystemSector {
  id: string;
  title: string;
  description: string;
  icon: string; // Lucide icon name for VibeContentRenderer
  href: string;
  color: string;
  status: SectorStatus;
  metrics: string; // e.g., "5 Active Nodes"
  filesCount: number; // Rough estimate based on your file tree
}

const SECTORS: SystemSector[] = [
  {
    id: 'academy',
    title: 'ACADEMY SECTOR',
    description: 'Центр подготовки кадров. ВПР, Туториалы, Кибершкола.',
    icon: 'FaGraduationCap',
    href: '/vpr-tests',
    color: 'text-brand-green',
    status: 'online',
    metrics: '6 Modules Active',
    filesCount: 45
  },
  {
    id: 'logistics',
    title: 'LOGISTICS HUB (WB)',
    description: 'Управление складами, экипажами и поставками.',
    icon: 'FaBox',
    href: '/wblanding',
    color: 'text-brand-cyan',
    status: 'online',
    metrics: 'API Linked',
    filesCount: 82
  },
  {
    id: 'finance',
    title: 'DEFI / ARBITRAGE',
    description: 'Мониторинг спредов, крипто-сканеры (Elon).',
    icon: 'FaBitcoin',
    href: '/elon',
    color: 'text-brand-gold',
    status: 'warning', // Maybe markets are volatile?
    metrics: 'Scanning...',
    filesCount: 28
  },
  {
    id: 'rentals',
    title: 'FLEET MANAGEMENT',
    description: 'Аренда авто, байков, саун. Управление активами.',
    icon: 'FaCar',
    href: '/rentals',
    color: 'text-brand-purple',
    status: 'online',
    metrics: 'Fleet Ready',
    filesCount: 35
  },
  {
    id: 'studio',
    title: 'CYBER STUDIO (GOD MODE)',
    description: 'Ядро само-модификации. Редактор кода, AI Ассистент.',
    icon: 'FaTerminal',
    href: '/repo-xml',
    color: 'text-brand-red-orange',
    status: 'building', // Always evolving
    metrics: 'Access: ROOT',
    filesCount: 150
  },
  {
    id: 'bio',
    title: 'BIO-ENHANCEMENT',
    description: 'Биохакинг, добавки, трекинг здоровья.',
    icon: 'FaDna',
    href: '/bio30',
    color: 'text-neon-lime',
    status: 'online',
    metrics: 'Optimal State',
    filesCount: 40
  }
];

// --- Components ---

const SectorCard = ({ sector, index }: { sector: SystemSector; index: number }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group relative"
    >
      <Link href={sector.href} className="block h-full">
        <div className={cn(
          "h-full bg-zinc-900/50 border border-white/5 rounded-xl p-6 backdrop-blur-md transition-all duration-300 overflow-hidden",
          "hover:border-opacity-50 hover:bg-zinc-900/80 hover:shadow-[0_0_30px_-10px_rgba(0,0,0,0.5)]",
          `hover:border-${sector.color.split('-')[1]}-500` // Dynamic border color on hover attempt
        )}>
          {/* Status Dot */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              sector.status === 'online' ? "bg-green-500" :
              sector.status === 'warning' ? "bg-yellow-500" :
              "bg-blue-500"
            )} />
            <span className="text-[10px] uppercase font-mono text-zinc-500">{sector.status}</span>
          </div>

          {/* Icon */}
          <div className={cn("mb-4 text-4xl", sector.color)}>
            <VibeContentRenderer content={`::${sector.icon}::`} />
          </div>

          {/* Text */}
          <h3 className="text-xl font-bold text-white font-orbitron mb-2 group-hover:text-white transition-colors">
            {sector.title}
          </h3>
          <p className="text-sm text-gray-400 mb-6 line-clamp-2">
            {sector.description}
          </p>

          {/* Tech Footer */}
          <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-center text-xs font-mono text-zinc-500">
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3" /> {sector.filesCount} Files
            </span>
            <span className={cn("opacity-70 group-hover:opacity-100 transition-opacity", sector.color)}>
              {sector.metrics}
            </span>
          </div>
          
          {/* Hover Glow Effect */}
          <div className={cn(
            "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none bg-gradient-to-br",
            sector.color.replace('text-', 'from-')
          )} />
        </div>
      </Link>
    </motion.div>
  );
};

const SystemStats = () => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
      {[
        { label: "TOTAL FILES", val: "530+", icon: "FaFileCode", color: "text-blue-400" },
        { label: "SYSTEM STATUS", val: "OPERATIONAL", icon: "FaShieldHalved", color: "text-green-400" },
        { label: "AI AGENTS", val: "ONLINE", icon: "FaRobot", color: "text-purple-400" },
        { label: "USER LEVEL", val: "DETECTING...", icon: "FaUserAstronaut", color: "text-yellow-400" },
      ].map((stat, i) => (
        <div key={i} className="bg-black/40 border border-white/10 p-4 rounded-lg flex items-center gap-4">
          <div className={cn("text-2xl", stat.color)}>
             <VibeContentRenderer content={`::${stat.icon}::`} />
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">{stat.label}</div>
            <div className="text-lg font-bold text-white font-orbitron">{stat.val}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function NexusPage() {
  const { user } = useAppContext();
  
  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-brand-cyan/30 overflow-x-hidden relative">
      
      {/* Dynamic Background Grid */}
      <div className="fixed inset-0 z-0 opacity-20 pointer-events-none" 
           style={{ 
             backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)', 
             backgroundSize: '40px 40px',
             transform: 'perspective(500px) rotateX(20deg) scale(1.5) translateY(-100px)'
           }} 
      />
      
      {/* Central Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-12 md:py-20">
        
        {/* Header */}
        <header className="text-center mb-16">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm mb-6"
          >
            <Activity className="w-4 h-4 text-green-500 animate-pulse" />
            <span className="text-xs font-mono text-gray-300">SYSTEM V.2025.11.27 // CONNECTED</span>
          </motion.div>
          
          <h1 className="text-5xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/10 font-orbitron mb-6 tracking-tighter">
            VIBE NEXUS
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Центральный узел управления экосистемой. 
            <br/>Все модули, базы данных и нейросети в одном интерфейсе.
          </p>
        </header>

        {/* Stats Row */}
        <SystemStats />

        {/* Grid of Sectors */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {SECTORS.map((sector, index) => (
            <SectorCard key={sector.id} sector={sector} index={index} />
          ))}
        </div>

        {/* Deep Dive / Terminal Section */}
        <div className="border-t border-white/10 pt-12">
            <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                <div>
                    <h2 className="text-2xl font-bold font-orbitron mb-2 flex items-center gap-3">
                        <Terminal className="w-6 h-6 text-brand-red-orange" /> 
                        СИСТЕМНЫЙ ЖУРНАЛ
                    </h2>
                    <p className="text-sm text-gray-500 font-mono">
                        Последние изменения в архитектуре проекта...
                    </p>
                </div>
                <Link href="/repo-xml">
                    <div className="group flex items-center gap-3 px-6 py-3 bg-zinc-900 border border-white/10 rounded-lg hover:bg-zinc-800 transition-all cursor-pointer">
                        <span className="text-sm font-bold text-gray-300 group-hover:text-white">ОТКРЫТЬ ТЕРМИНАЛ</span>
                        <Play className="w-4 h-4 text-brand-cyan group-hover:translate-x-1 transition-transform" />
                    </div>
                </Link>
            </div>
            
            <div className="mt-6 bg-black p-4 rounded-lg border border-white/10 font-mono text-xs text-gray-400 h-48 overflow-y-auto simple-scrollbar">
                <p className="mb-1"><span className="text-green-500">➜</span> [SUCCESS] Loaded 530 system files.</p>
                <p className="mb-1"><span className="text-green-500">➜</span> [MODULE] VPR Tests: 7th Grade Biology initialized.</p>
                <p className="mb-1"><span className="text-yellow-500">➜</span> [WARN] Dummy Mode active for user session.</p>
                <p className="mb-1"><span className="text-blue-500">➜</span> [INFO] Warehouse API: Waiting for connection...</p>
                <p className="mb-1"><span className="text-purple-500">➜</span> [AI] Assistant ready. Model: GPT-4o-mini.</p>
                <p className="mb-1"><span className="text-green-500">➜</span> [SYSTEM] CyberFitness Profile Sync: OK.</p>
                <p className="animate-pulse">_</p>
            </div>
        </div>

      </main>
    </div>
  );
}