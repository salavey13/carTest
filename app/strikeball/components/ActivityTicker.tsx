"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const SERVICES = [
  "STRIKEBALL", "PAINTBALL", "HYDROBALL", "LAZERTAG", 
  "SNOWBOARD", "VIBECODE", "BIKERIDE", "ENDURO", "DRINKNIGHT ROYALE"
];

export const ActivityTicker = ({ isLive }: { isLive: boolean }) => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIdx(v => (v + 1) % SERVICES.length), 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-16 sm:h-24 flex items-center justify-center overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.h1
          key={SERVICES[idx]}
          initial={{ y: 30, opacity: 0, skewX: -20 }}
          animate={{ y: 0, opacity: 1, skewX: -10 }}
          exit={{ y: -30, opacity: 0, skewX: 20 }}
          transition={{ duration: 0.4, ease: "anticipate" }}
          className={cn(
            "font-black font-orbitron italic tracking-tighter uppercase text-center",
            isLive ? "text-3xl sm:text-4xl text-white" : "text-4xl sm:text-6xl md:text-8xl text-zinc-200 drop-shadow-2xl"
          )}
        >
          {SERVICES[idx]}
        </motion.h1>
      </AnimatePresence>
    </div>
  );
};