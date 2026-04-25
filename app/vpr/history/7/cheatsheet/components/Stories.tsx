"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Story } from "../stories_data";

interface Props {
  stories: Story[];
}

export default function Stories({ stories }: Props) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const timer = useRef<NodeJS.Timeout | null>(null);

  const next = () => {
    if (index < stories.length - 1) {
      setIndex(index + 1);
      setProgress(0);
    }
  };

  // 🚫 NO PREV (чтобы не закрывался webapp)

  useEffect(() => {
    timer.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          next();
          return 0;
        }
        return p + 2;
      });
    }, 80);

    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [index]);

  // 👉 swipe только влево
  const startX = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!startX.current) return;

    const delta = e.changedTouches[0].clientX - startX.current;

    if (delta < -50) next(); // только вперёд

    startX.current = null;
  };

  return (
    <div
      className="w-full h-[100dvh] bg-black text-white flex flex-col"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* progress */}
      <div className="flex gap-1 p-2">
        {stories.map((_, i) => (
          <div key={i} className="flex-1 h-1 bg-white/20 rounded">
            <motion.div
              className="h-full bg-white"
              animate={{
                width:
                  i < index
                    ? "100%"
                    : i === index
                    ? `${progress}%`
                    : "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* content */}
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={stories[index].id}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.25 }}
            className="max-w-md w-full"
          >
            {stories[index].content}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* tap next */}
      <div
        className="absolute inset-0"
        onClick={next}
      />
    </div>
  );
}