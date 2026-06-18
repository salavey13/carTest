"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LoadingProps {
  variant?: 'bike' | 'generic' | 'system' | 'kinetic';
  text?: string;
  className?: string;
}

export function Loading({ text, className }: LoadingProps) {
  return (
    <div
      className={cn("min-h-screen flex items-center justify-center relative overflow-hidden", className)}
      style={{ backgroundColor: "#0A0A0A" }}
    >
      {/* Golden particles effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              backgroundColor: "#FFD700",
              boxShadow: "0 0 4px rgba(255, 215, 0, 0.6)",
            }}
            animate={{
              y: [0, -80],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: "linear",
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* S1000RR GIF */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <img
            src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Loader-S1000RR-8cb0319b-acf7-4ed9-bfd2-97b4b3e2c6fc.gif"
            alt="Загрузка..."
            className="w-32 h-32"
            style={{
              filter: "invert(1) sepia(1) saturate(2) hue-rotate(5deg)",
            }}
          />
        </motion.div>

        {/* Text */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center space-y-2"
        >
          <p
            className="text-sm font-medium tracking-wider"
            style={{ color: "#D4AF37" }}
          >
            {text || "Загружаем байки..."}
          </p>

          {/* Progress indicator */}
          <div className="flex items-center gap-2 justify-center">
            <motion.span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: "#FFD700" }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <motion.span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: "#FFD700" }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
            />
            <motion.span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: "#FFD700" }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
