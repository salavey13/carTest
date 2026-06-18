"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LoadingProps {
  variant?: "bike" | "generic" | "system" | "kinetic";
  text?: string;
  className?: string;
}

const LOADER_GIF_URL =
  "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Loader-S1000RR-8cb0319b-acf7-4ed9-bfd2-97b4b3e2c6fc.gif";

const bikeGoldFilter = "invert(1)";

export function Loading({ text, className }: LoadingProps) {
  return (
    <div
      className={cn(
        "min-h-screen flex items-center justify-center overflow-hidden bg-black px-6",
        className,
      )}
    >
      {/* Dark overlay for deeper black */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
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
        {/* 4 S1000RR GIF test variants */}
        <div className="grid grid-cols-2 gap-4">
          {/* Variant 1: Current baseline */}
          <div className="flex flex-col items-center gap-1">
            <img
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Loader-S1000RR-8cb0319b-acf7-4ed9-bfd2-97b4b3e2c6fc.gif"
              alt="Variant 1"
              className="w-20 h-20 object-contain"
              style={{ filter: "invert(1) sepia(1) saturate(2) hue-rotate(5deg)" }}
            />
            <span className="text-[10px] text-gray-500">invert+sepia+saturate</span>
          </div>

          {/* Variant 2: High contrast attempt */}
          <div className="flex flex-col items-center gap-1">
            <img
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Loader-S1000RR-8cb0319b-acf7-4ed9-bfd2-97b4b3e2c6fc.gif"
              alt="Variant 2"
              className="w-20 h-20 object-contain"
              style={{ filter: "invert(1) sepia(1) saturate(3) contrast(4.2) brightness(0.5)" }}
            />
            <span className="text-[10px] text-gray-500">+contrast(4.2)+bright(0.5)</span>
          </div>

          {/* Variant 3: Less sepia, different hue */}
          <div className="flex flex-col items-center gap-1">
            <img
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Loader-S1000RR-8cb0319b-acf7-4ed9-bfd2-97b4b3e2c6fc.gif"
              alt="Variant 3"
              className="w-20 h-20 object-contain"
              style={{ filter: "invert(1) sepia(0.7) saturate(2.5) hue-rotate(-15deg) contrast(1.5)" }}
            />
            <span className="text-[10px] text-gray-500">sepia(0.7)+hue(-15deg)</span>
          </div>

          {/* Variant 4: Grayscale mix */}
          <div className="flex flex-col items-center gap-1">
            <img
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Loader-S1000RR-8cb0319b-acf7-4ed9-bfd2-97b4b3e2c6fc.gif"
              alt="Variant 4"
              className="w-20 h-20 object-contain"
              style={{ filter: "invert(1) grayscale(0.5) sepia(0.8) saturate(3) contrast(2)" }}
            />
            <span className="text-[10px] text-gray-500">+grayscale(0.5)</span>
          </div>
        </div>

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
