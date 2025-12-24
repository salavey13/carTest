"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ACTIVITIES = [
  "STRIKEBALL", "PAINTBALL", "HYDROBALL", "LAZERTAG", 
  "SNOWBOARD", "VIBECODE", "BIKERIDE", "ENDURO"
];

export const ActivityTicker = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % ACTIVITIES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-20 flex flex-col items-center justify-center overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.h1
          key={ACTIVITIES[index]}
          initial={{ y: 20, opacity: 0, skewX: -20 }}
          animate={{ y: 0, opacity: 1, skewX: -10 }}
          exit={{ y: -20, opacity: 0, skewX: 20 }}
          transition={{ duration: 0.5, ease: "anticipate" }}
          className="text-6xl md:text-8xl font-black font-orbitron italic tracking-tighter text-zinc-200 drop-shadow-2xl uppercase"
        >
          {ACTIVITIES[index]}
        </motion.h1>
      </AnimatePresence>
    </div>
  );
};