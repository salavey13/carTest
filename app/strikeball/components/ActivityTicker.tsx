"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const SERVICES = [
  { text: "STRIKEBALL", color: "text-brand-cyan" },
  { text: "PAINTBALL", color: "text-brand-purple" },
  { text: "HYDROBALL", color: "text-blue-400" },
  { text: "LAZERTAG", color: "text-brand-red-orange" },
  { text: "VIBECODE", color: "text-green-400" },
  { text: "DRINKROYALE", color: "text-red-400" },
  { text: "BIKERIDE", color: "text-brand-gold" },
];

export const ActivityTicker = ({ isLive }: { isLive: boolean }) => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIdx(v => (v + 1) % SERVICES.length), 3000);
    return () => clearInterval(timer);
  }, []);

  const current = SERVICES[idx];

  return (
    <div className="relative h-24 flex items-center justify-center overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.text}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <h1
            data-text={current.text}
            className={cn(
              "font-orbitron font-black italic tracking-tighter uppercase glitch-text drop-shadow-2xl",
              "text-4xl sm:text-5xl md:text-6xl",
              current.color
            )}
          >
            {current.text}
          </h1>
        </motion.div>
      </AnimatePresence>

      {/* Scanlines overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.3)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20" />
    </div>
  );
};