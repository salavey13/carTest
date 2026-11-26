"use client";

import { motion, useScroll, useSpring } from "framer-motion";

/**
 * ReadProgress (task215b) — тонкий индикатор прокрутки для шпаргалок:
 * липкая 3px-полоса поверх страницы, scaleX растёт по мере чтения.
 * Мягкая пружина, чтобы бар «дышал», а не дёргался.
 */
export function ReadProgress({ color = "#22d3ee" }: { color?: string }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, restDelta: 0.001 });

  return (
    <motion.div
      style={{ scaleX, transformOrigin: "0 50%", background: `linear-gradient(90deg, ${color}, ${color}66)` }}
      className="fixed top-0 left-0 right-0 h-[3px] z-[100] pointer-events-none"
      aria-hidden
    />
  );
}
