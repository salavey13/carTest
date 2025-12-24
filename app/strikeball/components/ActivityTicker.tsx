"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ACTIVITIES = [
  "STRIKEBALL", "PAINTBALL", "HYDROBALL", "LAZERTAG", 
  "SNOWBOARD", "VIBECODE", "BIKERIDE", "ENDURO"
];

export const ActivityTicker = ({ isLive }: { isLive?: boolean }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % ACTIVITIES.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-16 md:h-24 flex flex-col items-center justify-center overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.h1
          key={ACTIVITIES[index]}
          initial={{ y: 20, opacity: 0, skewX: -20 }}
          animate={{ y: 0, opacity: 1, skewX: -10 }}
          exit={{ y: -20, opacity: 0, skewX: 20 }}
          transition={{ duration: 0.4, ease: "anticipate" }}
          className={cn(
            "font-black font-orbitron italic tracking-tighter uppercase text-center w-full px-2",
            isLive ? "text-3xl sm:text-4xl text-white" : "text-4xl sm:text-6xl md:text-8xl text-zinc-200 drop-shadow-2xl"
          )}
          style={{ wordBreak: "keep-all" }}
        >
          {ACTIVITIES[index]}
        </motion.h1>
      </AnimatePresence>
    </div>
  );
};