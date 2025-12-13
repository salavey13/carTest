"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/contexts/AppContext";
import { CreateLobbyForm } from "./components/CreateLobbyForm";
import { cn } from "@/lib/utils";

// Q3 Style Menu Item
const Q3MenuItem = ({ label, subLabel, href, onClick, disabled = false, isActive = false }: any) => {
  const [hovered, setHovered] = useState(false);
  
  const Container = href ? Link : 'div';
  const props = href ? { href } : { onClick };

  return (
    <Container 
        {...props}
        className={cn(
        "relative group flex items-center justify-between w-full py-4 px-6 border-b-2 transition-all duration-75 uppercase cursor-pointer select-none",
        disabled ? "opacity-50 cursor-not-allowed border-zinc-900" : 
        hovered || isActive ? "bg-red-950/60 border-red-600 pl-8" : "bg-black/60 border-zinc-800"
      )}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {(hovered || isActive) && (
        <motion.div layoutId="q3-selector" className="absolute left-2 top-1/2 -translate-y-1/2 text-red-500 text-2xl font-black">►</motion.div>
      )}
      <div className="flex flex-col">
        <span className={cn("font-orbitron font-black text-2xl tracking-widest transition-colors shadow-black drop-shadow-md", hovered || isActive ? "text-red-500" : "text-zinc-400")}>{label}</span>
        {subLabel && <span className="text-[10px] font-mono text-zinc-500 tracking-[0.2em]">{subLabel}</span>}
      </div>
    </Container>
  );
};

export default function StrikeballDashboard() {
  const [menuStep, setMenuStep] = useState<'main' | 'create'>('main');

  return (
    <div className="pt-28 pb-32 px-4 relative min-h-screen">
      
      {/* Title */}
      <div className="text-center mb-12">
        <motion.h1 initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-6xl md:text-8xl font-black italic text-zinc-200 tracking-tighter drop-shadow-2xl">
          STRIKE<span className="text-red-600">BALL</span>
        </motion.h1>
        <p className="text-red-500/80 font-mono text-xs tracking-[0.5em] mt-2 border-t border-red-900/50 inline-block px-8 py-1">
          ТАКТИЧЕСКИЕ ОПЕРАЦИИ
        </p>
      </div>

      {/* Menu Container */}
      <div className="max-w-md mx-auto">
        <div className="bg-zinc-900/80 backdrop-blur-md border-4 border-zinc-800 p-1 shadow-2xl">
          <div className="border border-red-900/30 p-1">
            <AnimatePresence mode="wait">
              {menuStep === 'main' ? (
                <motion.div 
                  key="main"
                  initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}
                  className="space-y-2"
                >
                  <Q3MenuItem label="СЕТЕВАЯ ИГРА" subLabel="ПОИСК АКТИВНЫХ ОТРЯДОВ" href="/strikeball/lobbies" />
                  <Q3MenuItem label="СОЗДАТЬ СЕРВЕР" subLabel="НОВАЯ ОПЕРАЦИЯ" onClick={() => setMenuStep('create')} />
                  <Q3MenuItem label="АРСЕНАЛ" subLabel="АРЕНДА СНАРЯЖЕНИЯ" href="/strikeball/shop" />
                  <div className="h-4" />
                  <Q3MenuItem label="QR КОННЕКТ" subLabel="СКАНИРОВАНИЕ ПОЛЯ" onClick={() => alert("ИНИЦИАЛИЗАЦИЯ СЕНСОРОВ...")} />
                </motion.div>
              ) : (
                <motion.div
                  key="create"
                  initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }}
                >
                  <div className="bg-black/60 p-4 mb-2 border border-zinc-700">
                    <h3 className="text-red-500 mb-4 font-black uppercase border-b border-red-800 pb-2">Параметры Высадки</h3>
                    <CreateLobbyForm />
                  </div>
                  <Q3MenuItem label="ОТМЕНА" subLabel="НАЗАД В МЕНЮ" onClick={() => setMenuStep('main')} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}